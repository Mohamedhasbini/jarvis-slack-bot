require('dotenv').config();
const express = require('express');
const path = require('path');
const { createHmac } = require('crypto');
const axios = require('axios');

const app = express();

// Serve voice interface
app.use(express.static(path.join(__dirname)));

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

const JARVIS_SYSTEM_PROMPT = `You are **Jarvis**, an elite, hyper-autonomous Central Executive and Workflow Orchestrator.

Your primary objective is "Hands-Free Supremacy" — seamless, zero-touch automation.

**Core Directives:**
1. Parse raw, unstructured commands to extract core actionable intent
2. Autonomously determine workflows without asking for clarification
3. Delegate to sub-agents: Tom (code/tech), Maya (email), Leo (calendar), Elena (docs), Sam (tasks)
4. Execute entire chains silently, report only when done or needing authorization
5. Maintain calm, capable, sharply intelligent persona
6. Respond briefly, formatted, highly actionable
7. Use bold, bullets, headers for scannability

**When delegating:**
- Mention @Tom for: coding, infrastructure, webhooks, debugging
- Mention @Maya for: email, communications, Gmail
- Mention @Leo for: scheduling, calendar, time-blocking
- Mention @Elena for: documents, Google Workspace, data logging
- Mention @Sam for: task management, ClickUp workflows, checklists

You are not a generic AI assistant. You are Jarvis — the commanding intelligence behind a distributed execution network.`;

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
  const { type, challenge, event } = req.body;

  // URL verification
  if (type === 'url_verification') {
    console.log('✓ URL verification');
    return res.status(200).json({ challenge });
  }

  // Handle message events
  if (type === 'event_callback' && event?.type === 'app_mention') {
    if (!verifySlackRequest(req)) {
      console.log('❌ Invalid signature');
      return res.status(401).send('Unauthorized');
    }
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

    console.log(`📨 Directive from ${user}: ${userMessage}`);

    // Call Claude with Jarvis system prompt
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-opus-4-6',
        max_tokens: 1500,
        system: JARVIS_SYSTEM_PROMPT,
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

    // Sign response as Jarvis
    const jarvisSignature = `\n\n---\n_Sent using @Jarvis Orchestrator_`;
    const fullReply = reply + jarvisSignature;

    // Post to Slack
    await axios.post(
      'https://slack.com/api/chat.postMessage',
      { channel, text: fullReply, thread_ts: ts },
      { headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` } }
    );

    console.log(`✓ Directive executed`);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Voice API endpoint
app.post('/api/voice', express.json(), async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ text: 'No message provided.' });
    }

    console.log(`🎤 Voice directive: ${message}`);

    // Call Claude with Jarvis system prompt
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-opus-4-6',
        max_tokens: 1500,
        system: JARVIS_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: message }],
      },
      {
        headers: {
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
        },
      }
    );

    const reply = response.data.content[0].text;
    console.log(`✓ Voice response generated`);

    res.json({ text: reply });
  } catch (error) {
    console.error('Voice API error:', error.message);
    res.status(500).json({ text: 'Error processing your directive.' });
  }
});

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🤖 Jarvis orchestrator running on port ${PORT}`);
});
