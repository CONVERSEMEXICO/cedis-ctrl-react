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
    totalUnidades: embarques.reduce((acc, e) => acc + (e.unidades ?? 0), 0),
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
    conDiscrepancia: recepciones.filter((r) => r.estado === 'discrepancia').length,
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
  totalLineas: number
}

export function metricasSurtido(pedidos: PedidoSurtido[]): MetricasSurtido {
  const completados = pedidos.filter((p) => p.estado === 'completado').length

  return {
    total: pedidos.length,
    completados,
    enProceso: pedidos.filter((p) => p.estado === 'surtiendo').length,
    pctCompletados: pct(completados, pedidos.length),
    totalLineas: pedidos.reduce((acc, p) => acc + (p.lineas ?? 0), 0),
  }
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
// El registro guarda el turno completo: `unidades` procesadas en `horas`
// trabajadas contra una `meta` de unidades del turno. De ahí salen dos lecturas
// distintas — el ritmo (unidades por hora) y el cumplimiento (unidades vs meta).

/** Ritmo del turno, en unidades por hora. */
export function unidadesPorHora(registro: RegistroProductividad): number {
  if (!registro.horas) return 0
  return Math.round(registro.unidades / registro.horas)
}

/** Cumplimiento del turno frente a su meta de unidades, en porcentaje. */
export function cumplimientoRegistro(registro: RegistroProductividad): number {
  return pct(registro.unidades, registro.meta)
}

export function cumpleMeta(registro: RegistroProductividad): boolean {
  return cumplimientoRegistro(registro) >= 100
}

export interface MetricasProductividad {
  total: number
  promedioUnidadesHora: number
  pctCumplimientoMeta: number
  turnosBajoMeta: number
}

export function metricasProductividad(
  registros: RegistroProductividad[],
): MetricasProductividad {
  if (registros.length === 0) {
    return { total: 0, promedioUnidadesHora: 0, pctCumplimientoMeta: 0, turnosBajoMeta: 0 }
  }

  const sumaRitmo = registros.reduce((acc, r) => acc + unidadesPorHora(r), 0)
  const sumaCumplimiento = registros.reduce((acc, r) => acc + cumplimientoRegistro(r), 0)

  return {
    total: registros.length,
    promedioUnidadesHora: Math.round(sumaRitmo / registros.length),
    pctCumplimientoMeta: Math.round(sumaCumplimiento / registros.length),
    turnosBajoMeta: registros.filter((r) => !cumpleMeta(r)).length,
  }
}

// ---------------------------------------------------------------------------
// Productividad: alcance por rol
// ---------------------------------------------------------------------------

/**
 * Normaliza un nombre para comparar operadores: sin acentos, sin dobles
 * espacios y en minúsculas.
 *
 * Hace falta porque el nombre del operador se captura a mano en el alta del
 * turno y el del usuario lo publica Entra ID: "Ana Cruz" y "ana cruz" son la
 * misma persona, y "Ramón" capturado sin acento también.
 */
function normalizarNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    // Marcas diacríticas combinantes (U+0300–U+036F) que dejó el NFD.
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

export function esMismoOperador(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  return normalizarNombre(a) === normalizarNombre(b)
}

/**
 * Registros de productividad que le corresponde ver a un usuario.
 *
 * Con `ver_productividad_todos` se devuelven todos; sin ese permiso —el caso
 * del Operador— solo los turnos capturados a su nombre. Vive aquí y no en la
 * página para que la tabla y la gráfica partan del mismo arreglo: filtrar solo
 * una de las dos dejaría el nombre de los demás a la vista en la otra.
 */
export function productividadVisible(
  registros: RegistroProductividad[],
  verTodos: boolean,
  nombreUsuario: string | null,
): RegistroProductividad[] {
  if (verTodos) return registros
  return registros.filter((registro) => esMismoOperador(registro.operador, nombreUsuario))
}
