'use client'

import { SurtidoControl } from '@/components/modulos/configs'
import { useDatosCedis } from '@/components/providers/cedis-data-provider'
import { BannerOffline } from '@/components/shared/banner-offline'
import { PageHeader } from '@/components/shared/page-header'
import { formatNumero } from '@/lib/format'
import { metricasSurtido } from '@/lib/metrics'

export default function SurtidoPage() {
  const { datos, offline } = useDatosCedis()
  const pedidos = datos.pedidosSurtido
  const { enProceso, totalLineas } = metricasSurtido(pedidos)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Surtido"
        description="Preparación de pedidos por zona de picking"
        accentClassName="bg-surtido"
        actions={
          <div className="flex items-center gap-4 text-right">
            <div className="flex flex-col">
              <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
                {formatNumero(totalLineas)}
              </span>
              <span className="text-xs text-muted-foreground">líneas totales</span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-lg font-semibold tabular-nums text-surtido">
                {enProceso}
              </span>
              <span className="text-xs text-muted-foreground">en proceso</span>
            </div>
          </div>
        }
      />

      {offline.pedidosSurtido && <BannerOffline />}

      <SurtidoControl registros={pedidos} />
    </div>
  )
}
