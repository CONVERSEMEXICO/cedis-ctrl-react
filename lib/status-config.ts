// Mapea estados de cada módulo a etiquetas en español y clases de color
// para badges e indicadores visuales.

import type {
  EstadoEmbarque,
  EstadoEtiquetado,
  EstadoIncidencia,
  EstadoRecepcion,
  EstadoSurtido,
  ModuloOperativo,
  Severidad,
} from '@/types/cedis'

export interface EstadoConfig {
  label: string
  dotClass: string
  badgeClass: string
}

export const ESTADO_EMBARQUE: Record<EstadoEmbarque, EstadoConfig> = {
  programado: {
    label: 'Programado',
    dotClass: 'bg-muted-foreground',
    badgeClass: 'bg-secondary text-secondary-foreground',
  },
  cargando: {
    label: 'Cargando',
    dotClass: 'bg-embarques',
    badgeClass: 'bg-embarques/15 text-embarques',
  },
  transito: {
    label: 'En tránsito',
    dotClass: 'bg-embarques',
    badgeClass: 'bg-embarques/15 text-embarques',
  },
  entregado: {
    label: 'Entregado',
    dotClass: 'bg-success',
    badgeClass: 'bg-success/15 text-success',
  },
  retrasado: {
    label: 'Retrasado',
    dotClass: 'bg-destructive',
    badgeClass: 'bg-destructive/15 text-destructive',
  },
}

export const ESTADO_RECEPCION: Record<EstadoRecepcion, EstadoConfig> = {
  programada: {
    label: 'Programada',
    dotClass: 'bg-muted-foreground',
    badgeClass: 'bg-secondary text-secondary-foreground',
  },
  descarga: {
    label: 'En descarga',
    dotClass: 'bg-recepciones',
    badgeClass: 'bg-recepciones/15 text-recepciones',
  },
  inspeccion: {
    label: 'En inspección',
    dotClass: 'bg-recepciones',
    badgeClass: 'bg-recepciones/15 text-recepciones',
  },
  recibida: {
    label: 'Recibida',
    dotClass: 'bg-success',
    badgeClass: 'bg-success/15 text-success',
  },
  discrepancia: {
    label: 'Discrepancia',
    dotClass: 'bg-destructive',
    badgeClass: 'bg-destructive/15 text-destructive',
  },
}

export const ESTADO_SURTIDO: Record<EstadoSurtido, EstadoConfig> = {
  pendiente: {
    label: 'Pendiente',
    dotClass: 'bg-muted-foreground',
    badgeClass: 'bg-secondary text-secondary-foreground',
  },
  surtiendo: {
    label: 'Surtiendo',
    dotClass: 'bg-surtido',
    badgeClass: 'bg-surtido/15 text-surtido',
  },
  verificado: {
    label: 'Verificado',
    dotClass: 'bg-embarques',
    badgeClass: 'bg-embarques/15 text-embarques',
  },
  completado: {
    label: 'Completado',
    dotClass: 'bg-success',
    badgeClass: 'bg-success/15 text-success',
  },
  pausado: {
    label: 'Pausado',
    dotClass: 'bg-destructive',
    badgeClass: 'bg-destructive/15 text-destructive',
  },
}

export const ESTADO_ETIQUETADO: Record<EstadoEtiquetado, EstadoConfig> = {
  pendiente: {
    label: 'Pendiente',
    dotClass: 'bg-muted-foreground',
    badgeClass: 'bg-secondary text-secondary-foreground',
  },
  proceso: {
    label: 'En proceso',
    dotClass: 'bg-etiquetado',
    badgeClass: 'bg-etiquetado/15 text-etiquetado',
  },
  etiquetado: {
    label: 'Etiquetado',
    dotClass: 'bg-success',
    badgeClass: 'bg-success/15 text-success',
  },
  rechazado: {
    label: 'Rechazado',
    dotClass: 'bg-destructive',
    badgeClass: 'bg-destructive/15 text-destructive',
  },
}

export const ESTADO_INCIDENCIA: Record<EstadoIncidencia, EstadoConfig> = {
  abierta: {
    label: 'Abierta',
    dotClass: 'bg-destructive',
    badgeClass: 'bg-destructive/15 text-destructive',
  },
  atencion: {
    label: 'En atención',
    dotClass: 'bg-incidencias',
    badgeClass: 'bg-warning/15 text-warning',
  },
  resuelta: {
    label: 'Resuelta',
    dotClass: 'bg-success',
    badgeClass: 'bg-success/15 text-success',
  },
  cerrada: {
    label: 'Cerrada',
    dotClass: 'bg-muted-foreground',
    badgeClass: 'bg-secondary text-secondary-foreground',
  },
}

export const SEVERIDAD_CONFIG: Record<
  Severidad,
  EstadoConfig & { chartVar: string }
> = {
  baja: {
    label: 'Baja',
    dotClass: 'bg-severidad-baja',
    badgeClass: 'bg-severidad-baja/15 text-severidad-baja',
    chartVar: 'var(--severidad-baja)',
  },
  media: {
    label: 'Media',
    dotClass: 'bg-severidad-media',
    badgeClass: 'bg-severidad-media/15 text-severidad-media',
    chartVar: 'var(--severidad-media)',
  },
  alta: {
    label: 'Alta',
    dotClass: 'bg-severidad-alta',
    badgeClass: 'bg-severidad-alta/15 text-severidad-alta',
    chartVar: 'var(--severidad-alta)',
  },
  critica: {
    label: 'Crítica',
    dotClass: 'bg-severidad-critica',
    badgeClass: 'bg-severidad-critica/15 text-severidad-critica',
    chartVar: 'var(--severidad-critica)',
  },
}

export const TIPO_INCIDENCIA_LABEL: Record<string, string> = {
  dano_mercancia: 'Daño a mercancía',
  faltante: 'Faltante',
  retraso_transporte: 'Retraso de transporte',
  error_surtido: 'Error de surtido',
  falla_equipo: 'Falla de equipo',
  seguridad: 'Seguridad',
  discrepancia_inventario: 'Discrepancia de inventario',
  etiquetado_rechazado: 'Etiquetado rechazado',
}

export const MODULO_LABEL: Record<ModuloOperativo, string> = {
  embarques: 'Embarques',
  recepciones: 'Recepciones',
  surtido: 'Surtido',
  etiquetado: 'Etiquetado',
  productividad: 'Productividad',
  incidencias: 'Incidencias',
}

export const MODULO_DOT_CLASS: Record<ModuloOperativo, string> = {
  embarques: 'bg-embarques',
  recepciones: 'bg-recepciones',
  surtido: 'bg-surtido',
  etiquetado: 'bg-etiquetado',
  productividad: 'bg-productividad',
  incidencias: 'bg-incidencias',
}
