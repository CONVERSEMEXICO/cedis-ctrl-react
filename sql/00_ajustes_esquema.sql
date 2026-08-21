/* ===========================================================================
   00_ajustes_esquema.sql
   Ajustes previos a los stored procedures de mutación.
   Motor: Microsoft Fabric SQL Database (T-SQL, motor Azure SQL).

   Idempotente: se puede correr varias veces sin efecto adicional.

   IMPORTANTE: después de correr este script hay que volver a exponer las
   tablas en la API for GraphQL (Fabric > API for GraphQL > Manage data /
   Refresh schema) para que las columnas nuevas aparezcan en el esquema.
   =========================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* ---------------------------------------------------------------------------
   1. Columnas faltantes que las mutaciones necesitan
   --------------------------------------------------------------------------- */

-- etiquetado.motivo_rechazo — lo requiere ActualizarEstadoEtiquetado
IF COL_LENGTH('dbo.etiquetado', 'motivo_rechazo') IS NULL
    ALTER TABLE dbo.etiquetado ADD motivo_rechazo NVARCHAR(500) NULL;
GO

-- incidencias.fecha_resolucion — la sella ActualizarEstadoIncidencia
IF COL_LENGTH('dbo.incidencias', 'fecha_resolucion') IS NULL
    ALTER TABLE dbo.incidencias ADD fecha_resolucion DATETIME2(0) NULL;
GO

/* ---------------------------------------------------------------------------
   2. Secuencias para folios generados por las mutaciones de alta
   Formato de folio existente en el CEDIS: INC-5510 (ver lib/seed-data.ts).
   Ajusta START WITH al folio máximo real + 1 antes de correr en producción:
       SELECT MAX(TRY_CAST(REPLACE(folio,'INC-','') AS INT)) FROM dbo.incidencias;
   --------------------------------------------------------------------------- */

IF NOT EXISTS (SELECT 1 FROM sys.sequences WHERE name = 'seq_folio_incidencia' AND SCHEMA_NAME(schema_id) = 'dbo')
    CREATE SEQUENCE dbo.seq_folio_incidencia AS INT START WITH 5514 INCREMENT BY 1;
GO

/* ---------------------------------------------------------------------------
   3. Restricciones de dominio sobre los estados
   Los valores son exactamente los de types/cedis.ts. Se agregan WITH NOCHECK
   para no fallar si hay filas históricas fuera del dominio; las mutaciones sí
   validan siempre (THROW 50010) antes de escribir.

   Verifica antes qué filas quedarían fuera:
       SELECT DISTINCT estado FROM dbo.embarques;   -- etc.
   --------------------------------------------------------------------------- */

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_embarques_estado')
    ALTER TABLE dbo.embarques WITH NOCHECK ADD CONSTRAINT CK_embarques_estado
        CHECK (estado IN ('programado','cargando','transito','entregado','retrasado'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_recepciones_estado')
    ALTER TABLE dbo.recepciones WITH NOCHECK ADD CONSTRAINT CK_recepciones_estado
        CHECK (estado IN ('programada','descarga','inspeccion','recibida','discrepancia'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_surtido_estado')
    ALTER TABLE dbo.surtido WITH NOCHECK ADD CONSTRAINT CK_surtido_estado
        CHECK (estado IN ('pendiente','surtiendo','verificado','completado','pausado'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_etiquetado_estado')
    ALTER TABLE dbo.etiquetado WITH NOCHECK ADD CONSTRAINT CK_etiquetado_estado
        CHECK (estado IN ('pendiente','proceso','etiquetado','rechazado'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_incidencias_estado')
    ALTER TABLE dbo.incidencias WITH NOCHECK ADD CONSTRAINT CK_incidencias_estado
        CHECK (estado IN ('abierta','atencion','resuelta','cerrada'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_incidencias_severidad')
    ALTER TABLE dbo.incidencias WITH NOCHECK ADD CONSTRAINT CK_incidencias_severidad
        CHECK (severidad IN ('baja','media','alta','critica'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_incidencias_modulo')
    ALTER TABLE dbo.incidencias WITH NOCHECK ADD CONSTRAINT CK_incidencias_modulo
        CHECK (modulo IN ('embarques','recepciones','surtido','etiquetado','productividad','incidencias'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_incidencias_tipo')
    ALTER TABLE dbo.incidencias WITH NOCHECK ADD CONSTRAINT CK_incidencias_tipo
        CHECK (tipo IN ('dano_mercancia','faltante','retraso_transporte','error_surtido',
                        'falla_equipo','seguridad','discrepancia_inventario','etiquetado_rechazado'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_productividad_turno')
    ALTER TABLE dbo.productividad WITH NOCHECK ADD CONSTRAINT CK_productividad_turno
        CHECK (turno IN ('matutino','vespertino','nocturno'));
GO
