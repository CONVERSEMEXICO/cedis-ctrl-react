# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

```bash
pnpm dev              # servidor de desarrollo (Next.js)
pnpm build            # build de producción
pnpm start            # servir el build
npx tsc --noEmit      # verificación de tipos — NO la hace el build
```

No hay linter, formateador ni suite de pruebas configurados. `next.config.mjs` tiene `typescript.ignoreBuildErrors: true`, así que **`pnpm build` no falla ante errores de tipo**; `tsc --noEmit` es la única verificación real y por eso corre en CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) en cada PR y push a `main`.

## Contexto

Panel de control de operaciones para un CEDIS (centro de distribución). Todo el dominio, la UI y los comentarios de código están **en español**: mantén esa convención al agregar código (nombres de funciones/variables de dominio en español, texto de interfaz en español, formatos `es-MX`).

Proyecto generado con v0.app, que **sigue en uso ocasional** para retoques de UI. Eso condiciona cómo está organizado el código — ver "Flujo con v0" abajo.

## Arquitectura

### Capa de datos: GraphQL con respaldo seed

Tres archivos encadenados, y es la parte del código que hay que entender antes de tocar datos:

- [lib/graphql.ts](lib/graphql.ts) — cliente `fetchGraphQL` genérico contra la GraphQL API de **Microsoft Fabric SQL Database**. Lee `FABRIC_GRAPHQL_ENDPOINT` y `FABRIC_AUTH_TOKEN` de env; si el endpoint está vacío lanza `GraphQLRequestError` de inmediato. Usa `cache: 'no-store'`.
- [lib/queries.ts](lib/queries.ts) — una función por operación. Los cinco módulos con tabla publicada (embarques, recepciones, surtido, etiquetado, productividad) tienen su documento GraphQL real; **incidencias sigue en stub `# TODO`** porque esa tabla todavía no está expuesta en la API. Convenciones del esquema de Fabric que hay que respetar tal cual: toda query devuelve un Connection (`{ items, endCursor, hasNextPage }`), la pluralización la decide Fabric (`surtidos`, `etiquetados`, `productividads`) aunque los `*Input` conserven el nombre de la tabla, y **los cambios de estado van por stored procedure** (`executeActualizarEstado*`, `executeRegistrarProductividad`), nunca por las mutations update genéricas. Los SP viven en [sql/](sql/).
- [lib/data.ts](lib/data.ts) — envuelve cada query en `conRespaldo()`, que hace `try/catch` y devuelve los arreglos de [lib/seed-data.ts](lib/seed-data.ts) cuando la API falla. Las páginas deben importar exclusivamente de `lib/data.ts`, nunca de `lib/queries.ts` ni de `lib/seed-data.ts` directamente.
- [lib/actions.ts](lib/actions.ts) — server actions (`'use server'`), la única vía de escritura: el `FABRIC_AUTH_TOKEN` no puede salir al navegador. Cada acción devuelve `ResultadoAccion` (`{ ok }` / `{ ok: false, error }`) en vez de lanzar, y revalida `'/'` con scope `layout` para refrescar tabla, dashboard y conteos del sidebar de una sola vez.

`obtenerDatosCedis()` trae los seis conjuntos en paralelo; las páginas de módulo usan `cargarX()`, que además dice si hubo fallback (`offline`) para pintar `<BannerOffline />`. `obtenerX()` es el mismo dato sin esa bandera.

Las entidades de `types/cedis.ts` espejean columna por columna las tablas de Fabric, snake_case incluido (`hora_salida`, `motivo_rechazo`, `created_at`): no hay capa de mapeo, así que renombrar un campo del esquema es renombrarlo aquí.

### Indicadores: `lib/metrics.ts`

Todos los agregados (porcentajes, conteos, promedios) viven en [lib/metrics.ts](lib/metrics.ts), no en las páginas. Devuelven **números puros**; el color, el formato y el markup son de la capa de presentación.

Está separado a propósito: v0 regenera archivos completos, y las páginas son la frontera donde presentación y lógica se tocan. Con los agregados afuera, una regeneración de UI no puede arrastrarse la lógica de negocio.

**Al agregar un indicador, va aquí — no inline en el `page.tsx`.** Usa `pct()` para cualquier porcentaje (ya protege contra división entre cero).

### Módulos operativos

Seis módulos —`embarques`, `recepciones`, `surtido`, `etiquetado`, `productividad`, `incidencias`— aparecen replicados en seis lugares que deben mantenerse sincronizados al agregar o renombrar uno:

1. `ModuloOperativo` y las entidades/estados en [types/cedis.ts](types/cedis.ts)
2. seed + query + acción + wrapper en `lib/`
3. agregados en [lib/metrics.ts](lib/metrics.ts)
4. mapas `ESTADO_*`, `MODULO_LABEL`, `MODULO_DOT_CLASS` en [lib/status-config.ts](lib/status-config.ts)
5. config y vista en [components/modulos/configs.tsx](components/modulos/configs.tsx)
6. `NAV_ITEMS` en [components/layout/sidebar-nav.tsx](components/layout/sidebar-nav.tsx), `TITULOS` y `MODULO_POR_RUTA` en [components/layout/topbar.tsx](components/layout/topbar.tsx)

