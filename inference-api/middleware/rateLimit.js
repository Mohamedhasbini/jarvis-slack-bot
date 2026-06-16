const rateLimit = require('express-rate-limit');

const json429 = (msg) => (_req, res) =>
  res.status(429).json({ error: msg });

// Signup: 5 accounts per IP per hour
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip,
  handler: json429('Too many accounts created from this IP. Please try again in an hour.'),
});

// Login: 10 attempts per IP per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip,
  handler: json429('Too many login attempts. Please try again in 15 minutes.'),
});

// Password reset: 3 requests per IP per hour
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip,
  handler: json429('Too many password reset requests. Please try again in an hour.'),
});

// Inference: 120 requests per IP per minute (generous but prevents abuse)
const inferenceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: (req) => req.userId || req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip,
  handler: json429('Rate limit exceeded. Max 120 requests per minute.'),
});

module.exports = { signupLimiter, loginLimiter, resetLimiter, inferenceLimiter };
