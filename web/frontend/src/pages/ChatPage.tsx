import { useState, useRef, useEffect, useCallback } from 'react'
import { streamChat, type ChatMessage, type ChatEvent, type CaseResponse } from '../lib/api'
import { cn, formatResolution, resolutionBg, routeBadge, formatConfidence } from '../lib/utils'
import OrderCard from '../components/OrderCard'
import { useQuery } from '@tanstack/react-query'
import { fetchOrder } from '../lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Bubble {
  id: string
  role: 'user' | 'assistant'
  text: string            // accumulated text
  streaming: boolean
  intent?: { intent: string; confidence: number; reason: string }
  toolResult?: CaseResponse
  toolRunning?: boolean
  error?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2) }

const SUGGESTIONS = [
  { text: 'My product arrived damaged, I want a refund', orderId: 'e481f51cbdc54678b7cc49136f2d6af7' },
  { text: 'My order is late and I have not received it', orderId: '949d5b44dbf5de918fe9c16f97b45f8a' },
  { text: 'I was charged twice for my order',             orderId: '0016dfedd97fc2950e388d2971d718c7' },
  { text: 'What is your return policy?',                  orderId: undefined },
  { text: 'How do I track my package?',                   orderId: undefined },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function IntentPill({ intent, confidence, reason }: { intent: string; confidence: number; reason: string }) {
  const isTools = intent === 'tool_execution'
  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold',
      isTools
        ? 'bg-brand-600/20 text-brand-300'
        : 'bg-slate-700/60 text-slate-400'
    )} title={reason}>
      {isTools ? '⚙️' : '💬'}
      {isTools ? 'Running exception engine' : 'Chat mode'}
      <span className="opacity-60">· {Math.round(confidence * 100)}%</span>
    </div>
  )
}

function ToolRunningIndicator() {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-brand-600/10 px-3 py-2 text-xs text-brand-300">
      <span className="h-3 w-3 animate-spin rounded-full border border-brand-400/30 border-t-brand-400" />
      Routing · Policy search · Tool execution…
    </div>
  )
}

