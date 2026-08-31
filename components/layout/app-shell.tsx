'use client'

// Shell del panel. Dos decisiones viven aquí:
//   1. Con Entra ID configurado, sin sesión no se pinta nada de la operación:
//      va la <PantallaLogin />.
//   2. Los conteos del sidebar salen de los datos que ya cargó
//      <ProveedorDatosCedis>, no de un fetch propio.
//
// El <BannerDemo /> va entre el topbar y el contenido —no dentro de <main>—
// para que quede fijo mientras el contenido hace scroll, y se pinta solo cuando
// no hay cuenta activa de Entra ID.

import { Loader2 } from 'lucide-react'
import { SidebarNav } from '@/components/layout/sidebar-nav'
import { Topbar } from '@/components/layout/topbar'
import { BannerDemo } from '@/components/auth/banner-demo'
import { PantallaLogin } from '@/components/auth/pantalla-login'
import { useDatosCedis } from '@/components/providers/cedis-data-provider'
import { useFabricAuth } from '@/hooks/use-fabric-auth'
import { incidenciasAbiertas } from '@/lib/metrics'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { habilitado, isAuthenticated } = useFabricAuth()
  const { datos, listo } = useDatosCedis()

  if (habilitado && !isAuthenticated) return <PantallaLogin />

  const counts = {
    embarques: datos.embarques.length,
    recepciones: datos.recepciones.length,
    surtido: datos.pedidosSurtido.length,
    etiquetado: datos.lotesEtiquetado.length,
    productividad: datos.productividad.length,
    incidencias: incidenciasAbiertas(datos.incidencias).length,
  }

  return (
    <div className="flex h-dvh flex-col">
      <div className="hazard-stripe h-1 w-full shrink-0" aria-hidden />
      <div className="flex min-h-0 flex-1">
        <SidebarNav counts={listo ? counts : null} />
        <div className="flex min-h-0 flex-1 flex-col">
          <Topbar />
          <BannerDemo />
          <main className="flex-1 overflow-y-auto bg-background">
            {listo ? (
              children
            ) : (
              <p
                role="status"
                className="flex h-full items-center justify-center gap-2 font-mono text-xs text-muted-foreground"
              >
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Cargando la operación…
              </p>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
