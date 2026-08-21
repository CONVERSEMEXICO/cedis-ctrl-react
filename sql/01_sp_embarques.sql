/* ===========================================================================
   01_sp_embarques.sql
   Mutación: actualizarEstadoEmbarque  (lib/queries.ts)
   Expuesta por Fabric como: mutation { executeActualizarEstadoEmbarque(...) }
   =========================================================================== */

CREATE OR ALTER PROCEDURE dbo.ActualizarEstadoEmbarque
    @id     NVARCHAR(50),
    @estado NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @id IS NULL OR LTRIM(RTRIM(@id)) = ''
    BEGIN
        THROW 50001, 'El id del embarque es obligatorio.', 1;
    END

    IF @estado IS NULL OR @estado NOT IN ('programado','cargando','transito','entregado','retrasado')
    BEGIN
        THROW 50010, 'Estado de embarque inválido. Valores permitidos: programado, cargando, transito, entregado, retrasado.', 1;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.embarques WHERE id = @id)
    BEGIN
        THROW 50020, 'No existe un embarque con ese id.', 1;
    END

    -- Hora local del CEDIS para el sello de salida (hora_salida es texto 'HH:mm').
    DECLARE @ahoraLocal DATETIME2(0) =
        CONVERT(DATETIME2(0), SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time (Mexico)');

    UPDATE dbo.embarques
       SET estado      = @estado,
           hora_salida = CASE
                            WHEN @estado = 'transito' AND hora_salida IS NULL
                                THEN CONVERT(CHAR(5), @ahoraLocal, 108)
                            ELSE hora_salida
                         END,
           updated_at  = SYSUTCDATETIME()
     WHERE id = @id;

    -- Único result set: Fabric lo serializa como JSON en DbOperationResult.result
    SELECT id, folio, destino, transportista, unidades, hora_salida, estado, created_at, updated_at
      FROM dbo.embarques
     WHERE id = @id;
END
GO

/* Prueba:
   EXEC dbo.ActualizarEstadoEmbarque @id = 'emb-1', @estado = 'transito';
*/
