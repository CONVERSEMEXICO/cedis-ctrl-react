import { AlertTriangle, Gauge, PackageCheck, Tag, Truck, Warehouse } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CumplimientoChart, type CumplimientoDato } from '@/components/dashboard/cumplimiento-chart'
import { IncidenciasRecientes } from '@/components/dashboard/incidencias-recientes'
import {
  IncidenciasSeveridadChart,
  type SeveridadDato,
} from '@/components/dashboard/incidencias-severidad-chart'
import { KpiTile } from '@/components/dashboard/kpi-tile'
import { obtenerDatosCedis } from '@/lib/data'
import {
  conteoPorSeveridad,
  incidenciasAbiertas,
  metricasEmbarques,
  metricasEtiquetado,
  metricasIncidencias,
  metricasProductividad,
  metricasRecepciones,
  metricasSurtido,
} from '@/lib/metrics'
import { SEVERIDAD_CONFIG } from '@/lib/status-config'
import type { Severidad } from '@/types/cedis'

export default async function DashboardPage() {
  const { embarques, recepciones, pedidosSurtido, lotesEtiquetado, incidencias, productividad } =
    await obtenerDatosCedis()

  const mEmbarques = metricasEmbarques(embarques)
  const mRecepciones = metricasRecepciones(recepciones)
  const mSurtido = metricasSurtido(pedidosSurtido)
  const mEtiquetado = metricasEtiquetado(lotesEtiquetado)
  const mIncidencias = metricasIncidencias(incidencias)
  const mProductividad = metricasProductividad(productividad)

  const cumplimientoData: CumplimientoDato[] = [
    { proceso: 'Embarques', valor: mEmbarques.pctEntregados, fill: 'var(--module-embarques)' },
    { proceso: 'Recepciones', valor: mRecepciones.pctRecibidas, fill: 'var(--module-recepciones)' },
    { proceso: 'Surtido', valor: mSurtido.pctCompletados, fill: 'var(--module-surtido)' },
    { proceso: 'Etiquetado', valor: mEtiquetado.pctEtiquetados, fill: 'var(--module-etiquetado)' },
  ]

  const conteoSeveridad = conteoPorSeveridad(incidenciasAbiertas(incidencias))
  const severidades: Severidad[] = ['baja', 'media', 'alta', 'critica']
  const severidadData: SeveridadDato[] = severidades
    .map((sev) => ({
      severidad: SEVERIDAD_CONFIG[sev].label,
      cantidad: conteoSeveridad[sev],
      fill: SEVERIDAD_CONFIG[sev].chartVar,
    }))
    .filter((d) => d.cantidad > 0)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <section aria-label="Indicadores clave">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiTile
            href="/embarques"
            title="Embarques"
            icon={Truck}
            accentClass="border-t-embarques"
            primaryValue={String(mEmbarques.total)}
            primaryLabel="total"
            metrics={[
              { label: '% entregados', value: `${mEmbarques.pctEntregados}%` },
              {
                label: 'Retrasados',
                value: String(mEmbarques.retrasados),
                danger: mEmbarques.retrasados > 0,
              },
            ]}
          />
          <KpiTile
            href="/recepciones"
            title="Recepciones"
            icon={PackageCheck}
            accentClass="border-t-recepciones"
            primaryValue={String(mRecepciones.total)}
            primaryLabel="total"
            metrics={[
              { label: '% recibidas', value: `${mRecepciones.pctRecibidas}%` },
              {
                label: 'Con discrepancia',
                value: String(mRecepciones.conDiscrepancia),
                danger: mRecepciones.conDiscrepancia > 0,
              },
            ]}
          />
          <KpiTile
            href="/surtido"
            title="Surtido"
            icon={Warehouse}
            accentClass="border-t-surtido"
            primaryValue={String(mSurtido.total)}
            primaryLabel="total"
            metrics={[{ label: '% completados', value: `${mSurtido.pctCompletados}%` }]}
          />
          <KpiTile
            href="/etiquetado"
            title="Etiquetado"
            icon={Tag}
            accentClass="border-t-etiquetado"
            primaryValue={String(mEtiquetado.total)}
            primaryLabel="total"
            metrics={[{ label: '% etiquetados', value: `${mEtiquetado.pctEtiquetados}%` }]}
          />
          <KpiTile
            href="/incidencias"
            title="Incidencias abiertas"
            icon={AlertTriangle}
            accentClass="border-t-incidencias"
            primaryValue={String(mIncidencias.abiertas)}
            primaryLabel="abiertas"
            metrics={[
              {
                label: 'Críticas',
                value: String(mIncidencias.criticas),
                danger: mIncidencias.criticas > 0,
              },
            ]}
          />
          <KpiTile
            href="/productividad"
            title="Productividad"
            icon={Gauge}
            accentClass="border-t-productividad"
            primaryValue={String(mProductividad.promedioUnidadesHora)}
            primaryLabel="uds/hora"
            metrics={[
              { label: '% cumplimiento vs meta', value: `${mProductividad.pctCumplimientoMeta}%` },
            ]}
          />
        </div>
      </section>

      <section
        aria-label="Panorama operativo"
        className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cumplimiento por proceso</CardTitle>
          </CardHeader>
          <CardContent>
            <CumplimientoChart datos={cumplimientoData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Incidencias abiertas por severidad</CardTitle>
          </CardHeader>
          <CardContent>
            {severidadData.length > 0 ? (
              <IncidenciasSeveridadChart datos={severidadData} />
            ) : (
              <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                Sin incidencias abiertas
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section aria-label="Incidencias recientes">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Incidencias recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <IncidenciasRecientes incidencias={incidencias} />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
