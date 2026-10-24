# Retail Flow — REROUTE

> **Retail Exception Routing and Resolution Engine**  
> A full-stack AI system that routes customer order complaints through a structured pipeline: semantic routing → policy retrieval → deterministic tool execution → LLM fallback.

![Tech Stack](https://img.shields.io/badge/LangGraph-workflow-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-backend-green) ![React](https://img.shields.io/badge/React-frontend-61DAFB) ![Groq](https://img.shields.io/badge/Groq-LLM-orange)

---

## What is REROUTE?

REROUTE is a customer support operations engine built on the [Olist Brazilian E-Commerce dataset](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce). It demonstrates a complete exception-handling pipeline:

```
Customer message
    ↓
OpenJEV / Keyword Router  (classify: returns / delivery / payment)
    ↓
LangGraph State Machine   (orchestrate the workflow)
    ↓
Policy RAG                (FAISS + sentence-transformers)
    ↓
Cactus Needle Tools       (deterministic: check windows, calc refunds, inspect payments)
    ↓
Groq LLM                  (fallback only — when confidence is below threshold)
    ↓
Resolution or Human Escalation
```

---

## Project Structure

```
retail_flow/
├── reroute/              Python exception engine (LangGraph + tools + RAG)
│   ├── data/             Olist CSV files + policy documents
│   ├── src/              Engine source code
│   ├── tests/            58 unit + integration tests
│   ├── examples/         15 pre-built example cases
│   └── main.py           CLI runner
│
└── web/
    ├── backend/          FastAPI server
    │   ├── app/
    │   │   ├── main.py           Startup, CORS, lifespan warmup
    │   │   ├── routers/          cases.py  orders.py  health.py
    │   │   └── schemas/          Pydantic response models
    │   └── requirements.txt
    │
    └── frontend/         React + Vite + TypeScript + Tailwind
        └── src/
            ├── lib/              api.ts  utils.ts
            ├── components/       Layout  CaseForm  ResolutionCard  OrderCard
            └── pages/            SubmitPage  OrderLookupPage  HistoryPage
```

---

## Quick Start

### 1. Install engine dependencies

```bash
cd reroute/
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp reroute/.env.example reroute/.env
# Edit reroute/.env — add GROQ_API_KEY if you want LLM fallback
```

### 3. Start the FastAPI backend

```bash
cd web/backend/
pip install -r requirements.txt

# Windows
uvicorn app.main:app --reload --port 8001

# macOS / Linux
uvicorn app.main:app --reload --port 8001
```

First startup takes ~20 seconds to load Olist orders and warm up the policy vector index (cached after that).

### 4. Start the React frontend

```bash
cd web/frontend/
npm install
npm run dev
```

Open **http://localhost:5173**

---

## Free Deployment Guide (100% Free Forever)

### 1. Frontend: Cloudflare Pages (Free Forever)

Cloudflare Pages provides free static hosting with unlimited bandwidth and global edge CDN.

1. Push your repository to **GitHub**.
2. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) > **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
3. Select your repository.
4. Configure the build settings:
   - **Framework preset**: `Vite`
   - **Root directory**: `web/frontend`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. Under **Environment variables**, add:
   - `VITE_API_URL`: Your deployed backend URL (e.g., `https://<your-space>.hf.space` or `https://<your-app>.onrender.com`).
6. Click **Save and Deploy**.
   *(Note: Client-side SPA routing for `/submit`, `/orders`, and `/history` is handled automatically via `web/frontend/public/_redirects`).*

---

### 2. Backend: Hugging Face Spaces (Recommended: Free 16 GB RAM)

Because the REROUTE engine runs sentence embeddings, FAISS, and pandas in memory, **Hugging Face Spaces** is the ideal 100% free hosting platform (includes 2 vCPUs and **16 GB RAM** free forever).

