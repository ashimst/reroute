# Zero-Cost Production Deployment Guide

This guide provides an **unambiguous, step-by-step, 100% free** deployment procedure for **REROUTE**:
- **Frontend**: Hosted on **Cloudflare Pages** (Free: Unlimited bandwidth, global CDN, automated SSL, custom domain support).
- **Backend**: Hosted on **Hugging Face Spaces** (Free: 16 GB RAM + 2 vCPU, persistent Docker container, no sleep/cold starts) OR **Render.com** (Free tier Web Service).
- **AI/LLM Fallback**: Hosted on **Groq Cloud** (Free tier with instant inference for Qwen 2.5 / LLaMA 3.3).

---

## Architecture Overview

```
┌─────────────────────────────────┐
│     Cloudflare Pages            │
│   (React 19 + Vite SPA)         │
│   https://reroute.pages.dev     │
└────────────────┬────────────────┘
                 │
          HTTPS  │ REST / SSE Stream
                 ▼
┌─────────────────────────────────┐
│     Backend Docker Container    │
│   (FastAPI + FAISS + LangGraph) │
│   Port: 7860 or 8000            │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│        Groq Cloud API           │
│   (Free Tier LLM Fallback)      │
└─────────────────────────────────┘
```

---

## Pre-requisites (All 100% Free, No Credit Card Required)

