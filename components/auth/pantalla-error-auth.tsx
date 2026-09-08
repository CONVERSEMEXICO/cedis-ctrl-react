'use client'

// Lo que se ve cuando el arranque de MSAL o el viaje de vuelta del redirect de
// Microsoft fallan.
//
// Antes este caso caía a modo demostración en silencio: el usuario iniciaba
// sesión, Entra lo rebotaba con un error, y la app aparecía con datos seed sin
// una sola pista de qué pasó. El código `AADSTS…` que manda Entra es
// exactamente lo que hace falta para arreglar la configuración, así que se
// muestra tal cual en vez de esconderlo en la consola.

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PantallaErrorAuth({
  detalle,
  onReintentar,
  onContinuar,
}: {
  /** Mensaje de MSAL/Entra, con su código si lo trae. */
  detalle: string
  onReintentar: () => void
  /** Escape hatch: seguir a la app con los datos seed. */
  onContinuar: () => void
}) {
  return (
    <div className="flex h-dvh flex-col bg-background">
      <div className="hazard-stripe h-1 w-full shrink-0" aria-hidden />
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" aria-hidden />
            <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
              No se pudo iniciar sesión
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Microsoft Entra ID rechazó el inicio de sesión. El detalle de abajo es lo que hay que
            darle a quien administra el registro de aplicación.
          </p>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-background p-3 font-mono text-[11px] leading-snug text-foreground">
            {detalle}
          </pre>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={onReintentar}>
              Reintentar
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onContinuar}>
              Continuar sin conectar
            </Button>
          </div>
          <p className="font-mono text-[11px] leading-tight text-muted-foreground">
            "Continuar sin conectar" abre el panel con datos de ejemplo: no verás la operación real
            ni podrás guardar cambios.
          </p>
        </div>
      </main>
    </div>
  )
}
