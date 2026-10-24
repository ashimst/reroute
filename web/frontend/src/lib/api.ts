import axios from 'axios'

export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8001').replace(/\/+$/, '')

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 60_000,        // 60 s — engine warmup on first call can be slow
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const detail = err.response?.data?.detail ?? err.message ?? 'Unknown error'
    return Promise.reject(new Error(String(detail)))
  },
)

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PolicyHit {
  policy_id: string
  policy_text: string
  source_file: string
  score: number
}

export interface GroqResult {
  interpretation: string
  recommended_action: string
  confidence: number
  needs_human: boolean
  groq_model?: string
  error?: string
}

export interface CaseResponse {
  case_id: string
  order_id: string
  customer_message: string
  route?: string
  routing_confidence?: number
  routing_backend?: string
  resolution?: string
  resolution_detail?: string
  escalate: boolean
  escalate_reason?: string
  refund_amount?: number
  confidence: number
  groq_used: boolean
  groq_result?: GroqResult
  tools_executed: string[]
  applicable_rules: string[]
  retrieved_policies: PolicyHit[]
  errors: string[]
}

export interface CaseRequest {
  case_id?: string
  order_id: string
  customer_message: string
}

export interface ExampleCase {
  case_id: string
  order_id: string
  customer_message: string
  scenario: string
  expected_route: string
  notes: string
}

export interface OrderItem {
  order_id: string
  order_item_id: number
  product_id: string
  seller_id: string
  shipping_limit_date?: string
  price: number
  freight_value: number
}

export interface PaymentRecord {
  order_id: string
  payment_sequential: number
  payment_type: string
  payment_installments: number
  payment_value: number
}

export interface CustomerRecord {
  customer_id: string
  customer_unique_id: string
  customer_zip_code_prefix: string
  customer_city: string
  customer_state: string
}

export interface OrderDetail {
  order_id: string
  order_status?: string
  purchase_date?: string
  estimated_delivery_date?: string
  delivery_date?: string
  is_delivered: boolean
  is_late: boolean
  days_late: number
  days_since_purchase?: number
  items: OrderItem[]
  payments: PaymentRecord[]
  customer?: CustomerRecord
}

export interface HealthResponse {
  status: string
  engine_ready: boolean
  olist_orders_loaded: number
  warnings: string[]
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const submitCase = async (req: CaseRequest): Promise<CaseResponse> => {
  const { data } = await api.post<CaseResponse>('/api/cases', req)
  return data
}

export const fetchExamples = async (): Promise<ExampleCase[]> => {
  const { data } = await api.get<ExampleCase[]>('/api/cases/examples')
  return data
}

export const fetchOrder = async (orderId: string): Promise<OrderDetail> => {
  const { data } = await api.get<OrderDetail>(`/api/orders/${orderId}`)
  return data
}

export const searchOrders = async (q: string): Promise<string[]> => {
  const { data } = await api.get<string[]>('/api/orders', { params: { q, limit: 10 } })
  return data
}

export const fetchHealth = async (): Promise<HealthResponse> => {
  const { data } = await api.get<HealthResponse>('/api/health')
  return data
}

// ── Chat types ────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface IntentDecision {
  intent: 'tool_execution' | 'chat'
  confidence: number
  detected_order_id?: string
  reason: string
}

export type ChatEventType = 'intent' | 'text' | 'tool_start' | 'tool_result' | 'done' | 'error'

export interface ChatEvent {
  type: ChatEventType
  content: any
}

export interface ChatRequest {
  session_id: string
  messages: ChatMessage[]
  order_id?: string
}

// ── SSE chat stream ───────────────────────────────────────────────────────────

export function streamChat(
  req: ChatRequest,
  onEvent: (evt: ChatEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const BASE = API_BASE_URL
  return new Promise((resolve, reject) => {
    fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.text()
          reject(new Error(err))
          return
        }
        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buf = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() ?? ''
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const evt: ChatEvent = JSON.parse(line.slice(6))
                onEvent(evt)
                if (evt.type === 'done') { resolve(); return }
              } catch { /* malformed line */ }
            }
          }
        }
        resolve()
      })
      .catch(reject)
  })
}
