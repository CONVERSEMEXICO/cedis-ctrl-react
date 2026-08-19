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
import { obtenerRecepciones } from '@/lib/data'
import { formatFechaHora, formatNumero } from '@/lib/format'
import { metricasRecepciones } from '@/lib/metrics'
import { ESTADO_RECEPCION } from '@/lib/status-config'
import { cn } from '@/lib/utils'

export default async function RecepcionesPage() {
  const recepciones = await obtenerRecepciones()
  const { conDiscrepancia } = metricasRecepciones(recepciones)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Recepciones"
        description="Ingreso de mercancía de proveedores al centro de distribución"
        accentClassName="bg-recepciones"
        actions={
          <div className="flex flex-col text-right">
            <span className="font-mono text-lg font-semibold tabular-nums text-destructive">
              {conDiscrepancia}
            </span>
            <span className="text-xs text-muted-foreground">con discrepancia</span>
          </div>
        }
      />

      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Folio</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Transportista</TableHead>
              <TableHead>Andén</TableHead>
              <TableHead className="text-right">Esperadas</TableHead>
              <TableHead className="text-right">Recibidas</TableHead>
              <TableHead>Programada</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Responsable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recepciones.map((r) => (
              <TableRow key={r.id} className={cn(r.tieneDiscrepancia && 'bg-destructive/5')}>
                <TableCell className="font-mono text-xs text-foreground">{r.folio}</TableCell>
                <TableCell>{r.proveedor}</TableCell>
                <TableCell className="text-muted-foreground">{r.transportista}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {r.anden ?? '—'}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatNumero(r.unidadesEsperadas)}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right font-mono tabular-nums',
                    r.tieneDiscrepancia && 'text-destructive',
                  )}
                >
                  {r.unidadesRecibidas !== undefined ? formatNumero(r.unidadesRecibidas) : '—'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatFechaHora(r.fechaProgramada)}
                </TableCell>
                <TableCell>
                  <EstadoBadge config={ESTADO_RECEPCION[r.estado]} />
                </TableCell>
                <TableCell className="text-muted-foreground">{r.responsable}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
