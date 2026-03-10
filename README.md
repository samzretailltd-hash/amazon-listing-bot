# 🛒 Amazon A9 Vision Listing Bot

AI-powered Amazon listing generator with image analysis, auto-detection, and A9 SEO optimization.

---

## 🚀 Deploy to Vercel in 5 Minutes

### Step 1 — Create a GitHub Repository

1. Go to **github.com** → click **"New repository"**
2. Name it `amazon-listing-bot`
3. Set it to **Public** or **Private** (both work)
4. Click **"Create repository"**

### Step 2 — Upload these files to GitHub

Upload ALL files maintaining this exact folder structure:

```
amazon-listing-bot/
├── api/
│   └── claude.js          ← Serverless proxy (keeps API key secret)
├── public/
│   └── index.html
├── src/
│   ├── index.js
│   └── App.js             ← Main React app
├── package.json
├── vercel.json
└── README.md
```

**How to upload:**
- In your GitHub repo, click **"uploading an existing file"**
- Drag all files in — make sure folder structure is preserved
- Click **"Commit changes"**

---

### Step 3 — Deploy on Vercel

1. Go to **vercel.com** → Sign up free with your GitHub account
2. Click **"Add New Project"**
3. Click **"Import"** next to your `amazon-listing-bot` repo
4. Vercel auto-detects React — leave all settings as default
5. Click **"Deploy"**

---

### Step 4 — Add Your API Key (Most Important!)

After deployment:

1. In Vercel dashboard → click your project → **"Settings"**
2. Click **"Environment Variables"** in the left sidebar
3. Click **"Add New"**
4. Fill in:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** your key from console.anthropic.com (starts with `sk-ant-`)
   - **Environment:** ✅ Production ✅ Preview ✅ Development
5. Click **"Save"**
6. Go back to **"Deployments"** → click **"Redeploy"** → **"Redeploy"** again

✅ Done! Your site is live at `your-project-name.vercel.app`

---

## 🔒 How Security Works

```
Browser  →  /api/claude (your Vercel server)  →  api.anthropic.com
                        ↑
              API key lives HERE only
              Never sent to browser
```

- Your `ANTHROPIC_API_KEY` is stored as a Vercel environment variable
- The browser calls `/api/claude` (your own server), NOT Anthropic directly
- The server adds your key and forwards the request to Anthropic
- **Your key is never visible to anyone visiting your website**

---

## 🛠️ Local Development

```bash
# 1. Install dependencies
npm install

# 2. Create .env file for local dev
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" > .env

# 3. Install Vercel CLI
npm install -g vercel

# 4. Run locally (includes the /api proxy)
vercel dev

# App runs at http://localhost:3000
```

> ⚠️ Do NOT use `npm start` alone for local dev — it won't include the `/api/claude` proxy.
> Always use `vercel dev` to test the full stack locally.

---

## 📁 File Reference

| File | Purpose |
|------|---------|
| `api/claude.js` | Vercel serverless function — proxies to Anthropic API with your key |
| `src/App.js` | Full React frontend — all UI, image upload, AI auto-detect, listing generation |
| `src/index.js` | React entry point |
| `public/index.html` | HTML shell |
| `package.json` | Dependencies |
| `vercel.json` | Routes `/api/*` to serverless functions, everything else to React |

---

## ✨ Features

- 📸 **Image Upload** — up to 5 product photos analyzed by AI vision
- 📐 **Size Detection** — AI estimates dimensions from images
- 🤖 **Auto-Detect** — category, audience & features detected as you type
- ⚡ **A9 Optimized Title** — keyword front-loaded, 180 char max
- 🎯 **5 Power Bullets** — conversion-focused with SEO hooks
- 📄 **Full Description** — 700-900 word HTML with trending keywords
- 🔑 **Backend Terms** — Seller Central ready, 240 chars
- 📊 **Score Dashboard** — A9, SEO, CVR, Keyword Density rings
- 💡 **Insights** — competitor gaps, pricing strategy, improvements
- 🔒 **Secure** — API key never touches the browser

---

## 💰 Costs

- **Vercel hosting:** Free (Hobby plan)
- **Anthropic API:** Pay per use (~$0.003 per listing generated)
- Get your API key at: console.anthropic.com

---

## ❓ Troubleshooting

**"Internal Server Error" on generate:**
→ Check that `ANTHROPIC_API_KEY` is set in Vercel Environment Variables and you redeployed after adding it.

**Blank page after deploy:**
→ Make sure `public/index.html` exists and `src/index.js` + `src/App.js` are in the right folders.

**Auto-detect not working:**
→ Your API key may be invalid or have no credits. Check console.anthropic.com.

**Images not uploading:**
→ Use JPG, PNG, or WEBP only. Max 5 images. Each image should be under 5MB.
