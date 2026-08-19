import { cn } from '@/lib/utils'
import type { EstadoConfig } from '@/lib/status-config'

export function EstadoBadge({ config }: { config: EstadoConfig }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium tracking-wide',
        config.badgeClass,
      )}
    >
      <span className={cn('size-1.5 rounded-full', config.dotClass)} aria-hidden="true" />
      {config.label}
    </span>
  )
}
