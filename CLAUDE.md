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

### Autenticación: Microsoft Entra ID con MSAL

El token de Fabric es **del usuario, no de la app**: lo obtiene el navegador con MSAL (`@azure/msal-browser` + `@azure/msal-react`) contra Entra ID, y por eso los datos se leen desde el cliente y no en el server.

- [lib/auth-config.ts](lib/auth-config.ts) — `msalConfig` (cache en `sessionStorage`), `loginRequest` y la bandera `entraConfigurado`. El scope `https://analysis.windows.net/powerbi/api/GraphQLApi.Execute.All` es exacto y obligatorio: **no lo cambies**.
- [components/providers/msal-provider.tsx](components/providers/msal-provider.tsx) — instancia única de `PublicClientApplication` fuera del árbol de React, `initialize()` + `handleRedirectPromise()` antes de montar la app, `LOGIN_SUCCESS` → `setActiveAccount`. Publica el estado en el contexto de `useFabricAuth`.
- [hooks/use-fabric-auth.ts](hooks/use-fabric-auth.ts) — `useFabricAuth()`: `habilitado`, `isAuthenticated`, `account` (con `roles`, el claim del ID token), `cargando`, `login()`, `logout()`, `getAccessToken()` y `getTokens()` (silent → popup si Entra pide interacción; una sola adquisición devuelve los dos tokens). Toda la app usa este hook, **nunca los hooks de msal-react directamente**: así el árbol sigue funcionando cuando no hay `<MsalProvider>`.
- [hooks/use-operacion-cedis.ts](hooks/use-operacion-cedis.ts) — envoltura de toda escritura: consigue el token, corre la operación, avisa por toast y refresca. El 401 de Fabric se trata aparte (`MENSAJE_SESION_EXPIRADA` + `logout()`).

Las variables son todas `NEXT_PUBLIC_*` (`ENTRA_CLIENT_ID`, `ENTRA_TENANT_ID`, `ENTRA_REDIRECT_URI`, `FABRIC_GRAPHQL_ENDPOINT`) porque MSAL corre en el navegador; Next las inlina **en tiempo de build**, así que en Docker van como build args, no como env de runtime.

Sin `CLIENT_ID`/`TENANT_ID` no se pide login: la app queda en modo demostración con datos seed y `<BannerOffline />`. Con Entra configurado y sin sesión, `AppShell` pinta [`<PantallaLogin />`](components/auth/pantalla-login.tsx) en vez del panel.

### Capa de datos: GraphQL con respaldo seed

Tres archivos encadenados, y es la parte del código que hay que entender antes de tocar datos:

- [lib/graphql.ts](lib/graphql.ts) — cliente genérico contra la GraphQL API de **Microsoft Fabric SQL Database**. Lee `NEXT_PUBLIC_FABRIC_GRAPHQL_ENDPOINT` de env; sin token o sin endpoint lanza `GraphQLRequestError` de inmediato, y marca `sesionExpirada` cuando Fabric responde 401. Usa `cache: 'no-store'`. Dos funciones: `fetchGraphQL()` lanza ante cualquier error, y `ejecutarGraphQL()` devuelve la respuesta cruda para tolerar **errores parciales** (lo que necesita la consulta agrupada). Ver "Límite de tasa" abajo.
- [lib/queries.ts](lib/queries.ts) — una función por operación. Los cinco módulos con tabla publicada (embarques, recepciones, surtido, etiquetado, productividad) tienen su documento GraphQL real; **incidencias sigue en stub `# TODO`** porque esa tabla todavía no está expuesta en la API. Convenciones del esquema de Fabric que hay que respetar tal cual: toda query devuelve un Connection (`{ items, endCursor, hasNextPage }`), la pluralización la decide Fabric (`surtidos`, `etiquetados`, `productividads`) aunque los `*Input` conserven el nombre de la tabla, y **toda escritura va por stored procedure** (`executeCrear*`, `executeActualizarEstado*`, `executeRegistrarProductividad`), nunca por las mutations `create`/`update` genéricas: el input que Fabric genera por tabla expone `created_at` y `updated_at`, y esas columnas las tiene que sellar el server. Los SP viven en [sql/](sql/) — ver la nota "Auditoría" en [sql/README.md](sql/README.md).
- [lib/data.ts](lib/data.ts) — `cargarDatosCedis(token)` devuelve `{ datos, offline, sesionExpirada, limiteExcedido }`, con una bandera de offline **por conjunto**, y usa los arreglos de [lib/seed-data.ts](lib/seed-data.ts) como respaldo. Los siete conjuntos con tabla publicada viajan en **una sola petición** (`getDatosOperativos`); incidencias no sale a la red. Ver "Límite de tasa".
- [lib/actions.ts](lib/actions.ts) — la única vía de escritura. **No hablan con Fabric**: hacen `POST /api/cedis/<operacion>` al Route Handler, que es donde se verifica el rol (ver "Autorización" abajo). Reciben `TokensCedis` como primer argumento y devuelven `ResultadoAccion` (`{ ok }` / `{ ok: false, error, sesionExpirada }`) en vez de lanzar.

