import { useState } from 'react'
import type { OrderDetail } from '../lib/api'
import { cn, fmtDate, fmtCurrency } from '../lib/utils'
import { Copy, Check, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

interface Props {
  order: OrderDetail
  compact?: boolean
  showActions?: boolean
}

function StatusBadge({ status }: { status?: string }) {
  const s = (status ?? '').toLowerCase()
  const styles: Record<string, string> = {
    delivered:  'badge-approved',
    shipped:    'badge-info',
    processing: 'badge-escalated',
    canceled:   'badge-denied',
    invoiced:   'badge-neutral',
  }
  return (
    <span className={cn('font-mono uppercase text-[10px] font-semibold', styles[s] ?? 'badge-neutral')}>
      {status ?? 'Unknown'}
    </span>
  )
}

export default function OrderCard({ order, compact = false, showActions = true }: Props) {
  const [copied, setCopied] = useState(false)

  const copyId = () => {
    navigator.clipboard.writeText(order.order_id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const totalPaid = order.payments?.reduce((s, p) => s + (p.payment_value ?? 0), 0) ?? 0
  const itemTotal = order.items?.reduce((s, i) => s + (i.price ?? 0), 0) ?? 0

  return (
    <div className="card overflow-hidden divide-y divide-[#DCDCD4] dark:divide-[#262930]">
      {/* ── Order Header & Status ──────────────────────────────────────── */}
      <div className="p-4 bg-[#F4F4F0] dark:bg-[#181B21] flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-stone-500 dark:text-slate-500 text-[10px] uppercase font-sans">Order ID:</span>
            <span className="font-semibold text-stone-900 dark:text-white">{order.order_id}</span>
            <button
              type="button"
              onClick={copyId}
              className="text-stone-400 hover:text-stone-700 dark:text-slate-500 dark:hover:text-white transition-colors"
              title="Copy Order ID"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
          {order.customer && (
            <p className="text-[11px] text-stone-500 dark:text-slate-400 font-sans">
              Customer in <strong className="text-stone-800 dark:text-slate-300 font-medium">{order.customer.customer_city}, {order.customer.customer_state}</strong> (ZIP {order.customer.customer_zip_code_prefix})
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={order.order_status} />
          {order.is_late ? (
            <span className="badge-denied font-mono text-[10px]">LATE: +{order.days_late}D</span>
          ) : (
            <span className="badge-approved font-mono text-[10px]">ON-TIME</span>
          )}
        </div>
      </div>

      {/* ── Timeline Telemetry ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#DCDCD4] dark:divide-[#262930] text-xs">
        <div className="p-3">
          <span className="text-stone-400 dark:text-slate-500 text-[10px] uppercase font-mono block">Purchased</span>
          <span className="font-mono text-stone-800 dark:text-slate-200 text-xs font-semibold">{fmtDate(order.purchase_date)}</span>
        </div>
        <div className="p-3">
          <span className="text-stone-400 dark:text-slate-500 text-[10px] uppercase font-mono block">Estimated Delivery</span>
          <span className="font-mono text-stone-800 dark:text-slate-200 text-xs font-semibold">{fmtDate(order.estimated_delivery_date)}</span>
        </div>
        <div className="p-3">
          <span className="text-stone-400 dark:text-slate-500 text-[10px] uppercase font-mono block">Actual Carrier Delivery</span>
          <span className="font-mono text-stone-800 dark:text-slate-200 text-xs font-semibold">
            {order.delivery_date ? fmtDate(order.delivery_date) : 'Pending In-Transit'}
          </span>
        </div>
        <div className="p-3">
          <span className="text-stone-400 dark:text-slate-500 text-[10px] uppercase font-mono block">Delivery Performance</span>
          <span className={cn('font-mono text-xs font-semibold', order.is_late ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>
            {order.is_late ? `${order.days_late} Days Past EDD` : 'Fulfilled On Schedule'}
          </span>
        </div>
      </div>

      {!compact && (
        <>
          {/* ── Itemized Line Items Table ────────────────────────────────── */}
          {order.items && order.items.length > 0 && (
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-stone-700 dark:text-slate-300 font-mono text-[11px] uppercase">
                  Itemized Manifest ({order.items.length} Units)
                </span>
                <span className="font-mono text-stone-500 dark:text-slate-400 text-xs">
                  Goods Subtotal: <strong className="text-stone-900 dark:text-white">{fmtCurrency(itemTotal)}</strong>
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[#DCDCD4] dark:border-[#262930] bg-[#FAF9F5] dark:bg-[#181B21]">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[#DCDCD4] dark:border-[#262930] text-stone-500 dark:text-slate-400 text-[10px] uppercase bg-[#F4F4F0] dark:bg-[#131519]">
                      <th className="py-1.5 px-3">#</th>
                      <th className="py-1.5 px-3">Product SKU</th>
                      <th className="py-1.5 px-3">Seller ID</th>
                      <th className="py-1.5 px-3 text-right">Freight</th>
                      <th className="py-1.5 px-3 text-right">Unit Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCDCD4] dark:divide-[#262930] text-stone-700 dark:text-slate-300 text-[11px]">
                    {order.items.map((item, i) => (
                      <tr key={i} className="hover:bg-[#F4F4F0] dark:hover:bg-white/[0.02] transition-colors">
                        <td className="py-2 px-3 text-stone-400 dark:text-slate-500">{i + 1}</td>
                        <td className="py-2 px-3 text-[#FF5500] font-semibold">{item.product_id}</td>
                        <td className="py-2 px-3 text-stone-500 dark:text-slate-400 truncate max-w-[120px]">{item.seller_id}</td>
                        <td className="py-2 px-3 text-right text-stone-600 dark:text-slate-400">{fmtCurrency(item.freight_value)}</td>
                        <td className="py-2 px-3 text-right text-stone-900 dark:text-slate-100 font-bold">{fmtCurrency(item.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Payments Reconciliation ──────────────────────────────────── */}
          <div className="p-4 bg-[#FAF9F5] dark:bg-[#181B21] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
            <div>
              <span className="text-stone-500 dark:text-slate-500 text-[10px] uppercase block font-sans">Payment Reconciliation</span>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {order.payments?.map((p, i) => (
                  <span key={i} className="rounded-lg bg-white dark:bg-[#131519] border border-[#DCDCD4] dark:border-[#262930] px-2.5 py-1 text-[11px] text-stone-700 dark:text-slate-300 shadow-xs">
                    <strong className="uppercase text-stone-900 dark:text-slate-200">{p.payment_type?.replace(/_/g, ' ')}</strong>
                    {p.payment_installments > 1 && ` (${p.payment_installments}x)`}: {fmtCurrency(p.payment_value)}
                  </span>
                ))}
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-stone-500 dark:text-slate-500 text-[10px] uppercase block font-sans">Total Paid</span>
              <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400 font-mono">{fmtCurrency(totalPaid)}</span>
            </div>
          </div>
        </>
      )}

      {/* ── Operational Dispatch Actions ───────────────────────────────── */}
      {showActions && (
        <div className="p-3 bg-[#F4F4F0] dark:bg-[#181B21] flex items-center justify-between gap-3 text-xs">
          <span className="text-stone-500 dark:text-slate-500 font-mono text-[11px] hidden sm:inline">
            Action: Exception Routing & State Inspection
          </span>
          <div className="flex items-center gap-2">
            <Link
              to={`/?order_id=${encodeURIComponent(order.order_id)}`}
              className="btn-secondary text-xs"
            >
              Open in Assistant
            </Link>
            <Link
              to={`/submit?order_id=${encodeURIComponent(order.order_id)}`}
              className="btn-primary text-xs"
            >
              <span>Inspect in Studio</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
