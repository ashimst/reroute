import { useQuery } from '@tanstack/react-query'
import { fetchHealth } from '../lib/api'
import { cn } from '../lib/utils'

export function EngineStatus() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
    retry: 2,
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-600 animate-pulse" />
        Connecting…
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-rose-400">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
        Engine offline
      </div>
    )
  }

  const ready = data.engine_ready
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        ready
          ? 'bg-emerald-500/10 text-emerald-400'
          : 'bg-amber-500/10 text-amber-400',
      )}
      title={`${data.olist_orders_loaded.toLocaleString()} orders loaded`}
    >
      <span
        className={cn(
          'relative h-1.5 w-1.5 rounded-full',
          ready ? 'bg-emerald-400' : 'bg-amber-400',
        )}
      >
        {ready && (
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
      </span>
      {ready ? `Engine ready · ${(data.olist_orders_loaded / 1000).toFixed(0)}k orders` : 'Warming up…'}
    </div>
  )
}
