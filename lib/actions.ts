// Operaciones de escritura de los módulos operativos.
//
// Ya no hablan con Fabric: hablan con los Route Handlers de
// app/api/cedis/[operacion]/route.ts, que son los que verifican el permiso del
// rol antes de tocar la GraphQL API. Ocultar un botón en la UI no es seguridad
// —el cliente se puede inspeccionar y la función handler se puede llamar a
// mano—, así que la mutación tiene que pasar por un punto donde el rol se
// valide contra un token firmado por Entra ID.
//
// Cada operación recibe los dos tokens (lib/auth/tokens.ts): el ID token, que
// es el que trae el claim `roles` y el servidor verifica, y el token de Fabric,
// que el servidor solo reenvía. Los consigue `useOperacionCedis` con
// `getTokens()`.
//
// El contrato de salida no cambia: `ResultadoAccion` en vez de lanzar, para que
// la vista muestre el toast sin romper el render. Se agrega un caso nuevo, el
// 403, que llega con el mensaje de "sin permisos".

import { MENSAJE_SIN_PERMISO } from '@/lib/auth/permissions'
import type { TokensCedis } from '@/lib/auth/tokens'
import { MENSAJE_SESION_EXPIRADA } from '@/lib/graphql'
import type {
  CrearEmbarqueInput,
  CrearEtiquetadoInput,
  CrearRecepcionInput,
  CrearSurtidoInput,
  RegistrarProductividadInput,
} from '@/lib/queries'
import type {
  EstadoEmbarque,
  EstadoEtiquetado,
  EstadoRecepcion,
  EstadoSurtido,
  ResultadoAccion,
} from '@/types/cedis'

/** Mensaje de fallo de red al llamar al propio servidor. */
const ERROR_RED = 'No se pudo contactar al servidor. Verifica tu conexión.'

/** Sin token de Fabric no hay escritura posible: la app está en solo lectura. */
export const SIN_CONEXION_FABRIC =
  'Sin conexión con Microsoft Fabric: el cambio no se guardó.'

interface RespuestaApi {
  ok?: true
  error?: string
  mensaje?: string
}

/**
 * Llama al Route Handler de una operación.
 *
 * @param operacion - Clave del registro de OPERACIONES del Route Handler.
 * @param tokens - ID token (identidad) y access token de Fabric.
 * @param cuerpo - Argumentos de la operación, ya serializables.
 */
