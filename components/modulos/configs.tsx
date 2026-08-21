'use client'

// Configuración de los cuatro módulos operativos: columnas, campos de alta y
// las server actions que ejecuta cada operación. Es lo único que distingue a un
// módulo de otro — la mecánica está en <ModuleControlView>.

import { EstadoBadge } from '@/components/shared/estado-badge'
import { ModuleControlView } from '@/components/modulos/module-control-view'
import type { ConfigCreacion, ConfigModulo } from '@/components/modulos/tipos'
import {
  accionActualizarEstadoEmbarque,
  accionActualizarEstadoEtiquetado,
  accionActualizarEstadoRecepcion,
  accionActualizarEstadoSurtido,
  accionCrearEmbarque,
  accionCrearLoteEtiquetado,
  accionCrearPedidoSurtido,
  accionCrearRecepcion,
  accionEliminarEmbarque,
  accionEliminarLoteEtiquetado,
  accionEliminarPedidoSurtido,
  accionEliminarRecepcion,
} from '@/lib/actions'
import { formatNumero, formatTexto } from '@/lib/format'
import {
  ESTADOS_EMBARQUE,
  ESTADOS_ETIQUETADO,
  ESTADOS_RECEPCION,
  ESTADOS_SURTIDO,
  ESTADO_EMBARQUE,
  ESTADO_ETIQUETADO,
  ESTADO_RECEPCION,
  ESTADO_SURTIDO,
  PRIORIDADES,
  PRIORIDAD_CONFIG,
} from '@/lib/status-config'
import type {
  Embarque,
  EstadoEmbarque,
  EstadoEtiquetado,
  EstadoRecepcion,
  EstadoSurtido,
  LoteEtiquetado,
  PedidoSurtido,
  Prioridad,
  Recepcion,
} from '@/types/cedis'

/** Los inputs numéricos viajan como texto; vacío significa "sin capturar". */
function aNumero(valor: string | undefined): number | null {
  if (!valor || valor.trim() === '') return null
  const numero = Number(valor)
  return Number.isNaN(numero) ? null : numero
}

function aTexto(valor: string | undefined): string | null {
  if (!valor || valor.trim() === '') return null
  return valor.trim()
}

const CLASE_NUMERO = 'text-right font-mono tabular-nums'

// ---------------------------------------------------------------------------
// Embarques
// ---------------------------------------------------------------------------

export const CONFIG_EMBARQUES: ConfigModulo<Embarque> = {
  singular: 'embarque',
  etiquetaNuevo: 'Nuevo embarque',
  tituloAlta: 'Nuevo embarque',
  prefijoFolio: 'EMB',
  campoFolio: 'folio',
  estados: ESTADOS_EMBARQUE,
  estadoConfig: ESTADO_EMBARQUE,
  columnas: [
    {
      clave: 'folio',
      encabezado: 'Folio',
      celda: (e) => <span className="font-mono text-xs text-foreground">{e.folio}</span>,
    },
    { clave: 'destino', encabezado: 'Destino', celda: (e) => e.destino },
    {
      clave: 'transportista',
      encabezado: 'Transportista',
      celda: (e) => <span className="text-muted-foreground">{e.transportista}</span>,
    },
    {
      clave: 'unidades',
      encabezado: 'Unidades',
      className: CLASE_NUMERO,
      classNameEncabezado: 'text-right',
      celda: (e) => formatNumero(e.unidades),
    },
    {
      clave: 'hora_salida',
      encabezado: 'Hora salida',
      celda: (e) => (
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {formatTexto(e.hora_salida)}
        </span>
      ),
    },
  ],
  campos: [
    { nombre: 'folio', etiqueta: 'Folio', tipo: 'text', placeholder: 'EMB-0000' },
    { nombre: 'destino', etiqueta: 'Destino', tipo: 'text', requerido: true },
    { nombre: 'transportista', etiqueta: 'Transportista', tipo: 'text', requerido: true },
    { nombre: 'unidades', etiqueta: 'Unidades', tipo: 'number' },
    { nombre: 'hora_salida', etiqueta: 'Hora de salida', tipo: 'text', placeholder: '08:00' },
    {
      nombre: 'estado',
      etiqueta: 'Estatus inicial',
      tipo: 'select',
      opciones: ESTADOS_EMBARQUE,
      valorInicial: 'programado',
    },
  ],
  crear: (v) =>
    accionCrearEmbarque({
      folio: v.folio,
      destino: v.destino,
      transportista: v.transportista,
      unidades: aNumero(v.unidades),
      hora_salida: aTexto(v.hora_salida),
      estado: (v.estado || 'programado') as EstadoEmbarque,
    }),
  cambiarEstado: (registro, estado) =>
    accionActualizarEstadoEmbarque(registro.id, estado as EstadoEmbarque),
  eliminar: (id) => accionEliminarEmbarque(id),
}