Quien llama a `lib/data.ts` es **solo** [`<ProveedorDatosCedis>`](components/providers/cedis-data-provider.tsx): pide el token, carga los seis conjuntos y los expone con `useDatosCedis()` (`datos`, `offline`, `listo`, `cargando`, `refrescar`). Las páginas leen de ese hook — nunca de `lib/queries.ts` ni de `lib/seed-data.ts` — y usan `offline.<conjunto>` para pintar `<BannerOffline />`. `refrescar()` es lo que sustituye al `revalidatePath` de las server actions: lo llaman el botón "Actualizar" del topbar y `useOperacionCedis` después de cada escritura.

Las entidades de `types/cedis.ts` espejean columna por columna las tablas de Fabric, snake_case incluido (`hora_salida`, `motivo_rechazo`, `created_at`): no hay capa de mapeo, así que renombrar un campo del esquema es renombrarlo aquí.

### Límite de tasa: Fabric responde 429

Fabric limita la tasa de peticiones y responde `429 RequestBlocked` con una ventana (`"blocked by the upstream service until: …"`). En agosto de 2026 el panel la excedía en operación normal, y la causa era estructural, no de volumen:

| | Antes | Ahora |
|---|---|---|
| Carga del panel | 6 peticiones | **1** |
| Escritura (mutación + recarga) | 7 peticiones | **2** |

Sigue siendo 1 y 2 después de agregar pedidos: sus dos conjuntos entraron como campos raíz de la misma consulta, no como peticiones nuevas.

Tres cambios, y conviene no deshacerlos por accidente:

1. **Consulta agrupada.** `getDatosOperativos()` pide los cinco conjuntos en un solo documento — GraphQL admite varios campos raíz y Fabric los resuelve juntos. Tolera fallos parciales: la tabla que falla llega en `null` y las otras siguen siendo válidas, que es lo que preserva la bandera de offline por conjunto.
2. **Incidencias no sale a la red.** Su tabla no está publicada, así que `getIncidencias()` lanza en local. Antes mandaba un documento vacío que Fabric rechazaba siempre: una de las seis peticiones de cada carga se gastaba en un error garantizado y contaba igual para el límite.
3. **Deduplicación de recargas.** `refrescar()` en [`<ProveedorDatosCedis>`](components/providers/cedis-data-provider.tsx) se cuelga de la carga en vuelo si ya hay una, en vez de abrir otra.

**Cortacircuitos.** Al recibir un 429, `lib/graphql.ts` guarda hasta cuándo dura el bloqueo (`Retry-After`, o la fecha del mensaje, o 60 s por defecto; recortado a 10 min como máximo) y **corta sin tocar la red** mientras esa ventana siga abierta. No es solo ahorro: seguir pegándole a Fabric dentro de la ventana alarga el castigo. La ventana se cierra sola con la primera respuesta buena, y el botón "Actualizar" se deshabilita mientras tanto (`limitado` en `useDatosCedis()`).

**Al agregar una lectura**, agrégala como campo raíz de la consulta agrupada, no como una petición nueva.

### Autorización: app roles de Entra ID

La autenticación dice *quién* es el usuario; esta capa dice *qué puede hacer*. La fuente de verdad es el claim `roles` del **ID token**, poblado por los App roles que se configuran a mano en el registro de aplicación de Azure Portal: la app los interpreta, nunca los crea ni los asigna.

