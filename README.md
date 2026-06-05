# Jarvis - Autonomous Slack Bot

A fully autonomous AI bot that responds to @jarvis mentions in Slack using Claude API.

## Quick Start

1. **Clone/Setup**
   ```bash
   npm install
   ```

2. **Configure** (see `SETUP.md` for detailed steps)
   - Create Slack app at https://api.slack.com/apps
   - Get Signing Secret and Bot Token
   - Set up Railway deployment
   - Configure Event Subscriptions

3. **Deploy**
   - Push code to GitHub
   - Connect to Railway
   - Set environment variables
   - Done!

4. **Use**
   - Type `@jarvis [your question]` in any Slack channel
   - Jarvis responds in the thread with Claude's answer

## Complete Setup Guide
See **`SETUP.md`** for step-by-step instructions including:
- Creating the Slack app
- Deploying to Railway
- Configuring Event Subscriptions
- Testing and troubleshooting

## Environment Variables
```
SLACK_SIGNING_SECRET=your_signing_secret
SLACK_BOT_TOKEN=xoxb-your-bot-token
CLAUDE_API_KEY=sk-ant-your-api-key
PORT=3000
NODE_ENV=production
```

## Architecture
- **Framework**: Express.js
- **Hosting**: Railway
- **Events**: Slack Event API
- **AI**: Claude API (Anthropic)

## Features
✅ Real-time response to @jarvis mentions
✅ Slack signature verification (security)
✅ Threading (responses appear in conversation threads)
✅ Error handling with user feedback
✅ Health check endpoint
✅ Typing indicator while processing

## Costs
- **Slack**: Free
- **Claude API**: ~$0.01-0.10 per message
- **Railway**: Free tier (500 CPU-hours/month)

**Total**: Essentially free for normal use!

## Status
🚀 Ready to deploy and use
