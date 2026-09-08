// Cortacircuitos del ciclo de re-autenticación.
//
// Un 401 tapa dos cosas que desde el cliente se ven idénticas:
//
//   1. La sesión venció de verdad. Volver a entrar lo arregla.
//   2. La autorización falla y va a seguir fallando: la cuenta no tiene acceso
//      a la GraphQL API de Fabric, el ID token no pasa la verificación del
//      servidor (`aud`/`tid`/reloj), o MSAL no pudo entregar el token de
//      Fabric.
//
// Cerrar la sesión automáticamente solo arregla el caso 1. En el caso 2 manda
// al usuario a Microsoft, que con SSO lo devuelve autenticado en el acto, el
// 401 se repite y se vuelve a cerrar la sesión: **el ciclo infinito de
// redireccionamiento**, del que no se sale porque cada vuelta se ve como un
// intento nuevo.
//
// La regla es entonces: **un solo intento de re-autenticación por pestaña**. El
// primer 401 cierra la sesión como siempre; si al volver falla otra vez, ya no
// se redirige —se avisa y se deja al usuario en la app, con el botón "Cerrar
// sesión" del sidebar a la mano—. Una carga sin 401 limpia la marca, así que
// una sesión que venza más tarde en la misma pestaña vuelve a tener su intento.
//
// La marca vive en sessionStorage porque tiene que sobrevivir al viaje de ida y
// vuelta del redirect: en memoria se perdería justo en la navegación que hay
// que detectar. MSAL solo borra sus propias claves (`msal.*`) al cerrar sesión,
// así que la nuestra sigue ahí al regresar.

const CLAVE = 'cedis:reautenticacion-intentada'

/** Lo que se dice cuando volver a entrar ya se intentó y no sirvió. */
export const MENSAJE_AUTORIZACION_FALLIDA =
  'No se pudo autorizar tu sesión con Microsoft'

export const DETALLE_AUTORIZACION_FALLIDA =
  'Ya se intentó volver a entrar y falló otra vez. Cierra sesión desde el menú lateral o pide acceso al administrador.'

/** sessionStorage puede no existir (SSR) o estar bloqueado por el navegador. */
function almacen(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

export function reautenticacionYaIntentada(): boolean {
  return almacen()?.getItem(CLAVE) === '1'
}

export function marcarReautenticacion(): void {
  try {
    almacen()?.setItem(CLAVE, '1')
  } catch {
    // Sin storage no hay marca posible; el peor caso es el comportamiento
    // anterior, y por eso no se propaga el error.
  }
}

export function limpiarReautenticacion(): void {
  try {
    almacen()?.removeItem(CLAVE)
  } catch {
    // Ídem.
  }
}

/**
 * Cierra la sesión para volver a entrar, pero **solo la primera vez**.
 *
 * @param logout - `logout()` de `useFabricAuth()`; redirige a Microsoft.
 * @returns true si se disparó el cierre de sesión (la página está por
 * navegar), false si ya se había intentado y quien llama debe avisarle al
 * usuario en vez de redirigirlo.
 */
export async function intentarReautenticar(logout: () => Promise<void>): Promise<boolean> {
  if (reautenticacionYaIntentada()) return false
  marcarReautenticacion()
  await logout()
  return true
}
