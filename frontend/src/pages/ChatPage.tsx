import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { streamChat, type ChatMessage, type ChatEvent, type CaseResponse, fetchOrder } from '../lib/api'
import { cn } from '../lib/utils'
import OrderCard from '../components/OrderCard'
import { useQuery } from '@tanstack/react-query'
import {
  Send,
  Square,
  X,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Cpu,
  Sparkles,
  RotateCcw,
  GitFork,
  ArrowRight,
} from 'lucide-react'

interface Bubble {
  id: string
  role: 'user' | 'assistant'
  text: string
  streaming: boolean
  intent?: { intent: string; confidence: number; reason: string }
  toolResult?: CaseResponse
  toolRunning?: boolean
  error?: string
}

function uid() {
  return Math.random().toString(36).slice(2)
}

const QUICK_PROMPTS = [
  {
    category: 'Damaged Goods',
    text: 'My product arrived damaged and I want a refund.',
    orderId: 'e481f51cbdc54678b7cc49136f2d6af7',
  },
  {
    category: 'Delivery Delay',
    text: 'My order is 3 days late and has not arrived yet.',
    orderId: '949d5b44dbf5de918fe9c16f97b45f8a',
  },
  {
    category: 'Duplicate Charge',
    text: 'I was charged twice for my order, please check payments.',
    orderId: '0016dfedd97fc2950e388d2971d718c7',
  },
  {
    category: 'Return Policy',
    text: 'What is your standard return and refund window policy?',
    orderId: undefined,
  },
]

function IntentPill({ intent, confidence, reason }: { intent: string; confidence: number; reason: string }) {
  const isTools = intent === 'tool_execution'
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-mono border',
        isTools
          ? 'border-[#FF5500]/30 bg-[#FF5500]/10 text-[#FF5500] dark:text-orange-400 font-medium'
          : 'border-stone-200 dark:border-white/[0.08] bg-stone-100 dark:bg-[#0E111A] text-stone-600 dark:text-slate-400',
      )}
      title={reason}
    >
      <span>{isTools ? 'STATE MACHINE PIPELINE' : 'CONVERSATIONAL QUERY'}</span>
      <span className="text-stone-400 dark:text-slate-500 font-sans">({Math.round(confidence * 100)}% conf)</span>
    </div>
  )
}

function ToolRunningIndicator() {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-orange-200 dark:border-[#FF5500]/30 bg-orange-50 dark:bg-[#FF5500]/10 px-3.5 py-2 text-xs text-[#FF5500] dark:text-orange-300 font-mono">
      <span className="h-2 w-2 rounded-full bg-[#FF5500] animate-pulse" />
      <span>Executing Cactus tools & FAISS vector search across policies...</span>
    </div>
  )
}

