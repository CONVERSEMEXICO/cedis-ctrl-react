'use client'

import { RefreshCw } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

const TITULOS: Record<string, string> = {
  '/': 'Dashboard',
  '/embarques': 'Embarques',
  '/recepciones': 'Recepciones',
  '/surtido': 'Surtido',
  '/etiquetado': 'Etiquetado',
  '/productividad': 'Productividad',
  '/incidencias': 'Incidencias',
}

function useFechaLarga() {
  const [fecha, setFecha] = useState('')
  useEffect(() => {
    setFecha(
      new Intl.DateTimeFormat('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date()),
    )
  }, [])
  return fecha
}

export function Topbar() {
  const pathname = usePathname()
  const router = useRouter()
  const fecha = useFechaLarga()
  const titulo = TITULOS[pathname] ?? 'CEDIS ·CTRL'

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-4 md:px-6">
      <div className="flex min-w-0 flex-col">
        <h1 className="truncate text-base font-semibold text-foreground md:text-lg">{titulo}</h1>
        <p className="hidden truncate text-xs capitalize text-muted-foreground sm:block">
          {fecha}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => router.refresh()}>
          <RefreshCw data-icon="inline-start" />
          Actualizar
        </Button>
      </div>
    </header>
  )
}
