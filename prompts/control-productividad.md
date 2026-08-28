Continúa el proyecto CEDIS ·CTRL. Ahora construye las vistas de los 4 módulos
operativos (Embarques, Recepciones, Surtido, Etiquetado) y la vista de Productividad.

La API GraphQL de Microsoft Fabric ya está desplegada. Abajo incluyo las queries,
mutations y stored procedures EXACTOS del schema. Úsalos tal cual — no inventes
nombres ni cambies la estructura.

## API GraphQL de Fabric — Referencia

### Patrón de consulta (aplica a todas las tablas)

Todas las queries devuelven un tipo Connection con paginación cursor-based:
  { items: [...], endCursor: String, hasNextPage: Boolean }

Nombres exactos de las queries (respeta la pluralización de Fabric):
- embarques(first, after, filter: embarquesFilterInput, orderBy: embarquesOrderByInput): embarquesConnection
- recepciones(first, after, filter: recepcionesFilterInput, orderBy: recepcionesOrderByInput): recepcionesConnection
- surtidos(first, after, filter: surtidoFilterInput, orderBy: surtidoOrderByInput): surtidoConnection
- etiquetados(first, after, filter: etiquetadoFilterInput, orderBy: etiquetadoOrderByInput): etiquetadoConnection
- productividads(first, after, filter: productividadFilterInput, orderBy: productividadOrderByInput): productividadConnection

Filtros por string usan StringFilterInput con { eq, contains, neq, in, isNull }.
Para filtrar por estado:  filter: { estado: { eq: "programado" } }
Para traer todos:         sin filtro o filter: null

### Campos por tipo (úsalos en los selection sets)

embarques:       id, folio, destino, transportista, unidades, hora_salida, estado, created_at, updated_at
recepciones:     id, folio, proveedor, anden, unidades, tipo, estado, created_at, updated_at
surtido:         id, pedido, cliente, lineas, operador, prioridad, estado, created_at, updated_at
etiquetado:      id, lote, producto, unidades, operador, estado, motivo_rechazo, created_at, updated_at
productividad:   id, operador, area, turno, unidades, horas (Decimal), meta, created_at

### Mutations CRUD (creación y eliminación)

Creación — los campos id, created_at, updated_at tienen defaults del server,
NO los envíes desde el frontend:

- createembarques(item: CreateembarquesInput!): embarques
  Input requeridos: folio!, destino!, transportista!
  Input opcionales: unidades, hora_salida, estado (default "programado")

- createrecepciones(item: CreaterecepcionesInput!): recepciones
  Input requeridos: folio!, proveedor!
  Input opcionales: anden, unidades, tipo, estado (default "programada")

- createsurtido(item: CreatesurtidoInput!): surtido
  Input requeridos: pedido!, cliente!
  Input opcionales: lineas, operador, prioridad (default "Media"), estado (default "pendiente")

- createetiquetado(item: CreateetiquetadoInput!): etiquetado
  Input requeridos: lote!, producto!
  Input opcionales: unidades, operador, estado (default "pendiente"), motivo_rechazo

Eliminación:
- deleteembarques(id: String!): embarques
- deleterecepciones(id: String!): recepciones
- deletesurtido(id: String!): surtido
- deleteetiquetado(id: String!): etiquetado
- deleteproductividad(id: String!): productividad

### Stored Procedures para actualización de estado

IMPORTANTE: Para cambiar el estado de un registro, NO uses las mutations
update genéricas. Usa estos stored procedures que Fabric ya tiene configurados:

- executeActualizarEstadoEmbarque(id: String, estado: String): [ActualizarEstadoEmbarque!]!
- executeActualizarEstadoRecepcion(id: String, estado: String, anden: String): [ActualizarEstadoRecepcion!]!
- executeActualizarEstadoSurtido(id: String, estado: String, operador: String): [ActualizarEstadoSurtido!]!
- executeActualizarEstadoEtiquetado(id: String, estado: String, motivoRechazo: String): [ActualizarEstadoEtiquetado!]!

Cada uno devuelve el registro completo con los mismos campos que su tipo base.

