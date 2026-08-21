'use client'

// Envoltura de toda escritura del panel: consigue el token de Entra ID, corre
// la operación de lib/actions.ts, avisa por toast y refresca los datos.
//
// La sesión vencida se trata aparte del resto de los errores: no tiene sentido
// pedir "verifica tu conexión" cuando lo que hace falta es volver a entrar.

import { useCallback } from 'react'
import { toast } from 'sonner'
import { ERROR_GUARDAR } from '@/components/modulos/tipos'
import { useDatosCedis } from '@/components/providers/cedis-data-provider'
import { useFabricAuth } from '@/hooks/use-fabric-auth'
import { MENSAJE_SESION_EXPIRADA } from '@/lib/graphql'
import type { ResultadoAccion } from '@/types/cedis'

export type OperacionCedis = (token: string | null) => Promise<ResultadoAccion>

export function useOperacionCedis() {
  const { getAccessToken, logout } = useFabricAuth()
  const { refrescar } = useDatosCedis()

  const ejecutar = useCallback(
    async (operacion: OperacionCedis, exito: string): Promise<boolean> => {
      const token = await getAccessToken()
      const resultado = await operacion(token)

      if (!resultado.ok) {
        if (resultado.sesionExpirada) {
          toast.error(MENSAJE_SESION_EXPIRADA)
          await logout()
          return false
        }
        toast.error(ERROR_GUARDAR, { description: resultado.error })
        return false
      }

      toast.success(exito)
      await refrescar()
      return true
    },
    [getAccessToken, logout, refrescar],
  )

  return { ejecutar }
}
