import axios from 'axios'

export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8001').replace(/\/+$/, '')

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 60_000,        // 60 s — engine warmup on first call can be slow
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('rf_auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
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
  execution_path?: 'system_1_reflex' | 'system_2_deliberation'
  latency_ms?: number
  estimated_cost_usd?: number
  evaluation_reference_date?: string
  days_since_delivery?: number
  tools_executed: string[]
  applicable_rules: string[]
  retrieved_policies: PolicyHit[]
  errors: string[]
}

export interface CaseRequest {
  case_id?: string
  order_id: string
  customer_message: string
  simulated_days_post_delivery?: number
  confidence_threshold?: number
  groq_api_key?: string
}

export interface ExampleCase {
  case_id: string
  order_id: string
  customer_message: string
  scenario: string
  expected_route: string
  notes: string
  simulated_days_post_delivery?: number
  expected_outcome?: string
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

export interface ScenarioDetail {
  case_id: string
  scenario: string
  title: string
  order_id: string
  product_id: string
  product_category: string
  price: number
  customer_message: string
  expected_route: string
  applicable_rule: string
  expected_outcome: string
  notes: string
}

export interface DatasetColumn {
  name: string
  type: string
  description: string
}

export interface DatasetTable {
  table_name: string
  record_count: number
  description: string
  key_columns: DatasetColumn[]
}

export interface SampleProduct {
  product_id: string
  category: string
  weight_g: number
  dimensions: string
  photos_qty: number
  typical_order: string
}

export interface SystemInfoResponse {
  system: {
    title: string
    version: string
    engine: string
    status: string
  }
  dataset: {
    name: string
    source: string
    total_orders: number
    total_order_items: number
    total_products: number
    total_payments: number
    total_customers: number
    date_range: string
    tables: DatasetTable[]
  }
  sample_products: SampleProduct[]
  scenarios: ScenarioDetail[]
}

export interface ProductDetail {
  product_id: string
  product_category_name?: string
  product_name_lenght?: number
  product_description_lenght?: number
  product_photos_qty?: number
  product_weight_g?: number
  product_length_cm?: number
  product_height_cm?: number
  product_width_cm?: number
}

export const fetchSystemInfo = async (): Promise<SystemInfoResponse> => {
  const { data } = await api.get<SystemInfoResponse>('/api/info')
  return data
}

export const fetchProduct = async (productId: string): Promise<ProductDetail> => {
  const { data } = await api.get<ProductDetail>(`/api/orders/products/${productId}`)
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
          let errorMsg = `HTTP ${res.status}`
          try {
            const errData = await res.json()
            errorMsg = errData.detail || errData.error || errorMsg
          } catch {
            const raw = await res.text()
            if (raw) errorMsg = raw
          }
          reject(new Error(errorMsg))
          return
        }

        const reader = res.body?.getReader()
        if (!reader) {
          reject(new Error('ReadableStream not supported in this browser'))
          return
        }

        const decoder = new TextDecoder()
        let buf = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buf += decoder.decode(value, { stream: true })
            const lines = buf.split('\n')
            buf = lines.pop() ?? ''
            for (const line of lines) {
              const trimmed = line.trim()
              if (trimmed.startsWith('data: ')) {
                try {
                  const evt: ChatEvent = JSON.parse(trimmed.slice(6))
                  onEvent(evt)
                  if (evt.type === 'done') {
                    reader.cancel().catch(() => {})
                    resolve()
                    return
                  }
                } catch { /* ignore partial chunk */ }
              }
            }
          }
          resolve()
        } catch (err) {
          reject(err)
        } finally {
          try {
            reader.releaseLock()
          } catch { /* ignored */ }
        }
      })
      .catch(reject)
  })
}

// ── Workspace & BYOK SaaS Management ──────────────────────────────────────────

export interface WorkspaceConfigData {
  workspace_id: string
  workspace_name: string
  active_mode: 'demo' | 'custom'
  llm_provider: string
  llm_model: string
  llm_api_key?: string
  s1_confidence_threshold: number
  order_adapter: string
  webhook_url?: string
  public_key: string
  secret_key: string
}

