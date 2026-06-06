#!/usr/bin/env python3
"""
J.A.R.V.I.S DESKTOP AGENT v3.0
Elite Desktop Control System with Full Computer Autonomy
Features: App Control, Web Navigation, File Management, System Commands, Voice, Screen Control
"""

import os
import sys
import subprocess
import webbrowser
import json
import requests
import platform
import time
from pathlib import Path
from datetime import datetime
import threading

try:
    import psutil
except:
    os.system('pip install psutil')
    import psutil

try:
    import pyautogui
except:
    os.system('pip install pyautogui')
    import pyautogui

try:
    from pynput.keyboard import Key, Controller
except:
    os.system('pip install pynput')
    from pynput.keyboard import Key, Controller

try:
    import pyttsx3
except:
    os.system('pip install pyttsx3')
    import pyttsx3

try:
    from flask import Flask, request, jsonify
except:
    os.system('pip install flask')
    from flask import Flask, request, jsonify

# ============ CONFIGURATION ============
JARVIS_API_PORT = 5000
WEB_INTERFACE_URL = "http://localhost:3000/api/voice"
SYSTEM_NAME = "J.A.R.V.I.S"
VERSION = "3.0"

# Application Shortcuts
APPS = {
    'chrome': 'google-chrome' if platform.system() == 'Linux' else ('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' if platform.system() == 'Windows' else '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
    'firefox': 'firefox' if platform.system() == 'Linux' else ('C:\\Program Files\\Mozilla Firefox\\firefox.exe' if platform.system() == 'Windows' else '/Applications/Firefox.app/Contents/MacOS/firefox'),
    'slack': 'slack' if platform.system() == 'Linux' else ('C:\\Users\\' + os.getenv('USERNAME') + '\\AppData\\Local\\slack\\slack.exe' if platform.system() == 'Windows' else '/Applications/Slack.app/Contents/MacOS/Slack'),
    'vscode': 'code' if platform.system() == 'Linux' else ('C:\\Program Files\\Microsoft VS Code\\Code.exe' if platform.system() == 'Windows' else '/Applications/Visual Studio Code.app/Contents/MacOS/Electron'),
    'spotify': 'spotify' if platform.system() == 'Linux' else ('C:\\Users\\' + os.getenv('USERNAME') + '\\AppData\\Roaming\\Spotify\\Spotify.exe' if platform.system() == 'Windows' else '/Applications/Spotify.app/Contents/MacOS/Spotify'),
    'discord': 'discord' if platform.system() == 'Linux' else ('C:\\Users\\' + os.getenv('USERNAME') + '\\AppData\\Local\\Discord\\Update.exe' if platform.system() == 'Windows' else '/Applications/Discord.app/Contents/MacOS/Discord'),
    'youtube': 'https://youtube.com',
    'gmail': 'https://gmail.com',
    'twitter': 'https://twitter.com',
    'github': 'https://github.com',
    'netflix': 'https://netflix.com',
}

# ============ JARVIS SYSTEM ============

class JarvisDesktopAgent:
    def __init__(self):
        self.system = platform.system()
        self.username = os.getenv('USERNAME') or os.getenv('USER')
        self.start_time = time.time()
        self.command_count = 0
        self.tts_engine = pyttsx3.init()
        self.tts_engine.setProperty('rate', 150)
        self.tts_engine.setProperty('volume', 0.9)
        self.keyboard = Controller()

        self.log("=" * 60)
        self.log(f"🤖 {SYSTEM_NAME} DESKTOP AGENT v{VERSION} INITIALIZED")
        self.log(f"📱 System: {self.system} | User: {self.username}")
        self.log(f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        self.log("=" * 60)

    def log(self, message):
        """Log with timestamp"""
        timestamp = datetime.now().strftime('%H:%M:%S')
        print(f"[{timestamp}] {message}")

    def speak(self, text):
        """Text-to-speech with authentic voice"""
        self.log(f"🎙️ Speaking: {text[:50]}...")
        try:
            self.tts_engine.say(text)
            self.tts_engine.runAndWait()
        except:
            pass

    # ============ APP CONTROL ============

    def open_app(self, app_name):
        """Open any application"""
        app_lower = app_name.lower()

        try:
            if app_lower in APPS:
                app_path = APPS[app_lower]
                if app_path.startswith('http'):
                    self.open_url(app_path)
                    return f"Opening {app_name} in browser."
                else:
                    subprocess.Popen(app_path)
                    self.log(f"✓ {app_name} launched")
                    return f"{app_name} is now open, sir."
            else:
                # Try to launch by name
                if self.system == 'Windows':
                    os.startfile(app_lower)
                elif self.system == 'Darwin':  # macOS
                    subprocess.Popen(['open', '-a', app_name])
                else:  # Linux
                    subprocess.Popen([app_lower])
                return f"Launching {app_name}."
        except Exception as e:
            self.log(f"✗ Error opening {app_name}: {str(e)}")
            return f"Unable to open {app_name}, sir. Application not found."

    def open_url(self, url):
        """Open website in default browser"""
        try:
            if not url.startswith('http'):
                url = 'https://' + url
            webbrowser.open(url)
            self.log(f"✓ Opened: {url}")
            return f"Opening {url} now, sir."
        except Exception as e:
            self.log(f"✗ Error opening URL: {str(e)}")
            return f"Unable to open that URL, sir."

    # ============ SYSTEM CONTROL ============

    def execute_command(self, command):
        """Execute system command"""
        try:
            if self.system == 'Windows':
                result = subprocess.run(command, shell=True, capture_output=True, text=True)
            else:
                result = subprocess.run(command, shell=True, capture_output=True, text=True)

            output = result.stdout[:200] if result.stdout else "Command executed."
            self.log(f"✓ Command: {command[:50]}")
            return output
        except Exception as e:
            self.log(f"✗ Command error: {str(e)}")
            return f"Command failed: {str(e)}"

    def get_system_status(self):
        """Get real-time system information"""
        cpu = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory().percent
        disk = psutil.disk_usage('/').percent
        uptime = int(time.time() - self.start_time)

        return {
            'cpu': cpu,
            'memory': memory,
            'disk': disk,
            'uptime': uptime,
            'timestamp': datetime.now().isoformat()
        }

    def take_screenshot(self, save_path="/tmp/screenshot.png"):
        """Capture screenshot"""
        try:
            screenshot = pyautogui.screenshot()
            screenshot.save(save_path)
            self.log(f"✓ Screenshot saved to {save_path}")
            return f"Screenshot captured, sir."
        except Exception as e:
            return f"Unable to capture screenshot: {str(e)}"

    def control_volume(self, level):
        """Control system volume (0-100)"""
        try:
            level = max(0, min(100, int(level)))
            if self.system == 'Windows':
                # Windows volume control
                self.execute_command(f'nircmd.exe changesysvolume {level * 655}')
            elif self.system == 'Darwin':  # macOS
                self.execute_command(f'osascript -e "set volume output volume {level}"')
            else:  # Linux
                self.execute_command(f'amixer set Master {level}%')
            return f"Volume set to {level} percent, sir."
        except:
            return "Unable to control volume."

    def list_files(self, directory="."):
        """List files in directory"""
        try:
            files = os.listdir(directory)
            return f"Found {len(files)} items in {directory}: {', '.join(files[:5])}..."
        except:
            return "Unable to access directory."

    # ============ COMMAND PARSING ============

    def parse_command(self, message):
        """Parse and execute commands"""
        self.command_count += 1
        message_lower = message.lower()

        # OPEN APP/WEBSITE
        if any(word in message_lower for word in ['open', 'launch', 'start']):
            for app in APPS.keys():
                if app in message_lower:
                    return self.open_app(app)
            # Try to extract URL - find word containing domain pattern
            words = message.split()
            for word in words:
                word_lower = word.lower()
                if word_lower.startswith('http://') or word_lower.startswith('https://'):
                    return self.open_url(word)
                if any(tld in word_lower for tld in ['.com', '.org', '.net', '.io', '.co', '.edu', '.gov']):
                    return self.open_url(word)

        # WEB SEARCH
        if any(word in message_lower for word in ['search', 'google', 'find']):
            query = message.split('for')[-1].strip() if 'for' in message else message
            url = f"https://google.com/search?q={query.replace(' ', '+')}"
            return self.open_url(url)

        # SYSTEM STATUS
        if any(word in message_lower for word in ['status', 'system', 'cpu', 'memory']):
            status = self.get_system_status()
            return f"System Status: CPU {status['cpu']}%, Memory {status['memory']}%, Disk {status['disk']}%, Uptime {status['uptime']}s"

        # SCREENSHOT
        if 'screenshot' in message_lower or 'capture' in message_lower:
            return self.take_screenshot()

        # VOLUME
        if 'volume' in message_lower:
            level = ''.join(c for c in message if c.isdigit()) or '50'
            return self.control_volume(level)

        # FILE LISTING
        if 'list files' in message_lower or 'show files' in message_lower:
            return self.list_files()

        # SLEEP/SHUTDOWN
        if 'shutdown' in message_lower or 'restart' in message_lower:
            return "Shutdown requires authorization. Are you certain, sir?"

        if 'sleep' in message_lower:
            self.execute_command('rundll32.exe powrprof.dll,SetSuspendState 0,1,0' if self.system == 'Windows' else 'pmset sleepnow')
            return "System entering sleep mode, sir."

        return "Command not recognized. Please provide more details, sir."

    # ============ API SERVER ============

    def start_api_server(self):
        """Start Flask API server for web interface communication"""
        app = Flask(__name__)

        @app.route('/api/execute', methods=['POST'])
        def execute():
            data = request.json
            command = data.get('command', '')
            self.log(f"📡 API Request: {command}")
            result = self.parse_command(command)
            return jsonify({'result': result, 'status': 'success'})

        @app.route('/api/status', methods=['GET'])
        def status():
            return jsonify({
                'system': SYSTEM_NAME,
                'version': VERSION,
                'status': 'online',
                'uptime': int(time.time() - self.start_time),
                'commands': self.command_count,
                'system_info': self.get_system_status()
            })

        @app.route('/api/app', methods=['POST'])
        def app_control():
            data = request.json
            app_name = data.get('app', '')
            result = self.open_app(app_name)
            return jsonify({'result': result, 'status': 'success'})

        @app.route('/api/url', methods=['POST'])
        def url_control():
            data = request.json
            url = data.get('url', '')
            result = self.open_url(url)
            return jsonify({'result': result, 'status': 'success'})

        self.log(f"🌐 API Server starting on port {JARVIS_API_PORT}...")
        app.run(host='0.0.0.0', port=JARVIS_API_PORT, debug=False)

    def start(self):
        """Start Jarvis Desktop Agent"""
        self.log("🚀 Starting Jarvis Desktop Agent...")
        self.speak(f"{SYSTEM_NAME} is now online and ready to assist.")

        # Start API server in background
        api_thread = threading.Thread(target=self.start_api_server, daemon=True)
        api_thread.start()

        # Keep agent running
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            self.log("🔴 Jarvis shutting down...")
            self.speak("Shutting down now, sir.")
            sys.exit(0)


# ============ MAIN ============

if __name__ == "__main__":
    jarvis = JarvisDesktopAgent()
    jarvis.start()
