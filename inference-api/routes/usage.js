const express = require('express');
const supabase = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// GET /api/usage  — current period stats + balance
router.get('/', async (req, res) => {
  const userId = req.user.userId;
  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);

  const [balanceRes, usageRes, recentRes] = await Promise.all([
    supabase.from('users').select('balance, tier').eq('id', userId).single(),
    supabase
      .from('usage_logs')
      .select('input_tokens, output_tokens, cost')
      .eq('user_id', userId)
      .gte('timestamp', periodStart.toISOString()),
    supabase
      .from('usage_logs')
      .select('id, model, input_tokens, output_tokens, cost, timestamp')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(50),
  ]);

  const logs = usageRes.data || [];
  const totals = logs.reduce(
    (acc, row) => ({
      input_tokens: acc.input_tokens + (row.input_tokens || 0),
      output_tokens: acc.output_tokens + (row.output_tokens || 0),
      cost: acc.cost + parseFloat(row.cost || 0),
      requests: acc.requests + 1,
    }),
    { input_tokens: 0, output_tokens: 0, cost: 0, requests: 0 }
  );

  res.json({
    balance: balanceRes.data?.balance ?? 0,
    tier: balanceRes.data?.tier ?? 'free',
    current_period: {
      start: periodStart.toISOString(),
      input_tokens: totals.input_tokens,
      output_tokens: totals.output_tokens,
      total_cost: parseFloat(totals.cost.toFixed(6)),
      requests: totals.requests,
    },
    recent_requests: recentRes.data || [],
  });
});

module.exports = router;
