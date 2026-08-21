// Queries y mutations contra la GraphQL API de Microsoft Fabric SQL Database.
//
// Toda operación recibe como primer argumento el token de Entra ID que MSAL
// obtuvo en el navegador (ver hooks/use-fabric-auth.ts). Con token null la
// petición no sale y lib/data.ts cae al respaldo seed.
//
// Convenciones del esquema que genera Fabric y que hay que respetar tal cual:
//   - Toda query devuelve un Connection: { items, endCursor, hasNextPage }.
//   - La pluralización la decide Fabric: `surtidos`, `etiquetados`,
//     `productividads`, pero los *Input* conservan el nombre de la tabla
//     (`surtidoFilterInput`, `etiquetadoOrderByInput`, …).
//   - Los cambios de estado NO usan las mutations update genéricas: van por
//     stored procedure (`executeActualizarEstado*`), que valida el dominio del
//     estado y sella `updated_at`. Ver sql/01..06.
//   - En las altas, `id`, `created_at` y `updated_at` los pone el server.

import { fetchGraphQL } from '@/lib/graphql'
import type {
  Embarque,
  EstadoEmbarque,
  EstadoEtiquetado,
  EstadoIncidencia,
  EstadoRecepcion,
  EstadoSurtido,
  Incidencia,
  LoteEtiquetado,
  PedidoSurtido,
  Prioridad,
  Recepcion,
  RegistroProductividad,
  Severidad,
  TipoIncidencia,
  Turno,
} from '@/types/cedis'

/** Página de resultados que devuelve cualquier query de Fabric. */
interface Conexion<T> {
  items: T[]
  hasNextPage: boolean
  endCursor: string | null
}

/** Token de acceso de Entra ID; null cuando no hay sesión. */
type Token = string | null

/** Tope de registros por consulta: la operación diaria del CEDIS cabe de sobra. */
const LIMITE = 100

const CAMPOS_EMBARQUE =
  'id folio destino transportista unidades hora_salida estado created_at updated_at'
const CAMPOS_RECEPCION = 'id folio proveedor anden unidades tipo estado created_at updated_at'
const CAMPOS_SURTIDO = 'id pedido cliente lineas operador prioridad estado created_at updated_at'
const CAMPOS_ETIQUETADO =
  'id lote producto unidades operador estado motivo_rechazo created_at updated_at'
const CAMPOS_PRODUCTIVIDAD = 'id operador area turno unidades horas meta created_at'

/** `filter: null` trae todos los registros; con estado filtra en el server. */
function filtroEstado(estado?: string) {
  return estado ? { estado: { eq: estado } } : null
}

const ORDEN_RECIENTE = { created_at: 'DESC' }

// ---------------------------------------------------------------------------
// Embarques
// ---------------------------------------------------------------------------

export interface CrearEmbarqueInput {
  folio: string
  destino: string
  transportista: string
  unidades?: number | null
  hora_salida?: string | null
  estado?: EstadoEmbarque
}

export async function getEmbarques(token: Token, estado?: EstadoEmbarque): Promise<Embarque[]> {
  const QUERY = /* GraphQL */ `
    query GetEmbarques($filter: embarquesFilterInput, $orderBy: embarquesOrderByInput) {
      embarques(first: ${LIMITE}, filter: $filter, orderBy: $orderBy) {
        items { ${CAMPOS_EMBARQUE} }
        hasNextPage
        endCursor
      }
    }
  `
  const datos = await fetchGraphQL<{ embarques: Conexion<Embarque> }>(
    QUERY,
    { filter: filtroEstado(estado), orderBy: ORDEN_RECIENTE },
    token,
  )
  return datos.embarques.items
}

export async function crearEmbarque(token: Token, item: CrearEmbarqueInput): Promise<Embarque> {
  const MUTATION = /* GraphQL */ `
    mutation CrearEmbarque($item: CreateembarquesInput!) {
      createembarques(item: $item) { ${CAMPOS_EMBARQUE} }
    }
  `
  const datos = await fetchGraphQL<{ createembarques: Embarque }>(MUTATION, { item }, token)
  return datos.createembarques
}