Tres roles, con jerarquía `Administrador > Supervisor > Operador`. Un usuario con varios roles usa el de mayor privilegio.

- [lib/auth/roles.ts](lib/auth/roles.ts) — puro, sin React ni MSAL, porque lo importan las dos orillas. `Role`, `getHighestRole()`, `rolesDeClaim()` (el claim llega como arreglo, como string suelto o ausente) y `rolDeSesion()`.
- [lib/auth/permissions.ts](lib/auth/permissions.ts) — `Action`, la matriz `MATRIZ_PERMISOS` y `hasPermission()`. La matriz es declarativa a propósito: cada acción lista sus roles en vez de derivarse de la jerarquía, así que **agregar una acción obliga a decidir quién puede ejecutarla**. El mismo objeto lo usan la UI y el servidor.
- [hooks/use-cedis-role.ts](hooks/use-cedis-role.ts) — `useCedisRole()`: `{ role, isLoading, isDemoMode, usuario }`. Lee la cuenta por `useFabricAuth()`, no por los hooks de msal-react.
- [hooks/use-permission.ts](hooks/use-permission.ts) — `usePermission(action)`. **Es el único punto por el que la UI debe preguntar por permisos**: no escribas la jerarquía a mano en un componente.

**Los dos fallbacks no son el mismo, y confundirlos es un agujero de seguridad:**

| Situación | Rol | Por qué |
|---|---|---|
| Sin cuenta activa de MSAL (Entra sin configurar) | `CEDIS.Administrador` + `isDemoMode` | Poder recorrer la UI completa con los datos seed |
| Sesión real **sin ningún app role asignado** | `CEDIS.Operador` | Si hay sesión, el directorio es la autoridad: "sin rol" es sin privilegios, **nunca** todos |

En modo demostración se pinta [`<BannerDemo />`](components/auth/banner-demo.tsx) entre el topbar y el contenido — fijo y no bloqueante.

#### Enforcement en el servidor

Ocultar un botón no es seguridad. Toda escritura pasa por [app/api/cedis/[operacion]/route.ts](app/api/cedis/%5Boperacion%5D/route.ts), y su registro `OPERACIONES` mapea cada operación a la `Action` que exige. **Es un solo Route Handler a propósito:** un endpoint por módulo repartiría el guard en doce archivos, donde el que falte pasa desapercibido.

- [lib/auth/requirePermission.ts](lib/auth/requirePermission.ts) — `requirePermission(request, action)`: valida la sesión, saca el rol del token verificado y exige el permiso. Lanza `ErrorAutorizacion` (401 `unauthorized` / 403 `forbidden`); `respuestaSinPermiso()` la traduce a `Response`.
- [lib/auth/entra-token.ts](lib/auth/entra-token.ts) — verificación del ID token con Web Crypto y sin dependencias nuevas: firma RS256 contra el JWKS del tenant (con cache y refetch al ver un `kid` desconocido), `alg` validado **antes** de mirar la firma, más `iss`, `aud`, `tid`, `exp` y `nbf`.

**Por qué viajan dos tokens** ([lib/auth/tokens.ts](lib/auth/tokens.ts)): los app roles solo aparecen en tokens cuya audiencia es la propia app. El access token que MSAL pide para Fabric tiene `aud` de Microsoft y **no trae el claim `roles`**, así que no sirve para autorizar. El cliente manda entonces el ID token en `Authorization: Bearer` —que el servidor verifica— y el token de Fabric en `X-Fabric-Token`, que el servidor **solo reenvía y nunca usa para decidir permisos**.

Las **lecturas** siguen saliendo del navegador (`lib/data.ts`): las puede hacer cualquier rol y pasarlas por el server rompería el respaldo seed.

#### Al agregar una escritura

1. La `Action` en `lib/auth/permissions.ts` y su renglón en la matriz.
2. La entrada en `OPERACIONES` del Route Handler, con su `accion`.
3. La función en `lib/actions.ts` que hace el `POST`.
4. El `usePermission(...)` que gobierna el control en la UI.

`useOperacionCedis().ejecutar(accion, operacion, exito)` exige la acción como **primer argumento obligatorio**: toda escritura pasa por ahí, así que no se puede agregar una mutación sin declarar quién la puede ejecutar.

