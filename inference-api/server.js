require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const helmet = require('helmet');
const path = require('path');

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],   // needed for inline dashboard scripts
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'https:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Trust proxy (needed for correct IP when behind Netlify/Railway/nginx)
app.set('trust proxy', 1);

// Raw body for Stripe webhook MUST come before JSON parsing
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

// JSON body parsing for everything else
app.use(express.json({ limit: '4mb' }));

// CORS — public API
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Static files (HTML pages)
app.use(express.static(path.join(__dirname, '../')));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, '../pricing.html')));
app.get('/dashboard', (_req, res) => res.sendFile(path.join(__dirname, '../inference-dashboard.html')));
app.get('/reset-password.html', (_req, res) => res.sendFile(path.join(__dirname, '../reset-password.html')));
app.get('/tos', (_req, res) => res.sendFile(path.join(__dirname, '../tos.html')));
app.get('/privacy', (_req, res) => res.sendFile(path.join(__dirname, '../privacy.html')));

// API Routes
app.use('/auth', require('./routes/auth'));
app.use('/api/keys', require('./routes/keys'));
app.use('/api/usage', require('./routes/usage'));
app.use('/api/billing', require('./routes/billing'));
app.use('/v1', require('./routes/inference'));

// Health check
app.get('/health', (_req, res) => res.json({ ok: true, service: 'jarvis-inference' }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: { message: 'Internal server error', type: 'server_error' } });
});

const PORT = process.env.INFERENCE_PORT || 3001;
app.listen(PORT, () => {
  console.log(`Jarvis Inference API running on port ${PORT}`);
  if (!process.env.VLLM_URL) console.log('⚠  VLLM_URL not set — Anthropic API fallback active');
  if (!process.env.STRIPE_SECRET_KEY) console.log('⚠  STRIPE_SECRET_KEY not set — billing disabled');
  if (!process.env.SMTP_HOST) console.log('⚠  SMTP_HOST not set — emails logged to console only');
});