async function invocar(
  operacion: string,
  tokens: TokensCedis,
  cuerpo: Record<string, unknown>,
): Promise<ResultadoAccion> {
  if (!tokens.fabric) {
    // Sin token de Fabric no hay nada que escribir. No se marca como sesión
    // vencida: quien sabe distinguir entre "modo demostración" y "el token se
    // cayó" es `useOperacionCedis`, que ya lo resuelve antes de llegar aquí.
    // Esto es el respaldo para un llamador directo.
    return { ok: false, error: SIN_CONEXION_FABRIC, sesionExpirada: false }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Fabric-Token': tokens.fabric,
  }
  if (tokens.identidad) headers.Authorization = `Bearer ${tokens.identidad}`

  let respuesta: Response
  try {
    respuesta = await fetch(`/api/cedis/${operacion}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(cuerpo),
      cache: 'no-store',
    })
  } catch (error) {
    console.error(`[cedis] ${operacion}: no se pudo llamar al servidor —`, error)
    return { ok: false, error: ERROR_RED, sesionExpirada: false }
  }

  if (respuesta.ok) return { ok: true }

  const datos = (await respuesta.json().catch(() => ({}))) as RespuestaApi

  if (respuesta.status === 403) {
    return { ok: false, error: datos.mensaje ?? MENSAJE_SIN_PERMISO, sesionExpirada: false }
  }
  if (respuesta.status === 401) {
    return { ok: false, error: datos.mensaje ?? MENSAJE_SESION_EXPIRADA, sesionExpirada: true }
  }

  console.error(`[cedis] ${operacion} falló (${respuesta.status}):`, datos)
  return {
    ok: false,
    error: datos.mensaje ?? `El servidor respondió ${respuesta.status}`,
    sesionExpirada: false,
  }
}

// --- Embarques -------------------------------------------------------------

export async function accionCrearEmbarque(
  tokens: TokensCedis,
  item: CrearEmbarqueInput,
): Promise<ResultadoAccion> {
  return invocar('crearEmbarque', tokens, { ...item })
}

export async function accionActualizarEstadoEmbarque(
  tokens: TokensCedis,
  id: string,
  estado: EstadoEmbarque,
): Promise<ResultadoAccion> {
  return invocar('actualizarEstadoEmbarque', tokens, { id, estado })
}

export async function accionEliminarEmbarque(
  tokens: TokensCedis,
  id: string,
): Promise<ResultadoAccion> {
  return invocar('eliminarEmbarque', tokens, { id })
}

// --- Recepciones -----------------------------------------------------------

export async function accionCrearRecepcion(
  tokens: TokensCedis,
  item: CrearRecepcionInput,
): Promise<ResultadoAccion> {
  return invocar('crearRecepcion', tokens, { ...item })
}

export async function accionActualizarEstadoRecepcion(
  tokens: TokensCedis,
  id: string,
  estado: EstadoRecepcion,
  anden?: string | null,
): Promise<ResultadoAccion> {
  return invocar('actualizarEstadoRecepcion', tokens, { id, estado, anden: anden ?? null })
}

export async function accionEliminarRecepcion(
  tokens: TokensCedis,
  id: string,
): Promise<ResultadoAccion> {
  return invocar('eliminarRecepcion', tokens, { id })
}

// --- Surtido ---------------------------------------------------------------

export async function accionCrearPedidoSurtido(
  tokens: TokensCedis,
  item: CrearSurtidoInput,
): Promise<ResultadoAccion> {
  return invocar('crearPedidoSurtido', tokens, { ...item })
}

export async function accionActualizarEstadoSurtido(
  tokens: TokensCedis,
  id: string,
  estado: EstadoSurtido,
  operador?: string | null,
): Promise<ResultadoAccion> {
  return invocar('actualizarEstadoSurtido', tokens, { id, estado, operador: operador ?? null })
}

export async function accionEliminarPedidoSurtido(
  tokens: TokensCedis,
  id: string,
): Promise<ResultadoAccion> {
  return invocar('eliminarPedidoSurtido', tokens, { id })
}

// --- Etiquetado ------------------------------------------------------------

export async function accionCrearLoteEtiquetado(
  tokens: TokensCedis,
  item: CrearEtiquetadoInput,
): Promise<ResultadoAccion> {
  return invocar('crearLoteEtiquetado', tokens, { ...item })
}

export async function accionActualizarEstadoEtiquetado(
  tokens: TokensCedis,
  id: string,
  estado: EstadoEtiquetado,
  motivoRechazo?: string | null,
): Promise<ResultadoAccion> {
  return invocar('actualizarEstadoEtiquetado', tokens, {
    id,
    estado,
    motivo_rechazo: motivoRechazo ?? null,
  })
}

export async function accionEliminarLoteEtiquetado(
  tokens: TokensCedis,
  id: string,
): Promise<ResultadoAccion> {
  return invocar('eliminarLoteEtiquetado', tokens, { id })
}

// --- Productividad ---------------------------------------------------------

export async function accionRegistrarProductividad(
  tokens: TokensCedis,
  input: RegistrarProductividadInput,
): Promise<ResultadoAccion> {
  return invocar('registrarProductividad', tokens, { ...input })
}

export async function accionEliminarRegistroProductividad(
  tokens: TokensCedis,
  id: string,
): Promise<ResultadoAccion> {
  return invocar('eliminarRegistroProductividad', tokens, { id })
}
