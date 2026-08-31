'use client'

// Autenticación con Microsoft Entra ID para la GraphQL API de Fabric.
//
// El estado real vive en <ProveedorMsal> (components/providers/msal-provider.tsx),
// que publica en este contexto la implementación sobre @azure/msal-react. Toda
// la app consume `useFabricAuth()` y nunca los hooks de MSAL directamente: así
// las pantallas siguen funcionando —en modo demostración— cuando Entra no está
// configurado en el entorno y no existe <MsalProvider> en el árbol.

import {
  InteractionRequiredAuthError,
  InteractionStatus,
  type AuthenticationResult,
} from '@azure/msal-browser'
import { useIsAuthenticated, useMsal } from '@azure/msal-react'
import { createContext, useCallback, useContext, useMemo } from 'react'
import { loginRequest } from '@/lib/auth-config'
import { rolesDeClaim } from '@/lib/auth/roles'
import { SIN_TOKENS, type TokensCedis } from '@/lib/auth/tokens'

export interface CuentaFabric {
  nombre: string
  usuario: string
  /**
   * Claim `roles` del ID token: los App roles que Entra ID trae asignados.
   * Vacío cuando el usuario no tiene ninguno — ver lib/auth/roles.ts, que
   * en ese caso lo degrada al rol más restrictivo y no al de mayor privilegio.
   */
  roles: string[]
}

export interface AuthFabric {
  /** true cuando Entra ID está configurado en este entorno. */
  habilitado: boolean
  isAuthenticated: boolean
  account: CuentaFabric | null
  /** true mientras MSAL tiene una interacción en curso (login, redirect…). */
  cargando: boolean
  login: () => Promise<void>
  logout: () => Promise<void>
  /** Token de acceso para el header Authorization, o null si no hay sesión. */
  getAccessToken: () => Promise<string | null>
  /** Los dos tokens de una escritura, en una sola adquisición. */
  getTokens: () => Promise<TokensCedis>
}

/** Estado sin Entra: la app corre con los datos seed y el banner de offline. */
export const AUTH_DESHABILITADA: AuthFabric = {
  habilitado: false,
  isAuthenticated: false,
  account: null,
  cargando: false,
  login: async () => {},
  logout: async () => {},
  getAccessToken: async () => null,
  getTokens: async () => SIN_TOKENS,
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
  const { instance, accounts, inProgress } = useMsal()
  const isAuthenticated = useIsAuthenticated()

  const account = useMemo<CuentaFabric | null>(() => {
    const cuenta = instance.getActiveAccount() ?? accounts[0]
    if (!cuenta) return null
    return {
      nombre: cuenta.name ?? cuenta.username,
      usuario: cuenta.username,
      roles: rolesDeClaim(cuenta.idTokenClaims?.roles),
    }
    // `accounts` entra en las dependencias porque es lo reactivo: la cuenta
    // activa del instance no dispara render por sí sola.
  }, [instance, accounts])

  const login = useCallback(async () => {
    await instance.loginRedirect(loginRequest)
  }, [instance])

  const logout = useCallback(async () => {
    await instance.logoutRedirect()
  }, [instance])

  /**
   * Adquiere el resultado completo de MSAL, que trae los dos tokens: el access
   * token para Fabric y el ID token con el claim `roles`.
   */
  const adquirir = useCallback(async (): Promise<AuthenticationResult | null> => {
    const cuenta = instance.getActiveAccount() ?? instance.getAllAccounts()[0]
    if (!cuenta) {
      console.warn('[cedis] sin cuenta activa de MSAL: la carga usará datos seed')
      return null
    }
    try {
      return await instance.acquireTokenSilent({ ...loginRequest, account: cuenta })
    } catch (error) {
      // Refresh token vencido o consentimiento pendiente: hace falta la
      // interacción del usuario, y el popup no pierde el estado de la página.
      if (error instanceof InteractionRequiredAuthError) {
        try {
          return await instance.acquireTokenPopup(loginRequest)
        } catch (errorPopup) {
          console.error('[cedis] acquireTokenPopup falló —', errorPopup)
          return null
        }
      }
      console.error('[cedis] acquireTokenSilent falló —', error)
      return null
    }
  }, [instance])

  const getAccessToken = useCallback(async () => {
    const resultado = await adquirir()
    return resultado?.accessToken ?? null
  }, [adquirir])

  const getTokens = useCallback(async (): Promise<TokensCedis> => {
    const resultado = await adquirir()
    if (!resultado) return SIN_TOKENS
    return { identidad: resultado.idToken ?? null, fabric: resultado.accessToken }
  }, [adquirir])

  return useMemo(
    () => ({
      habilitado: true,
      isAuthenticated,
      account,
      cargando: inProgress !== InteractionStatus.None,
      login,
      logout,
      getAccessToken,
      getTokens,
    }),
    [isAuthenticated, account, inProgress, login, logout, getAccessToken, getTokens],
  )
}
