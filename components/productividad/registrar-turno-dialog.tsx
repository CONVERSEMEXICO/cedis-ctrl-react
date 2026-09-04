'use client'

// Alta de un turno de productividad. No usa la mutation CRUD: va por el stored
// procedure RegistrarProductividad, que valida turno, horas y meta, y es
// idempotente sobre el id — por eso el id se genera aquí, en el cliente.

import { Plus } from 'lucide-react'
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
import { accionRegistrarProductividad } from '@/lib/actions'
import { AREAS, TURNOS } from '@/lib/status-config'
import type { Turno } from '@/types/cedis'

const VALORES_INICIALES = {
  operador: '',
  area: 'Surtido',
  turno: 'matutino',
  unidades: '',
  horas: '8',
  meta: '',
}

function nuevoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

export function RegistrarTurnoDialog() {
  const { ejecutar } = useOperacionCedis()
  // Igual que en el alta de módulos, el permiso se verifica en el componente:
  // así lo cubren de una vez el topbar y el encabezado de la página.
  const puedeRegistrar = usePermission('registrar_turno_productividad')
  const [abierto, setAbierto] = useState(false)
  const [valores, setValores] = useState(VALORES_INICIALES)
  const [enviando, setEnviando] = useState(false)

  function actualizar(campo: keyof typeof VALORES_INICIALES, valor: string) {
    setValores((previos) => ({ ...previos, [campo]: valor }))
  }

  async function alEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (enviando) return

    setEnviando(true)
    const creado = await ejecutar(
      'registrar_turno_productividad',
      (tokens) =>
        accionRegistrarProductividad(tokens, {
          id: nuevoId(),
          operador: valores.operador.trim(),
          area: valores.area,
          turno: valores.turno as Turno,
          unidades: Number(valores.unidades),
          horas: Number(valores.horas),
          meta: Number(valores.meta),
        }),
      'Registro creado correctamente',
    )
    setEnviando(false)

    if (!creado) return

    setValores(VALORES_INICIALES)
    setAbierto(false)
  }

  if (!puedeRegistrar) return null

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus data-icon="inline-start" />
        Registrar turno
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar turno</DialogTitle>
          <DialogDescription>
            Captura lo producido en el turno: el ritmo por hora y el cumplimiento se calculan solos.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={alEnviar}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="prod-operador">Operador</FieldLabel>
              <Input
                id="prod-operador"
                required
                value={valores.operador}
                onChange={(evento) => actualizar('operador', evento.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="prod-area">Área</FieldLabel>
              <Select
                value={valores.area}
                onValueChange={(valor) => actualizar('area', String(valor))}
              >
                <SelectTrigger id="prod-area" className="w-full">
                  <SelectValue>
                    {(valor) =>
                      AREAS.find((a) => a.value === String(valor))?.label ?? 'Selecciona un área'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {AREAS.map((area) => (
                      <SelectItem key={area.value} value={area.value}>
                        {area.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="prod-turno">Turno</FieldLabel>
              <Select
                value={valores.turno}
                onValueChange={(valor) => actualizar('turno', String(valor))}
              >
                <SelectTrigger id="prod-turno" className="w-full">
                  <SelectValue>
                    {(valor) =>
                      TURNOS.find((t) => t.value === String(valor))?.label ?? 'Selecciona un turno'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {TURNOS.map((turno) => (
                      <SelectItem key={turno.value} value={turno.value}>
                        {turno.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="prod-unidades">Unidades procesadas</FieldLabel>
              <Input
                id="prod-unidades"
                type="number"
                inputMode="numeric"
                min={0}
                required
                value={valores.unidades}
                onChange={(evento) => actualizar('unidades', evento.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="prod-horas">Horas trabajadas</FieldLabel>
              <Input
                id="prod-horas"
                type="number"
                inputMode="decimal"
                min={0.5}
                step={0.5}
                required
                value={valores.horas}
                onChange={(evento) => actualizar('horas', evento.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="prod-meta">Meta del turno</FieldLabel>
              <Input
                id="prod-meta"
                type="number"
                inputMode="numeric"
                min={1}
                required
                value={valores.meta}
                onChange={(evento) => actualizar('meta', evento.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={enviando}>
              {enviando ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
