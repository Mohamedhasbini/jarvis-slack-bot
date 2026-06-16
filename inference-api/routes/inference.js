const express = require('express');
const axios = require('axios');
const supabase = require('../db');
const { requireApiKey } = require('../middleware/apiKey');

const router = express.Router();

const INPUT_PRICE_PER_TOKEN = 0.50 / 1_000_000;   // $0.50 per 1M input tokens
const OUTPUT_PRICE_PER_TOKEN = 2.00 / 1_000_000;  // $2.00 per 1M output tokens
const FREE_TRIAL_BALANCE = 5.00;                   // $5 trial credits

// GET /v1/models
router.get('/models', requireApiKey, async (req, res) => {
  res.json({
    object: 'list',
    data: [
      {
        id: 'jarvis-llama-3.1-70b',
        object: 'model',
        created: 1700000000,
        owned_by: 'jarvis-inference',
        description: 'Llama 3.1 70B — high-quality open-source model',
      },
      {
        id: 'jarvis-llama-3.1-8b',
        object: 'model',
        created: 1700000000,
        owned_by: 'jarvis-inference',
        description: 'Llama 3.1 8B — fast, cost-efficient model',
      },
    ],
  });
});

// POST /v1/chat/completions — OpenAI-compatible inference endpoint
router.post('/chat/completions', requireApiKey, async (req, res) => {
  const userId = req.userId;

  // Check balance before processing
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('balance, tier')
    .eq('id', userId)
    .single();

  if (userErr || !user) {
    return res.status(500).json({ error: { message: 'Failed to verify account', type: 'server_error' } });
  }

  if (user.balance <= 0 && user.tier !== 'enterprise') {
    return res.status(402).json({
      error: {
        message: 'Insufficient balance. Please top up your account at /api/billing/topup',
        type: 'billing_error',
        code: 'insufficient_balance',
      },
    });
  }

  const { model = 'jarvis-llama-3.1-70b', messages, stream = false, ...rest } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: { message: 'messages is required', type: 'invalid_request_error' } });
  }

  try {
    let completionData;

    if (process.env.VLLM_URL) {
      // Forward directly to vLLM (already OpenAI-compatible)
      const vllmResponse = await axios.post(
        `${process.env.VLLM_URL}/v1/chat/completions`,
        { model, messages, stream: false, ...rest },
        { timeout: 120000 }
      );
      completionData = vllmResponse.data;
    } else {
      // Dev fallback: convert to Anthropic API format
      completionData = await callAnthropicFallback(model, messages, rest);
    }

    const inputTokens = completionData.usage?.prompt_tokens || estimateTokens(messages);
    const outputTokens = completionData.usage?.completion_tokens || 0;
    const cost = inputTokens * INPUT_PRICE_PER_TOKEN + outputTokens * OUTPUT_PRICE_PER_TOKEN;

    // Log usage and deduct balance (non-blocking)
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
    ]).catch(err => console.error('Usage tracking error:', err.message));

    res.json(completionData);
  } catch (err) {
    console.error('Inference error:', err.message);
    const status = err.response?.status || 500;
    const message = err.response?.data?.error?.message || err.message || 'Inference failed';
    res.status(status).json({ error: { message, type: 'server_error' } });
  }
});

// Convert OpenAI-format request to Anthropic and back (dev fallback when no vLLM)
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

  const anthropicData = response.data;
  // Convert to OpenAI response format
  return {
    id: `chatcmpl-${anthropicData.id}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: anthropicData.content[0].text },
        finish_reason: anthropicData.stop_reason === 'end_turn' ? 'stop' : anthropicData.stop_reason,
      },
    ],
    usage: {
      prompt_tokens: anthropicData.usage.input_tokens,
      completion_tokens: anthropicData.usage.output_tokens,
      total_tokens: anthropicData.usage.input_tokens + anthropicData.usage.output_tokens,
    },
  };
}

function estimateTokens(messages) {
  return messages.reduce((sum, m) => sum + Math.ceil((m.content || '').length / 4), 0);
}

module.exports = router;
