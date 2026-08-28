// Capa de acceso a datos: intenta leer de la GraphQL API de Microsoft Fabric
// con el token de Entra ID del usuario y usa los datos seed como respaldo
// cuando no hay sesión, la API no está conectada o falla.
//
// El token lo obtiene el navegador con MSAL, así que cada carga lo recibe como
// argumento; quien lo pide es <ProveedorDatosCedis>
// (components/providers/cedis-data-provider.tsx), el único que llama aquí.

import { esSesionExpirada } from '@/lib/graphql'
import {
  getEmbarques,
  getIncidencias,
  getLotesEtiquetado,
  getPedidosSurtido,
  getRecepciones,
  getRegistrosProductividad,
} from '@/lib/queries'
import {
  embarquesSeed,
  incidenciasSeed,
  lotesEtiquetadoSeed,
  pedidosSurtidoSeed,
  recepcionesSeed,
  registrosProductividadSeed,
} from '@/lib/seed-data'
import type {
  Embarque,
  Incidencia,
  LoteEtiquetado,
  PedidoSurtido,
  Recepcion,
  RegistroProductividad,
} from '@/types/cedis'

type Token = string | null

export interface ResultadoDatos<T> {
  datos: T
  /** true cuando la API falló y lo que se ve son datos de demostración. */
  offline: boolean
  /** true cuando el fallo fue un 401: hay que volver a iniciar sesión. */
  sesionExpirada: boolean
}

/**
 * Corre la carga de un conjunto y, si falla, devuelve el respaldo seed.
 *
 * El error se registra en la consola del navegador con el nombre del conjunto:
 * sin eso, "Modo offline" es indistinguible entre no hay token, la API no
 * responde y Fabric devolvió un error de esquema.
 */
async function conRespaldo<T>(
  conjunto: keyof DatosCedis,
  fn: () => Promise<T>,
  respaldo: T,
): Promise<ResultadoDatos<T>> {
  try {
    return { datos: await fn(), offline: false, sesionExpirada: false }
  } catch (error) {
    console.error(`[cedis] ${conjunto}: cayó al respaldo seed —`, error)
    return { datos: respaldo, offline: true, sesionExpirada: esSesionExpirada(error) }
  }
}

export async function cargarEmbarques(token: Token): Promise<ResultadoDatos<Embarque[]>> {
  return conRespaldo('embarques', () => getEmbarques(token), embarquesSeed)
}

export async function cargarRecepciones(token: Token): Promise<ResultadoDatos<Recepcion[]>> {
  return conRespaldo('recepciones', () => getRecepciones(token), recepcionesSeed)
}

export async function cargarPedidosSurtido(token: Token): Promise<ResultadoDatos<PedidoSurtido[]>> {
  return conRespaldo('pedidosSurtido', () => getPedidosSurtido(token), pedidosSurtidoSeed)
}

export async function cargarLotesEtiquetado(
  token: Token,
): Promise<ResultadoDatos<LoteEtiquetado[]>> {
  return conRespaldo('lotesEtiquetado', () => getLotesEtiquetado(token), lotesEtiquetadoSeed)
}

export async function cargarIncidencias(token: Token): Promise<ResultadoDatos<Incidencia[]>> {
  return conRespaldo('incidencias', () => getIncidencias(token), incidenciasSeed)
}

export async function cargarRegistrosProductividad(
  token: Token,
): Promise<ResultadoDatos<RegistroProductividad[]>> {
  return conRespaldo(
    'productividad',
    () => getRegistrosProductividad(token),
    registrosProductividadSeed,
  )
}

/** Los seis conjuntos que consume el panel. */
export interface DatosCedis {
  embarques: Embarque[]
  recepciones: Recepcion[]
  pedidosSurtido: PedidoSurtido[]
  lotesEtiquetado: LoteEtiquetado[]
  incidencias: Incidencia[]
  productividad: RegistroProductividad[]
}

/** Qué conjuntos vinieron del respaldo seed; cada página pinta su banner. */
export type OfflinePorConjunto = Record<keyof DatosCedis, boolean>

export interface ResultadoDatosCedis {
  datos: DatosCedis
  offline: OfflinePorConjunto
  /** true si alguna de las seis cargas falló por sesión vencida. */
  sesionExpirada: boolean
}

/** Estado inicial: sin datos todavía, todo marcado como no cargado. */
export const DATOS_VACIOS: DatosCedis = {
  embarques: [],
  recepciones: [],
  pedidosSurtido: [],
  lotesEtiquetado: [],
  incidencias: [],
  productividad: [],
}

export const OFFLINE_INICIAL: OfflinePorConjunto = {
  embarques: false,
  recepciones: false,
  pedidosSurtido: false,
  lotesEtiquetado: false,
  incidencias: false,
  productividad: false,
}

export async function cargarDatosCedis(token: Token): Promise<ResultadoDatosCedis> {
  const [embarques, recepciones, pedidosSurtido, lotesEtiquetado, incidencias, productividad] =
    await Promise.all([
      cargarEmbarques(token),
      cargarRecepciones(token),
      cargarPedidosSurtido(token),
      cargarLotesEtiquetado(token),
      cargarIncidencias(token),
      cargarRegistrosProductividad(token),
    ])

  return {
    datos: {
      embarques: embarques.datos,
      recepciones: recepciones.datos,
      pedidosSurtido: pedidosSurtido.datos,
      lotesEtiquetado: lotesEtiquetado.datos,
      incidencias: incidencias.datos,
      productividad: productividad.datos,
    },
    offline: {
      embarques: embarques.offline,
      recepciones: recepciones.offline,
      pedidosSurtido: pedidosSurtido.offline,
      lotesEtiquetado: lotesEtiquetado.offline,
      incidencias: incidencias.offline,
      productividad: productividad.offline,
    },
    sesionExpirada: [
      embarques,
      recepciones,
      pedidosSurtido,
      lotesEtiquetado,
      incidencias,
      productividad,
    ].some((resultado) => resultado.sesionExpirada),
  }
}
