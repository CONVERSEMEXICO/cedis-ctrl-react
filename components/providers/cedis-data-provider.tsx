'use client'

// Origen único de los datos del panel en el navegador.
//
// Antes cada página hacía su fetch en el server con el token de la app. Con
// Entra ID el token es del usuario y solo existe en el navegador, así que la
// carga se hace aquí una vez y las páginas la consumen con `useDatosCedis()`.
// `refrescar()` sustituye al `revalidatePath` que hacían las server actions.
//
// Dos cosas que existen para no volver a chocar con el límite de tasa de
// Fabric (429):
//
//   - **Deduplicación**: si ya hay una carga en vuelo, `refrescar()` se cuelga
//     de esa promesa en vez de abrir otra. Sin esto, varias escrituras que
//     terminan juntas —o el botón "Actualizar" apretado dos veces— disparan
//     cargas simultáneas que piden exactamente lo mismo.
//   - **Ventana de bloqueo**: cuando Fabric responde 429 se recuerda hasta
//     cuándo, para poder deshabilitar el botón en vez de dejar al usuario
//     reintentando contra una puerta cerrada. El corte real vive en
//     lib/graphql.ts, que ni siquiera toca la red dentro de esa ventana.

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
import { esperaRestanteMs, MENSAJE_SESION_EXPIRADA, mensajeLimiteExcedido } from '@/lib/graphql'

export interface EstadoDatosCedis {
  datos: DatosCedis
  offline: OfflinePorConjunto
  /** false hasta que termina la primera carga: el shell pinta el esqueleto. */
  listo: boolean
  cargando: boolean
  /** true mientras dura la ventana de bloqueo por 429 de Fabric. */
  limitado: boolean
  refrescar: () => Promise<void>
}

const ESTADO_INICIAL: EstadoDatosCedis = {
  datos: DATOS_VACIOS,
  offline: OFFLINE_INICIAL,
  listo: false,
  cargando: true,
  limitado: false,
  refrescar: async () => {},
}

const ContextoDatosCedis = createContext<EstadoDatosCedis>(ESTADO_INICIAL)

export function useDatosCedis(): EstadoDatosCedis {
  return useContext(ContextoDatosCedis)
}

export function ProveedorDatosCedis({ children }: { children: React.ReactNode }) {
  const { getAccessToken, logout, isAuthenticated, habilitado } = useFabricAuth()
  const [datos, setDatos] = useState<DatosCedis>(DATOS_VACIOS)
  const [offline, setOffline] = useState<OfflinePorConjunto>(OFFLINE_INICIAL)
  const [listo, setListo] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [limitado, setLimitado] = useState(false)
  /** Carga en vuelo, para que varias llamadas compartan una sola petición. */
  const enVuelo = useRef<Promise<void> | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    const token = await getAccessToken()
    const resultado = await cargarDatosCedis(token)

    setDatos(resultado.datos)
    setOffline(resultado.offline)
    setListo(true)
    setCargando(false)

    if (resultado.limiteExcedido) {
      setLimitado(true)
      toast.error(mensajeLimiteExcedido())
      return
    }
    setLimitado(false)

    if (resultado.sesionExpirada) {
      toast.error(MENSAJE_SESION_EXPIRADA)
      await logout()
    }
  }, [getAccessToken, logout])

  const refrescar = useCallback(async () => {
    if (enVuelo.current) return enVuelo.current
    const promesa = cargar().finally(() => {
      enVuelo.current = null
    })
    enVuelo.current = promesa
    return promesa
  }, [cargar])

  // Con Entra configurado y sin sesión no se pide nada: no hay token, la carga
  // fallaría entera y <AppShell> está pintando la pantalla de login. El efecto
  // vuelve a correr al autenticarse, que es cuando la carga sí tiene sentido.
  useEffect(() => {
    if (habilitado && !isAuthenticated) {
      setListo(true)
      setCargando(false)
      return
    }
    void refrescar()
  }, [refrescar, isAuthenticated, habilitado])

  // Al vencer la ventana de bloqueo se rehabilita el botón "Actualizar" solo,
  // sin obligar al usuario a recargar la página para descubrir que ya puede.
  useEffect(() => {
    if (!limitado) return
    const restante = esperaRestanteMs()
    if (restante <= 0) {
      setLimitado(false)
      return
    }
    const id = setTimeout(() => setLimitado(false), restante + 500)
    return () => clearTimeout(id)
  }, [limitado])

  const valor = useMemo<EstadoDatosCedis>(
    () => ({ datos, offline, listo, cargando, limitado, refrescar }),
    [datos, offline, listo, cargando, limitado, refrescar],
  )

  return <ContextoDatosCedis.Provider value={valor}>{children}</ContextoDatosCedis.Provider>
}