### Indicadores: `lib/metrics.ts`

Todos los agregados (porcentajes, conteos, promedios) viven en [lib/metrics.ts](lib/metrics.ts), no en las páginas. Devuelven **números puros**; el color, el formato y el markup son de la capa de presentación.

Está separado a propósito: v0 regenera archivos completos, y las páginas son la frontera donde presentación y lógica se tocan. Con los agregados afuera, una regeneración de UI no puede arrastrarse la lógica de negocio.

**Al agregar un indicador, va aquí — no inline en el `page.tsx`.** Usa `pct()` para cualquier porcentaje (ya protege contra división entre cero).

### Pedidos y su vínculo con surtido

`Pedido` (la cabecera que captura el ERP) y `PedidoSurtido` (la orden de trabajo del piso) son cosas distintas y el nombre no ayuda: un pedido puede existir sin surtido, y el vínculo vive del lado de surtido en `pedido_id`.

- **La ruta normal es de pedidos hacia surtido.** El botón "Crear surtido" de [/pedidos](app/pedidos/page.tsx) llama a `crearSurtidoDesdePedido`, que abre la orden **y** marca el pedido `asignado` en la misma transacción ([sql/11_sp_pedidos.sql](sql/11_sp_pedidos.sql)). Partirlo en dos llamadas dejaría, ante una caída a medio camino, un pedido `pendiente` con surtido ya abierto —y la UI volvería a ofrecer el botón—.
- **El SP no recibe `estado`:** el surtido nace siempre `pendiente`. Arrancarlo es un cambio de estatus posterior desde el módulo de surtido, que es donde vive la regla de que no se pasa a `surtiendo` sin operador. Por eso el diálogo no tiene select de estatus inicial.
- **`pedido` (folio), `cliente` y `lineas` sí son parámetros del SP** y viajan desde el navegador; ni el SP ni el Route Handler los cotejan contra la tabla. Los dos llamadores los leen del registro del pedido, nunca de un campo capturado — validarlos en el Route Handler costaría una lectura contra Fabric por cada escritura, que es justo lo que el diseño de una sola petición evita. **Está anotado como mejora, no como pendiente olvidado:** la tabla `cliente` entra en un release posterior y es la que permite validar la integridad; el sitio y la forma del cambio están escritos en el bloque "MEJORA PENDIENTE" de [sql/11_sp_pedidos.sql](sql/11_sp_pedidos.sql). Hasta entonces `cliente` es texto libre y compararlo contra sí mismo no agregaría garantía.
- El campo "Pedido asociado (opcional)" del alta manual de surtido **también pasa por ese SP**: no hay parámetro para escribir `pedido_id` en un alta suelta. Al elegir un pedido, el alta cambia de operación y de permiso — eso lo declara `accionDe` en la config, para que el check del cliente y el del servidor miren la misma acción.
- El `id` del surtido lo genera el navegador (`nuevoId()` de [lib/ids.ts](lib/ids.ts)) al **abrir** el diálogo, no al enviarlo: así el reintento tras una respuesta perdida cae sobre el mismo id y el SP no abre un segundo surtido. En el alta genérica ese id llega por `ContextoCreacion.idOperacion`.
- **`executeActualizarEstadoPedido` es solo para cancelar.** `asignado` lo pone el SP dentro de su transacción y `completado` lo cierra la operación; cancelar es lo único que no tiene otro camino, y por eso exige `cambiar_estatus_pedido` (supervisión) y no el `cambiar_estatus_registro` del piso.
- Dos rarezas del esquema que no son descuidos: la tabla de renglones se pluraliza `pedido_lineas` pero sus inputs son `pedido_lineaFilterInput` / `pedido_lineaOrderByInput` (singular), y los parámetros de `executeCrearSurtidoDesdePedido` van en **snake_case** (`pedido_id`), a diferencia del camelCase (`horaSalida`, `motivoRechazo`) del resto de los SP.
- `createpedidos` / `createpedido_linea` / `delete*` existen en el esquema pero el panel no las usa: los pedidos los captura el ERP. El `linea` de cada renglón lo manda el ERP — la app nunca lo genera ni lo recalcula.
- Pedidos no está en `ModuloOperativo`: ese tipo son los seis módulos sobre los que se levanta una incidencia, y un problema con un pedido se reporta contra surtido. Por eso `/pedidos` tiene entrada en `TITULOS` pero no en `MODULO_POR_RUTA`.
- **Las líneas de todos los pedidos se cargan de una vez** y `/pedidos/[id]` filtra en memoria (`lineasDePedido`). Pedirlas por pedido sería una petición por detalle abierto —el patrón que provocó el 429— y dejaría la vista sin respaldo seed.
- Llegar a un registro concreto de otro módulo se hace con el **enfoque por query param**: `/surtido?pedido=<id>`, declarado en `enfoque` de la config del módulo y resuelto por `<ModuleControlView>`. No hay ruta de detalle por módulo; el detalle de un renglón se ve en el panel lateral que declara `detalle` en la config.