export async function actualizarEstadoEmbarque(
  token: Token,
  id: string,
  estado: EstadoEmbarque,
): Promise<Embarque | null> {
  const MUTATION = /* GraphQL */ `
    mutation ActualizarEstadoEmbarque($id: String, $estado: String) {
      executeActualizarEstadoEmbarque(id: $id, estado: $estado) { ${CAMPOS_EMBARQUE} }
    }
  `
  const datos = await fetchGraphQL<{ executeActualizarEstadoEmbarque: Embarque[] }>(
    MUTATION,
    { id, estado },
    token,
  )
  return datos.executeActualizarEstadoEmbarque[0] ?? null
}

export async function eliminarEmbarque(token: Token, id: string): Promise<void> {
  const MUTATION = /* GraphQL */ `
    mutation EliminarEmbarque($id: String!) {
      deleteembarques(id: $id) { id }
    }
  `
  await fetchGraphQL<{ deleteembarques: { id: string } | null }>(MUTATION, { id }, token)
}

// ---------------------------------------------------------------------------
// Recepciones
// ---------------------------------------------------------------------------

export interface CrearRecepcionInput {
  folio: string
  proveedor: string
  anden?: string | null
  unidades?: number | null
  tipo?: string | null
  estado?: EstadoRecepcion
}

export async function getRecepciones(token: Token, estado?: EstadoRecepcion): Promise<Recepcion[]> {
  const QUERY = /* GraphQL */ `
    query GetRecepciones($filter: recepcionesFilterInput, $orderBy: recepcionesOrderByInput) {
      recepciones(first: ${LIMITE}, filter: $filter, orderBy: $orderBy) {
        items { ${CAMPOS_RECEPCION} }
        hasNextPage
        endCursor
      }
    }
  `
  const datos = await fetchGraphQL<{ recepciones: Conexion<Recepcion> }>(
    QUERY,
    { filter: filtroEstado(estado), orderBy: ORDEN_RECIENTE },
    token,
  )
  return datos.recepciones.items
}

export async function crearRecepcion(token: Token, item: CrearRecepcionInput): Promise<Recepcion> {
  const MUTATION = /* GraphQL */ `
    mutation CrearRecepcion($item: CreaterecepcionesInput!) {
      createrecepciones(item: $item) { ${CAMPOS_RECEPCION} }
    }
  `
  const datos = await fetchGraphQL<{ createrecepciones: Recepcion }>(MUTATION, { item }, token)
  return datos.createrecepciones
}

export async function actualizarEstadoRecepcion(
  token: Token,
  id: string,
  estado: EstadoRecepcion,
  anden?: string | null,
): Promise<Recepcion | null> {
  const MUTATION = /* GraphQL */ `
    mutation ActualizarEstadoRecepcion($id: String, $estado: String, $anden: String) {
      executeActualizarEstadoRecepcion(id: $id, estado: $estado, anden: $anden) {
        ${CAMPOS_RECEPCION}
      }
    }
  `
  const datos = await fetchGraphQL<{ executeActualizarEstadoRecepcion: Recepcion[] }>(
    MUTATION,
    { id, estado, anden: anden ?? null },
    token,
  )
  return datos.executeActualizarEstadoRecepcion[0] ?? null
}

export async function eliminarRecepcion(token: Token, id: string): Promise<void> {
  const MUTATION = /* GraphQL */ `
    mutation EliminarRecepcion($id: String!) {
      deleterecepciones(id: $id) { id }
    }
  `
  await fetchGraphQL<{ deleterecepciones: { id: string } | null }>(MUTATION, { id }, token)
}

// ---------------------------------------------------------------------------
// Surtido  (query `surtidos`, inputs `surtido*`)
// ---------------------------------------------------------------------------

export interface CrearSurtidoInput {
  pedido: string
  cliente: string
  lineas?: number | null
  operador?: string | null
  prioridad?: Prioridad
  estado?: EstadoSurtido
}

export async function getPedidosSurtido(
  token: Token,
  estado?: EstadoSurtido,
): Promise<PedidoSurtido[]> {
  const QUERY = /* GraphQL */ `
    query GetSurtidos($filter: surtidoFilterInput, $orderBy: surtidoOrderByInput) {
      surtidos(first: ${LIMITE}, filter: $filter, orderBy: $orderBy) {
        items { ${CAMPOS_SURTIDO} }
        hasNextPage
        endCursor
      }
    }
  `
  const datos = await fetchGraphQL<{ surtidos: Conexion<PedidoSurtido> }>(
    QUERY,
    { filter: filtroEstado(estado), orderBy: ORDEN_RECIENTE },
    token,
  )
  return datos.surtidos.items
}

