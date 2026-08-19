// Cliente genérico para la GraphQL API de Microsoft Fabric SQL Database.
// El endpoint y el token son placeholders — se configuran como variables de entorno.

const FABRIC_GRAPHQL_ENDPOINT = process.env.FABRIC_GRAPHQL_ENDPOINT ?? ''
const FABRIC_AUTH_TOKEN = process.env.FABRIC_AUTH_TOKEN ?? ''

export class GraphQLRequestError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly graphQLErrors?: unknown[],
  ) {
    super(message)
    this.name = 'GraphQLRequestError'
  }
}

interface GraphQLResponse<T> {
  data?: T
  errors?: { message: string; path?: (string | number)[] }[]
}

/**
 * Ejecuta una query o mutation contra la GraphQL API de Microsoft Fabric SQL Database.
 *
 * @param query - Documento GraphQL (query o mutation).
 * @param variables - Variables de la operación.
 * @returns Los datos tipados de la respuesta.
 * @throws {GraphQLRequestError} Si la petición falla o la API regresa errores.
 */
export async function fetchGraphQL<T, V extends Record<string, unknown> = Record<string, unknown>>(
  query: string,
  variables?: V,
): Promise<T> {
  if (!FABRIC_GRAPHQL_ENDPOINT) {
    throw new GraphQLRequestError(
      'FABRIC_GRAPHQL_ENDPOINT no está configurado. Usando datos de respaldo (seed-data).',
    )
  }

  let response: Response
  try {
    response = await fetch(FABRIC_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${FABRIC_AUTH_TOKEN}`,
      },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
    })
  } catch (error) {
    throw new GraphQLRequestError(
      `No se pudo conectar con la API de Microsoft Fabric: ${(error as Error).message}`,
    )
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
