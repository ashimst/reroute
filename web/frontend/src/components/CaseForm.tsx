import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchExamples, type CaseRequest } from '../lib/api'
import { cn, truncate } from '../lib/utils'

interface Props {
  onSubmit: (req: CaseRequest) => void
  isLoading: boolean
}

const PLACEHOLDERS = [
  'My product arrived damaged and I want a refund.',
  'My order is three days late and I have not received it yet.',
  'I was charged twice for this order.',
  'The tracking says delivered but I have not received anything.',
  'I received the wrong item and want a replacement.',
]

export default function CaseForm({ onSubmit, isLoading }: Props) {
  const [orderId, setOrderId]       = useState('')
  const [message, setMessage]       = useState('')
  const [caseId, setCaseId]         = useState('')
  const [placeholder]               = useState(() => PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)])

  const { data: examples } = useQuery({
    queryKey: ['examples'],
    queryFn: fetchExamples,
    staleTime: Infinity,
  })

  const fillExample = useCallback((ex: { case_id: string; order_id: string; customer_message: string }) => {
    setCaseId(ex.case_id)
    setOrderId(ex.order_id)
    setMessage(ex.customer_message)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!orderId.trim() || !message.trim()) return
    onSubmit({ case_id: caseId || undefined, order_id: orderId.trim(), customer_message: message.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Case ID (optional) */}
      <div>
        <label className="label">Case ID <span className="normal-case font-normal text-slate-600">(optional)</span></label>
        <input
          className="input font-mono"
          placeholder="e.g. CASE-001 — auto-generated if blank"
          value={caseId}
          onChange={e => setCaseId(e.target.value)}
        />
      </div>

      {/* Order ID */}
      <div>
        <label className="label">Order ID <span className="text-rose-400">*</span></label>
        <input
          className="input font-mono"
          placeholder="e.g. e481f51cbdc54678b7cc49136f2d6af7"
          value={orderId}
          onChange={e => setOrderId(e.target.value)}
          required
          minLength={8}
        />
        <p className="mt-1 text-xs text-slate-500">Paste any Olist order ID</p>
      </div>

      {/* Customer message */}
      <div>
        <label className="label">Customer Message <span className="text-rose-400">*</span></label>
        <textarea
          className="input min-h-[110px] resize-none leading-relaxed"
          placeholder={placeholder}
          value={message}
          onChange={e => setMessage(e.target.value)}
          required
          minLength={5}
          maxLength={1000}
        />
        <p className="mt-1 flex justify-between text-xs text-slate-500">
          <span>Describe the customer's issue</span>
          <span className={cn(message.length > 900 ? 'text-amber-400' : '')}>{message.length}/1000</span>
        </p>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading || !orderId.trim() || !message.trim()}
        className="btn-primary w-full justify-center py-3 text-base"
      >
        {isLoading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Processing…
          </>
        ) : (
          <>
            <span>⚡</span>
            Run Exception Engine
          </>
        )}
      </button>

      {/* Example cases */}
      {examples && examples.length > 0 && (
        <div>
          <p className="section-title mb-2">Quick Examples</p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {examples.map((ex) => (
              <button
                key={ex.case_id}
                type="button"
                onClick={() => fillExample(ex)}
                className={cn(
                  'w-full rounded-lg border border-white/8 bg-white/4 px-3 py-2.5 text-left',
                  'transition-all duration-150 hover:border-brand-500/40 hover:bg-brand-600/8',
                  'group',
                )}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-mono text-brand-400 group-hover:text-brand-300">
                    {ex.case_id}
                  </span>
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-white/6 text-slate-400 capitalize">
                    {ex.scenario.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-xs text-slate-400 group-hover:text-slate-300 leading-snug">
                  {truncate(ex.customer_message, 90)}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  )
}