// ---------------------------------------------------------------------------
// Recepciones
// ---------------------------------------------------------------------------

export const CONFIG_RECEPCIONES: ConfigModulo<Recepcion> = {
  singular: 'recepción',
  etiquetaNuevo: 'Nueva recepción',
  tituloAlta: 'Nueva recepción',
  prefijoFolio: 'REC',
  campoFolio: 'folio',
  estados: ESTADOS_RECEPCION,
  estadoConfig: ESTADO_RECEPCION,
  columnas: [
    {
      clave: 'folio',
      encabezado: 'Folio',
      celda: (r) => <span className="font-mono text-xs text-foreground">{r.folio}</span>,
    },
    { clave: 'proveedor', encabezado: 'Proveedor', celda: (r) => r.proveedor },
    {
      clave: 'anden',
      encabezado: 'Andén',
      celda: (r) => (
        <span className="font-mono text-xs text-muted-foreground">{formatTexto(r.anden)}</span>
      ),
    },
    {
      clave: 'unidades',
      encabezado: 'Unidades',
      className: CLASE_NUMERO,
      classNameEncabezado: 'text-right',
      celda: (r) => formatNumero(r.unidades),
    },
    {
      clave: 'tipo',
      encabezado: 'Tipo mercancía',
      celda: (r) => <span className="text-muted-foreground">{formatTexto(r.tipo)}</span>,
    },
  ],
  campos: [
    { nombre: 'folio', etiqueta: 'Folio', tipo: 'text', placeholder: 'REC-0000' },
    { nombre: 'proveedor', etiqueta: 'Proveedor', tipo: 'text', requerido: true },
    { nombre: 'anden', etiqueta: 'Andén', tipo: 'text', placeholder: 'R-01' },
    { nombre: 'unidades', etiqueta: 'Unidades', tipo: 'number' },
    { nombre: 'tipo', etiqueta: 'Tipo de mercancía', tipo: 'text' },
    {
      nombre: 'estado',
      etiqueta: 'Estatus inicial',
      tipo: 'select',
      opciones: ESTADOS_RECEPCION,
      valorInicial: 'programada',
    },
  ],
  crear: (v) =>
    accionCrearRecepcion({
      folio: v.folio,
      proveedor: v.proveedor,
      anden: aTexto(v.anden),
      unidades: aNumero(v.unidades),
      tipo: aTexto(v.tipo),
      estado: (v.estado || 'programada') as EstadoRecepcion,
    }),
  // El SP conserva el andén actual cuando llega null, así que se reenvía.
  cambiarEstado: (registro, estado) =>
    accionActualizarEstadoRecepcion(registro.id, estado as EstadoRecepcion, registro.anden),
  eliminar: (id) => accionEliminarRecepcion(id),
}

// ---------------------------------------------------------------------------
// Surtido
// ---------------------------------------------------------------------------

export const CONFIG_SURTIDO: ConfigModulo<PedidoSurtido> = {
  singular: 'pedido',
  etiquetaNuevo: 'Nuevo pedido',
  tituloAlta: 'Nuevo pedido de surtido',
  prefijoFolio: 'PED',
  campoFolio: 'pedido',
  estados: ESTADOS_SURTIDO,
  estadoConfig: ESTADO_SURTIDO,
  columnas: [
    {
      clave: 'pedido',
      encabezado: 'Pedido',
      celda: (p) => <span className="font-mono text-xs text-foreground">{p.pedido}</span>,
    },
    { clave: 'cliente', encabezado: 'Cliente', celda: (p) => p.cliente },
    {
      clave: 'lineas',
      encabezado: 'Líneas',
      className: CLASE_NUMERO,
      classNameEncabezado: 'text-right',
      celda: (p) => formatNumero(p.lineas),
    },
    {
      clave: 'operador',
      encabezado: 'Operador',
      celda: (p) => <span className="text-muted-foreground">{formatTexto(p.operador)}</span>,
    },
    {
      clave: 'prioridad',
      encabezado: 'Prioridad',
      celda: (p) => (
        <EstadoBadge config={PRIORIDAD_CONFIG[p.prioridad] ?? PRIORIDAD_CONFIG.Media} />
      ),
    },
  ],
  campos: [
    { nombre: 'pedido', etiqueta: 'No. de pedido', tipo: 'text', placeholder: 'PED-0000' },
    { nombre: 'cliente', etiqueta: 'Cliente', tipo: 'text', requerido: true },
    { nombre: 'lineas', etiqueta: 'Líneas a surtir', tipo: 'number' },
    { nombre: 'operador', etiqueta: 'Operador asignado', tipo: 'text' },
    {
      nombre: 'prioridad',
      etiqueta: 'Prioridad',
      tipo: 'select',
      opciones: PRIORIDADES,
      valorInicial: 'Media',
    },
    {
      nombre: 'estado',
      etiqueta: 'Estatus inicial',
      tipo: 'select',
      opciones: ESTADOS_SURTIDO,
      valorInicial: 'pendiente',
    },
  ],
  crear: (v) =>
    accionCrearPedidoSurtido({
      pedido: v.pedido,
      cliente: v.cliente,
      lineas: aNumero(v.lineas),
      operador: aTexto(v.operador),
      prioridad: (v.prioridad || 'Media') as Prioridad,
      estado: (v.estado || 'pendiente') as EstadoSurtido,
    }),
  // Sin operador el SP rechaza el paso a 'surtiendo'; se reenvía el asignado.
  cambiarEstado: (registro, estado) =>
    accionActualizarEstadoSurtido(registro.id, estado as EstadoSurtido, registro.operador),
  eliminar: (id) => accionEliminarPedidoSurtido(id),
}

