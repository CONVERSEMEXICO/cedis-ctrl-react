// Matriz de permisos: qué roles pueden ejecutar cada acción de la app.
//
// Es declarativa a propósito. La autorización no se deduce de la jerarquía
// —aunque hoy los permisos crezcan monótonamente con ella— sino que cada
// acción lista los roles que la habilitan: agregar una acción obliga a decidir
// explícitamente quién puede ejecutarla, y leer la tabla no exige seguir
// ningún encadenamiento de if/else.
//
// El mismo objeto lo consumen la UI (hooks/use-permission.ts) y el guard del
// servidor (lib/auth/requirePermission.ts): una sola definición para los dos
// lados del enforcement.

import { ROLES, type Role } from '@/lib/auth/roles'

export type Action =
  | 'ver_dashboard'
  | 'ver_modulo'
  | 'cambiar_estatus_registro'
  | 'crear_registro'
  | 'crear_surtido_desde_pedido'
  | 'cambiar_estatus_pedido'
  | 'eliminar_registro'
  | 'reportar_incidencia'
  | 'cambiar_estatus_incidencia'
  | 'eliminar_incidencia'
  | 'ver_productividad_todos'
  | 'ver_productividad_propia'
  | 'registrar_turno_productividad'

/** Mensaje único de acción no autorizada, igual en la UI y en el 403. */
export const MENSAJE_SIN_PERMISO = 'No tienes permisos para esta acción.'

const TODOS = ROLES
const SUPERVISION: readonly Role[] = ['CEDIS.Supervisor', 'CEDIS.Administrador']
const SOLO_ADMIN: readonly Role[] = ['CEDIS.Administrador']

export const MATRIZ_PERMISOS: Record<Action, readonly Role[]> = {
  // Lectura: la operación del piso la ve completa cualquier rol.
  ver_dashboard: TODOS,
  ver_modulo: TODOS,
  ver_productividad_propia: TODOS,

  // Escritura operativa del día a día.
  cambiar_estatus_registro: TODOS,
  reportar_incidencia: TODOS,

  // Alta, baja y seguimiento: supervisión hacia arriba.
  crear_registro: SUPERVISION,
  // Abrir el surtido de un pedido es un alta que además mueve el estado del
  // pedido: se declara aparte de `crear_registro` para poder restringirla sin
  // tocar las altas normales de los módulos.
  crear_surtido_desde_pedido: SUPERVISION,
  // Mover el estado de un pedido a mano —cancelarlo, sobre todo— no es avance
  // de la operación sino una decisión sobre el compromiso con el cliente. Por
  // eso NO va con `cambiar_estatus_registro`, que sí es del piso y lo tienen
  // todos los roles.
  cambiar_estatus_pedido: SUPERVISION,
  eliminar_registro: SUPERVISION,
  cambiar_estatus_incidencia: SUPERVISION,
  ver_productividad_todos: SUPERVISION,
  registrar_turno_productividad: SUPERVISION,

  // Borrar el historial de incidencias no se delega.
  eliminar_incidencia: SOLO_ADMIN,
}

/**
 * ¿El rol puede ejecutar la acción?
 *
 * Sin rol (null) no hay permiso: el llamador que quiera el comportamiento de
 * modo demostración tiene que resolver el rol antes, no aquí.
 */
export function hasPermission(role: Role | null, action: Action): boolean {
  if (role === null) return false
  return MATRIZ_PERMISOS[action]?.includes(role) ?? false
}
