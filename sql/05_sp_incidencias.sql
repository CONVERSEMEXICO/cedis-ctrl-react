/* ===========================================================================
   05_sp_incidencias.sql
   Mutaciones: crearIncidencia, actualizarEstadoIncidencia  (lib/queries.ts)
   Expuestas por Fabric como:
       mutation { executeCrearIncidencia(...) }
       mutation { executeActualizarEstadoIncidencia(...) }

   Requiere dbo.seq_folio_incidencia e incidencias.fecha_resolucion
   (ver 00_ajustes_esquema.sql).
   =========================================================================== */

CREATE OR ALTER PROCEDURE dbo.CrearIncidencia
    @tipo        NVARCHAR(60),
    @severidad   NVARCHAR(20),
    @modulo      NVARCHAR(30),
    @descripcion NVARCHAR(1000),
    @responsable NVARCHAR(120),
    @id          NVARCHAR(50) = NULL   -- opcional: permite reintentos idempotentes desde el cliente
AS
BEGIN
    SET NOCOUNT ON;

    IF @tipo IS NULL OR @tipo NOT IN ('dano_mercancia','faltante','retraso_transporte','error_surtido',
                     'falla_equipo','seguridad','discrepancia_inventario','etiquetado_rechazado')
    BEGIN
        THROW 50013, 'Tipo de incidencia inválido.', 1;
    END

    IF @severidad IS NULL OR @severidad NOT IN ('baja','media','alta','critica')
    BEGIN
        THROW 50014, 'Severidad inválida. Valores permitidos: baja, media, alta, critica.', 1;
    END

    IF @modulo IS NULL OR @modulo NOT IN ('embarques','recepciones','surtido','etiquetado','productividad','incidencias')
    BEGIN
        THROW 50015, 'Módulo operativo inválido.', 1;
    END

    IF @descripcion IS NULL OR LTRIM(RTRIM(@descripcion)) = ''
    BEGIN
        THROW 50016, 'La descripción de la incidencia es obligatoria.', 1;
    END

    IF @responsable IS NULL OR LTRIM(RTRIM(@responsable)) = ''
    BEGIN
        THROW 50017, 'El responsable de la incidencia es obligatorio.', 1;
    END

    DECLARE @nuevoId    NVARCHAR(50) = COALESCE(NULLIF(LTRIM(RTRIM(@id)), ''), CONVERT(NVARCHAR(36), NEWID()));
    DECLARE @folio      NVARCHAR(30);
    DECLARE @ahoraLocal DATETIME2(0) =
        CONVERT(DATETIME2(0), SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time (Mexico)');

    -- Reintento con el mismo id: no duplica, devuelve la incidencia existente.
    IF NOT EXISTS (SELECT 1 FROM dbo.incidencias WHERE id = @nuevoId)
    BEGIN
        SET @folio = CONCAT('INC-', CAST(NEXT VALUE FOR dbo.seq_folio_incidencia AS NVARCHAR(10)));

        INSERT INTO dbo.incidencias
            (id, folio, modulo, tipo, severidad, estado, responsable, descripcion, fecha, created_at, updated_at)
        VALUES
            (@nuevoId, @folio, @modulo, @tipo, @severidad, 'abierta',
             LTRIM(RTRIM(@responsable)), LTRIM(RTRIM(@descripcion)), @ahoraLocal,
             SYSUTCDATETIME(), SYSUTCDATETIME());
    END

    SELECT id, folio, modulo, tipo, severidad, estado, responsable, descripcion,
           fecha, fecha_resolucion, created_at, updated_at
      FROM dbo.incidencias
     WHERE id = @nuevoId;
END
GO

CREATE OR ALTER PROCEDURE dbo.ActualizarEstadoIncidencia
    @id     NVARCHAR(50),
    @estado NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    IF @id IS NULL OR LTRIM(RTRIM(@id)) = ''
    BEGIN
        THROW 50001, 'El id de la incidencia es obligatorio.', 1;
    END

    IF @estado IS NULL OR @estado NOT IN ('abierta','atencion','resuelta','cerrada')
    BEGIN
        THROW 50010, 'Estado de incidencia inválido. Valores permitidos: abierta, atencion, resuelta, cerrada.', 1;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.incidencias WHERE id = @id)
    BEGIN
        THROW 50020, 'No existe una incidencia con ese id.', 1;
    END

    DECLARE @ahoraLocal DATETIME2(0) =
        CONVERT(DATETIME2(0), SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time (Mexico)');

    UPDATE dbo.incidencias
       SET estado           = @estado,
           -- se sella al resolver/cerrar; se limpia si la incidencia se reabre
           fecha_resolucion = CASE
                                 WHEN @estado IN ('resuelta','cerrada') THEN COALESCE(fecha_resolucion, @ahoraLocal)
                                 ELSE NULL
                              END,
           updated_at       = SYSUTCDATETIME()
     WHERE id = @id;

    SELECT id, folio, modulo, tipo, severidad, estado, responsable, descripcion,
           fecha, fecha_resolucion, created_at, updated_at
      FROM dbo.incidencias
     WHERE id = @id;
END
GO

/* Pruebas:
   EXEC dbo.CrearIncidencia @tipo = 'faltante', @severidad = 'alta', @modulo = 'recepciones',
                            @descripcion = 'Faltan 12 cajas en el pedido', @responsable = 'Jorge Nava';
   EXEC dbo.ActualizarEstadoIncidencia @id = 'inc-1', @estado = 'resuelta';
*/
