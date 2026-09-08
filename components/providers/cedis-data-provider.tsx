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
import {
  DETALLE_AUTORIZACION_FALLIDA,
  intentarReautenticar,
  limpiarReautenticacion,
  MENSAJE_AUTORIZACION_FALLIDA,
} from '@/lib/auth/reautenticacion'
import {
  DETALLE_SIN_ACCESO_FABRIC,
  esperaRestanteMs,
  explicarFallo,
  MENSAJE_SESION_EXPIRADA,
  MENSAJE_SIN_ACCESO_FABRIC,
  mensajeLimiteExcedido,
} from '@/lib/graphql'

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

/** Sesión de Entra viva, pero MSAL no pudo entregar el token de Fabric. */
const MENSAJE_TOKEN_FABRIC = 'No se pudo obtener el token de Microsoft Fabric'
const DETALLE_TOKEN_FABRIC =
  'Revisa que el navegador no esté bloqueando la ventana emergente de Microsoft, y que tu cuenta haya aceptado los permisos de la aplicación.'

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

    // Sesión de Entra viva pero sin token de Fabric: `acquireTokenSilent` falló
    // y el popup de respaldo no prosperó —bloqueado por el navegador, cerrado,
    // o un consentimiento que sigue pendiente para esta cuenta—. Antes esto
    // solo dejaba un console.warn y la app se veía idéntica a un entorno sin
    // Entra configurado.
    if (token === null && isAuthenticated) {
      toast.error(MENSAJE_TOKEN_FABRIC, { description: DETALLE_TOKEN_FABRIC })
    }

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

    // El 401 no siempre es una sesión vencida: también lo devuelve Fabric
    // cuando la cuenta no tiene acceso. Cerrar sesión ahí manda al usuario a
    // Microsoft, que con SSO lo devuelve autenticado, y el 401 se repite —el
    // ciclo de redireccionamiento—. Por eso el reintento es uno solo por
    // pestaña; ver lib/auth/reautenticacion.ts.
    if (resultado.sesionExpirada) {
      if (await intentarReautenticar(logout)) {
        toast.error(MENSAJE_SESION_EXPIRADA)
        return
      }
      toast.error(MENSAJE_AUTORIZACION_FALLIDA, { description: DETALLE_AUTORIZACION_FALLIDA })
      return
    }

    // 403: el token es bueno y la cuenta entró a la app, pero Fabric no la deja
    // ver el elemento. Volver a iniciar sesión no lo arregla —los app roles de
    // Entra no conceden permisos dentro de Fabric—, así que se dice qué hacer.
    if (resultado.sinAcceso) {
      toast.error(MENSAJE_SIN_ACCESO_FABRIC, { description: DETALLE_SIN_ACCESO_FABRIC })
    } else if (resultado.motivo !== null && token !== null) {
      // La carga cayó al seed con un token en mano: hay una causa real y el
      // banner de offline por sí solo no la dice. `explicarFallo` traduce el
      // caso frecuente —la base SQL rechazando la identidad— a algo accionable.
      const { mensaje, detalle } = explicarFallo(resultado.motivo)
      toast.error(mensaje, { description: detalle })
    }

    // Carga sin 401: la autorización funciona, así que una sesión que venza más
    // tarde en esta misma pestaña vuelve a tener su intento de re-entrada.
    limpiarReautenticacion()
  }, [getAccessToken, isAuthenticated, logout])

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
