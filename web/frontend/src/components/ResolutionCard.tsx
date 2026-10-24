import type { CaseResponse } from '../lib/api'
import { cn, formatResolution, resolutionBg, routeBadge, formatConfidence } from '../lib/utils'

interface Props { result: CaseResponse }

const ROUTE_LABELS: Record<string, { label: string; emoji: string }> = {
  returns:  { label: 'Returns',  emoji: '↩️' },
  delivery: { label: 'Delivery', emoji: '📦' },
  payment:  { label: 'Payment',  emoji: '💳' },
}

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('badge', className)}>
      {children}
    </span>
  )
}

export default function ResolutionCard({ result }: Props) {
  const routeInfo = ROUTE_LABELS[result.route ?? ''] ?? { label: result.route ?? '—', emoji: '?' }

  return (
    <div className="animate-slide-up space-y-4">
      {/* ── Header: verdict ─────────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="section-title mb-1">Case {result.case_id}</p>
            <p className="text-base font-medium text-slate-200 line-clamp-2">
              {result.customer_message}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Pill className={routeBadge(result.route)}>
              {routeInfo.emoji} {routeInfo.label}
            </Pill>
            <Pill className={resolutionBg(result.resolution)}>
              {formatResolution(result.resolution)}
            </Pill>
            {result.escalate && (
              <Pill className="bg-amber-500/15 text-amber-300 border border-amber-500/20">
                ⚠ Escalated
              </Pill>
            )}
          </div>
        </div>

        {/* Resolution detail */}
        <p className="mt-3 text-sm text-slate-300 leading-relaxed">
          {result.resolution_detail || '—'}
        </p>

        {/* Refund */}
        {result.refund_amount != null && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-300">
            <span>💰</span>
            Refund: ${result.refund_amount.toFixed(2)}
          </div>
        )}

        {/* Escalation reason */}
        {result.escalate && result.escalate_reason && (
          <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-xs text-amber-300">
            <span className="font-semibold">Escalation reason: </span>
            {result.escalate_reason}
          </div>
        )}

        {/* Errors */}
        {result.errors.length > 0 && (
          <div className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/8 px-3 py-2 text-xs text-rose-300">
            {result.errors.join('; ')}
          </div>
        )}
      </div>

      {/* ── Metrics row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile label="Route" value={routeInfo.label} sub={`${formatConfidence(result.routing_confidence ?? 0)} conf.`} />
        <MetricTile label="Confidence" value={formatConfidence(result.confidence)} sub={result.routing_backend ?? '—'} />
        <MetricTile label="Tools run" value={String(result.tools_executed.length)} sub={result.tools_executed.slice(-1)[0] ?? '—'} />
        <MetricTile
          label="Groq used"
          value={result.groq_used ? 'Yes' : 'No'}
          sub={result.groq_used ? (result.groq_result?.recommended_action ?? '—') : 'deterministic only'}
          accent={result.groq_used}
        />
      </div>

      {/* ── Two-column detail: Policies + Tools ─────────────────────────── */}
      <div className="grid gap-3 lg:grid-cols-2">
        {/* Policies */}
        <div className="card p-4">
          <p className="section-title mb-3">Relevant Policies</p>
          {result.retrieved_policies.length === 0 ? (
            <p className="text-xs text-slate-500 italic">None retrieved</p>
          ) : (
            <ul className="space-y-2">
              {result.retrieved_policies.map((p, i) => (
                <li key={i} className="flex items-start gap-2.5 animate-slide-in-right" style={{ animationDelay: `${i * 50}ms` }}>
                  <span className="mt-0.5 shrink-0 rounded-md bg-brand-600/15 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-brand-400">
                    {p.policy_id}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs text-slate-300">{p.policy_text}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {p.source_file.replace('.md', '').toUpperCase()} · score {p.score.toFixed(2)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Tool trace */}
        <div className="card p-4">
          <p className="section-title mb-3">Execution Trace</p>
          <div className="space-y-1.5">
            {result.tools_executed.map((tool, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg bg-white/4 px-2.5 py-1.5 animate-slide-in-right"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-brand-400 shrink-0" />
                <span className="font-mono text-xs text-slate-300">{tool}</span>
                {i === result.tools_executed.length - 1 && (
                  <span className="ml-auto text-[10px] text-emerald-500">final</span>
                )}
              </div>
            ))}
          </div>

          {result.applicable_rules.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/8">
              <p className="section-title mb-2">Applied Rules</p>
              <div className="flex flex-wrap gap-1.5">
                {result.applicable_rules.map((r, i) => (
                  <span key={i} className="tag">{r}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Groq reasoning (if used) ─────────────────────────────────────── */}
      {result.groq_used && result.groq_result && (
        <div className="card border-amber-500/20 p-4">
          <p className="section-title mb-3 text-amber-500">Groq LLM Reasoning</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[10px] text-slate-500 mb-1">Interpretation</p>
              <p className="text-sm text-slate-200">{result.groq_result.interpretation}</p>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-[10px] text-slate-500 mb-1">Recommendation</p>
                <p className="text-sm font-medium text-amber-300">{result.groq_result.recommended_action}</p>
              </div>
              <div className="flex gap-4">
                <div>
                  <p className="text-[10px] text-slate-500 mb-1">Confidence</p>
                  <p className="text-sm font-semibold">{formatConfidence(result.groq_result.confidence)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 mb-1">Human needed</p>
                  <p className={cn('text-sm font-semibold', result.groq_result.needs_human ? 'text-amber-400' : 'text-emerald-400')}>
                    {result.groq_result.needs_human ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MetricTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={cn('card p-3.5', accent && 'border-amber-500/20')}>
      <p className="section-title mb-1">{label}</p>
      <p className={cn('text-lg font-semibold', accent ? 'text-amber-300' : 'text-white')}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-500 truncate">{sub}</p>}
    </div>
  )
}
