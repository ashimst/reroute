import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { submitCase, fetchOrder, type CaseRequest, type CaseResponse } from '../lib/api'
import { saveToHistory } from '../lib/utils'
import CaseForm from '../components/CaseForm'
import ResolutionCard from '../components/ResolutionCard'
import OrderCard from '../components/OrderCard'

export default function SubmitPage() {
  const [result, setResult]     = useState<CaseResponse | null>(null)
  const [orderId, setOrderId]   = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: submitCase,
    onSuccess: (data) => {
      setResult(data)
      setOrderId(data.order_id)
      saveToHistory(data)
    },
  })

  const orderQuery = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => fetchOrder(orderId!),
    enabled: !!orderId,
    staleTime: 5 * 60_000,
    retry: false,
  })

  const handleSubmit = (req: CaseRequest) => {
    setResult(null)
    mutation.mutate(req)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr] lg:items-start">
      {/* ── Left panel: form ──────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Submit Exception</h1>
          <p className="mt-1 text-sm text-slate-400">
            Route a customer order complaint through the REROUTE engine
          </p>
        </div>

        <div className="card p-5">
          <CaseForm onSubmit={handleSubmit} isLoading={mutation.isPending} />
        </div>

        {/* Order preview below form */}
        {orderId && !orderQuery.isLoading && !orderQuery.isError && orderQuery.data && (
          <div>
            <p className="section-title mb-2">Order Preview</p>
            <OrderCard order={orderQuery.data} compact />
          </div>
        )}
      </div>

      {/* ── Right panel: result ───────────────────────────────────────────── */}
      <div className="min-h-[300px]">
        {mutation.isPending && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-white/8 bg-surface-800 p-16 gap-4">
            <div className="relative">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-brand-500" />
              <span className="absolute inset-0 flex items-center justify-center text-lg">⚡</span>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-200">Running exception engine…</p>
              <p className="mt-1 text-xs text-slate-500">Routing · Policy retrieval · Tool execution</p>
            </div>
            <div className="flex gap-2 text-xs text-slate-600">
              {['OpenJEV routing', 'FAISS policy search', 'Cactus Needle tools', 'Groq fallback'].map((step, i) => (
                <span key={step} className="flex items-center gap-1">
                  <span className="h-1 w-1 rounded-full bg-slate-600 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
                  {step}
                </span>
              ))}
            </div>
          </div>
        )}

        {mutation.isError && (
          <div className="animate-fade-in rounded-xl border border-rose-500/20 bg-rose-500/8 p-6">
            <p className="font-semibold text-rose-300">Engine error</p>
            <p className="mt-1 text-sm text-rose-400/80">{mutation.error?.message}</p>
          </div>
        )}

        {result && !mutation.isPending && (
          <ResolutionCard result={result} />
        )}

        {!mutation.isPending && !mutation.isError && !result && (
          <EmptyState />
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 p-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-600/10 text-3xl">
        ⚡
      </div>
      <p className="text-base font-medium text-slate-300">Ready to route</p>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        Fill in an order ID and describe the customer's issue. The engine will route it,
        retrieve relevant policies, run deterministic tools, and return a structured resolution.
      </p>
      <div className="mt-6 grid grid-cols-3 gap-3 w-full max-w-sm">
        {[
          { emoji: '↩️', label: 'Returns', desc: 'Damaged, wrong, missing items' },
          { emoji: '📦', label: 'Delivery', desc: 'Late, lost, in-transit issues' },
          { emoji: '💳', label: 'Payment', desc: 'Duplicate charges, failures' },
        ].map(({ emoji, label, desc }) => (
          <div key={label} className="rounded-lg border border-white/6 bg-white/3 p-3">
            <p className="text-xl">{emoji}</p>
            <p className="mt-1 text-xs font-semibold text-slate-300">{label}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
