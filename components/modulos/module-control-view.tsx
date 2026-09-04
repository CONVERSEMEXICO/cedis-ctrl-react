'use client'

// Vista de control compartida por los cuatro módulos operativos.
//
// Los cuatro se comportan igual —filtrar por estatus, cambiar el estatus de un
// renglón, dar de alta, eliminar— y solo cambian sus columnas, sus estados y
// las operaciones de escritura que invocan. Todo eso llega en `config`
// (components/modulos/configs.tsx); aquí no hay nada específico de un módulo.

import { Eye, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { CrearRegistroDialog } from '@/components/modulos/crear-registro-dialog'
import type { ConfigModulo, RegistroBase } from '@/components/modulos/tipos'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useOperacionCedis, type OperacionCedis } from '@/hooks/use-operacion-cedis'
import { usePermission } from '@/hooks/use-permission'
import type { Action } from '@/lib/auth/permissions'
import { cn } from '@/lib/utils'

const TODOS = 'todos'

/**
 * `useSearchParams()` obliga a un límite de Suspense en una página que Next
 * prerenderiza, y las cuatro páginas de módulo lo son. Se pone aquí y no en
 * cada página para que ninguna se pueda olvidar de ponerlo y tirar el build.
 */
export function ModuleControlView<T extends RegistroBase>(props: {
  config: ConfigModulo<T>
  registros: T[]
}) {
  return (
    <Suspense fallback={null}>
      <VistaControl {...props} />
    </Suspense>
  )
}