// ---------------------------------------------------------------------------
// Etiquetado
// ---------------------------------------------------------------------------

export const CONFIG_ETIQUETADO: ConfigModulo<LoteEtiquetado> = {
  singular: 'lote',
  etiquetaNuevo: 'Nuevo lote',
  tituloAlta: 'Nuevo lote de etiquetado',
  prefijoFolio: 'LOT',
  campoFolio: 'lote',
  estados: ESTADOS_ETIQUETADO,
  estadoConfig: ESTADO_ETIQUETADO,
  estadoQuePideMotivo: 'rechazado',
  columnas: [
    {
      clave: 'lote',
      encabezado: 'Lote',
      celda: (l) => <span className="font-mono text-xs text-foreground">{l.lote}</span>,
    },
    { clave: 'producto', encabezado: 'Producto', celda: (l) => l.producto },
    {
      clave: 'unidades',
      encabezado: 'Unidades',
      className: CLASE_NUMERO,
      classNameEncabezado: 'text-right',
      celda: (l) => formatNumero(l.unidades),
    },
    {
      clave: 'operador',
      encabezado: 'Operador',
      celda: (l) => <span className="text-muted-foreground">{formatTexto(l.operador)}</span>,
    },
    {
      clave: 'motivo_rechazo',
      encabezado: 'Motivo rechazo',
      className: 'max-w-xs whitespace-normal',
      celda: (l) =>
        l.motivo_rechazo ? (
          <span className="text-xs text-destructive">{l.motivo_rechazo}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ],
  campos: [
    { nombre: 'lote', etiqueta: 'Lote', tipo: 'text', placeholder: 'LOT-0000' },
    { nombre: 'producto', etiqueta: 'Producto', tipo: 'text', requerido: true },
    { nombre: 'unidades', etiqueta: 'Unidades', tipo: 'number' },
    { nombre: 'operador', etiqueta: 'Operador asignado', tipo: 'text' },
    {
      nombre: 'estado',
      etiqueta: 'Estatus inicial',
      tipo: 'select',
      opciones: ESTADOS_ETIQUETADO,
      valorInicial: 'pendiente',
    },
  ],
  crear: (v) =>
    accionCrearLoteEtiquetado({
      lote: v.lote,
      producto: v.producto,
      unidades: aNumero(v.unidades),
      operador: aTexto(v.operador),
      estado: (v.estado || 'pendiente') as EstadoEtiquetado,
    }),
  cambiarEstado: (registro, estado, motivoRechazo) =>
    accionActualizarEstadoEtiquetado(registro.id, estado as EstadoEtiquetado, motivoRechazo),
  eliminar: (id) => accionEliminarLoteEtiquetado(id),
}

// ---------------------------------------------------------------------------
// Vistas por módulo — el server component solo pasa los registros.
// ---------------------------------------------------------------------------

export function EmbarquesControl({ registros }: { registros: Embarque[] }) {
  return <ModuleControlView config={CONFIG_EMBARQUES} registros={registros} />
}

export function RecepcionesControl({ registros }: { registros: Recepcion[] }) {
  return <ModuleControlView config={CONFIG_RECEPCIONES} registros={registros} />
}

export function SurtidoControl({ registros }: { registros: PedidoSurtido[] }) {
  return <ModuleControlView config={CONFIG_SURTIDO} registros={registros} />
}

export function EtiquetadoControl({ registros }: { registros: LoteEtiquetado[] }) {
  return <ModuleControlView config={CONFIG_ETIQUETADO} registros={registros} />
}

/** El topbar arma su botón de alta a partir de la ruta activa. */
export const CREACION_POR_RUTA: Record<string, ConfigCreacion> = {
  '/embarques': CONFIG_EMBARQUES,
  '/recepciones': CONFIG_RECEPCIONES,
  '/surtido': CONFIG_SURTIDO,
  '/etiquetado': CONFIG_ETIQUETADO,
}
