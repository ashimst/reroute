# Production Deployment Guide (100% Free Tier)

This guide provides an **unambiguous, step-by-step, zero-cost** deployment procedure for **REROUTE**:
- **Frontend**: **Cloudflare Pages** (Free: Unlimited bandwidth, global edge CDN, automated SSL, custom domain support).
- **Backend**: **Hugging Face Spaces (Gradio SDK)** (Free: **16 GB RAM** + 2 vCPU, zero memory bottleneck for PyTorch/FAISS/Pandas, NO Docker needed, NO credit card needed).
- **AI/LLM Fallback**: **Groq Cloud** (Free fast inference for Qwen 2.5 / LLaMA 3.3).

---

## 1. What is Gradio and Why Are We Using It?

### What is Gradio?
[Gradio](https://gradio.app/) is an open-source Python framework created by Hugging Face. Under the hood, **Gradio is built directly on top of FastAPI and Starlette**.

### Why Gradio instead of Docker?
1. **Docker Restrictions**: Hugging Face recently restricted standalone Docker spaces to prevent abuse (crypto mining, etc.), requiring credit card or phone verification.
2. **Gradio Spaces are 100% Unrestricted & Free**: Hugging Face gives **16 GB of RAM** and **2 vCPU** for FREE to all standard Python/Gradio Spaces without asking for any credit card or payment info.
3. **Seamless FastAPI Mounting**: Gradio provides `gr.mount_gradio_app(fastapi_app, demo, path="/")`. This allows our existing FastAPI engine (`/api/cases`, `/api/chat`, `/api/health`, `/api/orders`, `/api/docs`) to run natively with 16 GB of memory, while giving visitors a sleek status dashboard at `/`.

---

## 2. High-Level Architecture

```
┌──────────────────────────────────────┐
│        Cloudflare Pages              │
│      (React 19 + Vite SPA)           │
│    https://reroute.pages.dev         │
└──────────────────┬───────────────────┘
                   │
            HTTPS  │ REST / SSE Stream (/api/*)
                   ▼
┌──────────────────────────────────────┐
│     Hugging Face Space (Gradio)      │
│   2 vCPU • 16 GB RAM • Free Forever  │
│    FastAPI + FAISS + LangGraph       │
│  https://<user>-reroute-api.hf.space │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│           Groq Cloud API             │
│      (Free Tier LLM Fallback)        │
└──────────────────────────────────────┘
```

---

## 3. Step-by-Step Deployment Walkthrough

### Step 1: Get a Free Groq API Key
1. Go to [console.groq.com/keys](https://console.groq.com/keys) and sign in.
2. Click **Create API Key** → Name it `reroute-prod` → Copy the key (`gsk_...`).

---

### Step 2: Deploy Backend to Hugging Face Spaces (Gradio SDK)

#### 1. Create the Space on Hugging Face
1. Go to [huggingface.co/new-space](https://huggingface.co/new-space).
2. Configure your Space:
   - **Space name**: `reroute-api`
   - **License**: `mit`
   - **Select the Space SDK**: Click **Gradio** *(Do NOT click Docker)*
   - **Gradio template**: Choose **Blank**
   - **Space Hardware**: **CPU basic • 2 vCPU • 16 GB RAM • Free**
   - **Visibility**: **Public**
3. Click **Create Space**.

#### 2. Configure Environment Variables
1. On your new Space page, click the **Settings** tab (gear icon at the top right).
2. Scroll to **Variables and secrets**.
3. Click **New secret**:
   - **Name**: `GROQ_API_KEY`
   - **Value**: Your Groq API key (`gsk_...`)
   - Click **Save**.
4. Click **New variable**:
   - **Name**: `CORS_ORIGINS`
   - **Value**: `*`
   - Click **Save**.

#### 3. Push Code to Hugging Face
Hugging Face Spaces are standard Git repositories.

1. Get your Hugging Face Access Token:
   - Go to [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens).
   - Click **Create new token** → Name: `space-deploy` → Role: **Write** → Copy token (`hf_...`).
2. In your local terminal (`c:\Projects\retail_flow`), add the Hugging Face remote and push:
   ```powershell
   git remote add hf https://huggingface.co/spaces/<YOUR_HF_USERNAME>/reroute-api
   git push hf main
   ```
   *(When prompted: Username = your Hugging Face username, Password = your `hf_...` token).*

#### 4. Verify Backend Health
1. In Hugging Face, click the **App** tab.
2. The space will automatically install dependencies from `requirements.txt` and launch `app.py`.
3. In ~2 minutes, the status will turn green: **Running**.
4. Your live backend URL is:
   ```text
   https://<YOUR_HF_USERNAME>-reroute-api.hf.space
   ```
5. Test it in your browser:
   - Health check: `https://<YOUR_HF_USERNAME>-reroute-api.hf.space/api/health`
   - Interactive Swagger API docs: `https://<YOUR_HF_USERNAME>-reroute-api.hf.space/api/docs`

---

### Step 3: Deploy Frontend on Cloudflare Pages (100% Free)

#### 1. Connect Git Repository
1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. In the left navigation, click **Compute (Workers) & Pages** → **Create application** → **Pages** tab.
3. Click **Connect to Git** and authorize your GitHub account.
4. Select repository: **`ashimst/reroute`**.
5. Click **Begin setup**.

#### 2. Configure Build Parameters
Fill in the exact fields below:

| Field | Value to Enter | Note |
| :--- | :--- | :--- |
| **Project name** | `reroute` | Yields `https://reroute.pages.dev` |
| **Production branch** | `main` | Listens to commits |
| **Framework preset** | `Vite` | Standard Vite preset |
| **Root directory** | `frontend` | **MANDATORY**: React source is in `frontend/` |
| **Build command** | `npm run build` | Compiles TypeScript & Vite bundle |
| **Build output directory** | `dist` | Generated files |

#### 3. Set Environment Variable
1. Under **Environment variables (advanced)**, click **Add variable**:
   - **Variable name**: `VITE_API_URL`
   - **Value**: Your Hugging Face Space URL without trailing slash:
     ```text
     https://<YOUR_HF_USERNAME>-reroute-api.hf.space
     ```

#### 4. Save and Deploy
1. Click **Save and Deploy**.
2. Cloudflare Pages builds and deploys your site in ~60 seconds to:
   ```text
   https://reroute.pages.dev
   ```

---

## 4. Verification Checklist

1. **Visit Frontend**: Go to `https://reroute.pages.dev`. The UI should load with the dark obsidian theme.
2. **Test Demo**: Click **Demo** in navbar → select any order → verify order details load instantly from the Hugging Face backend.
3. **Test Exception Resolution**: Run an eligibility check on any order; the rules and retrieved policies should return in milliseconds.
4. **Test Chat**: Go to `/demo?tab=chat` and send a message. Verify the LangGraph reflex triaging streams back real-time answers.
5. **Direct Page Reload**: Refresh on `https://reroute.pages.dev/demo` — verify it reloads cleanly without a 404 (handled by `_redirects`).
