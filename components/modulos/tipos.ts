// Contrato entre la vista genérica de módulo y la configuración de cada uno.
// Vive aparte para que el diálogo de alta y la vista no se importen en círculo.

import type { ReactNode } from 'react'
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

export interface CampoCreacion {
  nombre: string
  etiqueta: string
  tipo: 'text' | 'number' | 'select'
  placeholder?: string
  opciones?: Opcion[]
  valorInicial?: string
  requerido?: boolean
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
  crear: (token: string | null, valores: Record<string, string>) => Promise<ResultadoAccion>
}

export interface ConfigModulo<T extends RegistroBase> extends ConfigCreacion {
  /** Singular para los mensajes de confirmación: "embarque". */
  singular: string
  estados: Opcion[]
  estadoConfig: Record<string, EstadoConfig>
  columnas: ColumnaModulo<T>[]
  cambiarEstado: (
    token: string | null,
    registro: T,
    estado: string,
    motivoRechazo?: string,
  ) => Promise<ResultadoAccion>
  eliminar: (token: string | null, id: string) => Promise<ResultadoAccion>
  /** Estado que exige capturar un motivo antes de aplicarse ('rechazado'). */
  estadoQuePideMotivo?: string
}