Cada estado de cada módulo se declara en `status-config.ts` como `{ label, dotClass, badgeClass }` y se renderiza con `<EstadoBadge config={ESTADO_X[estado]} />`. No escribas clases de estado a mano en las páginas.

### Vista de control compartida

Los cuatro módulos operativos con tabla (embarques, recepciones, surtido, etiquetado) **no tienen UI propia**: los cuatro renderizan [`<ModuleControlView>`](components/modulos/module-control-view.tsx) —filtro por estatus, "Mostrando X de Y", alta, select de estatus por renglón, borrado con confirmación— y lo único que cambia es la `ConfigModulo` de [components/modulos/configs.tsx](components/modulos/configs.tsx): columnas, campos del alta y qué server action invoca cada operación. **Al tocar el comportamiento de un módulo, edita su config, no la vista.**

Casos especiales que ya resuelve la config: etiquetado declara `estadoQuePideMotivo: 'rechazado'` (el SP exige motivo), y surtido/recepciones reenvían `operador` / `anden` del propio registro porque sus SP los conservan con `COALESCE`.

### Server components por defecto

`app/layout.tsx` → `AppShell` (server, hace el fetch de conteos para el sidebar) → `SidebarNav` + `Topbar` (client, por `usePathname`) + `main`. Cada `app/<modulo>/page.tsx` es un server component `async` que hace su propio fetch, llama a `lib/metrics.ts` y renderiza `PageHeader` + la vista del módulo. Son `'use client'` los charts (recharts), el sidebar, el topbar, los diálogos y `components/modulos/`.

El `Topbar` es contextual: arma el botón de alta del módulo activo desde `CREACION_POR_RUTA` y siempre muestra "Reportar incidencia" en rojo, con el módulo de la ruta preseleccionado.

El diálogo de [reportar-incidencia](components/incidencias/reportar-incidencia-dialog.tsx) hoy **no persiste nada**: `handleSubmit` solo lanza un toast. Conectarlo implica exponer la tabla `incidencias` en la API, completar sus queries y agregar la acción que llame a `executeCrearIncidencia` (el SP ya existe en [sql/05_sp_incidencias.sql](sql/05_sp_incidencias.sql)).

### UI: shadcn sobre Base UI (no Radix)

`components.json` usa el estilo `base-nova`; los primitivos en [components/ui/](components/ui/) importan de `@base-ui/react/*`. Diferencias con el shadcn clásico que sí importan al escribir código:

- composición con la prop `render` en vez de `asChild`: `<DialogTrigger render={<Button size="sm" />}>`
- los iconos dentro de botones llevan `data-icon="inline-start"` en lugar de clases de tamaño

Al agregar componentes, usa el CLI de shadcn con esta configuración; no copies snippets de Radix.

### Tema

Dark-only, forzado: `<html className="dark">` fijo en el layout, `color-scheme: dark`, sin toggle (`next-themes` solo lo consume el `Toaster`). La paleta vive en [app/globals.css](app/globals.css) como tokens oklch bajo `:root`, expuestos a Tailwind v4 vía `@theme inline`. Tokens propios del dominio, además de los de shadcn:

- `--module-{embarques,recepciones,surtido,etiquetado,productividad,incidencias}` → utilidades `bg-embarques`, `text-surtido`, `border-t-incidencias`, …
- `--severidad-{baja,media,alta,critica}`, `--success`, `--warning`
- utilidad `.hazard-stripe` (franja diagonal ámbar/gris del encabezado)

En charts los colores se pasan como string CSS (`'var(--module-embarques)'`, `SEVERIDAD_CONFIG[sev].chartVar`), no como clase de Tailwind.

Tailwind v4: sin `tailwind.config`; toda la configuración es CSS en `globals.css`.

### Formato

Fechas y números siempre por [lib/format.ts](lib/format.ts) (`formatFechaHora`, `formatFecha`, `formatNumero`), locale `es-MX`, con `'—'` para valores ausentes. Las cifras se muestran con `font-mono tabular-nums`.

## Flujo con v0

`main` es producción (Vercel despliega desde ahí) y está protegida: todo entra por PR con CI en verde.

v0 **regenera archivos completos**, no hace ediciones quirúrgicas. El riesgo no es que las ramas diverjan, sino que v0 genere desde una foto vieja del repo y su PR aparezca borrando trabajo hecho a mano. De ahí dos reglas:

1. **Sincronizar v0 desde `main` antes de cada sesión de generación.**
2. Al revisar un PR de v0, **buscar borrados, no solo lo agregado**.

Fronteras de propiedad que reducen la colisión:

| Zona | Dueño | Archivos |
|---|---|---|
| Presentación | v0 | `components/ui/`, `components/dashboard/`, `components/layout/`, `app/globals.css`, el JSX de `app/*/page.tsx` |
| Datos y dominio | humanos | `lib/` (todo), `types/cedis.ts`, `components/modulos/`, `next.config.mjs` |

`components/modulos/` es presentación pero está cableado a las server actions: si v0 lo regenera, las mutaciones se rompen en silencio.

Ramas: `feat/*` y `chore/*` para trabajo a mano, `v0/*` para lo que empuja v0. Sin `develop` — las preview URLs de Vercel cubren esa función.
