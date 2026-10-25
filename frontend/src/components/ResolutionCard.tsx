import { useState } from 'react'
import type { CaseResponse } from '../lib/api'
import {
  cn,
  formatResolution,
  formatConfidence,
  fmtCurrency,
} from '../lib/utils'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react'
import { Link } from 'react-router-dom'

interface Props {
  result: CaseResponse
}

export default function ResolutionCard({ result }: Props) {
  const [activeTab, setActiveTab] = useState<'policies' | 'trace' | 'llm'>('policies')
  const [copied, setCopied] = useState(false)

  const copySummary = () => {
    navigator.clipboard.writeText(JSON.stringify(result, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isApproved = result.resolution?.toLowerCase().includes('approved') || result.resolution?.toLowerCase().startsWith('refund')
  const isDenied = result.resolution?.toLowerCase() === 'denied'
  const isEscalated = result.escalate || result.resolution?.toLowerCase() === 'escalated'

  const borderAccent = isApproved
    ? 'border-l-4 border-l-emerald-500'
    : isDenied
    ? 'border-l-4 border-l-rose-500'
    : 'border-l-4 border-l-amber-500'

  return (
    <div className="space-y-4">
      {/* ── Official Adjudication Verdict Card ─────────────────────────── */}
      <div className={cn('card p-6 space-y-4', borderAccent)}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[#DCDCD4] dark:border-[#262930] pb-3.5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-mono text-xs text-stone-500 dark:text-slate-400">
              <span className="font-semibold text-stone-900 dark:text-white">CASE:</span>
              <span className="text-[#FF5500] font-semibold">{result.case_id}</span>
              <span>&bull;</span>
              <span>ORDER:</span>
              <span className="text-stone-700 dark:text-slate-300 truncate max-w-[180px]">{result.order_id}</span>
            </div>
            <h3 className="text-sm font-medium text-stone-800 dark:text-slate-200">
              &ldquo;{result.customer_message}&rdquo;
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isApproved && <span className="badge-approved font-mono">APPROVED</span>}
            {isDenied && <span className="badge-denied font-mono">DENIED</span>}
            {isEscalated && !isApproved && <span className="badge-escalated font-mono">ESCALATED</span>}
            {result.escalate && (
              <span className="badge-escalated font-mono">SUPERVISOR REQ</span>
            )}
          </div>
        </div>

        {/* Narrative & Finding Banner */}
        <div className="rounded-xl bg-[#FAF9F5] dark:bg-[#181B21] border border-[#DCDCD4] dark:border-[#262930] p-4 text-xs leading-relaxed text-stone-700 dark:text-slate-300 shadow-xs">
          <span className="text-[10px] uppercase font-mono text-stone-400 dark:text-slate-500 block mb-1">Adjudication Finding</span>
          <p className="font-medium text-stone-900 dark:text-slate-200">{result.resolution_detail || 'No detailed adjudication note provided.'}</p>
        </div>

        {/* Reimbursement Calculation Callout */}
        {result.refund_amount != null && result.refund_amount > 0 && (
          <div className="flex items-center justify-between rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/30 p-4">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-600 dark:text-emerald-400 block font-medium">
                Authorized Reimbursement Total
              </span>
              <span className="text-xl font-bold font-mono text-emerald-800 dark:text-emerald-200">
                {fmtCurrency(result.refund_amount)}
              </span>
            </div>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-[11px] font-mono font-medium text-emerald-700 dark:text-emerald-300">
              Auto-Credit Dispatched
            </span>
          </div>
        )}

        {/* Escalation Detail */}
        {result.escalate && result.escalate_reason && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-500/30 p-3.5 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-700 dark:text-amber-300 font-mono text-[11px] block">ESCALATION REQUIREMENT</span>
              <p className="mt-0.5 text-stone-700 dark:text-slate-300">{result.escalate_reason}</p>
            </div>
          </div>
        )}

        {/* Subsystem Telemetry Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
          <div className="p-2.5 rounded-lg bg-[#FAF9F5] dark:bg-[#181B21] border border-[#DCDCD4] dark:border-[#262930]">
            <span className="text-stone-400 dark:text-slate-500 text-[10px] uppercase block">Selected Route</span>
            <span className="font-semibold text-[#FF5500] dark:text-orange-400 uppercase">{result.route || 'UNKNOWN'}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#FAF9F5] dark:bg-[#181B21] border border-[#DCDCD4] dark:border-[#262930]">
            <span className="text-stone-400 dark:text-slate-500 text-[10px] uppercase block">Routing Conf</span>
            <span className="font-semibold text-stone-800 dark:text-slate-200">{formatConfidence(result.routing_confidence)}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#FAF9F5] dark:bg-[#181B21] border border-[#DCDCD4] dark:border-[#262930]">
            <span className="text-stone-400 dark:text-slate-500 text-[10px] uppercase block">Router Backend</span>
            <span className="font-semibold text-stone-800 dark:text-slate-200 truncate block">{result.routing_backend || 'openjev'}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#FAF9F5] dark:bg-[#181B21] border border-[#DCDCD4] dark:border-[#262930]">
            <span className="text-stone-400 dark:text-slate-500 text-[10px] uppercase block">LLM Reasoner</span>
            <span className={cn('font-semibold', result.groq_used ? 'text-amber-600 dark:text-amber-300' : 'text-stone-500 dark:text-slate-400')}>
              {result.groq_used ? 'Groq Qwen Active' : 'Deterministic Only'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Subsystem Trace & Policy Citations Card ─────────────────────── */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#DCDCD4] dark:border-[#262930] bg-[#F4F4F0] dark:bg-[#181B21] px-4 pt-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('policies')}
              className={cn(
                'rounded-t px-3 py-2 text-xs font-medium transition-colors border-b-2',
                activeTab === 'policies'
                  ? 'border-[#FF5500] text-stone-900 dark:text-white font-semibold'
                  : 'border-transparent text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-200',
              )}
            >
              Policy Rules & Citations ({result.retrieved_policies.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('trace')}
              className={cn(
                'rounded-t px-3 py-2 text-xs font-medium transition-colors border-b-2',
                activeTab === 'trace'
                  ? 'border-[#FF5500] text-stone-900 dark:text-white font-semibold'
                  : 'border-transparent text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-200',
              )}
            >
              Tool Execution Trace ({result.tools_executed.length})
            </button>

            {result.groq_used && (
              <button
                type="button"
                onClick={() => setActiveTab('llm')}
                className={cn(
                  'rounded-t px-3 py-2 text-xs font-medium transition-colors border-b-2',
                  activeTab === 'llm'
                    ? 'border-amber-500 text-amber-700 dark:text-amber-300 font-semibold'
                    : 'border-transparent text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-200',
                )}
              >
                Groq Fallback Log
              </button>
            )}
          </div>
        </div>

        <div className="p-5">
          {activeTab === 'policies' && (
            <div className="space-y-3">
              {result.applicable_rules.length > 0 && (
                <div className="flex items-center gap-2 pb-2.5 border-b border-[#DCDCD4] dark:border-[#262930]">
                  <span className="text-[11px] font-mono text-stone-500 dark:text-slate-400">APPLIED RULES:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {result.applicable_rules.map((rule, i) => (
                      <span
                        key={i}
                        className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[#FF5500] dark:text-orange-300"
                      >
                        {rule}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2.5">
                {result.retrieved_policies.length > 0 ? (
                  result.retrieved_policies.map((p, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-[#DCDCD4] dark:border-[#262930] bg-[#FAF9F5] dark:bg-[#181B21] p-3.5 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#FF5500] dark:text-orange-400">{p.policy_id}</span>
                          <span className="text-stone-400 dark:text-slate-500">[{p.source_file}]</span>
                        </div>
                        <span className="text-stone-400 dark:text-slate-500">Score: {formatConfidence(p.score)}</span>
                      </div>
                      <p className="text-stone-700 dark:text-slate-300 font-sans leading-relaxed">{p.policy_text}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-stone-400 dark:text-slate-500 italic">No policy citations retrieved.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'trace' && (
            <div className="space-y-2">
              {result.tools_executed.map((tool, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-[#FAF9F5] dark:bg-[#181B21] border border-[#DCDCD4] dark:border-[#262930] px-3.5 py-2 text-xs font-mono"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-stone-400 dark:text-slate-500 text-[10px]">{i + 1}.</span>
                    <span className="font-semibold text-stone-800 dark:text-slate-200">{tool}</span>
                  </div>
                  <span className="badge-approved text-[10px]">VERIFIED</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'llm' && result.groq_result && (
            <div className="rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-500/30 p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between font-mono text-[11px] text-amber-700 dark:text-amber-400">
                <span>GROQ REASONER LOG</span>
                <span className="text-stone-400 dark:text-slate-500">Model: {result.groq_result.groq_model || 'qwen/qwen3.8-27b'}</span>
              </div>
              <p className="text-stone-800 dark:text-slate-200 leading-relaxed font-sans">{result.groq_result.interpretation}</p>
              <div className="flex items-center gap-4 pt-2 border-t border-[#DCDCD4] dark:border-[#262930] font-mono text-[11px]">
                <span>Recommended: <strong className="text-amber-700 dark:text-amber-300 uppercase">{result.groq_result.recommended_action}</strong></span>
                <span>Needs Human: <strong className={result.groq_result.needs_human ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                  {result.groq_result.needs_human ? 'YES' : 'NO'}
                </strong></span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Operational Navigation Actions ─────────────────────────────── */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={copySummary}
          className="btn-secondary text-xs"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? 'Copied' : 'Copy JSON Verdict'}</span>
        </button>

        <div className="flex items-center gap-2">
          <Link
            to={`/orders?order_id=${encodeURIComponent(result.order_id)}`}
            className="btn-secondary text-xs"
          >
            <Search className="h-3 w-3" />
            <span>Audit Order</span>
          </Link>
          <Link
            to={`/?order_id=${encodeURIComponent(result.order_id)}`}
            className="btn-primary text-xs"
          >
            <span>Open in Chat</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}
