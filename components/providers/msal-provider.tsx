'use client'

// Provider global de MSAL. La instancia de PublicClientApplication se crea una
// sola vez por pestaña, fuera del árbol de React, y se inicializa antes de
// montar la app: así el viaje de vuelta del redirect de Microsoft ya está
// resuelto cuando <AppShell /> decide si pide login.
//
// Si Entra no está configurado —o MSAL no arranca— la app no se bloquea: se
// renderiza igual y el contexto de auth queda deshabilitado, con lo que
// lib/data.ts cae al respaldo seed y las páginas pintan <BannerOffline />.

import {
  EventType,
  PublicClientApplication,
  type AuthenticationResult,
  type EventMessage,
} from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { useEffect, useState } from 'react'
import { PantallaCargando } from '@/components/auth/pantalla-cargando'
import { ProveedorAuthFabric, useAuthMsal } from '@/hooks/use-fabric-auth'
import { entraConfigurado, msalConfig } from '@/lib/auth-config'

let inicializacion: Promise<PublicClientApplication> | null = null

function inicializar(): Promise<PublicClientApplication> {
  if (!inicializacion) {
    const app = new PublicClientApplication(msalConfig)
    inicializacion = app.initialize().then(async () => {
      app.addEventCallback((evento: EventMessage) => {
        if (evento.eventType === EventType.LOGIN_SUCCESS && evento.payload) {
          const cuenta = (evento.payload as AuthenticationResult).account
          if (cuenta) app.setActiveAccount(cuenta)
        }
      })

      const resultado = await app.handleRedirectPromise()
      if (resultado?.account) app.setActiveAccount(resultado.account)

      // Sesión que ya venía en sessionStorage (recarga de la página).
      if (!app.getActiveAccount()) {
        const [primera] = app.getAllAccounts()
        if (primera) app.setActiveAccount(primera)
      }

      return app
    })
  }
  return inicializacion
}

export function ProveedorMsal({ children }: { children: React.ReactNode }) {
  const [app, setApp] = useState<PublicClientApplication | null>(null)
  const [fallo, setFallo] = useState(false)

  useEffect(() => {
    if (!entraConfigurado) return
    let vigente = true
    inicializar()
      .then((instancia) => {
        if (vigente) setApp(instancia)
      })
      .catch(() => {
        if (vigente) setFallo(true)
      })
    return () => {
      vigente = false
    }
  }, [])

  if (!entraConfigurado || fallo) return <>{children}</>
  if (!app) return <PantallaCargando mensaje="Conectando con Microsoft Entra ID…" />

  return (
    <MsalProvider instance={app}>
      <PuenteAuth>{children}</PuenteAuth>
    </MsalProvider>
  )
}

/** Publica el estado de MSAL en el contexto que consume `useFabricAuth()`. */
function PuenteAuth({ children }: { children: React.ReactNode }) {
  const auth = useAuthMsal()
  return <ProveedorAuthFabric value={auth}>{children}</ProveedorAuthFabric>
}
