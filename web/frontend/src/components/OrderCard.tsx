import type { OrderDetail } from '../lib/api'
import { cn, fmtDate } from '../lib/utils'

interface Props {
  order: OrderDetail
  compact?: boolean
}

function StatusBadge({ status }: { status?: string }) {
  const s = (status ?? '').toLowerCase()
  const styles: Record<string, string> = {
    delivered:  'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
    shipped:    'bg-sky-500/15 text-sky-300 border-sky-500/20',
    processing: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
    canceled:   'bg-rose-500/15 text-rose-300 border-rose-500/20',
    invoiced:   'bg-violet-500/15 text-violet-300 border-violet-500/20',
  }
  return (
    <span className={cn('badge border capitalize', styles[s] ?? 'bg-slate-700/50 text-slate-300 border-white/10')}>
      {status ?? '—'}
    </span>
  )
}

export default function OrderCard({ order, compact = false }: Props) {
  const totalPaid = order.payments.reduce((s, p) => s + (p.payment_value ?? 0), 0)
  const itemTotal = order.items.reduce((s, i) => s + (i.price ?? 0), 0)

  return (
    <div className="card divide-y divide-white/6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="section-title mb-1">Order ID</p>
          <p className="font-mono text-sm text-slate-200 break-all">{order.order_id}</p>
        </div>
        <StatusBadge status={order.order_status} />
      </div>

      {/* Key dates */}
      <div className="grid grid-cols-2 gap-0 divide-x divide-white/6 sm:grid-cols-4">
        {[
          { label: 'Purchased',    val: fmtDate(order.purchase_date) },
          { label: 'Est. Delivery', val: fmtDate(order.estimated_delivery_date) },
          { label: 'Delivered',    val: order.delivery_date ? fmtDate(order.delivery_date) : '—' },
          { label: 'Days Late',    val: order.is_late ? `${order.days_late}d` : 'On time', accent: order.is_late },
        ].map(({ label, val, accent }) => (
          <div key={label} className="px-4 py-3">
            <p className="section-title mb-1">{label}</p>
            <p className={cn('text-sm font-medium', accent ? 'text-amber-300' : 'text-slate-200')}>{val}</p>
          </div>
        ))}
      </div>

      {!compact && (
        <>
          {/* Items */}
          {order.items.length > 0 && (
            <div className="p-4">
              <p className="section-title mb-2">Items ({order.items.length})</p>
              <div className="space-y-1.5">
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-white/4 px-3 py-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-slate-400 truncate max-w-[180px]">{item.product_id}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-300 shrink-0">
                      <span>${(item.price ?? 0).toFixed(2)}</span>
                      <span className="text-slate-600">+${(item.freight_value ?? 0).toFixed(2)} ship</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-right text-xs font-semibold text-slate-300">
                Item total: ${itemTotal.toFixed(2)}
              </p>
            </div>
          )}

          {/* Payments */}
          {order.payments.length > 0 && (
            <div className="p-4">
              <p className="section-title mb-2">Payments</p>
              <div className="space-y-1.5">
                {order.payments.map((p, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-white/4 px-3 py-2 text-xs">
                    <span className="capitalize text-slate-400">{p.payment_type?.replace('_', ' ')}</span>
                    <span className="text-slate-300">${(p.payment_value ?? 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-right text-xs font-semibold text-slate-300">
                Total paid: ${totalPaid.toFixed(2)}
              </p>
            </div>
          )}

          {/* Customer */}
          {order.customer && (
            <div className="flex items-center gap-4 p-4">
              <span className="text-slate-500 text-sm">Customer:</span>
              <span className="text-sm text-slate-300 capitalize">
                {order.customer.customer_city}, {order.customer.customer_state}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
