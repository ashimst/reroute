import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Cloud,
  Terminal,
  CheckCircle2,
  Bell,
  ArrowRight,
  ShieldCheck,
  Server,
  Zap,
  Lock,
  GitFork,
  Layers,
  Copy,
  Check,
} from 'lucide-react'

export default function ComingSoonPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [copied, setCopied] = useState(false)

  const dockerCommand = `# Clone the open-source repository
git clone https://github.com/ashimst/reroute.git
cd reroute

# Launch full stack locally (FastAPI + React + FAISS + Centroid Router)
docker-compose up -d --build

# Open browser at http://localhost:5173`

  const handleCopy = () => {
    navigator.clipboard.writeText(dockerCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleNotify = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !email.includes('@')) return
    try {
      const waitlist = JSON.parse(localStorage.getItem('rf_waitlist') || '[]')
      waitlist.push({ email, timestamp: new Date().toISOString() })
      localStorage.setItem('rf_waitlist', JSON.stringify(waitlist))
    } catch {
      // ignore
    }
    setSubmitted(true)
  }

  return (
    <div className="max-w-5xl mx-auto py-8 sm:py-12 px-4 space-y-12">
      {/* ── Hero Announcement Header ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-center space-y-4 max-w-2xl mx-auto"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3.5 py-1 text-xs font-mono font-semibold text-[#FF5500]">
          <span className="h-2 w-2 rounded-full bg-[#FF5500] animate-pulse" />
          <span>COMING SOON &bull; MANAGED CLOUD ENGINE</span>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-stone-900 dark:text-white leading-[1.1]">
          Cloud Platform &amp; Multi-Store Federation
        </h1>

        <p className="text-sm sm:text-base text-stone-600 dark:text-stone-300 leading-relaxed">
          We are engineering the managed cloud infrastructure to bring zero-latency deterministic exception adjudication, multi-tenant Shopify webhooks, and federated policy indexing directly to your brand without hosting overhead.
        </p>
      </motion.div>

      {/* ── Waitlist / Notification Card ───────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="card p-6 sm:p-8 max-w-xl mx-auto border-stone-200 dark:border-white/[0.08] shadow-md relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-40 h-40 bg-orange-500/10 rounded-full blur-2xl pointer-events-none" />

        {submitted ? (
          <div className="text-center py-6 space-y-3">
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-stone-900 dark:text-white">You are on the priority waitlist!</h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 max-w-sm mx-auto">
              We will notify <strong className="text-stone-900 dark:text-white">{email}</strong> as soon as cloud instances and managed tenant provisioning open for early access.
            </p>
          </div>
        ) : (
          <form onSubmit={handleNotify} className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-[#FF5500]/10 text-[#FF5500] flex items-center justify-center shrink-0">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900 dark:text-white">Request Early Access Notification</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">Be first in line when cloud instances and managed Shopify connectors go live.</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@yourcompany.com"
                className="input-field flex-1 py-2.5 px-3.5 text-xs sm:text-sm bg-[#FAF9F5] dark:bg-[#0E111A] border-stone-200 dark:border-stone-800"
              />
              <button
                type="submit"
                className="btn-primary py-2.5 px-5 text-xs sm:text-sm font-semibold justify-center whitespace-nowrap"
              >
                <span>Notify Me</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-stone-400 font-mono text-center sm:text-left">
              Zero marketing spam. Only engineering status updates and beta invites.
            </p>
          </form>
        )}
      </motion.div>

      {/* ── What to Expect in Cloud ────────────────────────────────────────── */}
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="text-center space-y-1">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#FF5500]">
            Roadmap &bull; In Development
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white">
            Upcoming Cloud Architecture Highlights
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-5 space-y-3">
            <div className="h-9 w-9 rounded-lg bg-orange-500/10 text-[#FF5500] flex items-center justify-center">
              <Cloud className="h-4.5 w-4.5" />
            </div>
            <h3 className="text-sm font-bold text-stone-900 dark:text-white">Managed Multi-Tenancy</h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              Isolated FAISS index vectors and deterministic StateGraph runtimes per brand, with automated SSL edge proxying.
            </p>
          </div>

          <div className="card p-5 space-y-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Zap className="h-4.5 w-4.5" />
            </div>
            <h3 className="text-sm font-bold text-stone-900 dark:text-white">Instant Webhook Ingestion</h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              Pre-configured webhooks for Shopify, BigCommerce, and custom ERPs with sub-5ms automated return authorization.
            </p>
          </div>

          <div className="card p-5 space-y-3">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
            <h3 className="text-sm font-bold text-stone-900 dark:text-white">Compliance &amp; Financial Guardrails</h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              Enforce strict corporate refund budgets, carrier verification rules, and automated human supervisor escalation queues.
            </p>
          </div>
        </div>
      </div>

      {/* ── Open-Core Self-Hosting Available Today ─────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="card p-6 sm:p-8 max-w-4xl mx-auto space-y-6 border-stone-200 dark:border-white/[0.08]"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-[#FF5500]" />
              <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white">
                Self-Host REROUTE Open Core Today
              </h2>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              You do not need to wait for cloud hosting. The complete dual-process adjudication engine is 100% open source.
            </p>
          </div>

          <button
            onClick={handleCopy}
            className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 self-start sm:self-auto shrink-0"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Docker Snippet'}</span>
          </button>
        </div>

        <div className="rounded-xl bg-[#0B0C0E] border border-stone-800 p-4 font-mono text-xs text-emerald-400 overflow-x-auto shadow-inner leading-relaxed">
          <pre>{dockerCommand}</pre>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-3 text-xs text-stone-500 dark:text-stone-400">
            <span className="flex items-center gap-1">
              <Lock className="h-3.5 w-3.5 text-emerald-500" />
              <span>100% Air-Gapped Capable</span>
            </span>
            <span>&bull;</span>
            <span className="flex items-center gap-1">
              <GitFork className="h-3.5 w-3.5 text-amber-500" />
              <span>Zero External Vector Lock-In</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="https://github.com/ashimst/reroute"
              target="_blank"
              rel="noreferrer"
              className="btn-secondary py-2 px-4 text-xs font-semibold flex items-center gap-1.5"
            >
              <GitFork className="h-3.5 w-3.5 text-[#FF5500]" />
              <span>GitHub Repository</span>
            </a>
            <Link to="/demo" className="btn-primary py-2 px-4 text-xs font-semibold">
              <span>Test Demo Sandbox</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
            <Link to="/info" className="btn-secondary py-2 px-4 text-xs font-semibold">
              <span>Architecture Specs</span>
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
