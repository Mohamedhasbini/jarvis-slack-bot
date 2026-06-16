const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('crypto');
const supabase = require('../db');
const { requireAuth } = require('../middleware/auth');
const { signupLimiter, loginLimiter, resetLimiter } = require('../middleware/rateLimit');
const { validateEmail, validatePassword } = require('../middleware/validate');
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} = require('../services/email');

const router = express.Router();

function makeToken() {
  return randomBytes(32).toString('hex');
}

function signJwt(userId, email) {
  return jwt.sign({ userId, email }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

// POST /auth/signup
router.post('/signup', signupLimiter, async (req, res) => {
  const { email: rawEmail, password, name } = req.body;
  const email = (rawEmail || '').toLowerCase().trim();

  const emailErr = validateEmail(email);
  if (emailErr) return res.status(400).json({ error: emailErr });
  const passErr = validatePassword(password);
  if (passErr) return res.status(400).json({ error: passErr });

  const passwordHash = await bcrypt.hash(password, 12);
  const verifyToken = makeToken();
  const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const signupIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;

  const { data, error } = await supabase
    .from('users')
    .insert({
      email,
      password_hash: passwordHash,
      name: name?.trim() || null,
      email_verification_token: verifyToken,
      email_verification_expires: verifyExpires,
      signup_ip: signupIp,
    })
    .select('id, email, name, balance, tier, is_email_verified, created_at')
    .single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    console.error('Signup error:', error.message);
    return res.status(500).json({ error: 'Failed to create account' });
  }

  // Send verification email (non-blocking — don't fail signup if email fails)
  sendVerificationEmail(email, verifyToken).catch(err =>
    console.error('Failed to send verification email:', err.message)
  );

  const token = signJwt(data.id, data.email);
  res.status(201).json({
    user: data,
    token,
    message: 'Account created. Please check your email to verify your address before using the API.',
  });
});

// GET /auth/verify/:token
router.get('/verify/:token', async (req, res) => {
  const { token } = req.params;
  if (!token) return res.status(400).send('Invalid link');

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, name, is_email_verified, email_verification_expires')
    .eq('email_verification_token', token)
    .single();

  if (error || !user) {
    return res.status(400).send(verifyErrorPage('Invalid or expired verification link. Please request a new one.'));
  }
  if (user.is_email_verified) {
    return res.redirect(`${process.env.APP_URL || ''}/dashboard?verified=already`);
  }
  if (new Date(user.email_verification_expires) < new Date()) {
    return res.status(400).send(verifyErrorPage('This verification link has expired. Please sign in and request a new one.'));
  }

  await supabase.from('users').update({
    is_email_verified: true,
    email_verification_token: null,
    email_verification_expires: null,
    updated_at: new Date().toISOString(),
  }).eq('id', user.id);

  // Send welcome email
  sendWelcomeEmail(user.email, user.name).catch(() => {});

  res.redirect(`${process.env.APP_URL || ''}/dashboard?verified=true`);
});

// POST /auth/resend-verification
router.post('/resend-verification', requireAuth, async (req, res) => {
  const { data: user } = await supabase
    .from('users')
    .select('email, is_email_verified')
    .eq('id', req.user.userId)
    .single();

  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.is_email_verified) return res.status(400).json({ error: 'Email already verified' });

  const token = makeToken();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await supabase.from('users').update({
    email_verification_token: token,
    email_verification_expires: expires,
  }).eq('id', req.user.userId);

  sendVerificationEmail(user.email, token).catch(() => {});
  res.json({ ok: true, message: 'Verification email sent' });
});

// POST /auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const { email: rawEmail, password } = req.body;
  const email = (rawEmail || '').toLowerCase().trim();

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, name, balance, tier, is_email_verified, password_hash, locked_until, failed_login_attempts')
    .eq('email', email)
    .single();

  // Generic message to prevent user enumeration
  const invalidMsg = 'Invalid email or password';

  if (error || !user) return res.status(401).json({ error: invalidMsg });

  // Check account lockout
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
    return res.status(423).json({
      error: `Account temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`,
    });
  }

  const valid = await bcrypt.compare(password, user.password_hash);

  if (!valid) {
    // Increment failed attempts; lock after 10
    const attempts = (user.failed_login_attempts || 0) + 1;
    const update = { failed_login_attempts: attempts };
    if (attempts >= 10) {
      update.locked_until = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min lock
    }
    await supabase.from('users').update(update).eq('id', user.id);
    return res.status(401).json({ error: invalidMsg });
  }

  // Reset failed attempts on success
  await supabase.from('users').update({ failed_login_attempts: 0, locked_until: null }).eq('id', user.id);

  const { password_hash: _, locked_until: __, failed_login_attempts: ___, ...safeUser } = user;
  const token = signJwt(user.id, user.email);

  res.json({ user: safeUser, token });
});

// GET /auth/me
router.get('/me', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, balance, tier, is_email_verified, created_at')
    .eq('id', req.user.userId)
    .single();

  if (error || !data) return res.status(404).json({ error: 'User not found' });
  res.json(data);
});

// POST /auth/forgot-password
router.post('/forgot-password', resetLimiter, async (req, res) => {
  const email = (req.body.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'Email is required' });

  // Always return 200 to prevent user enumeration
  const { data: user } = await supabase.from('users').select('id, email').eq('email', email).single();

  if (user) {
    const token = makeToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    await supabase.from('users').update({
      password_reset_token: token,
      password_reset_expires: expires,
    }).eq('id', user.id);

    sendPasswordResetEmail(user.email, token).catch(() => {});
  }

  res.json({ ok: true, message: 'If that email exists, a reset link has been sent.' });
});

// POST /auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'token and password are required' });

  const passErr = validatePassword(password);
  if (passErr) return res.status(400).json({ error: passErr });

  const { data: user, error } = await supabase
    .from('users')
    .select('id, password_reset_expires')
    .eq('password_reset_token', token)
    .single();

  if (error || !user) return res.status(400).json({ error: 'Invalid or expired reset link' });
  if (new Date(user.password_reset_expires) < new Date()) {
    return res.status(400).json({ error: 'This reset link has expired. Please request a new one.' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await supabase.from('users').update({
    password_hash: passwordHash,
    password_reset_token: null,
    password_reset_expires: null,
    failed_login_attempts: 0,
    locked_until: null,
    updated_at: new Date().toISOString(),
  }).eq('id', user.id);

  res.json({ ok: true, message: 'Password updated successfully. You can now log in.' });
});

function verifyErrorPage(message) {
  return `<!DOCTYPE html><html><head><title>Verification Error</title>
  <style>body{font-family:system-ui;background:#0a0a0f;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
  .card{background:#12121a;border:1px solid #1e1e2e;border-radius:12px;padding:2.5rem;max-width:400px;text-align:center}
  h2{color:#ef4444;margin-bottom:1rem} p{color:#94a3b8;margin-bottom:1.5rem}
  a{background:#00d4ff;color:#000;padding:.75rem 1.5rem;border-radius:8px;text-decoration:none;font-weight:700}</style>
  </head><body><div class="card"><h2>Verification Failed</h2><p>${message}</p>
  <a href="/">Back to Home</a></div></body></html>`;
}

module.exports = router;
