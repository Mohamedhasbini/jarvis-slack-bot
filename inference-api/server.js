require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const path = require('path');

const app = express();

// JSON body parsing (except for Stripe webhook which needs raw bytes)
app.use((req, res, next) => {
  if (req.path === '/api/billing/webhook') return next();
  express.json({ limit: '4mb' })(req, res, next);
});

// CORS — allow all origins for a public API
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Serve pricing / dashboard pages
app.use(express.static(path.join(__dirname, '../')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../pricing.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, '../inference-dashboard.html')));

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/api/keys', require('./routes/keys'));
app.use('/api/usage', require('./routes/usage'));
app.use('/api/billing', require('./routes/billing'));
app.use('/v1', require('./routes/inference'));

// Health check
app.get('/health', (req, res) => res.json({ ok: true, service: 'jarvis-inference' }));

const PORT = process.env.INFERENCE_PORT || 3001;
app.listen(PORT, () => {
  console.log(`Jarvis Inference API running on port ${PORT}`);
  if (!process.env.VLLM_URL) {
    console.log('⚠  VLLM_URL not set — using Anthropic API as fallback backend');
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    console.log('⚠  STRIPE_SECRET_KEY not set — billing endpoints disabled');
  }
});
