# J.A.R.V.I.S DESKTOP AGENT v3.0
## Complete Computer Control System

### What This Does
Jarvis can now:
- ✅ **Open any app** (Chrome, Slack, Discord, Spotify, VSCode, etc.)
- ✅ **Open websites** (YouTube, Gmail, Twitter, GitHub, Netflix, etc.)
- ✅ **Execute system commands** (shell/terminal commands)
- ✅ **Control volume** (set to any level)
- ✅ **Take screenshots** (capture screen)
- ✅ **System status** (CPU, RAM, Disk, Uptime)
- ✅ **File management** (list files, navigate)
- ✅ **Sleep/Wake** system
- ✅ **Full computer autonomy** (anything voice/command controlled)

---

## INSTALLATION (5 minutes)

### Step 1: Install Python (if not installed)
**Windows:**
```bash
choco install python
```

**macOS:**
```bash
brew install python3
```

**Linux:**
```bash
sudo apt-get install python3 python3-pip
```

### Step 2: Navigate to Project Directory
```bash
cd /Users/balaska/Claude/Projects/Jarvis/jarvis-slack-bot
```

### Step 3: Install Dependencies
```bash
pip install flask psutil pyautogui pynput pyttsx3 requests
```

### Step 4: Run Jarvis Desktop Agent
```bash
python jarvis-desktop-agent.py
```

You should see:
```
[HH:MM:SS] ============================================================
[HH:MM:SS] 🤖 J.A.R.V.I.S DESKTOP AGENT v3.0 INITIALIZED
[HH:MM:SS] 📱 System: Darwin | User: YourUsername
[HH:MM:SS] ⏰ 2026-06-05 15:30:45
[HH:MM:SS] ============================================================
[HH:MM:SS] 🌐 API Server starting on port 5000...
[HH:MM:SS] 🚀 Starting Jarvis Desktop Agent...
```

---

## USAGE

### Through Web Interface
Open: **https://jarvis-slack-bot-production.up.railway.app/cyber-dashboard.html**

Say or type commands:
- "Open Chrome"
- "Open Slack"
- "Go to YouTube"
- "Search for Python tutorials"
- "Show me system status"
- "Take a screenshot"
- "Set volume to 75"
- "List files in downloads"

### Through Slack
In your Slack, mention `@Jarvis`:
- "@Jarvis open Discord"
- "@Jarvis go to Gmail"
- "@Jarvis show system status"

### Direct API Calls
```bash
# Open an app
curl -X POST http://localhost:5000/api/app \
  -H "Content-Type: application/json" \
  -d '{"app": "chrome"}'

# Open a URL
curl -X POST http://localhost:5000/api/url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://youtube.com"}'

# Execute command
curl -X POST http://localhost:5000/api/execute \
  -H "Content-Type: application/json" \
  -d '{"command": "open chrome"}'

# Get system status
curl http://localhost:5000/api/status
```

---

## AVAILABLE COMMANDS

### Applications
```
Open Chrome, Firefox, Slack, VSCode, Spotify, Discord
```

### Websites
```
YouTube, Gmail, Twitter, GitHub, Netflix
```

### System Control
```
"Show system status"
"Take a screenshot"
"Set volume to 50"
"List files"
"Sleep"
```

### Search
```
"Search for [anything]"
"Google [query]"
```

---

## RUNNING IN BACKGROUND (macOS/Linux)

### Option 1: Terminal (Keep window open)
```bash
python jarvis-desktop-agent.py
```

### Option 2: Background Process
```bash
nohup python jarvis-desktop-agent.py &
```

### Option 3: LaunchAgent (Auto-start)
Create file: `~/Library/LaunchAgents/com.jarvis.agent.plist`
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.jarvis.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>/Users/balaska/Claude/Projects/Jarvis/jarvis-slack-bot/jarvis-desktop-agent.py</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
```

Then:
```bash
launchctl load ~/Library/LaunchAgents/com.jarvis.agent.plist
```

### Option 4: Windows (Task Scheduler)
1. Open Task Scheduler
2. Create Basic Task
3. Trigger: At log on
4. Action: Start program
5. Program: `python.exe`
6. Arguments: `C:\path\to\jarvis-desktop-agent.py`

---

## CONFIGURATION

Edit `jarvis-desktop-agent.py` to add more apps:

```python
APPS = {
    'myapp': '/path/to/application',
    'mywebsite': 'https://mywebsite.com',
}
```

---

## TROUBLESHOOTING

### "Command not found: python"
Use `python3` instead of `python`

### "Flask not found"
Run: `pip install flask`

### "pyautogui not found"
Run: `pip install pyautogui`

### Port 5000 already in use
Change `JARVIS_API_PORT = 5001` in the script

### App not opening
Check app is in `APPS` dictionary or use full path

### Windows: nircmd not found
Download nircmd and add to PATH, or use alternative volume control

---

## NEXT STEPS

1. ✅ Install and run the desktop agent
2. ✅ Open the web interface
3. ✅ Say "Open Chrome" or "Show system status"
4. ✅ Watch Jarvis execute commands in real-time

**Jarvis now has FULL COMPUTER CONTROL!** 🚀

---

## SUPPORT

For issues:
- Check logs in terminal
- Verify all dependencies installed
- Confirm Python 3.7+
- Test with simple command: "Show system status"

**Jarvis is now your complete desktop automation system!**
