// Cliente genérico para la GraphQL API de Microsoft Fabric SQL Database.
//
// La petición sale del navegador con el token que MSAL obtuvo de Entra ID
// (ver hooks/use-fabric-auth.ts): el token es del usuario, no de la app, así
// que quien llama tiene que pasarlo explícitamente. Sin token no se intenta la
// petición y el llamador cae al respaldo seed.
//
// Fabric limita la tasa de peticiones y responde 429 con una ventana de
// bloqueo ("blocked by the upstream service until: …"). Seguir mandando
// peticiones dentro de esa ventana no solo se desperdicia: alarga el castigo.
// Por eso este módulo lleva un cortacircuitos —`bloqueadoHasta`— que corta en
// seco, sin tocar la red, hasta que la ventana pasa.

const FABRIC_GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_FABRIC_GRAPHQL_ENDPOINT ?? ''

/** Espera por defecto cuando el 429 no dice hasta cuándo dura el bloqueo. */
const ESPERA_POR_DEFECTO_MS = 60_000

/** Tope de espera: más allá de esto conviene reintentar y ver qué dice Fabric. */
const ESPERA_MAXIMA_MS = 10 * 60_000

export class GraphQLRequestError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly graphQLErrors?: unknown[],
    /** 401 de Fabric: el token venció o se revocó, hay que volver a entrar. */
    public readonly sesionExpirada = false,
    /** 429 de Fabric: se excedió la tasa de peticiones. */
    public readonly limiteExcedido = false,
    /** Momento en que expira el bloqueo, cuando Fabric lo informa. */
    public readonly reintentarEn?: Date,
  ) {
    super(message)
    this.name = 'GraphQLRequestError'
  }
}

/** Mensaje único de sesión vencida, igual en toda la app. */
export const MENSAJE_SESION_EXPIRADA = 'Tu sesión expiró, vuelve a iniciar sesión'

export function esSesionExpirada(error: unknown): boolean {
  return error instanceof GraphQLRequestError && error.sesionExpirada
}

export function esLimiteExcedido(error: unknown): boolean {
  return error instanceof GraphQLRequestError && error.limiteExcedido
}

// --- Cortacircuitos de tasa -------------------------------------------------

let bloqueadoHasta = 0

/** Milisegundos que faltan para que Fabric vuelva a aceptar peticiones. */
export function esperaRestanteMs(): number {
  return Math.max(0, bloqueadoHasta - Date.now())
}

function formatearEspera(ms: number): string {
  const segundos = Math.ceil(ms / 1000)
  if (segundos < 60) return `${segundos} s`
  return `${Math.ceil(segundos / 60)} min`
}

export function mensajeLimiteExcedido(ms = esperaRestanteMs()): string {
  if (ms <= 0) return 'Microsoft Fabric está limitando las peticiones. Espera un momento.'
  return `Microsoft Fabric está limitando las peticiones. Reintenta en ${formatearEspera(ms)}.`
}

/**
 * Hasta cuándo dura el bloqueo, según lo que informe Fabric.
 *
 * Prefiere `Retry-After` (el header estándar, en segundos o como fecha HTTP) y
 * cae al texto del cuerpo, que trae la fecha en formato de .NET:
 * `"Request is blocked by the upstream service until: 8/31/2026 6:24:38 PM (UTC)"`.
 */
function calcularBloqueo(respuesta: Response, cuerpo: string): number {
  const retryAfter = respuesta.headers.get('retry-after')
  if (retryAfter) {
    const segundos = Number(retryAfter)
    if (Number.isFinite(segundos) && segundos > 0) return Date.now() + segundos * 1000
    const fecha = Date.parse(retryAfter)
    if (!Number.isNaN(fecha)) return fecha
  }

  // `until: M/D/YYYY h:mm:ss AM|PM (UTC)`. Se arma con Date.UTC en vez de
  // Date.parse porque esa cadena, sin zona, se interpretaría como hora local.
  const m = cuerpo.match(
    /until:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})(?:\s*(AM|PM))?/i,
  )
  if (m) {
    const [, mes, dia, anio, hora, minuto, segundo, meridiano] = m
    let h = Number(hora)
    if (meridiano) {
      const pm = meridiano.toUpperCase() === 'PM'
      if (pm && h !== 12) h += 12
      if (!pm && h === 12) h = 0
    }
    const utc = Date.UTC(Number(anio), Number(mes) - 1, Number(dia), h, Number(minuto), Number(segundo))
    if (!Number.isNaN(utc) && utc > Date.now()) return Math.min(utc, Date.now() + ESPERA_MAXIMA_MS)
  }

  return Date.now() + ESPERA_POR_DEFECTO_MS
}

