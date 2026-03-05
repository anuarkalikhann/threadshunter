import urllib.request
import json
import os
from dotenv import load_dotenv

def setup_bot():
    # Try to load from local env
    if os.path.exists("webapp/.env.local"):
        load_dotenv(dotenv_path="webapp/.env.local")
    
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        token = input("Enter your Telegram Bot Token: ").strip()
        
    url = input("Enter your Vercel URL (e.g. https://threadshunter.vercel.app): ").strip()
    if not url.startswith("http"):
        url = "https://" + url

    # Set Menu Button
    print(f"[*] Setting Menu Button for bot...")
    api_url = f"https://api.telegram.org/bot{token}/setChatMenuButton"
    payload = {
        "menu_button": {
            "type": "web_app",
            "text": "Threads Hunter",
            "web_app": {
                "url": url
            }
        }
    }
    
    req = urllib.request.Request(
        api_url, 
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.load(response)
            if res_data.get("ok"):
                print("[+] Success! Menu button set.")
                print(f"[!] You can now open your bot in Telegram and start hunting!")
            else:
                print(f"[!] Error: {res_data}")
    except Exception as e:
        print(f"[!] Error: {e}")

if __name__ == "__main__":
    setup_bot()
