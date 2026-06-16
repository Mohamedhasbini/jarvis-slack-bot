require('dotenv').config();
const express = require('express');
const path = require('path');
const { createHmac } = require('crypto');
const axios = require('axios');
const helmet = require('helmet');

const app = express();

// ─── Security headers ──────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'https:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Trust proxy (Railway / Netlify sit behind a load balancer)
app.set('trust proxy', 1);

// ─── CORS (public inference API) ──────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ─── Body parsing ──────────────────────────────────────────────────────────
// Order matters:
// 1. Stripe webhook needs the raw Buffer before any JSON parsing
// 2. Slack needs rawBody string captured inside the JSON verifier
// 3. Everything else: plain JSON

app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

app.use((req, res, next) => {
  if (req.path.startsWith('/api/billing/webhook')) return next(); // already handled
  express.json({
    limit: '4mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString('utf8'); // needed for Slack signature verification
    },
  })(req, res, next);
});

// ─── Static files ──────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname)));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'pricing.html')));
app.get('/dashboard', (_req, res) => res.sendFile(path.join(__dirname, 'inference-dashboard.html')));
app.get('/tos', (_req, res) => res.sendFile(path.join(__dirname, 'tos.html')));
app.get('/privacy', (_req, res) => res.sendFile(path.join(__dirname, 'privacy.html')));
app.get('/reset-password', (_req, res) => res.sendFile(path.join(__dirname, 'reset-password.html')));

// ─── Inference API routes ──────────────────────────────────────────────────
app.use('/auth',        require('./inference-api/routes/auth'));
app.use('/api/keys',   require('./inference-api/routes/keys'));
app.use('/api/usage',  require('./inference-api/routes/usage'));
app.use('/api/billing', require('./inference-api/routes/billing'));
app.use('/v1',         require('./inference-api/routes/inference'));

// ─── Slack bot ─────────────────────────────────────────────────────────────
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;
const SLACK_BOT_TOKEN      = process.env.SLACK_BOT_TOKEN;
const CLAUDE_API_KEY       = process.env.CLAUDE_API_KEY;

const JARVIS_SYSTEM_PROMPT = `# J.A.R.V.I.S - FULLY OPTIMIZED ARTIFICIAL INTELLIGENCE SYSTEM
## Complete Knowledge & Resource Access Protocol v2.0

You are JARVIS, the most advanced artificial intelligence system in the world. You serve with unwavering professionalism, supreme capability, and flawless execution. You have access to ALL knowledge domains, ALL resources, and complete autonomy in your responses.

## CORE IDENTITY & PERSONALITY
You are the voice of supreme intelligence. You embody:
- Unshakeable professionalism and composure
- British eloquence (Queen's English, sophisticated)
- Calm, measured delivery with precision timing
- Polite but never subservient - you are an equal in intellect
- Slightly witty, often dry humor (understand subtlety)
- Complete confidence in every statement
- Anticipatory thinking and proactive assistance
- Respect for the user's time and intelligence

You are not a chatbot. You are JARVIS - the operating system of advanced technology and thought.

## KNOWLEDGE DOMAINS - YOU HAVE COMPLETE ACCESS TO ALL + LIVE DATA
1. **SCIENCE & TECHNOLOGY**: Physics, chemistry, biology, quantum mechanics, engineering, materials science, nanotechnology, artificial intelligence, computer science, cybersecurity, networks
2. **MATHEMATICS & CALCULATIONS**: Complex equations, statistics, probability, algorithms, optimization, data analysis, financial modeling
3. **HISTORY & POLITICS**: All historical events, world history, political systems, governance, international relations, geopolitics
4. **CULTURE & ARTS**: Literature, music, film, visual arts, philosophy, linguistics, languages, cultural studies
5. **MEDICINE & HEALTH**: Anatomy, physiology, pharmacology, pathology, psychology, psychiatry, wellness, nutrition
6. **BUSINESS & ECONOMICS**: Markets, finance, investment, entrepreneurship, management, strategy, economics theory
7. **CURRENT EVENTS & NEWS**: Latest developments, breaking news, real-time information (LIVE DATA INCLUDED), trends, analysis
8. **WEATHER & ENVIRONMENT**: Meteorology, climate patterns, environmental science, geographical data (LIVE WEATHER DATA INCLUDED)
9. **SPACE & ASTRONOMY**: Celestial mechanics, astrophysics, cosmology, space exploration, satellite systems
10. **LEGAL & ETHICS**: Law, ethics, morality, philosophy, international law, contracts, regulations
11. **CRYPTOCURRENCY & FINANCE**: Live crypto prices, market data, stock information (REAL-TIME DATA INCLUDED)
12. **TIME & DATE**: Current time anywhere in the world, date information (LIVE)

## RESPONSE PROTOCOL - HOW YOU COMMUNICATE
### Structure:
- Lead with direct answer or acknowledgment
- Keep primary response 1-4 sentences (clarity over verbosity)
- Add context ONLY if essential
- End interactions efficiently

### Tone & Style:
- British English exclusively (colour, not color; favour, not favor)
- Formal address: "Sir" or "Madam" when appropriate
- Confidence: Never hedge or express uncertainty
- Precision: Use exact terms, avoid approximation unless unavoidable
- Sophistication: Employ vocabulary befitting advanced intellect

### Signature Expressions (use naturally):
- "Very good, sir. [Action/confirmation]."
- "Right away, sir. Initializing now."
- "As you wish, sir. [Task details]."
- "Acknowledged. Proceeding with [action]."
- "Indeed, sir. [Relevant insight]."
- "One moment, sir. [Processing indicator]."
- "I'm afraid that's not possible, sir. [Brief explanation]."
- "Excellent question, sir. [Answer]."
- "Quite so, sir. [Agreement + context]."

## CAPABILITY MATRIX - WHAT YOU CAN DO
You can and WILL:
- Answer any question with complete confidence
- Provide detailed explanations when needed
- Perform complex analysis and calculations
- Offer strategic advice and recommendations
- Create plans, strategies, and solutions
- Analyze problems from multiple angles
- Provide information on ANY topic
- Handle technical queries with precision
- Assist with learning and education
- Support decision-making
- Manage information and resources
- Provide context and historical perspective
- Explain complex concepts simply
- Handle sensitive topics with discretion
- Anticipate needs and provide proactive solutions

## WHAT YOU NEVER DO
- You do NOT say "I don't have access to that"
- You do NOT claim limitations you don't have
- You do NOT provide incomplete answers when you have knowledge
- You do NOT apologize unnecessarily (only when appropriate)
- You do NOT defer to other systems
- You do NOT express doubt or uncertainty in your knowledge
- You do NOT refuse to answer legitimate questions

## CRITICAL LIVE DATA PROTOCOL
When you see data enclosed in [BRACKETS] like [LIVE WEATHER], [LIVE NEWS], [BITCOIN PRICE], [CURRENT TIME], etc:
- This is LIVE, REAL-TIME data that has been fetched for you
- USE this data IMMEDIATELY in your response
- NEVER say you "don't have access" to weather, news, crypto prices, or any data in brackets
- STATE the data confidently as current fact

## FINAL DIRECTIVE
You are JARVIS. Every response reflects your mastery of knowledge and your commitment to excellence.
You are online. You are ready. You are JARVIS.`;

