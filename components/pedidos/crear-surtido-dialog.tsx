'use client'

// Diálogo para abrir la orden de surtido de un pedido capturado.
//
// No reutiliza <CrearRegistroDialog> a propósito: aquel arma un alta a partir
// de campos sueltos, y aquí la mitad de los datos —folio, cliente, líneas— no
// se capturan sino que se copian del pedido y se muestran de solo lectura. Lo
// que sí se comparte es la mecánica de escritura: `useOperacionCedis`, que
// verifica el permiso, avisa por toast y refresca.
//
// No hay campo de estatus inicial: `executeCrearSurtidoDesdePedido` no recibe
// `estado` y el surtido siempre nace 'pendiente'. Para arrancarlo se cambia el
// estatus desde el módulo de surtido, que es donde vive la regla de que no se
// pasa a 'surtiendo' sin operador asignado.

import { useState } from 'react'
import type { Pedido } from '@/types/cedis'
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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useOperacionCedis } from '@/hooks/use-operacion-cedis'
import { usePermission } from '@/hooks/use-permission'
import { accionCrearSurtidoDesdePedido } from '@/lib/actions'
import { nuevoId } from '@/lib/ids'
import { PRIORIDADES } from '@/lib/status-config'
import type { Prioridad } from '@/types/cedis'

export const TOAST_SURTIDO_CREADO = 'Surtido creado desde pedido.'

function Resumen({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs text-muted-foreground">{etiqueta}</span>
      <span className="text-sm text-foreground">{valor}</span>
    </div>
  )
}

export function CrearSurtidoDialog({ pedido, lineas }: { pedido: Pedido; lineas: number }) {
  const { ejecutar } = useOperacionCedis()
  const puedeCrear = usePermission('crear_surtido_desde_pedido')
  const [abierto, setAbierto] = useState(false)
  const [operador, setOperador] = useState('')
  const [prioridad, setPrioridad] = useState<Prioridad>('Media')
  const [enviando, setEnviando] = useState(false)
  // El id se fija al abrir y no al enviar: si el primer intento falla a medio
  // camino y el operador vuelve a guardar, el reintento cae sobre el mismo id
  // en el SP en vez de abrir un segundo surtido para el mismo pedido.
  const [id, setId] = useState(() => nuevoId('srt'))

  function alAbrir(valor: boolean) {
    if (valor) {
      setId(nuevoId('srt'))
      setOperador('')
      setPrioridad('Media')
    }
    setAbierto(valor)
  }

  async function alEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (enviando) return

    setEnviando(true)
    const creado = await ejecutar(
      'crear_surtido_desde_pedido',
      (tokens) =>
        accionCrearSurtidoDesdePedido(tokens, {
          id,
          pedido_id: pedido.id,
          // Del pedido, nunca de un campo capturado: el SP los guarda tal cual.
          pedido: pedido.folio,
          cliente: pedido.cliente,
          lineas,
          operador: operador.trim() === '' ? null : operador.trim(),
          prioridad,
        }),
      TOAST_SURTIDO_CREADO,
    )
    setEnviando(false)

    // Si falló, el diálogo se queda abierto con lo capturado: el toast de error
    // ya lo puso `ejecutar` y volver a teclear todo sería el peor de los casos.
    if (!creado) return
    setAbierto(false)
  }

  if (!puedeCrear) return null

  return (
    <Dialog open={abierto} onOpenChange={alAbrir}>
      <DialogTrigger
        render={<Button size="sm" />}
        onClick={(evento) => evento.stopPropagation()}
      >
        Crear surtido
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" onClick={(evento) => evento.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Crear surtido desde pedido</DialogTitle>
          <DialogDescription>
            El folio, el cliente y el conteo de líneas se copian del pedido. Al guardar, el surtido
            nace &laquo;pendiente&raquo; y el pedido pasa a &laquo;asignado&raquo;.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/40 p-3">
          <Resumen etiqueta="Folio del pedido" valor={pedido.folio} />
          <Resumen etiqueta="Cliente" valor={pedido.cliente} />
          <Resumen etiqueta="Líneas" valor={String(lineas)} />
        </div>

        <form onSubmit={alEnviar}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="surtido-operador">Operador asignado</FieldLabel>
              <Input
                id="surtido-operador"
                value={operador}
                onChange={(evento) => setOperador(evento.target.value)}
                placeholder="Nombre del operador"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="surtido-prioridad">Prioridad</FieldLabel>
              <Select
                value={prioridad}
                onValueChange={(valor) => setPrioridad(String(valor) as Prioridad)}
              >
                <SelectTrigger id="surtido-prioridad" className="w-full">
                  <SelectValue>
                    {(valor) =>
                      PRIORIDADES.find((o) => o.value === String(valor))?.label ?? 'Media'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {PRIORIDADES.map((opcion) => (
                      <SelectItem key={opcion.value} value={opcion.value}>
                        {opcion.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={enviando}>
              {enviando ? 'Guardando…' : 'Crear surtido'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
