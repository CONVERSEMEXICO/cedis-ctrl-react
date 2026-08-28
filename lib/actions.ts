// Operaciones de escritura de los módulos operativos.
//
// Ya no son server actions: con Entra ID el token es del usuario y vive en el
// navegador (sessionStorage, vía MSAL), así que la mutación sale del cliente y
// cada operación recibe el token como primer argumento. Sigue el mismo
// contrato de antes —devuelven `ResultadoAccion` en vez de lanzar, para que la
// vista muestre el toast de error sin romper el render—, pero el refresco ya no
// es `revalidatePath`: lo hace <ProveedorDatosCedis> con `refrescar()`, que es
// lo que usa el hook `useOperacionCedis`.

import { esSesionExpirada } from '@/lib/graphql'
import {
  actualizarEstadoEmbarque,
  actualizarEstadoEtiquetado,
  actualizarEstadoRecepcion,
  actualizarEstadoSurtido,
  crearEmbarque,
  crearLoteEtiquetado,
  crearPedidoSurtido,
  crearRecepcion,
  eliminarEmbarque,
  eliminarLoteEtiquetado,
  eliminarPedidoSurtido,
  eliminarRecepcion,
  eliminarRegistroProductividad,
  registrarProductividad,
  type CrearEmbarqueInput,
  type CrearEtiquetadoInput,
  type CrearRecepcionInput,
  type CrearSurtidoInput,
  type RegistrarProductividadInput,
} from '@/lib/queries'
import type {
  EstadoEmbarque,
  EstadoEtiquetado,
  EstadoRecepcion,
  EstadoSurtido,
  ResultadoAccion,
} from '@/types/cedis'

type Token = string | null

async function ejecutar(operacion: () => Promise<unknown>): Promise<ResultadoAccion> {
  try {
    await operacion()
    return { ok: true }
  } catch (error) {
    // El toast solo muestra el mensaje; el error completo (incluidos los
    // `errors` que devuelve Fabric) queda en consola para poder diagnosticar.
    console.error('[cedis] falló la escritura contra Fabric:', error)
    return {
      ok: false,
      error: (error as Error).message,
      sesionExpirada: esSesionExpirada(error),
    }
  }
}

// --- Embarques -------------------------------------------------------------

export async function accionCrearEmbarque(
  token: Token,
  item: CrearEmbarqueInput,
): Promise<ResultadoAccion> {
  return ejecutar(() => crearEmbarque(token, item))
}

export async function accionActualizarEstadoEmbarque(
  token: Token,
  id: string,
  estado: EstadoEmbarque,
): Promise<ResultadoAccion> {
  return ejecutar(() => actualizarEstadoEmbarque(token, id, estado))
}

export async function accionEliminarEmbarque(token: Token, id: string): Promise<ResultadoAccion> {
  return ejecutar(() => eliminarEmbarque(token, id))
}

// --- Recepciones -----------------------------------------------------------

export async function accionCrearRecepcion(
  token: Token,
  item: CrearRecepcionInput,
): Promise<ResultadoAccion> {
  return ejecutar(() => crearRecepcion(token, item))
}

export async function accionActualizarEstadoRecepcion(
  token: Token,
  id: string,
  estado: EstadoRecepcion,
  anden?: string | null,
): Promise<ResultadoAccion> {
  return ejecutar(() => actualizarEstadoRecepcion(token, id, estado, anden))
}

export async function accionEliminarRecepcion(token: Token, id: string): Promise<ResultadoAccion> {
  return ejecutar(() => eliminarRecepcion(token, id))
}

// --- Surtido ---------------------------------------------------------------

export async function accionCrearPedidoSurtido(
  token: Token,
  item: CrearSurtidoInput,
): Promise<ResultadoAccion> {
  return ejecutar(() => crearPedidoSurtido(token, item))
}

export async function accionActualizarEstadoSurtido(
  token: Token,
  id: string,
  estado: EstadoSurtido,
  operador?: string | null,
): Promise<ResultadoAccion> {
  return ejecutar(() => actualizarEstadoSurtido(token, id, estado, operador))
}

export async function accionEliminarPedidoSurtido(
  token: Token,
  id: string,
): Promise<ResultadoAccion> {
  return ejecutar(() => eliminarPedidoSurtido(token, id))
}

// --- Etiquetado ------------------------------------------------------------

export async function accionCrearLoteEtiquetado(
  token: Token,
  item: CrearEtiquetadoInput,
): Promise<ResultadoAccion> {
  return ejecutar(() => crearLoteEtiquetado(token, item))
}

export async function accionActualizarEstadoEtiquetado(
  token: Token,
  id: string,
  estado: EstadoEtiquetado,
  motivoRechazo?: string | null,
): Promise<ResultadoAccion> {
  return ejecutar(() => actualizarEstadoEtiquetado(token, id, estado, motivoRechazo))
}

export async function accionEliminarLoteEtiquetado(
  token: Token,
  id: string,
): Promise<ResultadoAccion> {
  return ejecutar(() => eliminarLoteEtiquetado(token, id))
}

// --- Productividad ---------------------------------------------------------

export async function accionRegistrarProductividad(
  token: Token,
  input: RegistrarProductividadInput,
): Promise<ResultadoAccion> {
  return ejecutar(() => registrarProductividad(token, input))
}

export async function accionEliminarRegistroProductividad(
  token: Token,
  id: string,
): Promise<ResultadoAccion> {
  return ejecutar(() => eliminarRegistroProductividad(token, id))
}
