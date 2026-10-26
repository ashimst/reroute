import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { submitCase, fetchOrder, type CaseRequest, type CaseResponse } from '../lib/api'
import { saveToHistory, cn } from '../lib/utils'
import CaseForm from '../components/CaseForm'
import ResolutionCard from '../components/ResolutionCard'
import OrderCard from '../components/OrderCard'
import {
  Cpu,
  GitFork,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  KeyRound,
  FileText,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Zap,
} from 'lucide-react'

const ACTIVE_RULES = [
  { id: 'RET-01', cat: 'Returns', title: 'Statutory 7-Day Withdrawal', desc: 'CDC Art. 49: Full refund within 7 days of delivery.' },
  { id: 'RET-02', cat: 'Returns', title: 'Expired Return Window', desc: 'Returns > 7 days denied unless item arrives damaged/defective.' },
  { id: 'RET-04', cat: 'Returns', title: 'Damaged in Transit', desc: 'Photos required; automatic replacement or full reimbursement authorized.' },
  { id: 'DEL-03', cat: 'Delivery', title: 'Carrier Delayed In-Transit', desc: 'Tracking active past estimated date; auto-dispatches carrier trace.' },
  { id: 'DEL-08', cat: 'Delivery', title: 'Lost in Transit / Breach', desc: 'Undelivered > 14 days past EDD triggers automatic full reimbursement.' },
  { id: 'DEL-09', cat: 'Delivery', title: 'Carrier SLA Freight Refund', desc: 'Delivered after EDD; automatically reimburses full shipping freight.' },
  { id: 'PAY-01', cat: 'Payment', title: 'Double Charge Dispute', desc: 'Duplicate authorization; credits duplicate charge directly.' },
  { id: 'PAY-08', cat: 'Payment', title: 'Fraud & Unauthorized Charge', desc: 'Escalates immediately to human anti-fraud compliance team.' },
]

