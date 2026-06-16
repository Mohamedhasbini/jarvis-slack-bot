const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../db');

const router = express.Router();

// POST /auth/signup
router.post('/signup', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const { data, error } = await supabase
    .from('users')
    .insert({ email: email.toLowerCase().trim(), password_hash: passwordHash, name: name || null })
    .select('id, email, name, balance, tier, created_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    return res.status(500).json({ error: 'Failed to create account' });
  }

  const token = jwt.sign({ userId: data.id, email: data.email }, process.env.JWT_SECRET, { expiresIn: '30d' });

  res.status(201).json({ user: data, token });
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, name, balance, tier, password_hash')
    .eq('email', email.toLowerCase().trim())
    .single();

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '30d' });
  const { password_hash: _, ...safeUser } = user;

  res.json({ user: safeUser, token });
});

// GET /auth/me
router.get('/me', require('../middleware/auth').requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, balance, tier, created_at')
    .eq('id', req.user.userId)
    .single();

  if (error || !data) return res.status(404).json({ error: 'User not found' });
  res.json(data);
});

module.exports = router;
