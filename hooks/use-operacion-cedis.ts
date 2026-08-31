'use client'

// Envoltura de toda escritura del panel: verifica el permiso, consigue los
// tokens de Entra ID, corre la operación de lib/actions.ts, avisa por toast y
// refresca los datos.
//
// La acción requerida es un argumento obligatorio, no opcional, a propósito:
// toda escritura pasa por aquí, así que exigirla hace estructuralmente
// imposible agregar una mutación sin declarar quién puede ejecutarla. El check
// del cliente es solo para no mandar una petición condenada al 403 —y para que
// el toast salga igual cuando alguien llama el handler a mano desde la
// consola—; el que de verdad autoriza es el Route Handler.
//
// La sesión vencida se trata aparte del resto de los errores: no tiene sentido
// pedir "verifica tu conexión" cuando lo que hace falta es volver a entrar.

import { useCallback } from 'react'
import { toast } from 'sonner'
import { ERROR_GUARDAR } from '@/components/modulos/tipos'
import { useDatosCedis } from '@/components/providers/cedis-data-provider'
import { useCedisRole } from '@/hooks/use-cedis-role'
import { useFabricAuth } from '@/hooks/use-fabric-auth'
import { SIN_CONEXION_FABRIC } from '@/lib/actions'
import { hasPermission, MENSAJE_SIN_PERMISO, type Action } from '@/lib/auth/permissions'
import type { TokensCedis } from '@/lib/auth/tokens'
import { MENSAJE_SESION_EXPIRADA } from '@/lib/graphql'
import type { ResultadoAccion } from '@/types/cedis'

export type OperacionCedis = (tokens: TokensCedis) => Promise<ResultadoAccion>

export function useOperacionCedis() {
  const { getTokens, logout } = useFabricAuth()
  const { role, isDemoMode } = useCedisRole()
  const { refrescar } = useDatosCedis()

  const ejecutar = useCallback(
    async (accion: Action, operacion: OperacionCedis, exito: string): Promise<boolean> => {
      if (!hasPermission(role, accion)) {
        toast.error(MENSAJE_SIN_PERMISO)
        return false
      }

      const tokens = await getTokens()

      // Sin token de Fabric no hay escritura posible, y la razón cambia el
      // mensaje: en modo demostración es lo esperado —la app corre con los
      // datos seed— y decir "tu sesión expiró" sería falso; con Entra
      // conectado sí es la sesión, y hay que volver a entrar.
      if (!tokens.fabric) {
        if (isDemoMode) {
          toast.error(SIN_CONEXION_FABRIC, {
            description: 'Estás en modo demostración: los datos son de ejemplo.',
          })
          return false
        }
        toast.error(MENSAJE_SESION_EXPIRADA)
        await logout()
        return false
      }

      const resultado = await operacion(tokens)

      if (!resultado.ok) {
        if (resultado.sesionExpirada) {
          toast.error(MENSAJE_SESION_EXPIRADA)
          await logout()
          return false
        }
        // El 403 del servidor ya trae su propio mensaje: se muestra tal cual,
        // sin envolverlo en "no se pudo guardar", que sugeriría un fallo de red.
        if (resultado.error === MENSAJE_SIN_PERMISO) {
          toast.error(MENSAJE_SIN_PERMISO)
          return false
        }
        toast.error(ERROR_GUARDAR, { description: resultado.error })
        return false
      }

      toast.success(exito)
      await refrescar()
      return true
    },
    [getTokens, isDemoMode, logout, refrescar, role],
  )

  return { ejecutar }
}
