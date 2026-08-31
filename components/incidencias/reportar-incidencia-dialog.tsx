'use client'

import { Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { usePermission } from '@/hooks/use-permission'
import { MENSAJE_SIN_PERMISO } from '@/lib/auth/permissions'
import type { ModuloOperativo, Severidad, TipoIncidencia } from '@/types/cedis'

const TIPOS: { value: TipoIncidencia; label: string }[] = [
  { value: 'dano_mercancia', label: 'Daño a mercancía' },
  { value: 'faltante', label: 'Faltante' },
  { value: 'retraso_transporte', label: 'Retraso de transporte' },
  { value: 'error_surtido', label: 'Error de surtido' },
  { value: 'falla_equipo', label: 'Falla de equipo' },
  { value: 'seguridad', label: 'Seguridad' },
  { value: 'discrepancia_inventario', label: 'Discrepancia de inventario' },
  { value: 'etiquetado_rechazado', label: 'Etiquetado rechazado' },
]

const SEVERIDADES: { value: Severidad; label: string }[] = [
  { value: 'baja', label: 'Baja' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
  { value: 'critica', label: 'Crítica' },
]

const MODULOS: { value: ModuloOperativo; label: string }[] = [
  { value: 'embarques', label: 'Embarques' },
  { value: 'recepciones', label: 'Recepciones' },
  { value: 'surtido', label: 'Surtido' },
  { value: 'etiquetado', label: 'Etiquetado' },
  { value: 'productividad', label: 'Productividad' },
  { value: 'incidencias', label: 'Incidencias' },
]

const MODULO_POR_DEFECTO: ModuloOperativo = 'surtido'

/**
 * `moduloInicial` es el módulo desde el que se abre el diálogo (lo pasa el
 * topbar según la ruta). Se re-aplica en cada apertura porque el topbar no se
 * desmonta al navegar entre módulos.
 */
export function ReportarIncidenciaDialog({
  moduloInicial,
}: {
  moduloInicial?: ModuloOperativo
}) {
  const puedeReportar = usePermission('reportar_incidencia')
  const [open, setOpen] = useState(false)
  const [modulo, setModulo] = useState<ModuloOperativo>(moduloInicial ?? MODULO_POR_DEFECTO)

  function handleOpenChange(abierto: boolean) {
    if (abierto) setModulo(moduloInicial ?? MODULO_POR_DEFECTO)
    setOpen(abierto)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // El guard se repite aquí y no solo en el render: si alguien invoca el
    // handler a mano —desde la consola, o porque un refactor deja el botón
    // visible— el toast es el mismo que devuelve el 403 del servidor.
    if (!puedeReportar) {
      toast.error(MENSAJE_SIN_PERMISO)
      return
    }
    toast.success('Incidencia reportada', {
      description: 'Se registró la incidencia y se notificó al responsable del módulo.',
    })
    setOpen(false)
  }

  if (!puedeReportar) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" variant="destructive" />}>
        <Plus data-icon="inline-start" />
        Reportar incidencia
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reportar incidencia</DialogTitle>
          <DialogDescription>
            Registra una incidencia operativa para dar seguimiento y asignar responsable.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="modulo">Módulo</FieldLabel>
              <Select
                name="modulo"
                value={modulo}
                onValueChange={(valor) => setModulo(String(valor) as ModuloOperativo)}
              >
                <SelectTrigger id="modulo">
                  <SelectValue>
                    {(value: ModuloOperativo) =>
                      MODULOS.find((m) => m.value === value)?.label ?? 'Selecciona un módulo'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {MODULOS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="tipo">Tipo de incidencia</FieldLabel>
              <Select name="tipo" defaultValue={TIPOS[0].value}>
                <SelectTrigger id="tipo">
                  <SelectValue>
                    {(value: TipoIncidencia) =>
                      TIPOS.find((t) => t.value === value)?.label ?? 'Selecciona un tipo'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {TIPOS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="severidad">Severidad</FieldLabel>
              <Select name="severidad" defaultValue="media">
                <SelectTrigger id="severidad">
                  <SelectValue>
                    {(value: Severidad) =>
                      SEVERIDADES.find((s) => s.value === value)?.label ?? 'Selecciona severidad'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {SEVERIDADES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="descripcion">Descripción</FieldLabel>
              <Textarea
                id="descripcion"
                name="descripcion"
                placeholder="Describe lo ocurrido, folio relacionado y ubicación..."
                required
                rows={3}
              />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit">Reportar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