function errorDeLimite(hasta: number): GraphQLRequestError {
  return new GraphQLRequestError(
    mensajeLimiteExcedido(hasta - Date.now()),
    429,
    undefined,
    false,
    true,
    new Date(hasta),
  )
}

// --- Ejecución --------------------------------------------------------------

export interface RespuestaGraphQL<T> {
  data?: T
  errors?: { message: string; path?: (string | number)[] }[]
}

/**
 * Ejecuta una operación y devuelve la respuesta cruda, **sin lanzar** cuando
 * Fabric responde errores junto con datos parciales.
 *
 * Es lo que necesita la consulta agrupada de lib/data.ts: si una sola tabla
 * falla, las otras cuatro siguen siendo válidas y no tiene sentido tirarlas.
 * Los fallos de transporte —sin token, 401, 429, HTTP roto— sí lanzan: ahí no
 * hay datos parciales que rescatar.
 *
 * @throws {GraphQLRequestError} Sin token, sin endpoint, con la ventana de
 * bloqueo abierta, o si Fabric responde 401/429/HTTP de error.
 */
export async function ejecutarGraphQL<
  T,
  V extends Record<string, unknown> = Record<string, unknown>,
>(query: string, variables: V | undefined, accessToken: string | null): Promise<RespuestaGraphQL<T>> {
  if (!accessToken) {
    throw new GraphQLRequestError('No autenticado. Usando datos de respaldo (seed-data).')
  }

  if (!FABRIC_GRAPHQL_ENDPOINT) {
    throw new GraphQLRequestError(
      'NEXT_PUBLIC_FABRIC_GRAPHQL_ENDPOINT no está configurado. Usando datos de respaldo (seed-data).',
    )
  }

  // Cortacircuitos: dentro de la ventana de bloqueo no se toca la red.
  if (esperaRestanteMs() > 0) {
    throw errorDeLimite(bloqueadoHasta)
  }

  let response: Response
  try {
    response = await fetch(FABRIC_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
    })
  } catch (error) {
    throw new GraphQLRequestError(
      `No se pudo conectar con la API de Microsoft Fabric: ${(error as Error).message}`,
    )
  }

  if (response.status === 401) {
    throw new GraphQLRequestError(MENSAJE_SESION_EXPIRADA, 401, undefined, true)
  }

  if (response.status === 429) {
    const cuerpo = await response.text().catch(() => '')
    bloqueadoHasta = calcularBloqueo(response, cuerpo)
    console.warn(
      `[cedis] Fabric respondió 429; no se enviarán peticiones hasta ${new Date(bloqueadoHasta).toISOString()}`,
    )
    throw errorDeLimite(bloqueadoHasta)
  }

  if (!response.ok) {
    throw new GraphQLRequestError(
      `La API de Microsoft Fabric respondió con un error HTTP ${response.status}`,
      response.status,
    )
  }

  // Una respuesta correcta cierra cualquier ventana de bloqueo que siguiera
  // marcada: Fabric ya está aceptando peticiones otra vez.
  bloqueadoHasta = 0

  return (await response.json()) as RespuestaGraphQL<T>
}

/**
 * Ejecuta una query o mutation contra la GraphQL API de Microsoft Fabric SQL
 * Database.
 *
 * @param query - Documento GraphQL (query o mutation).
 * @param variables - Variables de la operación.
 * @param accessToken - Token de Entra ID; null si no hay sesión.
 * @returns Los datos tipados de la respuesta.
 * @throws {GraphQLRequestError} Si no hay token, la petición falla o la API
 * regresa errores. Con `sesionExpirada` en true cuando Fabric responde 401 y
 * `limiteExcedido` en true cuando responde 429.
 */
export async function fetchGraphQL<T, V extends Record<string, unknown> = Record<string, unknown>>(
  query: string,
  variables: V | undefined,
  accessToken: string | null,
): Promise<T> {
  const json = await ejecutarGraphQL<T, V>(query, variables, accessToken)

  if (json.errors?.length) {
    throw new GraphQLRequestError(json.errors.map((e) => e.message).join('; '), 200, json.errors)
  }

  if (json.data === undefined) {
    throw new GraphQLRequestError('La respuesta de la API no contiene datos.')
  }

  return json.data
}
