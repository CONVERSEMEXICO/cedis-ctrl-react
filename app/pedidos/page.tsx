'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PedidosTabla } from '@/components/pedidos/pedidos-tabla'
import { useDatosCedis } from '@/components/providers/cedis-data-provider'
import { BannerOffline } from '@/components/shared/banner-offline'
import { PageHeader } from '@/components/shared/page-header'
import { formatNumero } from '@/lib/format'
import { conteoLineasPorPedido, metricasPedidos } from '@/lib/metrics'
import { cn } from '@/lib/utils'

export default function PedidosPage() {
  const { datos, offline } = useDatosCedis()
  const { pedidos, pedidoLineas } = datos
  // Un solo instante para los indicadores y la tabla: con dos relojes distintos
  // una fila puede pintarse vencida mientras el conteo de arriba dice que no
  // hay ninguna.
  const ahora = new Date()
  const { pendientes, vencidos, lineasPendientes } = metricasPedidos(pedidos, pedidoLineas, ahora)
  const conteoLineas = conteoLineasPorPedido(pedidoLineas)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Pedidos"
        description="Pedidos capturados en el ERP y su asignación a surtido"
        accentClassName="bg-pedidos"
      />

      {(offline.pedidos || offline.pedidoLineas) && <BannerOffline />}

      <section aria-label="Indicadores de pedidos">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="border-t-2 border-t-pedidos">
            <CardHeader>
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Pendientes de asignar a surtido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="font-mono text-3xl font-semibold tabular-nums text-pedidos">
                {formatNumero(pendientes)}
              </span>
            </CardContent>
          </Card>
          <Card className={cn('border-t-2', vencidos > 0 ? 'border-t-destructive' : 'border-t-border')}>
            <CardHeader>
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Con fecha requerida vencida
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span
                className={cn(
                  'font-mono text-3xl font-semibold tabular-nums',
                  vencidos > 0 ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {formatNumero(vencidos)}
              </span>
            </CardContent>
          </Card>
          <Card className="border-t-2 border-t-surtido">
            <CardHeader>
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Piezas pendientes por surtir
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="font-mono text-3xl font-semibold tabular-nums text-surtido">
                {formatNumero(lineasPendientes)}
              </span>
            </CardContent>
          </Card>
        </div>
      </section>

      <PedidosTabla pedidos={pedidos} conteoLineas={conteoLineas} ahora={ahora} />
    </div>
  )
}
