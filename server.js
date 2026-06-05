require('dotenv').config();
const express = require('express');
const { createHmac } = require('crypto');
const axios = require('axios');

const app = express();

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

// Parse JSON and capture raw body
app.use(express.json({ verify: (req, res, buf) => {
  req.rawBody = buf.toString('utf8');
}}));

// Verify Slack signature
const verifySlackRequest = (req) => {
  const timestamp = req.headers['x-slack-request-timestamp'];
  const signature = req.headers['x-slack-signature'];

  if (!timestamp || !signature) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) return false;

  const baseString = `v0:${timestamp}:${req.rawBody}`;
  const hash = createHmac('sha256', SLACK_SIGNING_SECRET)
    .update(baseString)
    .digest('hex');

  return signature === `v0=${hash}`;
};

// Slack events endpoint
app.post('/slack/events', (req, res) => {
  console.log('📥 Request received');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);

  const { type, challenge, event } = req.body;

  // URL verification (no signature check)
  if (type === 'url_verification') {
    console.log('✓ URL verification - sending challenge:', challenge);
    return res.status(200).json({ challenge });
  }

  // Verify signature for other events
  if (!verifySlackRequest(req)) {
    console.log('❌ Invalid signature');
    return res.status(401).send('Unauthorized');
  }

  // Handle message events
  if (type === 'event_callback' && event?.type === 'app_mention') {
    handleMention(event);
  }

  res.json({ ok: true });
});

// Handle @jarvis mentions
async function handleMention(event) {
  try {
    const { channel, ts, text, user } = event;
    const userMessage = text.replace(/<@[A-Z0-9]+>/g, '').trim();

    if (!userMessage) return;

    console.log(`📨 Message from ${user}: ${userMessage}`);

    // Call Claude
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-opus-4-6',
        max_tokens: 1024,
        messages: [{ role: 'user', content: userMessage }],
      },
      {
        headers: {
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
        },
      }
    );

    const reply = response.data.content[0].text;

    // Post to Slack
    await axios.post(
      'https://slack.com/api/chat.postMessage',
      { channel, text: reply, thread_ts: ts },
      { headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` } }
    );

    console.log(`✓ Response posted`);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🤖 Jarvis bot running on port ${PORT}`);
});
