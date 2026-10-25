import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  fetchSystemInfo,
  fetchProduct,
} from '../lib/api'
import { cn } from '../lib/utils'
import {
  Copy,
  Check,
  Search,
  ArrowRight,
  Sparkles,
  Database,
  ShieldCheck,
  Cpu,
  Layers,
  ChevronRight,
  ExternalLink,
  Info,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  GitFork,
  Box,
  Truck,
  CreditCard,
  FileText,
  Brain,
  Zap,
  Scale,
  Compass,
} from 'lucide-react'

type TabType = 'pipeline' | 'cognitive' | 'scenarios' | 'dataset' | 'policies'

interface NodeDetail {
  id: string
  name: string
  stage: string
  type: 'deterministic' | 'llm' | 'gate'
  desc: string
  inputs: string[]
  outputs: string[]
  codeFile: string
  samplePayload?: Record<string, any>
}

const NODES_DATA: Record<string, NodeDetail> = {
  receive_case: {
    id: 'receive_case',
    name: 'receive_case',
    stage: 'Stage 1: Ingestion & Validation',
    type: 'deterministic',
    desc: 'Validates order_id schema (32-hex) and customer message presence. Auto-generates deterministic CASE-XXXXXXXX tracking identifier.',
    inputs: ['order_id', 'customer_message'],
    outputs: ['case_id', 'order_id', 'customer_message', 'errors'],
    codeFile: 'backend/src/graph/workflow.py',
    samplePayload: {
      case_id: 'CASE-001',
      order_id: 'e481f51cbdc54678b7cc49136f2d6af7',
      customer_message: 'My product arrived damaged and I want a refund.',
    },
  },
  jev_router: {
    id: 'jev_router',
    name: 'jev_router',
    stage: 'Stage 2: Intent Classification',
    type: 'deterministic',
    desc: 'System-1 OpenJEV intent classifier evaluates claim semantic vector against returns, delivery, and payment centroids. If confidence < 0.60, triggers Groq route classifier.',
    inputs: ['customer_message'],
    outputs: ['route', 'routing_confidence', 'routing_backend'],
    codeFile: 'backend/src/routing/jev_router.py',
    samplePayload: {
      route: 'returns',
      routing_confidence: 0.94,
      routing_backend: 'openjev_system1',
    },
  },
  returns_agent: {
    id: 'returns_agent',
    name: 'returns_agent',
    stage: 'Stage 3: Returns Adjudication',
    type: 'deterministic',
    desc: 'Queries FAISS vector index for RET-01..17 policies. Executes Cactus Needle date window verification (30d general, 7d damaged) and calculates refund deductions.',
    inputs: ['order_id', 'customer_message'],
    outputs: ['agent_resolution', 'agent_confidence', 'refund_amount', 'tools_executed'],
    codeFile: 'backend/src/agents/returns.py',
    samplePayload: {
      agent_resolution: 'approved',
      agent_confidence: 0.95,
      refund_amount: 149.90,
      tools_executed: ['check_return_window', 'verify_item_delivered'],
    },
  },
  delivery_agent: {
    id: 'delivery_agent',
    name: 'delivery_agent',
    stage: 'Stage 3: Logistics Adjudication',
    type: 'deterministic',
    desc: 'Queries FAISS vector index for DEL-01..14 policies. Evaluates order carrier status against estimated delivery date (EDD) and dispatches stationary tracer.',
    inputs: ['order_id', 'customer_message'],
    outputs: ['agent_resolution', 'agent_confidence', 'tools_executed'],
    codeFile: 'backend/src/agents/delivery.py',
    samplePayload: {
      agent_resolution: 'tracer_initiated',
      agent_confidence: 0.88,
      tools_executed: ['calculate_edd_delay', 'carrier_trace_request'],
    },
  },
  payment_agent: {
    id: 'payment_agent',
    name: 'payment_agent',
    stage: 'Stage 3: Billing Adjudication',
    type: 'deterministic',
    desc: 'Queries FAISS vector index for PAY-01..10 policies. Audits multi-payment records in Olist payments table to detect duplicate credit card charges and authorization anomalies.',
    inputs: ['order_id', 'customer_message'],
    outputs: ['agent_resolution', 'agent_confidence', 'refund_amount', 'tools_executed'],
    codeFile: 'backend/src/agents/payment.py',
    samplePayload: {
      agent_resolution: 'approved',
      agent_confidence: 0.92,
      refund_amount: 89.20,
      tools_executed: ['audit_duplicate_payments'],
    },
  },
  evaluate_result: {
    id: 'evaluate_result',
    name: 'evaluate_result',
    stage: 'Stage 4: Decision Quality Gate',
    type: 'gate',
    desc: 'Conditional gate node: if agent_confidence >= 0.50 and no escalation is flagged, transitions directly to resolve. If ambiguous or low confidence, diverts to Groq Reasoner.',
    inputs: ['agent_confidence', 'agent_needs_groq', 'agent_escalate'],
    outputs: ['next_edge: groq_fallback_node | resolve'],
    codeFile: 'backend/src/graph/workflow.py',
    samplePayload: {
      evaluation_passed: true,
      confidence_score: 0.94,
      threshold: 0.50,
      branch_selected: 'resolve',
    },
  },
  groq_fallback_node: {
    id: 'groq_fallback_node',
    name: 'groq_fallback_node',
    stage: 'Stage 5: LLM Reasoner Fallback',
    type: 'llm',
    desc: 'Invoked only when deterministic confidence < 50% or query is ambiguous. Synthesizes Olist order metadata and FAISS retrieved policy chunks into a structured recommendation.',
    inputs: ['customer_message', 'order_info', 'policy_chunks'],
    outputs: ['groq_result', 'groq_used: true'],
    codeFile: 'backend/src/llm/groq_fallback.py',
    samplePayload: {
      groq_used: true,
      groq_model: 'llama-3.3-70b-versatile',
      reasoning: 'Customer returned item with worn tags; policy RET-04 allows restocking fee 15%.',
    },
  },
  resolve: {
    id: 'resolve',
    name: 'resolve',
    stage: 'Stage 6: Final Verdict Compilation',
    type: 'deterministic',
    desc: 'Compiles final case state. Enforces high-value supervisor escalation threshold (> R$ 500) and commits the case record to the operational audit log.',
    inputs: ['agent_resolution', 'groq_result', 'refund_amount'],
    outputs: ['resolution', 'resolution_detail', 'escalate', 'escalate_reason'],
    codeFile: 'backend/src/graph/workflow.py',
    samplePayload: {
      resolution: 'refund_approved',
      refund_amount: 149.90,
      escalate: false,
      escalate_reason: null,
      status: 'completed',
    },
  },
}

interface SimPreset {
  id: string
  label: string
  category: string
  orderId: string
  message: string
  path: string[]
}

const SIM_PRESETS: SimPreset[] = [
  {
    id: 'returns_flow',
    label: 'Damaged Goods Claim',
    category: 'Returns',
    orderId: 'e481f51cbdc54678b7cc49136f2d6af7',
    message: 'My product arrived damaged and I want a refund.',
    path: ['receive_case', 'jev_router', 'returns_agent', 'evaluate_result', 'resolve'],
  },
  {
    id: 'delivery_flow',
    label: 'Logistics Transit Delay',
    category: 'Delivery',
    orderId: '949d5b44dbf5de918fe9c16f97b45f8a',
    message: 'My order is 3 days late and has not arrived yet.',
    path: ['receive_case', 'jev_router', 'delivery_agent', 'evaluate_result', 'resolve'],
  },
  {
    id: 'payment_flow',
    label: 'Duplicate Card Charge',
    category: 'Payment',
    orderId: '0016dfedd97fc2950e388d2971d718c7',
    message: 'I was charged twice for my order, please check payments.',
    path: ['receive_case', 'jev_router', 'payment_agent', 'evaluate_result', 'resolve'],
  },
  {
    id: 'fallback_flow',
    label: 'Ambiguous Edge Claim',
    category: 'Fallback',
    orderId: '3452a0d3022233e8d066f47243fa1b08',
    message: 'Item has strange smell and box was opened, can I get store credit?',
    path: ['receive_case', 'jev_router', 'returns_agent', 'evaluate_result', 'groq_fallback_node', 'resolve'],
  },
]

interface CognitiveStage {
  id: string
  number: string
  title: string
  shortName: string
  subtitle: string
  type: 'system1' | 'gate' | 'system2' | 'governance'
  latency: string
  cost: string
  throughput: string
  summary: string
  mechanics: string[]
  tools: string[]
  codeFile: string
  samplePayload: Record<string, any>
}