export default function SubmitPage() {
  const [searchParams] = useSearchParams()
  const initialOrderId = searchParams.get('order_id') || ''

  const [result, setResult] = useState<CaseResponse | null>(null)
  const [orderId, setOrderId] = useState<string | null>(initialOrderId || null)

  // Engine Tuning State
  const [configOpen, setConfigOpen] = useState(false)
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.80)
  const [byokApiKey, setByokApiKey] = useState<string>(() => {
    return localStorage.getItem('reroute_byok_groq') || ''
  })
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null)

  useEffect(() => {
    if (byokApiKey) {
      localStorage.setItem('reroute_byok_groq', byokApiKey)
    }
  }, [byokApiKey])

  const mutation = useMutation({
    mutationFn: submitCase,
    onSuccess: (data) => {
      setResult(data)
      setOrderId(data.order_id)
      saveToHistory(data)
    },
  })

  const orderQuery = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => fetchOrder(orderId!),
    enabled: !!orderId && orderId.length >= 8,
    staleTime: 5 * 60_000,
    retry: false,
  })

  const handleSubmit = (req: CaseRequest) => {
    setResult(null)
    setOrderId(req.order_id)
    mutation.mutate({
      ...req,
      confidence_threshold: confidenceThreshold,
      groq_api_key: byokApiKey.trim() || undefined,
    })
  }

  return (
    <div className="space-y-6">
      {/* ── Minimalist Workspace Header ───────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DCDCD4] dark:border-[#262930] pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-white flex items-center gap-2">
            <span>Exception Studio</span>
            <span className="text-stone-300 dark:text-slate-600 font-normal">/</span>
            <span className="text-xs text-stone-500 dark:text-slate-400 font-normal font-mono">Adjudication Engine</span>
          </h1>
          <p className="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
            Evaluate customer claims through the deterministic LangGraph pipeline, Cactus Needle tools, and FAISS policy retrieval.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Engine Tuning Toggle Button */}
          <button
            type="button"
            onClick={() => setConfigOpen(!configOpen)}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-mono font-medium transition-colors shadow-xs',
              configOpen
                ? 'border-[#FF5500] bg-[#FF5500]/10 text-[#FF5500]'
                : 'border-[#DCDCD4] dark:border-[#262930] bg-[#FAF9F5] dark:bg-[#181B21] text-stone-700 dark:text-slate-300 hover:border-[#FF5500]/50'
            )}
          >
            <Sliders className="h-3.5 w-3.5 text-[#FF5500]" />
            <span>Engine Tuning (Threshold: {confidenceThreshold.toFixed(2)})</span>
            {configOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          <span className="hidden md:inline-block rounded-lg bg-[#FAF9F5] dark:bg-[#181B21] border border-[#DCDCD4] dark:border-[#262930] px-3 py-1.5 text-xs font-mono text-stone-500 dark:text-slate-400">
            Engine: <strong className="text-stone-800 dark:text-slate-200 font-semibold">StateGraph v1.0</strong>
          </span>
        </div>
      </div>

      {/* ── Collapsible Engine Tuning & Policy Config Panel ────────────── */}
      <AnimatePresence>
        {configOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-stone-300 dark:border-stone-800 bg-[#FAF9F5] dark:bg-[#131519] p-5 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-stone-200 dark:border-stone-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-[#FF5500]" />
                  <h3 className="text-sm font-bold text-stone-900 dark:text-white">
                    Engine Tuning &amp; Dual-Process Routing Controls
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-stone-500 dark:text-stone-400">
                  Zero-auth browser session configuration
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Threshold Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-stone-800 dark:text-slate-200">
                      System 1 Confidence Threshold
                    </label>
                    <span className="font-mono text-xs font-bold text-[#FF5500] bg-orange-500/10 px-2 py-0.5 rounded">
                      {confidenceThreshold.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.50"
                    max="0.95"
                    step="0.05"
                    value={confidenceThreshold}
                    onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                    className="w-full accent-[#FF5500] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-stone-400">
                    <span>0.50 (Permissive S1)</span>
                    <span>0.80 (Default)</span>
                    <span>0.95 (Force S2 LLM)</span>
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-slate-400 leading-relaxed pt-1">
                    Set slider to <strong>0.95</strong> and re-run any benchmark case to watch the LangGraph router trigger <strong>System 2 Groq LLM deliberation</strong>!
                  </p>
                </div>

                {/* 2. Optional BYOK Key */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-stone-800 dark:text-slate-200 flex items-center justify-between">
                    <span>Custom Groq API Key (BYOK)</span>
                    <span className="text-[10px] font-mono text-stone-400">Optional</span>
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={byokApiKey}
                      onChange={(e) => setByokApiKey(e.target.value)}
                      placeholder="gsk_... (Defaults to sandbox Groq key)"
                      className="input text-xs font-mono pr-8"
                    />
                    <KeyRound className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 pointer-events-none" />
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-slate-400 leading-relaxed">
                    Override the backend Groq key with your own. Stored exclusively in local browser memory.
                  </p>
                </div>

                {/* 3. Active Policy Rules Inspector */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-stone-800 dark:text-slate-200 flex items-center justify-between">
                    <span>Active Store Policies ({ACTIVE_RULES.length})</span>
                    <span className="text-[10px] font-mono text-stone-400">FAISS Index</span>
                  </label>
                  <div className="h-28 overflow-y-auto space-y-1 pr-1 text-[11px] font-mono">
                    {ACTIVE_RULES.map((rule) => (
                      <div
                        key={rule.id}
                        onClick={() => setSelectedRuleId(selectedRuleId === rule.id ? null : rule.id)}
                        className={cn(
                          'p-1.5 rounded border cursor-pointer transition-colors flex items-center justify-between',
                          selectedRuleId === rule.id
                            ? 'border-[#FF5500] bg-orange-500/10 text-[#FF5500]'
                            : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-[#181B21] text-stone-700 dark:text-slate-300 hover:border-stone-400'
                        )}
                      >
                        <span className="font-bold">{rule.id}</span>
                        <span className="truncate max-w-[140px] text-[10px] text-stone-500">{rule.title}</span>
                      </div>
                    ))}
                  </div>
                  {selectedRuleId && (
                    <div className="p-2 rounded bg-stone-100 dark:bg-stone-800 text-[10px] text-stone-700 dark:text-slate-300">
                      <strong>{ACTIVE_RULES.find((r) => r.id === selectedRuleId)?.title}:</strong>{' '}
                      {ACTIVE_RULES.find((r) => r.id === selectedRuleId)?.desc}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Balanced Two-Column Layout ──────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[420px_1fr] items-start">
        {/* Left Column: Input Form */}
        <div className="space-y-4">
          <div className="card p-5">
            <CaseForm
              onSubmit={handleSubmit}
              isLoading={mutation.isPending}
              initialOrderId={initialOrderId}
              initialMessage={searchParams.get('message') || ''}
            />
          </div>

          {/* Bound Order Preview below the form if found */}
          {orderId && orderQuery.data && !orderQuery.isError && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono text-stone-500 dark:text-slate-400 uppercase font-medium">
                Linked Olist Order Metadata
              </span>
              <OrderCard order={orderQuery.data} compact showActions={false} />
            </div>
          )}
        </div>

        {/* Right Column: Execution State or Adjudication Result */}
        <div className="min-h-[460px]">
          {/* Running State with Animated Progress */}
          {mutation.isPending && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-10 flex flex-col items-center justify-center text-center space-y-4"
            >
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#FF5500]/20 border-t-[#FF5500]" />
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-stone-900 dark:text-white">Traversing State Machine DAG</h3>
                <p className="text-xs text-stone-500 dark:text-slate-400 max-w-sm">
                  Executing OpenJEV semantic router &rarr; Cactus Needle verification tools &rarr; FAISS policy vector lookup...
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 w-full max-w-sm pt-3 text-left font-mono text-[11px]">
                <div className="rounded-lg bg-[#FAF9F5] dark:bg-[#181B21] border border-[#DCDCD4] dark:border-[#262930] p-2.5">
                  <span className="text-stone-400 dark:text-slate-500 text-[10px] block">Router</span>
                  <span className="text-[#FF5500] font-semibold animate-pulse">Classifying...</span>
                </div>
                <div className="rounded-lg bg-[#FAF9F5] dark:bg-[#181B21] border border-[#DCDCD4] dark:border-[#262930] p-2.5">
                  <span className="text-stone-400 dark:text-slate-500 text-[10px] block">Tools</span>
                  <span className="text-stone-600 dark:text-slate-400">Verifying...</span>
                </div>
                <div className="rounded-lg bg-[#FAF9F5] dark:bg-[#181B21] border border-[#DCDCD4] dark:border-[#262930] p-2.5">
                  <span className="text-stone-400 dark:text-slate-500 text-[10px] block">Policies</span>
                  <span className="text-stone-600 dark:text-slate-400">FAISS Search...</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Error State */}
          {mutation.isError && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-6 border-rose-500/30 bg-rose-50 text-rose-800 dark:bg-rose-950/20 dark:text-rose-200 space-y-2"
            >
              <h3 className="text-sm font-bold text-rose-700 dark:text-rose-300">Pipeline Execution Error</h3>
              <p className="text-xs leading-relaxed">
                {(mutation.error as Error)?.message || 'An unexpected error occurred during execution.'}
              </p>
            </motion.div>
          )}

          {/* Completed Verdict Result */}
          {result && !mutation.isPending && (
            <motion.div
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <ResolutionCard result={result} />
            </motion.div>
          )}

          {/* Idle Empty State */}
          {!result && !mutation.isPending && !mutation.isError && (
            <div className="card p-12 flex flex-col items-center justify-center text-center space-y-4 text-stone-500 dark:text-slate-400 min-h-[460px] border-dashed">
              <div className="h-12 w-12 rounded-2xl bg-[#FAF9F5] dark:bg-[#181B21] border border-[#DCDCD4] dark:border-[#262930] flex items-center justify-center text-stone-600 dark:text-slate-300 shadow-sm">
                <GitFork className="h-6 w-6 text-[#FF5500]" />
              </div>
              <div className="space-y-1.5 max-w-sm">
                <h3 className="text-sm font-semibold text-stone-900 dark:text-white">Exception Pipeline Awaiting Input</h3>
                <p className="text-xs text-stone-500 dark:text-slate-400 leading-relaxed">
                  Select a benchmark scenario from the left or enter any 32-character Olist Order ID to trigger automated triaging and policy evaluation.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-stone-400 dark:text-slate-500 pt-2">
                <span>Fast deterministic core</span>
                <span>&bull;</span>
                <span>&lt; 50ms typical latency</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
