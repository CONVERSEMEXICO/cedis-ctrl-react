import { AlertCircle } from 'lucide-react'
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
import { obtenerLotesEtiquetado } from '@/lib/data'
import { formatFechaHora, formatNumero } from '@/lib/format'
import { ESTADO_ETIQUETADO } from '@/lib/status-config'

export default async function EtiquetadoPage() {
  const lotes = await obtenerLotesEtiquetado()
  const rechazados = lotes.filter((l) => l.estado === 'rechazado').length

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Etiquetado"
        description="Aplicación de etiquetas de SKU, precio y caducidad por lote"
        accentClassName="bg-etiquetado"
        actions={
          <div className="flex flex-col text-right">
            <span className="font-mono text-lg font-semibold tabular-nums text-destructive">
              {rechazados}
            </span>
            <span className="text-xs text-muted-foreground">rechazados</span>
          </div>
        }
      />

      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Folio</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo de etiqueta</TableHead>
              <TableHead className="text-right">Unidades</TableHead>
              <TableHead>Proceso</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Responsable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lotes.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-mono text-xs text-foreground">{l.folio}</TableCell>
                <TableCell>{l.cliente}</TableCell>
                <TableCell className="text-muted-foreground">{l.tipoEtiqueta}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatNumero(l.unidades)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatFechaHora(l.fechaProceso)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <EstadoBadge config={ESTADO_ETIQUETADO[l.estado]} />
                    {l.motivoRechazo && (
                      <span className="flex items-start gap-1 text-xs text-destructive">
                        <AlertCircle className="mt-0.5 size-3 shrink-0" aria-hidden />
                        {l.motivoRechazo}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{l.responsable}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
