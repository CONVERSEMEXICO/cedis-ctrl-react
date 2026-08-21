'use server'

// Server actions de los módulos operativos.
//
// La UI es interactiva pero el token de Fabric (FABRIC_AUTH_TOKEN) nunca puede
// salir al navegador: toda mutación pasa por aquí. Cada acción devuelve un
// `ResultadoAccion` en vez de lanzar, para que la vista muestre el toast de
// error sin romper el render, y revalida el layout raíz para refrescar la
// tabla del módulo, el dashboard y los conteos del sidebar de una sola vez.

import { revalidatePath } from 'next/cache'
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

async function ejecutar(operacion: () => Promise<unknown>): Promise<ResultadoAccion> {
  try {
    await operacion()
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}

// --- Embarques -------------------------------------------------------------

export async function accionCrearEmbarque(item: CrearEmbarqueInput): Promise<ResultadoAccion> {
  return ejecutar(() => crearEmbarque(item))
}

export async function accionActualizarEstadoEmbarque(
  id: string,
  estado: EstadoEmbarque,
): Promise<ResultadoAccion> {
  return ejecutar(() => actualizarEstadoEmbarque(id, estado))
}

export async function accionEliminarEmbarque(id: string): Promise<ResultadoAccion> {
  return ejecutar(() => eliminarEmbarque(id))
}

// --- Recepciones -----------------------------------------------------------

export async function accionCrearRecepcion(item: CrearRecepcionInput): Promise<ResultadoAccion> {
  return ejecutar(() => crearRecepcion(item))
}

export async function accionActualizarEstadoRecepcion(
  id: string,
  estado: EstadoRecepcion,
  anden?: string | null,
): Promise<ResultadoAccion> {
  return ejecutar(() => actualizarEstadoRecepcion(id, estado, anden))
}

export async function accionEliminarRecepcion(id: string): Promise<ResultadoAccion> {
  return ejecutar(() => eliminarRecepcion(id))
}

// --- Surtido ---------------------------------------------------------------

export async function accionCrearPedidoSurtido(
  item: CrearSurtidoInput,
): Promise<ResultadoAccion> {
  return ejecutar(() => crearPedidoSurtido(item))
}

export async function accionActualizarEstadoSurtido(
  id: string,
  estado: EstadoSurtido,
  operador?: string | null,
): Promise<ResultadoAccion> {
  return ejecutar(() => actualizarEstadoSurtido(id, estado, operador))
}

export async function accionEliminarPedidoSurtido(id: string): Promise<ResultadoAccion> {
  return ejecutar(() => eliminarPedidoSurtido(id))
}

// --- Etiquetado ------------------------------------------------------------

export async function accionCrearLoteEtiquetado(
  item: CrearEtiquetadoInput,
): Promise<ResultadoAccion> {
  return ejecutar(() => crearLoteEtiquetado(item))
}

export async function accionActualizarEstadoEtiquetado(
  id: string,
  estado: EstadoEtiquetado,
  motivoRechazo?: string | null,
): Promise<ResultadoAccion> {
  return ejecutar(() => actualizarEstadoEtiquetado(id, estado, motivoRechazo))
}

export async function accionEliminarLoteEtiquetado(id: string): Promise<ResultadoAccion> {
  return ejecutar(() => eliminarLoteEtiquetado(id))
}

// --- Productividad ---------------------------------------------------------

export async function accionRegistrarProductividad(
  input: RegistrarProductividadInput,
): Promise<ResultadoAccion> {
  return ejecutar(() => registrarProductividad(input))
}

export async function accionEliminarRegistroProductividad(
  id: string,
): Promise<ResultadoAccion> {
  return ejecutar(() => eliminarRegistroProductividad(id))
}
