// Cliente genérico para la GraphQL API de Microsoft Fabric SQL Database.
//
// La petición sale del navegador con el token que MSAL obtuvo de Entra ID
// (ver hooks/use-fabric-auth.ts): el token es del usuario, no de la app, así
// que quien llama tiene que pasarlo explícitamente. Sin token no se intenta la
// petición y el llamador cae al respaldo seed.

const FABRIC_GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_FABRIC_GRAPHQL_ENDPOINT ?? ''

export class GraphQLRequestError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly graphQLErrors?: unknown[],
    /** 401 de Fabric: el token venció o se revocó, hay que volver a entrar. */
    public readonly sesionExpirada = false,
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

interface GraphQLResponse<T> {
  data?: T
  errors?: { message: string; path?: (string | number)[] }[]
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
 * regresa errores. Con `sesionExpirada` en true cuando Fabric responde 401.
 */
export async function fetchGraphQL<T, V extends Record<string, unknown> = Record<string, unknown>>(
  query: string,
  variables: V | undefined,
  accessToken: string | null,
): Promise<T> {
  if (!accessToken) {
    throw new GraphQLRequestError('No autenticado. Usando datos de respaldo (seed-data).')
  }

  if (!FABRIC_GRAPHQL_ENDPOINT) {
    throw new GraphQLRequestError(
      'NEXT_PUBLIC_FABRIC_GRAPHQL_ENDPOINT no está configurado. Usando datos de respaldo (seed-data).',
    )
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

  if (!response.ok) {
    throw new GraphQLRequestError(
      `La API de Microsoft Fabric respondió con un error HTTP ${response.status}`,
      response.status,
    )
  }

  const json = (await response.json()) as GraphQLResponse<T>

  if (json.errors?.length) {
    throw new GraphQLRequestError(
      json.errors.map((e) => e.message).join('; '),
      response.status,
      json.errors,
    )
  }

  if (json.data === undefined) {
    throw new GraphQLRequestError('La respuesta de la API no contiene datos.')
  }

  return json.data
}