function InlineToolResult({ result }: { result: CaseResponse }) {
  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-[#0f1117] overflow-hidden text-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/8 bg-white/3 px-3 py-2">
        <span className="font-mono text-slate-500">{result.case_id}</span>
        <span className={cn('badge', routeBadge(result.route))}>
          {result.route}
        </span>
        <span className={cn('badge', resolutionBg(result.resolution))}>
          {formatResolution(result.resolution)}
        </span>
        {result.escalate && (
          <span className="badge bg-amber-500/15 text-amber-300 border border-amber-500/20">⚠ Escalated</span>
        )}
        <span className="ml-auto text-slate-600">{formatConfidence(result.confidence)} confidence</span>
      </div>

      {/* Tools + policies */}
      <div className="grid grid-cols-2 divide-x divide-white/6">
        <div className="px-3 py-2">
          <p className="section-title mb-1.5">Tools</p>
          <div className="space-y-0.5">
            {result.tools_executed.map((t, i) => (
              <p key={i} className="font-mono text-[10px] text-slate-400">{t}</p>
            ))}
          </div>
        </div>
        <div className="px-3 py-2">
          <p className="section-title mb-1.5">Policies</p>
          <div className="flex flex-wrap gap-1">
            {result.retrieved_policies.slice(0, 4).map((p, i) => (
              <span key={i} className="tag text-[10px]">{p.policy_id}</span>
            ))}
          </div>
          {result.applicable_rules.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {result.applicable_rules.map((r, i) => (
                <span key={i} className="rounded bg-brand-600/15 px-1.5 py-0.5 text-[10px] font-mono text-brand-400">{r}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Refund */}
      {result.refund_amount != null && (
        <div className="border-t border-white/8 px-3 py-2 text-emerald-400 font-semibold">
          Refund: ${result.refund_amount.toFixed(2)}
        </div>
      )}
    </div>
  )
}

function MessageBubble({ bubble }: { bubble: Bubble }) {
  const isUser = bubble.role === 'user'

  return (
    <div className={cn('flex gap-3 animate-slide-up', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold mt-0.5',
        isUser
          ? 'bg-brand-600 text-white'
          : 'bg-slate-700 text-slate-300'
      )}>
        {isUser ? 'U' : 'R'}
      </div>

      {/* Content */}
      <div className={cn('max-w-[78%] space-y-1.5', isUser && 'items-end flex flex-col')}>
        {/* Intent pill (assistant only) */}
        {bubble.intent && (
          <IntentPill
            intent={bubble.intent.intent}
            confidence={bubble.intent.confidence}
            reason={bubble.intent.reason}
          />
        )}

        {/* Tool running indicator */}
        {bubble.toolRunning && <ToolRunningIndicator />}

        {/* Tool result card */}
        {bubble.toolResult && <InlineToolResult result={bubble.toolResult} />}

        {/* Text bubble */}
        {(bubble.text || bubble.streaming) && (
          <div className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'bg-brand-600 text-white rounded-tr-sm'
              : 'bg-[#1c1f2e] text-slate-200 rounded-tl-sm border border-white/6'
          )}>
            {bubble.text}
            {bubble.streaming && (
              <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current align-middle opacity-70" />
            )}
          </div>
        )}

        {/* Error */}
        {bubble.error && (
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/8 px-3 py-2 text-xs text-rose-300">
            {bubble.error}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const sessionId = useRef(uid())
  const [bubbles, setBubbles] = useState<Bubble[]>([
    {
      id: uid(),
      role: 'assistant',
      streaming: false,
      text: "Hi! I'm the REROUTE assistant. Paste your order ID and describe your issue — I'll automatically run the exception engine if needed, or just have a conversation. How can I help you?",
    },
  ])
  const [input, setInput] = useState('')
  const [orderId, setOrderId] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Order preview
  const orderQuery = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => fetchOrder(orderId),
    enabled: orderId.length === 32,
    staleTime: 5 * 60_000,
    retry: false,
  })

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [bubbles])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [input])

  const buildHistory = useCallback((): ChatMessage[] =>
    bubbles
      .filter(b => b.text)
      .map(b => ({ role: b.role, content: b.text })),
    [bubbles]
  )

  const send = useCallback(async (text: string, autoOrderId?: string) => {
    const msg = text.trim()
    if (!msg || isStreaming) return

    const effectiveOrderId = autoOrderId ?? (orderId.length === 32 ? orderId : undefined)

    // Add user bubble
    const userBubble: Bubble = { id: uid(), role: 'user', text: msg, streaming: false }
    setBubbles(prev => [...prev, userBubble])
    setInput('')

    // Add empty assistant bubble
    const asstId = uid()
    const asstBubble: Bubble = { id: asstId, role: 'assistant', text: '', streaming: true }
    setBubbles(prev => [...prev, asstBubble])
    setIsStreaming(true)

    const ctrl = new AbortController()
    abortRef.current = ctrl

    const messages: ChatMessage[] = [
      ...buildHistory(),
      { role: 'user', content: msg },
    ]

    try {
      await streamChat(
        { session_id: sessionId.current, messages, order_id: effectiveOrderId },
        (evt: ChatEvent) => {
          setBubbles(prev => prev.map(b => {
            if (b.id !== asstId) return b

            switch (evt.type) {
              case 'intent':
                return { ...b, intent: evt.content }

              case 'tool_start':
                return { ...b, toolRunning: true }

              case 'tool_result':
                // Auto-fill order ID from tool result
                if (evt.content?.order_id) setOrderId(evt.content.order_id)
                return { ...b, toolRunning: false, toolResult: evt.content }

              case 'text':
                return { ...b, text: b.text + evt.content }

              case 'error':
                return { ...b, error: evt.content?.message ?? 'Unknown error', streaming: false, toolRunning: false }

              case 'done':
                return { ...b, streaming: false, toolRunning: false }

              default:
                return b
            }
          }))
        },
        ctrl.signal,
      )
    } catch (err: any) {
      if (err.name === 'AbortError') return
      setBubbles(prev => prev.map(b =>
        b.id === asstId
          ? { ...b, streaming: false, toolRunning: false, error: err.message }
          : b
      ))
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [isStreaming, orderId, buildHistory])

  const stop = () => {
    abortRef.current?.abort()
    setIsStreaming(false)
    setBubbles(prev => prev.map((b, i) =>
      i === prev.length - 1 && b.streaming ? { ...b, streaming: false } : b
    ))
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-112px)] max-w-4xl flex-col gap-0">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-white/8 pb-4 mb-4 shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-white">Chat Assistant</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Conversational support — automatically routes to exception engine when needed
          </p>
        </div>
        {/* System-1 legend */}
        <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><span className="text-brand-400">⚙️</span> Tool execution</span>
          <span className="flex items-center gap-1"><span>💬</span> Direct chat</span>
        </div>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* ── Chat column ───────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-5 pr-1 pb-4">
            {/* Suggestion chips (only when empty conversation) */}
            {bubbles.length === 1 && (
              <div className="space-y-2">
                <p className="section-title">Try an example</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        if (s.orderId) setOrderId(s.orderId)
                        send(s.text, s.orderId)
                      }}
                      className="rounded-full border border-white/10 bg-white/4 px-3 py-1.5 text-xs
                                 text-slate-400 transition-all hover:border-brand-500/40 hover:bg-brand-600/8
                                 hover:text-slate-200"
                    >
                      {s.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {bubbles.map(b => <MessageBubble key={b.id} bubble={b} />)}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div className="shrink-0 pt-3 border-t border-white/8">
            {/* Order ID badge */}
            {orderId && (
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs text-slate-500">Order context:</span>
                <span className="tag font-mono text-[10px]">{orderId}</span>
                <button
                  onClick={() => setOrderId('')}
                  className="text-[10px] text-slate-600 hover:text-rose-400 transition-colors"
                >
                  ×
                </button>
              </div>
            )}

            <div className="flex items-end gap-2">
              <div className="relative flex-1">
                <textarea
                  ref={textareaRef}
                  className="input w-full resize-none overflow-hidden py-3 pr-12 leading-relaxed"
                  placeholder="Ask about your order or describe an issue… (Shift+Enter for newline)"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  rows={1}
                  disabled={isStreaming}
                />
              </div>

              {isStreaming ? (
                <button
                  onClick={stop}
                  className="btn-secondary shrink-0 h-[44px] w-[44px] justify-center p-0 text-rose-400"
                  title="Stop"
                >
                  ■
                </button>
              ) : (
                <button
                  onClick={() => send(input)}
                  disabled={!input.trim()}
                  className="btn-primary shrink-0 h-[44px] w-[44px] justify-center p-0"
                  title="Send (Enter)"
                >
                  ↑
                </button>
              )}
            </div>

            <div className="mt-2 flex items-center gap-3">
              {/* Inline order ID input */}
              <input
                className="input h-7 w-72 py-0 text-[11px] font-mono"
                placeholder="Optional: paste order ID to add context"
                value={orderId}
                onChange={e => setOrderId(e.target.value.trim())}
              />
              <span className="text-[10px] text-slate-600">
                Order ID auto-detected from messages too
              </span>
            </div>
          </div>
        </div>

        {/* ── Side panel: order preview ─────────────────────────────────── */}
        {orderId.length === 32 && (
          <div className="hidden lg:flex w-72 shrink-0 flex-col gap-3 overflow-y-auto">
            <p className="section-title shrink-0">Order Preview</p>
            {orderQuery.isLoading && (
              <p className="text-xs text-slate-500 animate-pulse">Loading order…</p>
            )}
            {orderQuery.data && (
              <div className="animate-slide-in-right">
                <OrderCard order={orderQuery.data} compact />
              </div>
            )}
            {orderQuery.isError && (
              <p className="text-xs text-rose-400">Order not found</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
