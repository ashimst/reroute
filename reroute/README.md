# REROUTE – Retail Flow Exception Routing and Resolution Engine

A locally runnable MVP that demonstrates end-to-end retail order exception
handling: customer message → routing → policy retrieval → deterministic tools
→ resolution or human escalation.

---

## 1. What REROUTE Is

REROUTE is a small, runnable system that routes customer order exceptions
(returns, delivery problems, payment issues) through a structured workflow and
resolves them by combining:

- Real transactional order data (Olist Brazilian E-Commerce dataset)
- Fictional retail policy documents
- Deterministic Python tools for all calculations
- A typed routing layer (Open-JEV) for fast classification
- A state machine (LangGraph) for workflow orchestration
- A small tool-calling model (Cactus Needle) as the deterministic execution layer
- Groq LLM as a fallback only when deterministic reasoning is insufficient

The goal is to demonstrate the complete flow and architectural separation of
concerns, not to build a production system.

---

## 2. Architecture

```
Customer message
       ↓
   LangGraph (StateGraph / CaseState)
       ↓
   Open-JEV router
   (Choice: returns | delivery | payment)
   (Score: urgency 0-2)
   (Noul: needs_human probability)
       ↓
   ┌───────────┬───────────┬──────────────┐
   │           │           │              │
Returns    Delivery    Payment
 Agent      Agent       Agent
   │           │           │
   └───────────┴───────────┘
       ↓
   Policy retrieval (FAISS + sentence-transformers)
       ↓
   Cactus Needle tools
   (check_return_window, check_return_eligibility,
    calculate_refund, check_delivery_delay,
    check_payment_status, detect_payment_issue, …)
       ↓
   ┌──────────────┐     ┌──────────────────┐
   │  confident   │     │    uncertain     │
   │  → resolve   │     │  → Groq fallback │
   └──────────────┘     └─────────┬────────┘
                                  ↓
                              resolve
                                  ↓
                         final resolution
                         or human escalation
```

Key principle: **Groq is never the main controller.** It is only invoked when
OpenJEV routing confidence is below threshold, or when an agent cannot reach a
confident decision deterministically.

---

## 3. Why Olist Is Used

The [Olist Brazilian E-Commerce Public Dataset](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce)
provides realistic transactional e-commerce data including:

- Order lifecycle (purchase → approval → carrier → delivery)
- Order items and product categories
- Payment records (type, installments, amounts)
- Customer information
- Estimated and actual delivery dates

This gives REROUTE a realistic substrate of order data to inspect when
evaluating exception scenarios, without needing to generate synthetic data.

---

## 4. Olist's Limitations

Olist is **historical transaction data**, not a real-time exception management
system. It does not contain:

- Return or refund case records
- Damage reports or photos
- Customer service interactions
- Fraud flags or billing addresses
- Carrier GPS data
- Real return eligibility decisions

REROUTE therefore uses Olist as the transactional substrate only. The customer
exception (e.g. "my product arrived damaged") is a hypothetical scenario
overlaid on the real order data. The fictional policy documents determine
whether that hypothetical exception can be resolved.

Because all Olist orders are historical (2016–2018), the 30-day return window
and the 7-day damage report window will always appear expired relative to today.
This is expected and correct behaviour – the tools apply the policy rules
accurately against real dates.

---

## 5. Role of Each Technology

| Technology | Role |
|---|---|
| **LangGraph** | Top-level state machine. Defines `CaseState`, orchestrates node execution, manages conditional branching between confident resolution and Groq fallback. |
| **Open-JEV** | Typed routing decisions. Uses `Choice` / `Score` / `Noul` primitives to classify the customer message into a workflow (returns, delivery, payment) with calibrated confidence. Falls back to keyword matching if the backend is unavailable. |
| **Cactus Needle** | Deterministic tool execution layer. All tool functions (`check_return_window`, `calculate_refund`, etc.) are decorated with `@needle.tool` and registered with a `needle.Needle` agent per workflow. No LLM involved. |
| **Groq** | LLM fallback only. Called when routing confidence or agent confidence is below threshold. Returns structured JSON (`interpretation`, `recommended_action`, `confidence`, `needs_human`). Never executes tools directly. |
| **Olist CSV data** | Transactional substrate. Loaded once at startup into Pandas DataFrames. Repository functions provide clean Python dicts. |
| **Policy documents** | Fictional retail policy rules (RET-*, REF-*, DEL-*, PAY-*). Chunked per rule, embedded with `all-MiniLM-L6-v2`, indexed with FAISS for semantic retrieval. |

---

## 6. Installation

**Prerequisites:** Python 3.11+

```bash
# Clone or navigate to the reroute/ directory
cd reroute/

# Create and activate a virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux

# Install dependencies
pip install -r requirements.txt
```

