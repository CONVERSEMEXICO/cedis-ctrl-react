# Scripts SQL — mutaciones de la API for GraphQL (Microsoft Fabric)

En Fabric, la API for GraphQL sobre una **SQL Database** genera automáticamente las
*queries* de cada tabla que expones, pero **las mutaciones de escritura del panel se
resuelven con stored procedures**: cada SP expuesto aparece como una mutación
`execute<NombreDelSP>` que devuelve `DbOperationResult { result: String }`, donde
`result` es el **primer result set serializado como JSON**.

Por eso cada SP de aquí termina con **un solo `SELECT`** de la fila afectada: ese
`SELECT` es la carga útil que recibe [lib/queries.ts](../lib/queries.ts).

## Orden de ejecución

| # | Script | Qué hace |
|---|---|---|
| 00 | [00_ajustes_esquema.sql](00_ajustes_esquema.sql) | Columnas faltantes (`etiquetado.motivo_rechazo`, `incidencias.fecha_resolucion`), secuencia de folios y `CHECK` de dominio. Idempotente. |
| 01 | [01_sp_embarques.sql](01_sp_embarques.sql) | `dbo.ActualizarEstadoEmbarque` |
| 02 | [02_sp_recepciones.sql](02_sp_recepciones.sql) | `dbo.ActualizarEstadoRecepcion` |
| 03 | [03_sp_surtido.sql](03_sp_surtido.sql) | `dbo.ActualizarEstadoSurtido` |
| 04 | [04_sp_etiquetado.sql](04_sp_etiquetado.sql) | `dbo.ActualizarEstadoEtiquetado` |
| 05 | [05_sp_incidencias.sql](05_sp_incidencias.sql) | `dbo.CrearIncidencia`, `dbo.ActualizarEstadoIncidencia` |
| 06 | [06_sp_productividad.sql](06_sp_productividad.sql) | `dbo.RegistrarProductividad` |
| 07 | [07_permisos.sql](07_permisos.sql) | `GRANT SELECT` / `GRANT EXECUTE` a la identidad de la API |

Ejecútalos en el editor SQL de la Fabric SQL Database (o con `sqlcmd` / Azure Data
Studio contra la cadena de conexión del *SQL analytics endpoint* de escritura).

Después de correrlos: **Fabric > tu API for GraphQL > Manage data**, marca los SPs
nuevos y las columnas agregadas, y guarda. Los objetos no aparecen en el esquema
hasta que se re-exponen.

## Mapa mutación ↔ stored procedure

| `lib/queries.ts` | Stored procedure | Mutación GraphQL |
|---|---|---|
| `actualizarEstadoEmbarque(id, estado)` | `dbo.ActualizarEstadoEmbarque` | `executeActualizarEstadoEmbarque` |
| `actualizarEstadoRecepcion(id, estado)` | `dbo.ActualizarEstadoRecepcion` | `executeActualizarEstadoRecepcion` |
| `actualizarEstadoSurtido(id, estado)` | `dbo.ActualizarEstadoSurtido` | `executeActualizarEstadoSurtido` |
| `actualizarEstadoEtiquetado(id, estado, motivoRechazo?)` | `dbo.ActualizarEstadoEtiquetado` | `executeActualizarEstadoEtiquetado` |
| `crearIncidencia(input)` | `dbo.CrearIncidencia` | `executeCrearIncidencia` |
| `actualizarEstadoIncidencia(id, estado)` | `dbo.ActualizarEstadoIncidencia` | `executeActualizarEstadoIncidencia` |
| `registrarProductividad(input)` | `dbo.RegistrarProductividad` | `executeRegistrarProductividad` |

> El nombre exacto que genera Fabric (`execute` + nombre del SP) hay que confirmarlo
> en el *schema explorer* de la API antes de escribir el documento GraphQL.

Los parámetros del SP se vuelven argumentos de la mutación **sin la `@`**, así que
los nombres están en `camelCase` (`@motivoRechazo` → `motivoRechazo`) para que
coincidan con las firmas de `lib/queries.ts`. Los parámetros con `= NULL` son
argumentos opcionales.

## Ejemplos de documento GraphQL

```graphql
mutation ActualizarEstadoEmbarque($id: String!, $estado: String!) {
  executeActualizarEstadoEmbarque(id: $id, estado: $estado) {
    result
  }
}

mutation CrearIncidencia(
  $tipo: String!
  $severidad: String!
  $modulo: String!
  $descripcion: String!
  $responsable: String!
) {
  executeCrearIncidencia(
    tipo: $tipo
    severidad: $severidad
    modulo: $modulo
    descripcion: $descripcion
    responsable: $responsable
  ) {
    result
  }
}
```

`result` llega como string JSON con un arreglo de una fila:

```json
"[{\"id\":\"inc-42\",\"folio\":\"INC-5514\",\"estado\":\"abierta\", ...}]"
```

Del lado del cliente hay que parsearlo y mapear `snake_case` → el tipo de
[types/cedis.ts](../types/cedis.ts). Conviene un helper único en `lib/queries.ts`:

```ts
function primeraFila<T>(result: string): T {
  const filas = JSON.parse(result) as T[]
  if (!filas?.length) throw new GraphQLRequestError('La mutación no devolvió filas.')
  return filas[0]
}
```

## Errores

Cada SP valida antes de escribir y lanza `THROW` con número propio:

| Número | Significado |
|---|---|
| 50001 | Falta el `id`. |
| 50010 | Estado fuera del dominio del módulo. |
| 50011 | Surtido a `surtiendo` sin operador asignado. |
| 50012 | Lote `rechazado` sin motivo de rechazo. |
| 50013–50019, 50021–50023 | Validaciones de `CrearIncidencia` y `RegistrarProductividad`. |
| 50020 | El registro no existe. |

Fabric los devuelve en el arreglo `errors` de la respuesta, así que llegan como
`GraphQLRequestError` a [lib/graphql.ts](../lib/graphql.ts) — y `withFallback()` en
[lib/data.ts](../lib/data.ts) los convierte silenciosamente en datos seed. **Las
mutaciones no deberían pasar por `withFallback()`**: un alta que falla no puede
verse como éxito.

## Diferencias entre el esquema real y `types/cedis.ts`

Los SPs están escritos contra las columnas que **hoy existen** en la base (las del
`.graphql` exportado), no contra el dominio de `types/cedis.ts`. Faltan columnas que
la UI ya usa:

- `embarques`: no hay `cliente`, `anden`, `responsable`, `fecha_programada`,
  `fecha_salida` (solo `hora_salida`, texto) ni `fecha_entrega_estimada`.
- `recepciones`: no hay `transportista`, `unidades_esperadas` /
  `unidades_recibidas` (solo `unidades`), `fecha_programada`, `responsable`,
  `tiene_discrepancia`.
- `surtido`: `pedido` vs `folio`, no hay `unidades_totales` / `unidades_surtidas`,
  `zona`, `responsable`, `fecha_limite`.
- `etiquetado`: `lote`/`producto` vs `folio`/`cliente`, no hay `tipo_etiqueta`
  ni `fecha_proceso`.
- `productividad`: guarda `unidades` + `horas` + `meta`; la UI espera
  `unidadesPorHora` y `metaUnidadesPorHora` (se derivan: `unidades / horas`).

Mientras eso no se alinee, las mutaciones funcionan pero las páginas seguirán
necesitando un mapeo explícito. Alinear el esquema es un cambio aparte.
