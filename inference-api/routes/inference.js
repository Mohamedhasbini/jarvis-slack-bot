const express = require('express');
const axios = require('axios');
const supabase = require('../db');
const { requireApiKey } = require('../middleware/apiKey');
const { inferenceLimiter } = require('../middleware/rateLimit');
const { sendLowBalanceEmail } = require('../services/email');

const router = express.Router();

const INPUT_PRICE_PER_TOKEN = 0.50 / 1_000_000;
const OUTPUT_PRICE_PER_TOKEN = 2.00 / 1_000_000;
const LOW_BALANCE_THRESHOLD = 1.00; // Alert when balance drops below $1

// GET /v1/models
router.get('/models', requireApiKey, async (_req, res) => {
  res.json({
    object: 'list',
    data: [
      {
        id: 'jarvis-llama-3.1-70b',
        object: 'model',
        created: 1700000000,
        owned_by: 'jarvis-inference',
        description: 'Llama 3.1 70B — flagship open-source model',
      },
      {
        id: 'jarvis-llama-3.1-8b',
        object: 'model',
        created: 1700000000,
        owned_by: 'jarvis-inference',
        description: 'Llama 3.1 8B — fast, cost-efficient',
      },
    ],
  });
});

// POST /v1/chat/completions
router.post('/chat/completions', requireApiKey, inferenceLimiter, async (req, res) => {
  const userId = req.userId;

  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('balance, tier, is_email_verified, email')
    .eq('id', userId)
    .single();

  if (userErr || !user) {
    return res.status(500).json({ error: { message: 'Failed to verify account', type: 'server_error' } });
  }

  // Email must be verified before using the API
  if (!user.is_email_verified) {
    return res.status(403).json({
      error: {
        message: 'Email address not verified. Please check your inbox and click the verification link.',
        type: 'authentication_error',
        code: 'email_not_verified',
      },
    });
  }

  if (user.balance <= 0 && user.tier !== 'enterprise') {
    return res.status(402).json({
      error: {
        message: 'Insufficient balance. Top up at /dashboard#billing',
        type: 'billing_error',
        code: 'insufficient_balance',
      },
    });
  }

  const { model = 'jarvis-llama-3.1-70b', messages, stream = false, ...rest } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: { message: '`messages` array is required', type: 'invalid_request_error' } });
  }

  try {
    let completionData;

    if (process.env.VLLM_URL) {
      const vllmRes = await axios.post(
        `${process.env.VLLM_URL}/v1/chat/completions`,
        { model, messages, stream: false, ...rest },
        { timeout: 120000 }
      );
      completionData = vllmRes.data;
    } else {
      completionData = await callAnthropicFallback(model, messages, rest);
    }

    const inputTokens = completionData.usage?.prompt_tokens || estimateTokens(messages);
    const outputTokens = completionData.usage?.completion_tokens || 0;
    const cost = inputTokens * INPUT_PRICE_PER_TOKEN + outputTokens * OUTPUT_PRICE_PER_TOKEN;
    const newBalance = parseFloat(user.balance) - cost;

    // Log + deduct (parallel, non-blocking)
    Promise.all([
      supabase.from('usage_logs').insert({
        user_id: userId,
        api_key_id: req.apiKeyId,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost: cost.toFixed(8),
        timestamp: new Date().toISOString(),
      }),
      supabase.rpc('deduct_balance', { user_id_param: userId, amount_param: cost }),
    ]).then(() => {
      // Send low balance email if balance just dropped below threshold
      if (parseFloat(user.balance) >= LOW_BALANCE_THRESHOLD && newBalance < LOW_BALANCE_THRESHOLD) {
        sendLowBalanceEmail(user.email, newBalance).catch(() => {});
      }
    }).catch(err => console.error('Usage tracking error:', err.message));

    res.json(completionData);
  } catch (err) {
    console.error('Inference error:', err.message);
    const status = err.response?.status || 500;
    const message = err.response?.data?.error?.message || err.message || 'Inference failed';
    res.status(status).json({ error: { message, type: 'server_error' } });
  }
});

async function callAnthropicFallback(model, messages, opts) {
  if (!process.env.CLAUDE_API_KEY) {
    throw new Error('No inference backend configured. Set VLLM_URL or CLAUDE_API_KEY.');
  }

  const system = messages.find(m => m.role === 'system')?.content || undefined;
  const chatMessages = messages.filter(m => m.role !== 'system');

  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: opts.max_tokens || 2048,
      system,
      messages: chatMessages,
    },
    {
      headers: { 'x-api-key': process.env.CLAUDE_API_KEY, 'anthropic-version': '2023-06-01' },
      timeout: 60000,
    }
  );

  const d = response.data;
  return {
    id: `chatcmpl-${d.id}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      message: { role: 'assistant', content: d.content[0].text },
      finish_reason: d.stop_reason === 'end_turn' ? 'stop' : d.stop_reason,
    }],
    usage: {
      prompt_tokens: d.usage.input_tokens,
      completion_tokens: d.usage.output_tokens,
      total_tokens: d.usage.input_tokens + d.usage.output_tokens,
    },
  };
}

function estimateTokens(messages) {
  return messages.reduce((sum, m) => sum + Math.ceil((m.content || '').length / 4), 0);
}

module.exports = router;
