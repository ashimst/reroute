import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { fetchExamples, type CaseRequest } from '../lib/api'
import { cn } from '../lib/utils'
import { ArrowRight, Sparkles, ChevronDown } from 'lucide-react'

interface Props {
  onSubmit: (req: CaseRequest) => void
  isLoading: boolean
  initialOrderId?: string
  initialMessage?: string
}

export default function CaseForm({ onSubmit, isLoading, initialOrderId, initialMessage }: Props) {
  const [orderId, setOrderId] = useState(initialOrderId || '')
  const [message, setMessage] = useState(initialMessage || '')
  const [caseId, setCaseId] = useState('')
  const [simulatedDays, setSimulatedDays] = useState<number>(4)
  const [selectedExample, setSelectedExample] = useState<any | null>(null)

  const { data: examples } = useQuery({
    queryKey: ['examples'],
    queryFn: fetchExamples,
    staleTime: Infinity,
  })

  const handleSelectExample = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCaseId = e.target.value
    if (!selectedCaseId) {
      setSelectedExample(null)
      return
    }
    const found = (examples || []).find((x) => x.case_id === selectedCaseId)
    if (found) {
      setSelectedExample(found)
      setCaseId(found.case_id)
      setOrderId(found.order_id)
      setMessage(found.customer_message)
      if (found.simulated_days_post_delivery != null) {
        setSimulatedDays(found.simulated_days_post_delivery)
      }
    }
  }

  const fillQuickPreset = (cId: string) => {
    const found = (examples || []).find((x) => x.case_id === cId)
    if (found) {
      setSelectedExample(found)
      setCaseId(found.case_id)
      setOrderId(found.order_id)
      setMessage(found.customer_message)
      if (found.simulated_days_post_delivery != null) {
        setSimulatedDays(found.simulated_days_post_delivery)
      }
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!orderId.trim() || !message.trim()) return
    onSubmit({
      case_id: caseId.trim() || undefined,
      order_id: orderId.trim(),
      customer_message: message.trim(),
      simulated_days_post_delivery: simulatedDays,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* ── Preset Picker ──────────────────────────────────────────────── */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-stone-700 dark:text-slate-300 flex items-center justify-between">
          <span>Benchmark Case Presets</span>
          <span className="text-[11px] text-stone-400 dark:text-slate-500 font-mono">15 Scenarios</span>
        </label>
        
        <div className="relative">
          <select
            value={caseId}
            onChange={handleSelectExample}
            className="input pr-8 appearance-none cursor-pointer text-xs"
          >
            <option value="">Choose a benchmark test case...</option>
            {(examples || []).map((ex) => (
              <option key={ex.case_id} value={ex.case_id} className="bg-white dark:bg-[#131519] text-stone-900 dark:text-white">
                {ex.case_id} &bull; {ex.scenario?.replace(/_/g, ' ')} ({ex.expected_route})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 dark:text-slate-400 pointer-events-none" />
        </div>

        {/* Quick chip pills for the most common tests */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {[
            { id: 'CASE-001', label: 'Damaged Item' },
            { id: 'CASE-004', label: 'Delayed Order' },
            { id: 'CASE-007', label: 'Double Charge' },
            { id: 'CASE-011', label: 'Ambiguous Edge' },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => fillQuickPreset(id)}
              className={cn(
                'rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all border',
                caseId === id
                  ? 'border-[#FF5500] bg-[#FF5500] text-white font-semibold shadow-xs'
                  : 'border-[#DCDCD4] dark:border-[#262930] bg-[#FAF9F5] dark:bg-[#181B21] text-stone-700 dark:text-slate-300 hover:text-[#FF5500] dark:hover:text-white hover:border-[#FF5500]/50',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Selected Preset Details & Relative Time Anchor Badge */}
        {selectedExample && (
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-[#F4F4F0] dark:bg-[#131519] p-3 text-xs space-y-2 mt-2">
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="font-semibold text-stone-900 dark:text-white uppercase">{selectedExample.scenario?.replace(/_/g, ' ')}</span>
              <span className="rounded bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 text-[#FF5500] font-bold">
                {selectedExample.expected_outcome || selectedExample.expected_route}
              </span>
            </div>
            {selectedExample.notes && (
              <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed font-sans">
                {selectedExample.notes}
              </p>
            )}
          </div>
        )}

        {/* Simulated Days Post-Delivery Stepper */}
        <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white/70 dark:bg-[#181B21]/70 p-2.5 flex items-center justify-between gap-3 text-xs mt-2">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono text-stone-500 dark:text-stone-400 uppercase font-semibold flex items-center gap-1.5">
              <span>⏱️ Time-Anchor:</span>
              <span className="text-[#FF5500]">+{simulatedDays} days post-delivery</span>
            </span>
            <span className="text-[10px] text-stone-400 dark:text-stone-500 block">
              Anchors historical 2016-2018 Olist orders to meaningful policy windows
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0 font-mono">
            <button
              type="button"
              onClick={() => setSimulatedDays((d) => Math.max(0, d - 1))}
              className="h-6 w-6 rounded border border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 flex items-center justify-center hover:bg-stone-200 dark:hover:bg-stone-700"
              title="Decrease offset"
            >
              -
            </button>
            <span className="w-8 text-center font-bold text-stone-900 dark:text-white text-xs">
              {simulatedDays}d
            </span>
            <button
              type="button"
              onClick={() => setSimulatedDays((d) => d + 1)}
              className="h-6 w-6 rounded border border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 flex items-center justify-center hover:bg-stone-200 dark:hover:bg-stone-700"
              title="Increase offset"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-[#DCDCD4] dark:border-[#262930] pt-3 space-y-4">
        {/* Order ID Input */}
        <div>
          <label className="label">
            <span className="text-stone-700 dark:text-slate-300 font-medium">Olist Order ID</span>
            <span className="text-[10px] text-stone-400 dark:text-slate-500 font-mono">32-hex</span>
          </label>
          <input
            type="text"
            required
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="e.g. e481f51cbdc54678b7cc49136f2d6af7"
            className="input font-mono text-xs"
          />
        </div>

        {/* Customer Claim Textarea */}
        <div>
          <label className="label">
            <span className="text-stone-700 dark:text-slate-300 font-medium">Customer Exception Description</span>
            <span className="text-[10px] text-stone-400 dark:text-slate-500 font-mono">{message.length}/1000</span>
          </label>
          <textarea
            required
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe the complaint or claim (e.g., 'Product arrived damaged, requesting full refund')..."
            className="input text-xs leading-relaxed resize-none"
          />
        </div>

        {/* Case ID Optional */}
        <div>
          <label className="label">
            <span className="text-stone-700 dark:text-slate-300 font-medium">Case Tracking ID</span>
            <span className="text-[10px] text-stone-400 dark:text-slate-500 font-mono">Optional</span>
          </label>
          <input
            type="text"
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
            placeholder="Auto-generated CASE-XXXXXXXX if empty"
            className="input font-mono text-xs"
          />
        </div>
      </div>

      {/* Action Submit Button */}
      <motion.button
        type="submit"
        disabled={isLoading || !orderId.trim() || !message.trim()}
        whileHover={{ scale: isLoading ? 1 : 1.01 }}
        whileTap={{ scale: isLoading ? 1 : 0.99 }}
        className="btn-primary w-full py-2.5 text-xs font-semibold shadow-md shadow-brand-500/20"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            <span>Traversing LangGraph State Machine...</span>
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <span>Run Exception Pipeline</span>
            <ArrowRight className="h-4 w-4" />
          </span>
        )}
      </motion.button>
    </form>
  )
}
