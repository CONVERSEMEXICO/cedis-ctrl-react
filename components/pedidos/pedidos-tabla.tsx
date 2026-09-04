'use client'

// Tabla de pedidos del ERP: filtro por estado, conteo y acción por renglón.
//
// No usa <ModuleControlView> porque no comparte su mecánica: un pedido no se
// da de alta ni se borra desde el panel —lo captura el ERP— y su estado no se
// cambia con un select, sino como efecto de abrir el surtido. Lo único común
// sería el filtro, y forzar la vista genérica a soportar un módulo de solo
// lectura habría complicado los cuatro módulos que sí escriben.

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CrearSurtidoDialog } from '@/components/pedidos/crear-surtido-dialog'
import { EstadoBadge } from '@/components/shared/estado-badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatFecha, formatNumero } from '@/lib/format'
import { esFechaVencida } from '@/lib/metrics'
import { ESTADOS_PEDIDO, ESTADO_PEDIDO } from '@/lib/status-config'
import { cn } from '@/lib/utils'
import type { Pedido } from '@/types/cedis'

const TODOS = 'todos'

/** Estados en los que ya existe una orden de surtido que se puede visitar. */
const CON_SURTIDO: readonly Pedido['estado'][] = ['asignado', 'completado']

export function PedidosTabla({
  pedidos,
  conteoLineas,
  ahora,
}: {
  pedidos: Pedido[]
  conteoLineas: Record<string, number>
  /** El mismo instante con el que se calcularon los indicadores de arriba. */
  ahora: Date
}) {
  const router = useRouter()
  const [filtro, setFiltro] = useState<string>(TODOS)

  const visibles = filtro === TODOS ? pedidos : pedidos.filter((p) => p.estado === filtro)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filtro} onValueChange={(valor) => setFiltro(String(valor))}>
          <SelectTrigger size="sm" className="w-52" aria-label="Filtrar por estado">
            <SelectValue>
              {(valor) =>
                String(valor) === TODOS
                  ? 'Todos los estados'
                  : (ESTADO_PEDIDO[String(valor) as Pedido['estado']]?.label ?? String(valor))
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value={TODOS}>Todos los estados</SelectItem>
              {ESTADOS_PEDIDO.map((estado) => (
                <SelectItem key={estado.value} value={estado.value}>
                  {estado.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Mostrando <span className="font-mono tabular-nums text-foreground">{visibles.length}</span>{' '}
          de <span className="font-mono tabular-nums text-foreground">{pedidos.length}</span> pedidos
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Folio</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Fecha pedido</TableHead>
              <TableHead>Fecha requerida</TableHead>
              <TableHead className="text-right">Líneas</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.map((pedido) => {
              const lineas = conteoLineas[pedido.id] ?? 0
              const vencida =
                pedido.estado !== 'completado' &&
                pedido.estado !== 'cancelado' &&
                esFechaVencida(pedido.fecha_requerida, ahora)
              return (
                <TableRow
                  key={pedido.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/pedidos/${pedido.id}`)}
                >
                  <TableCell>
                    {/* El folio es un enlace real y no solo una fila clickeable:
                        es lo que hace la tabla navegable con el teclado. */}
                    <Link
                      href={`/pedidos/${pedido.id}`}
                      className="font-mono text-xs text-foreground hover:underline hover:underline-offset-2"
                      onClick={(evento) => evento.stopPropagation()}
                    >
                      {pedido.folio}
                    </Link>
                  </TableCell>
                  <TableCell>{pedido.cliente}</TableCell>
                  <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatFecha(pedido.fecha_pedido)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'font-mono text-xs tabular-nums',
                      vencida ? 'font-medium text-destructive' : 'text-muted-foreground',
                    )}
                    title={vencida ? 'La fecha requerida ya pasó' : undefined}
                  >
                    {formatFecha(pedido.fecha_requerida)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatNumero(lineas)}
                  </TableCell>
                  <TableCell>
                    <EstadoBadge config={ESTADO_PEDIDO[pedido.estado] ?? ESTADO_PEDIDO.pendiente} />
                  </TableCell>
                  <TableCell className="text-right">
                    {/* stopPropagation en el contenedor: cualquier control de
                        esta celda —el botón, y el diálogo que monta— dispararía
                        si no la navegación de la fila. */}
                    <div
                      className="flex justify-end"
                      onClick={(evento) => evento.stopPropagation()}
                    >
                      {pedido.estado === 'pendiente' && (
                        <CrearSurtidoDialog pedido={pedido} lineas={lineas} />
                      )}
                      {CON_SURTIDO.includes(pedido.estado) && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => router.push(`/surtido?pedido=${pedido.id}`)}
                        >
                          Ver surtido
                          <ArrowRight data-icon="inline-end" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {visibles.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                  No hay pedidos con este filtro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
