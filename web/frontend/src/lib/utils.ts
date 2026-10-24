import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

/** Nicely format a resolution string */
export function formatResolution(res?: string): string {
  if (!res) return '—'
  return res
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Map a resolution value to a colour class */
export function resolutionColor(res?: string): string {
  if (!res) return 'text-slate-400'
  const r = res.toLowerCase()
  if (r === 'approved' || r === 'refund_duplicate' || r === 'refund_or_replacement' || r === 'refund_overcharge') return 'text-emerald-400'
  if (r === 'denied') return 'text-rose-400'
  if (r === 'escalated') return 'text-amber-400'
  if (r === 'investigation_required' || r === 'carrier_trace') return 'text-sky-400'
  if (r === 'inform_retry' || r === 'informed' || r === 'no_action') return 'text-slate-300'
  return 'text-slate-300'
}

export function resolutionBg(res?: string): string {
  if (!res) return 'bg-slate-700/40 text-slate-300'
  const r = res.toLowerCase()
  if (r === 'approved' || r.startsWith('refund')) return 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
  if (r === 'denied') return 'bg-rose-500/15 text-rose-300 border border-rose-500/20'
  if (r === 'escalated') return 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
  if (r === 'investigation_required' || r === 'carrier_trace') return 'bg-sky-500/15 text-sky-300 border border-sky-500/20'
  return 'bg-slate-700/40 text-slate-300 border border-white/10'
}

export function routeBadge(route?: string): string {
  if (!route) return 'bg-slate-700/40 text-slate-400'
  const r = route.toLowerCase()
  if (r === 'returns') return 'bg-violet-500/15 text-violet-300 border border-violet-500/20'
  if (r === 'delivery') return 'bg-sky-500/15 text-sky-300 border border-sky-500/20'
  if (r === 'payment') return 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
  return 'bg-slate-700/40 text-slate-400'
}

export function routeIcon(route?: string): string {
  if (!route) return '?'
  const r = route.toLowerCase()
  if (r === 'returns') return '↩'
  if (r === 'delivery') return '📦'
  if (r === 'payment') return '💳'
  return '?'
}

export function policySource(source: string): string {
  return source.replace('.md', '').toUpperCase()
}

export function formatConfidence(c: number): string {
  return `${Math.round(c * 100)}%`
}

/** Truncate a long string */
export function truncate(s: string, max = 80): string {
  return s.length <= max ? s : s.slice(0, max) + '…'
}

/** Format an ISO date string to readable */
export function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    })
  } catch {
    return iso
  }
}

/** Persist case history in localStorage */
const HISTORY_KEY = 'reroute_history'
const MAX_HISTORY = 50

export interface HistoryEntry {
  id: string
  timestamp: string
  order_id: string
  customer_message: string
  route?: string
  resolution?: string
  escalate: boolean
  confidence: number
}

export function saveToHistory(r: { case_id: string; order_id: string; customer_message: string; route?: string; resolution?: string; escalate: boolean; confidence: number }): void {
  const existing: HistoryEntry[] = loadHistory()
  const entry: HistoryEntry = {
    id: r.case_id,
    timestamp: new Date().toISOString(),
    order_id: r.order_id,
    customer_message: r.customer_message,
    route: r.route,
    resolution: r.resolution,
    escalate: r.escalate,
    confidence: r.confidence,
  }
  const updated = [entry, ...existing.filter(e => e.id !== entry.id)].slice(0, MAX_HISTORY)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
  } catch { /* storage full */ }
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY)
}
