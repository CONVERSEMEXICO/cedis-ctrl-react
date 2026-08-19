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
import { SEVERIDAD_CONFIG } from '@/lib/status-config'
import type { Severidad } from '@/types/cedis'

function pct(numerador: number, denominador: number) {
  if (denominador === 0) return 0
  return Math.round((numerador / denominador) * 100)
}

export default async function DashboardPage() {
  const { embarques, recepciones, pedidosSurtido, lotesEtiquetado, incidencias, productividad } =
    await obtenerDatosCedis()

  const embarquesEntregados = embarques.filter((e) => e.estado === 'entregado').length
  const embarquesRetrasados = embarques.filter((e) => e.estado === 'retrasado').length
  const pctEntregados = pct(embarquesEntregados, embarques.length)

  const recepcionesRecibidas = recepciones.filter((r) => r.estado === 'recibida').length
  const recepcionesDiscrepancia = recepciones.filter((r) => r.tieneDiscrepancia).length
  const pctRecibidas = pct(recepcionesRecibidas, recepciones.length)

  const surtidoCompletado = pedidosSurtido.filter((s) => s.estado === 'completado').length
  const pctSurtidoCompletado = pct(surtidoCompletado, pedidosSurtido.length)

  const etiquetadoCompletado = lotesEtiquetado.filter((l) => l.estado === 'etiquetado').length
  const pctEtiquetado = pct(etiquetadoCompletado, lotesEtiquetado.length)

  const incidenciasAbiertas = incidencias.filter(
    (i) => i.estado === 'abierta' || i.estado === 'atencion',
  )
  const incidenciasCriticas = incidenciasAbiertas.filter((i) => i.severidad === 'critica').length

  const promedioUnidadesHora =
    productividad.length > 0
      ? Math.round(
          productividad.reduce((acc, p) => acc + p.unidadesPorHora, 0) / productividad.length,
        )
      : 0
  const pctCumplimientoMeta =
    productividad.length > 0
      ? Math.round(
          (productividad.reduce((acc, p) => acc + p.unidadesPorHora / p.metaUnidadesPorHora, 0) /
            productividad.length) *
            100,
        )
      : 0

  const cumplimientoData: CumplimientoDato[] = [
    { proceso: 'Embarques', valor: pctEntregados, fill: 'var(--module-embarques)' },
    { proceso: 'Recepciones', valor: pctRecibidas, fill: 'var(--module-recepciones)' },
    { proceso: 'Surtido', valor: pctSurtidoCompletado, fill: 'var(--module-surtido)' },
    { proceso: 'Etiquetado', valor: pctEtiquetado, fill: 'var(--module-etiquetado)' },
  ]

  const severidades: Severidad[] = ['baja', 'media', 'alta', 'critica']
  const severidadData: SeveridadDato[] = severidades
    .map((sev) => ({
      severidad: SEVERIDAD_CONFIG[sev].label,
      cantidad: incidenciasAbiertas.filter((i) => i.severidad === sev).length,
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
            primaryValue={String(embarques.length)}
            primaryLabel="total"
            metrics={[
              { label: '% entregados', value: `${pctEntregados}%` },
              {
                label: 'Retrasados',
                value: String(embarquesRetrasados),
                danger: embarquesRetrasados > 0,
              },
            ]}
          />
          <KpiTile
            href="/recepciones"
            title="Recepciones"
            icon={PackageCheck}
            accentClass="border-t-recepciones"
            primaryValue={String(recepciones.length)}
            primaryLabel="total"
            metrics={[
              { label: '% recibidas', value: `${pctRecibidas}%` },
              {
                label: 'Con discrepancia',
                value: String(recepcionesDiscrepancia),
                danger: recepcionesDiscrepancia > 0,
              },
            ]}
          />
          <KpiTile
            href="/surtido"
            title="Surtido"
            icon={Warehouse}
            accentClass="border-t-surtido"
            primaryValue={String(pedidosSurtido.length)}
            primaryLabel="total"
            metrics={[{ label: '% completados', value: `${pctSurtidoCompletado}%` }]}
          />
          <KpiTile
            href="/etiquetado"
            title="Etiquetado"
            icon={Tag}
            accentClass="border-t-etiquetado"
            primaryValue={String(lotesEtiquetado.length)}
            primaryLabel="total"
            metrics={[{ label: '% etiquetados', value: `${pctEtiquetado}%` }]}
          />
          <KpiTile
            href="/incidencias"
            title="Incidencias abiertas"
            icon={AlertTriangle}
            accentClass="border-t-incidencias"
            primaryValue={String(incidenciasAbiertas.length)}
            primaryLabel="abiertas"
            metrics={[
              {
                label: 'Críticas',
                value: String(incidenciasCriticas),
                danger: incidenciasCriticas > 0,
              },
            ]}
          />
          <KpiTile
            href="/productividad"
            title="Productividad"
            icon={Gauge}
            accentClass="border-t-productividad"
            primaryValue={String(promedioUnidadesHora)}
            primaryLabel="uds/hora"
            metrics={[{ label: '% cumplimiento vs meta', value: `${pctCumplimientoMeta}%` }]}
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
