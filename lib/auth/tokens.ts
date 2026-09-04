// Los dos tokens que necesita una escritura.
//
// `fabric` es el access token con audiencia de Fabric —el único que la GraphQL
// API acepta— e `identidad` es el ID token, que es el que trae el claim
// `roles`: un access token emitido para un recurso de Microsoft nunca lleva los
// app roles de nuestra aplicación, así que no sirve para autorizar.
//
// El Route Handler (app/api/cedis/[operacion]/route.ts) valida `identidad`
// —firma incluida— para decidir permisos, y solo reenvía `fabric` a Fabric.
//
// Vive en su propio módulo porque lo comparten las dos orillas: el hook de MSAL
// que los adquiere y lib/actions.ts, que los manda en los headers.

export interface TokensCedis {
  identidad: string | null
  fabric: string | null
}

export const SIN_TOKENS: TokensCedis = { identidad: null, fabric: null }
