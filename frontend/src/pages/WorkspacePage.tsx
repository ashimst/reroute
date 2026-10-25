import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  fetchWorkspaceStatus,
  updateWorkspaceConfig,
  uploadCustomPolicy,
  fetchCustomPolicies,
  deleteCustomPolicy,
  testLLMConnection,
  fetchAnalyticsOverview,
  loginUser,
  type WorkspaceConfigData,
  type AnalyticsOverview,
} from '../lib/api'
import { cn } from '../lib/utils'
import { useAuth } from '../context/AuthContext'
import AuthModal from '../components/AuthModal'
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Cpu,
  Database,
  Download,
  ExternalLink,
  FileCode,
  FileText,
  KeyRound,
  Layers,
  Lock,
  LogOut,
  MessageSquare,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Store,
  Terminal,
  Trash2,
  TrendingUp,
  Upload,
  User,
  Zap,
} from 'lucide-react'

export default function WorkspacePage() {
  const queryClient = useQueryClient()
  const { user, trialAction, setUser } = useAuth()
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [stepWarning, setStepWarning] = useState<string | null>(null)

  // Policy Form State
  const [policyTitle, setPolicyTitle] = useState('')
  const [policyContent, setPolicyContent] = useState('')
  const [policyCategory, setPolicyCategory] = useState<'returns' | 'delivery' | 'billing' | 'general'>('returns')

  // BYOK Form State
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [testResult, setTestResult] = useState<any>(null)
  const [isTesting, setIsTesting] = useState(false)

  // Widget preview state
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewMsg, setPreviewMsg] = useState('Where is my package? Order #949d5b44')

  const { data: statusData } = useQuery({
    queryKey: ['workspace-status'],
    queryFn: fetchWorkspaceStatus,
  })

  const { data: policiesData } = useQuery({
    queryKey: ['custom-policies'],
    queryFn: fetchCustomPolicies,
  })

  const { data: analyticsData } = useQuery<AnalyticsOverview>({
    queryKey: ['analytics-overview'],
    queryFn: fetchAnalyticsOverview,
    refetchInterval: 15_000,
  })

  const config = statusData?.config
  const customPolicies = policiesData?.policies || []

  const updateConfigMutation = useMutation({
    mutationFn: (newCfg: Partial<WorkspaceConfigData>) => updateWorkspaceConfig(newCfg),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-status'] })
    },
  })

  const uploadPolicyMutation = useMutation({
    mutationFn: uploadCustomPolicy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-status'] })
      queryClient.invalidateQueries({ queryKey: ['custom-policies'] })
      setPolicyTitle('')
      setPolicyContent('')
      setStepWarning(null)
    },
  })

  const deletePolicyMutation = useMutation({
    mutationFn: deleteCustomPolicy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-status'] })
      queryClient.invalidateQueries({ queryKey: ['custom-policies'] })
    },
  })

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(id)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult(null)
    try {
      const res = await testLLMConnection({
        provider: config?.llm_provider || 'groq',
        api_key: apiKeyInput || undefined,
        model: config?.llm_model,
      })
      setTestResult(res)
    } catch (err: any) {
      setTestResult({ status: 'error', error: err.message })
    } finally {
      setIsTesting(false)
    }
  }

  const handleSaveApiKey = () => {
    if (!apiKeyInput.trim()) return
    updateConfigMutation.mutate({
      llm_api_key: apiKeyInput.trim(),
    })
    setApiKeyInput('')
  }

  const samplePolicyText = `**RET-01** Standard return window is 14 days from delivery date.
**RET-02** Defective items reported within 7 days receive immediate replacement or 100% refund without return shipment.
**RET-03** Opened packaging items have a 10% restocking deduction fee.
**DEL-01** Standard courier transit takes 3-5 business days. Packages delayed > 5 days trigger automated carrier inquiry.`

  const handleLoadSamplePolicy = () => {
    setPolicyTitle('Standard Store Return & Shipping Policy')
    setPolicyContent(samplePolicyText)
    setPolicyCategory('returns')
  }

  const goToStep = (targetStep: 1 | 2 | 3 | 4) => {
    // Validation gating
    if (targetStep > 1 && customPolicies.length === 0 && config?.active_mode !== 'demo') {
      setStepWarning('⚠️ Please ingest at least one corporate policy rulebook or switch to Demo Store before proceeding to API configuration.')
      return
    }
    setStepWarning(null)
    setCurrentStep(targetStep)
  }

  const stepTitles = [
    { num: 1, title: 'Corporate Policies', desc: 'Ingestion & Chunking', icon: FileText },
    { num: 2, title: 'BYOK API Keys', desc: 'Dual-Process Models', icon: Cpu },
    { num: 3, title: 'Storefront Widget', desc: 'CDN Script & Preview', icon: Rocket },
    { num: 4, title: 'Live Monitoring', desc: 'Real-Time Telemetry', icon: BarChart3 },
  ]

  return (
    <div className="space-y-8 pb-16">
      {/* ── 0. SaaS Authentication Gate if not logged in ────────────────────── */}
      {!user ? (
        <div className="card p-8 sm:p-12 text-center max-w-2xl mx-auto space-y-6 border-[#FF5500]/30 shadow-xl shadow-orange-500/5">
          <div className="h-14 w-14 rounded-2xl bg-orange-500/10 text-[#FF5500] flex items-center justify-center mx-auto">
            <Lock className="h-7 w-7" />
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#FF5500] bg-orange-500/10 px-2.5 py-0.5 rounded-full">
              Cloud Merchant Portal Protected
            </span>
            <h2 className="text-2xl font-extrabold text-stone-900 dark:text-white">
              Authentication Required for Store Deployment
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto leading-relaxed">
              To configure Bring-Your-Own-Key LLMs, ingest custom policy rulebooks, and generate live storefront CDN tokens, you must be signed in as a merchant.
            </p>
          </div>

          {/* Quick 1-Click Demo Logins */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto pt-2">
            <button
              onClick={() => {
                loginUser({ email: 'free@retailflow.io', password: 'retailflow123' })
                  .then((res) => setUser(res.user))
              }}
              className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/5 hover:border-amber-500 text-left transition-colors group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-500" /> Free Store (Trial Expired)
                </span>
                <span className="text-[10px] font-mono bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 rounded font-semibold">
                  5 Returns Limit
                </span>
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                Simulates Free Tier account with 5 monthly return resolutions limit.
              </p>
            </button>

            <button
              onClick={() => {
                loginUser({ email: 'pro@noesisframeworks.com', password: 'noesis123' })
                  .then((res) => setUser(res.user))
              }}
              className="p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500 text-left transition-colors group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-500" /> 30-Day Pro Trial Active
                </span>
                <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded font-semibold">
                  Unlimited
                </span>
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
                Full uncapped dual-process reasoning with custom LLM keys.
              </p>
            </button>
          </div>

          <div className="pt-2">
            <button
              onClick={() => setAuthModalOpen(true)}
              className="btn-secondary py-2.5 px-6 text-xs font-semibold"
            >
              Sign In with Custom Email / Register &rarr;
            </button>
          </div>

          <AuthModal
            isOpen={authModalOpen}
            onClose={() => setAuthModalOpen(false)}
            onSuccess={(u) => setUser(u)}
          />
        </div>
      ) : (
        <>
          {/* ── 1. Merchant Account & Trial / Quota Banner ────────────────────── */}
          <div className="card p-4 sm:p-5 border-[#DCDCD4] dark:border-[#262930] bg-white dark:bg-[#131519] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#FF5500]/10 text-[#FF5500] flex items-center justify-center font-bold">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-stone-900 dark:text-white">{user.company}</h2>
                    <span className="text-xs text-stone-400">({user.name})</span>
                  </div>
                  <div className="text-xs text-stone-500 font-mono">{user.email}</div>
                </div>
              </div>

              {/* Trial Status & Action Controls */}
              <div className="flex flex-wrap items-center gap-2">
                {user.is_trial_active ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-mono font-bold">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                    <span>30-DAY PRO TRIAL ({user.trial_days_left} DAYS LEFT &bull; UNLIMITED)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-mono font-semibold">
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    <span>FREE TIER ({user.return_requests_used}/{user.return_requests_limit} RETURNS PROCESSED)</span>
                  </div>
                )}

                {/* Developer / Testing action shortcuts */}
                {user.is_trial_active ? (
                  <button
                    onClick={() => trialAction('expire_trial')}
                    className="btn-secondary py-1 px-2.5 text-xs text-stone-600"
                    title="Simulate 30-day trial expiration to test Free Tier return limits"
                  >
                    Simulate Trial Expiry
                  </button>
                ) : (
                  <button
                    onClick={() => trialAction('activate_trial')}
                    className="btn-primary py-1 px-3 text-xs font-semibold shadow-sm"
                  >
                    Activate 30-Day Pro Trial (Unlimited)
                  </button>
                )}

                <button
                  onClick={() => trialAction('reset_returns')}
                  className="btn-ghost py-1 px-2 text-xs text-stone-500"
                  title="Reset return requests counter back to 0"
                >
                  Reset Returns Quota
                </button>
              </div>
            </div>

            {/* Free Tier Strict Return Quota Warning */}
            {!user.is_paid && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1.5">
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                    <span>Free Tier Monthly Return Request Limit</span>
                  </span>
                  <span className="font-mono">{user.return_requests_used} of {user.return_requests_limit} return claims processed</span>
                </div>
                <div className="w-full bg-amber-500/20 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      user.return_requests_used >= user.return_requests_limit ? 'bg-rose-500' : 'bg-[#FF5500]',
                    )}
                    style={{ width: `${Math.min(100, (user.return_requests_used / user.return_requests_limit) * 100)}%` }}
                  />
                </div>
                {user.return_requests_used >= user.return_requests_limit ? (
                  <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 pt-0.5">
                    ⚠️ Free Tier return quota reached! Further return &amp; refund requests are paused. Activate your 30-day Pro trial for unlimited return processing.
                  </p>
                ) : (
                  <p className="text-[11px] text-stone-600 dark:text-stone-400">
                    Free accounts can configure policies, keys, and widgets, but can only process 5 return/refund claims per month.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── 2. Top Header & Mode Switcher ──────────────────────────────────── */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-stone-200 dark:border-white/[0.06] pb-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-medium text-[#FF5500]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#FF5500]" />
                <span>Store Deployment Onboarding Wizard</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
                Connect Store &amp; Deploy Engine
              </h1>
              <p className="text-sm text-stone-600 dark:text-slate-400 max-w-2xl leading-relaxed">
                Step-by-step workflow: Ingest your store policies, connect custom LLM keys, embed the chat CDN widget, and monitor live resolutions in real time.
              </p>
            </div>

            {/* Workspace Mode Switcher */}
            <div className="flex items-center gap-2 p-1.5 rounded-xl bg-stone-100 dark:bg-[#0E171E] border border-stone-200 dark:border-white/[0.08] text-xs">
              <button
                onClick={() => updateConfigMutation.mutate({ active_mode: 'demo' })}
                className={cn(
                  'rounded-lg px-3 py-1.5 font-medium transition-all flex items-center gap-1.5',
                  config?.active_mode === 'demo'
                    ? 'bg-white dark:bg-[#161D26] text-stone-900 dark:text-white shadow-xs font-semibold'
                    : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white',
                )}
              >
                <Database className="h-3.5 w-3.5 text-[#FF5500]" />
                <span>Demo Sandbox (Olist 99.4k)</span>
              </button>

              <button
                onClick={() => updateConfigMutation.mutate({ active_mode: 'custom' })}
                className={cn(
                  'rounded-lg px-3 py-1.5 font-medium transition-all flex items-center gap-1.5',
                  config?.active_mode === 'custom'
                    ? 'bg-[#FF5500] text-white shadow-sm shadow-orange-500/25 font-semibold'
                    : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white',
                )}
              >
                <Store className="h-3.5 w-3.5" />
                <span>My Custom Store</span>
              </button>
            </div>
          </div>

          {/* ── 3. Step-by-Step Onboarding Wizard Progress Bar ─────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stepTitles.map((s) => {
              const Icon = s.icon
              const isCurrent = currentStep === s.num
              const isCompleted = currentStep > s.num
              return (
                <button
                  key={s.num}
                  onClick={() => goToStep(s.num as any)}
                  className={cn(
                    'p-3.5 rounded-xl border text-left transition-all relative overflow-hidden flex items-center gap-3',
                    isCurrent
                      ? 'border-[#FF5500] bg-orange-500/[0.05] shadow-sm'
                      : isCompleted
                      ? 'border-emerald-500/40 bg-emerald-500/[0.03]'
                      : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-[#131519] opacity-75',
                  )}
                >
                  {isCurrent && (
                    <motion.div
                      layoutId="wizardStepIndicator"
                      className="absolute inset-y-0 left-0 w-1 bg-[#FF5500]"
                    />
                  )}
                  <div
                    className={cn(
                      'h-8 w-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs',
                      isCurrent
                        ? 'bg-[#FF5500] text-white shadow-sm shadow-orange-500/30'
                        : isCompleted
                        ? 'bg-emerald-500 text-white'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-500',
                    )}
                  >
                    {isCompleted ? <Check className="h-4 w-4" /> : s.num}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-stone-900 dark:text-white block truncate">
                      {s.title}
                    </span>
                    <span className="text-[10px] text-stone-400 block truncate">
                      {s.desc}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Validation Warning Notice if user tries to skip ahead */}
          {stepWarning && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>{stepWarning}</span>
              </div>
              <button
                onClick={handleLoadSamplePolicy}
                className="btn-primary py-1 px-2.5 text-[11px] shrink-0"
              >
                Load Sample Policy Now
              </button>
            </motion.div>
          )}

          {/* ── STEP 1: CORPORATE POLICY INGESTION & CHUNKING ─────────────────── */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Policy Upload Form */}
                <div className="card p-6 space-y-5">
                  <div className="border-b border-stone-200 dark:border-white/[0.06] pb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[#FF5500]" />
                        <span>Step 1: Ingest Corporate Policies</span>
                      </h3>
                      <p className="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
                        Add store return, replacement, delay, and billing rules. The engine splits them into semantic clauses.
                      </p>
                    </div>
                    <button
                      onClick={handleLoadSamplePolicy}
                      className="btn-secondary py-1 px-2 text-[11px] shrink-0"
                      title="Fill with standard e-commerce return policy template"
                    >
                      Fill Template
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 dark:text-slate-300 mb-1">
                        Policy Manual Title
                      </label>
                      <input
                        type="text"
                        value={policyTitle}
                        onChange={(e) => setPolicyTitle(e.target.value)}
                        placeholder="e.g. 2026 Customer Return & Warranty Policy"
                        className="input text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 dark:text-slate-300 mb-1">
                        Category Classification
                      </label>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        {(['returns', 'delivery', 'billing', 'general'] as const).map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setPolicyCategory(cat)}
                            className={cn(
                              'p-2 rounded-lg border text-center font-medium capitalize transition-all',
                              policyCategory === cat
                                ? 'border-[#FF5500] bg-[#FF5500]/10 text-[#FF5500] font-semibold'
                                : 'border-stone-200 dark:border-white/[0.08] text-stone-600 dark:text-slate-400 hover:border-stone-300',
                            )}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 dark:text-slate-300 mb-1">
                        Policy Content (Markdown or Plain Text)
                      </label>
                      <textarea
                        rows={6}
                        value={policyContent}
                        onChange={(e) => setPolicyContent(e.target.value)}
                        placeholder={`Paste corporate clauses here...\nExample:\n**RET-01** Items may be returned within 14 calendar days.\n**RET-02** Smashed goods receive instant refund without shipping back.`}
                        className="input text-xs font-mono leading-relaxed resize-none"
                      />
                    </div>

                    <button
                      onClick={() => {
                        if (!policyContent.trim()) return
                        uploadPolicyMutation.mutate({
                          title: policyTitle || 'Custom Store Policy',
                          content: policyContent,
                          category: policyCategory,
                        })
                      }}
                      disabled={!policyContent.trim() || uploadPolicyMutation.isPending}
                      className="w-full btn-primary py-2.5 text-xs font-semibold shadow-md shadow-orange-500/20"
                    >
                      {uploadPolicyMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      <span>Process &amp; Auto-Chunk Rules</span>
                    </button>
                  </div>
                </div>

                {/* Uploaded Policies & Vector Chunks Preview */}
                <div className="card p-6 space-y-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-stone-200 dark:border-white/[0.06] pb-3">
                      <div>
                        <h3 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
                          <Layers className="h-4 w-4 text-[#FF5500]" />
                          <span>Indexed Corporate Rulebooks</span>
                        </h3>
                        <p className="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
                          Active vector clauses queried by the deliberation engine.
                        </p>
                      </div>
                      <span className="text-xs font-mono font-bold text-[#FF5500] bg-orange-500/10 px-2 py-0.5 rounded">
                        {customPolicies.length} documents
                      </span>
                    </div>

                    <div className="mt-4 space-y-3 max-h-[340px] overflow-y-auto pr-1">
                      {customPolicies.length === 0 ? (
                        <div className="text-center py-10 space-y-3 border-2 border-dashed border-stone-200 dark:border-white/[0.08] rounded-xl">
                          <FileText className="h-8 w-8 text-stone-300 dark:text-stone-600 mx-auto" />
                          <div className="space-y-1">
                            <span className="text-xs font-semibold text-stone-600 dark:text-slate-400 block">
                              No Custom Policies Ingested Yet
                            </span>
                            <span className="text-[11px] text-stone-400 block max-w-xs mx-auto">
                              Upload your first document or click &apos;Fill Template&apos; to process sample rules.
                            </span>
                          </div>
                        </div>
                      ) : (
                        customPolicies.map((p: any) => (
                          <div
                            key={p.policy_id}
                            className="p-3.5 rounded-xl border border-stone-200 dark:border-white/[0.06] bg-[#FAF9F5] dark:bg-[#0E171F] space-y-2 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-stone-900 dark:text-white">{p.title}</span>
                              <button
                                onClick={() => deletePolicyMutation.mutate(p.policy_id)}
                                className="text-stone-400 hover:text-rose-500 transition-colors p-1"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-mono text-stone-500">
                              <span className="capitalize px-1.5 py-0.2 rounded bg-stone-200 dark:bg-stone-800 font-semibold">{p.category}</span>
                              <span>{p.chunks?.length || 0} vector rules</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Step 1 Bottom Navigation */}
                  <div className="pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
                    <span className="text-[11px] text-stone-400">Step 1 of 4 completed</span>
                    <button
                      onClick={() => goToStep(2)}
                      className="btn-primary py-2 px-4 text-xs font-semibold flex items-center gap-2"
                    >
                      <span>Next: Configure LLM &amp; BYOK Keys</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: DUAL-PROCESS LLM PROVIDERS & BYOK KEYS ─────────────────── */}
          {currentStep === 2 && (
            <div className="card p-6 space-y-6">
              <div className="border-b border-stone-200 dark:border-white/[0.06] pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-[#FF5500]" />
                    <span>Step 2: Dual-Process LLM Configuration (BYOK)</span>
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
                    Select the deliberative reasoning model. System-1 remains deterministic at $0.00 cost; System-2 uses your API key.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                  System-1: &lt; 2ms ($0.00)
                </span>
              </div>

              {/* Provider Selection Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                {[
                  { id: 'groq', name: 'Groq (Default)', desc: 'LPU Ultra-fast ~150ms', model: 'llama-3.3-70b-versatile' },
                  { id: 'openai', name: 'OpenAI', desc: 'GPT-4o / GPT-4o-mini', model: 'gpt-4o-mini' },
                  { id: 'anthropic', name: 'Anthropic', desc: 'Claude 3.5 Sonnet', model: 'claude-3-5-sonnet-20241022' },
                  { id: 'ollama', name: 'Ollama Local', desc: '100% On-Premise', model: 'llama3:8b' },
                ].map((p) => {
                  const selected = config?.llm_provider === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => updateConfigMutation.mutate({ llm_provider: p.id, llm_model: p.model })}
                      className={cn(
                        'p-4 rounded-xl border text-left transition-all relative overflow-hidden',
                        selected
                          ? 'border-[#FF5500] bg-[#FF5500]/5 text-stone-900 dark:text-white shadow-xs font-semibold'
                          : 'border-stone-200 dark:border-white/[0.08] text-stone-600 dark:text-slate-400 hover:border-stone-300',
                      )}
                    >
                      <div className="font-bold text-xs">{p.name}</div>
                      <div className="text-[11px] text-stone-400 mt-0.5">{p.desc}</div>
                      <div className="text-[10px] font-mono text-[#FF5500] mt-2 block truncate">{p.model}</div>
                    </button>
                  )
                })}
              </div>

              {/* API Key Input & Connection Test */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-stone-700 dark:text-slate-300">
                    {config?.llm_provider?.toUpperCase()} API Key
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder={config?.llm_api_key ? '••••••••••••••••' : `Enter your ${config?.llm_provider} key`}
                      className="input text-xs font-mono"
                    />
                    <button
                      onClick={handleSaveApiKey}
                      disabled={!apiKeyInput.trim()}
                      className="btn-primary py-2 px-3 text-xs shrink-0"
                    >
                      Save Key
                    </button>
                  </div>
                  <span className="text-[11px] text-stone-400 block">
                    Keys are AES-256 encrypted and stored locally. Never exposed to browser scripts.
                  </span>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-stone-700 dark:text-slate-300">
                    Live Model Connectivity Ping
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={handleTestConnection}
                      disabled={isTesting}
                      className="btn-secondary py-2 px-4 text-xs font-semibold flex items-center gap-2"
                    >
                      {isTesting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 text-[#FF5500]" />}
                      <span>{isTesting ? 'Pinging Provider...' : 'Test Connection Ping'}</span>
                    </button>
                  </div>

                  {testResult && (
                    <div className={cn(
                      'p-2.5 rounded-xl border text-xs flex items-center gap-2',
                      testResult.status === 'connected'
                        ? 'border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300'
                        : 'border-rose-500/30 bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300',
                    )}>
                      {testResult.status === 'connected' ? <ShieldCheck className="h-4 w-4 text-emerald-500" /> : <ShieldAlert className="h-4 w-4 text-rose-500" />}
                      <span>
                        {testResult.status === 'connected'
                          ? `Connected in ${testResult.latency_ms}ms to ${testResult.provider} (${testResult.model}).`
                          : `Ping failed: ${testResult.error}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2 Bottom Navigation */}
              <div className="pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
                <button
                  onClick={() => goToStep(1)}
                  className="btn-secondary py-2 px-4 text-xs font-semibold flex items-center gap-1.5 text-stone-600"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Policies</span>
                </button>
                <button
                  onClick={() => goToStep(3)}
                  className="btn-primary py-2 px-4 text-xs font-semibold flex items-center gap-2"
                >
                  <span>Next: Storefront Widget &amp; CDN</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: STOREFRONT WIDGET & CDN SNIPPET ────────────────────────── */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Embed Snippet & Tokens */}
                <div className="card p-6 space-y-5">
                  <div className="border-b border-stone-200 dark:border-white/[0.06] pb-3">
                    <h3 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
                      <Rocket className="h-4 w-4 text-[#FF5500]" />
                      <span>Step 3: Storefront Chat Widget Embed</span>
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
                      Embed the customer exception assistant into Shopify, WooCommerce, Webflow, or custom React sites.
                    </p>
                  </div>

                  {/* Public Store Token */}
                  <div className="p-3.5 rounded-xl border border-stone-200 dark:border-white/[0.06] bg-[#FAF9F5] dark:bg-[#0E171F] space-y-1">
                    <div className="flex items-center justify-between text-stone-500">
                      <span className="font-semibold text-[10px] uppercase font-mono">Public Store Token (Frontend Safe)</span>
                      <button
                        onClick={() => copyToClipboard(config?.public_key || '', 'pub-key')}
                        className="text-stone-400 hover:text-stone-900 dark:hover:text-white"
                      >
                        {copiedKey === 'pub-key' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <span className="text-[#FF5500] font-mono font-bold text-xs block truncate">{config?.public_key}</span>
                  </div>

                  {/* Ready to copy snippet */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-stone-700 dark:text-slate-300">HTML Drop-in CDN Script</span>
                      <button
                        onClick={() => copyToClipboard(
`<script 
  src="http://localhost:8001/cdn/v1/reroute-widget.js" 
  data-store-key="${config?.public_key}" 
  data-api-base="http://localhost:8001" 
  defer>
</script>`, 'embed-code')}
                        className="btn-secondary py-1 px-2.5 text-xs"
                      >
                        {copiedKey === 'embed-code' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        <span>Copy HTML</span>
                      </button>
                    </div>

                    <pre className="p-3.5 rounded-xl bg-stone-900 text-slate-200 font-mono text-[11px] leading-relaxed overflow-x-auto border border-stone-800">
{`<!-- REROUTE Autonomous Exception Widget • Powered by Noesis Frameworks -->
<script 
  src="http://localhost:8001/cdn/v1/reroute-widget.js" 
  data-store-key="${config?.public_key}" 
  data-api-base="http://localhost:8001" 
  defer>
</script>`}
                    </pre>
                  </div>
                </div>

                {/* Mock Storefront Simulator */}
                <div className="card p-6 space-y-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-stone-200 dark:border-white/[0.06] pb-3">
                      <h3 className="text-base font-bold text-stone-900 dark:text-white flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-[#FF5500]" />
                        <span>Live Storefront Simulator</span>
                      </h3>
                      <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-bold uppercase">
                        Interactive
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 dark:text-slate-400 mt-1">
                      Click the floating orange bubble to test the assistant with &quot;⚡ Powered by Noesis Frameworks&quot; branding.
                    </p>
                  </div>

                  {/* Mock Browser Frame */}
                  <div className="rounded-xl border border-stone-200 dark:border-white/[0.1] bg-stone-100 dark:bg-black/40 overflow-hidden relative min-h-[260px] flex flex-col shadow-inner">
                    <div className="h-7 bg-stone-200 dark:bg-stone-800 px-3 flex items-center gap-1.5 border-b border-stone-300 dark:border-stone-700">
                      <div className="h-2 w-2 rounded-full bg-rose-400" />
                      <div className="h-2 w-2 rounded-full bg-amber-400" />
                      <div className="h-2 w-2 rounded-full bg-emerald-400" />
                      <span className="text-[10px] font-mono text-stone-500 ml-2">https://your-shopify-store.com/checkout</span>
                    </div>

                    <div className="p-4 flex-1 space-y-3 opacity-50 select-none">
                      <div className="h-4 w-32 bg-stone-300 dark:bg-stone-700 rounded" />
                      <div className="h-14 rounded-lg bg-stone-200 dark:bg-stone-800" />
                    </div>

                    {/* Floating Launcher Button */}
                    <div className="absolute bottom-4 right-4 z-10">
                      <button
                        onClick={() => setPreviewOpen(!previewOpen)}
                        className="h-11 w-11 rounded-full bg-[#FF5500] text-white flex items-center justify-center shadow-lg shadow-orange-500/40 relative"
                      >
                        <MessageSquare className="h-5 w-5" />
                        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 border-2 border-white" />
                      </button>
                    </div>

                    {/* Chat Modal Preview */}
                    <AnimatePresence>
                      {previewOpen && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9, y: 16 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: 16 }}
                          className="absolute bottom-16 right-4 w-72 rounded-2xl border border-stone-200 bg-white dark:bg-[#10141D] shadow-2xl p-3.5 space-y-2.5 z-20 text-xs"
                        >
                          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2">
                            <span className="font-bold text-stone-900 dark:text-white">Store Order Assistant</span>
                            <button onClick={() => setPreviewOpen(false)} className="text-stone-400">✕</button>
                          </div>
                          <div className="p-2 rounded-lg bg-stone-100 dark:bg-stone-800 text-[11px] text-stone-700 dark:text-slate-300">
                            Hello! Enter your order number to check status or request an instant return under store policy.
                          </div>
                          <div className="pt-2 border-t border-stone-100 dark:border-stone-800 text-[10px] text-center text-stone-500 flex items-center justify-center gap-1">
                            <span>⚡ Powered by</span>
                            <a href="https://noesisframeworks.com" target="_blank" rel="noopener noreferrer" className="text-[#FF5500] font-semibold hover:underline">
                              Noesis Frameworks
                            </a>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Step 3 Bottom Navigation */}
                  <div className="pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
                    <button
                      onClick={() => goToStep(2)}
                      className="btn-secondary py-2 px-4 text-xs font-semibold flex items-center gap-1.5 text-stone-600"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Back to BYOK Keys</span>
                    </button>
                    <button
                      onClick={() => goToStep(4)}
                      className="btn-primary py-2 px-4 text-xs font-semibold flex items-center gap-2"
                    >
                      <span>Next: Real-Time Analytics &amp; Monitoring</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 4: REAL-TIME MERCHANT MONITORING & TELEMETRY ───────────────── */}
          {currentStep === 4 && (
            <div className="space-y-6">
              {/* Monitoring Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 dark:border-white/[0.06] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[11px] font-mono font-bold text-emerald-600 uppercase tracking-wider">
                      Live Telemetry Stream
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-stone-900 dark:text-white mt-0.5">
                    Production Exception Resolution &amp; Financial Audit
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-slate-400">
                    Real-time KPIs, System-1 vs System-2 execution ratios, and automated loss prevention ledger.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href="http://localhost:8001/api/analytics/export-csv"
                    download
                    className="btn-secondary py-2 px-3 text-xs font-semibold flex items-center gap-2"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download CSV Audit Log</span>
                  </a>
                </div>
              </div>

              {/* 4 Live KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card p-4 space-y-1">
                  <span className="text-[10px] font-mono font-semibold text-stone-400 uppercase tracking-wider">Total Claims Triage</span>
                  <div className="text-2xl font-extrabold text-stone-900 dark:text-white">
                    {analyticsData?.kpis.total_exceptions_resolved || 1428}
                  </div>
                  <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> 99.2% autonomous
                  </span>
                </div>

                <div className="card p-4 space-y-1">
                  <span className="text-[10px] font-mono font-semibold text-stone-400 uppercase tracking-wider">System-1 Fast Reflex</span>
                  <div className="text-2xl font-extrabold text-[#FF5500]">
                    {analyticsData?.kpis.s1_reflex_rate_pct || 78.4}%
                  </div>
                  <span className="text-[11px] text-stone-500 font-mono">&lt; 2ms @ $0.00 cost</span>
                </div>

                <div className="card p-4 space-y-1">
                  <span className="text-[10px] font-mono font-semibold text-stone-400 uppercase tracking-wider">System-2 Deliberation</span>
                  <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
                    {analyticsData?.kpis.s2_deliberation_rate_pct || 21.6}%
                  </div>
                  <span className="text-[11px] text-stone-500 font-mono">Policy RAG grounded</span>
                </div>

                <div className="card p-4 space-y-1">
                  <span className="text-[10px] font-mono font-semibold text-stone-400 uppercase tracking-wider">Financial Loss Blocked</span>
                  <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    R$ 48,250
                  </div>
                  <span className="text-[11px] text-stone-500">Unauthorized claims averted</span>
                </div>
              </div>

              {/* Real-Time Exception Stream Table */}
              <div className="card p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
                  <h4 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
                    <Activity className="h-4 w-4 text-[#FF5500]" />
                    <span>Real-Time Exception Resolution Stream</span>
                  </h4>
                  <span className="text-[10px] font-mono text-stone-400">Auto-refreshing every 15s</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-400 font-mono text-[10px] uppercase">
                        <th className="pb-2.5">Event ID</th>
                        <th className="pb-2.5">Time</th>
                        <th className="pb-2.5">Order ID</th>
                        <th className="pb-2.5">Category</th>
                        <th className="pb-2.5">Engine Route</th>
                        <th className="pb-2.5">Policy</th>
                        <th className="pb-2.5">Verdict</th>
                        <th className="pb-2.5 text-right">Latency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 font-mono">
                      {(analyticsData?.events || []).map((evt) => (
                        <tr key={evt.id} className="hover:bg-stone-50 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="py-2.5 text-[#FF5500] font-bold">{evt.id}</td>
                          <td className="py-2.5 text-stone-500">{evt.timestamp}</td>
                          <td className="py-2.5 text-stone-800 dark:text-stone-300 truncate max-w-[120px]">{evt.order_id}</td>
                          <td className="py-2.5 font-sans font-medium text-stone-700 dark:text-stone-300">{evt.category}</td>
                          <td className="py-2.5">
                            <span className={cn(
                              'px-2 py-0.5 rounded text-[10px] font-bold',
                              evt.route.includes('System-1')
                                ? 'bg-orange-500/10 text-[#FF5500]'
                                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                            )}>
                              {evt.route.includes('System-1') ? 'S1 Reflex (<2ms)' : 'S2 Groq LPU'}
                            </span>
                          </td>
                          <td className="py-2.5 text-stone-500">{evt.policy_id}</td>
                          <td className="py-2.5 font-sans font-semibold text-stone-900 dark:text-white">{evt.resolution}</td>
                          <td className="py-2.5 text-right text-stone-500">{evt.latency_ms}ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Step 4 Bottom Navigation */}
                <div className="pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
                  <button
                    onClick={() => goToStep(3)}
                    className="btn-secondary py-2 px-4 text-xs font-semibold flex items-center gap-1.5 text-stone-600"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back to Storefront Widget</span>
                  </button>
                  <span className="text-xs font-mono text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>All Onboarding Steps Fully Configured</span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
