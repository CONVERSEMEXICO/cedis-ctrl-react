/* ===========================================================================
   07_permisos.sql
   Permisos mínimos para la identidad que consume la API for GraphQL.

   En Fabric la API for GraphQL ejecuta con la identidad del llamador (Entra ID)
   o con la identidad configurada en la conexión. Sustituye <principal> por ese
   usuario / grupo / service principal, ya creado en la base:

       CREATE USER [app-cedis-ctrl] FROM EXTERNAL PROVIDER;

   Este script imprime los GRANT; revísalos y descomenta el sp_executesql.
   =========================================================================== */

DECLARE @principal SYSNAME = N'<principal>';   -- <-- reemplazar

DECLARE @sql NVARCHAR(MAX) =
    N'GRANT SELECT ON OBJECT::dbo.embarques TO '     + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT SELECT ON OBJECT::dbo.recepciones TO '   + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT SELECT ON OBJECT::dbo.surtido TO '       + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT SELECT ON OBJECT::dbo.etiquetado TO '    + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT SELECT ON OBJECT::dbo.incidencias TO '   + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT SELECT ON OBJECT::dbo.productividad TO ' + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT EXECUTE ON OBJECT::dbo.ActualizarEstadoEmbarque TO '   + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT EXECUTE ON OBJECT::dbo.ActualizarEstadoRecepcion TO '  + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT EXECUTE ON OBJECT::dbo.ActualizarEstadoSurtido TO '    + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT EXECUTE ON OBJECT::dbo.ActualizarEstadoEtiquetado TO ' + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT EXECUTE ON OBJECT::dbo.CrearIncidencia TO '            + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT EXECUTE ON OBJECT::dbo.ActualizarEstadoIncidencia TO ' + QUOTENAME(@principal) + N';' + CHAR(10) +
    N'GRANT EXECUTE ON OBJECT::dbo.RegistrarProductividad TO '     + QUOTENAME(@principal) + N';' + CHAR(10) +
    -- La secuencia se consume dentro del SP; con ownership chaining suele bastar,
    -- pero si la API ejecuta con otra identidad hace falta el permiso explícito.
    N'GRANT UPDATE ON OBJECT::dbo.seq_folio_incidencia TO ' + QUOTENAME(@principal) + N';';

PRINT @sql;
-- EXEC sp_executesql @sql;