const COGNITIVE_STAGES: Record<string, CognitiveStage> = {
  stage1: {
    id: 'stage1',
    number: '01',
    title: 'Fast Instincts (System-1 Reflex)',
    shortName: '01. S1 Reflex',
    subtitle: 'Deterministic Sub-Millisecond Triaging',
    type: 'system1',
    latency: '< 2 ms',
    cost: '$0.00 / query',
    throughput: '~90% of all volume',
    summary: 'Handles unambiguous retail exception claims in microseconds without LLM tokens, drift, or hallucinations.',
    mechanics: [
      'Validates incoming case schema and generates deterministic 32-hex tracking digest.',
      'OpenJEV semantic vector centroids classify claim intent (Returns, Delivery, Billing) in < 2ms.',
      'FAISS dense vectors retrieve exact corporate rulebook chunks from in-memory cache.',
      'Cactus Needle executes exact date math against Olist purchase timestamps (30d returns, 7d defect).',
    ],
    tools: ['OpenJEV Intent Router', 'Cactus Needle Deterministic Tools', 'FAISS Vector Index', 'Olist SQLite Store'],
    codeFile: 'reroute/src/graph/workflow.py',
    samplePayload: {
      case_id: 'CASE-88A92F10',
      intent: 'returns',
      confidence: 0.94,
      days_since_delivery: 6,
      policy_applied: 'RET-02 (Defective Goods Window < 7d)',
      s1_resolved: true,
    },
  },
  stage2: {
    id: 'stage2',
    number: '02',
    title: 'Confidence & Ambiguity Gate',
    shortName: '02. Confidence Gate',
    subtitle: 'Deterministic Friction Detection',
    type: 'gate',
    latency: '< 1 ms',
    cost: '$0.00',
    throughput: '100% of pipeline traffic',
    summary: 'Mathematically decides if deterministic reflex tools are 100% conclusive or if neural deliberation is required.',
    mechanics: [
      'High Confidence Path (>= 0.50): Bypasses LLM entirely; proceeds straight to Stage 04 for final settlement.',
      'Escalation Trigger 1: Customer text contains emotional ambiguity, sarcasm, or multi-policy claim disputes.',
      'Escalation Trigger 2: Vector centroid classification confidence falls below 50% threshold.',
      'Escalation Trigger 3: Missing courier checkpoint telemetry requiring inductive policy interpretation.',
    ],
    tools: ['evaluate_result Gate Node', 'Heuristic Boundary Evaluator'],
    codeFile: 'reroute/src/agents/returns_agent.py',
    samplePayload: {
      confidence_score: 0.42,
      ambiguity_detected: true,
      flags: ['multi_policy_dispute', 'worn_item_with_tags'],
      action: 'escalate_to_groq_system2',
    },
  },
  stage3: {
    id: 'stage3',
    number: '03',
    title: 'Deliberative Reflection (System-2 Reasoner)',
    shortName: '03. S2 Deliberator',
    subtitle: 'Groq LPU Hardware Acceleration',
    type: 'system2',
    latency: '~150 ms (300+ tok/s)',
    cost: '$0.0003 / call',
    throughput: '~10% of edge cases',
    summary: 'Summoned ONLY when friction is encountered to synthesize conflicting facts with corporate policy vectors.',
    mechanics: [
      'Runs on Groq LPUs delivering 300+ tokens/second for instantaneous human-speed neural reflection.',
      'Synthesizes Olist order metadata, customer sentiment, and FAISS policy chunks into structured JSON.',
      'Applies nuanced policy balancing (e.g. buyer remorse tags vs defective manufacturer packaging).',
      'Zero hallucination risk: bound by strict system prompt contracts and deterministic JSON schema validation.',
    ],
    tools: ['Groq LPU Hardware', 'Qwen 2.5 32B / Llama 3.3 70B', 'FAISS Policy Retriever'],
    codeFile: 'backend/src/llm/groq_fallback.py',
    samplePayload: {
      groq_model: 'llama-3.3-70b-versatile',
      reasoning: 'Customer returned item with tags removed; policy RET-04 allows restocking fee 15% waiver given carrier delay.',
      recommended_refund: 127.42,
      groq_tokens: 284,
      inference_time_ms: 142,
    },
  },
  stage4: {
    id: 'stage4',
    number: '04',
    title: 'Governance & Verdict Compilation',
    shortName: '04. Final Verdict',
    subtitle: 'High-Value Threshold & Audit Log',
    type: 'governance',
    latency: '< 2 ms',
    cost: '$0.00',
    throughput: '100% of resolutions',
    summary: 'Enforces corporate safety guardrails, supervisor sign-offs, and immutable audit persistence.',
    mechanics: [
      'Automatic Supervisor Escalation: Any refund exceeding R$ 500 is locked for human supervisor sign-off.',
      'Fraud & dispute flags automatically divert cases to executive claims management.',
      'Commits complete decision state, including reasoning trace and policy citations, to SQLite audit store.',
      'Emits standardized REST / SSE events for the operations dashboard and customer notifications.',
    ],
    tools: ['Supervisor Threshold Gate', 'Audit SQLite Store', 'REST / SSE Dispatcher'],
    codeFile: 'backend/src/graph/workflow.py',
    samplePayload: {
      resolution: 'refund_approved',
      refund_amount: 127.42,
      escalate: false,
      escalate_reason: null,
      audit_hash: '9f2c81a8b3',
      status: 'completed',
    },
  },
}

interface ArchitecturalChoice {
  id: string
  label: string
  layer: string
  tech: string
  whyChosen: string
  rejected: string
  codeFile: string
}

const ARCH_CHOICES: ArchitecturalChoice[] = [
  {
    id: 'langgraph',
    label: 'LangGraph StateGraph',
    layer: 'Orchestration State Machine',
    tech: 'LangGraph Python 0.2',
    whyChosen: 'Enforces explicit directed state transitions with TypedDict contracts (CaseState). Ensures mathematical auditability, deterministic routing, and conditional gating without unbounded loops.',
    rejected: 'Free-form ReAct / AutoGPT agent loops — rejected because they get stuck in recursive token-draining loops and cannot be mathematically audited or certified for enterprise compliance.',
    codeFile: 'reroute/src/graph/workflow.py',
  },
  {
    id: 'openjev',
    label: 'OpenJEV Centroids',
    layer: 'Fast Intent Classifier',
    tech: 'OpenJEV Vector Centroids',
    whyChosen: 'Evaluates customer claims against semantic intent vectors in < 2ms. Routes directly into specialized agents without invoking LLM tokens or incurring GPU cold starts.',
    rejected: 'LLM Few-Shot JSON Classifier — rejected due to 1.5s latency and recurring API cost for basic triaging of obvious return / delivery inquiries.',
    codeFile: 'reroute/src/router/jev_router.py',
  },
  {
    id: 'cactus',
    label: 'Cactus Needle Tools',
    layer: 'Business Logic Verification',
    tech: 'Deterministic Python Algorithms',
    whyChosen: 'Deterministic date arithmetic and SQLite queries. Dates and monetary refunds are computed via verified algorithms with 100% reproducibility and zero drift.',
    rejected: 'LLM Code Interpreter / Math Generation — rejected because LLMs routinely hallucinate date diffs, leap years, and currency conversions.',
    codeFile: 'reroute/src/tools/needle_tools.py',
  },
  {
    id: 'faiss',
    label: 'FAISS Vector Index',
    layer: 'Policy Vector Retrieval',
    tech: 'FAISS-CPU Dense Vectors',
    whyChosen: 'In-memory local similarity search across 74 corporate rulebook chunks. Sub-millisecond index lookup with zero external network hops, vendor lock-in, or SaaS bill shocks.',
    rejected: 'Cloud Vector DB SaaS (Pinecone / Weaviate) — rejected due to added external network latency (40-100ms) and cloud availability dependencies for small, stable enterprise rulebooks.',
    codeFile: 'reroute/src/rag/policy_retriever.py',
  },
  {
    id: 'groq',
    label: 'Groq LPU Inference',
    layer: 'Deliberative Reasoner',
    tech: 'Groq LPU (Qwen 2.5 / Llama 3.3)',
    whyChosen: 'Dedicated Language Processing Unit hardware streaming 300+ tokens/sec. Deliberates complex edge-cases in ~150ms without stalling operations desk workflows.',
    rejected: 'Standard Cloud GPU APIs — rejected because 5-10 second roundtrip delays cause operator fatigue, abandoned sessions, and high token costs.',
    codeFile: 'backend/src/llm/groq_fallback.py',
  },
  {
    id: 'olist',
    label: 'Olist 99.4k Dataset',
    layer: 'Enterprise Data Foundation',
    tech: 'Authentic Brazilian E-Commerce',
    whyChosen: 'Authentic enterprise production data with real courier delays, multi-tender transactions, regional freight variances, and canceled orders across 2016-2018.',
    rejected: 'Synthetic Mock Data — rejected because synthetic data obscures real-world edge cases like split freight, postal carrier strikes, and multi-installment refunds.',
    codeFile: 'backend/app/db/database.py',
  },
]

