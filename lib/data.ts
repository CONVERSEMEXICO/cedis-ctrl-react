// Capa de acceso a datos: intenta leer de la GraphQL API de Microsoft Fabric
// con el token de Entra ID del usuario y usa los datos seed como respaldo
// cuando no hay sesión, la API no está conectada o falla.
//
// El token lo obtiene el navegador con MSAL, así que cada carga lo recibe como
// argumento; quien lo pide es <ProveedorDatosCedis>
// (components/providers/cedis-data-provider.tsx), el único que llama aquí.
//
// Los conjuntos con tabla publicada viajan en **una sola petición**
// (getDatosOperativos). Antes eran cinco en paralelo más el stub de
// incidencias: seis por carga, y como cada escritura dispara una recarga, la
// operación normal del CEDIS excedía el límite de tasa de Fabric y la API
// empezaba a responder 429. Incidencias ya no sale a la red: su tabla no está
// publicada, así que el respaldo seed se resuelve en local.
//
// Pedidos y sus renglones se sumaron a esa misma petición, no como llamadas
// nuevas: son dos campos raíz más del mismo documento y la carga del panel
// sigue costando una sola petición.

import { esLimiteExcedido, esSesionExpirada } from '@/lib/graphql'
import { getDatosOperativos } from '@/lib/queries'
import {
  embarquesSeed,
  incidenciasSeed,
  lotesEtiquetadoSeed,
  pedidoLineasSeed,
  pedidosSeed,
  pedidosSurtidoSeed,
  recepcionesSeed,
  registrosProductividadSeed,
} from '@/lib/seed-data'
import type {
  Embarque,
  Incidencia,
  LoteEtiquetado,
  Pedido,
  PedidoLinea,
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

/** Los ocho conjuntos que consume el panel. */
export interface DatosCedis {
  embarques: Embarque[]
  recepciones: Recepcion[]
  pedidosSurtido: PedidoSurtido[]
  lotesEtiquetado: LoteEtiquetado[]
  incidencias: Incidencia[]
  productividad: RegistroProductividad[]
  /** Cabeceras de pedido del ERP. */
  pedidos: Pedido[]
  /** Renglones de **todos** los pedidos; la vista de detalle filtra en memoria. */
  pedidoLineas: PedidoLinea[]
}

/** Qué conjuntos vinieron del respaldo seed; cada página pinta su banner. */
export type OfflinePorConjunto = Record<keyof DatosCedis, boolean>

export interface ResultadoDatosCedis {
  datos: DatosCedis
  offline: OfflinePorConjunto
  /** true si la carga falló por sesión vencida. */
  sesionExpirada: boolean
  /** true si Fabric respondió 429: hay que dejar de pedir por un rato. */
  limiteExcedido: boolean
}

/** Estado inicial: sin datos todavía, todo marcado como no cargado. */
export const DATOS_VACIOS: DatosCedis = {
  embarques: [],
  recepciones: [],
  pedidosSurtido: [],
  lotesEtiquetado: [],
  incidencias: [],
  productividad: [],
  pedidos: [],
  pedidoLineas: [],
}

export const OFFLINE_INICIAL: OfflinePorConjunto = {
  embarques: false,
  recepciones: false,
  pedidosSurtido: false,
  lotesEtiquetado: false,
  incidencias: false,
  productividad: false,
  pedidos: false,
  pedidoLineas: false,
}

/** Lo que se ve cuando no hay API: la operación de ejemplo, completa. */
const SEED: DatosCedis = {
  embarques: embarquesSeed,
  recepciones: recepcionesSeed,
  pedidosSurtido: pedidosSurtidoSeed,
  lotesEtiquetado: lotesEtiquetadoSeed,
  incidencias: incidenciasSeed,
  productividad: registrosProductividadSeed,
  pedidos: pedidosSeed,
  pedidoLineas: pedidoLineasSeed,
}

/**
 * Resuelve un conjunto: lo que trajo Fabric, o el seed si vino en null.
 *
 * El null por conjunto es lo que permite que un fallo parcial —una tabla que
 * falla mientras las otras responden— no tire la carga entera.
 */
function conRespaldo<K extends keyof DatosCedis>(
  conjunto: K,
  recibido: DatosCedis[K] | null,
): { datos: DatosCedis[K]; offline: boolean } {
  if (recibido) return { datos: recibido, offline: false }
  console.error(`[cedis] ${conjunto}: cayó al respaldo seed`)
  return { datos: SEED[conjunto], offline: true }
}

/** Todo el panel en seed, con el motivo del fallo ya clasificado. */
function todoOffline(error: unknown): ResultadoDatosCedis {
  console.error('[cedis] la carga completa cayó al respaldo seed —', error)
  return {
    datos: SEED,
    offline: {
      embarques: true,
      recepciones: true,
      pedidosSurtido: true,
      lotesEtiquetado: true,
      incidencias: true,
      productividad: true,
      pedidos: true,
      pedidoLineas: true,
    },
    sesionExpirada: esSesionExpirada(error),
    limiteExcedido: esLimiteExcedido(error),
  }
}

export async function cargarDatosCedis(token: Token): Promise<ResultadoDatosCedis> {
  let operativos
  try {
    operativos = await getDatosOperativos(token)
  } catch (error) {
    return todoOffline(error)
  }

  const embarques = conRespaldo('embarques', operativos.embarques)
  const recepciones = conRespaldo('recepciones', operativos.recepciones)
  const pedidosSurtido = conRespaldo('pedidosSurtido', operativos.pedidosSurtido)
  const lotesEtiquetado = conRespaldo('lotesEtiquetado', operativos.lotesEtiquetado)
  const productividad = conRespaldo('productividad', operativos.productividad)
  const pedidos = conRespaldo('pedidos', operativos.pedidos)
  const pedidoLineas = conRespaldo('pedidoLineas', operativos.pedidoLineas)

  return {
    datos: {
      embarques: embarques.datos,
      recepciones: recepciones.datos,
      pedidosSurtido: pedidosSurtido.datos,
      lotesEtiquetado: lotesEtiquetado.datos,
      // Sin tabla publicada en la API, incidencias siempre es seed y no gasta
      // una petición en averiguarlo. Ver getIncidencias en lib/queries.ts.
      incidencias: SEED.incidencias,
      productividad: productividad.datos,
      pedidos: pedidos.datos,
      pedidoLineas: pedidoLineas.datos,
    },
    offline: {
      embarques: embarques.offline,
      recepciones: recepciones.offline,
      pedidosSurtido: pedidosSurtido.offline,
      lotesEtiquetado: lotesEtiquetado.offline,
      incidencias: true,
      productividad: productividad.offline,
      pedidos: pedidos.offline,
      pedidoLineas: pedidoLineas.offline,
    },
    sesionExpirada: false,
    limiteExcedido: false,
  }
}
