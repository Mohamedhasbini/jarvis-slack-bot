const nodemailer = require('nodemailer');

const FROM = process.env.EMAIL_FROM || 'Jarvis Inference <noreply@jarvis-inference.com>';
const BASE_URL = process.env.APP_URL || 'http://localhost:3001';

function createTransport() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  // Dev fallback — prints to console instead of sending
  return {
    sendMail: async (opts) => {
      console.log('\n📧 [EMAIL - DEV MODE]');
      console.log(`  To: ${opts.to}`);
      console.log(`  Subject: ${opts.subject}`);
      const link = opts.html?.match(/href="([^"]+)"/)?.[1];
      if (link) console.log(`  Link: ${link}`);
      console.log('  (Set SMTP_HOST to send real emails)\n');
    },
  };
}

function emailLayout(body) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;margin:0;padding:40px 0}
  .card{background:#fff;max-width:520px;margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
  .header{background:#0a0a0f;padding:28px 32px;text-align:center}
  .logo{color:#00d4ff;font-size:1.3rem;font-weight:800;letter-spacing:-0.5px}
  .logo span{color:#e2e8f0}
  .body{padding:36px 32px}
  h2{margin:0 0 12px;font-size:1.25rem;color:#0f172a}
  p{margin:0 0 16px;color:#475569;line-height:1.6;font-size:0.95rem}
  .btn{display:inline-block;background:#00d4ff;color:#000;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:0.95rem;margin:8px 0}
  .divider{border:none;border-top:1px solid #e2e8f0;margin:24px 0}
  .footer{background:#f8fafc;padding:20px 32px;text-align:center;font-size:0.8rem;color:#94a3b8}
  .url-fallback{word-break:break-all;color:#64748b;font-size:0.8rem;font-family:monospace}
</style>
</head><body><div class="card">
<div class="header"><div class="logo">Jarvis<span> Inference</span></div></div>
<div class="body">${body}</div>
<div class="footer">Jarvis Inference · Open-source LLM API<br>If you didn't create this account, ignore this email.</div>
</div></body></html>`;
}

async function sendVerificationEmail(to, token) {
  const link = `${BASE_URL}/auth/verify/${token}`;
  const transport = createTransport();
  await transport.sendMail({
    from: FROM,
    to,
    subject: 'Verify your Jarvis Inference account',
    html: emailLayout(`
      <h2>Verify your email address</h2>
      <p>Thanks for signing up! Click the button below to verify your email and activate your API keys.</p>
      <a href="${link}" class="btn">Verify Email Address</a>
      <hr class="divider">
      <p>This link expires in <strong>24 hours</strong>.</p>
      <p>If the button doesn't work, copy this URL into your browser:</p>
      <p class="url-fallback">${link}</p>
    `),
  });
}

async function sendPasswordResetEmail(to, token) {
  const link = `${BASE_URL}/reset-password.html?token=${token}`;
  const transport = createTransport();
  await transport.sendMail({
    from: FROM,
    to,
    subject: 'Reset your Jarvis Inference password',
    html: emailLayout(`
      <h2>Reset your password</h2>
      <p>We received a request to reset the password for your account.</p>
      <a href="${link}" class="btn">Reset Password</a>
      <hr class="divider">
      <p>This link expires in <strong>1 hour</strong>. If you didn't request a reset, you can safely ignore this email.</p>
      <p class="url-fallback">${link}</p>
    `),
  });
}

async function sendWelcomeEmail(to, name) {
  const transport = createTransport();
  await transport.sendMail({
    from: FROM,
    to,
    subject: 'Welcome to Jarvis Inference — your $5 credits are ready',
    html: emailLayout(`
      <h2>Welcome${name ? ', ' + name : ''}!</h2>
      <p>Your account is verified and your <strong>$5 free credits</strong> are active. You're ready to make your first API call.</p>
      <a href="${BASE_URL}/dashboard" class="btn">Go to Dashboard</a>
      <hr class="divider">
      <p><strong>Quick start:</strong></p>
      <p>Grab your API key from the dashboard, then use it exactly like OpenAI:</p>
      <pre style="background:#f1f5f9;padding:12px;border-radius:6px;font-size:0.8rem;overflow-x:auto">base_url = "${BASE_URL}/v1"
model = "jarvis-llama-3.1-70b"</pre>
      <p><strong>Pricing:</strong> $0.50 / 1M input tokens · $2.00 / 1M output tokens</p>
    `),
  });
}

async function sendLowBalanceEmail(to, balance) {
  const transport = createTransport();
  await transport.sendMail({
    from: FROM,
    to,
    subject: `Low balance alert — $${parseFloat(balance).toFixed(2)} remaining`,
    html: emailLayout(`
      <h2>Your balance is running low</h2>
      <p>You have <strong>$${parseFloat(balance).toFixed(2)}</strong> remaining in your Jarvis Inference account. Top up now to avoid service interruption.</p>
      <a href="${BASE_URL}/dashboard#billing" class="btn">Top Up Credits</a>
      <hr class="divider">
      <p>Credit packages start at $10. Unused credits never expire.</p>
    `),
  });
}

async function sendPaymentConfirmationEmail(to, amount) {
  const transport = createTransport();
  await transport.sendMail({
    from: FROM,
    to,
    subject: `Payment confirmed — $${amount} added to your account`,
    html: emailLayout(`
      <h2>Payment confirmed</h2>
      <p><strong>$${amount}</strong> has been added to your Jarvis Inference account. Your credits are available immediately.</p>
      <a href="${BASE_URL}/dashboard" class="btn">View Dashboard</a>
      <hr class="divider">
      <p>Questions? Reply to this email and we'll help.</p>
    `),
  });
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendLowBalanceEmail,
  sendPaymentConfirmationEmail,
};
