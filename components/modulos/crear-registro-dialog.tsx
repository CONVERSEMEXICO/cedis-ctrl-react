'use client'

// Diálogo de alta genérico de los módulos operativos. Lo usan tanto la toolbar
// de la vista del módulo como el topbar, con la misma `ConfigCreacion`.
//
// El permiso se verifica aquí y no en los dos llamadores: sin
// `crear_registro` el componente no renderiza nada, así que ni la toolbar ni el
// topbar pueden ofrecer el alta por descuido.

import { Plus } from 'lucide-react'
import { useState } from 'react'
import { SIN_VALOR, type CampoCreacion, type ConfigCreacion } from '@/components/modulos/tipos'
import { useDatosCedis } from '@/components/providers/cedis-data-provider'
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
import type { DatosCedis } from '@/lib/data'
import { nuevoId } from '@/lib/ids'

function valoresIniciales(config: ConfigCreacion): Record<string, string> {
  const valores: Record<string, string> = {}
  for (const campo of config.campos) {
    valores[campo.nombre] = campo.valorInicial ?? ''
  }
  return valores
}

/**
 * Opciones que se pintan en un select: las de la config, o las que salen de los
 * datos ya cargados. Un campo con `vacio` abre la lista con esa entrada, que es
 * cómo se deselecciona un campo opcional.
 */
function resolverOpciones(campo: CampoCreacion, datos: DatosCedis) {
  const base = campo.opcionesDe ? campo.opcionesDe(datos) : (campo.opciones ?? [])
  return campo.vacio ? [{ value: SIN_VALOR, label: campo.vacio }, ...base] : base
}

/** Folio de respaldo cuando el operador deja el campo vacío: EMB-4821. */
function folioAutomatico(prefijo: string): string {
  return `${prefijo}-${Math.floor(1000 + Math.random() * 9000)}`
}

export function CrearRegistroDialog({ config }: { config: ConfigCreacion }) {
  const { ejecutar } = useOperacionCedis()
  const { datos } = useDatosCedis()
  const puedeCrear = usePermission('crear_registro')
  const [abierto, setAbierto] = useState(false)
  const [valores, setValores] = useState<Record<string, string>>(() => valoresIniciales(config))
  const [enviando, setEnviando] = useState(false)
  // Se fija al abrir, no al enviar: un reintento después de una respuesta
  // perdida tiene que llevar el mismo id para que el SP lo reconozca en vez de
  // crear un segundo registro. Solo lo usan las altas que van por SP con id.
  const [idOperacion, setIdOperacion] = useState(() => nuevoId(config.prefijoFolio.toLowerCase()))

  function actualizar(nombre: string, valor: string) {
    setValores((previos) => ({ ...previos, [nombre]: valor }))
  }

  function alAbrir(valor: boolean) {
    if (valor) setIdOperacion(nuevoId(config.prefijoFolio.toLowerCase()))
    setAbierto(valor)
  }

  async function alEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (enviando) return

    const enviados = { ...valores }
    if (!enviados[config.campoFolio] || enviados[config.campoFolio].trim() === '') {
      enviados[config.campoFolio] = folioAutomatico(config.prefijoFolio)
    }
    // El centinela del "sin elegir" no sale del diálogo: la config recibe la
    // cadena vacía, que es lo que ya sabe traducir a null.
    for (const [nombre, valor] of Object.entries(enviados)) {
      if (valor === SIN_VALOR) enviados[nombre] = ''
    }

    setEnviando(true)
    const creado = await ejecutar(
      config.accionDe?.(enviados) ?? 'crear_registro',
      (tokens) => config.crear(tokens, enviados, { datos, idOperacion }),
      'Registro creado correctamente',
    )
    setEnviando(false)

    if (!creado) return

    setValores(valoresIniciales(config))
    setAbierto(false)
  }

  if (!puedeCrear) return null

  return (
    <Dialog open={abierto} onOpenChange={alAbrir}>
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
              const opciones = resolverOpciones(campo, datos)
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
                            opciones.find((o) => o.value === String(valor))?.label ??
                            'Selecciona una opción'
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {opciones.map((opcion) => (
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
                  {campo.ayuda && (
                    <p className="text-xs text-muted-foreground">{campo.ayuda}</p>
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
