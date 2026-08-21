Continúa el proyecto CEDIS ·CTRL. Ahora reemplaza la autenticación placeholder
(Bearer FABRIC_AUTH_TOKEN) por autenticación real con Microsoft Entra ID usando
MSAL, siguiendo el mismo patrón que el sample oficial de Microsoft para conectar
apps a la API de GraphQL de Fabric.

## Dependencias

Instala:
- @azure/msal-browser
- @azure/msal-react

## Variables de entorno (todas públicas porque MSAL corre en el navegador)

- NEXT_PUBLIC_ENTRA_CLIENT_ID
- NEXT_PUBLIC_ENTRA_TENANT_ID
- NEXT_PUBLIC_ENTRA_REDIRECT_URI (default: window.location.origin)
- NEXT_PUBLIC_FABRIC_GRAPHQL_ENDPOINT

## lib/auth-config.ts

Crea la configuración de MSAL:

```typescript
import { Configuration } from "@azure/msal-browser";

export const msalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_ENTRA_TENANT_ID}`,
    redirectUri: process.env.NEXT_PUBLIC_ENTRA_REDIRECT_URI || (typeof window !== "undefined" ? window.location.origin : ""),
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

// IMPORTANTE: este scope es exacto y obligatorio para la API de GraphQL de Fabric.
// No lo modifiques ni lo quites, o la autenticación falla.
export const loginRequest = {
  scopes: ["https://analysis.windows.net/powerbi/api/GraphQLApi.Execute.All"],
};
```

## Provider global de MSAL

Crea un Client Component `components/providers/msal-provider.tsx` que instancie
`PublicClientApplication` UNA sola vez (fuera del árbol de componentes, con
`msalInstance.initialize()`), lo envuelva en `MsalProvider` de @azure/msal-react,
y lo use en app/layout.tsx envolviendo toda la app. Debe manejar el evento
LOGIN_SUCCESS para hacer `setActiveAccount`.

## Hook useFabricAuth

Crea `hooks/use-fabric-auth.ts` que exponga:
- isAuthenticated: boolean (via useIsAuthenticated de msal-react)
- account: la cuenta activa (nombre, username) via useMsal
- login(): dispara loginRedirect con loginRequest
- logout(): dispara logoutRedirect
- getAccessToken(): async, intenta acquireTokenSilent(loginRequest); si lanza
  InteractionRequiredAuthError, hace fallback a acquireTokenPopup(loginRequest);
  devuelve el accessToken o null si todo falla

## lib/graphql.ts — actualizar fetchGraphQL

Quita el header fijo "Authorization: Bearer FABRIC_AUTH_TOKEN". La función
fetchGraphQL ahora debe recibir el token como parámetro (o un callback getToken)
en vez de leerlo de una constante:

```typescript
export async function fetchGraphQL<T>(
  query: string,
  variables: Record<string, any>,
  accessToken: string | null
): Promise<{ data?: T; error?: string }> {
  if (!accessToken) {
    return { error: "No autenticado" };
  }
  try {
    const res = await fetch(process.env.NEXT_PUBLIC_FABRIC_GRAPHQL_ENDPOINT!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query, variables }),
    });
    if (res.status === 401) {
      return { error: "SESSION_EXPIRED" };
    }
    const json = await res.json();
    if (json.errors) return { error: json.errors[0]?.message || "Error de GraphQL" };
    return { data: json.data };
  } catch (e) {
    return { error: "No se pudo conectar con Fabric" };
  }
}
```

Todos los componentes que llamaban fetchGraphQL directamente ahora deben:
1. Obtener el token con useFabricAuth().getAccessToken() antes de cada llamada
2. Pasarlo como tercer argumento
3. Si el resultado es { error: "SESSION_EXPIRED" }, mostrar toast "Tu sesión
   expiró, vuelve a iniciar sesión" y llamar a logout()

## Pantalla de login

Antes de renderizar el dashboard, si !isAuthenticated muestra una pantalla
centrada que respete la estética dark industrial existente (fondo zinc-950,
franja de rayas hazard arriba, tarjeta zinc-900 con borde zinc-800):
- Logo "CEDIS ·CTRL"
- Texto: "Inicia sesión con tu cuenta de Microsoft para continuar"
- Botón amber-500 "Iniciar sesión con Microsoft" que llama a login()

## Sidebar / topbar

En el footer del sidebar (donde dice "Centro de distribución · Operación en
vivo"), agrega debajo el nombre de la cuenta activa (account.name o
account.username) y un botón pequeño "Cerrar sesión" que llama a logout().

## Modo offline / fallback

Si getAccessToken() devuelve null (usuario no autenticado, o Entra no está
configurado aún en este entorno de preview), la app sigue funcionando con los
datos seed de lib/seed-data.ts y muestra el banner "Modo offline — datos de
demostración" ya definido en los prompts anteriores, en vez de bloquear la UI.

## No hacer

- No inventes un backend propio de sesiones ni cookies de auth manual.
- No hagas login con usuario/contraseña en un formulario propio — todo pasa por
  el popup/redirect de Microsoft vía MSAL.
- No cambies el scope de GraphQLApi.Execute.All.