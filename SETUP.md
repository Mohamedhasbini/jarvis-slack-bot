# Jarvis Slack Bot - Complete Setup Guide

## Overview
This is a fully autonomous Slack bot that responds to @jarvis mentions using Claude API. Built with Node.js and deployed on Railway.

## Prerequisites
- Slack workspace admin access
- Claude API key
- Railway account (free tier works)
- Git installed

---

## Step 1: Create Slack App

### 1.1 Go to Slack API
- Navigate to https://api.slack.com/apps
- Click **"Create New App"**
- Choose **"From scratch"**
- App Name: `Jarvis`
- Workspace: Select your workspace
- Click **"Create App"**

### 1.2 Get Signing Secret
- In the app settings, go to **"Basic Information"**
- Scroll down to **"App Credentials"**
- Copy the **"Signing Secret"** (you'll need this later)

### 1.3 Create Bot User Token
- Go to **"OAuth & Permissions"** in the left sidebar
- Under **"Scopes"**, add these bot token scopes:
  - `chat:write`
  - `chat:setTyping`
  - `app_mentions:read`
  - `channels:read`
  - `groups:read`
  - `im:read`
  - `mpim:read`
- Click **"Install to Workspace"**
- Approve the permissions
- Copy the **"Bot User OAuth Token"** (starts with `xoxb-`)

---

## Step 2: Deploy to Railway

### 2.1 Prepare Repository
```bash
# Clone or create your project
git clone https://github.com/yourusername/jarvis-slack-bot.git
cd jarvis-slack-bot

# Initialize git if starting fresh
git init
git add .
git commit -m "Initial commit"
```

### 2.2 Deploy to Railway
- Go to https://railway.app
- Sign in / Create account
- Click **"New Project"**
- Select **"Deploy from GitHub"** (or paste repo URL)
- Select your repository
- Railway will auto-detect Node.js configuration

### 2.3 Set Environment Variables in Railway
- In your Railway project, go to **"Variables"**
- Add these variables:
  - `SLACK_SIGNING_SECRET` = (from Step 1.2)
  - `SLACK_BOT_TOKEN` = (from Step 1.3)
  - `CLAUDE_API_KEY` = (your Anthropic API key)
  - `NODE_ENV` = `production`
  - `PORT` = `3000`

### 2.4 Get Deployment URL
- In Railway, go to **"Deployments"**
- Copy your app's public URL (looks like `https://jarvis-slack-bot-production.up.railway.app`)

---

## Step 3: Configure Slack Event Subscriptions

### 3.1 Enable Event Subscriptions
- In your Slack app settings, go to **"Event Subscriptions"**
- Toggle **"Enable Events"** to ON
- In **"Request URL"**, enter: `https://your-railway-url.up.railway.app/slack/events`
  - Replace with your actual Railway URL from Step 2.4
- Wait for Slack to verify the endpoint (should see a green checkmark)

### 3.2 Subscribe to Bot Events
- Under **"Subscribe to bot events"**, add:
  - `app_mention` → Listens for @jarvis mentions
  - `message.channels` → Listens for messages in channels
- Click **"Save Bot Token Scopes"**

### 3.3 Reinstall App
- Go to **"Basic Information"**
- Click **"Reinstall to Workspace"**
- Approve permissions again

---

## Step 4: Test Jarvis

### 4.1 Test in Slack
- Go to any channel in your Slack workspace
- Type: `@jarvis Hello, are you working?`
- Wait a few seconds
- Jarvis should respond in the thread with a Claude-generated response

### 4.2 Monitor Logs
- In Railway, go to **"Deployments"**
- Click your active deployment
- Open the **"Logs"** tab to see real-time requests

### 4.3 Troubleshoot
If Jarvis doesn't respond:
1. Check Railway logs for errors
2. Verify environment variables are set correctly
3. Confirm Event Subscriptions URL is correct
4. Make sure bot is invited to the channel: `/invite @Jarvis`

---

## Step 5: Local Development (Optional)

### 5.1 Install Dependencies
```bash
npm install
```

### 5.2 Create Local .env File
```bash
cp .env.example .env
# Edit .env with your actual credentials
```

### 5.3 Run Locally
```bash
npm run dev
# Server runs on http://localhost:3000
```

### 5.4 Test Locally
- Use ngrok to expose localhost: `ngrok http 3000`
- Copy the ngrok URL and use it as your Request URL in Slack Event Subscriptions
- Test in Slack

---

## File Structure
```
jarvis-slack-bot/
├── server.js              # Main Express app
├── package.json           # Dependencies
├── railway.json          # Railway deployment config
├── .env.example          # Environment template
└── SETUP.md             # This file
```

---

## What Happens When You Mention Jarvis

1. **User** types `@jarvis [question]` in Slack
2. **Slack** sends event to your Railway webhook
3. **Server** verifies Slack signature (security)
4. **Server** extracts message text
5. **Server** calls Claude API with the message
6. **Claude** generates response
7. **Server** posts response back to Slack in thread
8. **User** sees Jarvis's response

---

## API Limits & Costs

- **Slack**: Free tier allows unlimited events
- **Claude API**: Pay-per-token (very cheap, typically $0.01-0.10 per message)
- **Railway**: Free tier includes 500 CPU-hours/month (plenty for casual use)

---

## Troubleshooting

### "Request URL didn't validate"
- Verify Railway app is running
- Check the URL is correct and includes `/slack/events`
- Wait 10 seconds after Railway deploys before testing

### Jarvis doesn't respond
- Check bot is invited to channel: `/invite @Jarvis`
- Verify message contains `@jarvis` mention
- Check Railway logs for errors
- Verify API keys are correct

### "Invalid signature" errors
- Make sure SLACK_SIGNING_SECRET matches exactly
- Check for typos in environment variables

---

## Next Steps

- Add more Slack events (file uploads, reactions, etc.)
- Add memory/context to responses
- Set up Slack moderation features
- Add logging to Notion or external database
- Scale to multiple Railway replicas for high traffic

---

## Support
If issues persist, check:
- Railway logs: https://railway.app (Deployments → Logs)
- Slack API docs: https://api.slack.com
- Claude API docs: https://docs.anthropic.com

**Jarvis is now ready to work autonomously in your Slack! 🚀**
