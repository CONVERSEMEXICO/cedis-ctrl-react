// Única puerta de escritura hacia Fabric.
//
// Antes las mutations salían del navegador con el token a la vista: cualquiera
// podía abrir la consola y llamar `executeCrearEmbarque` sin importar su rol,
// porque el scope GraphQLApi.Execute.All da acceso total a la API y Fabric no
// sabe nada de nuestros roles. Ahora toda escritura entra por aquí y lo primero
// que corre es `requirePermission`.
//
// El registro de abajo es la razón de que esto sea un solo Route Handler: cada
// operación declara la acción que exige, y no hay forma de agregar una nueva
// sin decidir quién puede ejecutarla. Un endpoint por módulo repartiría el
// guard en doce archivos, donde el que falte pasa desapercibido.
//
// Las lecturas siguen saliendo del navegador (lib/data.ts): las puede hacer
// cualquier rol, y pasarlas por aquí rompería el respaldo seed.

import type { Action } from '@/lib/auth/permissions'
import {
  ErrorAutorizacion,
  requirePermission,
  respuestaSinPermiso,
} from '@/lib/auth/requirePermission'
import { esSesionExpirada, MENSAJE_SESION_EXPIRADA } from '@/lib/graphql'
import {
  actualizarEstadoEmbarque,
  actualizarEstadoEtiquetado,
  actualizarEstadoRecepcion,
  actualizarEstadoSurtido,
  crearEmbarque,
  crearLoteEtiquetado,
  crearPedidoSurtido,
  crearRecepcion,
  eliminarEmbarque,
  eliminarLoteEtiquetado,
  eliminarPedidoSurtido,
  eliminarRecepcion,
  eliminarRegistroProductividad,
  registrarProductividad,
} from '@/lib/queries'
import type {
  EstadoEmbarque,
  EstadoEtiquetado,
  EstadoRecepcion,
  EstadoSurtido,
  Prioridad,
  Turno,
} from '@/types/cedis'

type Cuerpo = Record<string, unknown>

class ErrorCuerpo extends Error {}

// --- Lectura del cuerpo ----------------------------------------------------
//
// Los campos se extraen uno por uno en vez de reenviar el objeto entero: así el
// cliente no puede colar variables extra en la mutation de GraphQL.

function texto(cuerpo: Cuerpo, campo: string): string {
  const valor = cuerpo[campo]
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw new ErrorCuerpo(`Falta el campo "${campo}"`)
  }
  return valor.trim()
}

function textoOpcional(cuerpo: Cuerpo, campo: string): string | null {
  const valor = cuerpo[campo]
  if (valor === null || valor === undefined || valor === '') return null
  if (typeof valor !== 'string') throw new ErrorCuerpo(`El campo "${campo}" debe ser texto`)
  const limpio = valor.trim()
  return limpio === '' ? null : limpio
}

function numero(cuerpo: Cuerpo, campo: string): number {
  const valor = cuerpo[campo]
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new ErrorCuerpo(`El campo "${campo}" debe ser un número`)
  }
  return valor
}

function numeroOpcional(cuerpo: Cuerpo, campo: string): number | null {
  const valor = cuerpo[campo]
  if (valor === null || valor === undefined || valor === '') return null
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new ErrorCuerpo(`El campo "${campo}" debe ser un número`)
  }
  return valor
}

// --- Registro de operaciones ----------------------------------------------

interface OperacionServidor {
  /** Permiso que exige la operación antes de tocar Fabric. */
  accion: Action
  ejecutar: (token: string, cuerpo: Cuerpo) => Promise<unknown>
}

