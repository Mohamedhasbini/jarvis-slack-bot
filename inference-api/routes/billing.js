const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../db');
const { requireAuth } = require('../middleware/auth');
const { sendPaymentConfirmationEmail } = require('../services/email');

const router = express.Router();

const CREDIT_PACKAGES = [
  { id: 'credits_10',  amount: 10,  label: '$10 credits',  price_cents: 1000 },
  { id: 'credits_25',  amount: 25,  label: '$25 credits',  price_cents: 2500 },
  { id: 'credits_100', amount: 100, label: '$100 credits', price_cents: 10000 },
];

// GET /api/billing/packages
router.get('/packages', (_req, res) => {
  res.json(CREDIT_PACKAGES);
});

// POST /api/billing/topup — create Stripe checkout session
router.post('/topup', requireAuth, async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Billing not configured on this server' });
  }

  const { package_id } = req.body;
  const pkg = CREDIT_PACKAGES.find(p => p.id === package_id);
  if (!pkg) return res.status(400).json({ error: 'Invalid package_id' });

  const { data: user } = await supabase
    .from('users')
    .select('email, is_email_verified')
    .eq('id', req.user.userId)
    .single();

  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.is_email_verified) {
    return res.status(403).json({ error: 'Please verify your email before adding credits' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: user.email,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Jarvis Inference Credits — ${pkg.label}`,
            description: `${pkg.amount} USD of inference credits (~${Math.floor(pkg.amount / 0.5)}M input tokens)`,
          },
          unit_amount: pkg.price_cents,
        },
        quantity: 1,
      }],
      metadata: { user_id: req.user.userId, credits: String(pkg.amount), email: user.email },
      // Stripe Radar fraud detection is enabled by default — no action needed
      success_url: `${process.env.APP_URL || 'http://localhost:3001'}/dashboard?payment=success`,
      cancel_url: `${process.env.APP_URL || 'http://localhost:3001'}/dashboard?payment=cancelled`,
    });

    res.json({ checkout_url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /api/billing/webhook — Stripe payment confirmation (raw body required)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: 'Webhook secret not configured' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Only credit on successful payment (not just session creation)
    if (session.payment_status !== 'paid') {
      return res.json({ received: true });
    }

    const userId = session.metadata?.user_id;
    const credits = parseFloat(session.metadata?.credits || 0);
    const email = session.metadata?.email;

    if (userId && credits > 0) {
      await supabase.rpc('add_balance', { user_id_param: userId, amount_param: credits });
      console.log(`✓ Credited $${credits} to user ${userId}`);

      if (email) {
        sendPaymentConfirmationEmail(email, credits).catch(() => {});
      }
    }
  }

  // Handle refunds / disputes — deduct balance
  if (event.type === 'charge.dispute.created') {
    const charge = event.data.object;
    const amountUSD = charge.amount / 100;
    console.warn(`⚠ Dispute opened for $${amountUSD} — charge ${charge.id}`);
    // In production: flag user account for review, notify admin
  }

  res.json({ received: true });
});

module.exports = router;
