'use client'

// Puerta de entrada cuando Entra ID sí está configurado: sin sesión no se
// pinta el panel. El login lo resuelve por completo el redirect de Microsoft
// (MSAL); aquí no hay formulario de usuario y contraseña.

import { LogIn } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useFabricAuth } from '@/hooks/use-fabric-auth'

export function PantallaLogin() {
  const { login } = useFabricAuth()
  const [entrando, setEntrando] = useState(false)

  async function alEntrar() {
    setEntrando(true)
    try {
      await login()
    } finally {
      // El redirect saca la página; si falla, el botón vuelve a habilitarse.
      setEntrando(false)
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <div className="hazard-stripe h-1 w-full shrink-0" aria-hidden />
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="flex w-full max-w-sm flex-col gap-6 rounded-lg border border-border bg-card p-6">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-lg font-semibold tracking-tight text-foreground">
              CEDIS <span className="text-primary">·CTRL</span>
            </span>
            <p className="text-sm text-muted-foreground">
              Inicia sesión con tu cuenta de Microsoft para continuar
            </p>
          </div>
          <Button type="button" onClick={alEntrar} disabled={entrando} className="w-full">
            <LogIn data-icon="inline-start" />
            {entrando ? 'Abriendo Microsoft…' : 'Iniciar sesión con Microsoft'}
          </Button>
          <p className="font-mono text-[11px] leading-tight text-muted-foreground">
            Centro de distribución · Operación en vivo
          </p>
        </div>
      </main>
    </div>
  )
}
