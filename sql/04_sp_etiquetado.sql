/* ===========================================================================
   04_sp_etiquetado.sql
   Mutación: actualizarEstadoEtiquetado  (lib/queries.ts)
   Expuesta por Fabric como: mutation { executeActualizarEstadoEtiquetado(...) }

   Requiere la columna etiquetado.motivo_rechazo (ver 00_ajustes_esquema.sql).
   =========================================================================== */

CREATE OR ALTER PROCEDURE dbo.ActualizarEstadoEtiquetado
    @id            NVARCHAR(50),
    @estado        NVARCHAR(50),
    @motivoRechazo NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @id IS NULL OR LTRIM(RTRIM(@id)) = ''
    BEGIN
        THROW 50001, 'El id del lote de etiquetado es obligatorio.', 1;
    END

    IF @estado IS NULL OR @estado NOT IN ('pendiente','proceso','etiquetado','rechazado')
    BEGIN
        THROW 50010, 'Estado de etiquetado inválido. Valores permitidos: pendiente, proceso, etiquetado, rechazado.', 1;
    END

    IF @estado = 'rechazado' AND (@motivoRechazo IS NULL OR LTRIM(RTRIM(@motivoRechazo)) = '')
    BEGIN
        THROW 50012, 'Un lote rechazado requiere motivo de rechazo.', 1;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.etiquetado WHERE id = @id)
    BEGIN
        THROW 50020, 'No existe un lote de etiquetado con ese id.', 1;
    END

    UPDATE dbo.etiquetado
       SET estado         = @estado,
           -- el motivo solo vive mientras el lote está rechazado
           motivo_rechazo = CASE WHEN @estado = 'rechazado' THEN LTRIM(RTRIM(@motivoRechazo)) ELSE NULL END,
           updated_at     = SYSUTCDATETIME()
     WHERE id = @id;

    SELECT id, lote, producto, unidades, operador, estado, motivo_rechazo, created_at, updated_at
      FROM dbo.etiquetado
     WHERE id = @id;
END
GO

/* Prueba:
   EXEC dbo.ActualizarEstadoEtiquetado @id = 'etq-1', @estado = 'rechazado', @motivoRechazo = 'Código de barras ilegible';
*/
