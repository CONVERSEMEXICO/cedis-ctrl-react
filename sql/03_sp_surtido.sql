/* ===========================================================================
   03_sp_surtido.sql
   Mutación: actualizarEstadoSurtido  (lib/queries.ts)
   Expuesta por Fabric como: mutation { executeActualizarEstadoSurtido(...) }
   =========================================================================== */

CREATE OR ALTER PROCEDURE dbo.ActualizarEstadoSurtido
    @id       NVARCHAR(50),
    @estado   NVARCHAR(50),
    @operador NVARCHAR(120) = NULL   -- opcional: asigna operador al arrancar el surtido
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @id IS NULL OR LTRIM(RTRIM(@id)) = ''
    BEGIN
        THROW 50001, 'El id del pedido de surtido es obligatorio.', 1;
    END

    IF @estado IS NULL OR @estado NOT IN ('pendiente','surtiendo','verificado','completado','pausado')
    BEGIN
        THROW 50010, 'Estado de surtido inválido. Valores permitidos: pendiente, surtiendo, verificado, completado, pausado.', 1;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.surtido WHERE id = @id)
    BEGIN
        THROW 50020, 'No existe un pedido de surtido con ese id.', 1;
    END

    -- Un pedido no puede entrar a 'surtiendo' sin operador asignado.
    IF @estado = 'surtiendo'
       AND @operador IS NULL
       AND NOT EXISTS (SELECT 1 FROM dbo.surtido WHERE id = @id AND operador IS NOT NULL)
    BEGIN
        THROW 50011, 'Para pasar el pedido a ''surtiendo'' se requiere un operador asignado.', 1;
    END

    UPDATE dbo.surtido
       SET estado     = @estado,
           operador   = COALESCE(@operador, operador),
           updated_at = SYSUTCDATETIME()
     WHERE id = @id;

    SELECT id, pedido, cliente, lineas, operador, prioridad, estado, created_at, updated_at
      FROM dbo.surtido
     WHERE id = @id;
END
GO

/* Prueba:
   EXEC dbo.ActualizarEstadoSurtido @id = 'srt-1', @estado = 'surtiendo', @operador = 'Ana Ruiz';
*/
