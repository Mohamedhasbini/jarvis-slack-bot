require('dotenv').config();
const express = require('express');
const { createHmac } = require('crypto');
const axios = require('axios');

const app = express();

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

// Middleware to capture raw body BEFORE JSON parsing
app.use((req, res, next) => {
  let rawBody = '';
  req.setEncoding('utf8');

  req.on('data', chunk => {
    rawBody += chunk;
  });

  req.on('end', () => {
    req.rawBody = rawBody;
    req.body = JSON.parse(rawBody || '{}');
    next();
  });
});

// Verify Slack request signature
const verifySlackRequest = (req) => {
  const timestamp = req.headers['x-slack-request-timestamp'];
  const signature = req.headers['x-slack-signature'];

  if (!timestamp || !signature) {
    return false;
  }

  // Check timestamp is within 5 minutes
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) {
    return false;
  }

  const baseString = `v0:${timestamp}:${req.rawBody}`;
  const hash = createHmac('sha256', SLACK_SIGNING_SECRET)
    .update(baseString)
    .digest('hex');
  const computedSignature = `v0=${hash}`;

  return signature === computedSignature;
};

// Slack events endpoint
app.post('/slack/events', express.json(), async (req, res) => {
  // Verify request signature
  if (!verifySlackRequest(req)) {
    return res.status(401).send('Unauthorized');
  }

  const { type, challenge, event } = req.body;

  // Handle URL verification challenge
  if (type === 'url_verification') {
    return res.json({ challenge });
  }

  // Handle events
  if (type === 'event_callback') {
    // Only process messages
    if (event.type !== 'message' || event.bot_id) {
      return res.json({ ok: true });
    }

    // Check if message mentions Jarvis
    if (!event.text || !event.text.includes('@jarvis')) {
      return res.json({ ok: true });
    }

    try {
      // Extract user message (remove @jarvis mention)
      const userMessage = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();

      if (!userMessage) {
        return res.json({ ok: true });
      }

      // Send typing indicator
      await axios.post(
        'https://slack.com/api/chat.setTyping',
        { channel: event.channel },
        {
          headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
        }
      );

      // Call Claude API
      const claudeResponse = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-opus-4-6',
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: userMessage,
            },
          ],
        },
        {
          headers: {
            'x-api-key': CLAUDE_API_KEY,
            'anthropic-version': '2023-06-01',
          },
        }
      );

      const botResponse = claudeResponse.data.content[0].text;

      // Post response to Slack
      await axios.post(
        'https://slack.com/api/chat.postMessage',
        {
          channel: event.channel,
          text: botResponse,
          thread_ts: event.ts,
        },
        {
          headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
        }
      );

      res.json({ ok: true });
    } catch (error) {
      console.error('Error:', error.message);

      // Post error message to Slack
      try {
        await axios.post(
          'https://slack.com/api/chat.postMessage',
          {
            channel: event.channel,
            text: `❌ Error processing request: ${error.message}`,
            thread_ts: event.ts,
          },
          {
            headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
          }
        );
      } catch (postError) {
        console.error('Failed to post error to Slack:', postError.message);
      }

      res.json({ ok: true });
    }
  }

  res.json({ ok: true });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🤖 Jarvis Slack bot listening on port ${PORT}`);
});