1. **GitHub Account**: Your code is already pushed to [github.com/ashimst/reroute](https://github.com/ashimst/reroute.git).
2. **Cloudflare Account**: Sign up free at [cloudflare.com](https://dash.cloudflare.com/sign-up).
3. **Backend Host Account**:
   - **Recommended**: Sign up free at [huggingface.co](https://huggingface.co/join) (Provides **16 GB RAM**, ideal for FAISS and SentenceTransformers without memory crashes).
   - **Alternative**: Sign up free at [render.com](https://render.com).
4. **Groq API Key (Optional but recommended for LLM fallback)**:
   - Generate free key at [console.groq.com/keys](https://console.groq.com/keys).

---

## Part 1: Deploy Backend (Choose Option A or Option B)

Deploy the backend first so you have your public API URL ready for the frontend.

### Option A: Hugging Face Spaces (Recommended — 16 GB RAM, 100% Free Forever)

Hugging Face Spaces gives 16 GB RAM for free, which runs the FAISS vector index and Olist dataset with zero memory bottlenecks.

1. Go to [huggingface.co/new-space](https://huggingface.co/new-space).
2. Configure your Space:
   - **Space name**: `reroute-api`
   - **License**: `mit` or `apache-2.0`
   - **Select the Space SDK**: Click **Docker**
   - **Docker template**: Choose **Blank**
   - **Space Hardware**: Choose **CPU basic • 2 vCPU • 16 GB RAM • Free**
   - **Visibility**: **Public**
3. Click **Create Space**.
4. Now push your GitHub repository code to this Space:
   - In your local terminal inside `c:\Projects\retail_flow`, run:
     ```bash
     git remote add hf https://huggingface.co/spaces/<YOUR_HF_USERNAME>/reroute-api
     git push hf main
     ```
     *(Enter your Hugging Face username and Access Token when prompted. You can generate a Write token at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)).*
5. Configure Environment Variables in Hugging Face:
   - On your Space page, click **Settings** tab.
   - Scroll down to **Variables and secrets**.
   - Click **New secret**:
     - Key: `GROQ_API_KEY`
     - Value: `<your-groq-api-key>`
   - Click **New variable**:
     - Key: `CORS_ORIGINS`
     - Value: `*`
6. Once the build completes (takes ~2 minutes), your backend is live!
   - Your public backend URL will be:
     ```
     https://<YOUR_HF_USERNAME>-reroute-api.hf.space
     ```
   - Test it by visiting in your browser:
     `https://<YOUR_HF_USERNAME>-reroute-api.hf.space/api/health`
     It should respond with: `{"status":"healthy", ...}`

---

### Option B: Render.com (Alternative Free Web Service)

1. Go to [dashboard.render.com](https://dashboard.render.com) and click **New +** → **Web Service**.
2. Connect your GitHub repository: `ashimst/reroute`.
3. Configure the service:
   - **Name**: `reroute-api`
   - **Language**: `Docker`
   - **Branch**: `main`
   - **Region**: Choose closest to you (e.g., Singapore, Frankfurt, or Oregon)
   - **Instance Type**: `Free`
4. Expand **Advanced** → **Add Environment Variable**:
   - `GROQ_API_KEY`: `<your-groq-api-key>`
   - `CORS_ORIGINS`: `*`
   - `PORT`: `10000`
5. Click **Create Web Service**.
6. Render will automatically build the `Dockerfile`.
   - Your public backend URL will be:
     ```
     https://reroute-api.onrender.com
     ```
   - Verify health: `https://reroute-api.onrender.com/api/health`

---

## Part 2: Deploy Frontend on Cloudflare Pages (100% Free)

Cloudflare Pages provides instant edge distribution, zero cold starts, and free SSL.

### Step 1: Connect GitHub Repository
1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. In the left navigation sidebar, click **Compute (Workers) & Pages** (or **Workers & Pages**).
3. Click the **Create application** button.
4. Select the **Pages** tab and click **Connect to Git**.
5. Select your GitHub account and choose the repository: **`ashimst/reroute`**.
6. Click **Begin setup**.

### Step 2: Configure Build Settings
Fill out the setup form with the exact settings below:

| Field | Value | Notes |
| :--- | :--- | :--- |
| **Project name** | `reroute` | Will create `https://reroute.pages.dev` |
| **Production branch** | `main` | Automatically triggers on new pushes |
| **Framework preset** | `Vite` | Configures defaults |
| **Root directory** | `frontend` | **CRITICAL**: The React app is in `frontend/` |
| **Build command** | `npm run build` | Runs `tsc -b && vite build` |
| **Build output directory** | `dist` | Generated static bundle |

### Step 3: Add Environment Variables
Under the **Environment variables (advanced)** section on the same page:
1. Click **Add variable**.
2. Set:
   - **Variable name**: `VITE_API_URL`
   - **Value**: Your live backend URL from Part 1, without a trailing slash:
     - Example (Hugging Face): `https://<YOUR_HF_USERNAME>-reroute-api.hf.space`
     - Example (Render): `https://reroute-api.onrender.com`

### Step 4: Deploy
1. Click **Save and Deploy**.
2. Cloudflare Pages will clone the repository, install dependencies, run `npm run build`, and deploy the site across Cloudflare's global edge network.
3. Once finished (~1 minute), you will see:
   🎉 **Success! Your project is deployed at: `https://reroute.pages.dev`** (or your chosen project name).

---

## Part 3: Verification & Sanity Checks

Open your deployed frontend URL (`https://reroute.pages.dev`) and verify:

1. **Homepage & Landing Page**:
   - The dark theme hero, interactive workflow pipeline, and real-time benchmark cards load cleanly.
2. **Demo & Exception Studio (`/demo`)**:
   - Click **Demo** in the top navigation bar.
   - Select any order (e.g., `#e481f51cbdc54678b7cc49136f2d6af7`).
   - Run a test return or delivery check — verify that live policy rules evaluate and results display.
3. **Chat & Streamed Reasoning (`/chat`)**:
   - Send an inquiry like *"I want to return my smartwatch because it arrived damaged"*.
   - Confirm that the LangGraph reflex triaging and resolution response streams back.
4. **SPA Client-Side Navigation**:
   - Refresh the page directly on `https://reroute.pages.dev/demo` or `https://reroute.pages.dev/cases`.
   - The page should reload instantly without a 404 error (handled by `frontend/public/_redirects`).

---

## Part 4: Updating Code in the Future

Whenever you want to push updates:
```bash
git add .
git commit -m "your update message"
git push origin main
```
- **Cloudflare Pages** will automatically detect the commit, trigger a fresh build, and deploy the new version in under 60 seconds with zero downtime.
- If using **Hugging Face Spaces**, run `git push hf main` to redeploy the backend container.
- If using **Render**, it will automatically rebuild upon any push to `origin main`.

---

## Summary of Configurations Included in the Repo

- `frontend/public/_redirects`: Contains `/*  /index.html  200` to prevent 404 errors on browser page reloads in Cloudflare Pages.
- `backend/app/main.py`: Pre-configured CORS regex to automatically authorize requests from any `https://*.pages.dev` domain and custom domains.
- `Dockerfile`: Multi-stage, low-footprint Debian container pre-bundled with FAISS, SentenceTransformers, and Olist dataset, with dynamic `$PORT` handling for any cloud container provider.
