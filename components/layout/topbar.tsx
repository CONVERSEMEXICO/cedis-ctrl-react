'use client'

import { RefreshCw } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ReportarIncidenciaDialog } from '@/components/incidencias/reportar-incidencia-dialog'
import { CREACION_POR_RUTA } from '@/components/modulos/configs'
import { CrearRegistroDialog } from '@/components/modulos/crear-registro-dialog'
import { RegistrarTurnoDialog } from '@/components/productividad/registrar-turno-dialog'
import { useDatosCedis } from '@/components/providers/cedis-data-provider'
import { Button } from '@/components/ui/button'
import { mensajeLimiteExcedido } from '@/lib/graphql'
import { cn } from '@/lib/utils'
import type { ModuloOperativo } from '@/types/cedis'

const TITULOS: Record<string, string> = {
  '/': 'Dashboard',
  '/embarques': 'Embarques',
  '/recepciones': 'Recepciones',
  '/surtido': 'Surtido',
  '/pedidos': 'Pedidos',
  '/etiquetado': 'Etiquetado',
  '/productividad': 'Productividad',
  '/incidencias': 'Incidencias',
}

/**
 * Módulo que se preselecciona al reportar una incidencia desde cada ruta.
 *
 * `/pedidos` no aparece a propósito: `ModuloOperativo` son los seis módulos
 * sobre los que se levanta una incidencia, y un problema con un pedido se
 * reporta contra surtido. Sin entrada, el diálogo abre sin preselección —el
 * mismo comportamiento que en el dashboard.
 */
const MODULO_POR_RUTA: Record<string, ModuloOperativo> = {
  '/embarques': 'embarques',
  '/recepciones': 'recepciones',
  '/surtido': 'surtido',
  '/etiquetado': 'etiquetado',
  '/productividad': 'productividad',
  '/incidencias': 'incidencias',
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
  const { cargando, limitado, refrescar } = useDatosCedis()
  const fecha = useFechaLarga()
  const titulo = TITULOS[pathname] ?? 'CEDIS ·CTRL'
  const creacion = CREACION_POR_RUTA[pathname]
  const modulo = MODULO_POR_RUTA[pathname]

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-4 md:px-6">
      <div className="flex min-w-0 flex-col">
        <h1 className="truncate text-base font-semibold text-foreground md:text-lg">{titulo}</h1>
        <p className="hidden truncate text-xs capitalize text-muted-foreground sm:block">
          {fecha}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refrescar()}
          disabled={cargando || limitado}
          // Con la ventana de bloqueo abierta el botón no sirve de nada: Fabric
          // sigue rechazando y cada intento alarga el castigo.
          title={limitado ? mensajeLimiteExcedido() : undefined}
        >
          <RefreshCw className={cn(cargando && 'animate-spin')} data-icon="inline-start" />
          <span className="hidden sm:inline">Actualizar</span>
        </Button>
        {creacion && <CrearRegistroDialog config={creacion} />}
        {pathname === '/productividad' && <RegistrarTurnoDialog />}
        <ReportarIncidenciaDialog moduloInicial={modulo} />
      </div>
    </header>
  )
}