function VistaControl<T extends RegistroBase>({
  config,
  registros,
}: {
  config: ConfigModulo<T>
  registros: T[]
}) {
  const { ejecutar: ejecutarOperacion } = useOperacionCedis()
  // El select de estatus se queda visible para todos los roles —cambiar el
  // estatus es la operación del piso— pero se deshabilita sin permiso. El botón
  // de borrar sí desaparece: no hay estado intermedio que valga la pena mostrar.
  const puedeCambiarEstado = usePermission('cambiar_estatus_registro')
  const puedeEliminar = usePermission('eliminar_registro')
  const [filtro, setFiltro] = useState<string>(TODOS)
  const [idEnCurso, setIdEnCurso] = useState<string | null>(null)
  const [aEliminar, setAEliminar] = useState<T | null>(null)
  const [pideMotivo, setPideMotivo] = useState<T | null>(null)
  const [motivo, setMotivo] = useState('')
  const [detalleDe, setDetalleDe] = useState<T | null>(null)

  // Enfoque por URL: /surtido?pedido=<id> llega desde el módulo de pedidos.
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const valorEnfoque = config.enfoque ? searchParams.get(config.enfoque.param) : null
  const enfoque = config.enfoque
  const enfocado = enfoque && valorEnfoque ? enfoque : null

  const porEstado = filtro === TODOS ? registros : registros.filter((r) => r.estado === filtro)
  // El enfoque se aplica encima del filtro de estatus, no en su lugar: si el
  // registro enfocado no cabe en el estatus elegido, la tabla queda vacía y el
  // aviso explica por qué, en vez de ignorar en silencio uno de los dos.
  const visibles =
    enfocado && valorEnfoque
      ? porEstado.filter((registro) => enfocado.coincide(registro, valorEnfoque))
      : porEstado

  async function ejecutar(
    id: string,
    accion: Action,
    operacion: OperacionCedis,
    exito: string,
  ) {
    setIdEnCurso(id)
    await ejecutarOperacion(accion, operacion, exito)
    setIdEnCurso(null)
  }

  function alCambiarEstado(registro: T, estado: string) {
    if (estado === registro.estado) return
    if (config.estadoQuePideMotivo && estado === config.estadoQuePideMotivo) {
      setMotivo('')
      setPideMotivo(registro)
      return
    }
    void ejecutar(
      registro.id,
      'cambiar_estatus_registro',
      (tokens) => config.cambiarEstado(tokens, registro, estado),
      'Estatus actualizado',
    )
  }

  function confirmarMotivo() {
    const registro = pideMotivo
    const estado = config.estadoQuePideMotivo
    if (!registro || !estado || motivo.trim() === '') return
    setPideMotivo(null)
    void ejecutar(
      registro.id,
      'cambiar_estatus_registro',
      (tokens) => config.cambiarEstado(tokens, registro, estado, motivo.trim()),
      'Estatus actualizado',
    )
  }

  function confirmarEliminar() {
    const registro = aEliminar
    if (!registro) return
    setAEliminar(null)
    void ejecutar(
      registro.id,
      'eliminar_registro',
      (tokens) => config.eliminar(tokens, registro.id),
      'Registro eliminado',
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={filtro} onValueChange={(valor) => setFiltro(String(valor))}>
            <SelectTrigger size="sm" className="w-52" aria-label="Filtrar por estatus">
              <SelectValue>
                {(valor) =>
                  String(valor) === TODOS
                    ? 'Todos los estatus'
                    : (config.estadoConfig[String(valor)]?.label ?? String(valor))
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={TODOS}>Todos los estatus</SelectItem>
                {config.estados.map((estado) => (
                  <SelectItem key={estado.value} value={estado.value}>
                    {estado.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Mostrando{' '}
            <span className="font-mono tabular-nums text-foreground">{visibles.length}</span> de{' '}
            <span className="font-mono tabular-nums text-foreground">{registros.length}</span>{' '}
            registros
          </p>
        </div>
        <CrearRegistroDialog config={config} />
      </div>

      {enfocado && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-pedidos/30 bg-pedidos/10 px-3 py-2 text-xs text-pedidos"
        >
          <span>{enfocado.aviso}</span>
          <Link
            href={pathname}
            className="font-medium underline underline-offset-2 hover:text-foreground"
          >
            Ver todos
          </Link>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {config.columnas.map((columna) => (
                <TableHead
                  key={columna.clave}
                  className={columna.classNameEncabezado ?? columna.className}
                >
                  {columna.encabezado}
                </TableHead>
              ))}
              <TableHead>Estatus</TableHead>
              {config.detalle && (
                <TableHead className="w-10">
                  <span className="sr-only">Ver detalle</span>
                </TableHead>
              )}
              {puedeEliminar && (
                <TableHead className="w-10">
                  <span className="sr-only">Eliminar</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.map((registro) => {
              const estadoCfg = config.estadoConfig[registro.estado]
              const ocupado = idEnCurso === registro.id
              return (
                <TableRow key={registro.id} className={cn(ocupado && 'opacity-60')}>
                  {config.columnas.map((columna) => (
                    <TableCell key={columna.clave} className={columna.className}>
                      {columna.celda(registro)}
                    </TableCell>
                  ))}
                  <TableCell>
                    <Select
                      value={registro.estado}
                      onValueChange={(valor) => alCambiarEstado(registro, String(valor))}
                      disabled={ocupado || !puedeCambiarEstado}
                    >
                      <SelectTrigger
                        size="sm"
                        className={cn('w-40 border-transparent', estadoCfg?.badgeClass)}
                        aria-label="Cambiar estatus"
                      >
                        <span
                          className={cn('size-1.5 shrink-0 rounded-full', estadoCfg?.dotClass)}
                          aria-hidden
                        />
                        <SelectValue>
                          {(valor) =>
                            config.estadoConfig[String(valor)]?.label ?? String(valor)
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {config.estados.map((estado) => (
                            <SelectItem key={estado.value} value={estado.value}>
                              {estado.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  {config.detalle && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDetalleDe(registro)}
                        aria-label={`Ver detalle del ${config.singular}`}
                      >
                        <Eye />
                      </Button>
                    </TableCell>
                  )}
                  {puedeEliminar && (
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        disabled={ocupado}
                        onClick={() => setAEliminar(registro)}
                        aria-label={`Eliminar ${config.singular}`}
                      >
                        <X />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
            {visibles.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={
                    config.columnas.length +
                    1 +
                    (config.detalle ? 1 : 0) +
                    (puedeEliminar ? 1 : 0)
                  }
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  No hay registros con este filtro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={aEliminar !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setAEliminar(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar {config.singular}</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer: el registro se borra de la base de datos del CEDIS.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
            <Button type="button" variant="destructive" onClick={confirmarEliminar}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pideMotivo !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setPideMotivo(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Motivo de rechazo</DialogTitle>
            <DialogDescription>
              Un lote rechazado requiere motivo: queda registrado junto al lote hasta que se
              reanude.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="motivo-rechazo">Motivo</FieldLabel>
            <Input
              id="motivo-rechazo"
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              placeholder="Código de barras ilegible, etiqueta despegada…"
              autoFocus
            />
          </Field>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
            <Button type="button" onClick={confirmarMotivo} disabled={motivo.trim() === ''}>
              Rechazar lote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {config.detalle && (
        <Sheet
          open={detalleDe !== null}
          onOpenChange={(abierto) => {
            if (!abierto) setDetalleDe(null)
          }}
        >
          <SheetContent>
            {detalleDe && (
              <>
                <SheetHeader>
                  <SheetTitle>{config.detalle.titulo}</SheetTitle>
                  <SheetDescription className="font-mono text-xs">
                    {config.detalle.subtitulo(detalleDe)}
                  </SheetDescription>
                </SheetHeader>
                {config.detalle.cuerpo(detalleDe, () => setDetalleDe(null))}
              </>
            )}
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