### Stored Procedure para productividad

- executeRegistrarProductividad(
    id: String, operador: String, area: String, turno: String,
    unidades: Int, horas: Decimal, meta: Int
  ): [RegistrarProductividad!]!

Usa este SP en lugar de createproductividad. Genera el id en el frontend
con crypto.randomUUID() o un uuid similar.

## Módulos operativos — Patrón compartido

Los 4 módulos siguen exactamente el mismo patrón. Crea un componente genérico
reutilizable <ModuleControlView> que reciba configuración y renderice:

### Toolbar superior
- Select de filtro por estado ("Todos los estatus" + los estados del módulo)
- Texto: "Mostrando X de Y registros"
- Botón amber "+ Nuevo [tipo]" que abre un Dialog de shadcn

### Tabla (shadcn Table)
Columnas específicas por módulo:

**Embarques**: Folio | Destino | Transportista | Unidades (mono) | Hora salida | Estatus | ✕
**Recepciones**: Folio | Proveedor | Andén | Unidades (mono) | Tipo mercancía | Estatus | ✕
**Surtido**: Pedido | Cliente | Líneas (mono) | Operador | Prioridad | Estatus | ✕
**Etiquetado**: Lote | Producto | Unidades (mono) | Operador | Motivo rechazo | Estatus | ✕

- La columna "Estatus" es un Select inline con los estados del módulo; al cambiar,
  llama al stored procedure correspondiente (executeActualizarEstado*).
  Para etiquetado, si el nuevo estado es "rechazado", mostrar un input adicional
  para capturar motivo_rechazo y pasarlo al SP.
- La columna ✕ es un botón icon destructivo que elimina el registro (confirmar antes)
  usando la mutation delete correspondiente
- Los valores numéricos usan formato es-MX (Intl.NumberFormat) y font-mono
- Filas hover con fondo ligeramente más claro
- Estado vacío: "No hay registros con este filtro." centrado

### Lógica de fetch con Connection

Al consultar la query de cada módulo, extrae los datos de response.items:

```typescript
const { data } = await fetchGraphQL(`
  query GetEmbarques($filter: embarquesFilterInput, $orderBy: embarquesOrderByInput) {
    embarques(first: 100, filter: $filter, orderBy: $orderBy) {
      items {
        id folio destino transportista unidades hora_salida estado
        created_at updated_at
      }
      hasNextPage
      endCursor
    }
  }
`, { filter: estado ? { estado: { eq: estado } } : null, orderBy: { created_at: "DESC" } });
```

Aplica el mismo patrón para recepciones, surtidos, etiquetados y productividads
(nota: estos 3 últimos usan el nombre plural que Fabric generó).

### Lógica de cambio de estado (ejemplo embarques)

```typescript
await fetchGraphQL(`
  mutation ActualizarEstadoEmbarque($id: String, $estado: String) {
    executeActualizarEstadoEmbarque(id: $id, estado: $estado) {
      id folio estado updated_at
    }
  }
`, { id: record.id, estado: nuevoEstado });
```

Para etiquetado, incluye motivoRechazo:
```typescript
await fetchGraphQL(`
  mutation ActualizarEstadoEtiquetado($id: String, $estado: String, $motivoRechazo: String) {
    executeActualizarEstadoEtiquetado(id: $id, estado: $estado, motivoRechazo: $motivoRechazo) {
      id lote estado motivo_rechazo updated_at
    }
  }
`, { id: record.id, estado: nuevoEstado, motivoRechazo: motivo || null });
```

Para surtido, incluye operador:
```typescript
await fetchGraphQL(`
  mutation ActualizarEstadoSurtido($id: String, $estado: String, $operador: String) {
    executeActualizarEstadoSurtido(id: $id, estado: $estado, operador: $operador) {
      id pedido estado operador updated_at
    }
  }
`, { id: record.id, estado: nuevoEstado, operador: record.operador });
```

Para recepciones, incluye anden:
```typescript
await fetchGraphQL(`
  mutation ActualizarEstadoRecepcion($id: String, $estado: String, $anden: String) {
    executeActualizarEstadoRecepcion(id: $id, estado: $estado, anden: $anden) {
      id folio estado anden updated_at
    }
  }
