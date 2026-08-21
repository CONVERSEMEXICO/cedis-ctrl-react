'use client'

// Diálogo de alta genérico de los módulos operativos. Lo usan tanto la toolbar
// de la vista del módulo como el topbar, con la misma `ConfigCreacion`.

import { Plus } from 'lucide-react'
import { useState } from 'react'
import type { ConfigCreacion } from '@/components/modulos/tipos'
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

function valoresIniciales(config: ConfigCreacion): Record<string, string> {
  const valores: Record<string, string> = {}
  for (const campo of config.campos) {
    valores[campo.nombre] = campo.valorInicial ?? ''
  }
  return valores
}

/** Folio de respaldo cuando el operador deja el campo vacío: EMB-4821. */
function folioAutomatico(prefijo: string): string {
  return `${prefijo}-${Math.floor(1000 + Math.random() * 9000)}`
}

export function CrearRegistroDialog({ config }: { config: ConfigCreacion }) {
  const { ejecutar } = useOperacionCedis()
  const [abierto, setAbierto] = useState(false)
  const [valores, setValores] = useState<Record<string, string>>(() => valoresIniciales(config))
  const [enviando, setEnviando] = useState(false)

  function actualizar(nombre: string, valor: string) {
    setValores((previos) => ({ ...previos, [nombre]: valor }))
  }

  async function alEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (enviando) return

    const datos = { ...valores }
    if (!datos[config.campoFolio] || datos[config.campoFolio].trim() === '') {
      datos[config.campoFolio] = folioAutomatico(config.prefijoFolio)
    }

    setEnviando(true)
    const creado = await ejecutar(
      (token) => config.crear(token, datos),
      'Registro creado correctamente',
    )
    setEnviando(false)

    if (!creado) return

    setValores(valoresIniciales(config))
    setAbierto(false)
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus data-icon="inline-start" />
        {config.etiquetaNuevo}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{config.tituloAlta}</DialogTitle>
          <DialogDescription>
            El folio se genera solo si lo dejas vacío. Los campos de fecha los sella el servidor.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={alEnviar}>
          <FieldGroup>
            {config.campos.map((campo) => {
              const id = `${config.prefijoFolio}-${campo.nombre}`
              return (
                <Field key={campo.nombre}>
                  <FieldLabel htmlFor={id}>{campo.etiqueta}</FieldLabel>
                  {campo.tipo === 'select' ? (
                    <Select
                      value={valores[campo.nombre] ?? ''}
                      onValueChange={(valor) => actualizar(campo.nombre, String(valor))}
                    >
                      <SelectTrigger id={id} className="w-full">
                        <SelectValue>
                          {(valor) =>
                            campo.opciones?.find((o) => o.value === String(valor))?.label ??
                            'Selecciona una opción'
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {campo.opciones?.map((opcion) => (
                            <SelectItem key={opcion.value} value={opcion.value}>
                              {opcion.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={id}
                      type={campo.tipo}
                      inputMode={campo.tipo === 'number' ? 'numeric' : undefined}
                      min={campo.tipo === 'number' ? 0 : undefined}
                      placeholder={campo.placeholder}
                      required={campo.requerido}
                      value={valores[campo.nombre] ?? ''}
                      onChange={(evento) => actualizar(campo.nombre, evento.target.value)}
                    />
                  )}
                </Field>
              )
            })}
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