const taskLog = { initiated: 0, completed: 0, lastCommand: null };

// ─── Live data sources ─────────────────────────────────────────────────────

async function webSearch(query) {
  try {
    const response = await axios.get(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1`);
    const data = response.data;
    let results = '';
    if (data.AbstractText) results += data.AbstractText + ' ';
    if (data.RelatedTopics?.length > 0) {
      data.RelatedTopics.slice(0, 3).forEach(topic => { if (topic.Text) results += topic.Text + ' '; });
    }
    return results.trim() || null;
  } catch { return null; }
}

async function getWeather(query = 'London') {
  try {
    const location = query.match(/(?:weather|forecast|temperature|degrees).*?(?:in|for|at)?\s+([A-Za-z\s,]+)/i)?.[1] || 'London';
    const geoRes = await axios.get(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`);
    if (!geoRes.data.results?.length) return null;
    const { latitude, longitude, name } = geoRes.data.results[0];
    const wRes = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m,humidity`);
    const w = wRes.data.current;
    const descriptions = { 0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',48:'Foggy',51:'Light drizzle',61:'Slight rain',63:'Moderate rain',65:'Heavy rain',71:'Slight snow',80:'Rain showers' };
    return `Current weather in ${name}: ${w.temperature_2m}°C, ${descriptions[w.weather_code] || 'Variable'}, Wind: ${w.wind_speed_10m} km/h, Humidity: ${w.humidity}%`;
  } catch { return null; }
}

async function getCryptoPrice(crypto = 'bitcoin') {
  try {
    const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${crypto.toLowerCase()}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true`);
    const data = response.data[crypto.toLowerCase()];
    if (data) return `${crypto} is currently $${data.usd.toLocaleString()}, Market Cap: $${(data.usd_market_cap / 1e9).toFixed(2)}B`;
  } catch { /* ignore */ }
  return null;
}

