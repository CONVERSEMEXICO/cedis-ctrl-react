'use client'

import { EmbarquesControl } from '@/components/modulos/configs'
import { useDatosCedis } from '@/components/providers/cedis-data-provider'
import { BannerOffline } from '@/components/shared/banner-offline'
import { PageHeader } from '@/components/shared/page-header'
import { formatNumero } from '@/lib/format'
import { metricasEmbarques } from '@/lib/metrics'

export default function EmbarquesPage() {
  const { datos, offline } = useDatosCedis()
  const embarques = datos.embarques
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

      {offline.embarques && <BannerOffline />}

      <EmbarquesControl registros={embarques} />
    </div>
  )
}
