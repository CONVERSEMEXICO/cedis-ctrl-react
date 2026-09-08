// Tipos del dominio para el panel de operaciones del CEDIS.
//
// Las entidades operativas espejean columna por columna las tablas expuestas
// por la GraphQL API de Microsoft Fabric SQL Database, incluyendo su
// nomenclatura snake_case (`hora_salida`, `motivo_rechazo`, `created_at`).
// Mantenerlas idénticas evita una capa de mapeo entre la API y la UI.

import type { Role } from '@/lib/auth/roles'

/**
 * Los app roles viven en lib/auth/roles.ts —de ahí los leen el hook y el guard
 * del servidor— y se reexportan aquí para que el dominio se importe de un solo
 * lugar.
 */
export type { Role }

/** Usuario autenticado tal como lo consume la UI: identidad + rol efectivo. */
export interface CedisUser {
  name: string
  email: string
  role: Role | null
}

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

/**
 * Ciclo de vida de un pedido capturado por el ERP.
 *
 * `asignado` no lo pone la UI: lo sella el server cuando se crea el registro de
 * surtido que atiende al pedido (ver `crearSurtidoDesdePedido` en
 * lib/queries.ts). Desde el panel un pedido solo nace 'pendiente'.
 */
export type EstadoPedido = 'pendiente' | 'asignado' | 'completado' | 'cancelado'

export type EstadoIncidencia = 'abierta' | 'atencion' | 'resuelta' | 'cerrada'

export type Severidad = 'baja' | 'media' | 'alta' | 'critica'

/** La tabla `surtido` guarda la prioridad capitalizada. */
export type Prioridad = 'Alta' | 'Media' | 'Baja'

/** `CK_productividad_turno` restringe el turno a estos tres valores. */
export type Turno = 'matutino' | 'vespertino' | 'nocturno'

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
  destino: string
  transportista: string
  unidades: number | null
  /** Texto 'HH:mm'; el stored procedure lo sella al pasar a 'transito'. */
  hora_salida: string | null
  estado: EstadoEmbarque
  created_at: string
  updated_at: string | null
}

export interface Recepcion {
  id: string
  folio: string
  proveedor: string
  anden: string | null
  unidades: number | null
  /** Tipo de mercancía. */
  tipo: string | null
  estado: EstadoRecepcion
  created_at: string
  updated_at: string | null
}

/**
 * Pedido capturado en el ERP: el trabajo que hay que surtir.
 *
 * Es la cabecera; el detalle vive en `PedidoLinea`. No confundir con
 * `PedidoSurtido`, que es la **orden de trabajo** del piso que atiende a un
 * pedido — un pedido puede existir sin surtido asignado, y de ahí que el
 * vínculo viva del lado de surtido (`PedidoSurtido.pedido_id`).
 */
export interface Pedido {
  id: string
  folio: string
  cliente: string
  fecha_pedido: string
  fecha_requerida: string | null
  direccion_entrega: string | null
  estado: EstadoPedido
  notas: string | null
  created_at: string
  updated_at: string
}

/** Renglón de un pedido. `linea` es el consecutivo que manda el ERP. */
export interface PedidoLinea {
  id: string
  pedido_id: string
  /** Consecutivo del ERP (1, 2, 3…). Es el orden de captura: no lo reordenes. */
  linea: number
  sku: string | null
  producto: string
  cantidad_solicitada: number
  cantidad_surtida: number
  unidad_medida: string
  notas: string | null
}

export interface PedidoSurtido {
  id: string
  /** Número de pedido; hace las veces de folio. */
  pedido: string
  cliente: string
  lineas: number | null
  operador: string | null
  prioridad: Prioridad
  estado: EstadoSurtido
  /** `Pedido.id` que atiende esta orden; null si se capturó suelta. */
  pedido_id: string | null
  created_at: string
  updated_at: string | null
}

export interface LoteEtiquetado {
  id: string
  lote: string
  producto: string
  unidades: number | null
  operador: string | null
  estado: EstadoEtiquetado
  /** Solo vive mientras el lote está rechazado; el SP lo limpia al reanudar. */
  motivo_rechazo: string | null
  created_at: string
  updated_at: string | null
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
  operador: string
  area: string
  turno: Turno
  /** Unidades procesadas en el turno. */
  unidades: number
  /** Llega como Decimal de GraphQL; se convierte a number en lib/queries.ts. */
  horas: number
  /** Meta de unidades del turno. */
  meta: number
  created_at: string
}

/** Contrato uniforme de las operaciones de escritura de lib/actions.ts. */
export type ResultadoAccion =
  | { ok: true }
  | {
      ok: false
      error: string
      /** Distingue el 401 de Fabric: hay que volver a entrar. */
      sesionExpirada: boolean
      /** Distingue el 429: no es un error del usuario, hay que esperar. */
      limiteExcedido?: boolean
    }
