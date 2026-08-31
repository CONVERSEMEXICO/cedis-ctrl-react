'use client'

// Aviso de modo demostración: no hay cuenta activa de Entra ID, así que
// `useCedisRole()` está entregando permisos completos y lo que se ve son los
// datos seed.
//
// Es fijo y sutil a propósito —ni modal ni bloqueante—: el punto de este modo
// es poder recorrer la app entera antes de tener Entra conectado, y un diálogo
// que hay que cerrar en cada carga estorbaría más de lo que avisa.

import { Info } from 'lucide-react'
import { useCedisRole } from '@/hooks/use-cedis-role'

export function BannerDemo() {
  const { isDemoMode } = useCedisRole()

  if (!isDemoMode) return null

  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-300 md:px-6"
    >
      <Info className="size-3.5 shrink-0" aria-hidden />
      <p>
        <span className="font-medium">Modo demostración</span> — permisos completos habilitados.
        Conecta Entra ID para aplicar roles reales.
      </p>
    </div>
  )
}
