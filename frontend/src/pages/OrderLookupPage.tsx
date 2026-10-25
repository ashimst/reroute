import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchOrder, searchOrders } from '../lib/api'
import OrderCard from '../components/OrderCard'
import {
  Search,
  AlertCircle,
  X,
} from 'lucide-react'

const QUICK_PICKS = [
  { id: 'e481f51cbdc54678b7cc49136f2d6af7', label: 'Delivered (Multi-payment)', tag: 'Returns' },
  { id: '949d5b44dbf5de918fe9c16f97b45f8a', label: 'Late Delivery Delay', tag: 'Delivery' },
  { id: '0016dfedd97fc2950e388d2971d718c7', label: 'Multi-Item Order', tag: 'Payment' },
  { id: 'ad21c59c0840e6cb83a9ceb5573f8159', label: 'Early Delivery', tag: 'Fulfillment' },
]

export default function OrderLookupPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialOrderId = searchParams.get('order_id') || ''

  const [input, setInput] = useState(initialOrderId)
  const [submitted, setSubmitted] = useState(initialOrderId)

  const searchQuery = useQuery({
    queryKey: ['order-search', input],
    queryFn: () => searchOrders(input),
    enabled: input.length >= 4 && input !== submitted,
    staleTime: 10_000,
    retry: false,
  })

  const orderQuery = useQuery({
    queryKey: ['order', submitted],
    queryFn: () => fetchOrder(submitted),
    enabled: !!submitted && submitted.length >= 8,
    staleTime: 5 * 60_000,
    retry: false,
  })

  const handleSelect = (id: string) => {
    setInput(id)
    setSubmitted(id)
    setSearchParams({ order_id: id })
  }

  const handleClear = () => {
    setInput('')
    setSubmitted('')
    setSearchParams({})
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* ── Operational Header ─────────────────────────────────────────── */}
      <div className="border-b border-[#DCDCD4] dark:border-[#262930] pb-3">
        <h1 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
          <span>Olist Transaction Data Store</span>
          <span className="text-stone-300 dark:text-slate-600 font-normal">/</span>
          <span className="text-stone-500 dark:text-slate-400 font-normal font-mono text-[11px]">99,441 Order Records</span>
        </h1>
        <p className="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
          Query raw transactions: fulfillment milestones, line items, customer location, and payment installments.
        </p>
      </div>

      {/* ── Search Input Dock ──────────────────────────────────── */}
      <div className="space-y-2.5">
        <div className="relative">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 h-3.5 w-3.5 text-stone-400 dark:text-slate-500" />
            <input
              className="input pl-9 pr-20 py-2.5 font-mono text-xs"
              placeholder="Search by 32-character hexadecimal Order ID prefix (e.g. e481f51c)..."
              value={input}
              onChange={(e) => setInput(e.target.value.trim())}
              onKeyDown={(e) => e.key === 'Enter' && input.length >= 8 && handleSelect(input)}
            />
            {input && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-16 p-1 text-stone-400 hover:text-stone-700 dark:text-slate-500 dark:hover:text-slate-300"
              >
                <X className="h-3 w-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => input.length >= 8 && handleSelect(input)}
              disabled={input.length < 8}
              className="btn-primary absolute right-1 py-1 px-3 text-xs"
            >
              Lookup
            </button>
          </div>

          {/* Autocomplete dropdown */}
          {searchQuery.data && searchQuery.data.length > 0 && input !== submitted && (
            <div className="absolute z-30 mt-1 w-full rounded-xl border border-[#DCDCD4] dark:border-[#262930] bg-white dark:bg-[#131519] shadow-xl overflow-hidden divide-y divide-[#DCDCD4] dark:divide-[#262930]">
              {searchQuery.data.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleSelect(id)}
                  className="flex items-center justify-between w-full px-3 py-2 text-left font-mono text-xs text-stone-800 dark:text-slate-300 hover:bg-[#FAF9F5] dark:hover:bg-[#181B21] hover:text-[#FF5500] dark:hover:text-white transition-colors"
                >
                  <span className="font-semibold">{id}</span>
                  <span className="text-[10px] text-[#FF5500] dark:text-orange-400">Select &rarr;</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Picks */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          <span className="text-[10px] uppercase text-stone-500 dark:text-slate-500 font-sans">Sample Queries:</span>
          {QUICK_PICKS.map((qp) => (
            <button
              key={qp.id}
              type="button"
              onClick={() => handleSelect(qp.id)}
              className="rounded-lg border border-[#DCDCD4] dark:border-[#262930] bg-[#FAF9F5] dark:bg-[#181B21] px-2.5 py-1 text-[11px] text-stone-700 dark:text-slate-300 hover:text-[#FF5500] dark:hover:text-white hover:border-[#FF5500]/50 transition-colors"
            >
              <span>{qp.label}</span>
              <span className="text-stone-400 dark:text-slate-500 ml-1">[{qp.tag}]</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Query Loading State ───────────────────────────────────────── */}
      {orderQuery.isLoading && submitted && (
        <div className="card p-8 flex items-center justify-center gap-2 text-stone-500 dark:text-slate-400 text-xs font-mono">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-stone-300 border-t-[#FF5500]" />
          <span>Scanning Olist records in memory...</span>
        </div>
      )}

      {/* ── Query Error State ─────────────────────────────────────────── */}
      {orderQuery.isError && (
        <div className="card border-rose-500/30 bg-rose-50 text-rose-800 dark:bg-rose-950/20 dark:text-rose-300 p-4 text-xs flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-rose-700 dark:text-rose-200">Order ID Not Found</p>
            <p className="font-mono text-rose-600/80 dark:text-rose-300/80 mt-0.5">{submitted}</p>
            <p className="text-stone-600 dark:text-slate-400 mt-1 font-sans">
              Verify the 32-character hexadecimal format or pick one of the sample orders.
            </p>
          </div>
        </div>
      )}

      {/* ── Order Display ─────────────────────────────────────────────── */}
      {orderQuery.data && (
        <OrderCard order={orderQuery.data} compact={false} showActions={true} />
      )}

      {/* ── Empty State ──────────────────────────────────────────────── */}
      {!submitted && (
        <div className="card p-10 text-center border-dashed">
          <h3 className="text-xs font-semibold text-stone-700 dark:text-slate-300 uppercase font-mono">Awaiting Search Query</h3>
          <p className="mt-1 text-xs text-stone-500 dark:text-slate-500 max-w-sm mx-auto leading-relaxed">
            Enter an order ID in the input dock or select one of the benchmark samples to inspect complete transaction details.
          </p>
        </div>
      )}
    </div>
  )
}
