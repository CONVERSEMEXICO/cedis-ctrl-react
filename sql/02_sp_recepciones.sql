/* ===========================================================================
   02_sp_recepciones.sql
   Mutación: actualizarEstadoRecepcion  (lib/queries.ts)
   Expuesta por Fabric como: mutation { executeActualizarEstadoRecepcion(...) }
   =========================================================================== */

CREATE OR ALTER PROCEDURE dbo.ActualizarEstadoRecepcion
    @id     NVARCHAR(50),
    @estado NVARCHAR(50),
    @anden  NVARCHAR(20) = NULL   -- opcional: asigna andén al pasar a 'descarga'
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @id IS NULL OR LTRIM(RTRIM(@id)) = ''
    BEGIN
        THROW 50001, 'El id de la recepción es obligatorio.', 1;
    END

    IF @estado IS NULL OR @estado NOT IN ('programada','descarga','inspeccion','recibida','discrepancia')
    BEGIN
        THROW 50010, 'Estado de recepción inválido. Valores permitidos: programada, descarga, inspeccion, recibida, discrepancia.', 1;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.recepciones WHERE id = @id)
    BEGIN
        THROW 50020, 'No existe una recepción con ese id.', 1;
    END

    UPDATE dbo.recepciones
       SET estado     = @estado,
           anden      = COALESCE(@anden, anden),
           updated_at = SYSUTCDATETIME()
     WHERE id = @id;

    SELECT id, folio, proveedor, anden, unidades, tipo, estado, created_at, updated_at
      FROM dbo.recepciones
     WHERE id = @id;
END
GO

/* Prueba:
   EXEC dbo.ActualizarEstadoRecepcion @id = 'rec-1', @estado = 'descarga', @anden = 'R-04';
*/
