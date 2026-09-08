'use client'

// Provider global de MSAL. La instancia de PublicClientApplication se crea una
// sola vez por pestaña, fuera del árbol de React, y se inicializa antes de
// montar la app: así el viaje de vuelta del redirect de Microsoft ya está
// resuelto cuando <AppShell /> decide si pide login.
//
// Si Entra no está configurado la app no se bloquea: se renderiza igual y el
// contexto de auth queda deshabilitado, con lo que lib/data.ts cae al respaldo
// seed y las páginas pintan <BannerOffline />.
//
// Un fallo de MSAL es distinto y **no se trata en silencio**. Antes también
// caía a modo demostración, y el resultado era el peor de los dos mundos: el
// usuario iniciaba sesión, Entra lo rebotaba con un `AADSTS…`, y la app
// aparecía con datos de ejemplo sin decir nada —imposible de diagnosticar
// desde el piso—. Ahora el error se muestra en <PantallaErrorAuth />, con el
// mensaje de Entra tal cual, y seguir a los datos seed es una decisión
// explícita del usuario.

import {
  EventType,
  PublicClientApplication,
  AuthError,
  type AuthenticationResult,
  type EventMessage,
} from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { useEffect, useState } from 'react'
import { PantallaCargando } from '@/components/auth/pantalla-cargando'
import { PantallaErrorAuth } from '@/components/auth/pantalla-error-auth'
import { ProveedorAuthFabric, useAuthMsal } from '@/hooks/use-fabric-auth'
import { entraConfigurado, msalConfig } from '@/lib/auth-config'

let inicializacion: Promise<PublicClientApplication> | null = null

/**
 * Texto legible de un fallo de MSAL, con el código de Entra si viene.
 *
 * `errorMessage` de MSAL es donde vive el `AADSTS…`, que es el dato que de
 * verdad sirve: dice si falta consentimiento, si el redirect URI no está
 * registrado o si el usuario no está asignado a la aplicación.
 */
function detalleDeError(error: unknown): string {
  if (error instanceof AuthError) {
    const partes = [error.errorCode, error.errorMessage].filter(Boolean)
    return partes.length > 0 ? partes.join(': ') : error.message
  }
  if (error instanceof Error) return error.message
  return String(error)
}

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

      diagnosticarSesion(app)

      return app
    })

    // Una promesa rechazada queda cacheada para siempre: sin esto, un fallo
    // pasajero deja la pestaña sin forma de volver a intentarlo salvo recargar.
    inicializacion = inicializacion.catch((error: unknown) => {
      inicializacion = null
      throw error
    })
  }
  return inicializacion
}

/**
 * Deja en la consola qué trae el ID token sobre la identidad y los app roles.
 *
 * Es el punto ciego típico al montar los roles: el usuario está asignado en el
 * portal pero el claim `roles` no llega —asignación a un grupo que la app no
 * emite, rol asignado al service principal equivocado, token pedido antes de la
 * asignación—, y desde la UI eso se ve igual que "no tengo permisos".
 */
function diagnosticarSesion(app: PublicClientApplication): void {
  const cuenta = app.getActiveAccount()
  if (!cuenta) {
    console.info('[cedis] MSAL listo, sin sesión activa')
    return
  }
  const claims = cuenta.idTokenClaims as Record<string, unknown> | undefined
  console.info('[cedis] sesión de Entra ID', {
    usuario: cuenta.username,
    tenant: cuenta.tenantId,
    audiencia: claims?.aud,
    roles: claims?.roles ?? '(el ID token no trae el claim `roles`)',
  })
}

export function ProveedorMsal({ children }: { children: React.ReactNode }) {
  const [app, setApp] = useState<PublicClientApplication | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** El usuario decidió seguir con los datos seed pese al fallo. */
  const [ignorado, setIgnorado] = useState(false)
  /** Cambia con "Reintentar" para volver a correr el efecto. */
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    if (!entraConfigurado) return
    let vigente = true
    setError(null)
    inicializar()
      .then((instancia) => {
        if (vigente) setApp(instancia)
      })
      .catch((fallo: unknown) => {
        console.error('[cedis] MSAL no pudo arrancar —', fallo)
        if (vigente) setError(detalleDeError(fallo))
      })
    return () => {
      vigente = false
    }
  }, [intento])

  if (!entraConfigurado || ignorado) return <>{children}</>
  if (error !== null) {
    return (
      <PantallaErrorAuth
        detalle={error}
        onReintentar={() => setIntento((n) => n + 1)}
        onContinuar={() => setIgnorado(true)}
      />
    )
  }
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
