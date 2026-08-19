import { Badge } from '@/components/ui/badge'
import {
  ESTADO_INCIDENCIA,
  MODULO_LABEL,
  SEVERIDAD_CONFIG,
  TIPO_INCIDENCIA_LABEL,
} from '@/lib/status-config'
import { cn } from '@/lib/utils'
import type { Incidencia } from '@/types/cedis'

export function IncidenciasRecientes({ incidencias }: { incidencias: Incidencia[] }) {
  const ordenadas = [...incidencias]
    .sort((a, b) => {
      const aAbierta = a.estado === 'abierta' || a.estado === 'atencion'
      const bAbierta = b.estado === 'abierta' || b.estado === 'atencion'
      if (aAbierta !== bAbierta) return aAbierta ? -1 : 1
      return new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime()
    })
    .slice(0, 6)

  return (
    <ul className="flex flex-col gap-2">
      {ordenadas.map((incidencia) => {
        const severidad = SEVERIDAD_CONFIG[incidencia.severidad]
        const estado = ESTADO_INCIDENCIA[incidencia.estado]
        return (
          <li
            key={incidencia.id}
            className={cn(
              'flex gap-3 rounded-md border border-border bg-card p-3 border-l-4',
            )}
            style={{ borderLeftColor: `var(--severidad-${incidencia.severidad})` }}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-sm font-semibold text-foreground">
                  {incidencia.folio}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {TIPO_INCIDENCIA_LABEL[incidencia.tipo]}
                </span>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {MODULO_LABEL[incidencia.modulo]} · {incidencia.responsable}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end justify-between gap-1">
              <Badge className={cn('border-0', estado.badgeClass)}>{estado.label}</Badge>
              <Badge className={cn('border-0', severidad.badgeClass)} variant="outline">
                {severidad.label}
              </Badge>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