const OPERACIONES: Record<string, OperacionServidor> = {
  // Embarques
  crearEmbarque: {
    accion: 'crear_registro',
    ejecutar: (token, c) =>
      crearEmbarque(token, {
        folio: texto(c, 'folio'),
        destino: texto(c, 'destino'),
        transportista: texto(c, 'transportista'),
        unidades: numeroOpcional(c, 'unidades'),
        hora_salida: textoOpcional(c, 'hora_salida'),
        estado: (textoOpcional(c, 'estado') ?? 'programado') as EstadoEmbarque,
      }),
  },
  actualizarEstadoEmbarque: {
    accion: 'cambiar_estatus_registro',
    ejecutar: (token, c) =>
      actualizarEstadoEmbarque(token, texto(c, 'id'), texto(c, 'estado') as EstadoEmbarque),
  },
  eliminarEmbarque: {
    accion: 'eliminar_registro',
    ejecutar: (token, c) => eliminarEmbarque(token, texto(c, 'id')),
  },

  // Recepciones
  crearRecepcion: {
    accion: 'crear_registro',
    ejecutar: (token, c) =>
      crearRecepcion(token, {
        folio: texto(c, 'folio'),
        proveedor: texto(c, 'proveedor'),
        anden: textoOpcional(c, 'anden'),
        unidades: numeroOpcional(c, 'unidades'),
        tipo: textoOpcional(c, 'tipo'),
        estado: (textoOpcional(c, 'estado') ?? 'programada') as EstadoRecepcion,
      }),
  },
  actualizarEstadoRecepcion: {
    accion: 'cambiar_estatus_registro',
    ejecutar: (token, c) =>
      actualizarEstadoRecepcion(
        token,
        texto(c, 'id'),
        texto(c, 'estado') as EstadoRecepcion,
        textoOpcional(c, 'anden'),
      ),
  },
  eliminarRecepcion: {
    accion: 'eliminar_registro',
    ejecutar: (token, c) => eliminarRecepcion(token, texto(c, 'id')),
  },

  // Surtido
  crearPedidoSurtido: {
    accion: 'crear_registro',
    ejecutar: (token, c) =>
      crearPedidoSurtido(token, {
        pedido: texto(c, 'pedido'),
        cliente: texto(c, 'cliente'),
        lineas: numeroOpcional(c, 'lineas'),
        operador: textoOpcional(c, 'operador'),
        prioridad: (textoOpcional(c, 'prioridad') ?? 'Media') as Prioridad,
        estado: (textoOpcional(c, 'estado') ?? 'pendiente') as EstadoSurtido,
      }),
  },
  actualizarEstadoSurtido: {
    accion: 'cambiar_estatus_registro',
    ejecutar: (token, c) =>
      actualizarEstadoSurtido(
        token,
        texto(c, 'id'),
        texto(c, 'estado') as EstadoSurtido,
        textoOpcional(c, 'operador'),
      ),
  },
  eliminarPedidoSurtido: {
    accion: 'eliminar_registro',
    ejecutar: (token, c) => eliminarPedidoSurtido(token, texto(c, 'id')),
  },

  // Etiquetado
  crearLoteEtiquetado: {
    accion: 'crear_registro',
    ejecutar: (token, c) =>
      crearLoteEtiquetado(token, {
        lote: texto(c, 'lote'),
        producto: texto(c, 'producto'),
        unidades: numeroOpcional(c, 'unidades'),
        operador: textoOpcional(c, 'operador'),
        estado: (textoOpcional(c, 'estado') ?? 'pendiente') as EstadoEtiquetado,
      }),
  },
  actualizarEstadoEtiquetado: {
    accion: 'cambiar_estatus_registro',
    ejecutar: (token, c) =>
      actualizarEstadoEtiquetado(
        token,
        texto(c, 'id'),
        texto(c, 'estado') as EstadoEtiquetado,
        textoOpcional(c, 'motivo_rechazo'),
      ),
  },
  eliminarLoteEtiquetado: {
    accion: 'eliminar_registro',
    ejecutar: (token, c) => eliminarLoteEtiquetado(token, texto(c, 'id')),
  },

  // Productividad
  registrarProductividad: {
    accion: 'registrar_turno_productividad',
    ejecutar: (token, c) =>
      registrarProductividad(token, {
        id: texto(c, 'id'),
        operador: texto(c, 'operador'),
        area: texto(c, 'area'),
        turno: texto(c, 'turno') as Turno,
        unidades: numero(c, 'unidades'),
        horas: numero(c, 'horas'),
        meta: numero(c, 'meta'),
      }),
  },
  eliminarRegistroProductividad: {
    accion: 'eliminar_registro',
    ejecutar: (token, c) => eliminarRegistroProductividad(token, texto(c, 'id')),
  },
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ operacion: string }> },
) {
  const { operacion: nombre } = await params
  const operacion = OPERACIONES[nombre]

  if (!operacion) {
    return Response.json({ error: 'not_found', mensaje: 'Operación desconocida' }, { status: 404 })
  }

  let sesion
  try {
    sesion = await requirePermission(request, operacion.accion)
  } catch (error) {
    if (error instanceof ErrorAutorizacion) return respuestaSinPermiso(error)
    throw error
  }

  let cuerpo: Cuerpo
  try {
    const json: unknown = await request.json()
    if (json === null || typeof json !== 'object' || Array.isArray(json)) {
      throw new ErrorCuerpo('El cuerpo debe ser un objeto JSON')
    }
    cuerpo = json as Cuerpo
  } catch (error) {
    const mensaje = error instanceof ErrorCuerpo ? error.message : 'El cuerpo no es JSON válido'
    return Response.json({ error: 'bad_request', mensaje }, { status: 400 })
  }

  try {
    const datos = await operacion.ejecutar(sesion.tokenFabric, cuerpo)
    return Response.json({ ok: true, datos })
  } catch (error) {
    if (error instanceof ErrorCuerpo) {
      return Response.json({ error: 'bad_request', mensaje: error.message }, { status: 400 })
    }
    // El 401 de Fabric es el token vencido del usuario, no un problema de
    // permisos: se distingue para que el cliente mande a iniciar sesión.
    if (esSesionExpirada(error)) {
      return Response.json(
        { error: 'unauthorized', mensaje: MENSAJE_SESION_EXPIRADA },
        { status: 401 },
      )
    }
    console.error(`[cedis] ${nombre} falló contra Fabric —`, error)
    return Response.json({ error: 'fabric_error', mensaje: (error as Error).message }, { status: 502 })
  }
}
