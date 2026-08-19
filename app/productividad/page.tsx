import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ProductividadChart, type ProductividadDato } from '@/components/productividad/productividad-chart'
import { PageHeader } from '@/components/shared/page-header'
import { obtenerRegistrosProductividad } from '@/lib/data'
import { formatFecha } from '@/lib/format'
import { cumplimientoRegistro, metricasProductividad } from '@/lib/metrics'
import { cn } from '@/lib/utils'

const TURNO_LABEL: Record<string, string> = {
  matutino: 'Matutino',
  vespertino: 'Vespertino',
  nocturno: 'Nocturno',
}

export default async function ProductividadPage() {
  const registros = await obtenerRegistrosProductividad()

  const chartData: ProductividadDato[] = registros.map((r) => ({
    responsable: r.responsable.split(' ')[0],
    real: r.unidadesPorHora,
    meta: r.metaUnidadesPorHora,
  }))

  const { pctCumplimientoMeta } = metricasProductividad(registros)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Productividad"
        description="Unidades procesadas por hora frente a la meta operativa, por área y turno"
        accentClassName="bg-productividad"
        actions={
          <div className="flex flex-col text-right">
            <span className="font-mono text-lg font-semibold tabular-nums text-productividad">
              {pctCumplimientoMeta}%
            </span>
            <span className="text-xs text-muted-foreground">cumplimiento promedio</span>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Real vs meta por responsable</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductividadChart datos={chartData} />
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Área</TableHead>
              <TableHead>Responsable</TableHead>
              <TableHead>Turno</TableHead>
              <TableHead className="text-right">Real (uds/h)</TableHead>
              <TableHead className="text-right">Meta (uds/h)</TableHead>
              <TableHead className="text-right">Cumplimiento</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registros.map((r) => {
              const cumplimiento = cumplimientoRegistro(r)
              return (
                <TableRow key={r.id}>
                  <TableCell>{r.area}</TableCell>
                  <TableCell className="text-muted-foreground">{r.responsable}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{TURNO_LABEL[r.turno]}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {r.unidadesPorHora}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                    {r.metaUnidadesPorHora}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right font-mono font-medium tabular-nums',
                      cumplimiento >= 100 ? 'text-success' : 'text-warning',
                    )}
                  >
                    {cumplimiento}%
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatFecha(r.fecha)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
