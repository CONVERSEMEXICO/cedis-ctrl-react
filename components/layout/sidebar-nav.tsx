'use client'

import {
  AlertTriangle,
  Gauge,
  LayoutDashboard,
  PackageCheck,
  Tag,
  Truck,
  Warehouse,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export interface SidebarCounts {
  embarques: number
  recepciones: number
  surtido: number
  etiquetado: number
  productividad: number
  incidencias: number
}

const NAV_ITEMS = [
  {
    href: '/',
    label: 'Dashboard',
    icon: LayoutDashboard,
    dotClass: 'bg-primary',
    countKey: null,
  },
  {
    href: '/embarques',
    label: 'Embarques',
    icon: Truck,
    dotClass: 'bg-embarques',
    countKey: 'embarques' as const,
  },
  {
    href: '/recepciones',
    label: 'Recepciones',
    icon: PackageCheck,
    dotClass: 'bg-recepciones',
    countKey: 'recepciones' as const,
  },
  {
    href: '/surtido',
    label: 'Surtido',
    icon: Warehouse,
    dotClass: 'bg-surtido',
    countKey: 'surtido' as const,
  },
  {
    href: '/etiquetado',
    label: 'Etiquetado',
    icon: Tag,
    dotClass: 'bg-etiquetado',
    countKey: 'etiquetado' as const,
  },
  {
    href: '/productividad',
    label: 'Productividad',
    icon: Gauge,
    dotClass: 'bg-productividad',
    countKey: 'productividad' as const,
  },
  {
    href: '/incidencias',
    label: 'Incidencias',
    icon: AlertTriangle,
    dotClass: 'bg-incidencias',
    countKey: 'incidencias' as const,
  },
] as const

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <span className="font-mono text-xs tabular-nums text-muted-foreground" aria-live="off">
      {now
        ? now.toLocaleTimeString('es-MX', { hour12: false })
        : '--:--:--'}
    </span>
  )
}

export function SidebarNav({ counts }: { counts: SidebarCounts }) {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-16 flex-col border-r border-sidebar-border bg-sidebar md:w-60">
      <div className="flex flex-col gap-1 border-b border-sidebar-border px-3 py-4 md:px-5">
        <span className="flex items-center gap-1.5 font-mono text-sm font-semibold tracking-tight text-sidebar-foreground">
          <span className="hidden md:inline">CEDIS</span>
          <span className="md:hidden">C</span>
          <span className="text-primary">·CTRL</span>
        </span>
        <div className="hidden items-center gap-1.5 md:flex">
          <span className="size-1.5 rounded-full bg-embarques" aria-hidden />
          <LiveClock />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 md:px-3" aria-label="Navegación principal">
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href
            const count = item.countKey ? counts[item.countKey] : null
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md border-l-2 border-transparent px-2.5 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground md:gap-3',
                    isActive &&
                      'border-l-primary bg-sidebar-accent font-medium text-sidebar-foreground',
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="size-4 shrink-0 text-sidebar-foreground/70" aria-hidden />
                  <span className={cn('size-1.5 shrink-0 rounded-full', item.dotClass)} aria-hidden />
                  <span className="hidden flex-1 truncate md:inline">{item.label}</span>
                  {count !== null && (
                    <span className="hidden shrink-0 rounded-full bg-secondary px-1.5 py-0.5 font-mono text-[11px] leading-none text-secondary-foreground md:inline">
                      {count}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="hidden border-t border-sidebar-border px-4 py-3 md:block">
        <p className="font-mono text-[11px] leading-tight text-muted-foreground">
          Centro de distribución · Operación en vivo
        </p>
      </div>
    </aside>
  )
}
