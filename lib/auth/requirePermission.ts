// Guard de autorización del servidor: los pasos 1-3 de la defensa en
// profundidad, para usar al inicio de cada Route Handler.
//
//   1. Valida la sesión del usuario (ID token de Entra ID, por header
//      Authorization o por cookie).
//   2. Extrae el claim `roles` del token **ya validado**.
//   3. Verifica hasPermission(rol, accion) antes de tocar Fabric.
//
// Ocultar un botón no es seguridad: los checks de hooks/use-permission.ts son
// para que la UI no ofrezca lo que no se puede hacer, y esto es lo que de
// verdad lo impide. Un operador que llame el endpoint con curl se topa aquí.

import { ENTRA_CLIENT_ID, ENTRA_TENANT_ID } from '@/lib/auth-config'
import {
  identidadDeClaims,
  verificarIdToken,
  type ClaimsEntra,
} from '@/lib/auth/entra-token'
import { hasPermission, MENSAJE_SIN_PERMISO, type Action } from '@/lib/auth/permissions'
import { rolDeSesion, ROL_DEMO, type Role } from '@/lib/auth/roles'
import type { CedisUser } from '@/types/cedis'

/** Header con el token de Fabric que el servidor solo reenvía, nunca lee. */
export const HEADER_TOKEN_FABRIC = 'x-fabric-token'

/** Cookie alterna para la identidad, si algún día se mueve fuera del header. */
export const COOKIE_ID_TOKEN = 'cedis_id_token'

export type CodigoAutorizacion = 'unauthorized' | 'forbidden'

export class ErrorAutorizacion extends Error {
  constructor(
    public readonly codigo: CodigoAutorizacion,
    /** Código HTTP con el que responde el Route Handler. */
    public readonly estado: 401 | 403,
    message: string,
  ) {
    super(message)
    this.name = 'ErrorAutorizacion'
  }
}

export interface SesionAutorizada {
  role: Role
  usuario: CedisUser
  claims: ClaimsEntra | null
  /** Token con audiencia de Fabric; es el que va en el Authorization de GraphQL. */
  tokenFabric: string
  /** true cuando Entra no está configurado y el server no pudo validar nada. */
  demo: boolean
}

function tokenIdentidad(request: Request): string | null {
  const autorizacion = request.headers.get('authorization')
  if (autorizacion?.toLowerCase().startsWith('bearer ')) {
    const valor = autorizacion.slice(7).trim()
    if (valor !== '') return valor
  }
  // Fallback por cookie: mismo contrato, distinto transporte.
  const cookies = request.headers.get('cookie') ?? ''
  const encontrada = cookies
    .split(';')
    .map((parte) => parte.trim())
    .find((parte) => parte.startsWith(`${COOKIE_ID_TOKEN}=`))
  if (encontrada) {
    const valor = decodeURIComponent(encontrada.slice(COOKIE_ID_TOKEN.length + 1))
    if (valor !== '') return valor
  }
  return null
}

function tokenFabric(request: Request): string {
  const token = request.headers.get(HEADER_TOKEN_FABRIC)?.trim()
  if (!token) {
    throw new ErrorAutorizacion(
      'unauthorized',
      401,
      'Falta el token de acceso para la API de Microsoft Fabric',
    )
  }
  return token
}

/**
 * Valida la sesión y exige el permiso de `action`.
 *
 * @returns La sesión autorizada, con el rol efectivo y el token que hay que
 * usar contra Fabric.
 * @throws {ErrorAutorizacion} 401 si no hay sesión válida, 403 si el rol no
 * tiene el permiso. Nunca devuelve un rol "por si acaso": un token que no se
 * puede verificar es un 401.
 */
export async function requirePermission(
  request: Request,
  action: Action,
): Promise<SesionAutorizada> {
  const fabric = tokenFabric(request)

  // Sin Entra configurado no hay firma que verificar ni claims que leer: el
  // server queda en el mismo modo demostración que la UI. No es un agujero
  // porque igual hace falta un token válido de Fabric para escribir algo, y
  // ese solo lo emite Entra.
  if (ENTRA_CLIENT_ID === '' || ENTRA_TENANT_ID === '') {
    if (!hasPermission(ROL_DEMO, action)) {
      throw new ErrorAutorizacion('forbidden', 403, MENSAJE_SIN_PERMISO)
    }
    return {
      role: ROL_DEMO,
      usuario: { name: 'Modo demostración', email: '', role: ROL_DEMO },
      claims: null,
      tokenFabric: fabric,
      demo: true,
    }
  }

  const identidad = tokenIdentidad(request)
  if (!identidad) {
    throw new ErrorAutorizacion('unauthorized', 401, 'No hay sesión: falta el ID token de Entra ID')
  }

  let claims: ClaimsEntra
  try {
    claims = await verificarIdToken(identidad)
  } catch (error) {
    console.error('[cedis] ID token rechazado —', error)
    throw new ErrorAutorizacion('unauthorized', 401, 'La sesión no es válida o expiró')
  }

  // Sesión real sin ningún app role asignado: se trata como Operador, el rol
  // más restrictivo. Nunca como Administrador.
  const role = rolDeSesion(claims.roles)

  if (!hasPermission(role, action)) {
    const { correo } = identidadDeClaims(claims)
    console.warn(`[cedis] 403 ${action}: ${correo || claims.sub} tiene ${role}`)
    throw new ErrorAutorizacion('forbidden', 403, MENSAJE_SIN_PERMISO)
  }

  const { nombre, correo } = identidadDeClaims(claims)
  return {
    role,
    usuario: { name: nombre, email: correo, role },
    claims,
    tokenFabric: fabric,
    demo: false,
  }
}

/**
 * Traduce el error del guard a la respuesta que espera el cliente.
 *
 * El cuerpo es `{ error: 'forbidden' }` / `{ error: 'unauthorized' }`; el
 * mensaje va aparte para que lib/actions.ts no tenga que adivinarlo.
 */
export function respuestaSinPermiso(error: ErrorAutorizacion): Response {
  return Response.json(
    { error: error.codigo, mensaje: error.message },
    { status: error.estado },
  )
}
