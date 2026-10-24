import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchOrder, searchOrders } from '../lib/api'
import OrderCard from '../components/OrderCard'

export default function OrderLookupPage() {
  const [input, setInput]         = useState('')
  const [submitted, setSubmitted] = useState('')

  // Live search suggestions
  const searchQuery = useQuery({
    queryKey: ['order-search', input],
    queryFn: () => searchOrders(input),
    enabled: input.length >= 4 && input !== submitted,
    staleTime: 10_000,
    retry: false,
  })

  // Full order fetch
  const orderQuery = useQuery({
    queryKey: ['order', submitted],
    queryFn: () => fetchOrder(submitted),
    enabled: !!submitted,
    staleTime: 5 * 60_000,
    retry: false,
  })

  const handleSubmit = (id: string) => {
    setInput(id)
    setSubmitted(id)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Order Lookup</h1>
        <p className="mt-1 text-sm text-slate-400">
          Inspect raw Olist order data — status, items, payments, delivery timeline
        </p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <input
          className="input pr-10 font-mono"
          placeholder="Paste or type an order ID…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && input.length >= 8 && handleSubmit(input)}
        />
        <button
          onClick={() => input.length >= 8 && handleSubmit(input)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:text-white transition-colors"
        >
          🔍
        </button>

        {/* Suggestions dropdown */}
        {searchQuery.data && searchQuery.data.length > 0 && input !== submitted && (
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-white/10 bg-surface-800 shadow-2xl overflow-hidden">
            {searchQuery.data.map(id => (
              <button
                key={id}
                onClick={() => handleSubmit(id)}
                className="block w-full px-4 py-2.5 text-left font-mono text-sm text-slate-300 hover:bg-white/6 hover:text-white transition-colors"
              >
                {id}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading */}
      {orderQuery.isLoading && submitted && (
        <div className="flex items-center gap-3 text-slate-400 text-sm">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-brand-400" />
          Loading order data…
        </div>
      )}

      {/* Error */}
      {orderQuery.isError && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/8 p-5 text-sm text-rose-300">
          <span className="font-semibold">Order not found: </span>
          <span className="font-mono">{submitted}</span>
          <p className="mt-1 text-rose-400/70 text-xs">{(orderQuery.error as Error)?.message}</p>
        </div>
      )}

      {/* Order card */}
      {orderQuery.data && (
        <div className="animate-slide-up">
          <OrderCard order={orderQuery.data} />

          {/* CTA to submit a case */}
          <div className="mt-4 rounded-xl border border-brand-500/20 bg-brand-600/6 p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-200">Have an issue with this order?</p>
              <p className="text-xs text-slate-500 mt-0.5">Submit it to the exception engine</p>
            </div>
            <a
              href={`/?order_id=${encodeURIComponent(orderQuery.data.order_id)}`}
              className="btn-primary shrink-0"
            >
              Submit Case →
            </a>
          </div>
        </div>
      )}

      {/* Prompt when empty */}
      {!submitted && (
        <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-slate-500 text-sm">
          Enter at least 8 characters of an order ID to look up
        </div>
      )}
    </div>
  )
}
