'use client'

// Configuración de los cuatro módulos operativos: columnas, campos de alta y
// las operaciones de escritura que ejecuta cada una. Es lo único que distingue a un
// módulo de otro — la mecánica está en <ModuleControlView>.

import Link from 'next/link'
import { EstadoBadge } from '@/components/shared/estado-badge'
import { ModuleControlView } from '@/components/modulos/module-control-view'
import { SurtidoDetalle } from '@/components/modulos/surtido-detalle'
import { SIN_VALOR, type ConfigCreacion, type ConfigModulo } from '@/components/modulos/tipos'
import {
  accionActualizarEstadoEmbarque,
  accionActualizarEstadoEtiquetado,
  accionActualizarEstadoRecepcion,
  accionActualizarEstadoSurtido,
  accionCrearEmbarque,
  accionCrearLoteEtiquetado,
  accionCrearPedidoSurtido,
  accionCrearRecepcion,
  accionCrearSurtidoDesdePedido,
  accionEliminarEmbarque,
  accionEliminarLoteEtiquetado,
  accionEliminarPedidoSurtido,
  accionEliminarRecepcion,
} from '@/lib/actions'
import { formatNumero, formatTexto } from '@/lib/format'
import { conteoLineasPorPedido } from '@/lib/metrics'
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
  crear: (tokens, v) =>
    accionCrearEmbarque(tokens, {
      folio: v.folio,
      destino: v.destino,
      transportista: v.transportista,
      unidades: aNumero(v.unidades),
      hora_salida: aTexto(v.hora_salida),
      estado: (v.estado || 'programado') as EstadoEmbarque,
    }),
  cambiarEstado: (tokens, registro, estado) =>
    accionActualizarEstadoEmbarque(tokens, registro.id, estado as EstadoEmbarque),
  eliminar: (tokens, id) => accionEliminarEmbarque(tokens, id),
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
  crear: (tokens, v) =>
    accionCrearRecepcion(tokens, {
      folio: v.folio,
      proveedor: v.proveedor,
      anden: aTexto(v.anden),
      unidades: aNumero(v.unidades),
      tipo: aTexto(v.tipo),
      estado: (v.estado || 'programada') as EstadoRecepcion,
    }),
  // El SP conserva el andén actual cuando llega null, así que se reenvía.
  cambiarEstado: (tokens, registro, estado) =>
    accionActualizarEstadoRecepcion(tokens, registro.id, estado as EstadoRecepcion, registro.anden),
  eliminar: (tokens, id) => accionEliminarRecepcion(tokens, id),
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
      // El pedido del ERP que originó la orden, no el folio de la orden misma
      // (esa es la columna "Pedido" de arriba). De ahí el nombre.
      clave: 'pedido_id',
      encabezado: 'Pedido origen',
      celda: (p) =>
        p.pedido_id ? (
          <Link
            href={`/pedidos/${p.pedido_id}`}
            className="font-mono text-xs text-pedidos hover:underline hover:underline-offset-2"
          >
            {p.pedido}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
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
    {
      // Salida de emergencia para el alta manual. El camino normal es al revés
      // —abrir el surtido desde /pedidos—, y por eso al elegir un pedido aquí
      // el alta se convierte en esa misma operación: no hay forma de escribir
      // `pedido_id` en un alta suelta, el esquema no expone el parámetro.
      nombre: 'pedido_id',
      etiqueta: 'Pedido asociado (opcional)',
      tipo: 'select',
      valorInicial: SIN_VALOR,
      vacio: 'Sin pedido asociado',
      ayuda:
        'Al elegir un pedido, el folio y el cliente se toman de él —se ignora lo capturado arriba— y el pedido pasa a «asignado».',
      opcionesDe: (datos) =>
        datos.pedidos
          .filter((pedido) => pedido.estado === 'pendiente')
          .map((pedido) => ({ value: pedido.id, label: `${pedido.folio} · ${pedido.cliente}` })),
    },
  ],
  // Con pedido elegido esto NO es un alta suelta: es la misma operación que el
  // botón de /pedidos, para que el pedido y su surtido se muevan juntos. El
  // folio, el cliente y el conteo de líneas salen del pedido y no del
  // formulario — el SP los recibe tal cual y nadie los coteja después.
  accionDe: (v) => (aTexto(v.pedido_id) ? 'crear_surtido_desde_pedido' : 'crear_registro'),
  crear: (tokens, v, { datos, idOperacion }) => {
    const pedidoId = aTexto(v.pedido_id)
    const pedido = pedidoId ? datos.pedidos.find((p) => p.id === pedidoId) : undefined

    if (pedido) {
      return accionCrearSurtidoDesdePedido(tokens, {
        id: idOperacion,
        pedido_id: pedido.id,
        pedido: pedido.folio,
        cliente: pedido.cliente,
        lineas: conteoLineasPorPedido(datos.pedidoLineas)[pedido.id] ?? 0,
        operador: aTexto(v.operador),
        prioridad: (v.prioridad || 'Media') as Prioridad,
      })
    }

    return accionCrearPedidoSurtido(tokens, {
      pedido: v.pedido,
      cliente: v.cliente,
      lineas: aNumero(v.lineas),
      operador: aTexto(v.operador),
      prioridad: (v.prioridad || 'Media') as Prioridad,
      estado: (v.estado || 'pendiente') as EstadoSurtido,
    })
  },
  // Sin operador el SP rechaza el paso a 'surtiendo'; se reenvía el asignado.
  cambiarEstado: (tokens, registro, estado) =>
    accionActualizarEstadoSurtido(tokens, registro.id, estado as EstadoSurtido, registro.operador),
  eliminar: (tokens, id) => accionEliminarPedidoSurtido(tokens, id),
  detalle: {
    titulo: 'Detalle del surtido',
    subtitulo: (registro) => registro.pedido,
    cuerpo: (registro, cerrar) => <SurtidoDetalle registro={registro} cerrar={cerrar} />,
  },
  enfoque: {
    param: 'pedido',
    coincide: (registro, pedidoId) => registro.pedido_id === pedidoId,
    aviso: 'Mostrando solo el surtido del pedido seleccionado.',
  },
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
  crear: (tokens, v) =>
    accionCrearLoteEtiquetado(tokens, {
      lote: v.lote,
      producto: v.producto,
      unidades: aNumero(v.unidades),
      operador: aTexto(v.operador),
      estado: (v.estado || 'pendiente') as EstadoEtiquetado,
    }),
  cambiarEstado: (tokens, registro, estado, motivoRechazo) =>
    accionActualizarEstadoEtiquetado(tokens, registro.id, estado as EstadoEtiquetado, motivoRechazo),
  eliminar: (tokens, id) => accionEliminarLoteEtiquetado(tokens, id),
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
