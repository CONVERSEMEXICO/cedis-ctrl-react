// Validación del ID token de Entra ID del lado del servidor.
//
// Se hace con Web Crypto (`crypto.subtle`, global en el runtime de Node de
// Next) y sin dependencias nuevas: son ~100 líneas y el proyecto no tiene
// linter ni suite de pruebas donde amortizar una librería más.
//
// Por qué el ID token y no el access token de Fabric: los App roles solo
// aparecen en tokens cuya audiencia es la propia aplicación. El access token
// que MSAL pide para Fabric tiene `aud` de Microsoft
// (https://analysis.windows.net/powerbi/api) y **no trae el claim `roles`**,
// así que no sirve para autorizar. El navegador manda entonces dos tokens: el
// ID token como identidad —que aquí se verifica firma incluida— y el token de
// Fabric, que solo se reenvía a Fabric y nunca se usa para decidir permisos.
//
// Verificar la firma es lo que hace que esto no sea teatro: un cliente puede
// mandar cualquier JSON, pero no puede firmarlo con la llave privada de Entra.

import { ENTRA_CLIENT_ID, ENTRA_TENANT_ID } from '@/lib/auth-config'

/** Margen de reloj entre Entra y el server, en segundos. */
const TOLERANCIA_RELOJ = 60

/** Vigencia del cache de llaves públicas. Entra las rota sin avisar. */
const TTL_JWKS_MS = 60 * 60 * 1000

export class ErrorTokenEntra extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErrorTokenEntra'
  }
}

/** Claims del ID token que le importan a la app. */
export interface ClaimsEntra {
  /** Identificador estable del usuario en el directorio. */
  oid?: string
  sub: string
  aud: string
  iss: string
  tid?: string
  exp: number
  nbf?: number
  name?: string
  preferred_username?: string
  upn?: string
  email?: string
  /** App roles asignados en Azure Portal; ausente si no hay ninguno. */
  roles?: string[] | string
}

interface JwkRsa {
  kty: string
  kid: string
  n: string
  e: string
  use?: string
}

// --- base64url -------------------------------------------------------------

function aBytes(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const relleno = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const binario = atob(relleno)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i)
  return bytes
}

function aJson<T>(base64url: string): T {
  return JSON.parse(new TextDecoder().decode(aBytes(base64url))) as T
}

// --- JWKS ------------------------------------------------------------------

let cache: { llaves: JwkRsa[]; vence: number } | null = null

async function traerJwks(): Promise<JwkRsa[]> {
  const url = `https://login.microsoftonline.com/${ENTRA_TENANT_ID}/discovery/v2.0/keys`
  const respuesta = await fetch(url, { cache: 'no-store' })
  if (!respuesta.ok) {
    throw new ErrorTokenEntra(`No se pudieron leer las llaves públicas de Entra ID (${respuesta.status})`)
  }
  const json = (await respuesta.json()) as { keys?: JwkRsa[] }
  const llaves = (json.keys ?? []).filter((llave) => llave.kty === 'RSA' && llave.n && llave.e)
  if (llaves.length === 0) {
    throw new ErrorTokenEntra('Entra ID no devolvió ninguna llave RSA utilizable')
  }
  cache = { llaves, vence: Date.now() + TTL_JWKS_MS }
  return llaves
}

/**
 * Llave pública correspondiente al `kid` del token.
 *
 * Un `kid` desconocido fuerza un refetch aunque el cache siga vigente: es la
 * señal de que Entra rotó las llaves antes de que expirara el TTL.
 */
async function llavePorKid(kid: string): Promise<JwkRsa> {
  if (cache && cache.vence > Date.now()) {
    const enCache = cache.llaves.find((llave) => llave.kid === kid)
    if (enCache) return enCache
  }
  const llaves = await traerJwks()
  const llave = llaves.find((l) => l.kid === kid)
  if (!llave) {
    throw new ErrorTokenEntra(`El token viene firmado con una llave desconocida (kid ${kid})`)
  }
  return llave
}

async function firmaValida(jwk: JwkRsa, firmado: string, firma: Uint8Array): Promise<boolean> {
  const llave = await crypto.subtle.importKey(
    'jwk',
    { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  return crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    llave,
    firma as unknown as BufferSource,
    new TextEncoder().encode(firmado) as unknown as BufferSource,
  )
}

// --- Verificación ----------------------------------------------------------

/**
 * Verifica un ID token de Entra ID y devuelve sus claims.
 *
 * Comprueba, en este orden: formato, algoritmo (solo RS256 — nunca `none`),
 * firma contra el JWKS del tenant, emisor, audiencia, tenant y vigencia.
 *
 * @throws {ErrorTokenEntra} Si cualquiera de esas comprobaciones falla.
 */
export async function verificarIdToken(token: string): Promise<ClaimsEntra> {
  if (ENTRA_CLIENT_ID === '' || ENTRA_TENANT_ID === '') {
    throw new ErrorTokenEntra('Entra ID no está configurado en este entorno: no hay token que validar')
  }

  const partes = token.split('.')
  if (partes.length !== 3) {
    throw new ErrorTokenEntra('El token no tiene el formato de un JWT')
  }
  const [cabeceraB64, cargaB64, firmaB64] = partes

  let cabecera: { alg?: string; kid?: string }
  let claims: ClaimsEntra
  try {
    cabecera = aJson(cabeceraB64)
    claims = aJson(cargaB64)
  } catch {
    throw new ErrorTokenEntra('El token no se pudo decodificar')
  }

  // `alg` se valida antes de mirar la firma: aceptar el algoritmo que declara
  // el propio token es la vía clásica para colarse con `none` o con HS256.
  if (cabecera.alg !== 'RS256') {
    throw new ErrorTokenEntra(`Algoritmo de firma no aceptado: ${cabecera.alg ?? 'ausente'}`)
  }
  if (!cabecera.kid) {
    throw new ErrorTokenEntra('El token no declara el kid de la llave que lo firmó')
  }

  const jwk = await llavePorKid(cabecera.kid)
  const valida = await firmaValida(jwk, `${cabeceraB64}.${cargaB64}`, aBytes(firmaB64))
  if (!valida) {
    throw new ErrorTokenEntra('La firma del token no es válida')
  }

  const emisorEsperado = `https://login.microsoftonline.com/${ENTRA_TENANT_ID}/v2.0`
  if (claims.iss !== emisorEsperado) {
    throw new ErrorTokenEntra(`Emisor inesperado: ${claims.iss}`)
  }
  if (claims.aud !== ENTRA_CLIENT_ID) {
    throw new ErrorTokenEntra('El token fue emitido para otra aplicación')
  }
  if (claims.tid && claims.tid !== ENTRA_TENANT_ID) {
    throw new ErrorTokenEntra('El token pertenece a otro tenant')
  }

  const ahora = Math.floor(Date.now() / 1000)
  if (typeof claims.exp !== 'number' || claims.exp + TOLERANCIA_RELOJ < ahora) {
    throw new ErrorTokenEntra('El token expiró')
  }
  if (typeof claims.nbf === 'number' && claims.nbf - TOLERANCIA_RELOJ > ahora) {
    throw new ErrorTokenEntra('El token todavía no es válido')
  }

  return claims
}

/** Nombre y correo del usuario tal como los publica Entra ID. */
export function identidadDeClaims(claims: ClaimsEntra): { nombre: string; correo: string } {
  const correo = claims.preferred_username ?? claims.upn ?? claims.email ?? ''
  return { nombre: claims.name ?? correo, correo }
}
