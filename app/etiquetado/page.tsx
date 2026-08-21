import { EtiquetadoControl } from '@/components/modulos/configs'
import { BannerOffline } from '@/components/shared/banner-offline'
import { PageHeader } from '@/components/shared/page-header'
import { cargarLotesEtiquetado } from '@/lib/data'
import { metricasEtiquetado } from '@/lib/metrics'

export default async function EtiquetadoPage() {
  const { datos: lotes, offline } = await cargarLotesEtiquetado()
  const { pctEtiquetados, rechazados } = metricasEtiquetado(lotes)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Etiquetado"
        description="Aplicación de etiquetas de SKU, precio y caducidad por lote"
        accentClassName="bg-etiquetado"
        actions={
          <div className="flex items-center gap-4 text-right">
            <div className="flex flex-col">
              <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
                {pctEtiquetados}%
              </span>
              <span className="text-xs text-muted-foreground">etiquetados</span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-lg font-semibold tabular-nums text-destructive">
                {rechazados}
              </span>
              <span className="text-xs text-muted-foreground">rechazados</span>
            </div>
          </div>
        }
      />

      {offline && <BannerOffline />}

      <EtiquetadoControl registros={lotes} />
    </div>
  )
}
