'use client'

// Detalle de un pedido: cabecera, surtido asociado y renglones.
//
// No hace fetch propio. Los tres conjuntos que necesita —pedidos, sus líneas y
// los registros de surtido— ya vienen en la carga agrupada de
// <ProveedorDatosCedis>, así que abrir un detalle no cuesta una petición más
// contra Fabric (ver "Límite de tasa" en CLAUDE.md) y la vista sigue
// funcionando con el respaldo seed.

import { ArrowLeft, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { CancelarPedidoDialog } from '@/components/pedidos/cancelar-pedido-dialog'
import { useDatosCedis } from '@/components/providers/cedis-data-provider'
import { BannerOffline } from '@/components/shared/banner-offline'
import { EstadoBadge } from '@/components/shared/estado-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatFecha, formatNumero, formatTexto } from '@/lib/format'
import { esFechaVencida, lineaCumplida, lineasDePedido, surtidoDePedido } from '@/lib/metrics'
import {
  ESTADO_PEDIDO,
  ESTADO_SURTIDO,
  PRIORIDAD_CONFIG,
  type EstadoConfig,
} from '@/lib/status-config'
import { cn } from '@/lib/utils'

const CUMPLIDA: EstadoConfig = {
  label: 'Cumplida',
  dotClass: 'bg-success',
  badgeClass: 'bg-success/15 text-success',
}

const NO_CUMPLIDA: EstadoConfig = {
  label: 'Pendiente',
  dotClass: 'bg-muted-foreground',
  badgeClass: 'bg-secondary text-secondary-foreground',
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{etiqueta}</span>
      <span className="text-sm text-foreground">{children}</span>
    </div>
  )
}

export default function PedidoDetallePage() {
  const params = useParams<{ id: string }>()
  const { datos, offline } = useDatosCedis()

  const pedido = datos.pedidos.find((p) => p.id === params.id) ?? null
  // El orden de `linea` ya viene del ERP vía la query (`orderBy: { linea: ASC }`)
  // y el seed lo reproduce: aquí solo se filtra, nunca se reordena.
  const lineas = pedido ? lineasDePedido(datos.pedidoLineas, pedido.id) : []
  const surtido = pedido ? surtidoDePedido(datos.pedidosSurtido, pedido.id) : null

  const volver = (
    <Button variant="outline" size="sm" render={<Link href="/pedidos" />}>
      <ArrowLeft data-icon="inline-start" />
      Volver a pedidos
    </Button>
  )

  if (!pedido) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6">
        {volver}
        <p className="py-12 text-center text-sm text-muted-foreground">
          No se encontró el pedido solicitado.
        </p>
      </div>
    )
  }

  const vencida =
    pedido.estado !== 'completado' &&
    pedido.estado !== 'cancelado' &&
    esFechaVencida(pedido.fecha_requerida)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {volver}
        <div className="flex items-center gap-3">
          <CancelarPedidoDialog pedido={pedido} />
          <EstadoBadge
            config={ESTADO_PEDIDO[pedido.estado] ?? ESTADO_PEDIDO.pendiente}
            className="px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      {(offline.pedidos || offline.pedidoLineas) && <BannerOffline />}

      <Card className="border-t-2 border-t-pedidos">
        <CardHeader>
          <CardTitle className="font-mono text-lg">{pedido.folio}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Dato etiqueta="Cliente">{pedido.cliente}</Dato>
            <Dato etiqueta="Fecha de pedido">
              <span className="font-mono text-xs tabular-nums">
                {formatFecha(pedido.fecha_pedido)}
              </span>
            </Dato>
            <Dato etiqueta="Fecha requerida">
              <span
                className={cn(
                  'font-mono text-xs tabular-nums',
                  vencida && 'font-medium text-destructive',
                )}
              >
                {formatFecha(pedido.fecha_requerida)}
                {vencida && ' · vencida'}
              </span>
            </Dato>
            <div className="sm:col-span-2 lg:col-span-3">
              <Dato etiqueta="Dirección de entrega">
                <span className="text-muted-foreground">
                  {formatTexto(pedido.direccion_entrega)}
                </span>
              </Dato>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Dato etiqueta="Notas">
                <span className="text-muted-foreground">{formatTexto(pedido.notas)}</span>
              </Dato>
            </div>
          </div>
        </CardContent>
      </Card>

      {pedido.estado !== 'pendiente' && (
        <Card className="border-t-2 border-t-surtido">
          <CardHeader>
            <CardTitle className="text-base">Surtido asociado</CardTitle>
          </CardHeader>
          <CardContent>
            {surtido ? (
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Dato etiqueta="Folio">
                    <span className="font-mono text-xs">{surtido.pedido}</span>
                  </Dato>
                  <Dato etiqueta="Operador">
                    <span className="text-muted-foreground">{formatTexto(surtido.operador)}</span>
                  </Dato>
                  <Dato etiqueta="Prioridad">
                    <EstadoBadge
                      config={PRIORIDAD_CONFIG[surtido.prioridad] ?? PRIORIDAD_CONFIG.Media}
                    />
                  </Dato>
                  <Dato etiqueta="Estado">
                    <EstadoBadge
                      config={ESTADO_SURTIDO[surtido.estado] ?? ESTADO_SURTIDO.pendiente}
                    />
                  </Dato>
                </div>
                <Button size="sm" render={<Link href={`/surtido?pedido=${pedido.id}`} />}>
                  Ver en Surtido
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </div>
            ) : (
              // El pedido dice que ya se asignó, pero no hay registro que lo
              // atienda: pasa si el surtido se borró a mano. Se dice, en vez de
              // dejar la tarjeta en blanco.
              <p className="text-sm text-muted-foreground">
                Este pedido está marcado como{' '}
                {ESTADO_PEDIDO[pedido.estado]?.label.toLowerCase()}, pero no se encontró el
                registro de surtido vinculado.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">
          Líneas del pedido{' '}
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            ({lineas.length})
          </span>
        </h2>
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-right">Línea</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Cant. solicitada</TableHead>
                <TableHead className="text-right">Cant. surtida</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>Cumplida</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineas.map((linea) => (
                <TableRow key={linea.id}>
                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                    {linea.linea}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {formatTexto(linea.sku)}
                  </TableCell>
                  <TableCell>{linea.producto}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatNumero(linea.cantidad_solicitada)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatNumero(linea.cantidad_surtida)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{linea.unidad_medida}</TableCell>
                  <TableCell>
                    <EstadoBadge config={lineaCumplida(linea) ? CUMPLIDA : NO_CUMPLIDA} />
                  </TableCell>
                </TableRow>
              ))}
              {lineas.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={7}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    Este pedido no tiene líneas capturadas.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
