# Definitive Step-by-Step Production Deployment Guide (Hugging Face Gradio + Cloudflare Pages)

This guide provides an **unambiguous, click-by-click, input-by-input walkthrough** for deploying **REROUTE** to production at **$0 cost**:
- **Backend**: Hosted on **Hugging Face Spaces (Gradio SDK)** — **16 GB RAM + 2 vCPUs**, 100% free forever, no sleep/cold starts, **NO credit card required**.
- **Frontend**: Hosted on **Cloudflare Pages** — Free global CDN, instant SSL, unlimited bandwidth, zero cold starts.
- **LLM Fallback**: Hosted on **Groq Cloud** — Free tier with ultra-fast inference (Qwen 2.5 / LLaMA 3.3).

---

## 1. High-Level Architecture

```
┌──────────────────────────────────────────────┐
│             Cloudflare Pages                 │
│           (React 19 + Vite SPA)              │
│         https://reroute.pages.dev            │
└──────────────────────┬───────────────────────┘
                       │
                HTTPS  │ REST / SSE Stream (/api/*)
                       ▼
┌──────────────────────────────────────────────┐
│         Hugging Face Space (Gradio)          │
│       2 vCPU • 16 GB RAM • Free Forever      │
│      https://<user>-reroute-api.hf.space     │
│         FastAPI + FAISS + LangGraph          │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│               Groq Cloud API                 │
│          (Free Tier LLM Fallback)            │
└──────────────────────────────────────────────┘
```

---

## 2. Pre-Requisites Checklist (All 100% Free — No Credit Card)

Open the following 3 accounts in your browser (all free, no billing details required):

