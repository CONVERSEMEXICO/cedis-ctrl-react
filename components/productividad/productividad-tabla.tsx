'use client'

// Detalle de turnos capturados: el borrado va por lib/actions.ts con el token
// de Entra ID que consigue `useOperacionCedis`.

import { X } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useOperacionCedis } from '@/hooks/use-operacion-cedis'
import { usePermission } from '@/hooks/use-permission'
import { accionEliminarRegistroProductividad } from '@/lib/actions'
import { formatDecimal, formatNumero } from '@/lib/format'
import { cumplimientoRegistro, cumpleMeta, unidadesPorHora } from '@/lib/metrics'
import { TURNO_LABEL } from '@/lib/status-config'
import { cn } from '@/lib/utils'
import type { RegistroProductividad } from '@/types/cedis'

const CLASE_NUMERO = 'text-right font-mono tabular-nums'

export function ProductividadTabla({ registros }: { registros: RegistroProductividad[] }) {
  const { ejecutar } = useOperacionCedis()
  const puedeEliminar = usePermission('eliminar_registro')
  const [idEnCurso, setIdEnCurso] = useState<string | null>(null)
  const [aEliminar, setAEliminar] = useState<RegistroProductividad | null>(null)

  async function confirmarEliminar() {
    const registro = aEliminar
    if (!registro) return
    setAEliminar(null)
    setIdEnCurso(registro.id)
    await ejecutar(
      'eliminar_registro',
      (tokens) => accionEliminarRegistroProductividad(tokens, registro.id),
      'Registro eliminado',
    )
    setIdEnCurso(null)
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Operador</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Turno</TableHead>
              <TableHead className="text-right">Unidades</TableHead>
              <TableHead className="text-right">Horas</TableHead>
              <TableHead className="text-right">Meta</TableHead>
              <TableHead className="text-right">Unid./hora</TableHead>
              <TableHead>Cumplimiento</TableHead>
              {puedeEliminar && (
                <TableHead className="w-10">
                  <span className="sr-only">Eliminar</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {registros.map((registro) => {
              const cumplimiento = cumplimientoRegistro(registro)
              const cumple = cumpleMeta(registro)
              const ocupado = idEnCurso === registro.id
              return (
                <TableRow key={registro.id} className={cn(ocupado && 'opacity-60')}>
                  <TableCell>{registro.operador}</TableCell>
                  <TableCell className="text-muted-foreground">{registro.area}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{TURNO_LABEL[registro.turno]}</Badge>
                  </TableCell>
                  <TableCell className={CLASE_NUMERO}>{formatNumero(registro.unidades)}</TableCell>
                  <TableCell className={cn(CLASE_NUMERO, 'text-muted-foreground')}>
                    {formatDecimal(registro.horas)}
                  </TableCell>
                  <TableCell className={cn(CLASE_NUMERO, 'text-muted-foreground')}>
                    {formatNumero(registro.meta)}
                  </TableCell>
                  <TableCell className={cn(CLASE_NUMERO, 'font-medium')}>
                    {formatNumero(unidadesPorHora(registro))}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        'border-0',
                        cumple ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive',
                      )}
                    >
                      {cumple ? 'Cumple meta' : 'Bajo meta'} {cumplimiento}%
                    </Badge>
                  </TableCell>
                  {puedeEliminar && (
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        disabled={ocupado}
                        onClick={() => setAEliminar(registro)}
                        aria-label="Eliminar registro de productividad"
                      >
                        <X />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
            {registros.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={puedeEliminar ? 9 : 8}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  No hay turnos registrados.
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
            <DialogTitle>Eliminar registro</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer: el turno se borra de la base de datos del CEDIS.
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
    </>
  )
}
