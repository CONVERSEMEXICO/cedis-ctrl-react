import type { ReactNode } from 'react'

export function PageHeader({
  title,
  description,
  accentClassName,
  actions,
}: {
  title: string
  description: string
  accentClassName: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 h-8 w-1 shrink-0 rounded-full ${accentClassName}`} aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <h1 className="font-mono text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}
