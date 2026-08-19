import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { EstadoBadge } from '@/components/shared/estado-badge'
import { PageHeader } from '@/components/shared/page-header'
import { obtenerPedidosSurtido } from '@/lib/data'
import { formatFechaHora, formatNumero } from '@/lib/format'
import { avanceSurtido, metricasSurtido } from '@/lib/metrics'
import { ESTADO_SURTIDO } from '@/lib/status-config'
import { cn } from '@/lib/utils'

export default async function SurtidoPage() {
  const pedidos = await obtenerPedidosSurtido()
  const { enProceso } = metricasSurtido(pedidos)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Surtido"
        description="Preparación de pedidos por zona de picking"
        accentClassName="bg-surtido"
        actions={
          <div className="flex flex-col text-right">
            <span className="font-mono text-lg font-semibold tabular-nums text-surtido">
              {enProceso}
            </span>
            <span className="text-xs text-muted-foreground">en proceso</span>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pedidos.map((p) => {
          const avance = avanceSurtido(p)
          return (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                <div className="flex flex-col gap-1">
                  <CardTitle className="font-mono text-sm">{p.folio}</CardTitle>
                  <span className="text-xs text-muted-foreground">{p.cliente}</span>
                </div>
                <EstadoBadge config={ESTADO_SURTIDO[p.estado]} />
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{p.zona}</span>
                    <span className="font-mono tabular-nums text-foreground">
                      {formatNumero(p.unidadesSurtidas)} / {formatNumero(p.unidadesTotales)}
                    </span>
                  </div>
                  <Progress
                    value={avance}
                    className={cn(
                      '[&_[data-slot=progress-indicator]]:bg-primary',
                      p.estado === 'completado' && '[&_[data-slot=progress-indicator]]:bg-success',
                      p.estado === 'pausado' && '[&_[data-slot=progress-indicator]]:bg-destructive',
                      p.estado === 'surtiendo' && '[&_[data-slot=progress-indicator]]:bg-surtido',
                    )}
                  />
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2 text-xs text-muted-foreground">
                  <span>{p.responsable}</span>
                  <span>Límite: {formatFechaHora(p.fechaLimite)}</span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
