import { obtenerDatosCedis } from '@/lib/data'
import { SidebarNav } from '@/components/layout/sidebar-nav'
import { Topbar } from '@/components/layout/topbar'

export async function AppShell({ children }: { children: React.ReactNode }) {
  const data = await obtenerDatosCedis()

  const counts = {
    embarques: data.embarques.length,
    recepciones: data.recepciones.length,
    surtido: data.pedidosSurtido.length,
    etiquetado: data.lotesEtiquetado.length,
    productividad: data.productividad.length,
    incidencias: data.incidencias.filter(
      (i) => i.estado === 'abierta' || i.estado === 'atencion',
    ).length,
  }

  return (
    <div className="flex h-dvh flex-col">
      <div className="hazard-stripe h-1 w-full shrink-0" aria-hidden />
      <div className="flex min-h-0 flex-1">
        <SidebarNav counts={counts} />
        <div className="flex min-h-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-y-auto bg-background">{children}</main>
        </div>
      </div>
    </div>
  )
}
