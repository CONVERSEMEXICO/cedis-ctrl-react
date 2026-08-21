import { Loader2 } from 'lucide-react'

/** Pantalla de espera con la misma estética que <PantallaLogin />. */
export function PantallaCargando({ mensaje }: { mensaje: string }) {
  return (
    <div className="flex h-dvh flex-col bg-background">
      <div className="hazard-stripe h-1 w-full shrink-0" aria-hidden />
      <div className="flex flex-1 items-center justify-center p-6">
        <p
          role="status"
          className="flex items-center gap-2 font-mono text-xs text-muted-foreground"
        >
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          {mensaje}
        </p>
      </div>
    </div>
  )
}
