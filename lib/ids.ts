// Identificadores que genera el navegador para las escrituras idempotentes.
//
// Los SP de alta reciben el `id` en vez de generarlo: así un reintento tras una
// respuesta perdida cae sobre el mismo registro en vez de crear un duplicado.
// Vive aquí y no en cada diálogo porque ya son tres los que lo necesitan y la
// versión de respaldo —para contextos sin `crypto.randomUUID`— no debería tener
// tres copias distintas.

/**
 * @param prefijo - Solo se usa en el respaldo, para que un id sin UUID siga
 * diciendo de qué es: `srt-1756...`, `prod-1756...`.
 */
export function nuevoId(prefijo: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${prefijo}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}
