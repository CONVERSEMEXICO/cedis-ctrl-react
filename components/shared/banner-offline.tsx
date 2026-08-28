import { WifiOff } from 'lucide-react'

/**
 * Aviso de que la GraphQL API de Fabric no respondió y lo que se ve son los
 * datos seed. Deliberadamente discreto: la operación sigue leyéndose, pero
 * nada de lo que se guarde desde aquí va a llegar a la base.
 */
export function BannerOffline() {
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning"
    >
      <WifiOff className="size-3.5 shrink-0" aria-hidden />
      Modo offline — datos de demostración
    </div>
  )
}