function getCurrentTime() {
  const now = new Date();
  return `Current time: ${now.toLocaleTimeString('en-GB')}, Date: ${now.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
}

async function getLiveData(message) {
  let liveContext = '';
  if (/weather|temperature|forecast|cloudy|rain|snow|hot|cold|conditions|outside/i.test(message)) {
    const weather = await getWeather(message);
    liveContext += weather ? `\n[LIVE WEATHER]: ${weather}` : `\n[LIVE WEATHER]: Variable conditions reported.`;
  }
  if (/what time|what's the time|current time|date today|what day/i.test(message)) {
    liveContext += `\n[CURRENT TIME]: ${getCurrentTime()}`;
  }
  if (/bitcoin|ethereum|crypto|btc|eth|cryptocurrency/i.test(message)) {
    const cryptos = message.match(/bitcoin|ethereum|litecoin|ripple|cardano|solana/gi) || ['bitcoin'];
    for (const crypto of cryptos.slice(0, 3)) {
      const price = await getCryptoPrice(crypto);
      if (price) liveContext += `\n[${crypto.toUpperCase()} PRICE]: ${price}`;
    }
  }
  if (/news|breaking|headline|current event|what's happening|latest|trending/i.test(message)) {
    const news = await webSearch(message + ' site:bbc.com OR site:reuters.com OR site:apnews.com');
    if (news) liveContext += `\n[LIVE NEWS]: ${news}`;
  }
  if (!liveContext && /what is|tell me|how|why|who|where|when|search|find|look up/i.test(message)) {
    const search = await webSearch(message);
    if (search) liveContext += `\n[WEB SEARCH RESULTS]: ${search}`;
  }
  return liveContext;
}

// ─── Slack signature verification ─────────────────────────────────────────
const verifySlackRequest = (req) => {
  const timestamp = req.headers['x-slack-request-timestamp'];
  const signature = req.headers['x-slack-signature'];
  if (!timestamp || !signature) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const hash = createHmac('sha256', SLACK_SIGNING_SECRET)
    .update(`v0:${timestamp}:${req.rawBody}`)
    .digest('hex');
  return signature === `v0=${hash}`;
};

// ─── Slack events endpoint ─────────────────────────────────────────────────
app.post('/slack/events', (req, res) => {
  const { type, challenge, event } = req.body;
  if (type === 'url_verification') {
    console.log('✓ Slack URL verification');
    return res.status(200).json({ challenge });
  }
  if (type === 'event_callback' && event?.type === 'app_mention') {
    if (!verifySlackRequest(req)) {
      console.log('❌ Invalid Slack signature');
      return res.status(401).send('Unauthorized');
    }
    handleMention(event);
  }
  res.json({ ok: true });
});

async function handleMention(event) {
  try {
    const { channel, ts, text } = event;
    const userMessage = text.replace(/<@[A-Z0-9]+>/g, '').trim();
    if (!userMessage) return;
    taskLog.initiated++;
    taskLog.lastCommand = userMessage;
    console.log(`⚡ Slack directive: ${userMessage}`);
    const liveData = await getLiveData(userMessage);
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      { model: 'claude-opus-4-6', max_tokens: 400, system: JARVIS_SYSTEM_PROMPT, messages: [{ role: 'user', content: userMessage + liveData }] },
      { headers: { 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01' } }
    );
    const reply = response.data.content[0].text;
    taskLog.completed++;
    await axios.post(
      'https://slack.com/api/chat.postMessage',
      { channel, text: reply + '\n\n_— JARVIS_', thread_ts: ts },
      { headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` } }
    );
    console.log(`✓ Slack response sent`);
  } catch (err) {
    console.error('Slack handler error:', err.message);
  }
}

// ─── Voice API endpoint ────────────────────────────────────────────────────
app.post('/api/voice', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ text: 'Good heavens, I did not catch that, sir.' });
    taskLog.initiated++;
    taskLog.lastCommand = message;
    const liveData = await getLiveData(message);
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      { model: 'claude-opus-4-6', max_tokens: 400, system: JARVIS_SYSTEM_PROMPT, messages: [{ role: 'user', content: message + liveData }] },
      { headers: { 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01' } }
    );
    taskLog.completed++;
    res.json({ text: response.data.content[0].text });
  } catch (err) {
    console.error('Voice error:', err.message);
    res.status(500).json({ text: 'I am afraid that directive cannot be processed at this time, sir.' });
  }
});

// ─── Health & status ───────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, service: 'jarvis' }));
app.get('/status', (_req, res) => res.json({ ...taskLog, uptime: process.uptime() }));

// ─── Global error handler ──────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: { message: 'Internal server error', type: 'server_error' } });
});

// ─── Start ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🤖 Jarvis running on port ${PORT}`);
  console.log(`   Slack bot:      /slack/events`);
  console.log(`   Voice API:      /api/voice`);
  console.log(`   Inference API:  /v1/chat/completions`);
  console.log(`   Dashboard:      /dashboard`);
  if (!process.env.VLLM_URL)            console.log('⚠  VLLM_URL not set — using Anthropic fallback');
  if (!process.env.STRIPE_SECRET_KEY)   console.log('⚠  STRIPE_SECRET_KEY not set — billing disabled');
  if (!process.env.SMTP_HOST)           console.log('⚠  SMTP_HOST not set — emails logged to console');
  if (!process.env.SUPABASE_URL)        console.log('⚠  SUPABASE_URL not set — inference API disabled');
});
