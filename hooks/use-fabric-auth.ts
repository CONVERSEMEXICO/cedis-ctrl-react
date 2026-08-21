'use client'

// Autenticación con Microsoft Entra ID para la GraphQL API de Fabric.
//
// El estado real vive en <ProveedorMsal> (components/providers/msal-provider.tsx),
// que publica en este contexto la implementación sobre @azure/msal-react. Toda
// la app consume `useFabricAuth()` y nunca los hooks de MSAL directamente: así
// las pantallas siguen funcionando —en modo demostración— cuando Entra no está
// configurado en el entorno y no existe <MsalProvider> en el árbol.

import { InteractionRequiredAuthError } from '@azure/msal-browser'
import { useIsAuthenticated, useMsal } from '@azure/msal-react'
import { createContext, useCallback, useContext, useMemo } from 'react'
import { loginRequest } from '@/lib/auth-config'

export interface CuentaFabric {
  nombre: string
  usuario: string
}

export interface AuthFabric {
  /** true cuando Entra ID está configurado en este entorno. */
  habilitado: boolean
  isAuthenticated: boolean
  account: CuentaFabric | null
  login: () => Promise<void>
  logout: () => Promise<void>
  /** Token de acceso para el header Authorization, o null si no hay sesión. */
  getAccessToken: () => Promise<string | null>
}

/** Estado sin Entra: la app corre con los datos seed y el banner de offline. */
export const AUTH_DESHABILITADA: AuthFabric = {
  habilitado: false,
  isAuthenticated: false,
  account: null,
  login: async () => {},
  logout: async () => {},
  getAccessToken: async () => null,
}

const ContextoAuthFabric = createContext<AuthFabric>(AUTH_DESHABILITADA)

export const ProveedorAuthFabric = ContextoAuthFabric.Provider

export function useFabricAuth(): AuthFabric {
  return useContext(ContextoAuthFabric)
}

/**
 * Implementación real sobre MSAL. Solo puede usarse dentro de <MsalProvider>,
 * por eso la consume el provider y el resto de la app lee el contexto.
 */
export function useAuthMsal(): AuthFabric {
  const { instance, accounts } = useMsal()
  const isAuthenticated = useIsAuthenticated()

  const account = useMemo<CuentaFabric | null>(() => {
    const cuenta = instance.getActiveAccount() ?? accounts[0]
    if (!cuenta) return null
    return { nombre: cuenta.name ?? cuenta.username, usuario: cuenta.username }
    // `accounts` entra en las dependencias porque es lo reactivo: la cuenta
    // activa del instance no dispara render por sí sola.
  }, [instance, accounts])

  const login = useCallback(async () => {
    await instance.loginRedirect(loginRequest)
  }, [instance])

  const logout = useCallback(async () => {
    await instance.logoutRedirect()
  }, [instance])

  const getAccessToken = useCallback(async () => {
    const cuenta = instance.getActiveAccount() ?? instance.getAllAccounts()[0]
    if (!cuenta) return null
    try {
      const resultado = await instance.acquireTokenSilent({ ...loginRequest, account: cuenta })
      return resultado.accessToken
    } catch (error) {
      // Refresh token vencido o consentimiento pendiente: hace falta la
      // interacción del usuario, y el popup no pierde el estado de la página.
      if (error instanceof InteractionRequiredAuthError) {
        try {
          const resultado = await instance.acquireTokenPopup(loginRequest)
          return resultado.accessToken
        } catch {
          return null
        }
      }
      return null
    }
  }, [instance])

  return useMemo(
    () => ({ habilitado: true, isAuthenticated, account, login, logout, getAccessToken }),
    [isAuthenticated, account, login, logout, getAccessToken],
  )
}
