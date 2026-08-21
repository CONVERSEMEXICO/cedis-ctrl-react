/* ===========================================================================
   06_sp_productividad.sql
   Mutación: registrarProductividad  (lib/queries.ts)
   Expuesta por Fabric como: mutation { executeRegistrarProductividad(...) }
   =========================================================================== */

CREATE OR ALTER PROCEDURE dbo.RegistrarProductividad
    @operador NVARCHAR(120),
    @area     NVARCHAR(60),
    @turno    NVARCHAR(20),
    @unidades INT,
    @horas    DECIMAL(9,2),
    @meta     INT,
    @id       NVARCHAR(50) = NULL   -- opcional: permite reintentos idempotentes
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @operador IS NULL OR LTRIM(RTRIM(@operador)) = ''
    BEGIN
        THROW 50017, 'El operador es obligatorio.', 1;
    END

    IF @area IS NULL OR LTRIM(RTRIM(@area)) = ''
    BEGIN
        THROW 50018, 'El área es obligatoria.', 1;
    END

    IF @turno IS NULL OR @turno NOT IN ('matutino','vespertino','nocturno')
    BEGIN
        THROW 50019, 'Turno inválido. Valores permitidos: matutino, vespertino, nocturno.', 1;
    END

    IF @unidades IS NULL OR @unidades < 0
    BEGIN
        THROW 50021, 'Las unidades deben ser un entero mayor o igual a cero.', 1;
    END

    IF @horas IS NULL OR @horas <= 0
    BEGIN
        THROW 50022, 'Las horas trabajadas deben ser mayores a cero.', 1;
    END

    IF @meta IS NULL OR @meta <= 0
    BEGIN
        THROW 50023, 'La meta debe ser mayor a cero.', 1;
    END

    DECLARE @nuevoId NVARCHAR(50) = COALESCE(NULLIF(LTRIM(RTRIM(@id)), ''), CONVERT(NVARCHAR(36), NEWID()));

    IF NOT EXISTS (SELECT 1 FROM dbo.productividad WHERE id = @nuevoId)
    BEGIN
        INSERT INTO dbo.productividad (id, operador, area, turno, unidades, horas, meta, created_at)
        VALUES (@nuevoId, LTRIM(RTRIM(@operador)), LTRIM(RTRIM(@area)), @turno,
                @unidades, @horas, @meta, SYSUTCDATETIME());
    END

    SELECT id, operador, area, turno, unidades, horas, meta, created_at
      FROM dbo.productividad
     WHERE id = @nuevoId;
END
GO

/* Prueba:
   EXEC dbo.RegistrarProductividad @operador = 'Ana Ruiz', @area = 'Surtido', @turno = 'matutino',
                                   @unidades = 480, @horas = 8.00, @meta = 500;
*/
