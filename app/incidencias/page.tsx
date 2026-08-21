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
import { obtenerIncidencias } from '@/lib/data'
import { formatFechaHora } from '@/lib/format'
import { metricasIncidencias, ordenarPorFechaCreacionDesc } from '@/lib/metrics'
import {
  ESTADO_INCIDENCIA,
  MODULO_DOT_CLASS,
  MODULO_LABEL,
  SEVERIDAD_CONFIG,
  TIPO_INCIDENCIA_LABEL,
} from '@/lib/status-config'
import { cn } from '@/lib/utils'

export default async function IncidenciasPage() {
  const incidencias = await obtenerIncidencias()
  const { abiertas, criticas } = metricasIncidencias(incidencias)
  const ordenadas = ordenarPorFechaCreacionDesc(incidencias)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Incidencias"
        description="Eventos operativos que requieren seguimiento y resolución"
        accentClassName="bg-incidencias"
        actions={
          <div className="flex items-center gap-4">
            <div className="flex flex-col text-right">
              <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
                {abiertas}
              </span>
              <span className="text-xs text-muted-foreground">abiertas</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="font-mono text-lg font-semibold tabular-nums text-destructive">
                {criticas}
              </span>
              <span className="text-xs text-muted-foreground">críticas</span>
            </div>
          </div>
        }
      />

      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Folio</TableHead>
              <TableHead>Módulo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Severidad</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Responsable</TableHead>
              <TableHead>Creada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordenadas.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-mono text-xs text-foreground">{i.folio}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className={cn('size-1.5 rounded-full', MODULO_DOT_CLASS[i.modulo])}
                      aria-hidden
                    />
                    {MODULO_LABEL[i.modulo]}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {TIPO_INCIDENCIA_LABEL[i.tipo]}
                </TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground" title={i.descripcion}>
                  {i.descripcion}
                </TableCell>
                <TableCell>
                  <EstadoBadge config={SEVERIDAD_CONFIG[i.severidad]} />
                </TableCell>
                <TableCell>
                  <EstadoBadge config={ESTADO_INCIDENCIA[i.estado]} />
                </TableCell>
                <TableCell className="text-muted-foreground">{i.responsable}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatFechaHora(i.fechaCreacion)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