function InlineToolResult({ result }: { result: CaseResponse }) {
  const [expanded, setExpanded] = useState(false)
  const isApproved = result.resolution?.toLowerCase().includes('approved') || result.resolution?.toLowerCase().startsWith('refund')
  const isDenied = result.resolution?.toLowerCase() === 'denied'
  const isEscalated = result.escalate || result.resolution?.toLowerCase() === 'escalated'

  const borderClass = isApproved
    ? 'border-emerald-500/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300'
    : isDenied
    ? 'border-rose-500/40 bg-rose-50 text-rose-800 dark:bg-rose-950/20 dark:text-rose-300'
    : 'border-amber-500/40 bg-amber-50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300'

  return (
    <div className={cn('rounded-xl border p-3.5 space-y-2 text-xs', borderClass)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono">
          <span className="font-bold uppercase tracking-wider">{result.resolution || 'EVALUATED'}</span>
          <span className="text-stone-500 dark:text-slate-400 font-normal">
            &bull; Route: <strong className="text-stone-900 dark:text-white">{result.route}</strong>
          </span>
          {result.groq_used && (
            <span className="rounded bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.2 text-[10px] text-amber-700 dark:text-amber-300 font-semibold">
              Groq Fallback
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white flex items-center gap-1 font-sans text-[11px]"
        >
          <span>{expanded ? 'Hide Details' : 'View Trace'}</span>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {result.resolution_detail && (
        <p className="text-xs text-stone-700 dark:text-slate-300 leading-relaxed">{result.resolution_detail}</p>
      )}

      {expanded && (
        <div className="pt-2 border-t border-stone-200 dark:border-white/[0.08] space-y-2 font-mono text-[11px] text-stone-700 dark:text-slate-300">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-stone-400 dark:text-slate-500 block">Case ID</span>
              <span className="text-stone-900 dark:text-white font-semibold">{result.case_id}</span>
            </div>
            <div>
              <span className="text-stone-400 dark:text-slate-500 block">Confidence</span>
              <span className="text-stone-900 dark:text-white font-semibold">{Math.round((result.routing_confidence || 0) * 100)}%</span>
            </div>
          </div>
          {result.tools_executed && result.tools_executed.length > 0 && (
            <div>
              <span className="text-stone-400 dark:text-slate-500 block">Tools Executed:</span>
              <span className="text-[#FF5500] font-semibold">{result.tools_executed.join(', ')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ChatMessageBubble({ bubble }: { bubble: Bubble }) {
  const isUser = bubble.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={cn('flex gap-3 text-xs sm:text-sm', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg bg-[#FF5500] text-white font-mono text-[11px] font-bold shadow-sm">
          RF
        </div>
      )}

      <div className={cn('max-w-[85%] space-y-2', isUser && 'items-end flex flex-col')}>
        {bubble.intent && (
          <IntentPill
            intent={bubble.intent.intent}
            confidence={bubble.intent.confidence}
            reason={bubble.intent.reason}
          />
        )}

        {bubble.toolRunning && <ToolRunningIndicator />}
        {bubble.toolResult && <InlineToolResult result={bubble.toolResult} />}

        {(bubble.text || bubble.streaming) && (
          <div
            className={cn(
              'rounded-2xl px-4 py-2.5 leading-relaxed text-xs sm:text-sm',
              isUser
                ? 'bg-[#FF5500] text-white shadow-sm font-medium'
                : 'card border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#131519] text-stone-900 dark:text-slate-100 shadow-sm',
            )}
          >
            <div className="whitespace-pre-wrap">{bubble.text}</div>
            {bubble.streaming && (
              <span className="ml-1 inline-block h-3.5 w-1 animate-pulse bg-[#FF5500] align-middle" />
            )}
          </div>
        )}

        {bubble.error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-50 dark:bg-rose-950/20 px-3.5 py-2 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
            <span>{bubble.error}</span>
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg bg-stone-200 dark:bg-white/[0.1] text-stone-700 dark:text-slate-300 font-mono text-[11px] font-semibold">
          You
        </div>
      )}
    </motion.div>
  )
}

export default function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialUrlOrder = searchParams.get('order_id') || ''
  const initialMessage = searchParams.get('message') || ''

  const sessionId = useRef(uid())
  const [bubbles, setBubbles] = useState<Bubble[]>([
    {
      id: uid(),
      role: 'assistant',
      streaming: false,
      text: "Hello! I am your Retail Flow assistant. I can inspect delivery status, audit billing disputes, evaluate 30-day return policies, or adjudicate customer claims against Olist orders. Provide an order ID or describe your claim to begin.",
    },
  ])
  const [input, setInput] = useState(initialMessage)
  const [orderId, setOrderId] = useState(initialUrlOrder)
  const [isStreaming, setIsStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const orderQuery = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => fetchOrder(orderId),
    enabled: orderId.length === 32,
    staleTime: 5 * 60_000,
    retry: false,
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [bubbles])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [input])

  const buildHistory = useCallback((): ChatMessage[] => {
    return bubbles
      .filter((b) => b.text && !b.error)
      .map((b) => ({ role: b.role, content: b.text }))
  }, [bubbles])

  const send = useCallback(
    async (textToSend?: string, explicitOrder?: string) => {
      const msg = (textToSend ?? input).trim()
      if (!msg || isStreaming) return

      const activeOrder = (explicitOrder || orderId).trim() || undefined

      const userBubble: Bubble = { id: uid(), role: 'user', text: msg, streaming: false }
      setBubbles((prev) => [...prev, userBubble])
      setInput('')

      const asstId = uid()
      const asstBubble: Bubble = { id: asstId, role: 'assistant', text: '', streaming: true }
      setBubbles((prev) => [...prev, asstBubble])
      setIsStreaming(true)

      const ctrl = new AbortController()
      abortRef.current = ctrl

      try {
        const userMessage: ChatMessage = { role: 'user', content: msg }
        const messagesToSend = [...buildHistory(), userMessage]

        await streamChat(
          {
            session_id: sessionId.current,
            messages: messagesToSend,
            order_id: activeOrder,
          },
          (event: ChatEvent) => {
            setBubbles((prev) =>
              prev.map((b) => {
                if (b.id !== asstId) return b
                switch (event.type) {
                  case 'intent':
                    return {
                      ...b,
                      intent: {
                        intent: event.content.intent,
                        confidence: event.content.confidence,
                        reason: event.content.reason,
                      },
                    }
                  case 'tool_start':
                    return { ...b, toolRunning: true }
                  case 'tool_result':
                    return { ...b, toolRunning: false, toolResult: event.content }
                  case 'text':
                    return { ...b, text: b.text + (event.content || '') }
                  case 'error':
                    return { ...b, error: String(event.content), streaming: false }
                  case 'done':
                    return { ...b, streaming: false }
                  default:
                    return b
                }
              }),
            )
          },
          ctrl.signal,
        )
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setBubbles((prev) =>
            prev.map((b) => (b.id === asstId ? { ...b, error: err.message, streaming: false } : b)),
          )
        }
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [input, isStreaming, orderId, buildHistory],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  const clearChat = () => {
    setBubbles([
      {
        id: uid(),
        role: 'assistant',
        streaming: false,
        text: "Session cleared. How can I assist with order inspection or corporate policies?",
      },
    ])
  }

  return (
    <div className="flex h-[calc(100vh-140px)] flex-col gap-3">
      {/* ── Subheader ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-stone-200 dark:border-white/[0.06] pb-3 shrink-0">
        <div>
          <h1 className="text-base font-semibold text-stone-900 dark:text-white flex items-center gap-2">
            <span>Conversational Adjudication Assistant</span>
          </h1>
          <p className="text-xs text-stone-500 dark:text-slate-400">
            System-1 Intent Dispatch &bull; Deterministic LangGraph Execution &bull; Policy Vector Retrieval
          </p>
        </div>

        <div className="flex items-center gap-2">
          {bubbles.length > 1 && (
            <button
              type="button"
              onClick={clearChat}
              className="btn-ghost text-xs py-1 px-2.5"
            >
              Reset Session
            </button>
          )}
          <Link
            to={orderId ? `/submit?order_id=${encodeURIComponent(orderId)}` : '/submit'}
            className="btn-secondary text-xs py-1 px-3"
          >
            <span>Open in Studio</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* ── Chat Messages Scroll Canvas ───────────────────────────────── */}
      <div className="flex flex-1 gap-4 min-h-0">
        <div className="flex flex-1 flex-col min-w-0">
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-2">
            {bubbles.map((b) => (
              <ChatMessageBubble key={b.id} bubble={b} />
            ))}
            <div ref={bottomRef} />
          </div>

          {/* ── Bottom Input Area with Compact Suggestion Chips ─────────── */}
          <div className="pt-2 space-y-2 shrink-0">
            {/* Quick Prompts Strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-stone-400 dark:text-slate-500 text-[11px] font-medium shrink-0">Suggestions:</span>
              {QUICK_PROMPTS.map((qp, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (qp.orderId) {
                      setOrderId(qp.orderId)
                      setSearchParams({ order_id: qp.orderId })
                    }
                    send(qp.text, qp.orderId)
                  }}
                  className="rounded-full border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#121520] px-3 py-1 text-stone-700 dark:text-slate-300 hover:text-[#FF5500] dark:hover:text-white hover:border-[#FF5500]/40 hover:bg-stone-50 dark:hover:bg-[#161A28] transition-all whitespace-nowrap text-xs shadow-xs"
                >
                  <span className="font-semibold text-[#FF5500]">{qp.category}:</span> {qp.text}
                </button>
              ))}
            </div>

            {/* Input Composer */}
            <div className="card p-2.5 flex flex-col gap-2 border-stone-200 dark:border-white/[0.1] bg-white dark:bg-[#0E111A] shadow-sm">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe customer claim or ask policy question... (Press Enter to send)"
                className="w-full bg-transparent px-3 py-1.5 text-xs sm:text-sm text-stone-900 dark:text-slate-100 placeholder:text-stone-400 dark:placeholder:text-slate-500 outline-none resize-none"
              />

              <div className="flex items-center justify-between border-t border-stone-100 dark:border-white/[0.06] pt-2 px-1">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={orderId}
                    onChange={(e) => {
                      setOrderId(e.target.value)
                      if (e.target.value) setSearchParams({ order_id: e.target.value })
                      else setSearchParams({})
                    }}
                    placeholder="Set order ID context..."
                    className="rounded bg-stone-100 dark:bg-black/40 border border-stone-200 dark:border-white/[0.08] px-2.5 py-1 font-mono text-[11px] text-stone-900 dark:text-slate-200 placeholder:text-stone-400 outline-none w-52 focus:border-[#FF5500]"
                  />
                  {orderId && (
                    <button
                      type="button"
                      onClick={() => {
                        setOrderId('')
                        setSearchParams({})
                      }}
                      className="text-stone-400 hover:text-stone-700 dark:hover:text-slate-300"
                      title="Clear order ID"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-stone-400 dark:text-slate-500 hidden sm:inline">
                    Shift+Enter for newline
                  </span>
                  {isStreaming ? (
                    <button
                      type="button"
                      onClick={() => abortRef.current?.abort()}
                      className="btn-danger py-1 px-3 text-xs"
                    >
                      <Square className="h-3 w-3 fill-current" />
                      <span>Stop</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => send(input)}
                      disabled={!input.trim()}
                      className="btn-primary py-1 px-3 text-xs"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>Send</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bound Order Sidebar if Order ID is 32-hex */}
        {orderId.length === 32 && orderQuery.data && (
          <div className="hidden lg:block w-80 shrink-0 overflow-y-auto">
            <span className="text-[11px] font-mono text-slate-500 uppercase font-medium block mb-2">
              Bound Order Context
            </span>
            <OrderCard order={orderQuery.data} compact showActions={false} />
          </div>
        )}
      </div>
    </div>
  )
}
