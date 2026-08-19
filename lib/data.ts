// Capa de acceso a datos: intenta leer de la GraphQL API de Microsoft Fabric
// y usa los datos seed como respaldo cuando la API no está conectada o falla.

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

async function withFallback<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

export async function obtenerEmbarques(): Promise<Embarque[]> {
  return withFallback(getEmbarques, embarquesSeed)
}

export async function obtenerRecepciones(): Promise<Recepcion[]> {
  return withFallback(getRecepciones, recepcionesSeed)
}

export async function obtenerPedidosSurtido(): Promise<PedidoSurtido[]> {
  return withFallback(getPedidosSurtido, pedidosSurtidoSeed)
}

export async function obtenerLotesEtiquetado(): Promise<LoteEtiquetado[]> {
  return withFallback(getLotesEtiquetado, lotesEtiquetadoSeed)
}

export async function obtenerIncidencias(): Promise<Incidencia[]> {
  return withFallback(getIncidencias, incidenciasSeed)
}

export async function obtenerRegistrosProductividad(): Promise<RegistroProductividad[]> {
  return withFallback(getRegistrosProductividad, registrosProductividadSeed)
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
