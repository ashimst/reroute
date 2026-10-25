import { useQuery } from '@tanstack/react-query'
import { fetchHealth } from '../lib/api'
import { cn } from '../lib/utils'

export function EngineStatus() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 25_000,
    retry: 2,
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-stone-200 dark:border-white/[0.08] bg-stone-100 dark:bg-white/[0.03] px-2.5 py-1 text-[11px] text-stone-500 dark:text-slate-400 font-mono">
        <span className="h-1.5 w-1.5 rounded-full bg-stone-400 animate-pulse" />
        <span>Initializing...</span>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-300 px-2.5 py-1 text-[11px] font-mono">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
        <span>Engine Offline</span>
      </div>
    )
  }

  const ready = data.engine_ready
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-mono transition-colors shadow-xs',
        ready
          ? 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
          : 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
      )}
      title="System Status: Deterministic Reflex Tools & Policy Vectors Active"
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          ready ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500',
        )}
      />
      <span>
        {ready ? 'Engine Online' : 'Warming up'}
      </span>
    </div>
  )
}