`, { id: record.id, estado: nuevoEstado, anden: record.anden });
```

### Dialog de creación (shadcn Dialog)
Campos por módulo:

**Embarques**: Folio (text, placeholder EMB-0000), Destino (text), Transportista (text),
  Unidades (number), Hora de salida (text, placeholder 08:00), Estatus inicial (select)

**Recepciones**: Folio (text, placeholder REC-0000), Proveedor (text), Andén (text),
  Unidades (number), Tipo de mercancía (text), Estatus inicial (select)

**Surtido**: No. de pedido (text, placeholder PED-0000), Cliente (text),
  Líneas a surtir (number), Operador asignado (text),
  Prioridad (select: Alta/Media/Baja), Estatus inicial (select)

**Etiquetado**: Lote (text, placeholder LOT-0000), Producto (text), Unidades (number),
  Operador asignado (text), Estatus inicial (select)

- Si el folio queda vacío, auto-generar con el prefijo del módulo + 4 dígitos random
- Al guardar: llamar la mutation create correspondiente (createembarques,
  createrecepciones, createsurtido, createetiquetado). NO envíes id, created_at
  ni updated_at — el server los genera.
- Cerrar dialog, refrescar tabla, mostrar toast "Registro creado correctamente"

### Topbar contextual
- Cada módulo muestra su botón de creación
- Siempre visible: botón rojo "Reportar incidencia" (abre el dialog de incidencias,
  preseleccionando el módulo actual)

## Vista de Productividad

### KPI tiles (3 cards)
1. Promedio unidades/hora (blue)
2. Cumplimiento promedio vs meta % (green)
3. Turnos por debajo de meta (red, conteo)

### Gráfica de barras
"Unidades por hora por operador" — Recharts BarChart vertical, barras azules,
  labels con nombre del operador en eje X

### Tabla de detalle
Columnas: Operador | Área | Turno | Unidades (mono) | Horas (mono) | Meta (mono) |
  Unid./hora (mono, calculado) | Cumplimiento (Badge: verde "Cumple meta X%" o
  rojo "Bajo meta X%") | ✕

Nota: el campo "horas" viene como Decimal del schema. Conviértelo a number
para los cálculos: Number(record.horas)

### Dialog "Registrar turno"
Campos: Operador (text), Área (select: Surtido/Etiquetado/Recepciones/Embarques),
  Turno (select: Matutino/Vespertino/Nocturno), Unidades procesadas (number),
  Horas trabajadas (number, default 8), Meta del turno (number)

Al guardar, usa el stored procedure, NO la mutation CRUD:
```typescript
await fetchGraphQL(`
  mutation RegistrarProductividad(
    $id: String, $operador: String, $area: String, $turno: String,
    $unidades: Int, $horas: Decimal, $meta: Int
  ) {
    executeRegistrarProductividad(
      id: $id, operador: $operador, area: $area, turno: $turno,
      unidades: $unidades, horas: $horas, meta: $meta
    ) {
      id operador area turno unidades horas meta created_at
    }
  }
`, {
  id: crypto.randomUUID(),
  operador, area, turno,
  unidades: Number(unidades),
  horas: Number(horas),
  meta: Number(meta)
});
```

### Fetch de productividad

```typescript
const { data } = await fetchGraphQL(`
  query GetProductividad {
    productividads(first: 100, orderBy: { created_at: DESC }) {
      items {
        id operador area turno unidades horas meta created_at
      }
      hasNextPage
    }
  }
`);
```

## Tipos TypeScript actualizados

Agrega o actualiza en types/cedis.ts:
- El campo motivo_rechazo: string | null en LoteEtiquetado
- El campo horas como number (convertir del Decimal de GraphQL)

## Manejo de errores

Si fetchGraphQL falla, mostrar toast "No se pudo guardar el cambio. Verifica tu
conexión." y no actualizar el estado local. Si la query inicial falla, usar los
datos seed como fallback y mostrar un banner sutil indicando "Modo offline —
datos de demostración".