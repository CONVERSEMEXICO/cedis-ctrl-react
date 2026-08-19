import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KpiTileProps {
  href: string
  title: string
  icon: LucideIcon
  accentClass: string
  primaryValue: string
  primaryLabel: string
  metrics: { label: string; value: string; danger?: boolean }[]
}

export function KpiTile({
  href,
  title,
  icon: Icon,
  accentClass,
  primaryValue,
  primaryLabel,
  metrics,
}: KpiTileProps) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex flex-col gap-3 rounded-lg border border-border bg-card p-4 border-t-4 transition-colors hover:bg-accent/40',
        accentClass,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <Icon className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
          {primaryValue}
        </span>
        <span className="text-xs text-muted-foreground">{primaryLabel}</span>
      </div>
      <div className="flex flex-col gap-1 border-t border-border pt-2">
        {metrics.map((metric) => (
          <div key={metric.label} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{metric.label}</span>
            <span
              className={cn(
                'font-mono font-medium tabular-nums',
                metric.danger ? 'text-destructive' : 'text-foreground',
              )}
            >
              {metric.value}
            </span>
          </div>
        ))}
      </div>
    </Link>
  )
}
