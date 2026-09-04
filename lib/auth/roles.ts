// App roles del CEDIS: la jerarquía y su lectura desde los claims de Entra ID.
//
// La fuente de verdad son los App roles configurados a mano en el registro de
// aplicación de Azure Portal; Entra los publica en el claim `roles` del ID
// token. Aquí no se crean ni se asignan roles: solo se interpretan.
//
// Este módulo es puro a propósito —sin React y sin MSAL— porque lo importan
// las dos orillas: el hook del navegador (hooks/use-cedis-role.ts) y el guard
// del servidor (lib/auth/requirePermission.ts).

/** Los tres valores exactos que la app espera en el claim `roles`. */
export const ROLES = ['CEDIS.Operador', 'CEDIS.Supervisor', 'CEDIS.Administrador'] as const

export type Role = (typeof ROLES)[number]

/** A mayor número, mayor privilegio. Administrador > Supervisor > Operador. */
const JERARQUIA: Record<Role, number> = {
  'CEDIS.Operador': 1,
  'CEDIS.Supervisor': 2,
  'CEDIS.Administrador': 3,
}

/**
 * Rol del modo demostración: sin Entra configurado no hay claims que leer, y
 * la app tiene que poder recorrerse completa con los datos seed.
 *
 * OJO: solo aplica cuando NO hay sesión. Con sesión real y sin rol asignado el
 * fallback es `ROL_MINIMO` — ver `rolDeSesion()`.
 */
export const ROL_DEMO: Role = 'CEDIS.Administrador'

/** Rol más restrictivo: el fallback de una sesión real sin rol asignado. */
export const ROL_MINIMO: Role = 'CEDIS.Operador'

export function esRole(valor: unknown): valor is Role {
  return typeof valor === 'string' && (ROLES as readonly string[]).includes(valor)
}

/**
 * Rol de mayor jerarquía presente en el arreglo.
 *
 * @returns El rol más privilegiado, o null si el arreglo está vacío o no trae
 * ninguno de los tres valores esperados.
 */
export function getHighestRole(roles: string[]): Role | null {
  let mayor: Role | null = null
  for (const valor of roles) {
    if (!esRole(valor)) continue
    if (mayor === null || JERARQUIA[valor] > JERARQUIA[mayor]) mayor = valor
  }
  return mayor
}

/**
 * Normaliza el claim `roles` tal como puede llegar de Entra ID: arreglo de
 * strings en el caso normal, string suelto cuando hay un único rol, y ausente
 * cuando el usuario no tiene ninguna asignación.
 */
export function rolesDeClaim(claim: unknown): string[] {
  if (Array.isArray(claim)) return claim.filter((valor): valor is string => typeof valor === 'string')
  if (typeof claim === 'string' && claim !== '') return [claim]
  return []
}

/**
 * Rol efectivo de una sesión autenticada.
 *
 * Un usuario con sesión válida pero sin ninguno de los tres app roles se trata
 * como `CEDIS.Operador`: nunca se escala a Administrador cuando sí hay sesión.
 */
export function rolDeSesion(claim: unknown): Role {
  return getHighestRole(rolesDeClaim(claim)) ?? ROL_MINIMO
}
