import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Archive,
  Bot,
  Cpu,
  Database,
  History,
  Layers,
  MessageSquare,
  Search,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react'
import { cn } from '../lib/utils'

// Sub-views
import ChatPage from './ChatPage'
import SubmitPage from './SubmitPage'
import HistoryPage from './HistoryPage'
import OrderLookupPage from './OrderLookupPage'

type DemoTab = 'chat' | 'studio' | 'history' | 'lookup'

export default function DemoPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as DemoTab) || 'chat'
  const [activeTab, setActiveTab] = useState<DemoTab>(initialTab)

  useEffect(() => {
    const tabParam = searchParams.get('tab') as DemoTab
    if (tabParam && ['chat', 'studio', 'history', 'lookup'].includes(tabParam)) {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  const handleTabChange = (tab: DemoTab) => {
    setActiveTab(tab)
    setSearchParams((prev) => {
      prev.set('tab', tab)
      return prev
    })
  }

  const tabs = [
    {
      id: 'chat' as const,
      label: 'Interactive Chat Assistant',
      shortLabel: 'Chat',
      icon: MessageSquare,
      desc: 'Customer-facing streaming assistant with automatic exception routing',
      badge: 'Live SSE',
    },
    {
      id: 'studio' as const,
      label: 'Exception Studio',
      shortLabel: 'Studio',
      icon: Terminal,
      desc: 'Operations runner: LangGraph DAG inspection, Cactus tools & refund verdict',
      badge: 'Graph DAG',
    },
    {
      id: 'history' as const,
      label: 'Audit Log & History',
      shortLabel: 'Audit History',
      icon: History,
      desc: 'Immutable compliance trail, rules applied, and financial ledger',
      badge: 'Audit Trail',
    },
    {
      id: 'lookup' as const,
      label: 'Order Explorer',
      shortLabel: 'Order DB',
      icon: Database,
      desc: 'Search the real Brazilian Olist e-commerce database',
      badge: 'Olist DB',
    },
  ]

  return (
    <div className="space-y-6">
      {/* ── Demo Cockpit Header & Sub-Navigation ────────────────────────────── */}
      <div className="card p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DCDCD4] dark:border-[#262930] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Live Online Sandbox
              </span>
              <span className="text-stone-300 dark:text-stone-700">&bull;</span>
              <span className="text-xs text-stone-500 font-mono">Brazilian Olist (99,441 Orders)</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-stone-900 dark:text-white mt-1">
              REROUTE Interactive Demo Suite
            </h1>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Experience all facets of the exception engine: real-time customer chat, operation-level graph inspection, audit logs, and order lookups.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-[10px] font-mono px-2 py-1 rounded-lg bg-[#FAF9F5] dark:bg-[#181B21] text-stone-600 dark:text-stone-300 border border-[#DCDCD4] dark:border-[#262930]">
              ⚡ S1 Reflex &bull; 🧠 S2 Groq LPU
            </span>
          </div>
        </div>

        {/* Tab Switcher Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  'flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all relative overflow-hidden',
                  isActive
                    ? 'border-[#FF5500] bg-orange-500/[0.06] text-stone-900 dark:text-white shadow-sm'
                    : 'border-[#DCDCD4] dark:border-[#262930] bg-white dark:bg-[#131519] text-stone-600 dark:text-stone-400 hover:border-[#FF5500]/50 hover:text-stone-900 dark:hover:text-white',
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeDemoTabIndicator"
                    className="absolute inset-y-0 left-0 w-1 bg-[#FF5500]"
                  />
                )}
                <div
                  className={cn(
                    'h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                    isActive
                      ? 'bg-[#FF5500] text-white shadow-sm shadow-orange-500/30'
                      : 'bg-[#FAF9F5] dark:bg-[#181B21] text-stone-500 dark:text-stone-400',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold truncate">{tab.shortLabel}</span>
                    <span
                      className={cn(
                        'text-[9px] font-mono px-1 py-0.2 rounded font-semibold hidden md:inline-block',
                        isActive
                          ? 'bg-orange-500/20 text-[#FF5500]'
                          : 'bg-[#FAF9F5] dark:bg-[#181B21] text-stone-500 border border-[#DCDCD4] dark:border-[#262930]',
                      )}
                    >
                      {tab.badge}
                    </span>
                  </div>
                  <span className="text-[10px] text-stone-400 dark:text-stone-500 block truncate">
                    {tab.id === 'chat' && 'Customer SSE Chat'}
                    {tab.id === 'studio' && 'LangGraph DAG State'}
                    {tab.id === 'history' && 'Compliance Ledger'}
                    {tab.id === 'lookup' && 'Real Orders'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Active Tab Content ─────────────────────────────────────────────── */}
      <div className="min-h-[500px]">
        {activeTab === 'chat' && <ChatPage />}
        {activeTab === 'studio' && <SubmitPage />}
        {activeTab === 'history' && <HistoryPage />}
        {activeTab === 'lookup' && <OrderLookupPage />}
      </div>
    </div>
  )
}
