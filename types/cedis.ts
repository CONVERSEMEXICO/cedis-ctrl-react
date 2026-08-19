// Tipos del dominio para el panel de operaciones del CEDIS.

export type EstadoEmbarque =
  | 'programado'
  | 'cargando'
  | 'transito'
  | 'entregado'
  | 'retrasado'

export type EstadoRecepcion =
  | 'programada'
  | 'descarga'
  | 'inspeccion'
  | 'recibida'
  | 'discrepancia'

export type EstadoSurtido =
  | 'pendiente'
  | 'surtiendo'
  | 'verificado'
  | 'completado'
  | 'pausado'

export type EstadoEtiquetado = 'pendiente' | 'proceso' | 'etiquetado' | 'rechazado'

export type EstadoIncidencia = 'abierta' | 'atencion' | 'resuelta' | 'cerrada'

export type Severidad = 'baja' | 'media' | 'alta' | 'critica'

export type TipoIncidencia =
  | 'dano_mercancia'
  | 'faltante'
  | 'retraso_transporte'
  | 'error_surtido'
  | 'falla_equipo'
  | 'seguridad'
  | 'discrepancia_inventario'
  | 'etiquetado_rechazado'

export type ModuloOperativo =
  | 'embarques'
  | 'recepciones'
  | 'surtido'
  | 'etiquetado'
  | 'productividad'
  | 'incidencias'

export interface Embarque {
  id: string
  folio: string
  transportista: string
  cliente: string
  destino: string
  estado: EstadoEmbarque
  unidades: number
  fechaProgramada: string
  fechaSalida?: string
  fechaEntregaEstimada?: string
  anden?: string
  responsable: string
}

export interface Recepcion {
  id: string
  folio: string
  proveedor: string
  transportista: string
  estado: EstadoRecepcion
  unidadesEsperadas: number
  unidadesRecibidas?: number
  fechaProgramada: string
  fechaRecepcion?: string
  anden?: string
  responsable: string
  tieneDiscrepancia: boolean
}

export interface PedidoSurtido {
  id: string
  folio: string
  cliente: string
  estado: EstadoSurtido
  unidadesTotales: number
  unidadesSurtidas: number
  zona: string
  responsable: string
  fechaCreacion: string
  fechaLimite: string
}

export interface LoteEtiquetado {
  id: string
  folio: string
  cliente: string
  estado: EstadoEtiquetado
  unidades: number
  tipoEtiqueta: string
  responsable: string
  fechaProceso: string
  motivoRechazo?: string
}

export interface Incidencia {
  id: string
  folio: string
  tipo: TipoIncidencia
  severidad: Severidad
  estado: EstadoIncidencia
  modulo: ModuloOperativo
  descripcion: string
  responsable: string
  fechaCreacion: string
  fechaResolucion?: string
}

export interface RegistroProductividad {
  id: string
  area: string
  responsable: string
  turno: 'matutino' | 'vespertino' | 'nocturno'
  unidadesPorHora: number
  metaUnidadesPorHora: number
  fecha: string
}