export async function crearPedidoSurtido(
  token: Token,
  item: CrearSurtidoInput,
): Promise<PedidoSurtido> {
  const MUTATION = /* GraphQL */ `
    mutation CrearSurtido($item: CreatesurtidoInput!) {
      createsurtido(item: $item) { ${CAMPOS_SURTIDO} }
    }
  `
  const datos = await fetchGraphQL<{ createsurtido: PedidoSurtido }>(MUTATION, { item }, token)
  return datos.createsurtido
}

export async function actualizarEstadoSurtido(
  token: Token,
  id: string,
  estado: EstadoSurtido,
  operador?: string | null,
): Promise<PedidoSurtido | null> {
  const MUTATION = /* GraphQL */ `
    mutation ActualizarEstadoSurtido($id: String, $estado: String, $operador: String) {
      executeActualizarEstadoSurtido(id: $id, estado: $estado, operador: $operador) {
        ${CAMPOS_SURTIDO}
      }
    }
  `
  const datos = await fetchGraphQL<{ executeActualizarEstadoSurtido: PedidoSurtido[] }>(
    MUTATION,
    { id, estado, operador: operador ?? null },
    token,
  )
  return datos.executeActualizarEstadoSurtido[0] ?? null
}

export async function eliminarPedidoSurtido(token: Token, id: string): Promise<void> {
  const MUTATION = /* GraphQL */ `
    mutation EliminarSurtido($id: String!) {
      deletesurtido(id: $id) { id }
    }
  `
  await fetchGraphQL<{ deletesurtido: { id: string } | null }>(MUTATION, { id }, token)
}

// ---------------------------------------------------------------------------
// Etiquetado  (query `etiquetados`, inputs `etiquetado*`)
// ---------------------------------------------------------------------------

export interface CrearEtiquetadoInput {
  lote: string
  producto: string
  unidades?: number | null
  operador?: string | null
  estado?: EstadoEtiquetado
  motivo_rechazo?: string | null
}

export async function getLotesEtiquetado(
  token: Token,
  estado?: EstadoEtiquetado,
): Promise<LoteEtiquetado[]> {
  const QUERY = /* GraphQL */ `
    query GetEtiquetados($filter: etiquetadoFilterInput, $orderBy: etiquetadoOrderByInput) {
      etiquetados(first: ${LIMITE}, filter: $filter, orderBy: $orderBy) {
        items { ${CAMPOS_ETIQUETADO} }
        hasNextPage
        endCursor
      }
    }
  `
  const datos = await fetchGraphQL<{ etiquetados: Conexion<LoteEtiquetado> }>(
    QUERY,
    { filter: filtroEstado(estado), orderBy: ORDEN_RECIENTE },
    token,
  )
  return datos.etiquetados.items
}

export async function crearLoteEtiquetado(
  token: Token,
  item: CrearEtiquetadoInput,
): Promise<LoteEtiquetado> {
  const MUTATION = /* GraphQL */ `
    mutation CrearEtiquetado($item: CreateetiquetadoInput!) {
      createetiquetado(item: $item) { ${CAMPOS_ETIQUETADO} }
    }
  `
  const datos = await fetchGraphQL<{ createetiquetado: LoteEtiquetado }>(MUTATION, { item }, token)
  return datos.createetiquetado
}

export async function actualizarEstadoEtiquetado(
  token: Token,
  id: string,
  estado: EstadoEtiquetado,
  motivoRechazo?: string | null,
): Promise<LoteEtiquetado | null> {
  const MUTATION = /* GraphQL */ `
    mutation ActualizarEstadoEtiquetado($id: String, $estado: String, $motivoRechazo: String) {
      executeActualizarEstadoEtiquetado(id: $id, estado: $estado, motivoRechazo: $motivoRechazo) {
        ${CAMPOS_ETIQUETADO}
      }
    }
  `
  const datos = await fetchGraphQL<{ executeActualizarEstadoEtiquetado: LoteEtiquetado[] }>(
    MUTATION,
    { id, estado, motivoRechazo: motivoRechazo ?? null },
    token,
  )
  return datos.executeActualizarEstadoEtiquetado[0] ?? null
}

export async function eliminarLoteEtiquetado(token: Token, id: string): Promise<void> {
  const MUTATION = /* GraphQL */ `
    mutation EliminarEtiquetado($id: String!) {
      deleteetiquetado(id: $id) { id }
    }
  `
  await fetchGraphQL<{ deleteetiquetado: { id: string } | null }>(MUTATION, { id }, token)
}

