import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

/** Format a resolution string into human-friendly text */
export function formatResolution(res?: string): string {
  if (!res) return 'Unresolved'
  return res
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Map a resolution value to a text color class */
export function resolutionColor(res?: string): string {
  if (!res) return 'text-slate-400'
  const r = res.toLowerCase()
  if (r === 'approved' || r.startsWith('refund')) return 'text-emerald-400'
  if (r === 'denied') return 'text-rose-400'
  if (r === 'escalated') return 'text-amber-400'
  if (r === 'investigation_required' || r === 'carrier_trace') return 'text-sky-400'
  return 'text-indigo-300'
}

/** Map resolution to badge styles */
export function resolutionBg(res?: string): string {
  if (!res) return 'bg-slate-800/80 text-slate-300 border border-slate-700/60'
  const r = res.toLowerCase()
  if (r === 'approved' || r.startsWith('refund')) {
    return 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 shadow-sm shadow-emerald-950/40'
  }
  if (r === 'denied') {
    return 'bg-rose-500/10 text-rose-300 border border-rose-500/25 shadow-sm shadow-rose-950/40'
  }
  if (r === 'escalated') {
    return 'bg-amber-500/10 text-amber-300 border border-amber-500/25 shadow-sm shadow-amber-950/40'
  }
  if (r === 'investigation_required' || r === 'carrier_trace') {
    return 'bg-sky-500/10 text-sky-300 border border-sky-500/25 shadow-sm shadow-sky-950/40'
  }
  return 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/25'
}

/** Map route to badge styles */
export function routeBadge(route?: string): string {
  if (!route) return 'bg-slate-800/80 text-slate-400 border border-slate-700/60'
  const r = route.toLowerCase()
  if (r === 'returns') return 'bg-purple-500/10 text-purple-300 border border-purple-500/25 shadow-sm shadow-purple-950/30'
  if (r === 'delivery') return 'bg-sky-500/10 text-sky-300 border border-sky-500/25 shadow-sm shadow-sky-950/30'
  if (r === 'payment') return 'bg-amber-500/10 text-amber-300 border border-amber-500/25 shadow-sm shadow-amber-950/30'
  return 'bg-slate-800/80 text-slate-400 border border-slate-700/60'
}

export function policySource(source: string): string {
  return source.replace('.md', '').toUpperCase()
}

export function formatConfidence(c?: number): string {
  if (c == null || isNaN(c)) return '0%'
  return `${Math.round(c * 100)}%`
}

export function fmtCurrency(amount?: number | null): string {
  if (amount == null) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

/** Truncate string */
export function truncate(s?: string, max = 80): string {
  if (!s) return ''
  return s.length <= max ? s : s.slice(0, max) + '…'
}

/** Format an ISO date string to readable */
export function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

/** Format relative time */
export function fmtRelativeTime(iso?: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000)
    if (diffSec < 60) return 'Just now'
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
    return fmtDate(iso)
  } catch {
    return iso
  }
}

/** Persist case history in localStorage */
const HISTORY_KEY = 'reroute_history_v2'
const MAX_HISTORY = 60

export interface HistoryEntry {
  id: string
  timestamp: string
  order_id: string
  customer_message: string
  route?: string
  resolution?: string
  resolution_detail?: string
  escalate: boolean
  escalate_reason?: string
  refund_amount?: number
  confidence: number
  tools_executed?: string[]
}

export function saveToHistory(r: {
  case_id: string
  order_id: string
  customer_message: string
  route?: string
  resolution?: string
  resolution_detail?: string
  escalate: boolean
  escalate_reason?: string
  refund_amount?: number
  confidence: number
  tools_executed?: string[]
}): void {
  const existing: HistoryEntry[] = loadHistory()
  const entry: HistoryEntry = {
    id: r.case_id,
    timestamp: new Date().toISOString(),
    order_id: r.order_id,
    customer_message: r.customer_message,
    route: r.route,
    resolution: r.resolution,
    resolution_detail: r.resolution_detail,
    escalate: r.escalate,
    escalate_reason: r.escalate_reason,
    refund_amount: r.refund_amount,
    confidence: r.confidence,
    tools_executed: r.tools_executed,
  }
  const updated = [entry, ...existing.filter((e) => e.id !== entry.id)].slice(0, MAX_HISTORY)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
  } catch {
    /* storage full */
  }
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (raw) return JSON.parse(raw)
    // fallback check old key
    const old = localStorage.getItem('reroute_history')
    return old ? JSON.parse(old) : []
  } catch {
    return []
  }
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY)
  localStorage.removeItem('reroute_history')
}
