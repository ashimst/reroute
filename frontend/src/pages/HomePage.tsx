import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Bot,
  Brain,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cloud,
  Cpu,
  Database,
  ExternalLink,
  Flame,
  KeyRound,
  Layers,
  Lock,
  MessageSquare,
  Play,
  RotateCcw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Store,
  Terminal,
  Zap,
} from 'lucide-react'
import { cn } from '../lib/utils'

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-24 py-6 md:py-12">
      {/* ── 1. HERO SECTION ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden text-center space-y-8 max-w-5xl mx-auto px-4">
        {/* Glow ambient background in obsidian mode */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-tr from-[#FF5500]/10 via-amber-500/5 to-transparent blur-3xl -z-10 pointer-events-none rounded-full" />

        {/* Narrative Super-heading Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#DCDCD4] dark:border-[#262930] bg-white/80 dark:bg-[#131519]/80 backdrop-blur text-xs font-mono text-stone-600 dark:text-stone-300 shadow-sm"
        >
          <span className="flex h-2 w-2 rounded-full bg-[#FF5500] animate-pulse" />
          <span className="font-semibold text-stone-900 dark:text-white uppercase tracking-wider text-[10px]">
            NOESIS FRAMEWORKS &bull; OPEN-SOURCE REFERENCE ARCHITECTURE
          </span>
          <span className="text-stone-300 dark:text-stone-700">&bull;</span>
          <a
            href="https://noesisframeworks.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#FF5500] flex items-center gap-1 transition-colors text-[11px]"
          >
            <span>noesisframeworks.com</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </motion.div>

        {/* Hero Title & Sub-headline */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-[#0B0C0E] dark:text-[#F4F4F0] leading-[1.1] max-w-4xl mx-auto">
            Autonomous Retail Exception Routing. Deterministic First. LLM Second.
          </h1>
          <p className="text-base sm:text-lg text-stone-600 dark:text-stone-300 max-w-3xl mx-auto font-normal leading-relaxed">
            Stop letting generative AI hallucinate refund math. REROUTE resolves 80%+ of returns, delivery claims, and SLA exceptions in <strong className="font-semibold text-[#FF5500]">&lt;50ms at $0 LLM cost</strong> using deterministic tool execution (System 1)—falling back to Groq LLM reasoning (System 2) only on ambiguous edge cases.
          </p>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap items-center justify-center gap-3 pt-2"
        >
          <Link
            to="/demo?tab=studio"
            className="btn-primary py-3 px-6 text-sm font-semibold rounded-xl shadow-lg shadow-orange-500/20 flex items-center gap-2 group"
          >
            <Play className="h-4 w-4 fill-white" />
            <span>Launch Live Exception Studio &rarr;</span>
          </Link>

          <Link
            to="/info"
            className="btn-secondary py-3 px-5 text-sm font-semibold rounded-xl flex items-center gap-2 border-[#DCDCD4] dark:border-[#262930]"
          >
            <Database className="h-4 w-4 text-[#FF5500]" />
            <span>Explore Architecture &amp; 99k Dataset &rarr;</span>
          </Link>

          <Link
            to="/deploy"
            className="btn-ghost py-3 px-4 text-xs font-mono text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white"
          >
            Self-Host / VPC Deploy &rarr;
          </Link>
        </motion.div>

        {/* Dual-Process Interactive Comparison Strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left pt-6 max-w-4xl mx-auto"
        >
          {/* S1 Reflex Card */}
          <div className="card p-5 relative overflow-hidden group hover:border-[#FF5500]/50 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-orange-500/10 text-[#FF5500] flex items-center justify-center font-bold font-mono text-xs">
                  S1
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-white">System-1 Fast Reflex</h3>
                  <span className="text-[10px] font-mono text-stone-400">Instinctive Execution</span>
                </div>
              </div>
              <span className="text-[11px] font-mono font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                &lt; 2ms &bull; $0.00
              </span>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed mb-3">
              Centroid clustering + Cactus Needle deterministic tools evaluate clear orders instantly with zero LLM API calls and mathematical certainty.
            </p>
            <div className="flex flex-wrap gap-1.5 text-[10px] font-mono text-stone-500 dark:text-stone-400">
              <span className="px-2 py-0.5 rounded bg-stone-100 dark:bg-[#1A1D23] border border-stone-200 dark:border-stone-800">
                0 Hallucinations
              </span>
              <span className="px-2 py-0.5 rounded bg-stone-100 dark:bg-[#1A1D23] border border-stone-200 dark:border-stone-800">
                Deterministic StateGraph
              </span>
              <span className="px-2 py-0.5 rounded bg-stone-100 dark:bg-[#1A1D23] border border-stone-200 dark:border-stone-800">
                Olist Order Dataset
              </span>
            </div>
          </div>

          {/* S2 Reasoner Card */}
          <div className="card p-5 relative overflow-hidden group hover:border-[#FF5500]/50 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold font-mono text-xs">
                  S2
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-white">System-2 Deliberative Reasoner</h3>
                  <span className="text-[10px] font-mono text-stone-400">Policy RAG &amp; Reflection</span>
                </div>
              </div>
              <span className="text-[11px] font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded">
                ~150ms &bull; BYOK Ready
              </span>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed mb-3">
              Activated when confidence drops below 0.50. Queries vector embeddings of your store policies to craft an empathetic, grounded legal resolution.
            </p>
            <div className="flex flex-wrap gap-1.5 text-[10px] font-mono text-stone-500 dark:text-stone-400">
              <span className="px-2 py-0.5 rounded bg-stone-100 dark:bg-[#1A1D23] border border-stone-200 dark:border-stone-800">
                FAISS Vector Citations
              </span>
              <span className="px-2 py-0.5 rounded bg-stone-100 dark:bg-[#1A1D23] border border-stone-200 dark:border-stone-800">
                Groq LPU / OpenAI / Claude
              </span>
              <span className="px-2 py-0.5 rounded bg-stone-100 dark:bg-[#1A1D23] border border-stone-200 dark:border-stone-800">
                Financial Safeguards
              </span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── 2. WHAT IS REROUTE & WHY TRADITIONAL CHATBOTS FAIL ──────────────── */}
      <section className="max-w-5xl mx-auto px-4 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#FF5500]">The Problem With Generic LLM Chatbots</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white">
            Retail Exception Resolution Requires Deterministic Governance
          </h2>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 max-w-xl mx-auto">
            Generic chatbots hallucinate policies, grant unauthorized R$ 1,000+ refunds, and suffer 2+ second latency per turn.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card p-6 space-y-3">
            <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-stone-900 dark:text-white">Financial Drift &amp; Leakage</h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              Without deterministic state checks, prompt-injected or polite customers persuade standard LLMs to issue cash refunds contrary to return window rules.
            </p>
          </div>

          <div className="card p-6 space-y-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-stone-900 dark:text-white">Sluggish 2-Second Delays</h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              Calling a 70B parameter model just to check if a package is marked &apos;delivered&apos; costs dollars and wastes precious customer seconds.
            </p>
          </div>

          <div className="card p-6 space-y-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Scale className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-stone-900 dark:text-white">REROUTE State Machine</h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              LangGraph StateGraph guarantees that mathematical conditions (days elapsed, refund caps, carrier tracking) execute in code before the LLM speaks.
            </p>
          </div>
        </div>
      </section>

      {/* ── 3. OPEN CORE ARCHITECTURE & CLOUD ROADMAP ──────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#FF5500]">Deployment Models</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white">
            Self-Host Open Core Today or Scale with Managed Cloud
          </h2>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 max-w-xl mx-auto">
            REROUTE is built on an open-core foundation that can run entirely on local enterprise hardware with zero vendor lock-in.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Open-Source Self-Hosting Card */}
          <div className="card p-6 space-y-6 relative flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-stone-900 dark:text-white">Self-Hosted Open Core</h3>
                  <span className="text-xs text-stone-500">Run locally on your infrastructure</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full">
                    Available Now
                  </span>
                </div>
              </div>

              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                Deploy the complete dual-process cognitive pipeline with Docker Compose. Perfect for brands requiring strict data residency, air-gapped security, and zero cloud API dependency.
              </p>

              <ul className="space-y-2.5 text-xs text-stone-600 dark:text-stone-300">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Sub-2ms System-1 Centroid fast reflex tools</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Full in-memory FAISS policy vector search</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Local SQLite database with real order records</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Bring-Your-Own-LLM: Ollama, Groq, or OpenAI</span>
                </li>
              </ul>
            </div>

            <Link
              to="/demo"
              className="w-full btn-secondary py-2.5 text-xs font-semibold justify-center"
            >
              <span>Test in Live Sandbox</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Managed Cloud Platform Card */}
          <div className="card p-6 space-y-6 relative flex flex-col justify-between border-[#FF5500]/40 shadow-xl shadow-orange-500/5">
            <div className="absolute -top-3 right-6 bg-[#FF5500] text-white text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
              In Development
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-stone-900 dark:text-white">Managed Cloud Platform</h3>
                  <span className="text-xs text-stone-500">Zero-ops multi-store federation</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold uppercase text-orange-600 bg-orange-50 dark:bg-orange-950/40 px-2.5 py-1 rounded-full">
                    Coming Soon
                  </span>
                </div>
              </div>

              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                Managed multi-tenant hosting with automated Shopify &amp; WooCommerce webhooks, distributed vector sharding, and real-time compliance telemetry dashboards.
              </p>

              <ul className="space-y-2.5 text-xs text-stone-600 dark:text-stone-300">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Instant Shopify &amp; ERP webhook connectors</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Automated multi-store policy indexing</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Cross-store compliance &amp; refund leakage metrics</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Managed edge SLA with zero maintenance overhead</span>
                </li>
              </ul>
            </div>

            <Link
              to="/deploy"
              className="w-full btn-primary py-2.5 text-xs font-semibold justify-center shadow-md shadow-orange-500/20"
            >
              <span>View Cloud Roadmap &amp; Waitlist</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 4. QUICK TEST SANDBOX LAUNCHER ──────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 card p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-5">
          <div>
            <h3 className="text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Terminal className="h-5 w-5 text-[#FF5500]" />
              <span>Interactive Exception Sandbox</span>
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
              Select any pre-configured exception scenario to see the live state-graph route, policy citations, and refund verdict.
            </p>
          </div>
          <Link to="/demo" className="btn-secondary text-xs self-start md:self-auto">
            Open Full Cockpit &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            to="/demo?scenario=damaged"
            className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-[#FF5500] dark:hover:border-[#FF5500] transition-colors group block bg-[#F4F4F0]/50 dark:bg-[#0B0C0E]/50"
          >
            <span className="text-[10px] font-mono font-bold text-[#FF5500] uppercase block mb-1">Scenario 01 &bull; Returns</span>
            <h4 className="text-xs font-bold text-stone-900 dark:text-white group-hover:text-[#FF5500] transition-colors">
              Smashed Fragile Clock (Order #949d5b44)
            </h4>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 line-clamp-2">
              Customer received clock shattered in box. Evaluates RET-04 damaged goods policy.
            </p>
          </Link>

          <Link
            to="/demo?scenario=late"
            className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-[#FF5500] dark:hover:border-[#FF5500] transition-colors group block bg-[#F4F4F0]/50 dark:bg-[#0B0C0E]/50"
          >
            <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase block mb-1">Scenario 02 &bull; Delivery</span>
            <h4 className="text-xs font-bold text-stone-900 dark:text-white group-hover:text-emerald-500 transition-colors">
              Package Delayed 14+ Days (Order #ad850e64)
            </h4>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 line-clamp-2">
              Carrier in transit past estimated delivery date. Triggers DEL-03 delay compensation.
            </p>
          </Link>

          <Link
            to="/demo?scenario=expensive"
            className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-[#FF5500] dark:hover:border-[#FF5500] transition-colors group block bg-[#F4F4F0]/50 dark:bg-[#0B0C0E]/50"
          >
            <span className="text-[10px] font-mono font-bold text-blue-600 uppercase block mb-1">Scenario 03 &bull; Escalation</span>
            <h4 className="text-xs font-bold text-stone-900 dark:text-white group-hover:text-blue-500 transition-colors">
              High Value R$ 1,200 Watch (Order #c5973909)
            </h4>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 line-clamp-2">
              Exceeds the R$ 500 automatic refund threshold. System-2 flags for human supervisor review.
            </p>
          </Link>
        </div>
      </section>
    </div>
  )
}