// ---------------------------------------------------------------------------
// Productividad
// ---------------------------------------------------------------------------

/** `horas` es Decimal en el esquema: GraphQL puede serializarlo como string. */
type RegistroProductividadApi = Omit<RegistroProductividad, 'horas'> & { horas: number | string }

function aRegistroProductividad(registro: RegistroProductividadApi): RegistroProductividad {
  return { ...registro, horas: Number(registro.horas) }
}

export interface RegistrarProductividadInput {
  id: string
  operador: string
  area: string
  turno: Turno
  unidades: number
  horas: number
  meta: number
}

export async function getRegistrosProductividad(token: Token): Promise<RegistroProductividad[]> {
  const QUERY = /* GraphQL */ `
    query GetProductividad {
      productividads(first: ${LIMITE}, orderBy: { created_at: DESC }) {
        items { ${CAMPOS_PRODUCTIVIDAD} }
        hasNextPage
      }
    }
  `
  const datos = await fetchGraphQL<{ productividads: Conexion<RegistroProductividadApi> }>(
    QUERY,
    undefined,
    token,
  )
  return datos.productividads.items.map(aRegistroProductividad)
}

/**
 * Alta de turno por stored procedure (no `createproductividad`): valida turno,
 * horas y meta, y es idempotente sobre el id que genera el frontend.
 */
export async function registrarProductividad(
  token: Token,
  input: RegistrarProductividadInput,
): Promise<RegistroProductividad | null> {
  const MUTATION = /* GraphQL */ `
    mutation RegistrarProductividad(
      $id: String, $operador: String, $area: String, $turno: String,
      $unidades: Int, $horas: Decimal, $meta: Int
    ) {
      executeRegistrarProductividad(
        id: $id, operador: $operador, area: $area, turno: $turno,
        unidades: $unidades, horas: $horas, meta: $meta
      ) { ${CAMPOS_PRODUCTIVIDAD} }
    }
  `
  const datos = await fetchGraphQL<{
    executeRegistrarProductividad: RegistroProductividadApi[]
  }>(MUTATION, { ...input }, token)
  const registro = datos.executeRegistrarProductividad[0]
  return registro ? aRegistroProductividad(registro) : null
}

export async function eliminarRegistroProductividad(token: Token, id: string): Promise<void> {
  const MUTATION = /* GraphQL */ `
    mutation EliminarProductividad($id: String!) {
      deleteproductividad(id: $id) { id }
    }
  `
  await fetchGraphQL<{ deleteproductividad: { id: string } | null }>(MUTATION, { id }, token)
}

// ---------------------------------------------------------------------------
// Incidencias
// ---------------------------------------------------------------------------
// Los stored procedures ya existen (sql/05_sp_incidencias.sql), pero la tabla
// `incidencias` todavía no está publicada en la API for GraphQL, así que estas
// operaciones siguen siendo stubs: fallan y lib/data.ts cae a los datos seed.

export async function getIncidencias(token: Token): Promise<Incidencia[]> {
  const QUERY = /* GraphQL */ `
    # TODO: completar query cuando la tabla incidencias se exponga en la API
  `
  return fetchGraphQL<{ incidencias: Conexion<Incidencia> }>(QUERY, undefined, token).then(
    (d) => d.incidencias.items,
  )
}

export async function crearIncidencia(
  token: Token,
  input: {
    tipo: TipoIncidencia
    severidad: Severidad
    modulo: Incidencia['modulo']
    descripcion: string
    responsable: string
  },
): Promise<Incidencia> {
  const MUTATION = /* GraphQL */ `
    # TODO: completar mutation (executeCrearIncidencia)
  `
  return fetchGraphQL<{ executeCrearIncidencia: Incidencia[] }>(MUTATION, { ...input }, token).then(
    (d) => d.executeCrearIncidencia[0],
  )
}

export async function actualizarEstadoIncidencia(
  token: Token,
  id: string,
  estado: EstadoIncidencia,
): Promise<Incidencia> {
  const MUTATION = /* GraphQL */ `
    # TODO: completar mutation (executeActualizarEstadoIncidencia)
  `
  return fetchGraphQL<{ executeActualizarEstadoIncidencia: Incidencia[] }>(
    MUTATION,
    { id, estado },
    token,
  ).then((d) => d.executeActualizarEstadoIncidencia[0])
}