### Módulos operativos

Seis módulos —`embarques`, `recepciones`, `surtido`, `etiquetado`, `productividad`, `incidencias`— aparecen replicados en seis lugares que deben mantenerse sincronizados al agregar o renombrar uno:

1. `ModuloOperativo` y las entidades/estados en [types/cedis.ts](types/cedis.ts)
2. seed + query + acción + wrapper en `lib/`, y el conjunto en `DatosCedis`/`cargarDatosCedis` de [lib/data.ts](lib/data.ts)
3. agregados en [lib/metrics.ts](lib/metrics.ts)
4. mapas `ESTADO_*`, `MODULO_LABEL`, `MODULO_DOT_CLASS` en [lib/status-config.ts](lib/status-config.ts)
5. config y vista en [components/modulos/configs.tsx](components/modulos/configs.tsx)
6. `NAV_ITEMS` en [components/layout/sidebar-nav.tsx](components/layout/sidebar-nav.tsx), `TITULOS` y `MODULO_POR_RUTA` en [components/layout/topbar.tsx](components/layout/topbar.tsx)

Cada estado de cada módulo se declara en `status-config.ts` como `{ label, dotClass, badgeClass }` y se renderiza con `<EstadoBadge config={ESTADO_X[estado]} />`. No escribas clases de estado a mano en las páginas.

### Vista de control compartida

Los cuatro módulos operativos con tabla (embarques, recepciones, surtido, etiquetado) **no tienen UI propia**: los cuatro renderizan [`<ModuleControlView>`](components/modulos/module-control-view.tsx) —filtro por estatus, "Mostrando X de Y", alta, select de estatus por renglón, borrado con confirmación— y lo único que cambia es la `ConfigModulo` de [components/modulos/configs.tsx](components/modulos/configs.tsx): columnas, campos del alta y qué operación de `lib/actions.ts` invoca cada acción (todas reciben el token como primer argumento). **Al tocar el comportamiento de un módulo, edita su config, no la vista.**

Casos especiales que ya resuelve la config: etiquetado declara `estadoQuePideMotivo: 'rechazado'` (el SP exige motivo), surtido/recepciones reenvían `operador` / `anden` del propio registro porque sus SP los conservan con `COALESCE`, y surtido declara además `detalle` (el panel lateral del botón del ojo) y `enfoque` (el filtro por `?pedido=`).

El alta genérica tiene tres extensiones que solo usa surtido hoy: un campo puede sacar sus opciones de los datos ya cargados con `opcionesDe(datos)` en vez de tenerlas escritas; `crear()` recibe un `ContextoCreacion` con esos mismos `datos` y un `idOperacion` estable entre reintentos; y `accionDe(valores)` declara qué permiso exige el alta cuando depende de lo capturado. Las tres existen para que el select de "Pedido asociado" pueda desviar el alta al SP del vínculo sin que el diálogo sepa nada de pedidos.

`<ModuleControlView>` se envuelve a sí misma en `<Suspense>` porque usa `useSearchParams()` para el enfoque: si el límite viviera en cada página, la que se olvidara de ponerlo tiraría el build.

Los permisos sí viven en la vista, no en la config, porque son iguales para los cuatro módulos: el botón de alta y la columna de borrar se ocultan sin permiso —y el `colSpan` de la fila vacía se ajusta—, mientras el select de estatus se queda visible pero deshabilitado (cambiar el estatus es la operación del piso: la puede hacer cualquier rol).