export interface WorkspaceStatus {
  config: WorkspaceConfigData
  has_custom_key: boolean
  custom_policies_count: number
  custom_chunks_count: number
  default_demo_policies_count: number
  default_demo_orders_count: number
}

export async function fetchWorkspaceStatus(): Promise<WorkspaceStatus> {
  const { data } = await api.get('/api/workspaces/current')
  return data
}

export async function updateWorkspaceConfig(cfg: Partial<WorkspaceConfigData>): Promise<{ status: string; config: WorkspaceConfigData }> {
  const { data } = await api.post('/api/workspaces/config', cfg)
  return data
}

export async function uploadCustomPolicy(policy: { title: string; content: string; category?: string }): Promise<any> {
  const { data } = await api.post('/api/workspaces/policies/upload', policy)
  return data
}

export async function fetchCustomPolicies(): Promise<{ policies: any[] }> {
  const { data } = await api.get('/api/workspaces/policies')
  return data
}

export async function deleteCustomPolicy(policyId: string): Promise<any> {
  const { data } = await api.delete(`/api/workspaces/policies/${policyId}`)
  return data
}

export async function testLLMConnection(payload: { provider: string; api_key?: string; model?: string }): Promise<any> {
  const { data } = await api.post('/api/workspaces/test-connection', payload)
  return data
}

// ── Authentication & SaaS Quota Management ────────────────────────────────────

export interface UserProfile {
  id: string
  email: string
  name: string
  company: string
  plan: 'free' | 'pro' | 'pro_trial'
  is_paid: boolean
  is_trial_active: boolean
  trial_days_left: number
  return_requests_used: number
  return_requests_limit: number
  remaining_returns: number
  created_at: number
}

export async function loginUser(payload: { email: string; password: string }): Promise<{ token: string; user: UserProfile }> {
  const { data } = await api.post('/api/auth/login', payload)
  if (data?.token) {
    localStorage.setItem('rf_auth_token', data.token)
  }
  return data
}

export async function registerUser(payload: { email: string; password: string; name?: string; company?: string }): Promise<{ token: string; user: UserProfile }> {
  const { data } = await api.post('/api/auth/register', payload)
  if (data?.token) {
    localStorage.setItem('rf_auth_token', data.token)
  }
  return data
}

export async function fetchCurrentUser(): Promise<UserProfile | null> {
  const token = localStorage.getItem('rf_auth_token')
  if (!token) return null
  try {
    const { data } = await api.get('/api/auth/me')
    return data
  } catch {
    localStorage.removeItem('rf_auth_token')
    return null
  }
}

export async function triggerTrialAction(action: 'activate_trial' | 'expire_trial' | 'reset_returns'): Promise<{ status: string; user: UserProfile }> {
  const { data } = await api.post('/api/auth/trial-action', { action })
  return data
}

export async function upgradePlan(plan: 'free' | 'pro'): Promise<any> {
  const { data } = await api.post('/api/auth/trial-action', {
    action: plan === 'pro' ? 'activate_trial' : 'expire_trial'
  })
  return data
}

export async function resetQuota(): Promise<any> {
  const { data } = await api.post('/api/auth/trial-action', { action: 'reset_returns' })
  return data
}

export async function logoutUser(): Promise<void> {
  try {
    await api.post('/api/auth/logout')
  } catch {}
  localStorage.removeItem('rf_auth_token')
}

// ── Merchant Analytics & Monitoring ───────────────────────────────────────────

export interface AnalyticsOverview {
  kpis: {
    total_exceptions_resolved: number
    s1_reflex_rate_pct: number
    s2_deliberation_rate_pct: number
    autonomous_accuracy_pct: number
    financial_loss_prevented_brl: number
    avg_latency_ms: number
    human_escalation_rate_pct: number
  }
  category_distribution: Array<{ category: string; count: number; percentage: number }>
  top_policies: Array<{ id: string; title: string; triggers: number; loss_saved: string }>
  events: Array<{
    id: string
    timestamp: string
    order_id: string
    category: string
    route: string
    policy_id: string
    resolution: string
    refund_amount: string
    latency_ms: number
    status: string
  }>
}

export async function fetchAnalyticsOverview(): Promise<AnalyticsOverview> {
  const { data } = await api.get('/api/analytics/overview')
  return data
}

