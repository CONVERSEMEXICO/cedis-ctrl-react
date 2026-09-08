'use client'

// Cancelar un pedido sin pasar por surtido.
//
// Es el único caso en que el panel mueve el estado de un pedido a mano: el paso
// a 'asignado' lo hace el SP junto con el alta del surtido, y 'completado' lo
// cierra la operación. Cancelar es lo que no tiene otro camino, porque no es un
// avance sino una decisión sobre el compromiso con el cliente — de ahí que el
// permiso sea `cambiar_estatus_pedido` (supervisión) y no el del piso.

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useOperacionCedis } from '@/hooks/use-operacion-cedis'
import { usePermission } from '@/hooks/use-permission'
import { accionActualizarEstadoPedido } from '@/lib/actions'
import type { Pedido } from '@/types/cedis'

export function CancelarPedidoDialog({ pedido }: { pedido: Pedido }) {
  const { ejecutar } = useOperacionCedis()
  const puedeCambiar = usePermission('cambiar_estatus_pedido')
  const [abierto, setAbierto] = useState(false)
  const [enviando, setEnviando] = useState(false)

  // Un pedido con surtido abierto no se cancela desde aquí: habría que decidir
  // qué pasa con la orden de piso, y esa decisión no está modelada.
  if (!puedeCambiar || pedido.estado !== 'pendiente') return null

  async function confirmar() {
    if (enviando) return
    setEnviando(true)
    const hecho = await ejecutar(
      'cambiar_estatus_pedido',
      (tokens) => accionActualizarEstadoPedido(tokens, pedido.id, 'cancelado'),
      'Pedido cancelado',
    )
    setEnviando(false)
    if (hecho) setAbierto(false)
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>
        Cancelar pedido
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar {pedido.folio}</DialogTitle>
          <DialogDescription>
            El pedido de {pedido.cliente} queda como cancelado y deja de contar en los indicadores
            de trabajo pendiente. Sus líneas se conservan.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Volver
          </DialogClose>
          <Button type="button" variant="destructive" onClick={confirmar} disabled={enviando}>
            {enviando ? 'Cancelando…' : 'Cancelar pedido'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
