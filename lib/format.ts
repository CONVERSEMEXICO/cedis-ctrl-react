// Formato de fechas y números del panel. Locale es-MX y '—' para lo ausente:
// muchas columnas de la API son nullable y la tabla no debe quedar en blanco.

const AUSENTE = '—'

export function formatFechaHora(iso?: string | null) {
  if (!iso) return AUSENTE
  const d = new Date(iso)
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function formatFecha(iso?: string | null) {
  if (!iso) return AUSENTE
  const d = new Date(iso)
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatNumero(n?: number | null) {
  if (n === null || n === undefined || Number.isNaN(n)) return AUSENTE
  return n.toLocaleString('es-MX')
}

/** Números con decimales (horas trabajadas): hasta un decimal, sin ceros de más. */
export function formatDecimal(n?: number | null) {
  if (n === null || n === undefined || Number.isNaN(n)) return AUSENTE
  return n.toLocaleString('es-MX', { maximumFractionDigits: 1 })
}

/** Texto opcional de la API: null, undefined o vacío se muestran como '—'. */
export function formatTexto(valor?: string | null) {
  if (!valor || valor.trim() === '') return AUSENTE
  return valor
}