| Component | Platform | Direct URL | Cost |
| :--- | :--- | :--- | :---: |
| **Code Repository** | GitHub | [github.com/ashimst/reroute](https://github.com/ashimst/reroute) | Free |
| **Backend API Host** | Hugging Face | [huggingface.co/join](https://huggingface.co/join) | Free |
| **Frontend Host** | Cloudflare | [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) | Free |
| **LLM Inference** | Groq Cloud | [console.groq.com](https://console.groq.com) | Free |

---

## 3. Step 1: Obtain a Free Groq API Key

1. Navigate to **[console.groq.com/keys](https://console.groq.com/keys)** and sign in with Google or GitHub.
2. Click the orange **Create API Key** button.
3. Enter key name: `reroute-production`.
4. Click **Submit**.
5. Copy the generated key (starts with `gsk_...`) and keep it in a temporary text file. You will paste this into Hugging Face in the next step.

---

## 4. Step 2: Deploy the Backend to Hugging Face Spaces (Gradio SDK)

Deploying to Hugging Face using the **Gradio SDK** provisions a Linux container with **16 GB of RAM** and **2 vCPUs** for free without credit card verification.

### Sub-Step 2.1: Create the Space on Hugging Face
1. In your browser, open **[huggingface.co/new-space](https://huggingface.co/new-space)**.
2. Fill out the exact creation form fields:
   - **Space name**: `reroute-api`
   - **License**: `mit`
   - **Select the Space SDK**: Click **Gradio** *(⚠️ DO NOT select Docker — Docker now requires card verification, whereas Gradio is 100% free with no verification).*
   - **Gradio template**: Click **Blank**
   - **Space Hardware**: Leave as **CPU basic • 2 vCPU • 16 GB RAM • Free**
   - **Visibility**: Select **Public**
3. Click the **Create Space** button at the bottom.

---

### Sub-Step 2.2: Add Secrets and Environment Variables
1. On your newly created Space page, click the **Settings** tab (gear icon at the top right).
2. Scroll down to the section named **Variables and secrets**.
3. **Add the Groq Secret**:
   - Click the **New secret** button.
   - In the **Name** field, enter: `GROQ_API_KEY`
   - In the **Value** field, paste your Groq key (`gsk_...`).
   - Click **Save**.
4. **Add the CORS Origin Variable**:
   - Click the **New variable** button.
   - In the **Name** field, enter: `CORS_ORIGINS`
   - In the **Value** field, enter: `*`
   - Click **Save**.

---

### Sub-Step 2.3: Generate a Hugging Face Access Token
1. Open **[huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)** in a new tab.
2. Click the **Create new token** button.
3. In the dialog:
   - **Token type**: Choose **Write**
   - **Token name**: `reroute-deploy`
4. Click **Create token**.
5. Copy the token (starts with `hf_...`). You will use this as your Git password.

---

### Sub-Step 2.4: Push Your Code to the Hugging Face Space
Open your local PowerShell terminal and navigate to the project directory:

```powershell
cd c:\Projects\retail_flow
```

1. Add the Hugging Face Git remote (replace `<YOUR_HF_USERNAME>` with your actual Hugging Face username):
   ```powershell
   git remote add hf https://huggingface.co/spaces/<YOUR_HF_USERNAME>/reroute-api
   ```
   *(Note: If you already added `hf` earlier, you can update it with `git remote set-url hf https://huggingface.co/spaces/<YOUR_HF_USERNAME>/reroute-api`)*

2. Push the `main` branch to Hugging Face:
   ```powershell
   git push hf main
   ```

3. Git will prompt for credentials:
   - **Username**: Enter your Hugging Face username (e.g. `ashimst`)
   - **Password**: Paste your Hugging Face Access Token (`hf_...`)

---

### Sub-Step 2.5: Verify Backend is Live and Healthy
1. Switch back to your browser on your Hugging Face Space page.
2. Click the **App** tab.
3. Hugging Face will automatically:
   - Read the YAML header from `README.md`.
   - Install dependencies from `requirements.txt`.
   - Launch `app.py`, which binds to port 7860 and pre-warms the FAISS policy index and Olist datasets.
4. After ~90 to 120 seconds, the Space status badge in the top left will turn green: **Running**.
5. Your live backend URL follows this exact structure:
   ```text
   https://<YOUR_HF_USERNAME>-reroute-api.hf.space
   ```
6. **Verify the Health Endpoint**:
   Open this URL in your browser:
   ```text
   https://<YOUR_HF_USERNAME>-reroute-api.hf.space/api/health
   ```
   You should see:
   ```json
   {
     "status": "healthy",
     "version": "1.0.0",
     "uptime_seconds": 12.4
   }
   ```
7. **Verify the Interactive API Documentation**:
   Open:
   ```text
   https://<YOUR_HF_USERNAME>-reroute-api.hf.space/api/docs
   ```
   The interactive Swagger UI for REROUTE will display with all endpoints (`/api/cases`, `/api/chat`, `/api/orders`, etc.).

---

## 5. Step 3: Deploy the Frontend to Cloudflare Pages (100% Free)

Cloudflare Pages compiles the React 19 application and serves it across 300+ global edge locations with automated SSL.

### Sub-Step 3.1: Connect GitHub Repository
1. Log in to the **[Cloudflare Dashboard](https://dash.cloudflare.com/)**.
2. In the left navigation sidebar, click **Compute (Workers) & Pages** (or **Workers & Pages**).
3. Click the blue **Create application** button.
4. Select the **Pages** tab (middle tab at the top).
5. Click the black **Connect to Git** button.
6. If prompted, authorize Cloudflare to access your GitHub account.
7. Under **Select a repository**, choose: **`ashimst/reroute`**.
8. Click **Begin setup**.

---

### Sub-Step 3.2: Configure Exact Build Parameters
Fill in the configuration form with these exact values:

| Configuration Field | Exact Value to Enter | Why This Value Is Critical |
| :--- | :--- | :--- |
| **Project name** | `reroute` | Sets your URL to `https://reroute.pages.dev` |
| **Production branch** | `main` | Cloudflare will automatically build new commits pushed to `main` |
| **Framework preset** | `Vite` | Pre-populates recommended build parameters |
| **Root directory** | `frontend` | **MANDATORY**: React source code is in the `frontend/` subdirectory |
| **Build command** | `npm run build` | Compiles TypeScript and executes `vite build` |
| **Build output directory** | `dist` | Destination folder generated by Vite |

---

### Sub-Step 3.3: Set the API Environment Variable
1. Scroll down on the same setup page to the **Environment variables (advanced)** section.
2. Click the **Add variable** button.
3. Configure the variable:
   - **Variable name**: `VITE_API_URL`
   - **Value**: Your live Hugging Face backend URL **without trailing slash**:
     ```text
     https://<YOUR_HF_USERNAME>-reroute-api.hf.space
     ```
     *(Example: `https://ashimst-reroute-api.hf.space`)*

---

### Sub-Step 3.4: Deploy
1. Click the blue **Save and Deploy** button.
2. Cloudflare Pages will clone your repository, install npm dependencies, compile the TypeScript bundle, and copy static assets.
3. The build completes in approximately 45–60 seconds.
4. You will see the green success confirmation:
   ```text
   🎉 Success! Your project is deployed at: https://reroute.pages.dev
   ```

---

## 6. Step 4: End-to-End Verification Checklist

Perform these tests on your deployed frontend (`https://reroute.pages.dev`):

| Test # | Action | Expected Output | Status |
| :---: | :--- | :--- | :---: |
| **1** | Open `https://reroute.pages.dev` | Landing page loads with dark obsidian theme, Noesis typography, and hero cards | 🟢 |
| **2** | Direct page refresh on `https://reroute.pages.dev/demo` | Page reloads without a 404 (handled by `_redirects` rule `/* /index.html 200`) | 🟢 |
| **3** | Click **Demo** in navbar → select order `#e481f51cbdc54678b7cc49136f2d6af7` | Order details, purchase timestamp, and items populate from the HF backend API | 🟢 |
| **4** | On the Return tab, click **Check Eligibility** | Deterministic Cactus Needle tools run in < 50ms and display policy RET-10 resolution | 🟢 |
| **5** | Switch to Chat tab (`/demo?tab=chat`) and send: *"My package arrived broken, what can I do?"* | Intent classification runs, LangGraph evaluates rules, and Groq streams back reasoning | 🟢 |
| **6** | Open Developer Tools (`F12`) → Console | Zero CORS errors, zero mixed-content warnings | 🟢 |

---

## 7. Troubleshooting Matrix

### Issue 1: "CORS error: No 'Access-Control-Allow-Origin' header"
- **Cause**: Backend CORS middleware is not authorizing the `pages.dev` origin.
- **Solution**: We already resolved this in `backend/app/main.py` with dynamic regex `^https?://.*`. Ensure your Hugging Face Space variable `CORS_ORIGINS` is set to `*`.

### Issue 2: Direct browser reload on `/demo` gives a 404 Not Found
- **Cause**: Cloudflare Pages looked for a physical file at `/demo/index.html`.
- **Solution**: Handled automatically by `frontend/public/_redirects` (which Vite copies to `dist/_redirects`). If missing, verify `frontend/public/_redirects` contains:
  ```text
  /*    /index.html   200
  ```

### Issue 3: Chat says "Network Error" or does not respond
- **Cause**: `VITE_API_URL` was not configured in Cloudflare Pages or contained a trailing slash (`/`).
- **Solution**: In Cloudflare Pages → **Settings** → **Environment variables** → verify `VITE_API_URL` is set to `https://<YOUR_HF_USERNAME>-reroute-api.hf.space` (no trailing slash). Then go to **Deployments** → click **Retry deployment**.

---

## 8. Ongoing Maintenance & CI/CD Workflow

Whenever you make future code updates in your local repository:

```powershell
# 1. Commit your changes locally
git add .
git commit -m "feat: your new feature"

# 2. Push to GitHub (Cloudflare Pages automatically rebuilds frontend in 60s)
git push origin main

# 3. Push to Hugging Face (rebuilds the backend in 90s)
git push hf main
```
