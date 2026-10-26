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
  is_live_session?: boolean
  execution_path?: 'system_1_reflex' | 'system_2_deliberation'
  latency_ms?: number
}

export const PRESEEDED_HISTORY: HistoryEntry[] = [
  {
    id: 'CASE-HIST-001',
    timestamp: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    order_id: 'e481f51cbdc54678b7cc49136f2d6af7',
    customer_message: 'Product arrived shattered with cracked glass inside the parcel.',
    route: 'returns',
    resolution: 'approved',
    resolution_detail: 'Authorized item reimbursement of R$ 38.71 under policy RET-04 (Damaged in Transit). Return waiver granted.',
    escalate: false,
    refund_amount: 38.71,
    confidence: 0.94,
    tools_executed: ['check_order_status', 'check_return_window', 'calculate_refund_total'],
    execution_path: 'system_1_reflex',
    latency_ms: 21,
    is_live_session: false,
  },
  {
    id: 'CASE-HIST-002',
    timestamp: new Date(Date.now() - 1000 * 60 * 38).toISOString(),
    order_id: '203096f03d82e0dffbc41ebc2e2bcfb7',
    customer_message: 'Delivered 11 days after estimated delivery date. Requesting full freight reimbursement.',
    route: 'delivery',
    resolution: 'approved',
    resolution_detail: 'Carrier SLA breach verified. Delivery occurred 11 days past EDD; reimbursed freight amount of R$ 18.32 under DEL-09.',
    escalate: false,
    refund_amount: 18.32,
    confidence: 0.91,
    tools_executed: ['check_delivery_status', 'calculate_freight_sla'],
    execution_path: 'system_1_reflex',
    latency_ms: 24,
    is_live_session: false,
  },
  {
    id: 'CASE-HIST-003',
    timestamp: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
    order_id: '123e4567e89b12d3a456426614174000',
    customer_message: 'I received this product 38 days ago and want to return it for a refund.',
    route: 'returns',
    resolution: 'denied',
    resolution_detail: 'Return claim requested 38 days post-delivery. Breaches 7-day policy window (RET-02) with no defect claim.',
    escalate: false,
    refund_amount: 0,
    confidence: 0.88,
    tools_executed: ['check_return_window', 'evaluate_remorse_period'],
    execution_path: 'system_1_reflex',
    latency_ms: 19,
    is_live_session: false,
  },
  {
    id: 'CASE-HIST-004',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    order_id: 'b81ef226f3fe1789b1e8b2acac839d17',
    customer_message: 'Package arrived 2 days ago, clothing item is the wrong size. Requesting return.',
    route: 'returns',
    resolution: 'approved',
    resolution_detail: 'Within 7-day right of withdrawal window (RET-01). Prepaid return label generated.',
    escalate: false,
    refund_amount: 154.20,
    confidence: 0.96,
    tools_executed: ['check_return_window', 'generate_shipping_label'],
    execution_path: 'system_1_reflex',
    latency_ms: 22,
    is_live_session: false,
  },
  {
    id: 'CASE-HIST-005',
    timestamp: new Date(Date.now() - 1000 * 60 * 190).toISOString(),
    order_id: 'c5973909778ab0e65928f090757a3e79',
    customer_message: 'High-end chronograph stopped working after 12 days. Claiming defective movement.',
    route: 'returns',
    resolution: 'escalated',
    resolution_detail: 'High-value item (> R$ 500) reported defective past 7-day remorse window. Escalated to Tier-2 supervisor.',
    escalate: true,
    escalate_reason: 'High value item threshold breach; requires technical inspection authorization.',
    refund_amount: 0,
    confidence: 0.62,
    tools_executed: ['check_return_window', 'groq_deliberation_agent'],
    execution_path: 'system_2_deliberation',
    latency_ms: 385,
    is_live_session: false,
  },
  {
    id: 'CASE-HIST-006',
    timestamp: new Date(Date.now() - 1000 * 60 * 250).toISOString(),
    order_id: 'a45929ce07bc23b28acb54778521975f',
    customer_message: 'Carrier arrived 6 days past promised date. Please reimburse freight fee.',
    route: 'delivery',
    resolution: 'approved',
    resolution_detail: 'Carrier transit SLA exceeded by 6 days. Automatically credited R$ 28.50 shipping freight under DEL-09.',
    escalate: false,
    refund_amount: 28.50,
    confidence: 0.93,
    tools_executed: ['check_delivery_status', 'calculate_freight_sla'],
    execution_path: 'system_1_reflex',
    latency_ms: 26,
    is_live_session: false,
  },
  {
    id: 'CASE-HIST-007',
    timestamp: new Date(Date.now() - 1000 * 60 * 320).toISOString(),
    order_id: '47770eb9100c2d0c44946d9cf07ec65d',
    customer_message: 'I was charged twice on my credit card statement for the exact same order.',
    route: 'payment',
    resolution: 'approved',
    resolution_detail: 'Duplicate authorization sequence confirmed in gateway log. Reversal of duplicate R$ 89.90 executed under PAY-01.',
    escalate: false,
    refund_amount: 89.90,
    confidence: 0.97,
    tools_executed: ['check_payment_records', 'verify_gateway_charge'],
    execution_path: 'system_1_reflex',
    latency_ms: 18,
    is_live_session: false,
  },
  {
    id: 'CASE-HIST-008',
    timestamp: new Date(Date.now() - 1000 * 60 * 410).toISOString(),
    order_id: '871766c2855e8638792042461b99e526',
    customer_message: 'Tracking has been stuck at sorting hub for 12 days without carrier scan.',
    route: 'delivery',
    resolution: 'investigation_required',
    resolution_detail: 'Carrier SLA trace dispatch initiated. Active inquiry ticket #7492 filed with regional distribution depot.',
    escalate: false,
    refund_amount: 0,
    confidence: 0.89,
    tools_executed: ['check_delivery_status', 'dispatch_carrier_trace'],
    execution_path: 'system_1_reflex',
    latency_ms: 31,
    is_live_session: false,
  },
  {
    id: 'CASE-HIST-009',
    timestamp: new Date(Date.now() - 1000 * 60 * 520).toISOString(),
    order_id: '949d5b44dbf5de918fe9c16f97b45f8a',
    customer_message: 'Porcelain dinner set arrived with multiple chipped and broken plates.',
    route: 'returns',
    resolution: 'approved',
    resolution_detail: 'Photo verification satisfied. Full order reimbursement of R$ 78.45 authorized under RET-04.',
    escalate: false,
    refund_amount: 78.45,
    confidence: 0.95,
    tools_executed: ['check_order_status', 'check_return_window', 'calculate_refund_total'],
    execution_path: 'system_1_reflex',
    latency_ms: 23,
    is_live_session: false,
  },
  {
    id: 'CASE-HIST-010',
    timestamp: new Date(Date.now() - 1000 * 60 * 680).toISOString(),
    order_id: 'd2e453e4f62304a45e50cd384e245749',
    customer_message: 'I see an unauthorized charge on my account that I never ordered. Card compromised.',
    route: 'payment',
    resolution: 'escalated',
    resolution_detail: 'Security flag: potential fraudulent transaction dispute. Direct payment hold placed; routed to risk officer under PAY-08.',
    escalate: true,
    escalate_reason: 'Account takeover / stolen card fraud claim. Mandatory human security protocol.',
    refund_amount: 0,
    confidence: 0.58,
    tools_executed: ['check_payment_records', 'groq_deliberation_agent'],
    execution_path: 'system_2_deliberation',
    latency_ms: 412,
    is_live_session: false,
  },
  {
    id: 'CASE-HIST-011',
    timestamp: new Date(Date.now() - 1000 * 60 * 820).toISOString(),
    order_id: 'ad850e64f9760216e84015384bc839d8',
    customer_message: 'Returning electronic adapter 21 days after arrival because I found a cheaper alternative.',
    route: 'returns',
    resolution: 'denied',
    resolution_detail: 'Exceeds 7-day CDC Art. 49 statutory remorse window (21 days post-delivery). Claim denied under RET-02.',
    escalate: false,
    refund_amount: 0,
    confidence: 0.92,
    tools_executed: ['check_return_window'],
    execution_path: 'system_1_reflex',
    latency_ms: 20,
    is_live_session: false,
  },
  {
    id: 'CASE-HIST-012',
    timestamp: new Date(Date.now() - 1000 * 60 * 990).toISOString(),
    order_id: '53cdb2fc8bc7dce0b6741e2150273451',
    customer_message: 'Package confirmed lost by carrier after 18 days past estimated delivery date.',
    route: 'delivery',
    resolution: 'approved',
    resolution_detail: 'Lost in transit confirmed via postal carrier protocol. Total refund of R$ 124.80 issued under DEL-08.',
    escalate: false,
    refund_amount: 124.80,
    confidence: 0.94,
    tools_executed: ['check_delivery_status', 'calculate_refund_total'],
    execution_path: 'system_1_reflex',
    latency_ms: 25,
    is_live_session: false,
  },
]

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
  execution_path?: 'system_1_reflex' | 'system_2_deliberation'
  latency_ms?: number
}): void {
  const existingLocal = loadLocalHistory()
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
    execution_path: r.execution_path,
    latency_ms: r.latency_ms,
    is_live_session: true,
  }
  const updated = [entry, ...existingLocal.filter((e) => e.id !== entry.id)].slice(0, MAX_HISTORY)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
  } catch {
    /* storage full */
  }
}

function loadLocalHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (raw) return JSON.parse(raw)
    const old = localStorage.getItem('reroute_history')
    return old ? JSON.parse(old) : []
  } catch {
    return []
  }
}

export function loadHistory(): HistoryEntry[] {
  const local = loadLocalHistory().map((e) => ({ ...e, is_live_session: true }))
  // Merge live session records on top of preseeded baseline
  const localIds = new Set(local.map((e) => e.id))
  const filteredPreseeded = PRESEEDED_HISTORY.filter((e) => !localIds.has(e.id))
  return [...local, ...filteredPreseeded]
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY)
  localStorage.removeItem('reroute_history')
}
