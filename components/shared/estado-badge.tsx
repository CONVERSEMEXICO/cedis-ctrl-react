import { cn } from '@/lib/utils'
import type { EstadoConfig } from '@/lib/status-config'

/** `className` solo ajusta el tamaño; el color siempre sale de `config`. */
export function EstadoBadge({
  config,
  className,
}: {
  config: EstadoConfig
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium tracking-wide',
        config.badgeClass,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', config.dotClass)} aria-hidden="true" />
      {config.label}
    </span>
  )
}