export default function InfoPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('pipeline')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [scenarioFilter, setScenarioFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string>('jev_router')

  // Simulation State for Tab 1 (Workflow DAG)
  const [activePreset, setActivePreset] = useState<SimPreset>(SIM_PRESETS[0])
  const [simStepIndex, setSimStepIndex] = useState<number>(-1)
  const [isSimulating, setIsSimulating] = useState<boolean>(false)

  // Simulation & Selection State for Tab 2 (Cognitive System 1 & 2)
  const [selectedCogStage, setSelectedCogStage] = useState<string>('stage1')
  const [cogSimStep, setCogSimStep] = useState<number>(-1)
  const [isCogSimulating, setIsCogSimulating] = useState<boolean>(false)
  const [cogSimType, setCogSimType] = useState<'s1' | 's2'>('s1')
  const [selectedArchChoice, setSelectedArchChoice] = useState<string>('langgraph')

  const { data: info } = useQuery({
    queryKey: ['system-info'],
    queryFn: fetchSystemInfo,
    staleTime: 60_000,
  })

  const { data: productDetail, isFetching: loadingProduct } = useQuery({
    queryKey: ['product', selectedProductId],
    queryFn: () => fetchProduct(selectedProductId!),
    enabled: !!selectedProductId,
    staleTime: 5 * 60_000,
  })

  // Tab 1 Simulation timer
  useEffect(() => {
    let timer: any
    if (isSimulating) {
      if (simStepIndex < activePreset.path.length - 1) {
        timer = setTimeout(() => {
          const nextIndex = simStepIndex + 1
          setSimStepIndex(nextIndex)
          setSelectedNodeId(activePreset.path[nextIndex])
        }, 1100)
      } else {
        setIsSimulating(false)
      }
    }
    return () => clearTimeout(timer)
  }, [isSimulating, simStepIndex, activePreset])

  // Tab 2 Cognitive Simulation Timer
  useEffect(() => {
    let timer: any
    if (isCogSimulating) {
      const steps = cogSimType === 's1' ? ['stage1', 'stage2', 'stage4'] : ['stage1', 'stage2', 'stage3', 'stage4']
      if (cogSimStep < steps.length - 1) {
        timer = setTimeout(() => {
          const next = cogSimStep + 1
          setCogSimStep(next)
          setSelectedCogStage(steps[next])
        }, 1100)
      } else {
        setIsCogSimulating(false)
      }
    }
    return () => clearTimeout(timer)
  }, [isCogSimulating, cogSimStep, cogSimType])

  const startSimulation = (preset?: SimPreset) => {
    const targetPreset = preset || activePreset
    setActivePreset(targetPreset)
    setSimStepIndex(0)
    setSelectedNodeId(targetPreset.path[0])
    setIsSimulating(true)
  }

  const resetSimulation = () => {
    setIsSimulating(false)
    setSimStepIndex(-1)
  }

  const startCogSim = (type: 's1' | 's2') => {
    setCogSimType(type)
    setCogSimStep(0)
    setSelectedCogStage('stage1')
    setIsCogSimulating(true)
  }

  const resetCogSim = () => {
    setIsCogSimulating(false)
    setCogSimStep(-1)
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const launchInChat = (orderId: string, message: string) => {
    navigate(`/?order_id=${encodeURIComponent(orderId)}&message=${encodeURIComponent(message)}`)
  }

  const launchInStudio = (orderId: string, message: string) => {
    navigate(`/submit?order_id=${encodeURIComponent(orderId)}&message=${encodeURIComponent(message)}`)
  }

  const scenarios = info?.scenarios || []
  const filteredScenarios = scenarios.filter((sc) => {
    const matchCategory =
      scenarioFilter === 'all' ||
      (scenarioFilter === 'returns' && sc.expected_route === 'returns') ||
      (scenarioFilter === 'delivery' && sc.expected_route === 'delivery') ||
      (scenarioFilter === 'payment' && sc.expected_route === 'payment') ||
      (scenarioFilter === 'edge' && sc.order_id.includes('INVALID'))

    const q = searchQuery.toLowerCase().trim()
    const matchSearch =
      !q ||
      sc.case_id.toLowerCase().includes(q) ||
      sc.title.toLowerCase().includes(q) ||
      sc.order_id.toLowerCase().includes(q) ||
      sc.product_id.toLowerCase().includes(q) ||
      sc.customer_message.toLowerCase().includes(q) ||
      sc.applicable_rule.toLowerCase().includes(q)

    return matchCategory && matchSearch
  })

  const selectedNode = NODES_DATA[selectedNodeId] || NODES_DATA['jev_router']
  const activeSimNodeId = simStepIndex >= 0 ? activePreset.path[simStepIndex] : null

  return (
    <div className="space-y-8 pb-16">
      {/* ── Minimal Editorial Header ─────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-stone-200 dark:border-white/[0.06] pb-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-medium text-[#FF5500]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF5500]" />
            <span>Architecture &amp; Data Reference</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
            Retail Flow Engine Specifications
          </h1>
          <p className="text-sm text-stone-600 dark:text-slate-400 max-w-2xl leading-relaxed">
            Deterministic LangGraph state machine, OpenJEV intent dispatch, Cactus Needle verification tools,
            and 99,441 verified Olist e-commerce orders.
          </p>
        </div>

        {/* Refined Segmented Tab Bar */}
        <div className="flex items-center gap-1 rounded-xl bg-stone-100 dark:bg-[#0E171E] border border-stone-200 dark:border-white/[0.08] p-1 text-xs shrink-0 self-start md:self-auto overflow-x-auto max-w-full">
          {[
            { id: 'pipeline',  label: 'Workflow DAG' },
            { id: 'cognitive', label: 'System 1 & 2 Cognitive Architecture' },
            { id: 'scenarios', label: '15 Test Scenarios' },
            { id: 'dataset',   label: 'Olist Dataset' },
            { id: 'policies',  label: 'Policy Matrix' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as TabType)}
              className={cn(
                'relative rounded-lg px-3 py-1.5 font-medium transition-colors duration-150 whitespace-nowrap',
                activeTab === id ? 'text-white font-semibold' : 'text-stone-600 hover:text-stone-900 dark:text-slate-400 dark:hover:text-slate-200',
              )}
            >
              {activeTab === id && (
                <motion.div
                  layoutId="info-active-tab"
                  className="absolute inset-0 rounded-lg bg-[#FF5500] shadow-sm shadow-orange-500/25"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB 1: INTERACTIVE PIPELINE DAG ──────────────────────────────── */}
      {activeTab === 'pipeline' && (
        <div className="space-y-6">
          {/* Simulation Controls & Canvas Header */}
          <div className="card p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 dark:border-white/[0.06] pb-4">
              <div>
                <h2 className="text-base font-semibold text-stone-900 dark:text-white flex items-center gap-2">
                  <span>Compiled LangGraph Execution State Machine</span>
                </h2>
                <p className="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
                  Select a test case to simulate execution or click any node to inspect its operational contract.
                </p>
              </div>

              {/* Simulation Quick Bar */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => startSimulation()}
                  disabled={isSimulating}
                  className="btn-primary py-1.5 px-3.5 text-xs"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>{isSimulating ? 'Simulating...' : 'Run Simulation'}</span>
                </button>
                {simStepIndex >= 0 && (
                  <button
                    onClick={resetSimulation}
                    className="btn-secondary py-1.5 px-3 text-xs"
                    title="Reset Simulation"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Test Case Preset Selector */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span className="text-stone-500 text-[11px] font-medium shrink-0">Case Preset:</span>
              {SIM_PRESETS.map((preset) => {
                const isSelected = activePreset.id === preset.id
                return (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setActivePreset(preset)
                      startSimulation(preset)
                    }}
                    className={cn(
                      'rounded-lg px-3 py-1.5 transition-all text-xs whitespace-nowrap border',
                      isSelected
                        ? 'border-[#FF5500] bg-orange-50 text-[#FF5500] dark:bg-[#FF5500]/10 dark:text-orange-300 font-semibold'
                        : 'border-stone-200 bg-white dark:border-white/[0.06] dark:bg-[#0E111A] text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-200',
                    )}
                  >
                    <span className="font-semibold">{preset.category}:</span> {preset.label}
                  </button>
                )
              })}
            </div>

            {/* ── Responsive Ergonomic Node Canvas ────────────────────────── */}
            {/* ── Responsive Ergonomic Node Canvas ────────────────────────── */}
            <div className="rounded-2xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#0B141B] p-6 sm:p-10 select-none overflow-x-auto relative shadow-sm">
              <div className="min-w-[860px] flex items-center justify-between gap-6 py-4">
                
                {/* 1. Ingest Stage */}
                <div className="flex flex-col items-center">
                  <div className="text-[10px] uppercase font-mono text-stone-500 dark:text-slate-500 mb-2 font-medium">Stage 1 &bull; Ingest</div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedNodeId('receive_case')}
                    className={cn(
                      'w-44 rounded-xl p-3.5 text-left transition-all border relative shadow-xs',
                      selectedNodeId === 'receive_case'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 shadow-lg shadow-emerald-500/20'
                        : 'border-stone-200 dark:border-white/[0.08] bg-[#FAF9F5] dark:bg-[#101D27] hover:border-stone-400 dark:hover:border-white/[0.18]',
                      activeSimNodeId === 'receive_case' && 'ring-2 ring-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]',
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                      <span className="font-mono text-xs font-semibold text-stone-900 dark:text-white">receive_case</span>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-slate-400 leading-tight">Validate order_id & generate case_id</p>
                  </motion.button>
                </div>

                {/* SVG Connector 1 -> 2 */}
                <svg width="40" height="24" className="overflow-visible shrink-0">
                  <line
                    x1="0"
                    y1="12"
                    x2="40"
                    y2="12"
                    stroke={simStepIndex >= 1 ? '#10B981' : 'currentColor'}
                    strokeWidth="2"
                    className={cn(
                      simStepIndex >= 1 ? 'animate-flow-dash' : 'text-stone-300 dark:text-white/[0.15]'
                    )}
                  />
                </svg>

                {/* 2. Semantic Router */}
                <div className="flex flex-col items-center">
                  <div className="text-[10px] uppercase font-mono text-emerald-600 dark:text-emerald-400 mb-2 font-semibold">Stage 2 &bull; OpenJEV</div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedNodeId('jev_router')}
                    className={cn(
                      'w-48 rounded-xl p-3.5 text-left transition-all border relative shadow-xs',
                      selectedNodeId === 'jev_router'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 shadow-lg shadow-emerald-500/20'
                        : 'border-stone-200 dark:border-white/[0.08] bg-[#FAF9F5] dark:bg-[#101D27] hover:border-stone-400 dark:hover:border-white/[0.18]',
                      activeSimNodeId === 'jev_router' && 'ring-2 ring-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]',
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <GitFork className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                      <span className="font-mono text-xs font-semibold text-stone-900 dark:text-white">jev_router</span>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-slate-400 leading-tight">Intent classification (confidence &ge; 0.60)</p>
                  </motion.button>
                </div>

                {/* SVG Branching 2 -> 3 */}
                <svg width="48" height="200" className="overflow-visible shrink-0">
                  {/* To returns */}
                  <path
                    d="M 0 100 C 24 100, 24 24, 48 24"
                    fill="none"
                    stroke={activePreset.path.includes('returns_agent') && simStepIndex >= 2 ? '#F59E0B' : 'currentColor'}
                    strokeWidth="2"
                    className={cn(
                      activePreset.path.includes('returns_agent') && simStepIndex >= 2 ? 'animate-flow-dash' : 'text-stone-300 dark:text-white/[0.15]'
                    )}
                  />
                  {/* To delivery */}
                  <line
                    x1="0"
                    y1="100"
                    x2="48"
                    y2="100"
                    stroke={activePreset.path.includes('delivery_agent') && simStepIndex >= 2 ? '#06B6D4' : 'currentColor'}
                    strokeWidth="2"
                    className={cn(
                      activePreset.path.includes('delivery_agent') && simStepIndex >= 2 ? 'animate-flow-dash' : 'text-stone-300 dark:text-white/[0.15]'
                    )}
                  />
                  {/* To payment */}
                  <path
                    d="M 0 100 C 24 100, 24 176, 48 176"
                    fill="none"
                    stroke={activePreset.path.includes('payment_agent') && simStepIndex >= 2 ? '#A855F7' : 'currentColor'}
                    strokeWidth="2"
                    className={cn(
                      activePreset.path.includes('payment_agent') && simStepIndex >= 2 ? 'animate-flow-dash' : 'text-stone-300 dark:text-white/[0.15]'
                    )}
                  />
                </svg>

                {/* 3. Domain Agents Column */}
                <div className="flex flex-col gap-3 shrink-0">
                  <div className="text-[10px] uppercase font-mono text-stone-500 dark:text-slate-500 text-center mb-0.5 font-medium">Stage 3 &bull; Domain Agents</div>
                  {/* Returns Agent */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedNodeId('returns_agent')}
                    className={cn(
                      'w-48 rounded-xl p-3 text-left transition-all border relative shadow-xs',
                      selectedNodeId === 'returns_agent'
                        ? 'border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100 shadow-lg shadow-amber-500/20'
                        : 'border-stone-200 dark:border-white/[0.08] bg-[#FAF9F5] dark:bg-[#101D27] hover:border-stone-400 dark:hover:border-white/[0.18]',
                      activeSimNodeId === 'returns_agent' && 'ring-2 ring-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.5)]',
                    )}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <Box className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                        <span className="font-mono text-xs font-semibold text-amber-800 dark:text-amber-200">returns_agent</span>
                      </div>
                      <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-semibold">RET-01..17</span>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-slate-400 leading-tight">30d general &bull; 7d damaged</p>
                  </motion.button>

                  {/* Delivery Agent */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedNodeId('delivery_agent')}
                    className={cn(
                      'w-48 rounded-xl p-3 text-left transition-all border relative shadow-xs',
                      selectedNodeId === 'delivery_agent'
                        ? 'border-cyan-500 bg-cyan-50 text-cyan-950 dark:bg-cyan-950/30 dark:text-cyan-100 shadow-lg shadow-cyan-500/20'
                        : 'border-stone-200 dark:border-white/[0.08] bg-[#FAF9F5] dark:bg-[#101D27] hover:border-stone-400 dark:hover:border-white/[0.18]',
                      activeSimNodeId === 'delivery_agent' && 'ring-2 ring-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.5)]',
                    )}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <Truck className="h-3.5 w-3.5 text-cyan-500 dark:text-cyan-400" />
                        <span className="font-mono text-xs font-semibold text-cyan-800 dark:text-cyan-200">delivery_agent</span>
                      </div>
                      <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-semibold">DEL-01..14</span>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-slate-400 leading-tight">EDD delay &bull; Transit tracer</p>
                  </motion.button>

                  {/* Payment Agent */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedNodeId('payment_agent')}
                    className={cn(
                      'w-48 rounded-xl p-3 text-left transition-all border relative shadow-xs',
                      selectedNodeId === 'payment_agent'
                        ? 'border-purple-500 bg-purple-50 text-purple-950 dark:bg-purple-950/30 dark:text-purple-100 shadow-lg shadow-purple-500/20'
                        : 'border-stone-200 dark:border-white/[0.08] bg-[#FAF9F5] dark:bg-[#101D27] hover:border-stone-400 dark:hover:border-white/[0.18]',
                      activeSimNodeId === 'payment_agent' && 'ring-2 ring-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.5)]',
                    )}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />
                        <span className="font-mono text-xs font-semibold text-purple-800 dark:text-purple-200">payment_agent</span>
                      </div>
                      <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 font-semibold">PAY-01..10</span>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-slate-400 leading-tight">Duplicate transaction audit</p>
                  </motion.button>
                </div>

                {/* SVG Merge 3 -> 4 */}
                <svg width="48" height="200" className="overflow-visible shrink-0">
                  <path
                    d="M 0 24 C 24 24, 24 100, 48 100"
                    fill="none"
                    stroke={activePreset.path.includes('returns_agent') && simStepIndex >= 3 ? '#10B981' : 'currentColor'}
                    strokeWidth="2"
                    className={cn(
                      activePreset.path.includes('returns_agent') && simStepIndex >= 3 ? 'animate-flow-dash' : 'text-stone-300 dark:text-white/[0.15]'
                    )}
                  />
                  <line
                    x1="0"
                    y1="100"
                    x2="48"
                    y2="100"
                    stroke={activePreset.path.includes('delivery_agent') && simStepIndex >= 3 ? '#10B981' : 'currentColor'}
                    strokeWidth="2"
                    className={cn(
                      activePreset.path.includes('delivery_agent') && simStepIndex >= 3 ? 'animate-flow-dash' : 'text-stone-300 dark:text-white/[0.15]'
                    )}
                  />
                  <path
                    d="M 0 176 C 24 176, 24 100, 48 100"
                    fill="none"
                    stroke={activePreset.path.includes('payment_agent') && simStepIndex >= 3 ? '#10B981' : 'currentColor'}
                    strokeWidth="2"
                    className={cn(
                      activePreset.path.includes('payment_agent') && simStepIndex >= 3 ? 'animate-flow-dash' : 'text-stone-300 dark:text-white/[0.15]'
                    )}
                  />
                </svg>

                {/* 4. Gate + Fallback */}
                <div className="flex flex-col gap-4 items-center shrink-0">
                  <div className="text-[10px] uppercase font-mono text-stone-500 dark:text-slate-500 mb-0.5 font-medium">Stage 4 &bull; Gate</div>
                  
                  {/* Gate Node */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedNodeId('evaluate_result')}
                    className={cn(
                      'w-48 rounded-xl p-3.5 text-left transition-all border relative shadow-xs',
                      selectedNodeId === 'evaluate_result'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 shadow-lg shadow-emerald-500/20'
                        : 'border-stone-200 dark:border-white/[0.08] bg-[#FAF9F5] dark:bg-[#101D27] hover:border-stone-400 dark:hover:border-white/[0.18]',
                      activeSimNodeId === 'evaluate_result' && 'ring-2 ring-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]',
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <ShieldCheck className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                      <span className="font-mono text-xs font-semibold text-stone-900 dark:text-white">evaluate_result</span>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-slate-400 leading-tight">Confidence gate &ge; 50%</p>
                  </motion.button>

                  {/* Fallback Node */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedNodeId('groq_fallback_node')}
                    className={cn(
                      'w-48 rounded-xl p-3 text-left transition-all border relative shadow-xs',
                      selectedNodeId === 'groq_fallback_node'
                        ? 'border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100 shadow-lg shadow-amber-500/20'
                        : 'border-stone-200 dark:border-white/[0.08] bg-[#FAF9F5] dark:bg-[#101D27] hover:border-stone-400 dark:hover:border-white/[0.18]',
                      activeSimNodeId === 'groq_fallback_node' && 'ring-2 ring-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.5)]',
                    )}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <Cpu className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                        <span className="font-mono text-xs font-semibold text-amber-800 dark:text-amber-300">groq_fallback</span>
                      </div>
                      <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-semibold">LLM LPU</span>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-slate-400 leading-tight">Groq Qwen reasoner (&lt; 50%)</p>
                  </motion.button>
                </div>

                {/* SVG 4 -> 6 */}
                <svg width="40" height="120" className="overflow-visible shrink-0">
                  <line
                    x1="0"
                    y1="40"
                    x2="40"
                    y2="60"
                    stroke={simStepIndex >= 4 ? '#10B981' : 'currentColor'}
                    strokeWidth="2"
                    className={cn(
                      simStepIndex >= 4 ? 'animate-flow-dash' : 'text-stone-300 dark:text-white/[0.15]'
                    )}
                  />
                  <line
                    x1="0"
                    y1="100"
                    x2="40"
                    y2="60"
                    stroke={activePreset.path.includes('groq_fallback_node') && simStepIndex >= 5 ? '#10B981' : 'currentColor'}
                    strokeWidth="2"
                    className={cn(
                      activePreset.path.includes('groq_fallback_node') && simStepIndex >= 5 ? 'animate-flow-dash' : 'text-stone-300 dark:text-white/[0.15]'
                    )}
                  />
                </svg>

                {/* 6. Resolve Stage */}
                <div className="flex flex-col items-center">
                  <div className="text-[10px] uppercase font-mono text-emerald-600 dark:text-emerald-400 mb-2 font-semibold">Stage 6 &bull; Verdict</div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedNodeId('resolve')}
                    className={cn(
                      'w-48 rounded-xl p-3.5 text-left transition-all border relative shadow-xs',
                      selectedNodeId === 'resolve'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 shadow-lg shadow-emerald-500/20'
                        : 'border-stone-200 dark:border-white/[0.08] bg-[#FAF9F5] dark:bg-[#101D27] hover:border-stone-400 dark:hover:border-white/[0.18]',
                      activeSimNodeId === 'resolve' && 'ring-2 ring-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]',
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                      <span className="font-mono text-xs font-semibold text-stone-900 dark:text-white">resolve</span>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-slate-400 leading-tight">Emit CaseState &gt; R$ 500 audit</p>
                  </motion.button>
                </div>
              </div>
            </div>

            {/* ── Active Node State Inspector ────────────────────────────── */}
            <div className="rounded-xl border border-stone-200 dark:border-white/[0.08] bg-stone-50/80 dark:bg-[#0E171F] p-5 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 dark:border-white/[0.06] pb-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-sm font-bold text-stone-900 dark:text-white">
                      {selectedNode.name}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-[10px] font-medium border',
                        selectedNode.type === 'deterministic'
                          ? 'border-orange-500/30 bg-orange-500/10 text-[#FF5500]'
                          : selectedNode.type === 'llm'
                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300'
                          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
                      )}
                    >
                      {selectedNode.stage}
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-slate-400">{selectedNode.desc}</p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[11px] font-mono text-stone-500 dark:text-slate-500 block">Source Code Reference</span>
                  <span className="text-xs font-mono text-stone-800 dark:text-slate-300">{selectedNode.codeFile}</span>
                </div>
              </div>

              {/* State Variables & Live Simulation Payload */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                <div className="p-3 rounded-lg bg-white dark:bg-black/30 border border-stone-200 dark:border-white/[0.05] space-y-1.5 shadow-xs">
                  <span className="text-stone-500 dark:text-slate-400 text-[10px] uppercase font-sans font-semibold block">
                    Inputs Consumed
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {selectedNode.inputs.map((k) => (
                      <span key={k} className="rounded bg-stone-100 dark:bg-white/[0.06] px-2 py-0.5 text-stone-800 dark:text-slate-300 border border-stone-200/60 dark:border-transparent">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-white dark:bg-black/30 border border-stone-200 dark:border-white/[0.05] space-y-1.5 shadow-xs">
                  <span className="text-[#FF5500] text-[10px] uppercase font-sans font-semibold block">
                    State Keys Emitted
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {selectedNode.outputs.map((k) => (
                      <span key={k} className="rounded bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 text-[#FF5500]">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-white dark:bg-black/30 border border-stone-200 dark:border-white/[0.05] space-y-1.5 shadow-xs">
                  <span className="text-emerald-600 dark:text-emerald-400 text-[10px] uppercase font-sans font-semibold block">
                    Sample Node Payload
                  </span>
                  <pre className="text-[11px] text-stone-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-24 leading-snug">
                    {JSON.stringify(selectedNode.samplePayload, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            {/* Cognitive Architecture Quick Link Banner */}
            <div className="card-subtle p-4 border border-orange-500/30 bg-orange-500/5 dark:bg-orange-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-[#FF5500]/10 border border-[#FF5500]/30 flex items-center justify-center text-[#FF5500] shrink-0">
                  <Brain className="h-4 w-4" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-semibold text-stone-900 dark:text-white">Dual-Process Cognitive Architecture (System 1 + System 2)</h4>
                  <p className="text-[11px] text-stone-600 dark:text-slate-300 leading-relaxed">
                    Learn why Retail Flow pairs sub-millisecond deterministic reflex tools with Groq LLM reasoning &mdash; incorporating <a href="https://noesisframeworks.com" target="_blank" rel="noreferrer" className="text-[#FF5500] hover:underline underline-offset-2 font-medium">noesisframeworks.com</a> principles.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('cognitive')}
                className="btn-primary py-1.5 px-3.5 text-xs shrink-0 self-start sm:self-auto"
              >
                <span>Read Architectural Choices</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: DUAL-PROCESS COGNITIVE ARCHITECTURE (NOESIS FRAMEWORKS) ─── */}
      {activeTab === 'cognitive' && (
        <div className="space-y-8">
          {/* Executive Overview Card */}
          <div className="card p-6 sm:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 dark:border-white/[0.08] pb-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-orange-500/10 border border-orange-500/30 px-2.5 py-0.5 text-[10px] font-mono text-[#FF5500] font-semibold uppercase">
                    Dual-Process Cognitive Framework
                  </span>
                  <a
                    href="https://noesisframeworks.com"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-stone-500 dark:text-slate-400 hover:text-[#FF5500] transition-colors"
                  >
                    <span>noesisframeworks.com</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
                  System 1 & 2 Cognitive Architecture Pipeline
                </h2>
                <p className="text-xs sm:text-sm text-stone-600 dark:text-slate-300 max-w-3xl leading-relaxed">
                  Inspired by Daniel Kahneman's cognitive decision theory (<em>Thinking, Fast and Slow</em>) and built with <strong className="text-stone-900 dark:text-white">Noesis Frameworks</strong>.
                  Sub-millisecond deterministic reflex tools (System-1) handle 90%+ of exception volume. When ambiguity arises, execution escalates to Groq LPU neural reflection (System-2).
                </p>
              </div>

              {/* Simulation Quick Bar */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={() => startCogSim('s1')}
                  disabled={isCogSimulating}
                  className="btn-primary py-1.5 px-3.5 text-xs"
                >
                  <Zap className="h-3.5 w-3.5 fill-current" />
                  <span>Simulate S1 Reflex (&lt; 2ms)</span>
                </button>
                <button
                  onClick={() => startCogSim('s2')}
                  disabled={isCogSimulating}
                  className="btn-secondary py-1.5 px-3.5 text-xs"
                >
                  <Brain className="h-3.5 w-3.5 text-[#FF5500]" />
                  <span>Simulate S2 Deliberation</span>
                </button>
                {cogSimStep >= 0 && (
                  <button
                    onClick={resetCogSim}
                    className="btn-secondary py-1.5 px-2.5 text-xs"
                    title="Reset Simulation"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Simulation Status Feedback Banner */}
            {isCogSimulating && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-between text-xs text-stone-800 dark:text-orange-200"
              >
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF5500]"></span>
                  </span>
                  <span>
                    Simulating <strong>{cogSimType === 's1' ? 'System-1 Reflex Flow' : 'System-2 Ambiguity Flow'}</strong>: Currently at{' '}
                    <span className="font-mono font-semibold underline">{COGNITIVE_STAGES[selectedCogStage]?.title}</span>
                  </span>
                </div>
                <span className="font-mono text-[11px] text-stone-500 dark:text-orange-300">
                  Step {(cogSimStep + 1)} of {cogSimType === 's1' ? 3 : 4}
                </span>
              </motion.div>
            )}

            {/* ── Visual Animated Pipeline DAG (Framer Motion) ─────────────── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-stone-500 dark:text-slate-400 px-1">
                <span className="uppercase text-[11px] font-semibold">Interactive Cognitive Pipeline Flow</span>
                <span className="text-[11px]">Click any stage node to inspect inner contracts</span>
              </div>

              <div className="rounded-2xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#0B141B] p-6 sm:p-8 select-none overflow-x-auto relative shadow-sm">
                <div className="min-w-[880px] flex items-center justify-between gap-4 py-2">

                  {/* Stage 1: System-1 Fast Reflex */}
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] uppercase font-mono text-stone-500 dark:text-slate-500 mb-2">
                      Stage 01 &bull; Instinct
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedCogStage('stage1')}
                      className={cn(
                        'w-52 rounded-xl p-4 text-left transition-all border relative',
                        selectedCogStage === 'stage1'
                          ? 'border-[#FF5500] bg-orange-50/60 dark:bg-[#FF5500]/10 shadow-lg shadow-orange-500/20'
                          : 'border-stone-200 bg-stone-50 hover:bg-white text-stone-900 dark:border-white/[0.08] dark:bg-[#101D27] dark:text-white dark:hover:border-white/[0.18]',
                        cogSimStep >= 0 && (cogSimType === 's1' || cogSimType === 's2') && cogSimStep === 0 && 'ring-2 ring-[#FF5500] shadow-[0_0_20px_rgba(255,85,0,0.4)]',
                      )}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Zap className="h-4 w-4 text-[#FF5500]" />
                          <span className="font-mono text-xs font-bold text-stone-900 dark:text-white">System-1 Reflex</span>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                          &lt; 2ms
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-600 dark:text-slate-400 leading-tight mb-2">
                        OpenJEV &bull; Cactus Needle &bull; FAISS
                      </p>
                      <div className="flex items-center justify-between text-[10px] font-mono text-stone-500 dark:text-slate-400 pt-1 border-t border-stone-200 dark:border-white/[0.06]">
                        <span>90% of Volume</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">$0.00</span>
                      </div>
                    </motion.button>
                  </div>

                  {/* SVG Connector 1 -> 2 */}
                  <svg width="44" height="60" className="overflow-visible shrink-0">
                    <line
                      x1="0"
                      y1="30"
                      x2="44"
                      y2="30"
                      stroke={cogSimStep >= 1 ? '#FF5500' : 'rgba(150,150,150,0.3)'}
                      strokeWidth="2.5"
                      className={cogSimStep >= 1 ? 'animate-flow-dash' : ''}
                    />
                  </svg>

                  {/* Stage 2: Confidence Gate */}
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] uppercase font-mono text-stone-500 dark:text-slate-500 mb-2">
                      Stage 02 &bull; Decision Gate
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedCogStage('stage2')}
                      className={cn(
                        'w-52 rounded-xl p-4 text-left transition-all border relative',
                        selectedCogStage === 'stage2'
                          ? 'border-[#FF5500] bg-orange-50/60 dark:bg-[#FF5500]/10 shadow-lg shadow-orange-500/20'
                          : 'border-stone-200 bg-stone-50 hover:bg-white text-stone-900 dark:border-white/[0.08] dark:bg-[#101D27] dark:text-white dark:hover:border-white/[0.18]',
                        cogSimStep >= 0 && cogSimStep === 1 && 'ring-2 ring-[#FF5500] shadow-[0_0_20px_rgba(255,85,0,0.4)]',
                      )}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Scale className="h-4 w-4 text-amber-500" />
                          <span className="font-mono text-xs font-bold text-stone-900 dark:text-white">Confidence Gate</span>
                        </div>
                        <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">
                          &ge; 0.50
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-600 dark:text-slate-400 leading-tight mb-2">
                        Checks friction, sentiment & disputes
                      </p>
                      <div className="flex items-center justify-between text-[10px] font-mono text-stone-500 dark:text-slate-400 pt-1 border-t border-stone-200 dark:border-white/[0.06]">
                        <span>Deterministic</span>
                        <span className="text-stone-700 dark:text-slate-300">&lt; 1ms</span>
                      </div>
                    </motion.button>
                  </div>

                  {/* SVG Branch Connector (Gate to Direct S1 vs Gate to S2) */}
                  <svg width="60" height="130" className="overflow-visible shrink-0">
                    {/* Top branch: Direct Instant Settlement */}
                    <path
                      d="M 0 35 C 30 35, 30 15, 60 15"
                      fill="none"
                      stroke={cogSimType === 's1' && cogSimStep >= 2 ? '#10B981' : 'rgba(150,150,150,0.3)'}
                      strokeWidth="2.5"
                      className={cogSimType === 's1' && cogSimStep >= 2 ? 'animate-flow-dash' : ''}
                    />
                    {/* Bottom branch: Ambiguity Escalation to System-2 */}
                    <path
                      d="M 0 35 C 30 35, 30 95, 60 95"
                      fill="none"
                      stroke={cogSimType === 's2' && cogSimStep >= 2 ? '#FF5500' : 'rgba(150,150,150,0.3)'}
                      strokeWidth="2.5"
                      className={cogSimType === 's2' && cogSimStep >= 2 ? 'animate-flow-dash' : ''}
                    />
                  </svg>

                  {/* Stage 3: System-2 Groq Deliberator */}
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] uppercase font-mono text-stone-500 dark:text-slate-500 mb-2">
                      Stage 03 &bull; Deliberation
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedCogStage('stage3')}
                      className={cn(
                        'w-52 rounded-xl p-4 text-left transition-all border relative',
                        selectedCogStage === 'stage3'
                          ? 'border-[#FF5500] bg-orange-50/60 dark:bg-[#FF5500]/10 shadow-lg shadow-orange-500/20'
                          : 'border-stone-200 bg-stone-50 hover:bg-white text-stone-900 dark:border-white/[0.08] dark:bg-[#101D27] dark:text-white dark:hover:border-white/[0.18]',
                        cogSimType === 's2' && cogSimStep === 2 && 'ring-2 ring-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.5)]',
                      )}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Brain className="h-4 w-4 text-purple-500" />
                          <span className="font-mono text-xs font-bold text-stone-900 dark:text-white">System-2 Groq</span>
                        </div>
                        <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 font-semibold bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.5 rounded">
                          ~150ms
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-600 dark:text-slate-400 leading-tight mb-2">
                        LPU 300+ tok/s neural synthesis
                      </p>
                      <div className="flex items-center justify-between text-[10px] font-mono text-stone-500 dark:text-slate-400 pt-1 border-t border-stone-200 dark:border-white/[0.06]">
                        <span>10% Edge Cases</span>
                        <span className="text-purple-600 dark:text-purple-400 font-semibold">$0.0003</span>
                      </div>
                    </motion.button>
                  </div>

                  {/* SVG Connector 3 -> 4 */}
                  <svg width="44" height="60" className="overflow-visible shrink-0">
                    <line
                      x1="0"
                      y1="30"
                      x2="44"
                      y2="30"
                      stroke={cogSimStep >= (cogSimType === 's1' ? 2 : 3) ? '#10B981' : 'rgba(150,150,150,0.3)'}
                      strokeWidth="2.5"
                      className={cogSimStep >= (cogSimType === 's1' ? 2 : 3) ? 'animate-flow-dash' : ''}
                    />
                  </svg>

                  {/* Stage 4: Governance & Verdict */}
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] uppercase font-mono text-emerald-600 dark:text-emerald-400 mb-2 font-semibold">
                      Stage 04 &bull; Governance
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedCogStage('stage4')}
                      className={cn(
                        'w-52 rounded-xl p-4 text-left transition-all border relative',
                        selectedCogStage === 'stage4'
                          ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 shadow-lg shadow-emerald-500/20'
                          : 'border-stone-200 bg-stone-50 hover:bg-white text-stone-900 dark:border-white/[0.08] dark:bg-[#101D27] dark:text-white dark:hover:border-white/[0.18]',
                        cogSimStep >= 0 && ((cogSimType === 's1' && cogSimStep === 2) || (cogSimType === 's2' && cogSimStep === 3)) && 'ring-2 ring-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)]',
                      )}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="h-4 w-4 text-emerald-500" />
                          <span className="font-mono text-xs font-bold text-stone-900 dark:text-white">Final Verdict</span>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                          Audited
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-600 dark:text-slate-400 leading-tight mb-2">
                        R$ 500 supervisor gate &amp; commit
                      </p>
                      <div className="flex items-center justify-between text-[10px] font-mono text-stone-500 dark:text-slate-400 pt-1 border-t border-stone-200 dark:border-white/[0.06]">
                        <span>100% Guaranteed</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Verified</span>
                      </div>
                    </motion.button>
                  </div>

                </div>
              </div>
            </div>

            {/* ── Progressive Disclosure Inspector Drawer (Click-to-Reveal) ── */}
            <AnimatePresence mode="wait">
              {selectedCogStage && COGNITIVE_STAGES[selectedCogStage] && (
                <motion.div
                  key={selectedCogStage}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-2xl border border-stone-200 dark:border-white/[0.08] bg-[#FAF9F5] dark:bg-[#0E171F] p-6 space-y-5 shadow-sm"
                >
                  {/* Header of Active Stage */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 dark:border-white/[0.08] pb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="rounded bg-[#FF5500] text-white px-2 py-0.5 font-mono text-xs font-bold">
                          Stage {COGNITIVE_STAGES[selectedCogStage].number}
                        </span>
                        <h3 className="font-bold text-stone-900 dark:text-white text-base">
                          {COGNITIVE_STAGES[selectedCogStage].title}
                        </h3>
                        <span className="text-xs text-stone-500 dark:text-slate-400 hidden sm:inline">&bull;</span>
                        <span className="text-xs text-stone-600 dark:text-slate-300 font-medium hidden sm:inline">
                          {COGNITIVE_STAGES[selectedCogStage].subtitle}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 dark:text-slate-400 leading-relaxed">
                        {COGNITIVE_STAGES[selectedCogStage].summary}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="p-2 rounded-lg bg-white dark:bg-black/30 border border-stone-200 dark:border-white/[0.06] text-right text-xs font-mono">
                        <span className="text-[10px] text-stone-500 dark:text-slate-500 block">Latency &bull; Cost</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          {COGNITIVE_STAGES[selectedCogStage].latency} &bull; {COGNITIVE_STAGES[selectedCogStage].cost}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 3-Column Inspector Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
                    {/* Col 1: Operational Mechanics */}
                    <div className="p-4 rounded-xl bg-white dark:bg-black/25 border border-stone-200 dark:border-white/[0.06] space-y-2">
                      <span className="font-mono text-[11px] font-bold uppercase text-[#FF5500] block">
                        Operational Mechanics
                      </span>
                      <ul className="space-y-1.5 text-stone-600 dark:text-slate-300 leading-relaxed list-disc pl-4 text-[11px]">
                        {COGNITIVE_STAGES[selectedCogStage].mechanics.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Col 2: Active Tools & Repo Code */}
                    <div className="p-4 rounded-xl bg-white dark:bg-black/25 border border-stone-200 dark:border-white/[0.06] space-y-3">
                      <div>
                        <span className="font-mono text-[11px] font-bold uppercase text-stone-700 dark:text-slate-300 block mb-1.5">
                          Engaged Sub-Systems
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {COGNITIVE_STAGES[selectedCogStage].tools.map((t) => (
                            <span
                              key={t}
                              className="rounded-md bg-stone-100 dark:bg-white/[0.06] border border-stone-200 dark:border-white/[0.08] px-2 py-1 text-[11px] font-medium text-stone-800 dark:text-slate-200"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-stone-200 dark:border-white/[0.06]">
                        <span className="font-mono text-[10px] text-stone-500 dark:text-slate-500 block mb-0.5">
                          Source Code File
                        </span>
                        <span className="font-mono text-xs text-stone-800 dark:text-slate-300 bg-stone-100 dark:bg-black/40 px-2 py-1 rounded block truncate">
                          {COGNITIVE_STAGES[selectedCogStage].codeFile}
                        </span>
                      </div>
                    </div>

                    {/* Col 3: Sample State Machine Payload */}
                    <div className="p-4 rounded-xl bg-white dark:bg-black/25 border border-stone-200 dark:border-white/[0.06] space-y-2 font-mono">
                      <span className="text-[11px] font-bold uppercase text-emerald-600 dark:text-emerald-400 block font-sans">
                        Live Node Payload Schema
                      </span>
                      <pre className="text-[11px] text-stone-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-36 leading-snug bg-stone-50 dark:bg-black/50 p-2.5 rounded-lg border border-stone-200 dark:border-white/[0.04]">
                        {JSON.stringify(COGNITIVE_STAGES[selectedCogStage].samplePayload, null, 2)}
                      </pre>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Interactive Architectural Choices (Pill Explorer) ────────── */}
            <div className="space-y-4 pt-6 border-t border-stone-200 dark:border-white/[0.08]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
                    <span>Architectural Choices &amp; Technology Stack: What Was Used &amp; Why</span>
                  </h3>
                  <p className="text-xs text-stone-600 dark:text-slate-400 mt-0.5">
                    Click any technology badge below to inspect its operational rationale and rejected alternatives.
                  </p>
                </div>
              </div>

              {/* 6 Clickable Decision Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                {ARCH_CHOICES.map((choice) => {
                  const isSelected = selectedArchChoice === choice.id
                  return (
                    <button
                      key={choice.id}
                      onClick={() => setSelectedArchChoice(choice.id)}
                      className={cn(
                        'rounded-xl px-3.5 py-2 font-medium transition-all text-xs whitespace-nowrap border flex items-center gap-2',
                        isSelected
                          ? 'border-[#FF5500] bg-[#FF5500] text-white shadow-sm shadow-orange-500/25 font-semibold'
                          : 'border-stone-200 bg-white dark:border-white/[0.08] dark:bg-[#0E111A] text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white hover:border-stone-300',
                      )}
                    >
                      <span>{choice.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Selected Choice Deep-Dive Card */}
              {(() => {
                const choice = ARCH_CHOICES.find((c) => c.id === selectedArchChoice) || ARCH_CHOICES[0]
                return (
                  <motion.div
                    key={choice.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className="p-5 rounded-2xl border border-stone-200 dark:border-white/[0.08] bg-[#FAF9F5] dark:bg-[#0E171F] space-y-4 shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 dark:border-white/[0.06] pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#FF5500]">{choice.layer}</span>
                          <span className="text-stone-400 dark:text-slate-600">&bull;</span>
                          <span className="font-semibold text-stone-900 dark:text-white text-sm">{choice.tech}</span>
                        </div>
                      </div>
                      <div className="text-left sm:text-right font-mono text-[11px] text-stone-500 dark:text-slate-400">
                        <span>Repo File: </span>
                        <span className="text-stone-800 dark:text-slate-300 font-semibold">{choice.codeFile}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      {/* Why Chosen */}
                      <div className="p-4 rounded-xl bg-white dark:bg-black/25 border border-emerald-500/30 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold uppercase text-[11px] font-mono">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Why It Was Chosen (Cognitive &amp; Operational Rationale)</span>
                        </div>
                        <p className="text-stone-700 dark:text-slate-300 leading-relaxed text-xs">
                          {choice.whyChosen}
                        </p>
                      </div>

                      {/* What Was Rejected & Why */}
                      <div className="p-4 rounded-xl bg-white dark:bg-black/25 border border-rose-500/30 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-bold uppercase text-[11px] font-mono">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>What Was Rejected &amp; Why (Trade-Off Analysis)</span>
                        </div>
                        <p className="text-stone-600 dark:text-slate-400 leading-relaxed text-xs">
                          {choice.rejected}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )
              })()}
            </div>

            {/* Noesis Frameworks Corporate Narrative */}
            <div className="card-subtle p-6 rounded-2xl border border-orange-500/30 bg-orange-500/5 dark:bg-orange-950/15 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 dark:border-white/[0.08] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-[#FF5500] text-white flex items-center justify-center font-bold font-mono text-xs shadow-sm">
                    NF
                  </div>
                  <span className="font-bold text-stone-900 dark:text-white text-sm">
                    About Noesis Frameworks Integration
                  </span>
                </div>
                <a
                  href="https://noesisframeworks.com"
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary py-1 px-3 text-xs text-[#FF5500] hover:text-[#EA4B00] border-orange-500/30"
                >
                  <span>Visit noesisframeworks.com</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <p className="text-xs text-stone-600 dark:text-slate-300 leading-relaxed">
                <strong className="text-stone-900 dark:text-white">Noesis Frameworks</strong> (<a href="https://noesisframeworks.com" target="_blank" rel="noreferrer" className="text-[#FF5500] hover:underline font-medium">noesisframeworks.com</a>) develops cognitive orchestration architectures for high-trust autonomous enterprise systems. By formalizing the division between fast, deterministic reflex computation (System 1) and reflective neural synthesis (System 2), Noesis enables organizations to deploy autonomous AI agents that operate with mathematical compliance, zero hallucinations, and sub-millisecond execution speeds.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: 15 BENCHMARK SCENARIOS ─────────────────────────────────── */}
      {activeTab === 'scenarios' && (
        <div className="space-y-6">
          {/* Minimal Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 card p-4">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              {[
                { id: 'all',      label: 'All Scenarios (15)' },
                { id: 'returns',  label: 'Returns' },
                { id: 'delivery', label: 'Delivery' },
                { id: 'payment',  label: 'Billing' },
                { id: 'edge',     label: 'Edge Cases' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setScenarioFilter(id)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
                    scenarioFilter === id
                      ? 'bg-[#FF5500] text-white font-semibold shadow-sm'
                      : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-white/[0.05]',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search cases, orders, policies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-9 text-xs py-1.5 w-full"
              />
            </div>
          </div>

          {/* Clean Scenario Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredScenarios.map((sc) => {
              const routeBadgeClass =
                sc.expected_route === 'returns'
                  ? 'border-amber-500/30 text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10'
                  : sc.expected_route === 'delivery'
                  ? 'border-cyan-500/30 text-cyan-600 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-500/10'
                  : 'border-purple-500/30 text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-500/10'

              return (
                <div
                  key={sc.case_id}
                  className="card p-5 space-y-4 hover:border-orange-500/40 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 border-b border-stone-200 dark:border-white/[0.06] pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-stone-900 dark:text-white bg-stone-100 dark:bg-white/[0.06] px-2 py-0.5 rounded border border-stone-200 dark:border-white/[0.08]">
                          {sc.case_id}
                        </span>
                        <h3 className="font-semibold text-stone-900 dark:text-white text-sm tracking-tight">{sc.title}</h3>
                      </div>

                      <span className={cn('font-mono text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border', routeBadgeClass)}>
                        {sc.expected_route}
                      </span>
                    </div>

                    {/* Customer Message Quote */}
                    <p className="text-xs text-stone-700 dark:text-slate-300 leading-relaxed bg-[#F7F6F2] dark:bg-[#0A0C14] border border-stone-200 dark:border-white/[0.04] p-3 rounded-lg italic">
                      &ldquo;{sc.customer_message}&rdquo;
                    </p>

                    {/* Compact Order & Product Identifiers */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2.5 rounded-lg bg-stone-50 dark:bg-black/25 border border-stone-200 dark:border-white/[0.04]">
                        <span className="text-[10px] text-stone-500 dark:text-slate-500 uppercase font-sans block mb-0.5">Order ID</span>
                        <div className="flex items-center justify-between">
                          <span className="truncate text-stone-800 dark:text-slate-200" title={sc.order_id}>{sc.order_id}</span>
                          <button
                            onClick={() => copyToClipboard(sc.order_id, `order-${sc.case_id}`)}
                            className="text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors ml-1"
                            title="Copy Order ID"
                          >
                            {copiedId === `order-${sc.case_id}` ? (
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-stone-50 dark:bg-black/25 border border-stone-200 dark:border-white/[0.04]">
                        <span className="text-[10px] text-stone-500 dark:text-slate-500 uppercase font-sans block mb-0.5">
                          Product SKU {sc.price > 0 ? `(R$ ${sc.price.toFixed(2)})` : ''}
                        </span>
                        <div className="flex items-center justify-between">
                          <span className="truncate text-stone-800 dark:text-slate-200" title={sc.product_id}>{sc.product_id}</span>
                          {sc.product_id !== 'N/A' && (
                            <button
                              onClick={() => {
                                copyToClipboard(sc.product_id, `prod-${sc.case_id}`)
                                setSelectedProductId(sc.product_id)
                              }}
                              className="text-[#FF5500] hover:underline text-[10px] font-sans ml-1 font-medium"
                            >
                              inspect
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Adjudication Outcome */}
                    <div className="text-[11px] text-stone-600 dark:text-slate-400 space-y-1">
                      <div>
                        <span className="text-stone-700 dark:text-slate-300 font-medium">Policy:</span>{' '}
                        <span className="font-mono text-[#FF5500] font-semibold">{sc.applicable_rule}</span>
                      </div>
                      <div>
                        <span className="text-stone-700 dark:text-slate-300 font-medium">Expected Result:</span>{' '}
                        <span>{sc.expected_outcome}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-stone-200 dark:border-white/[0.06]">
                    <button
                      onClick={() => launchInChat(sc.order_id, sc.customer_message)}
                      className="btn-primary flex-1 py-1.5 text-xs"
                    >
                      <span>Run in Chat</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => launchInStudio(sc.order_id, sc.customer_message)}
                      className="btn-secondary flex-1 py-1.5 text-xs"
                    >
                      <span>Open in Studio</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Product Inspector Drawer */}
          {selectedProductId && (
            <div className="card p-5 border-orange-500/40 bg-white dark:bg-[#0F121C] space-y-3 shadow-md">
              <div className="flex items-center justify-between border-b border-stone-200 dark:border-white/[0.08] pb-2">
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-[#FF5500] font-bold">Product SKU Metadata:</span>
                  <span className="text-stone-900 dark:text-white">{selectedProductId}</span>
                </div>
                <button
                  onClick={() => setSelectedProductId(null)}
                  className="text-xs text-stone-500 hover:text-stone-900 dark:text-slate-400 dark:hover:text-white"
                >
                  Close [X]
                </button>
              </div>

              {loadingProduct ? (
                <div className="text-xs text-stone-500 dark:text-slate-400 font-mono">Querying Olist products database...</div>
              ) : productDetail ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-stone-50 dark:bg-black/40 border border-stone-200 dark:border-white/[0.06]">
                    <span className="text-stone-500 text-[10px] uppercase font-sans block">Category</span>
                    <span className="text-stone-800 dark:text-slate-200">{productDetail.product_category_name || 'N/A'}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-stone-50 dark:bg-black/40 border border-stone-200 dark:border-white/[0.06]">
                    <span className="text-stone-500 text-[10px] uppercase font-sans block">Weight</span>
                    <span className="text-stone-800 dark:text-slate-200">{productDetail.product_weight_g} g</span>
                  </div>
                  <div className="p-3 rounded-lg bg-stone-50 dark:bg-black/40 border border-stone-200 dark:border-white/[0.06]">
                    <span className="text-stone-500 text-[10px] uppercase font-sans block">Dimensions</span>
                    <span className="text-stone-800 dark:text-slate-200">
                      {productDetail.product_length_cm}x{productDetail.product_width_cm}x{productDetail.product_height_cm} cm
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-stone-50 dark:bg-black/40 border border-stone-200 dark:border-white/[0.06]">
                    <span className="text-stone-500 text-[10px] uppercase font-sans block">Catalog Photos</span>
                    <span className="text-stone-800 dark:text-slate-200">{productDetail.product_photos_qty || 0}</span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-stone-500 dark:text-slate-400">Record not found.</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: OLIST DATASET SCHEMA ───────────────────────────────────── */}
      {activeTab === 'dataset' && (
        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <div className="border-b border-stone-200 dark:border-white/[0.06] pb-3">
              <h2 className="text-base font-semibold text-stone-900 dark:text-white">Olist Brazilian E-Commerce Corpus</h2>
              <p className="text-xs text-stone-600 dark:text-slate-400 mt-0.5">
                99,441 real orders from 2016 to 2018 across Brazilian marketplaces with verified logistics timestamps and multiple payment records.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { name: 'olist_orders_dataset.csv', rows: '99,441', desc: 'Order status, purchase/approval/delivered timestamps, estimated delivery date (EDD)' },
                { name: 'olist_order_items_dataset.csv', rows: '112,650', desc: 'Item sequential ID, product SKU, seller ID, item price, freight value' },
                { name: 'olist_order_payments_dataset.csv', rows: '103,886', desc: 'Payment type (credit_card, boleto, voucher), installments, sequential billing audit' },
                { name: 'olist_products_dataset.csv', rows: '32,951', desc: 'Product SKU, category name, dimensions (LxWxH cm), weight (g), photo count' },
                { name: 'olist_customers_dataset.csv', rows: '99,441', desc: 'Customer unique ID, ZIP code prefix, city, state' },
              ].map((tbl) => (
                <div key={tbl.name} className="card-subtle p-4 space-y-2 border border-stone-200 dark:border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-stone-900 dark:text-white truncate">{tbl.name}</span>
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
                      {tbl.rows} rows
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-slate-400 leading-relaxed">{tbl.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: CORPORATE POLICY MATRIX ───────────────────────────────── */}
      {activeTab === 'policies' && (
        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <div className="border-b border-stone-200 dark:border-white/[0.06] pb-3">
              <h2 className="text-base font-semibold text-stone-900 dark:text-white">Adjudication Policy Vector Store (FAISS)</h2>
              <p className="text-xs text-stone-600 dark:text-slate-400 mt-0.5">
                4 policy rulebooks embedded into 74 vector chunks using sentence-transformers and indexed via FAISS.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card-subtle p-4 space-y-3 border border-stone-200 dark:border-white/[0.06]">
                <div className="flex items-center justify-between border-b border-stone-200 dark:border-white/[0.06] pb-2">
                  <span className="font-semibold text-stone-900 dark:text-white text-xs">Returns &amp; Refunds</span>
                  <span className="font-mono text-[10px] text-amber-600 dark:text-amber-400 font-bold">RET-01..17</span>
                </div>
                <ul className="text-xs text-stone-600 dark:text-slate-400 space-y-1.5 list-disc pl-4 leading-relaxed">
                  <li><strong>RET-01:</strong> 30 calendar days window from delivery timestamp.</li>
                  <li><strong>RET-02:</strong> Defective / damaged goods must be reported within 7 days.</li>
                  <li><strong>RET-04:</strong> 15% restocking fee on buyer remorse unsealed returns.</li>
                  <li><strong>RET-08:</strong> Items under R$ 20 eligible for keep-and-refund fast path.</li>
                </ul>
              </div>

              <div className="card-subtle p-4 space-y-3 border border-stone-200 dark:border-white/[0.06]">
                <div className="flex items-center justify-between border-b border-stone-200 dark:border-white/[0.06] pb-2">
                  <span className="font-semibold text-stone-900 dark:text-white text-xs">Delivery &amp; Logistics</span>
                  <span className="font-mono text-[10px] text-cyan-600 dark:text-cyan-400 font-bold">DEL-01..14</span>
                </div>
                <ul className="text-xs text-stone-600 dark:text-slate-400 space-y-1.5 list-disc pl-4 leading-relaxed">
                  <li><strong>DEL-01:</strong> EDD buffer allows 2 business days before claiming delay.</li>
                  <li><strong>DEL-03:</strong> Delays &gt; 5 days trigger automatic carrier trace.</li>
                  <li><strong>DEL-07:</strong> Stationary packages for &gt; 72h receive priority expedite flag.</li>
                  <li><strong>DEL-10:</strong> Claims after 14 days post-EDD are declared lost in transit.</li>
                </ul>
              </div>

              <div className="card-subtle p-4 space-y-3 border border-stone-200 dark:border-white/[0.06]">
                <div className="flex items-center justify-between border-b border-stone-200 dark:border-white/[0.06] pb-2">
                  <span className="font-semibold text-stone-900 dark:text-white text-xs">Billing &amp; Payments</span>
                  <span className="font-mono text-[10px] text-purple-600 dark:text-purple-400 font-bold">PAY-01..10</span>
                </div>
                <ul className="text-xs text-stone-600 dark:text-slate-400 space-y-1.5 list-disc pl-4 leading-relaxed">
                  <li><strong>PAY-01:</strong> Duplicate charge audit checks identical transaction sums.</li>
                  <li><strong>PAY-03:</strong> Canceled orders refund to original payment instrument within 5d.</li>
                  <li><strong>PAY-06:</strong> Boleto overpayments auto-credit customer wallet.</li>
                  <li><strong>PAY-09:</strong> Any refund &gt; R$ 500 requires human supervisor sign-off.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
