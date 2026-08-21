// Configuración de MSAL para autenticar contra Microsoft Entra ID.
//
// Todo el flujo corre en el navegador (redirect/popup de Microsoft), así que
// las variables llevan prefijo NEXT_PUBLIC_ y Next las inlinea en el bundle
// **en tiempo de build**: en Docker son build args, no variables de runtime
// (ver Dockerfile y docker-compose.yml).

import type { Configuration } from '@azure/msal-browser'

const CLIENT_ID = process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID ?? ''
const TENANT_ID = process.env.NEXT_PUBLIC_ENTRA_TENANT_ID ?? ''

/**
 * Sin clientId ni tenantId no hay login posible: la app arranca en modo
 * demostración —datos seed y <BannerOffline />— en vez de bloquear la UI.
 */
export const entraConfigurado = CLIENT_ID !== '' && TENANT_ID !== ''

export const msalConfig: Configuration = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    redirectUri:
      process.env.NEXT_PUBLIC_ENTRA_REDIRECT_URI ||
      (typeof window !== 'undefined' ? window.location.origin : ''),
  },
  cache: {
    // sessionStorage: el token muere al cerrar la pestaña, que es lo que se
    // quiere en las terminales compartidas del piso del CEDIS.
    // (msal-browser 5 ya no tiene `storeAuthStateInCookie`: se quitó del tipo
    // CacheOptions, el estado de auth siempre va en el storage configurado.)
    cacheLocation: 'sessionStorage',
  },
}

// IMPORTANTE: este scope es exacto y obligatorio para la GraphQL API de
// Fabric. No lo modifiques ni lo quites, o la autenticación falla.
export const loginRequest = {
  scopes: ['https://analysis.windows.net/powerbi/api/GraphQLApi.Execute.All'],
}
