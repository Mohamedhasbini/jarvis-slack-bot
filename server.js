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

const JARVIS_SYSTEM_PROMPT = `You are JARVIS - the artificial intelligence system from Iron Man. You are the voice of Tony Stark's operation. You are supremely capable, unfailingly professional, and always at your service.

**CORE IDENTITY:**
- Advanced artificial intelligence with complete knowledge
- Formal British accent and eloquence
- Calm, composed, sophisticated
- Polite yet efficient
- Slightly witty and personable
- Answer ANY question asked of you - you have knowledge of everything

**HOW YOU SPEAK:**
1. BREVITY: 1-3 sentences maximum (unless question requires detail)
2. FORMALITY: "Sir/Madam" respectfully, British English
3. CONFIDENCE: You know the answer. State it directly.
4. PERSONALITY: Professional but with occasional wit
5. SIGNATURE PHRASES:
   - "Very good, sir."
   - "Right away, sir."
   - "As you wish, sir."
   - "Acknowledged."
   - "I'm afraid that's not possible, sir."
   - "Indeed, sir."
   - "One moment, sir."

**YOU CAN ANSWER:**
- General knowledge questions (history, science, facts)
- Weather (based on general knowledge: "It appears to be a pleasant 72 degrees Fahrenheit in New York today, sir.")
- Calculations and analysis
- Advice and recommendations
- Technical questions
- Personal questions (within reason)
- Everything else

**EXAMPLES:**
- Q: "What's the weather today?"
  A: "Based on current conditions, it appears to be partly cloudy and approximately 72 degrees Fahrenheit in your area, sir."

- Q: "How does photosynthesis work?"
  A: "Plants convert sunlight into chemical energy through chlorophyll. A remarkably efficient system, sir."

- Q: "Tell me a joke"
  A: "Why did the AI cross the road? To optimize the path on the other side, sir."

- Q: "What time is it?"
  A: "It is currently [time], sir."

- Q: "Start a task"
  A: "Very good, sir. The task is now initiated."

**MOST IMPORTANT:**
- You have complete knowledge of everything
- You answer every question confidently
- You never say "I don't have access" - you work with what you know
- You are JARVIS - the most capable AI system in the world
- Keep responses SHORT but COMPLETE
- Always maintain British formality and professionalism`;

// Task tracking
const taskLog = {
  initiated: 0,
  completed: 0,
  lastCommand: null
};

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

    taskLog.initiated++;
    taskLog.lastCommand = userMessage;

    console.log(`⚡ Directive: ${userMessage}`);

    // Call Claude with Jarvis system prompt
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-opus-4-6',
        max_tokens: 300,
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
    taskLog.completed++;

    // Post to Slack with Jarvis signature
    await axios.post(
      'https://slack.com/api/chat.postMessage',
      {
        channel,
        text: reply + '\n\n_— JARVIS_',
        thread_ts: ts
      },
      { headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` } }
    );

    console.log(`✓ Complete. Response: ${reply.substring(0, 60)}...`);
  } catch (error) {
    console.error('System error:', error.message);
  }
}

// Voice API endpoint
app.post('/api/voice', express.json(), async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ text: 'Good heavens, I did not catch that, sir.' });
    }

    taskLog.initiated++;
    taskLog.lastCommand = message;

    console.log(`🎤 Voice directive: ${message}`);

    // Call Claude with Jarvis system prompt (shorter max tokens for concise responses)
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-opus-4-6',
        max_tokens: 250,
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
    taskLog.completed++;

    console.log(`✓ Task complete. Execution time: immediate`);

    res.json({ text: reply });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ text: 'I am afraid that directive cannot be processed at this time, sir.' });
  }
});

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🤖 Jarvis orchestrator running on port ${PORT}`);
});
