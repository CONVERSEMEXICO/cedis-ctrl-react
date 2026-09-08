// Contrato entre la vista genérica de módulo y la configuración de cada uno.
// Vive aparte para que el diálogo de alta y la vista no se importen en círculo.

import type { ReactNode } from 'react'
import type { Action } from '@/lib/auth/permissions'
import type { TokensCedis } from '@/lib/auth/tokens'
import type { DatosCedis } from '@/lib/data'
import type { EstadoConfig, Opcion } from '@/lib/status-config'
import type { ResultadoAccion } from '@/types/cedis'

/** Mensaje único de fallo de red/API, igual en toda la app. */
export const ERROR_GUARDAR = 'No se pudo guardar el cambio. Verifica tu conexión.'

export interface RegistroBase {
  id: string
  estado: string
}

export interface ColumnaModulo<T> {
  clave: string
  encabezado: string
  /** Clases de la celda; las numéricas van en mono con `tabular-nums`. */
  className?: string
  /** Clases del encabezado — solo alineación, sin el mono de los valores. */
  classNameEncabezado?: string
  celda: (registro: T) => ReactNode
}

/** Valor del select cuando el campo opcional se deja sin elegir. */
export const SIN_VALOR = '__ninguno__'

export interface CampoCreacion {
  nombre: string
  etiqueta: string
  tipo: 'text' | 'number' | 'select'
  placeholder?: string
  opciones?: Opcion[]
  /**
   * Opciones que salen de los datos ya cargados —los pedidos pendientes, por
   * ejemplo— en vez de estar escritas en la config. El diálogo las lee de
   * `useDatosCedis()`, así que no hay fetch extra: es el mismo arreglo que
   * pinta la tabla.
   */
  opcionesDe?: (datos: DatosCedis) => Opcion[]
  /** Entrada que representa "sin elegir" en un select opcional. */
  vacio?: string
  /** Nota bajo el campo, para cuando elegir algo cambia lo que hace el alta. */
  ayuda?: string
  valorInicial?: string
  requerido?: boolean
}

/**
 * Lo que el diálogo de alta le presta a `crear()` además de los campos.
 *
 * `datos` deja que un alta lea el resto de la operación ya cargada —el pedido
 * que se eligió en el select, por ejemplo— sin un fetch propio. `idOperacion`
 * se fija al abrir el diálogo y no cambia entre reintentos, que es lo que hace
 * idempotente al alta que lo manda al SP.
 */
export interface ContextoCreacion {
  datos: DatosCedis
  idOperacion: string
}

/** Lo que necesita el diálogo de alta; el topbar solo consume esta parte. */
export interface ConfigCreacion {
  /** Etiqueta del botón: "Nuevo embarque". */
  etiquetaNuevo: string
  /** Título del diálogo de alta. */
  tituloAlta: string
  /** Prefijo del folio autogenerado cuando el campo queda vacío: "EMB". */
  prefijoFolio: string
  /** Campo que hace las veces de folio: 'folio' | 'pedido' | 'lote'. */
  campoFolio: string
  campos: CampoCreacion[]
  crear: (
    tokens: TokensCedis,
    valores: Record<string, string>,
    contexto: ContextoCreacion,
  ) => Promise<ResultadoAccion>
  /**
   * Permiso que exige el alta con estos valores. Sin esto es `crear_registro`.
   *
   * Existe porque el alta de surtido cambia de operación —y por tanto de
   * permiso— según se haya elegido un pedido asociado o no: sin declararlo, el
   * check del cliente y el del servidor mirarían acciones distintas.
   */
  accionDe?: (valores: Record<string, string>) => Action
}

export interface ConfigModulo<T extends RegistroBase> extends ConfigCreacion {
  /** Singular para los mensajes de confirmación: "embarque". */
  singular: string
  estados: Opcion[]
  estadoConfig: Record<string, EstadoConfig>
  columnas: ColumnaModulo<T>[]
  cambiarEstado: (
    tokens: TokensCedis,
    registro: T,
    estado: string,
    motivoRechazo?: string,
  ) => Promise<ResultadoAccion>
  eliminar: (tokens: TokensCedis, id: string) => Promise<ResultadoAccion>
  /** Estado que exige capturar un motivo antes de aplicarse ('rechazado'). */
  estadoQuePideMotivo?: string
  /**
   * Contenido del panel lateral de detalle de un renglón.
   *
   * Opcional: el módulo que no lo declara no muestra el botón del ojo. Vive en
   * la config y no en la vista porque lo que va dentro del panel es lo único
   * específico de cada módulo; el botón, el panel y su apertura son de la
   * vista, igual que el resto de la mecánica.
   */
  detalle?: ConfigDetalle<T>
  /**
   * Enfoque por query param: /surtido?pedido=<id> deja a la vista el renglón
   * que corresponde y ofrece quitar el filtro.
   *
   * Es cómo se llega desde otro módulo a un registro concreto sin inventar una
   * ruta de detalle por módulo.
   */
  enfoque?: ConfigEnfoque<T>
}

export interface ConfigDetalle<T> {
  /** Título del panel: "Detalle del surtido". */
  titulo: string
  /** Encabezado corto del registro, normalmente su folio. */
  subtitulo: (registro: T) => string
  cuerpo: (registro: T, cerrar: () => void) => ReactNode
}

export interface ConfigEnfoque<T> {
  /** Nombre del parámetro en la URL: 'pedido'. */
  param: string
  coincide: (registro: T, valor: string) => boolean
  /** Aviso que se pinta mientras el enfoque está activo. */
  aviso: string
}
