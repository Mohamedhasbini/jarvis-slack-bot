const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const CREDIT_PACKAGES = [
  { id: 'credits_10', amount: 10, label: '$10 credits', price_cents: 1000 },
  { id: 'credits_25', amount: 25, label: '$25 credits', price_cents: 2500 },
  { id: 'credits_100', amount: 100, label: '$100 credits', price_cents: 10000 },
];

// GET /api/billing/packages
router.get('/packages', (req, res) => {
  res.json(CREDIT_PACKAGES);
});

// POST /api/billing/topup  — create Stripe checkout session
router.post('/topup', requireAuth, async (req, res) => {
  const { package_id } = req.body;
  const pkg = CREDIT_PACKAGES.find(p => p.id === package_id);
  if (!pkg) return res.status(400).json({ error: 'Invalid package_id' });

  const { data: user } = await supabase
    .from('users')
    .select('email')
    .eq('id', req.user.userId)
    .single();

  if (!user) return res.status(404).json({ error: 'User not found' });

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: `Jarvis Inference — ${pkg.label}` },
            unit_amount: pkg.price_cents,
          },
          quantity: 1,
        },
      ],
      metadata: { user_id: req.user.userId, credits: pkg.amount },
      success_url: `${process.env.APP_URL || 'http://localhost:3001'}/dashboard?payment=success`,
      cancel_url: `${process.env.APP_URL || 'http://localhost:3001'}/dashboard?payment=cancelled`,
    });

    res.json({ checkout_url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /api/billing/webhook  — Stripe payment confirmation
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.user_id;
    const credits = parseFloat(session.metadata?.credits || 0);

    if (userId && credits > 0) {
      await supabase.rpc('add_balance', { user_id_param: userId, amount_param: credits });
      console.log(`Credited $${credits} to user ${userId}`);
    }
  }

  res.json({ received: true });
});

module.exports = router;