1. Go to [Hugging Face Spaces](https://huggingface.co/spaces) and click **Create new Space**.
2. Choose a name (e.g. `retail-flow-api`), license, and set **Space SDK** to `Docker` (Blank).
3. Under **Repository Settings**, set your Secrets / Environment Variables:
   - `GROQ_API_KEY`: Your Groq API key from [console.groq.com](https://console.groq.com)
   - `GROQ_MODEL`: `qwen/qwen3.8-27b`
4. Push the repository to the Space or mirror your GitHub repository. The included root `Dockerfile` automatically installs dependencies and starts the FastAPI server on port 7860.
5. Copy the direct Space URL (`https://<username>-retail-flow-api.hf.space`) and set it as `VITE_API_URL` in Cloudflare Pages.

---

### 3. Backend: Render (Alternative Free Web Service)

Render provides a free web service tier.

1. Connect your repository to [Render.com](https://render.com).
2. Choose **New Web Service** and select this repo (uses the included `render.yaml` or `Dockerfile`).
3. Add environment variables `GROQ_API_KEY` and `GROQ_MODEL=qwen/qwen3.8-27b`.
4. Deploy for $0/month.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/cases` | Submit an exception case |
| `GET`  | `/api/cases/examples` | List 15 bundled example cases |
| `GET`  | `/api/orders/{order_id}` | Look up an Olist order |
| `GET`  | `/api/orders?q=<prefix>` | Search order IDs by prefix |
| `POST` | `/api/chat` | Conversational assistant with SSE streaming |
| `GET`  | `/api/health` | Engine health check |
| `GET`  | `/api/docs` | Swagger UI |
| `GET`  | `/api/redoc` | ReDoc |

### Example request

```bash
curl -X POST http://localhost:8001/api/cases \
  -H 'Content-Type: application/json' \
  -d '{
    "order_id": "e481f51cbdc54678b7cc49136f2d6af7",
    "customer_message": "My product arrived damaged and I want a refund."
  }'
```

### Example response

```json
{
  "case_id": "WEB-A3F2B1C0",
  "order_id": "e481f51cbdc54678b7cc49136f2d6af7",
  "route": "returns",
  "routing_confidence": 0.75,
  "routing_backend": "keyword_fallback",
  "resolution": "denied",
  "resolution_detail": "Damaged item reported after 7 days (3275 days since delivery). Denied unless exception applies (RET-20).",
  "escalate": false,
  "confidence": 0.9,
  "groq_used": false,
  "tools_executed": ["get_order", "get_order_items", "check_return_window", "check_return_eligibility"],
  "applicable_rules": ["RET-10"],
  "retrieved_policies": [
    { "policy_id": "REF-09", "score": 0.52, "source_file": "refunds.md", "policy_text": "..." }
  ]
}
```

---

## Tech Stack

| Layer | Technology | Role |
|-------|-----------|------|
| Workflow | **LangGraph** | State machine orchestrating the full pipeline |
| Routing | **OpenJEV** (TypeSafe SDK) | Typed probabilistic routing decisions |
| Tools | **Cactus Needle** | Deterministic tool-call execution layer |
| LLM fallback | **Groq** | `qwen/qwen3.8-27b` fallback reasoning |
| Policy RAG | **FAISS + sentence-transformers** | `all-MiniLM-L6-v2` semantic policy retrieval |
| Data | **Olist CSV (Pandas)** | 99k Brazilian e-commerce orders |
| Backend | **FastAPI + Uvicorn** | Async API, lifespan warmup, Pydantic schemas |
| Frontend | **React + Vite + Tailwind** | TypeScript, React Query, React Router |

---

## Environment Variables

### `reroute/.env`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GROQ_API_KEY` | For LLM fallback | — | Get from [console.groq.com](https://console.groq.com) |
| `GROQ_MODEL` | No | `qwen/qwen3.8-27b` | Groq model name |
| `OPENJEV_API_KEY` | No | — | Enables semantic routing (vs keywords) |
| `ROUTING_CONFIDENCE_THRESHOLD` | No | `0.6` | Below this → Groq route classification |
| `RESOLUTION_CONFIDENCE_THRESHOLD` | No | `0.5` | Below this → Groq resolution fallback |

### `web/frontend/.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8001` | Backend URL for production builds |

---

## Running Tests

```bash
# Backend unit & integration tests (58 tests)
cd reroute/
pytest

# Frontend linter
cd web/frontend/
npm run lint

# Frontend production build
npm run build
```

---

## Known Limitations

- **Historical data**: All Olist orders are from 2016–2018. Every return/damage window appears expired relative to today, so most cases resolve as "denied". This is correct — the tools apply policy faithfully.
- **OpenJEV**: Without `OPENJEV_API_KEY`, routing uses keyword matching (confidence ≤ 0.75). Add a key from [codiv.ai](https://api.codiv.ai) for semantic routing.
- **Groq**: Without `GROQ_API_KEY`, the LLM fallback escalates all uncertain cases to human review.
- **No persistence**: Case history is stored in browser `localStorage` only.
