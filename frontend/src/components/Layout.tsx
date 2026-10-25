import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../lib/utils'
import { EngineStatus } from './EngineStatus'
import { useAuth } from '../context/AuthContext'
import AuthModal from './AuthModal'
import {
  GitFork,
  ExternalLink,
  Sun,
  Moon,
  Zap,
  Sparkles,
  User,
  LogOut,
  ChevronDown,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react'

const NAV = [
  { to: '/',        label: 'Overview' },
  { to: '/demo',    label: 'Demo Sandbox' },
  { to: '/info',    label: 'Architecture & Pipeline' },
  { to: '/deploy',  label: 'Cloud Deployment' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const { user, logout, upgrade, resetUsage, setUser } = useAuth()
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('rf_theme')
      if (saved === 'dark' || saved === 'light') return saved
    }
    return 'light' // Default to Archival bright mode matching noesisframeworks.com
  })

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('rf_theme', theme)
  }, [theme])

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F4F0] dark:bg-[#0B0C0E] text-[#0B0C0E] dark:text-[#F4F4F0] transition-colors duration-200">
      {/* ── Top Navigation Bar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-[#DCDCD4] dark:border-[#262930] bg-[#F4F4F0]/90 dark:bg-[#0B0C0E]/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          {/* Brand Logo & Tag */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 focus-visible:outline-none group">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FF5500] text-white shadow-sm shadow-orange-500/30 transition-transform group-hover:scale-105">
              <GitFork className="h-4 w-4 stroke-[2.5]" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold tracking-tight text-[#0B0C0E] dark:text-white text-sm">
                REROUTE
              </span>
              <span className="text-stone-300 dark:text-stone-700">&bull;</span>
              <span className="text-[11px] font-mono text-[#FF5500] font-semibold hidden md:inline">
                by Noesis
              </span>
            </div>
          </Link>

          {/* Navigation Items with Animated Active Pill */}
          <nav className="flex items-center gap-1 overflow-x-auto">
            {NAV.map(({ to, label }) => {
              const active = pathname === to || (to === '/demo' && ['/submit', '/orders', '/history'].includes(pathname))
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    'relative rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-150 whitespace-nowrap',
                    active
                      ? 'text-stone-950 dark:text-white font-semibold'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200',
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="nav-active-pill"
                      className="absolute inset-0 rounded-lg bg-stone-200/80 dark:bg-white/[0.08] shadow-sm"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3">

            {/* Noesis Frameworks Exact Palette Toggle: Archival vs Obsidian */}
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex items-center gap-1.5 rounded-full border border-[#DCDCD4] dark:border-[#262930] bg-white dark:bg-[#131519] px-2.5 py-1 text-[11px] font-mono text-stone-700 dark:text-stone-300 hover:border-[#FF5500]/50 transition-colors shadow-sm"
              title="Toggle Archival Paper / Obsidian Mode"
            >
              <span
                className={cn(
                  'h-2 w-2 rounded-full transition-colors',
                  theme === 'dark' ? 'bg-[#FF5500]' : 'bg-[#D84200]',
                )}
              />
              <span className="hidden sm:inline">{theme === 'dark' ? 'Obsidian' : 'Archival'}</span>
            </button>

            <EngineStatus />
          </div>
        </div>
      </header>

      {/* ── Main Body ──────────────────────────────────────────────────────── */}
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          {children}
        </div>
      </main>

      {/* ── Enterprise Footer with Persistent Noesis Frameworks Narrative ───── */}
      <footer className="border-t border-[#DCDCD4] dark:border-[#262930] bg-[#EAEAE4] dark:bg-[#070D12] py-8 text-xs text-stone-600 dark:text-stone-400 transition-colors">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-300 dark:border-stone-800">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex items-center gap-2 text-stone-900 dark:text-white font-medium">
                <span>Architected on</span>
                <a
                  href="https://noesisframeworks.com"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[#FF5500] font-semibold hover:underline underline-offset-4 transition-colors"
                >
                  <span>Noesis Frameworks</span>
                  <span className="text-[10px] font-mono rounded bg-orange-500/10 border border-orange-500/25 px-1.5 py-0.2">
                    noesisframeworks.com
                  </span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <p className="text-stone-600 dark:text-stone-400 text-xs leading-relaxed">
                Incorporating dual-process cognitive architecture (System-1 instantaneous deterministic triaging + System-2 deliberative LLM reasoning) to deliver zero-hallucination operational autonomy across complex e-commerce exceptions.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono text-stone-500 dark:text-stone-400 shrink-0">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>System-1: &lt; 2ms ($0.00)</span>
              </span>
              <span className="text-stone-300 dark:text-stone-700">&bull;</span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#FF5500]" />
                <span>System-2: Groq LPU</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-stone-500 dark:text-stone-500">
            <div>
              <span>REROUTE Autonomous Exception Engine &bull; Deterministic LangGraph State Machine &bull; Olist Brazilian Corpus</span>
            </div>
            <div>
              <span>&copy; {new Date().getFullYear()} Noesis Frameworks &bull; Specialized AI for Local Hardware</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Global Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={(u) => setUser(u)}
      />
    </div>
  )
}
