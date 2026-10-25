import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { loginUser, registerUser, type UserProfile } from '../lib/api'
import { Check, KeyRound, Lock, Mail, ShieldAlert, Sparkles, Store, User, X, Zap } from 'lucide-react'
import { cn } from '../lib/utils'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (user: UserProfile) => void
  defaultTab?: 'login' | 'register'
}

export default function AuthModal({ isOpen, onClose, onSuccess, defaultTab = 'login' }: AuthModalProps) {
  const [tab, setTab] = useState<'login' | 'register'>(defaultTab)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleQuickLogin = async (demoEmail: string, demoPass: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await loginUser({ email: demoEmail, password: demoPass })
      onSuccess(res.user)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (tab === 'login') {
        const res = await loginUser({ email, password })
        onSuccess(res.user)
      } else {
        const res = await registerUser({ email, password, name, company })
        onSuccess(res.user)
      }
      onClose()
    } catch (err: any) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            className="relative w-full max-w-md rounded-2xl bg-white dark:bg-[#131519] border border-[#DCDCD4] dark:border-[#262930] shadow-2xl p-6 overflow-hidden z-10"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header */}
            <div className="text-center space-y-1 mb-5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-500/10 text-[#FF5500] text-[11px] font-mono font-bold tracking-wider uppercase mb-1">
                <span>REROUTE Merchant Authentication</span>
              </div>
              <h2 className="text-xl font-bold text-stone-900 dark:text-white">
                {tab === 'login' ? 'Welcome Back' : 'Create Merchant Account'}
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {tab === 'login'
                  ? 'Sign in to access your custom store policies, BYOK keys, and live CDN widget.'
                  : 'Start with 5 free exception queries or deploy to your own store.'}
              </p>
            </div>

            {/* 1-Click Quick Demo Sign-Ins */}
            <div className="space-y-2 mb-5">
              <div className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-wider text-center">
                Instant 1-Click Demo Logins
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickLogin('free@retailflow.io', 'retailflow123')}
                  className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 text-left hover:border-amber-500 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <Zap className="h-3 w-3 text-amber-500" /> Free Store
                    </span>
                    <span className="text-[9px] font-mono bg-amber-500/20 text-amber-600 dark:text-amber-300 px-1.5 py-0.2 rounded">5 calls</span>
                  </div>
                  <div className="text-[10px] text-stone-500 dark:text-stone-400 truncate mt-0.5">Rate-limited demo</div>
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickLogin('pro@noesisframeworks.com', 'noesis123')}
                  className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 text-left hover:border-emerald-500 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-emerald-500" /> Pro Merchant
                    </span>
                    <span className="text-[9px] font-mono bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 px-1.5 py-0.2 rounded">Unlimited</span>
                  </div>
                  <div className="text-[10px] text-stone-500 dark:text-stone-400 truncate mt-0.5">Uncapped queries</div>
                </button>
              </div>
            </div>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-stone-200 dark:border-stone-800"></div>
              <span className="flex-shrink mx-3 text-stone-400 text-[10px] font-mono uppercase">Or with email</span>
              <div className="flex-grow border-t border-stone-200 dark:border-stone-800"></div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-2.5 rounded-xl border border-rose-500/30 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Email Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {tab === 'register' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1">Your Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Sarah Miller"
                        required
                        className="input pl-9 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1">Company / Store Name</label>
                    <div className="relative">
                      <Store className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                      <input
                        type="text"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="Miller Crafts"
                        required
                        className="input pl-9 text-xs"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="merchant@yourstore.com"
                    required
                    className="input pl-9 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="input pl-9 text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-2.5 text-xs font-semibold shadow-md shadow-orange-500/20 mt-2"
              >
                {loading ? 'Authenticating...' : tab === 'login' ? 'Sign In to Account' : 'Create Account'}
              </button>
            </form>

            {/* Toggle Tab */}
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setTab(tab === 'login' ? 'register' : 'login')
                }}
                className="text-xs text-stone-500 hover:text-[#FF5500] dark:text-stone-400 transition-colors"
              >
                {tab === 'login' ? "Don't have a merchant account? Register" : 'Already have an account? Sign In'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
