Continúa el proyecto CEDIS ·CTRL. Ahora construye el módulo de Incidencias,
el dialog global de reporte, y el sistema de notificaciones toast.

La API GraphQL de Microsoft Fabric ya está conectada. Abajo incluyo las queries,
mutations y stored procedures EXACTOS. Úsalos tal cual.

## API GraphQL — Referencia para Incidencias

### Query

- incidencias(first, after, filter: incidenciasFilterInput, orderBy: incidenciasOrderByInput): incidenciasConnection

Connection devuelve: { items: [...], endCursor, hasNextPage }

Campos del tipo incidencias:
  id, folio, modulo, tipo, severidad, estado, responsable, descripcion,
  fecha (DateTime), fecha_resolucion (DateTime), created_at, updated_at

Filtro combinado ejemplo (estado + severidad):
```typescript
filter: {
  and: [
    estado ? { estado: { eq: estado } } : null,
    severidad ? { severidad: { eq: severidad } } : null
  ].filter(Boolean)
}
```

Ordenamiento: { fecha: DESC }

### Stored Procedure para crear incidencia

IMPORTANTE: Usa el stored procedure, NO la mutation createincidencias:

- executeCrearIncidencia(
    id: String, modulo: String, tipo: String,
    severidad: String, responsable: String, descripcion: String
  ): [CrearIncidencia!]!

El SP genera el folio, la fecha y el estado "abierta" automáticamente.
Genera el id en el frontend con crypto.randomUUID().

```typescript
await fetchGraphQL(`
  mutation CrearIncidencia(
    $id: String, $modulo: String, $tipo: String,
    $severidad: String, $responsable: String, $descripcion: String
  ) {
    executeCrearIncidencia(
      id: $id, modulo: $modulo, tipo: $tipo,
      severidad: $severidad, responsable: $responsable, descripcion: $descripcion
    ) {
      id folio modulo tipo severidad estado responsable descripcion
      fecha fecha_resolucion created_at updated_at
    }
  }
`, {
  id: crypto.randomUUID(),
  modulo, tipo, severidad, responsable, descripcion
});
```

### Stored Procedure para actualizar estado de incidencia

- executeActualizarEstadoIncidencia(id: String, estado: String): [ActualizarEstadoIncidencia!]!

Devuelve el registro completo incluyendo fecha_resolucion (que el SP puede
llenar automáticamente cuando el estado cambia a "resuelta" o "cerrada").

```typescript
await fetchGraphQL(`
  mutation ActualizarEstadoIncidencia($id: String, $estado: String) {
    executeActualizarEstadoIncidencia(id: $id, estado: $estado) {
      id folio estado fecha_resolucion updated_at
    }
  }
`, { id: record.id, estado: nuevoEstado });
```

### Eliminación

- deleteincidencias(id: String!): incidencias

## Vista de Incidencias

### Toolbar con doble filtro
- Select "Todos los estatus": Abierta | En atención | Resuelta | Cerrada
- Select "Toda severidad": Baja | Media | Alta | Crítica
- Texto: "Mostrando X de Y incidencias"

### Tabla de incidencias
Columnas: Folio (mono) | Módulo | Tipo | Severidad (Badge) | Responsable |
  Fecha (mono) | Fecha resolución (mono, si existe) | Estatus (Select inline) | ✕

- Severidad como Badge con dot de color:
  Baja → gray, Media → amber, Alta → orange-500, Crítica → red
- Estatus como Select inline con las 4 opciones del flujo:
  Abierta → En atención → Resuelta → Cerrada
  Al cambiar, llama executeActualizarEstadoIncidencia + toast
- La columna Fecha resolución muestra la fecha solo si estado es
  "resuelta" o "cerrada", de lo contrario muestra "—"
- Ordenar por fecha descendente, con las abiertas primero
- Botón ✕ elimina con confirmación usando deleteincidencias

### Fetch

```typescript
const { data } = await fetchGraphQL(`
  query GetIncidencias($filter: incidenciasFilterInput) {
    incidencias(first: 100, filter: $filter, orderBy: { fecha: DESC }) {
      items {
        id folio modulo tipo severidad estado responsable descripcion
        fecha fecha_resolucion created_at updated_at
      }
      hasNextPage
    }
  }
`, { filter: buildIncidenciasFilter(estadoFilter, severidadFilter) });
```

### Topbar
- Botón rojo "+ Nueva incidencia"

## Dialog de reporte de incidencia (global)

Este dialog se puede abrir desde CUALQUIER vista (botón "Reportar incidencia"
en el topbar). Debe ser un componente global accesible via context o zustand.

Campos:
- Módulo relacionado (select): general | embarques | recepciones | surtido | etiquetado
  → Si se abre desde un módulo específico, preseleccionar ese módulo
  → Los valores deben coincidir con los que el SP espera (minúsculas, sin acentos)
- Tipo de incidencia (select): Faltante de mercancía | Daño de mercancía |
  Retraso de transportista | Discrepancia de cantidad | Error de surtido |
  Etiqueta incorrecta | Falla de equipo | Otro
- Severidad (select): baja | media | alta | critica
  (valores en minúsculas para que coincidan con la base de datos)
- Responsable (text input)
- Descripción (textarea, 3 rows)

Al guardar:
- Llama executeCrearIncidencia con id generado por crypto.randomUUID()
- El SP genera el folio (INC-XXXX) y la fecha automáticamente — NO los envíes
- Estado inicial siempre "abierta" (lo asigna el SP)
- Cerrar dialog, toast "Incidencia reportada", refrescar conteo en sidebar

## Sistema de toast

Usa el componente Sonner (shadcn toast) o un toast custom fijo en esquina
inferior derecha:
- Fondo zinc-800, borde amber, texto blanco
- Auto-dismiss en 2.5 segundos con animación slide-up
- Mensajes:
  - "Registro creado correctamente."
  - "Estatus actualizado."
  - "Registro eliminado."
  - "Incidencia reportada."
  - "Turno registrado correctamente."
  - "No se pudo guardar el cambio. Verifica tu conexión." (en caso de error GraphQL)

## Conexión final

- Verifica que el sidebar actualice sus conteos al crear/eliminar registros
  y al cambiar estatus de incidencias.
  Para el conteo de incidencias del sidebar, filtra solo las que tienen
  estado "abierta" o "atencion":
```typescript
  filter: { estado: { in: ["abierta", "atencion"] } }
```
- Verifica que el dashboard se refresque al navegar de vuelta
- Agrega un estado de loading con Skeleton de shadcn mientras las queries cargan
- Agrega manejo de errores: si fetchGraphQL falla, mostrar toast de error y
  usar los datos seed como fallback con un banner "Modo offline"