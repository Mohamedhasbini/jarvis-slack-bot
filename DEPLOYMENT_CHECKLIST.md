# Jarvis Deployment Checklist

**Follow this checklist in order to deploy Jarvis to production.**

## Phase 1: Slack App Setup (5 minutes)

- [ ] Go to https://api.slack.com/apps
- [ ] Click "Create New App" → "From scratch"
- [ ] Name: `Jarvis`, select your workspace
- [ ] Copy **Signing Secret** from "Basic Information"
- [ ] Go to "OAuth & Permissions"
- [ ] Add these scopes:
  - [ ] `chat:write`
  - [ ] `chat:setTyping`
  - [ ] `app_mentions:read`
  - [ ] `channels:read`
  - [ ] `groups:read`
  - [ ] `im:read`
  - [ ] `mpim:read`
- [ ] Install to Workspace and copy **Bot Token** (xoxb-...)

## Phase 2: Get API Keys (2 minutes)

- [ ] Get **Claude API Key** from https://console.anthropic.com
- [ ] Verify you have:
  - [ ] SLACK_SIGNING_SECRET
  - [ ] SLACK_BOT_TOKEN
  - [ ] CLAUDE_API_KEY

## Phase 3: Railway Deployment (5 minutes)

- [ ] Go to https://railway.app (sign up if needed)
- [ ] Create new project
- [ ] Connect GitHub repo (or paste code)
- [ ] Wait for auto-detection of Node.js
- [ ] Go to Variables and add:
  - [ ] `SLACK_SIGNING_SECRET` = (your value)
  - [ ] `SLACK_BOT_TOKEN` = (your value)
  - [ ] `CLAUDE_API_KEY` = (your value)
  - [ ] `NODE_ENV` = `production`
- [ ] Wait for deployment to complete
- [ ] Copy your **Railway URL** (ends with `.up.railway.app`)

## Phase 4: Slack Event Subscriptions (3 minutes)

- [ ] In your Slack app settings, go to "Event Subscriptions"
- [ ] Toggle "Enable Events" to ON
- [ ] Request URL: `https://[YOUR-RAILWAY-URL]/slack/events`
- [ ] Wait for "Verified" checkmark (green ✓)
- [ ] Under "Subscribe to bot events", add:
  - [ ] `app_mention`
  - [ ] `message.channels`
- [ ] Click "Save Bot Token Scopes"
- [ ] Go to "Basic Information" → "Reinstall to Workspace"

## Phase 5: Test in Slack (2 minutes)

- [ ] Go to any Slack channel
- [ ] Type: `@jarvis Hello, are you working?`
- [ ] Wait 3-5 seconds for response
- [ ] You should see Jarvis respond in the thread
- [ ] Test a few different questions

## Phase 6: Monitor & Verify (1 minute)

- [ ] Check Railway logs (Deployments → Active → Logs)
- [ ] Verify no errors in logs
- [ ] Try mentioning `@jarvis` again to confirm working

---

## Troubleshooting Quick Reference

| Problem | Solution |
|---------|----------|
| "Request URL didn't validate" | Check Railway URL is correct + `/slack/events` suffix |
| Jarvis doesn't respond | Verify bot is in channel: `/invite @Jarvis` |
| "Invalid signature" | Check SLACK_SIGNING_SECRET is copied exactly |
| Empty responses | Check CLAUDE_API_KEY is valid |
| Railway shows errors | Check all env variables are set, no typos |

---

## Time Estimate
**Total: ~15 minutes from start to first working response**

---

## You're Done! 🎉

Once all checkboxes are complete, Jarvis is running live in your Slack.

**Next (Optional):**
- Add custom instructions to Claude calls
- Set up logging to Notion
- Create response templates
- Add admin commands

---

**Questions?** See `SETUP.md` for detailed instructions.
