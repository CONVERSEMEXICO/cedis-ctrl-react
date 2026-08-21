// Capa de acceso a datos: intenta leer de la GraphQL API de Microsoft Fabric
// y usa los datos seed como respaldo cuando la API no está conectada o falla.
//
// Dos formas de consumir cada conjunto:
//   - `cargarX()`   → { datos, offline }; lo usan las vistas que muestran el
//                     banner "Modo offline — datos de demostración".
//   - `obtenerX()`  → solo los datos; para el dashboard y el shell, donde el
//                     origen no cambia lo que se pinta.

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

export interface ResultadoDatos<T> {
  datos: T
  /** true cuando la API falló y lo que se ve son datos de demostración. */
  offline: boolean
}

async function conRespaldo<T>(fn: () => Promise<T>, respaldo: T): Promise<ResultadoDatos<T>> {
  try {
    return { datos: await fn(), offline: false }
  } catch {
    return { datos: respaldo, offline: true }
  }
}

export async function cargarEmbarques(): Promise<ResultadoDatos<Embarque[]>> {
  return conRespaldo(() => getEmbarques(), embarquesSeed)
}

export async function cargarRecepciones(): Promise<ResultadoDatos<Recepcion[]>> {
  return conRespaldo(() => getRecepciones(), recepcionesSeed)
}

export async function cargarPedidosSurtido(): Promise<ResultadoDatos<PedidoSurtido[]>> {
  return conRespaldo(() => getPedidosSurtido(), pedidosSurtidoSeed)
}

export async function cargarLotesEtiquetado(): Promise<ResultadoDatos<LoteEtiquetado[]>> {
  return conRespaldo(() => getLotesEtiquetado(), lotesEtiquetadoSeed)
}

export async function cargarIncidencias(): Promise<ResultadoDatos<Incidencia[]>> {
  return conRespaldo(getIncidencias, incidenciasSeed)
}

export async function cargarRegistrosProductividad(): Promise<
  ResultadoDatos<RegistroProductividad[]>
> {
  return conRespaldo(getRegistrosProductividad, registrosProductividadSeed)
}

export async function obtenerEmbarques(): Promise<Embarque[]> {
  return (await cargarEmbarques()).datos
}

export async function obtenerRecepciones(): Promise<Recepcion[]> {
  return (await cargarRecepciones()).datos
}

export async function obtenerPedidosSurtido(): Promise<PedidoSurtido[]> {
  return (await cargarPedidosSurtido()).datos
}

export async function obtenerLotesEtiquetado(): Promise<LoteEtiquetado[]> {
  return (await cargarLotesEtiquetado()).datos
}

export async function obtenerIncidencias(): Promise<Incidencia[]> {
  return (await cargarIncidencias()).datos
}

export async function obtenerRegistrosProductividad(): Promise<RegistroProductividad[]> {
  return (await cargarRegistrosProductividad()).datos
}

export async function obtenerDatosCedis() {
  const [embarques, recepciones, pedidosSurtido, lotesEtiquetado, incidencias, productividad] =
    await Promise.all([
      obtenerEmbarques(),
      obtenerRecepciones(),
      obtenerPedidosSurtido(),
      obtenerLotesEtiquetado(),
      obtenerIncidencias(),
      obtenerRegistrosProductividad(),
    ])

  return { embarques, recepciones, pedidosSurtido, lotesEtiquetado, incidencias, productividad }
}
