import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ProductividadChart,
  type ProductividadDato,
} from '@/components/productividad/productividad-chart'
import { ProductividadTabla } from '@/components/productividad/productividad-tabla'
import { RegistrarTurnoDialog } from '@/components/productividad/registrar-turno-dialog'
import { BannerOffline } from '@/components/shared/banner-offline'
import { PageHeader } from '@/components/shared/page-header'
import { cargarRegistrosProductividad } from '@/lib/data'
import { formatNumero } from '@/lib/format'
import { metricasProductividad, unidadesPorHora } from '@/lib/metrics'

export default async function ProductividadPage() {
  const { datos: registros, offline } = await cargarRegistrosProductividad()
  const { promedioUnidadesHora, pctCumplimientoMeta, turnosBajoMeta } =
    metricasProductividad(registros)

  const chartData: ProductividadDato[] = registros.map((registro) => ({
    operador: registro.operador.split(' ')[0],
    unidadesHora: unidadesPorHora(registro),
  }))

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Productividad"
        description="Unidades procesadas por turno frente a la meta operativa, por área y operador"
        accentClassName="bg-productividad"
        actions={<RegistrarTurnoDialog />}
      />

      {offline && <BannerOffline />}

      <section aria-label="Indicadores de productividad">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="border-t-2 border-t-productividad">
            <CardHeader>
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Promedio unidades/hora
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="font-mono text-3xl font-semibold tabular-nums text-productividad">
                {formatNumero(promedioUnidadesHora)}
              </span>
            </CardContent>
          </Card>
          <Card className="border-t-2 border-t-success">
            <CardHeader>
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Cumplimiento promedio vs meta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="font-mono text-3xl font-semibold tabular-nums text-success">
                {pctCumplimientoMeta}%
              </span>
            </CardContent>
          </Card>
          <Card className="border-t-2 border-t-destructive">
            <CardHeader>
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Turnos por debajo de meta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="font-mono text-3xl font-semibold tabular-nums text-destructive">
                {turnosBajoMeta}
              </span>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Unidades por hora por operador</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductividadChart datos={chartData} />
        </CardContent>
      </Card>

      <ProductividadTabla registros={registros} />
    </div>
  )
}
