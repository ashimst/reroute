import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { submitCase, fetchOrder, type CaseRequest, type CaseResponse } from '../lib/api'
import { saveToHistory } from '../lib/utils'
import CaseForm from '../components/CaseForm'
import ResolutionCard from '../components/ResolutionCard'
import OrderCard from '../components/OrderCard'
import { Cpu, GitFork, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react'

export default function SubmitPage() {
  const [searchParams] = useSearchParams()
  const initialOrderId = searchParams.get('order_id') || ''

  const [result, setResult] = useState<CaseResponse | null>(null)
  const [orderId, setOrderId] = useState<string | null>(initialOrderId || null)

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
    enabled: !!orderId && orderId.length >= 8,
    staleTime: 5 * 60_000,
    retry: false,
  })

  const handleSubmit = (req: CaseRequest) => {
    setResult(null)
    setOrderId(req.order_id)
    mutation.mutate(req)
  }

  return (
    <div className="space-y-6">
      {/* ── Minimalist Workspace Header ───────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DCDCD4] dark:border-[#262930] pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-white flex items-center gap-2">
            <span>Exception Studio</span>
            <span className="text-stone-300 dark:text-slate-600 font-normal">/</span>
            <span className="text-xs text-stone-500 dark:text-slate-400 font-normal font-mono">Adjudication Engine</span>
          </h1>
          <p className="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
            Evaluate customer claims through the deterministic LangGraph pipeline, Cactus Needle tools, and FAISS policy retrieval.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-stone-500 dark:text-slate-400">
          <span className="rounded-lg bg-[#FAF9F5] dark:bg-[#181B21] border border-[#DCDCD4] dark:border-[#262930] px-3 py-1">
            Engine: <strong className="text-stone-800 dark:text-slate-200 font-semibold">StateGraph v1.0</strong>
          </span>
        </div>
      </div>

      {/* ── Balanced Two-Column Layout ──────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[420px_1fr] items-start">
        {/* Left Column: Input Form */}
        <div className="space-y-4">
          <div className="card p-5">
            <CaseForm
              onSubmit={handleSubmit}
              isLoading={mutation.isPending}
              initialOrderId={initialOrderId}
              initialMessage={searchParams.get('message') || ''}
            />
          </div>

          {/* Bound Order Preview below the form if found */}
          {orderId && orderQuery.data && !orderQuery.isError && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono text-stone-500 dark:text-slate-400 uppercase font-medium">
                Linked Olist Order Metadata
              </span>
              <OrderCard order={orderQuery.data} compact showActions={false} />
            </div>
          )}
        </div>

        {/* Right Column: Execution State or Adjudication Result */}
        <div className="min-h-[460px]">
          {/* Running State with Animated Progress */}
          {mutation.isPending && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-10 flex flex-col items-center justify-center text-center space-y-4"
            >
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#FF5500]/20 border-t-[#FF5500]" />
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-stone-900 dark:text-white">Traversing State Machine DAG</h3>
                <p className="text-xs text-stone-500 dark:text-slate-400 max-w-sm">
                  Executing OpenJEV semantic router &rarr; Cactus Needle verification tools &rarr; FAISS policy vector lookup...
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 w-full max-w-sm pt-3 text-left font-mono text-[11px]">
                <div className="rounded-lg bg-[#FAF9F5] dark:bg-[#181B21] border border-[#DCDCD4] dark:border-[#262930] p-2.5">
                  <span className="text-stone-400 dark:text-slate-500 text-[10px] block">Router</span>
                  <span className="text-[#FF5500] font-semibold animate-pulse">Classifying...</span>
                </div>
                <div className="rounded-lg bg-[#FAF9F5] dark:bg-[#181B21] border border-[#DCDCD4] dark:border-[#262930] p-2.5">
                  <span className="text-stone-400 dark:text-slate-500 text-[10px] block">Tools</span>
                  <span className="text-stone-600 dark:text-slate-400">Verifying...</span>
                </div>
                <div className="rounded-lg bg-[#FAF9F5] dark:bg-[#181B21] border border-[#DCDCD4] dark:border-[#262930] p-2.5">
                  <span className="text-stone-400 dark:text-slate-500 text-[10px] block">Policies</span>
                  <span className="text-stone-600 dark:text-slate-400">FAISS Search...</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Error State */}
          {mutation.isError && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-6 border-rose-500/30 bg-rose-50 text-rose-800 dark:bg-rose-950/20 dark:text-rose-200 space-y-2"
            >
              <h3 className="text-sm font-bold text-rose-700 dark:text-rose-300">Pipeline Execution Error</h3>
              <p className="text-xs leading-relaxed">
                {(mutation.error as Error)?.message || 'An unexpected error occurred during execution.'}
              </p>
            </motion.div>
          )}

          {/* Completed Verdict Result */}
          {result && !mutation.isPending && (
            <motion.div
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <ResolutionCard result={result} />
            </motion.div>
          )}

          {/* Idle Empty State */}
          {!result && !mutation.isPending && !mutation.isError && (
            <div className="card p-12 flex flex-col items-center justify-center text-center space-y-4 text-stone-500 dark:text-slate-400 min-h-[460px] border-dashed">
              <div className="h-12 w-12 rounded-2xl bg-[#FAF9F5] dark:bg-[#181B21] border border-[#DCDCD4] dark:border-[#262930] flex items-center justify-center text-stone-600 dark:text-slate-300 shadow-sm">
                <GitFork className="h-6 w-6 text-[#FF5500]" />
              </div>
              <div className="space-y-1.5 max-w-sm">
                <h3 className="text-sm font-semibold text-stone-900 dark:text-white">Exception Pipeline Awaiting Input</h3>
                <p className="text-xs text-stone-500 dark:text-slate-400 leading-relaxed">
                  Select a benchmark scenario from the left or enter any 32-character Olist Order ID to trigger automated triaging and policy evaluation.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-stone-400 dark:text-slate-500 pt-2">
                <span>Fast deterministic core</span>
                <span>&bull;</span>
                <span>&lt; 50ms typical latency</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
