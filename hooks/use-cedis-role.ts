'use client'

// Rol efectivo del usuario en el navegador.
//
// Lee la cuenta activa de MSAL a través de `useFabricAuth()` y no de los hooks
// de @azure/msal-react: ese es el contrato de la app (ver CLAUDE.md) y es lo
// que permite que el árbol siga funcionando cuando no hay <MsalProvider>
// porque Entra no está configurado. `useAuthMsal()` es el que saca el claim
// `roles` del ID token y lo publica en `account.roles`.
//
// Dos fallbacks que NO son el mismo:
//   - Sin cuenta activa → modo demostración con permisos completos, para poder
//     recorrer la UI con los datos seed antes de conectar Entra.
//   - Con sesión real y sin ningún app role asignado → `CEDIS.Operador`, el rol
//     más restrictivo. Nunca Administrador: si hay sesión, el directorio es la
//     autoridad y "sin rol" significa sin privilegios, no todos.

import { useMemo } from 'react'
import { useFabricAuth } from '@/hooks/use-fabric-auth'
import { getHighestRole, ROL_DEMO, ROL_MINIMO, type Role } from '@/lib/auth/roles'
import type { CedisUser } from '@/types/cedis'

export interface EstadoRolCedis {
  role: Role | null
  /** true mientras MSAL resuelve la sesión: no decidas permisos todavía. */
  isLoading: boolean
  /** true cuando no hay cuenta activa y el rol es el del modo demostración. */
  isDemoMode: boolean
  /** Identidad y rol del usuario; null en modo demostración. */
  usuario: CedisUser | null
}

export function useCedisRole(): EstadoRolCedis {
  const { isAuthenticated, account, cargando } = useFabricAuth()

  return useMemo<EstadoRolCedis>(() => {
    if (cargando) {
      return { role: null, isLoading: true, isDemoMode: false, usuario: null }
    }

    if (!isAuthenticated || !account) {
      return { role: ROL_DEMO, isLoading: false, isDemoMode: true, usuario: null }
    }

    const role = getHighestRole(account.roles) ?? ROL_MINIMO
    return {
      role,
      isLoading: false,
      isDemoMode: false,
      usuario: { name: account.nombre, email: account.usuario, role },
    }
  }, [isAuthenticated, account, cargando])
}
