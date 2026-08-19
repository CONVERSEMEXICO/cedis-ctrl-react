// Stubs de queries y mutations GraphQL contra Microsoft Fabric SQL Database.
// Cada función solo define la firma y el tipo de retorno — el documento GraphQL
// (query/mutation) se completa después.

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
  Recepcion,
  RegistroProductividad,
  Severidad,
  TipoIncidencia,
} from '@/types/cedis'

// ---------------------------------------------------------------------------
// Embarques
// ---------------------------------------------------------------------------

export async function getEmbarques(): Promise<Embarque[]> {
  const QUERY = /* GraphQL */ `
    # TODO: completar query
  `
  return fetchGraphQL<{ embarques: Embarque[] }>(QUERY).then((d) => d.embarques)
}

export async function getEmbarque(id: string): Promise<Embarque | null> {
  const QUERY = /* GraphQL */ `
    # TODO: completar query
  `
  return fetchGraphQL<{ embarque: Embarque | null }>(QUERY, { id }).then((d) => d.embarque)
}

export async function actualizarEstadoEmbarque(
  id: string,
  estado: EstadoEmbarque,
): Promise<Embarque> {
  const MUTATION = /* GraphQL */ `
    # TODO: completar mutation
  `
  return fetchGraphQL<{ actualizarEstadoEmbarque: Embarque }>(MUTATION, { id, estado }).then(
    (d) => d.actualizarEstadoEmbarque,
  )
}

// ---------------------------------------------------------------------------
// Recepciones
// ---------------------------------------------------------------------------

export async function getRecepciones(): Promise<Recepcion[]> {
  const QUERY = /* GraphQL */ `
    # TODO: completar query
  `
  return fetchGraphQL<{ recepciones: Recepcion[] }>(QUERY).then((d) => d.recepciones)
}

export async function getRecepcion(id: string): Promise<Recepcion | null> {
  const QUERY = /* GraphQL */ `
    # TODO: completar query
  `
  return fetchGraphQL<{ recepcion: Recepcion | null }>(QUERY, { id }).then((d) => d.recepcion)
}

export async function actualizarEstadoRecepcion(
  id: string,
  estado: EstadoRecepcion,
): Promise<Recepcion> {
  const MUTATION = /* GraphQL */ `
    # TODO: completar mutation
  `
  return fetchGraphQL<{ actualizarEstadoRecepcion: Recepcion }>(MUTATION, { id, estado }).then(
    (d) => d.actualizarEstadoRecepcion,
  )
}

// ---------------------------------------------------------------------------
// Surtido
// ---------------------------------------------------------------------------

export async function getPedidosSurtido(): Promise<PedidoSurtido[]> {
  const QUERY = /* GraphQL */ `
    # TODO: completar query
  `
  return fetchGraphQL<{ pedidosSurtido: PedidoSurtido[] }>(QUERY).then((d) => d.pedidosSurtido)
}

export async function getPedidoSurtido(id: string): Promise<PedidoSurtido | null> {
  const QUERY = /* GraphQL */ `
    # TODO: completar query
  `
  return fetchGraphQL<{ pedidoSurtido: PedidoSurtido | null }>(QUERY, { id }).then(
    (d) => d.pedidoSurtido,
  )
}

export async function actualizarEstadoSurtido(
  id: string,
  estado: EstadoSurtido,
): Promise<PedidoSurtido> {
  const MUTATION = /* GraphQL */ `
    # TODO: completar mutation
  `
  return fetchGraphQL<{ actualizarEstadoSurtido: PedidoSurtido }>(MUTATION, { id, estado }).then(
    (d) => d.actualizarEstadoSurtido,
  )
}

// ---------------------------------------------------------------------------
// Etiquetado
// ---------------------------------------------------------------------------

export async function getLotesEtiquetado(): Promise<LoteEtiquetado[]> {
  const QUERY = /* GraphQL */ `
    # TODO: completar query
  `
  return fetchGraphQL<{ lotesEtiquetado: LoteEtiquetado[] }>(QUERY).then((d) => d.lotesEtiquetado)
}

export async function getLoteEtiquetado(id: string): Promise<LoteEtiquetado | null> {
  const QUERY = /* GraphQL */ `
    # TODO: completar query
  `
  return fetchGraphQL<{ loteEtiquetado: LoteEtiquetado | null }>(QUERY, { id }).then(
    (d) => d.loteEtiquetado,
  )
}

export async function actualizarEstadoEtiquetado(
  id: string,
  estado: EstadoEtiquetado,
  motivoRechazo?: string,
): Promise<LoteEtiquetado> {
  const MUTATION = /* GraphQL */ `
    # TODO: completar mutation
  `
  return fetchGraphQL<{ actualizarEstadoEtiquetado: LoteEtiquetado }>(MUTATION, {
    id,
    estado,
    motivoRechazo,
  }).then((d) => d.actualizarEstadoEtiquetado)
}

// ---------------------------------------------------------------------------
// Incidencias
// ---------------------------------------------------------------------------

export async function getIncidencias(): Promise<Incidencia[]> {
  const QUERY = /* GraphQL */ `
    # TODO: completar query
  `
  return fetchGraphQL<{ incidencias: Incidencia[] }>(QUERY).then((d) => d.incidencias)
}

export async function getIncidencia(id: string): Promise<Incidencia | null> {
  const QUERY = /* GraphQL */ `
    # TODO: completar query
  `
  return fetchGraphQL<{ incidencia: Incidencia | null }>(QUERY, { id }).then((d) => d.incidencia)
}

export async function crearIncidencia(input: {
  tipo: TipoIncidencia
  severidad: Severidad
  modulo: Incidencia['modulo']
  descripcion: string
  responsable: string
}): Promise<Incidencia> {
  const MUTATION = /* GraphQL */ `
    # TODO: completar mutation
  `
  return fetchGraphQL<{ crearIncidencia: Incidencia }>(MUTATION, { input }).then(
    (d) => d.crearIncidencia,
  )
}

export async function actualizarEstadoIncidencia(
  id: string,
  estado: EstadoIncidencia,
): Promise<Incidencia> {
  const MUTATION = /* GraphQL */ `
    # TODO: completar mutation
  `
  return fetchGraphQL<{ actualizarEstadoIncidencia: Incidencia }>(MUTATION, {
    id,
    estado,
  }).then((d) => d.actualizarEstadoIncidencia)
}

// ---------------------------------------------------------------------------
// Productividad
// ---------------------------------------------------------------------------

export async function getRegistrosProductividad(): Promise<RegistroProductividad[]> {
  const QUERY = /* GraphQL */ `
    # TODO: completar query
  `
  return fetchGraphQL<{ registrosProductividad: RegistroProductividad[] }>(QUERY).then(
    (d) => d.registrosProductividad,
  )
}

export async function registrarProductividad(
  input: Omit<RegistroProductividad, 'id'>,
): Promise<RegistroProductividad> {
  const MUTATION = /* GraphQL */ `
    # TODO: completar mutation
  `
  return fetchGraphQL<{ registrarProductividad: RegistroProductividad }>(MUTATION, {
    input,
  }).then((d) => d.registrarProductividad)
}
