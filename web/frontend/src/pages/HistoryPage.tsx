import { useState } from 'react'
import { loadHistory, clearHistory, formatResolution, resolutionBg, routeBadge, formatConfidence, fmtDate, cn, truncate, type HistoryEntry } from '../lib/utils'

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>(loadHistory)

  const handleClear = () => {
    clearHistory()
    setEntries([])
  }

  if (entries.length === 0) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <PageHeader count={0} onClear={handleClear} />
        <div className="rounded-xl border border-dashed border-white/10 p-16 text-center">
          <p className="text-2xl mb-3">📋</p>
          <p className="text-sm text-slate-400">No cases yet</p>
          <p className="mt-1 text-xs text-slate-600">Cases you submit will appear here</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader count={entries.length} onClear={handleClear} />

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total cases',  val: entries.length },
          { label: 'Escalated',    val: entries.filter(e => e.escalate).length },
          { label: 'Returns',      val: entries.filter(e => e.route === 'returns').length },
          { label: 'Avg confidence', val: formatConfidence(entries.reduce((s, e) => s + e.confidence, 0) / entries.length) },
        ].map(({ label, val }) => (
          <div key={label} className="card p-3.5">
            <p className="section-title mb-1">{label}</p>
            <p className="text-2xl font-semibold text-white">{val}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8 bg-white/3">
              {['Case', 'Message', 'Route', 'Resolution', 'Confidence', 'Time'].map(h => (
                <th key={h} className="px-4 py-3 text-left section-title first:pl-5 last:pr-5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/6">
            {entries.map((entry) => (
              <tr key={entry.id} className="group hover:bg-white/3 transition-colors">
                <td className="px-4 py-3 pl-5 font-mono text-xs text-brand-400 whitespace-nowrap">
                  {entry.id}
                </td>
                <td className="px-4 py-3 max-w-[200px]">
                  <p className="text-xs text-slate-300 truncate">{truncate(entry.customer_message, 60)}</p>
                  <p className="text-[10px] text-slate-600 font-mono truncate mt-0.5">{truncate(entry.order_id, 20)}</p>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={cn('badge capitalize', routeBadge(entry.route))}>
                    {entry.route ?? '—'}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={cn('badge capitalize', resolutionBg(entry.resolution))}>
                    {formatResolution(entry.resolution)}
                  </span>
                  {entry.escalate && (
                    <span className="ml-1.5 text-[10px] text-amber-400">⚠</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {formatConfidence(entry.confidence)}
                </td>
                <td className="px-4 py-3 pr-5 text-[11px] text-slate-600 whitespace-nowrap">
                  {fmtDate(entry.timestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PageHeader({ count, onClear }: { count: number; onClear: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold text-white">Case History</h1>
        <p className="mt-1 text-sm text-slate-400">{count} case{count !== 1 ? 's' : ''} stored locally</p>
      </div>
      {count > 0 && (
        <button onClick={onClear} className="btn-ghost text-xs text-rose-400 hover:text-rose-300">
          Clear history
        </button>
      )}
    </div>
  )
}
