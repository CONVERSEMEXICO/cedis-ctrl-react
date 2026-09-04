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
//   - Las altas tampoco usan las mutations `create*` genéricas: van por SP
//     (`executeCrear*`, ver sql/08_sp_altas.sql) para que `id`, `created_at` y
//     `updated_at` los ponga el server y no se puedan escribir desde la API.
//   - Pedidos rompe la convención de nombres en dos puntos, y son del esquema,
//     no un descuido: la tabla de renglones se pluraliza a `pedido_lineas` pero
//     sus inputs son `pedido_lineaFilterInput` / `pedido_lineaOrderByInput`
//     (singular), y los parámetros de `executeCrearSurtidoDesdePedido` van en
//     snake_case (`pedido_id`), no en camelCase como `horaSalida` o
//     `motivoRechazo` en el resto de los SP.

import { ejecutarGraphQL, fetchGraphQL, GraphQLRequestError } from '@/lib/graphql'
import type {
  Embarque,
  EstadoEmbarque,
  EstadoEtiquetado,
  EstadoIncidencia,
  EstadoPedido,
  EstadoRecepcion,
  EstadoSurtido,
  Incidencia,
  LoteEtiquetado,
  Pedido,
  PedidoLinea,
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

/**
 * Tope aparte para los renglones de pedido: son de uno a varios por pedido, así
 * que 100 se quedaría corto mucho antes que en las demás tablas.
 */
const LIMITE_LINEAS = 500

const CAMPOS_EMBARQUE =
  'id folio destino transportista unidades hora_salida estado created_at updated_at'
const CAMPOS_RECEPCION = 'id folio proveedor anden unidades tipo estado created_at updated_at'
const CAMPOS_SURTIDO =
  'id pedido cliente lineas operador prioridad estado pedido_id created_at updated_at'
const CAMPOS_PEDIDO =
  'id folio cliente fecha_pedido fecha_requerida direccion_entrega estado notas created_at updated_at'
const CAMPOS_PEDIDO_LINEA =
  'id pedido_id linea sku producto cantidad_solicitada cantidad_surtida unidad_medida notas'
const CAMPOS_ETIQUETADO =
  'id lote producto unidades operador estado motivo_rechazo created_at updated_at'
const CAMPOS_PRODUCTIVIDAD = 'id operador area turno unidades horas meta created_at'

/**
 * Primera (y única) fila que devuelve un SP de alta.
 *
 * Los `executeCrear*` devuelven el result set como arreglo; el SP siempre cierra
 * con un `SELECT` de la fila creada, así que un arreglo vacío significa que algo
 * salió mal del lado de Fabric y no hay registro que devolverle a la UI.
 */
function primeraFila<T>(filas: T[] | null | undefined, que: string): T {
  const fila = filas?.[0]
  if (!fila) {
    throw new GraphQLRequestError(`El alta de ${que} no devolvió el registro creado.`)
  }
  return fila
}

/** `filter: null` trae todos los registros; con estado filtra en el server. */
function filtroEstado(estado?: string) {
  return estado ? { estado: { eq: estado } } : null
}

const ORDEN_RECIENTE = { created_at: 'DESC' }

// ---------------------------------------------------------------------------
// Carga agrupada del panel
// ---------------------------------------------------------------------------

/** Los conjuntos con tabla publicada, tal como los devuelve Fabric. */
export interface DatosOperativos {
  embarques: Embarque[] | null
  recepciones: Recepcion[] | null
  pedidosSurtido: PedidoSurtido[] | null
  lotesEtiquetado: LoteEtiquetado[] | null
  productividad: RegistroProductividad[] | null
  pedidos: Pedido[] | null
  pedidoLineas: PedidoLinea[] | null
}

interface RespuestaDatosOperativos {
  embarques: Conexion<Embarque> | null
  recepciones: Conexion<Recepcion> | null
  surtidos: Conexion<PedidoSurtido> | null
  etiquetados: Conexion<LoteEtiquetado> | null
  productividads: Conexion<RegistroProductividadApi> | null
  pedidos: Conexion<Pedido> | null
  pedido_lineas: Conexion<PedidoLinea> | null
}

/**
 * Trae los siete conjuntos en **una sola petición**.
 *
 * GraphQL permite varios campos raíz en un documento, y Fabric los resuelve
 * juntos. Antes esto eran cinco peticiones en paralelo (seis con el stub de
 * incidencias) por cada carga del panel, y como cada escritura dispara una
 * recarga, un turno de trabajo normal se comía el límite de tasa.
 *
 * Los renglones de pedido entran aquí completos y no por pedido: la vista de
 * detalle (/pedidos/[id]) filtra en memoria. Pedirlos con
 * `filter: { pedido_id: { eq: … } }` en cada detalle sería una petición por
 * pedido abierto —justo el patrón que provocó el 429— y además dejaría esa
 * vista sin respaldo seed.
 *
 * El `orderBy` va inline y sin comillas porque `DESC` es un enum del esquema;
 * como variable viajaría serializado a string, que es lo que hacen las queries
 * individuales de abajo. El `filter: null` explícito reproduce lo que esas
 * mandaban: sin filtro de estado, todos los registros.
 *
 * Tolera fallos parciales: si una tabla falla, su campo llega en null y las
 * demás siguen siendo válidas. Quien llama decide qué hacer con cada null
 * (lib/data.ts marca ese conjunto como offline y usa el seed).
 */
export async function getDatosOperativos(token: Token): Promise<DatosOperativos> {
  const QUERY = /* GraphQL */ `
    query GetDatosCedis {
      embarques(first: ${LIMITE}, filter: null, orderBy: { created_at: DESC }) {
        items { ${CAMPOS_EMBARQUE} }
      }
      recepciones(first: ${LIMITE}, filter: null, orderBy: { created_at: DESC }) {
        items { ${CAMPOS_RECEPCION} }
      }
      surtidos(first: ${LIMITE}, filter: null, orderBy: { created_at: DESC }) {
        items { ${CAMPOS_SURTIDO} }
      }
      etiquetados(first: ${LIMITE}, filter: null, orderBy: { created_at: DESC }) {
        items { ${CAMPOS_ETIQUETADO} }
      }
      productividads(first: ${LIMITE}, orderBy: { created_at: DESC }) {
        items { ${CAMPOS_PRODUCTIVIDAD} }
      }
      pedidos(first: ${LIMITE}, filter: null, orderBy: { fecha_pedido: DESC }) {
        items { ${CAMPOS_PEDIDO} }
      }
      pedido_lineas(first: ${LIMITE_LINEAS}, filter: null, orderBy: { linea: ASC }) {
        items { ${CAMPOS_PEDIDO_LINEA} }
      }
    }
  `

  const respuesta = await ejecutarGraphQL<RespuestaDatosOperativos>(QUERY, undefined, token)

  if (respuesta.errors?.length) {
    // No se lanza: puede haber datos parciales. Queda el rastro en consola con
    // el `path`, que es lo que dice qué tabla falló.
    console.error('[cedis] la carga agrupada trajo errores parciales —', respuesta.errors)
  }

  const datos = respuesta.data
  if (!datos) {
    throw new GraphQLRequestError(
      respuesta.errors?.map((e) => e.message).join('; ') ??
        'La respuesta de la API no contiene datos.',
      200,
      respuesta.errors,
    )
  }

  return {
    embarques: datos.embarques?.items ?? null,
    recepciones: datos.recepciones?.items ?? null,
    pedidosSurtido: datos.surtidos?.items ?? null,
    lotesEtiquetado: datos.etiquetados?.items ?? null,
    productividad: datos.productividads?.items.map(aRegistroProductividad) ?? null,
    pedidos: datos.pedidos?.items ?? null,
    pedidoLineas: datos.pedido_lineas?.items ?? null,
  }
}

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
    mutation CrearEmbarque(
      $folio: String
      $destino: String
      $transportista: String
      $unidades: Int
      $horaSalida: String
      $estado: String
    ) {
      executeCrearEmbarque(
        folio: $folio
        destino: $destino
        transportista: $transportista
        unidades: $unidades
        horaSalida: $horaSalida
        estado: $estado
      ) { ${CAMPOS_EMBARQUE} }
    }
  `
  const datos = await fetchGraphQL<{ executeCrearEmbarque: Embarque[] }>(
    MUTATION,
    {
      folio: item.folio,
      destino: item.destino,
      transportista: item.transportista,
      unidades: item.unidades ?? null,
      horaSalida: item.hora_salida ?? null,
      estado: item.estado ?? 'programado',
    },
    token,
  )
  return primeraFila(datos.executeCrearEmbarque, 'embarque')
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
    mutation CrearRecepcion(
      $folio: String
      $proveedor: String
      $anden: String
      $unidades: Int
      $tipo: String
      $estado: String
    ) {
      executeCrearRecepcion(
        folio: $folio
        proveedor: $proveedor
        anden: $anden
        unidades: $unidades
        tipo: $tipo
        estado: $estado
      ) { ${CAMPOS_RECEPCION} }
    }
  `
  const datos = await fetchGraphQL<{ executeCrearRecepcion: Recepcion[] }>(
    MUTATION,
    {
      folio: item.folio,
      proveedor: item.proveedor,
      anden: item.anden ?? null,
      unidades: item.unidades ?? null,
      tipo: item.tipo ?? null,
      estado: item.estado ?? 'programada',
    },
    token,
  )
  return primeraFila(datos.executeCrearRecepcion, 'recepción')
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
    mutation CrearPedidoSurtido(
      $pedido: String
      $cliente: String
      $lineas: Int
      $operador: String
      $prioridad: String
      $estado: String
    ) {
      executeCrearPedidoSurtido(
        pedido: $pedido
        cliente: $cliente
        lineas: $lineas
        operador: $operador
        prioridad: $prioridad
        estado: $estado
      ) { ${CAMPOS_SURTIDO} }
    }
  `
  const datos = await fetchGraphQL<{ executeCrearPedidoSurtido: PedidoSurtido[] }>(
    MUTATION,
    {
      pedido: item.pedido,
      cliente: item.cliente,
      lineas: item.lineas ?? null,
      operador: item.operador ?? null,
      prioridad: item.prioridad ?? 'Media',
      estado: item.estado ?? 'pendiente',
    },
    token,
  )
  return primeraFila(datos.executeCrearPedidoSurtido, 'pedido de surtido')
}

export interface CrearSurtidoDesdePedidoInput {
  /** Lo genera el navegador con crypto.randomUUID(): hace el alta idempotente. */
  id: string
  pedido_id: string
  /** Folio del pedido; se copia a `surtido.pedido`. */
  pedido: string
  cliente: string
  lineas: number
  operador?: string | null
  prioridad?: Prioridad
}

/**
 * Lo que devuelve el SP: el registro creado, con el subconjunto de columnas que
 * expone su result set.
 *
 * No se pide `${CAMPOS_SURTIDO}` completo porque el tipo del SP
 * (`CrearSurtidoDesdePedido`) no es la tabla `surtido`: pedirle `created_at` o
 * `updated_at` sería pedirle campos que su result set no declara. Da igual para
 * quien llama —lib/actions.ts descarta la carga útil y refresca— pero pedirlos
 * costaría un error de validación en Fabric.
 */
type SurtidoCreado = Pick<
  PedidoSurtido,
  'id' | 'pedido' | 'pedido_id' | 'cliente' | 'lineas' | 'operador' | 'prioridad' | 'estado'
>

/**
 * Abre la orden de surtido que atiende a un pedido capturado.
 *
 * Es una sola operación y no dos (crear surtido + marcar el pedido) a
 * propósito: el SP hace las dos escrituras en la misma transacción, así que no
 * existe el estado intermedio de un pedido 'pendiente' con surtido ya abierto.
 *
 * El SP **no recibe `estado`**: el surtido siempre nace 'pendiente'. Para
 * arrancarlo hay que cambiarle el estatus después, desde el propio módulo de
 * surtido, que es donde vive la validación de "no se arranca sin operador".
 *
 * El folio y el cliente sí viajan desde el cliente —el SP los recibe como
 * parámetros y no los deriva del pedido—, así que quien llame debe tomarlos del
 * pedido y no de un formulario: ver `accionCrearSurtidoDesdePedido`.
 */
export async function crearSurtidoDesdePedido(
  token: Token,
  input: CrearSurtidoDesdePedidoInput,
): Promise<SurtidoCreado> {
  const MUTATION = /* GraphQL */ `
    mutation CrearSurtidoDesdePedido(
      $id: String
      $pedido_id: String
      $pedido: String
      $cliente: String
      $lineas: Int
      $operador: String
      $prioridad: String
    ) {
      executeCrearSurtidoDesdePedido(
        id: $id
        pedido_id: $pedido_id
        pedido: $pedido
        cliente: $cliente
        lineas: $lineas
        operador: $operador
        prioridad: $prioridad
      ) {
        id pedido pedido_id cliente lineas operador prioridad estado
      }
    }
  `
  const datos = await fetchGraphQL<{ executeCrearSurtidoDesdePedido: SurtidoCreado[] }>(
    MUTATION,
    {
      id: input.id,
      pedido_id: input.pedido_id,
      pedido: input.pedido,
      cliente: input.cliente,
      lineas: input.lineas,
      operador: input.operador ?? null,
      prioridad: input.prioridad ?? 'Media',
    },
    token,
  )
  return primeraFila(datos.executeCrearSurtidoDesdePedido, 'surtido desde pedido')
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------
//
// Las altas y las bajas de pedidos (`createpedidos`, `createpedido_linea`,
// `deletepedidos`, `deletepedido_linea`) existen en el esquema pero el panel no
// las usa: los pedidos y sus renglones los captura el ERP, y el CEDIS solo los
// atiende. Si algún día hace falta capturar uno a mano, el `linea` de cada
// renglón lo manda el ERP —la app nunca lo genera ni lo recalcula—, así que
// tendría que venir del formulario.

/**
 * Cambia el estado de un pedido sin pasar por surtido.
 *
 * El camino normal a 'asignado' es `crearSurtidoDesdePedido`, que lo mueve como
 * parte de la transacción. Esto es para lo demás: cancelar un pedido, sobre
 * todo, que es una decisión del cliente y no un avance de la operación.
 */
export async function actualizarEstadoPedido(
  token: Token,
  id: string,
  estado: EstadoPedido,
): Promise<Pedido | null> {
  const MUTATION = /* GraphQL */ `
    mutation ActualizarEstadoPedido($id: String, $estado: String) {
      executeActualizarEstadoPedido(id: $id, estado: $estado) { ${CAMPOS_PEDIDO} }
    }
  `
  const datos = await fetchGraphQL<{ executeActualizarEstadoPedido: Pedido[] }>(
    MUTATION,
    { id, estado },
    token,
  )
  return datos.executeActualizarEstadoPedido[0] ?? null
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
    mutation CrearLoteEtiquetado(
      $lote: String
      $producto: String
      $unidades: Int
      $operador: String
      $estado: String
      $motivoRechazo: String
    ) {
      executeCrearLoteEtiquetado(
        lote: $lote
        producto: $producto
        unidades: $unidades
        operador: $operador
        estado: $estado
        motivoRechazo: $motivoRechazo
      ) { ${CAMPOS_ETIQUETADO} }
    }
  `
  const datos = await fetchGraphQL<{ executeCrearLoteEtiquetado: LoteEtiquetado[] }>(
    MUTATION,
    {
      lote: item.lote,
      producto: item.producto,
      unidades: item.unidades ?? null,
      operador: item.operador ?? null,
      estado: item.estado ?? 'pendiente',
      motivoRechazo: item.motivo_rechazo ?? null,
    },
    token,
  )
  return primeraFila(datos.executeCrearLoteEtiquetado, 'lote de etiquetado')
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

/**
 * Mientras la tabla no exista en la API, esto falla **sin salir a la red**.
 *
 * Antes mandaba un documento vacío que Fabric rechazaba siempre: una de las
 * seis peticiones de cada carga se gastaba en un error garantizado, y contaba
 * igual para el límite de tasa. El respaldo seed de lib/data.ts es el mismo,
 * pero ahora sale gratis.
 */
export async function getIncidencias(_token: Token): Promise<Incidencia[]> {
  throw new GraphQLRequestError(
    'La tabla incidencias todavía no está publicada en la GraphQL API de Fabric.',
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
