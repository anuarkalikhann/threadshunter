# 🚀 How to Deploy Threads Hunter Mini App

Follow these steps to get your Telegram Mini App up and running on Vercel.

## 1. Deploy to Vercel

1.  **Initialize Git** (if not already):
    ```bash
    git init
    git add .
    git commit -m "Initialize project"
    ```
2.  **Push to GitHub/GitLab/Bitbucket**.
3.  **Import to Vercel**:
    *   Go to [vercel.com](https://vercel.com).
    *   Click "Add New" -> "Project".
    *   Import your repository.
    *   **Root Directory**: Select `webapp`.
    *   **Environment Variables**: Add these from your `.env.local`:
        *   `SERPAPI_KEY`
        *   `APIFY_TOKEN`
        *   `TELEGRAM_BOT_TOKEN`
4.  **Deploy** and copy your deployment URL (e.g., `https://threadshunter-webapp.vercel.app`).

## 2. Connect to Telegram Bot

Once you have your Vercel URL, you need to tell your Telegram Bot to use it as a Mini App.

### Option A: Use the Setup Script (Recommended)
Run this command in your terminal (make sure your Vercel URL is ready):
```bash
python setup_bot.py
```

### Option B: Manual Setup via @BotFather
1.  Open [@BotFather](https://t.me/botfather) in Telegram.
2.  Type `/mybots` and select your bot (`@your_bot_user_name`).
3.  Go to **Bot Settings** -> **Menu Button** -> **Configure menu button**.
4.  Send the URL of your Vercel app.
5.  Set the title to **"Threads Hunter"**.

---

## 3. How to use
Open your bot in Telegram. You will see a button (or a menu item) that launches the **Threads Hunter** app. Enter any keyword, and it will find the most popular posts on Threads for you!