The first run will download the `all-MiniLM-L6-v2` sentence-transformer model
(~90 MB) and build the FAISS policy index, which is then cached to
`data/policy_index/` for subsequent runs.

---

## 7. Environment Variables

Copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | Yes (for Groq fallback) | Get from [console.groq.com](https://console.groq.com) |
| `GROQ_MODEL` | No | Default: `llama-3.1-8b-instant` |
| `OPENJEV_BACKEND` | No | `mock` (default, instant) or `hf` (downloads a model) |
| `OPENJEV_HF_MODEL` | No | HuggingFace model ID for `hf` backend |
| `ROUTING_CONFIDENCE_THRESHOLD` | No | Default: `0.6` |
| `RESOLUTION_CONFIDENCE_THRESHOLD` | No | Default: `0.5` |

If `GROQ_API_KEY` is not set, the system still runs: it uses keyword-based
routing and deterministic tools. Groq is only triggered on low-confidence cases.

---

## 8. How to Run

```bash
# Run all 15 example cases
python main.py

# Run a single example case by ID
python main.py --case CASE-001

# Run an ad-hoc case with a real Olist order ID
python main.py --order-id e481f51cbdc54678b7cc49136f2d6af7 \
               --message "My product arrived damaged and I want a refund."

# Save results to JSON
python main.py --output results.json

# Enable verbose debug logging
python main.py --debug

# Run the test suite
pytest tests/ -v
```

---

## 9. Example Input

```json
{
  "case_id": "CASE-001",
  "order_id": "e481f51cbdc54678b7cc49136f2d6af7",
  "customer_message": "My product arrived damaged and I want a refund."
}
```

---

## 10. Example Output

```
────────────────────────────────────────────────────────────
  Case:     CASE-001
  Order:    e481f51cbdc54678b7cc49136f2d6af7

  Message: My product arrived damaged and I want a refund.

  Route:    RETURNS
  Routing confidence: 85%  (backend: openjev_mock)

  Relevant policies:
    • [RET-09]  score=0.87  (returns.md)
    • [RET-10]  score=0.82  (returns.md)
    • [REF-09]  score=0.79  (refunds.md)
    • [RET-03]  score=0.74  (returns.md)
    • [REF-02]  score=0.71  (refunds.md)

  Tools executed:
    • get_order
    • get_order_items
    • check_return_window
    • check_return_eligibility
    • calculate_refund

  Applicable rules: RET-10, REF-05

  Resolution:  DENIED
    Damaged item reported after 7 days (3275 days since delivery).
    Denied unless exception applies (RET-20).

  Escalated:  No

  Groq used:  No

  Final confidence:  90%
────────────────────────────────────────────────────────────
```

Resolution is `DENIED` because the Olist order was delivered in 2017 and the
7-day damage report window (RET-09/RET-10) has long since expired. This is
correct and expected behaviour – the tools apply the policy accurately.

---

## 11. Known Limitations

**Olist date problem.** All Olist orders are from 2016–2018. Every return
window, damage report window, and delivery deadline will appear expired relative
to today. This is architecturally correct (the tools implement the policy
faithfully) but means most example cases result in denials or escalations based
on expired time windows.

**OpenJEV mock backend.** The `mock` backend returns synthetic probabilities
that do not reflect real language understanding. For meaningful routing, set
`OPENJEV_BACKEND=hf` and provide a HuggingFace model, or set a valid
`GROQ_API_KEY` so Groq can reclassify low-confidence routes.

**No real fraud detection.** `fraud_flag` is not present in Olist. The
escalation rules that reference it (REF-15c, PAY-12h) are implemented in policy
text but cannot be triggered from data alone.

**Single-item refund calculation.** `calculate_refund` sums all items in an
order. For partial refunds on multi-item orders the caller should filter items
first; this is left for future work.

**No persistent case storage.** Cases are processed in memory only. There is no
database or ledger, so REF-13 (duplicate refund prevention) cannot be enforced
across sessions.

**Cactus Needle model not downloaded.** The `@needle.tool` decorator registers
functions for Needle's tool-calling interface. In this MVP the tools are called
directly by the agent code rather than through Needle's on-device inference
engine, which would require downloading the `.cact` model binary. The
integration point is correctly structured so that switching to full Needle
inference requires only replacing the direct function calls with
`_needle_agent.run(query)`.

---

## 12. Future Work

- Use Cactus Needle's on-device inference engine for tool selection rather than
  calling tools directly by name.
- Add a real-time data source or a date-offset parameter to make example cases
  resolve as approvals rather than expired-window denials.
- Implement persistent case storage (SQLite) for duplicate-refund prevention
  (REF-13) and return frequency checks (RET-18).
- Add fraud-flag simulation to test PAY-12h and REF-15c escalation paths.
- Calibrate OpenJEV routing with labelled examples once the HF backend is
  enabled.
- Add streaming output for long-running cases.
- Extend to seller-side exceptions (late shipment, inventory issues).
