'use client'

import { RecepcionesControl } from '@/components/modulos/configs'
import { useDatosCedis } from '@/components/providers/cedis-data-provider'
import { BannerOffline } from '@/components/shared/banner-offline'
import { PageHeader } from '@/components/shared/page-header'
import { metricasRecepciones } from '@/lib/metrics'

export default function RecepcionesPage() {
  const { datos, offline } = useDatosCedis()
  const recepciones = datos.recepciones
  const { recibidas, conDiscrepancia } = metricasRecepciones(recepciones)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Recepciones"
        description="Ingreso de mercancía de proveedores al centro de distribución"
        accentClassName="bg-recepciones"
        actions={
          <div className="flex items-center gap-4 text-right">
            <div className="flex flex-col">
              <span className="font-mono text-lg font-semibold tabular-nums text-success">
                {recibidas}
              </span>
              <span className="text-xs text-muted-foreground">recibidas</span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-lg font-semibold tabular-nums text-destructive">
                {conDiscrepancia}
              </span>
              <span className="text-xs text-muted-foreground">con discrepancia</span>
            </div>
          </div>
        }
      />

      {offline.recepciones && <BannerOffline />}

      <RecepcionesControl registros={recepciones} />
    </div>
  )
}
