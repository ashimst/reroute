import { Link, useLocation } from 'react-router-dom'
import { cn } from '../lib/utils'
import { EngineStatus } from './EngineStatus'

const NAV = [
  { to: '/',         label: 'Chat',          icon: '💬' },
  { to: '/submit',   label: 'Submit Case',   icon: '⚡' },
  { to: '/orders',   label: 'Order Lookup',  icon: '🔍' },
  { to: '/history',  label: 'Case History',  icon: '📋' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()

  return (
    <div className="flex min-h-screen flex-col bg-surface-900">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/8 bg-surface-900/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 lg:px-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white shadow-lg shadow-brand-600/30">
              R
            </span>
            <span className="hidden font-semibold tracking-tight text-white sm:block">
              REROUTE
              <span className="ml-1.5 text-xs font-normal text-slate-500">
                Exception Engine
              </span>
            </span>
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            {NAV.map(({ to, label, icon }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
                  pathname === to
                    ? 'bg-brand-600/15 text-brand-300'
                    : 'text-slate-400 hover:bg-white/6 hover:text-slate-200',
                )}
              >
                <span className="text-base leading-none">{icon}</span>
                <span className="hidden sm:block">{label}</span>
              </Link>
            ))}
          </nav>

          {/* Spacer + status pill */}
          <div className="ml-auto">
            <EngineStatus />
          </div>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
          {children}
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/6 py-4 text-center text-xs text-slate-600">
        REROUTE &mdash; Retail Flow Exception Routing Engine &bull; Powered by LangGraph · Cactus Needle · Groq
      </footer>
    </div>
  )
}
