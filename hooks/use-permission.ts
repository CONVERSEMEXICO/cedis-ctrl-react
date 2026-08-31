'use client'

// ¿Puede el usuario actual ejecutar esta acción?
//
// Es el único punto por el que la UI debe preguntar por permisos: así la
// decisión sale siempre de la misma matriz (lib/auth/permissions.ts) que usa el
// guard del servidor, y no se duplica la jerarquía en los componentes.
//
// Mientras MSAL resuelve la sesión devuelve false: es mejor que un botón
// aparezca un instante después que ofrecer una acción que el servidor va a
// rechazar con 403.

import { useCedisRole } from '@/hooks/use-cedis-role'
import { hasPermission, type Action } from '@/lib/auth/permissions'

export function usePermission(action: Action): boolean {
  const { role, isLoading } = useCedisRole()
  if (isLoading) return false
  return hasPermission(role, action)
}
