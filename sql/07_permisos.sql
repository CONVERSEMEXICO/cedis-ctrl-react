/* ===========================================================================
   07_permisos.sql
   Permisos de la base para quien consume la API for GraphQL.

   POR QUÉ ESTE SCRIPT ES LA PIEZA QUE SE OLVIDA
   ---------------------------------------------
   Dar de alta al usuario en el registro de aplicación de Entra ID y asignarle
   el app role (CEDIS.Operador / Supervisor / Administrador) **no le da acceso a
   los datos**: eso solo decide qué puede hacer dentro del panel. La API for
   GraphQL de Fabric ejecuta contra la base SQL con la identidad del llamador
   cuando la conexión está en SSO, así que además hace falta que esa persona
   exista como usuario **dentro de esta base** y tenga los GRANT de abajo.

   Cuando falta esto, la API responde HTTP 200 —no un 401— con un error por
   cada campo raíz:

       "The request to data source failed with authentication error.
        Ensure the access to data source is configured correctly."

   Desde el panel se ve como si el login hubiera fallado: el usuario entra y no
   ve un solo dato. El toast lo nombra (`MENSAJE_SIN_ACCESO_ORIGEN` en
   lib/graphql.ts), y el arreglo es correr esto.

   CÓMO SE USA
   -----------
   1. Sustituye <principal> por el usuario, grupo de Entra o service principal.
      Conviene un **grupo de seguridad** y no persona por persona: alta y baja
      se vuelven membresía del grupo, sin volver a tocar la base.
   2. Corre el script: imprime los GRANT sin ejecutarlos.
   3. Revísalos y descomenta el `EXEC sp_executesql` del final.

   Si la conexión de la API no está en SSO sino con una identidad fija, el
   <principal> es esa identidad —una sola— y los usuarios no necesitan nada
   aquí. Ver la nota "Auditoría" del README.
   =========================================================================== */

DECLARE @principal SYSNAME = N'<principal>';   -- <-- reemplazar

/* El usuario tiene que existir en la base antes de los GRANT. Se crea desde
   Entra ID, sin contraseña: la identidad la sigue resolviendo el directorio.

   Descomenta si todavía no existe (falla si ya está creado, por eso va aparte):

       CREATE USER [<principal>] FROM EXTERNAL PROVIDER;
*/

DECLARE @sql NVARCHAR(MAX) =
    /* --- Lectura: los siete conjuntos de la consulta agrupada ------------- */
    N'GRANT SELECT ON OBJECT::dbo.embarques TO '     + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT SELECT ON OBJECT::dbo.recepciones TO '   + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT SELECT ON OBJECT::dbo.surtido TO '       + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT SELECT ON OBJECT::dbo.etiquetado TO '    + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT SELECT ON OBJECT::dbo.incidencias TO '   + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT SELECT ON OBJECT::dbo.productividad TO ' + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT SELECT ON OBJECT::dbo.pedidos TO '       + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT SELECT ON OBJECT::dbo.pedido_lineas TO ' + QUOTENAME(@principal) + N';' + CHAR(10) +

    /* --- Escritura: toda mutación va por stored procedure ----------------- */
    N'GRANT EXECUTE ON OBJECT::dbo.CrearEmbarque TO '               + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT EXECUTE ON OBJECT::dbo.CrearRecepcion TO '              + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT EXECUTE ON OBJECT::dbo.CrearPedidoSurtido TO '          + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT EXECUTE ON OBJECT::dbo.CrearSurtidoDesdePedido TO '     + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT EXECUTE ON OBJECT::dbo.CrearLoteEtiquetado TO '         + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT EXECUTE ON OBJECT::dbo.CrearIncidencia TO '             + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT EXECUTE ON OBJECT::dbo.RegistrarProductividad TO '      + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT EXECUTE ON OBJECT::dbo.ActualizarEstadoEmbarque TO '    + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT EXECUTE ON OBJECT::dbo.ActualizarEstadoRecepcion TO '   + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT EXECUTE ON OBJECT::dbo.ActualizarEstadoSurtido TO '     + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT EXECUTE ON OBJECT::dbo.ActualizarEstadoEtiquetado TO '  + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT EXECUTE ON OBJECT::dbo.ActualizarEstadoPedido TO '      + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT EXECUTE ON OBJECT::dbo.ActualizarEstadoIncidencia TO '  + QUOTENAME(@principal) + N';' + CHAR(10) +

    /* --- Borrado: la única escritura que NO pasa por un SP ----------------
       El panel borra con las mutations `delete*` que Fabric genera por tabla
       (lib/queries.ts: deleteembarques, deleterecepciones, deletesurtido,
       deleteetiquetado, deleteproductividad), así que el permiso va sobre la
       tabla y no sobre un procedimiento. Sin estos GRANT el botón de borrar
       falla aunque el rol del panel sí lo permita.
       Pedidos no se borra desde el panel: los captura el ERP.              */
    N'GRANT DELETE ON OBJECT::dbo.embarques TO '     + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT DELETE ON OBJECT::dbo.recepciones TO '   + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT DELETE ON OBJECT::dbo.surtido TO '       + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT DELETE ON OBJECT::dbo.etiquetado TO '    + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT DELETE ON OBJECT::dbo.productividad TO ' + QUOTENAME(@principal) + N';' + CHAR(10) +

    /* La secuencia se consume dentro del SP; con ownership chaining suele
       bastar, pero si la API ejecuta con otra identidad hace falta explícito. */
    N'GRANT UPDATE ON OBJECT::dbo.seq_folio_incidencia TO ' + QUOTENAME(@principal) + N';';

PRINT @sql;
-- EXEC sp_executesql @sql;

/* ---------------------------------------------------------------------------
   DIAGNÓSTICO: qué tiene hoy un principal.
   Descomenta y corre para ver si el problema son los permisos o la conexión.

SELECT  pr.name                AS principal,
        pr.type_desc,
        pe.permission_name,
        pe.state_desc,
        OBJECT_NAME(pe.major_id) AS objeto
FROM    sys.database_permissions pe
JOIN    sys.database_principals  pr ON pr.principal_id = pe.grantee_principal_id
WHERE   pr.name = N'<principal>'
ORDER BY objeto, pe.permission_name;

   Si la consulta no devuelve **ninguna** fila, el usuario ni siquiera existe en
   la base: falta el CREATE USER ... FROM EXTERNAL PROVIDER de arriba.
   --------------------------------------------------------------------------- */
