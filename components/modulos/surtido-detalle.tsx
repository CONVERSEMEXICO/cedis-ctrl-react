'use client'

// Cuerpo del panel lateral de un registro de surtido.
//
// Vive aparte de configs.tsx porque necesita el router —el botón que salta al
// pedido cierra el panel y navega— y eso pide un componente, no una función que
// devuelva JSX suelto. La config solo lo monta.

import { ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { EstadoBadge } from '@/components/shared/estado-badge'
import { formatFechaHora, formatNumero, formatTexto } from '@/lib/format'
import { ESTADO_SURTIDO, PRIORIDAD_CONFIG } from '@/lib/status-config'
import type { PedidoSurtido } from '@/types/cedis'

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2 last:border-b-0">
      <span className="shrink-0 text-xs text-muted-foreground">{etiqueta}</span>
      <span className="min-w-0 text-right text-sm text-foreground">{children}</span>
    </div>
  )
}

export function SurtidoDetalle({
  registro,
  cerrar,
}: {
  registro: PedidoSurtido
  cerrar: () => void
}) {
  const router = useRouter()

  function verPedido() {
    if (!registro.pedido_id) return
    // Cerrar antes de navegar: si no, el panel se queda montado sobre la vista
    // nueva hasta que termina la transición de ruta.
    cerrar()
    router.push(`/pedidos/${registro.pedido_id}`)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col">
        <Dato etiqueta="Pedido">
          <span className="font-mono text-xs">{registro.pedido}</span>
        </Dato>
        <Dato etiqueta="Cliente">{registro.cliente}</Dato>
        <Dato etiqueta="Líneas">
          <span className="font-mono tabular-nums">{formatNumero(registro.lineas)}</span>
        </Dato>
        <Dato etiqueta="Operador">
          <span className="text-muted-foreground">{formatTexto(registro.operador)}</span>
        </Dato>
        <Dato etiqueta="Prioridad">
          <EstadoBadge config={PRIORIDAD_CONFIG[registro.prioridad] ?? PRIORIDAD_CONFIG.Media} />
        </Dato>
        <Dato etiqueta="Estatus">
          <EstadoBadge config={ESTADO_SURTIDO[registro.estado] ?? ESTADO_SURTIDO.pendiente} />
        </Dato>
        <Dato etiqueta="Creado">
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {formatFechaHora(registro.created_at)}
          </span>
        </Dato>
        <Dato etiqueta="Actualizado">
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {formatFechaHora(registro.updated_at)}
          </span>
        </Dato>
      </div>

      {registro.pedido_id ? (
        <Button type="button" onClick={verPedido} className="w-full">
          Ver detalle del pedido
          <ArrowRight data-icon="inline-end" />
        </Button>
      ) : (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Este surtido no está vinculado a un pedido capturado.
        </p>
      )}
    </div>
  )
}
