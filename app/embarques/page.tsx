import { Truck } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EstadoBadge } from '@/components/shared/estado-badge'
import { PageHeader } from '@/components/shared/page-header'
import { obtenerEmbarques } from '@/lib/data'
import { formatFechaHora, formatNumero } from '@/lib/format'
import { metricasEmbarques } from '@/lib/metrics'
import { ESTADO_EMBARQUE } from '@/lib/status-config'

export default async function EmbarquesPage() {
  const embarques = await obtenerEmbarques()
  const { totalUnidades, retrasados } = metricasEmbarques(embarques)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Embarques"
        description="Salidas de mercancía hacia centros de distribución y clientes"
        accentClassName="bg-embarques"
        actions={
          <div className="flex items-center gap-4 text-right">
            <div className="flex flex-col">
              <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
                {formatNumero(totalUnidades)}
              </span>
              <span className="text-xs text-muted-foreground">unidades totales</span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-lg font-semibold tabular-nums text-destructive">
                {retrasados}
              </span>
              <span className="text-xs text-muted-foreground">retrasados</span>
            </div>
          </div>
        }
      />

      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Folio</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Transportista</TableHead>
              <TableHead>Andén</TableHead>
              <TableHead className="text-right">Unidades</TableHead>
              <TableHead>Programado</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Responsable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {embarques.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-xs text-foreground">{e.folio}</TableCell>
                <TableCell>{e.cliente}</TableCell>
                <TableCell className="text-muted-foreground">{e.destino}</TableCell>
                <TableCell className="text-muted-foreground">{e.transportista}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {e.anden ?? '—'}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatNumero(e.unidades)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatFechaHora(e.fechaProgramada)}
                </TableCell>
                <TableCell>
                  <EstadoBadge config={ESTADO_EMBARQUE[e.estado]} />
                </TableCell>
                <TableCell className="text-muted-foreground">{e.responsable}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {embarques.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
          <Truck className="size-8" aria-hidden />
          <p className="text-sm">No hay embarques registrados.</p>
        </div>
      )}
    </div>
  )
}
