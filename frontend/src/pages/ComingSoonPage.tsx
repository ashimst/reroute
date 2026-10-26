import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Server,
  Cloud,
  Terminal,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Zap,
  Lock,
  GitFork,
  Layers,
  Copy,
  Check,
  Building2,
  ExternalLink,
  Code2,
  Cpu,
  Mail,
  CheckSquare,
} from 'lucide-react'

export default function ComingSoonPage() {
  const [copiedDocker, setCopiedDocker] = useState(false)
  const [copiedAdapter, setCopiedAdapter] = useState(false)
  const [pocSubmitted, setPocSubmitted] = useState(false)
  const [pocEmail, setPocEmail] = useState('')
  const [pocCompany, setPocCompany] = useState('')
  const [pocOrders, setPocOrders] = useState('10k - 50k')

  const dockerCommands = `# 1. Clone the open-source repository
git clone https://github.com/ashimst/reroute.git
cd reroute

# 2. Configure environment (Groq key optional for System 2 fallback)
cp .env.example .env

# 3. Launch full stack via Docker Compose (FastAPI + React + FAISS + Cactus Needle)
docker compose up -d --build

# 4. Access Interactive Sandbox at http://localhost:5173
#    API Documentation available at http://localhost:8000/docs`

  const adapterSnippet = `from backend.adapters.base import (
    BaseCommerceAdapter, OrderContext, CustomerHistory,
    ResolutionDecision, ExecutionReceipt
)

class InternalPostgresOrShopifyAdapter(BaseCommerceAdapter):
    """Plug your store or warehouse DB into REROUTE in < 50 lines."""
    
    def get_order_context(self, order_id: str) -> OrderContext:
        raw = db.execute("SELECT * FROM orders WHERE id = :id", {"id": order_id}).fetchone()
        return OrderContext(
            order_id=raw["id"],
            order_status=raw["status"],
            purchase_date=raw["created_at"],
            delivery_date=raw["delivered_at"],
            total_amount=raw["total"],
            freight_amount=raw["freight"]
        )

    def execute_resolution(self, order_id: str, decision: ResolutionDecision) -> ExecutionReceipt:
        # Direct ERP settlement or Shopify refund webhook trigger
        receipt_id = payment_gateway.issue_refund(order_id, decision.refund_amount)
        return ExecutionReceipt(success=True, transaction_id=receipt_id, fee_reimbursed=decision.refund_amount)`

  const handleCopyDocker = () => {
    navigator.clipboard.writeText(dockerCommands)
    setCopiedDocker(true)
    setTimeout(() => setCopiedDocker(false), 2000)
  }

  const handleCopyAdapter = () => {
    navigator.clipboard.writeText(adapterSnippet)
    setCopiedAdapter(true)
    setTimeout(() => setCopiedAdapter(false), 2000)
  }

  const [mailtoGenerated, setMailtoGenerated] = useState<string>('')

  const handlePocSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!pocEmail || !pocEmail.includes('@')) return

    const subject = encodeURIComponent(`[REROUTE VPC PoC Request] Architecture Review - ${pocCompany.trim() || 'Enterprise Brand'}`)
    const body = encodeURIComponent(
      `Hello Noesis Frameworks Architecture Team,\n\n` +
      `We would like to request an Enterprise Private Cloud / VPC Architecture Review & Custom PoC for REROUTE.\n\n` +
      `Company / Brand: ${pocCompany.trim()}\n` +
      `Monthly Order Volume: ${pocOrders}\n` +
      `Contact Email: ${pocEmail.trim()}\n\n` +
      `Key Interests:\n` +
      `- Zero Data Egress VPC Deployment (AWS / GCP / Azure)\n` +
      `- Custom Cactus Needle Deterministic Financial Tools\n` +
      `- ERP / WMS / Helpdesk Connector Integration\n\n` +
      `Best regards,\n${pocEmail.trim()}\n`
    )
    const mailtoUrl = `mailto:contact@noesisframeworks.com?subject=${subject}&body=${body}`
    setMailtoGenerated(mailtoUrl)

    try {
      const pocs = JSON.parse(localStorage.getItem('reroute_poc_requests') || '[]')
      pocs.push({ email: pocEmail, company: pocCompany, orders: pocOrders, timestamp: new Date().toISOString() })
      localStorage.setItem('reroute_poc_requests', JSON.stringify(pocs))

      // Also attempt Web3Forms background dispatch if configured or online
      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_key: 'REROUTE-VPC-POC-REQUEST',
          email: pocEmail,
          company: pocCompany,
          volume: pocOrders,
          source: 'https://reroute.noesisframeworks.com/deploy',
        }),
      }).catch(() => {})
    } catch {
      // ignore
    }

    // Trigger user's mail client with prefilled details
    window.location.href = mailtoUrl
    setPocSubmitted(true)
  }

  return (
    <div className="max-w-6xl mx-auto py-8 sm:py-12 px-4 space-y-16">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-center space-y-4 max-w-3xl mx-auto"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3.5 py-1 text-xs font-mono font-semibold text-[#FF5500]">
          <span className="h-2 w-2 rounded-full bg-[#FF5500] animate-pulse" />
          <span>NOESIS FRAMEWORKS &bull; DEPLOYMENT &amp; ARCHITECTURAL ENGAGEMENT</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-stone-900 dark:text-white leading-[1.1]">
          Self-Host Open Core or Deploy in Your Private Cloud (VPC)
        </h1>

        <p className="text-sm sm:text-base text-stone-600 dark:text-stone-300 leading-relaxed">
          From a 5-minute single-node Docker setup for local developer sandboxes to enterprise-grade, air-gapped private cloud deployments inside your AWS/GCP/Azure VPC.
        </p>
      </motion.div>

      {/* ── Two-Track Technical Deployment Grid ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* ── Track 1: Open-Source Self-Hosting ─────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="card p-6 sm:p-8 space-y-6 border-stone-200 dark:border-stone-800"
        >
          <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-4">
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase font-bold text-emerald-600 dark:text-emerald-400">
                TRACK 1 &bull; DEVELOPER &amp; STARTUP
              </span>
              <h2 className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <Server className="h-5 w-5 text-emerald-500" />
                <span>Open-Source Self-Hosting</span>
              </h2>
            </div>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
              Free &bull; 100% Open
            </span>
          </div>

          <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
            Run the entire REROUTE engine locally or on your own VPS. Complete with the FAISS vector database, OpenJEV classifier, and Cactus Needle deterministic math tools.
          </p>

          {/* Docker Terminal Snippet */}
          <div className="space-y-2">
            <div className="flex items-center justify-between font-mono text-[11px] text-stone-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-[#FF5500]" />
                <span>5-Minute Quickstart (Docker Compose)</span>
              </span>
              <button
                type="button"
                onClick={handleCopyDocker}
                className="text-stone-500 hover:text-stone-900 dark:hover:text-white flex items-center gap-1"
              >
                {copiedDocker ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                <span>{copiedDocker ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="rounded-xl bg-[#0B0C0E] border border-stone-800 p-3.5 font-mono text-[11px] text-emerald-400 overflow-x-auto shadow-inner leading-relaxed">
              <pre>{dockerCommands}</pre>
            </div>
          </div>

          {/* Adapter Pattern Highlights */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between font-mono text-[11px] text-stone-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Code2 className="h-3.5 w-3.5 text-[#FF5500]" />
                <span>Pluggable Adapter Pattern (<code className="text-[#FF5500]">base.py</code>)</span>
              </span>
              <button
                type="button"
                onClick={handleCopyAdapter}
                className="text-stone-500 hover:text-stone-900 dark:hover:text-white flex items-center gap-1"
              >
                {copiedAdapter ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                <span>{copiedAdapter ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="rounded-xl bg-[#0B0C0E] border border-stone-800 p-3.5 font-mono text-[11px] text-stone-300 overflow-x-auto shadow-inner leading-relaxed">
              <pre>{adapterSnippet}</pre>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-slate-400 leading-relaxed pt-1">
              Swap Olist for Shopify, BigCommerce, or internal Postgres in under 50 lines. Add custom store policies by dropping <code className="font-mono text-stone-800 dark:text-stone-200">/policies/*.md</code> files.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <a
              href="https://github.com/ashimst/reroute"
              target="_blank"
              rel="noreferrer"
              className="btn-primary py-2.5 px-4 text-xs font-semibold flex items-center gap-1.5"
            >
              <GitFork className="h-4 w-4" />
              <span>Clone on GitHub</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            <Link to="/demo?tab=studio" className="btn-secondary py-2.5 px-4 text-xs font-semibold">
              <span>Open Studio Sandbox &rarr;</span>
            </Link>
          </div>
        </motion.div>

        {/* ── Track 2: Enterprise Private Cloud / VPC Deployment ────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="card p-6 sm:p-8 space-y-6 border-orange-500/30 bg-gradient-to-b from-[#FAF9F5] to-orange-500/[0.02] dark:from-[#131519] dark:to-orange-500/[0.03] shadow-md relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-44 h-44 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-4">
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase font-bold text-[#FF5500]">
                TRACK 2 &bull; HIGH-VELOCITY MERCHANTS (10K+ ORDERS/MO)
              </span>
              <h2 className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <Building2 className="h-5 w-5 text-[#FF5500]" />
                <span>Enterprise Private Cloud / VPC</span>
              </h2>
            </div>
            <span className="rounded-full bg-orange-500/10 border border-orange-500/25 px-2.5 py-1 font-mono text-xs font-bold text-[#FF5500]">
              Noesis Consulting PoC
            </span>
          </div>

          <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
            Engineered by <strong>Noesis Frameworks</strong> for brands processing 10k+ monthly orders that require zero data egress, custom financial safeguards, and custom ERP/WMS connectors.
          </p>

          {/* VPC Architecture Advantages */}
          <div className="space-y-3 font-mono text-xs">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/80 dark:bg-[#181B21]/80 border border-stone-200 dark:border-stone-800">
              <Lock className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-stone-900 dark:text-white block font-sans">Zero Data Egress (BYOC / VPC)</span>
                <span className="text-[11px] text-stone-500 dark:text-stone-400 font-sans">
                  Deploy completely inside your AWS, GCP, or Azure VPC. Customer PII and order totals never leave your firewall.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/80 dark:bg-[#181B21]/80 border border-stone-200 dark:border-stone-800">
              <Zap className="h-4 w-4 text-[#FF5500] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-stone-900 dark:text-white block font-sans">Custom Cactus Needle Financial Calculators</span>
                <span className="text-[11px] text-stone-500 dark:text-stone-400 font-sans">
                  Tailored freight refund formulas, vendor chargeback recovery, and strict financial refund budget caps.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/80 dark:bg-[#181B21]/80 border border-stone-200 dark:border-stone-800">
              <Layers className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-stone-900 dark:text-white block font-sans">ERP, WMS &amp; Zendesk/Gorgias Integration</span>
                <span className="text-[11px] text-stone-500 dark:text-stone-400 font-sans">
                  Bi-directional synchronization with SAP, NetSuite, ShipStation, and helpdesk ticketing queues.
                </span>
              </div>
            </div>
          </div>

          {/* Contact / Consultation Form */}
          <div className="border-t border-stone-200 dark:border-stone-800 pt-4">
            {pocSubmitted ? (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/30 p-5 text-center space-y-3">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">Architecture Request Dispatched</h4>
                <p className="text-xs text-stone-600 dark:text-stone-400">
                  A pre-filled consultation request has been prepared for <strong className="text-stone-900 dark:text-white">{pocEmail}</strong> ({pocCompany || 'Enterprise'} &bull; {pocOrders}).
                </p>
                <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                  {mailtoGenerated && (
                    <a
                      href={mailtoGenerated}
                      className="btn-primary py-2 px-3 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span>Open Pre-Filled Email</span>
                    </a>
                  )}
                  <a
                    href="mailto:contact@noesisframeworks.com"
                    className="btn-secondary py-2 px-3 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <span>contact@noesisframeworks.com</span>
                  </a>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePocSubmit} className="space-y-3">
                <span className="text-xs font-bold text-stone-900 dark:text-white block">
                  Request Architecture Review / Custom VPC PoC
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="email"
                    required
                    value={pocEmail}
                    onChange={(e) => setPocEmail(e.target.value)}
                    placeholder="vp.ops@brand.com"
                    className="input text-xs"
                  />
                  <input
                    type="text"
                    required
                    value={pocCompany}
                    onChange={(e) => setPocCompany(e.target.value)}
                    placeholder="Company / Brand Name"
                    className="input text-xs"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <select
                    value={pocOrders}
                    onChange={(e) => setPocOrders(e.target.value)}
                    className="input text-xs cursor-pointer"
                  >
                    <option value="10k - 50k">10k – 50k monthly orders</option>
                    <option value="50k - 200k">50k – 200k monthly orders</option>
                    <option value="200k+">200k+ monthly orders</option>
                  </select>
                  <button
                    type="submit"
                    className="btn-primary py-2.5 px-4 text-xs font-semibold shrink-0 whitespace-nowrap"
                  >
                    <span>Request Review &rarr;</span>
                  </button>
                </div>
                <p className="text-[10px] font-mono text-stone-400 text-center sm:text-left">
                  Direct consultation with Noesis Frameworks engineering team &bull; Zero vendor lock-in.
                </p>
              </form>
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Enterprise Comparison Matrix ────────────────────────────────────── */}
      <div className="card p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-1">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#FF5500]">
            Feature Comparison
          </span>
          <h3 className="text-xl font-bold text-stone-900 dark:text-white">
            Open-Source Core vs. Enterprise Private Cloud
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-800 text-[10px] uppercase text-stone-500">
                <th className="py-2.5 px-4">Capability</th>
                <th className="py-2.5 px-4">Track 1: Open Core (Docker)</th>
                <th className="py-2.5 px-4 text-stone-900 dark:text-white font-bold">Track 2: Private Cloud (Noesis VPC)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 dark:divide-stone-800 text-[11px]">
              <tr>
                <td className="py-3 px-4 font-sans font-medium text-stone-900 dark:text-white">Dual-Process StateGraph Core</td>
                <td className="py-3 px-4 text-emerald-600 font-bold">Included (MIT)</td>
                <td className="py-3 px-4 text-emerald-600 font-bold">Included + High-Availability Clustering</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-sans font-medium text-stone-900 dark:text-white">Data Privacy &amp; Egress</td>
                <td className="py-3 px-4 text-stone-600 dark:text-stone-300">Self-managed server</td>
                <td className="py-3 px-4 text-emerald-600 font-bold">Air-gapped VPC (Zero data egress)</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-sans font-medium text-stone-900 dark:text-white">Commerce Adapters</td>
                <td className="py-3 px-4 text-stone-600 dark:text-stone-300">BaseCommerceAdapter Python class</td>
                <td className="py-3 px-4 text-emerald-600 font-bold">Turnkey Shopify, SAP, NetSuite, Gorgias</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-sans font-medium text-stone-900 dark:text-white">Inference Costs</td>
                <td className="py-3 px-4 text-stone-600 dark:text-stone-300">$0 S1 / BYOK Groq API</td>
                <td className="py-3 px-4 text-emerald-600 font-bold">Private LPU / Local Quantized vLLM cluster</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-sans font-medium text-stone-900 dark:text-white">Financial Guardrails &amp; SLAs</td>
                <td className="py-3 px-4 text-stone-600 dark:text-stone-300">Default policy limits</td>
                <td className="py-3 px-4 text-emerald-600 font-bold">Custom multi-department fraud &amp; audit rules</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
