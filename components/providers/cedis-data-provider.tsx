'use client'

// Origen único de los datos del panel en el navegador.
//
// Antes cada página hacía su fetch en el server con el token de la app. Con
// Entra ID el token es del usuario y solo existe en el navegador, así que la
// carga se hace aquí una vez —los seis conjuntos en paralelo— y las páginas la
// consumen con `useDatosCedis()`. `refrescar()` sustituye al `revalidatePath`
// que hacían las server actions.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useFabricAuth } from '@/hooks/use-fabric-auth'
import {
  cargarDatosCedis,
  DATOS_VACIOS,
  OFFLINE_INICIAL,
  type DatosCedis,
  type OfflinePorConjunto,
} from '@/lib/data'
import { MENSAJE_SESION_EXPIRADA } from '@/lib/graphql'

export interface EstadoDatosCedis {
  datos: DatosCedis
  offline: OfflinePorConjunto
  /** false hasta que termina la primera carga: el shell pinta el esqueleto. */
  listo: boolean
  cargando: boolean
  refrescar: () => Promise<void>
}

const ESTADO_INICIAL: EstadoDatosCedis = {
  datos: DATOS_VACIOS,
  offline: OFFLINE_INICIAL,
  listo: false,
  cargando: true,
  refrescar: async () => {},
}

const ContextoDatosCedis = createContext<EstadoDatosCedis>(ESTADO_INICIAL)

export function useDatosCedis(): EstadoDatosCedis {
  return useContext(ContextoDatosCedis)
}

export function ProveedorDatosCedis({ children }: { children: React.ReactNode }) {
  const { getAccessToken, logout, isAuthenticated } = useFabricAuth()
  const [datos, setDatos] = useState<DatosCedis>(DATOS_VACIOS)
  const [offline, setOffline] = useState<OfflinePorConjunto>(OFFLINE_INICIAL)
  const [listo, setListo] = useState(false)
  const [cargando, setCargando] = useState(true)
  /** Descarta respuestas de cargas que ya quedaron atrás. */
  const peticion = useRef(0)

  const refrescar = useCallback(async () => {
    const id = ++peticion.current
    setCargando(true)
    const token = await getAccessToken()
    const resultado = await cargarDatosCedis(token)
    if (id !== peticion.current) return

    setDatos(resultado.datos)
    setOffline(resultado.offline)
    setListo(true)
    setCargando(false)

    if (resultado.sesionExpirada) {
      toast.error(MENSAJE_SESION_EXPIRADA)
      await logout()
    }
  }, [getAccessToken, logout])

  // `isAuthenticated` vuelve a disparar la carga al volver del login.
  useEffect(() => {
    void refrescar()
  }, [refrescar, isAuthenticated])

  const valor = useMemo<EstadoDatosCedis>(
    () => ({ datos, offline, listo, cargando, refrescar }),
    [datos, offline, listo, cargando, refrescar],
  )

  return <ContextoDatosCedis.Provider value={valor}>{children}</ContextoDatosCedis.Provider>
}