### Árbol de la app: server shell, datos en el cliente

`app/layout.tsx` (server, solo metadata y fuentes) → `<ProveedorMsal>` → `<ProveedorDatosCedis>` → `AppShell` → `SidebarNav` + `Topbar` + `main`. De `AppShell` para abajo **todo es `'use client'`**: es donde vive el token y, con él, los datos.

`AppShell` toma dos decisiones: si Entra está configurado y no hay sesión pinta `<PantallaLogin />` en lugar del panel, y mientras `listo` es false pinta "Cargando la operación…" en `main` (el sidebar recibe `counts: null` y oculta los badges). Debajo del topbar monta `<BannerDemo />`, que solo se pinta sin cuenta activa de Entra.

El pie del sidebar muestra el nombre del usuario y su rol como badge (`ROL_CONFIG` de `lib/status-config.ts`, con el mismo contrato `EstadoConfig` que el resto).

Cada `app/<modulo>/page.tsx` es un client component que lee `useDatosCedis()`, llama a `lib/metrics.ts` y renderiza `PageHeader` + la vista del módulo. Ya no hay fetch por página ni `async` en las páginas.

El `Topbar` es contextual: arma el botón de alta del módulo activo desde `CREACION_POR_RUTA` y siempre muestra "Reportar incidencia" en rojo, con el módulo de la ruta preseleccionado.

El diálogo de [reportar-incidencia](components/incidencias/reportar-incidencia-dialog.tsx) hoy **no persiste nada**: `handleSubmit` solo lanza un toast. Conectarlo implica exponer la tabla `incidencias` en la API, completar sus queries y agregar la acción que llame a `executeCrearIncidencia` (el SP ya existe en [sql/05_sp_incidencias.sql](sql/05_sp_incidencias.sql)).

### UI: shadcn sobre Base UI (no Radix)

`components.json` usa el estilo `base-nova`; los primitivos en [components/ui/](components/ui/) importan de `@base-ui/react/*`. Diferencias con el shadcn clásico que sí importan al escribir código:

- composición con la prop `render` en vez de `asChild`: `<DialogTrigger render={<Button size="sm" />}>`
- los iconos dentro de botones llevan `data-icon="inline-start"` en lugar de clases de tamaño

Al agregar componentes, usa el CLI de shadcn con esta configuración; no copies snippets de Radix.

### Tema

Dark-only, forzado: `<html className="dark">` fijo en el layout, `color-scheme: dark`, sin toggle (`next-themes` solo lo consume el `Toaster`). La paleta vive en [app/globals.css](app/globals.css) como tokens oklch bajo `:root`, expuestos a Tailwind v4 vía `@theme inline`. Tokens propios del dominio, además de los de shadcn:

- `--module-{embarques,recepciones,surtido,pedidos,etiquetado,productividad,incidencias}` → utilidades `bg-embarques`, `text-surtido`, `border-t-incidencias`, …
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
| Datos y dominio | humanos | `lib/` (todo), `types/cedis.ts`, `hooks/`, `components/providers/`, `components/modulos/`, `next.config.mjs` |
| Autorización | humanos | `lib/auth/`, `app/api/`, `hooks/use-cedis-role.ts`, `hooks/use-permission.ts`, `hooks/use-operacion-cedis.ts` |

`components/modulos/` es presentación pero está cableado a las operaciones de escritura **y a los checks de permisos**: si v0 lo regenera, las mutaciones se rompen en silencio y los controles vuelven a aparecer para todos los roles (el servidor los sigue rechazando con 403, pero la UI queda ofreciendo lo que no se puede hacer). Al revisar un PR de v0 que toque `components/modulos/`, `components/productividad/` o `app/*/page.tsx`, **busca `usePermission` desaparecidos**. Lo mismo con el JSX de `app/*/page.tsx`: su primera línea es `'use client'` y leen de `useDatosCedis()` — una regeneración que las devuelva a server components `async` deja la app sin datos.

Ramas: `feat/*` y `chore/*` para trabajo a mano, `v0/*` para lo que empuja v0. Sin `develop` — las preview URLs de Vercel cubren esa función.
