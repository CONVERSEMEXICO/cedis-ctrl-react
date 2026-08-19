// Cálculo de indicadores operativos a partir de las entidades del dominio.
//
// Vive fuera de las páginas a propósito: v0 regenera archivos completos, y
// `app/*/page.tsx` es la frontera donde presentación y lógica se tocan. Al
// mantener aquí los agregados, una regeneración de UI no puede arrastrarse
// la lógica de negocio. Estas funciones devuelven números puros — el color,
// el formato y el markup son responsabilidad de la capa de presentación.

import type {
  Embarque,
  Incidencia,
  LoteEtiquetado,
  PedidoSurtido,
  Recepcion,
  RegistroProductividad,
  Severidad,
} from '@/types/cedis'

/** Porcentaje entero, con 0 como resultado cuando no hay denominador. */
export function pct(numerador: number, denominador: number): number {
  if (denominador === 0) return 0
  return Math.round((numerador / denominador) * 100)
}

// ---------------------------------------------------------------------------
// Embarques
// ---------------------------------------------------------------------------

export interface MetricasEmbarques {
  total: number
  entregados: number
  retrasados: number
  pctEntregados: number
  totalUnidades: number
}

export function metricasEmbarques(embarques: Embarque[]): MetricasEmbarques {
  const entregados = embarques.filter((e) => e.estado === 'entregado').length
  const retrasados = embarques.filter((e) => e.estado === 'retrasado').length

  return {
    total: embarques.length,
    entregados,
    retrasados,
    pctEntregados: pct(entregados, embarques.length),
    totalUnidades: embarques.reduce((acc, e) => acc + e.unidades, 0),
  }
}

// ---------------------------------------------------------------------------
// Recepciones
// ---------------------------------------------------------------------------

export interface MetricasRecepciones {
  total: number
  recibidas: number
  conDiscrepancia: number
  pctRecibidas: number
}

export function metricasRecepciones(recepciones: Recepcion[]): MetricasRecepciones {
  const recibidas = recepciones.filter((r) => r.estado === 'recibida').length

  return {
    total: recepciones.length,
    recibidas,
    conDiscrepancia: recepciones.filter((r) => r.tieneDiscrepancia).length,
    pctRecibidas: pct(recibidas, recepciones.length),
  }
}

// ---------------------------------------------------------------------------
// Surtido
// ---------------------------------------------------------------------------

export interface MetricasSurtido {
  total: number
  completados: number
  enProceso: number
  pctCompletados: number
}

export function metricasSurtido(pedidos: PedidoSurtido[]): MetricasSurtido {
  const completados = pedidos.filter((p) => p.estado === 'completado').length

  return {
    total: pedidos.length,
    completados,
    enProceso: pedidos.filter((p) => p.estado === 'surtiendo').length,
    pctCompletados: pct(completados, pedidos.length),
  }
}

/** Avance de un pedido individual, en porcentaje de unidades surtidas. */
export function avanceSurtido(pedido: PedidoSurtido): number {
  return pct(pedido.unidadesSurtidas, pedido.unidadesTotales)
}

// ---------------------------------------------------------------------------
// Etiquetado
// ---------------------------------------------------------------------------

export interface MetricasEtiquetado {
  total: number
  etiquetados: number
  rechazados: number
  pctEtiquetados: number
}

export function metricasEtiquetado(lotes: LoteEtiquetado[]): MetricasEtiquetado {
  const etiquetados = lotes.filter((l) => l.estado === 'etiquetado').length

  return {
    total: lotes.length,
    etiquetados,
    rechazados: lotes.filter((l) => l.estado === 'rechazado').length,
    pctEtiquetados: pct(etiquetados, lotes.length),
  }
}

// ---------------------------------------------------------------------------
// Incidencias
// ---------------------------------------------------------------------------

/** Una incidencia "abierta" incluye las que ya están en atención. */
export function esIncidenciaAbierta(incidencia: Incidencia): boolean {
  return incidencia.estado === 'abierta' || incidencia.estado === 'atencion'
}

export function incidenciasAbiertas(incidencias: Incidencia[]): Incidencia[] {
  return incidencias.filter(esIncidenciaAbierta)
}

export interface MetricasIncidencias {
  total: number
  abiertas: number
  criticas: number
}

export function metricasIncidencias(incidencias: Incidencia[]): MetricasIncidencias {
  const abiertas = incidenciasAbiertas(incidencias)

  return {
    total: incidencias.length,
    abiertas: abiertas.length,
    criticas: abiertas.filter((i) => i.severidad === 'critica').length,
  }
}

/** Conteo por severidad del conjunto que reciba — filtra antes si solo quieres abiertas. */
export function conteoPorSeveridad(incidencias: Incidencia[]): Record<Severidad, number> {
  const conteo: Record<Severidad, number> = { baja: 0, media: 0, alta: 0, critica: 0 }
  for (const incidencia of incidencias) {
    conteo[incidencia.severidad] += 1
  }
  return conteo
}

/** Ordena de más reciente a más antigua sin mutar el arreglo original. */
export function ordenarPorFechaCreacionDesc<T extends { fechaCreacion: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime(),
  )
}

// ---------------------------------------------------------------------------
// Productividad
// ---------------------------------------------------------------------------

/** Cumplimiento de un registro frente a su meta, en porcentaje. */
export function cumplimientoRegistro(registro: RegistroProductividad): number {
  return pct(registro.unidadesPorHora, registro.metaUnidadesPorHora)
}

export interface MetricasProductividad {
  total: number
  promedioUnidadesHora: number
  pctCumplimientoMeta: number
}

export function metricasProductividad(
  registros: RegistroProductividad[],
): MetricasProductividad {
  if (registros.length === 0) {
    return { total: 0, promedioUnidadesHora: 0, pctCumplimientoMeta: 0 }
  }

  const sumaUnidades = registros.reduce((acc, r) => acc + r.unidadesPorHora, 0)
  const sumaCumplimiento = registros.reduce(
    (acc, r) => acc + (r.metaUnidadesPorHora > 0 ? r.unidadesPorHora / r.metaUnidadesPorHora : 0),
    0,
  )

  return {
    total: registros.length,
    promedioUnidadesHora: Math.round(sumaUnidades / registros.length),
    pctCumplimientoMeta: Math.round((sumaCumplimiento / registros.length) * 100),
  }
}
