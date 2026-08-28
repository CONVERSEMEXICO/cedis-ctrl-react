/* ===========================================================================
   08_sp_altas.sql
   Mutaciones de alta: crearEmbarque, crearRecepcion, crearPedidoSurtido,
   crearLoteEtiquetado  (lib/queries.ts)
   Expuestas por Fabric como:
       mutation { executeCrearEmbarque(...) }
       mutation { executeCrearRecepcion(...) }
       mutation { executeCrearPedidoSurtido(...) }
       mutation { executeCrearLoteEtiquetado(...) }

   POR QUÉ EXISTE ESTE ARCHIVO
   ---------------------------
   Las altas usaban las mutations `create*` que Fabric genera por tabla. Ese
   input incluye `created_at` / `updated_at`, así que el sello de auditoría lo
   ponía el navegador: la hora la decidía el reloj del cliente y cualquiera con
   el token podía fechar un alta a modo. El esquema generado no se puede
   reformar —el SDL es de solo lectura, y quitar la columna la quita también de
   las lecturas, donde sí se necesita—, así que la salida es esta: el alta pasa
   por SP, el sello lo pone SYSUTCDATETIME() y las mutations `create*` se
   deshabilitan desde el schema explorer.

   Todos siguen el patrón de 05_sp_incidencias.sql:
     - `@id` opcional para que un reintento no duplique el registro;
     - validan el dominio antes de escribir y lanzan THROW numerado;
     - cierran con UN SOLO SELECT de la fila creada — esa es la carga útil que
       recibe lib/queries.ts.

   SUPUESTO A VERIFICAR: los tipos de los parámetros están escritos contra el
   DDL que se infiere del .graphql exportado. Si alguna columna es más corta en
   la base real, ajusta aquí: un NVARCHAR más corto trunca en silencio.
   =========================================================================== */

SET NOCOUNT ON;
GO

/* ---------------------------------------------------------------------------
   Embarques
   --------------------------------------------------------------------------- */

CREATE OR ALTER PROCEDURE dbo.CrearEmbarque
    @folio         NVARCHAR(30),
    @destino       NVARCHAR(200),
    @transportista NVARCHAR(120),
    @unidades      INT           = NULL,
    @horaSalida    NVARCHAR(10)  = NULL,   -- texto 'HH:mm'
    @estado        NVARCHAR(20)  = 'programado',
    @id            NVARCHAR(50)  = NULL    -- opcional: reintento idempotente
AS
BEGIN
    SET NOCOUNT ON;

    IF @folio IS NULL OR LTRIM(RTRIM(@folio)) = ''
    BEGIN
        THROW 50030, 'El folio del embarque es obligatorio.', 1;
    END

    IF @destino IS NULL OR LTRIM(RTRIM(@destino)) = ''
    BEGIN
        THROW 50031, 'El destino del embarque es obligatorio.', 1;
    END

    IF @transportista IS NULL OR LTRIM(RTRIM(@transportista)) = ''
    BEGIN
        THROW 50031, 'El transportista del embarque es obligatorio.', 1;
    END

    IF @unidades IS NOT NULL AND @unidades < 0
    BEGIN
        THROW 50032, 'Las unidades no pueden ser negativas.', 1;
    END

    SET @estado = COALESCE(NULLIF(LTRIM(RTRIM(@estado)), ''), 'programado');

    IF @estado NOT IN ('programado','cargando','transito','entregado','retrasado')
    BEGIN
        THROW 50010, 'Estado de embarque inválido. Valores permitidos: programado, cargando, transito, entregado, retrasado.', 1;
    END

    -- Se guarda normalizada a 'HH:mm'; TRY_CONVERT rechaza cualquier otra cosa.
    SET @horaSalida = NULLIF(LTRIM(RTRIM(@horaSalida)), '');

    IF @horaSalida IS NOT NULL AND TRY_CONVERT(TIME(0), @horaSalida) IS NULL
    BEGIN
        THROW 50033, 'La hora de salida debe tener el formato HH:mm.', 1;
    END

    IF @horaSalida IS NOT NULL
        SET @horaSalida = CONVERT(CHAR(5), TRY_CONVERT(TIME(0), @horaSalida), 108);

    DECLARE @nuevoId NVARCHAR(50) = COALESCE(NULLIF(LTRIM(RTRIM(@id)), ''), CONVERT(NVARCHAR(36), NEWID()));

    SET @folio = LTRIM(RTRIM(@folio));

    IF EXISTS (SELECT 1 FROM dbo.embarques WHERE folio = @folio AND id <> @nuevoId)
    BEGIN
        THROW 50035, 'Ya existe un embarque con ese folio.', 1;
    END

    -- Reintento con el mismo id: no duplica, devuelve el embarque existente.
    IF NOT EXISTS (SELECT 1 FROM dbo.embarques WHERE id = @nuevoId)
    BEGIN
        INSERT INTO dbo.embarques
            (id, folio, destino, transportista, unidades, hora_salida, estado, created_at, updated_at)
        VALUES
            (@nuevoId, @folio, LTRIM(RTRIM(@destino)), LTRIM(RTRIM(@transportista)),
             @unidades, @horaSalida, @estado,
             SYSUTCDATETIME(), SYSUTCDATETIME());
    END

    SELECT id, folio, destino, transportista, unidades, hora_salida, estado, created_at, updated_at
      FROM dbo.embarques
     WHERE id = @nuevoId;
END
GO

/* ---------------------------------------------------------------------------
   Recepciones
   --------------------------------------------------------------------------- */

CREATE OR ALTER PROCEDURE dbo.CrearRecepcion
    @folio     NVARCHAR(30),
    @proveedor NVARCHAR(200),
    @anden     NVARCHAR(30)  = NULL,
    @unidades  INT           = NULL,
    @tipo      NVARCHAR(60)  = NULL,
    @estado    NVARCHAR(20)  = 'programada',
    @id        NVARCHAR(50)  = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @folio IS NULL OR LTRIM(RTRIM(@folio)) = ''
    BEGIN
        THROW 50030, 'El folio de la recepción es obligatorio.', 1;
    END

    IF @proveedor IS NULL OR LTRIM(RTRIM(@proveedor)) = ''
    BEGIN
        THROW 50031, 'El proveedor de la recepción es obligatorio.', 1;
    END

    IF @unidades IS NOT NULL AND @unidades < 0
    BEGIN
        THROW 50032, 'Las unidades no pueden ser negativas.', 1;
    END

    SET @estado = COALESCE(NULLIF(LTRIM(RTRIM(@estado)), ''), 'programada');

    IF @estado NOT IN ('programada','descarga','inspeccion','recibida','discrepancia')
    BEGIN
        THROW 50010, 'Estado de recepción inválido. Valores permitidos: programada, descarga, inspeccion, recibida, discrepancia.', 1;
    END

    DECLARE @nuevoId NVARCHAR(50) = COALESCE(NULLIF(LTRIM(RTRIM(@id)), ''), CONVERT(NVARCHAR(36), NEWID()));

    SET @folio = LTRIM(RTRIM(@folio));

    IF EXISTS (SELECT 1 FROM dbo.recepciones WHERE folio = @folio AND id <> @nuevoId)
    BEGIN
        THROW 50035, 'Ya existe una recepción con ese folio.', 1;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.recepciones WHERE id = @nuevoId)
    BEGIN
        INSERT INTO dbo.recepciones
            (id, folio, proveedor, anden, unidades, tipo, estado, created_at, updated_at)
        VALUES
            (@nuevoId, @folio, LTRIM(RTRIM(@proveedor)),
             NULLIF(LTRIM(RTRIM(@anden)), ''), @unidades, NULLIF(LTRIM(RTRIM(@tipo)), ''), @estado,
             SYSUTCDATETIME(), SYSUTCDATETIME());
    END

    SELECT id, folio, proveedor, anden, unidades, tipo, estado, created_at, updated_at
      FROM dbo.recepciones
     WHERE id = @nuevoId;
END
GO

/* ---------------------------------------------------------------------------
   Surtido
   --------------------------------------------------------------------------- */

CREATE OR ALTER PROCEDURE dbo.CrearPedidoSurtido
    @pedido    NVARCHAR(30),
    @cliente   NVARCHAR(200),
    @lineas    INT           = NULL,
    @operador  NVARCHAR(120) = NULL,
    @prioridad NVARCHAR(20)  = 'Media',      -- la tabla la guarda capitalizada
    @estado    NVARCHAR(20)  = 'pendiente',
    @id        NVARCHAR(50)  = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @pedido IS NULL OR LTRIM(RTRIM(@pedido)) = ''
    BEGIN
        THROW 50030, 'El folio del pedido es obligatorio.', 1;
    END

    IF @cliente IS NULL OR LTRIM(RTRIM(@cliente)) = ''
    BEGIN
        THROW 50031, 'El cliente del pedido es obligatorio.', 1;
    END

    IF @lineas IS NOT NULL AND @lineas < 0
    BEGIN
        THROW 50032, 'Las líneas no pueden ser negativas.', 1;
    END

    SET @prioridad = COALESCE(NULLIF(LTRIM(RTRIM(@prioridad)), ''), 'Media');

    IF @prioridad NOT IN ('Alta','Media','Baja')
    BEGIN
        THROW 50034, 'Prioridad inválida. Valores permitidos: Alta, Media, Baja.', 1;
    END

    SET @estado   = COALESCE(NULLIF(LTRIM(RTRIM(@estado)), ''), 'pendiente');
    SET @operador = NULLIF(LTRIM(RTRIM(@operador)), '');

    IF @estado NOT IN ('pendiente','surtiendo','verificado','completado','pausado')
    BEGIN
        THROW 50010, 'Estado de surtido inválido. Valores permitidos: pendiente, surtiendo, verificado, completado, pausado.', 1;
    END

    -- Misma regla que ActualizarEstadoSurtido: no se surte sin operador.
    IF @estado = 'surtiendo' AND @operador IS NULL
    BEGIN
        THROW 50011, 'No se puede poner el pedido en surtido sin operador asignado.', 1;
    END

    DECLARE @nuevoId NVARCHAR(50) = COALESCE(NULLIF(LTRIM(RTRIM(@id)), ''), CONVERT(NVARCHAR(36), NEWID()));

    SET @pedido = LTRIM(RTRIM(@pedido));

    IF EXISTS (SELECT 1 FROM dbo.surtido WHERE pedido = @pedido AND id <> @nuevoId)
    BEGIN
        THROW 50035, 'Ya existe un pedido de surtido con ese folio.', 1;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.surtido WHERE id = @nuevoId)
    BEGIN
        INSERT INTO dbo.surtido
            (id, pedido, cliente, lineas, operador, prioridad, estado, created_at, updated_at)
        VALUES
            (@nuevoId, @pedido, LTRIM(RTRIM(@cliente)), @lineas, @operador, @prioridad, @estado,
             SYSUTCDATETIME(), SYSUTCDATETIME());
    END

    SELECT id, pedido, cliente, lineas, operador, prioridad, estado, created_at, updated_at
      FROM dbo.surtido
     WHERE id = @nuevoId;
END
GO

/* ---------------------------------------------------------------------------
   Etiquetado
   --------------------------------------------------------------------------- */

CREATE OR ALTER PROCEDURE dbo.CrearLoteEtiquetado
    @lote          NVARCHAR(30),
    @producto      NVARCHAR(200),
    @unidades      INT           = NULL,
    @operador      NVARCHAR(120) = NULL,
    @estado        NVARCHAR(20)  = 'pendiente',
    @motivoRechazo NVARCHAR(500) = NULL,
    @id            NVARCHAR(50)  = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @lote IS NULL OR LTRIM(RTRIM(@lote)) = ''
    BEGIN
        THROW 50030, 'El folio del lote es obligatorio.', 1;
    END

    IF @producto IS NULL OR LTRIM(RTRIM(@producto)) = ''
    BEGIN
        THROW 50031, 'El producto del lote es obligatorio.', 1;
    END

    IF @unidades IS NOT NULL AND @unidades < 0
    BEGIN
        THROW 50032, 'Las unidades no pueden ser negativas.', 1;
    END

    SET @estado        = COALESCE(NULLIF(LTRIM(RTRIM(@estado)), ''), 'pendiente');
    SET @motivoRechazo = NULLIF(LTRIM(RTRIM(@motivoRechazo)), '');

    IF @estado NOT IN ('pendiente','proceso','etiquetado','rechazado')
    BEGIN
        THROW 50010, 'Estado de etiquetado inválido. Valores permitidos: pendiente, proceso, etiquetado, rechazado.', 1;
    END

    -- Misma regla que ActualizarEstadoEtiquetado: rechazar exige motivo.
    IF @estado = 'rechazado' AND @motivoRechazo IS NULL
    BEGIN
        THROW 50012, 'Un lote rechazado requiere motivo de rechazo.', 1;
    END

    DECLARE @nuevoId NVARCHAR(50) = COALESCE(NULLIF(LTRIM(RTRIM(@id)), ''), CONVERT(NVARCHAR(36), NEWID()));

    SET @lote = LTRIM(RTRIM(@lote));

    IF EXISTS (SELECT 1 FROM dbo.etiquetado WHERE lote = @lote AND id <> @nuevoId)
    BEGIN
        THROW 50035, 'Ya existe un lote de etiquetado con ese folio.', 1;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.etiquetado WHERE id = @nuevoId)
    BEGIN
        INSERT INTO dbo.etiquetado
            (id, lote, producto, unidades, operador, estado, motivo_rechazo, created_at, updated_at)
        VALUES
            (@nuevoId, @lote, LTRIM(RTRIM(@producto)), @unidades,
             NULLIF(LTRIM(RTRIM(@operador)), ''), @estado,
             CASE WHEN @estado = 'rechazado' THEN @motivoRechazo ELSE NULL END,
             SYSUTCDATETIME(), SYSUTCDATETIME());
    END

    SELECT id, lote, producto, unidades, operador, estado, motivo_rechazo, created_at, updated_at
      FROM dbo.etiquetado
     WHERE id = @nuevoId;
END
GO

/* Pruebas:
   EXEC dbo.CrearEmbarque       @folio = 'EMB-9001', @destino = 'CDMX Norte',
                                @transportista = 'Transportes Vega', @unidades = 320,
                                @horaSalida = '08:00';
   EXEC dbo.CrearRecepcion      @folio = 'REC-9001', @proveedor = 'Alimentos del Bajio',
                                @anden = 'A3', @unidades = 180, @tipo = 'paletizada';
   EXEC dbo.CrearPedidoSurtido  @pedido = 'PED-9001', @cliente = 'Abarrotes Sur',
                                @lineas = 24, @prioridad = 'Alta';
   EXEC dbo.CrearLoteEtiquetado @lote = 'LOT-9001', @producto = 'Caja 12x1L',
                                @unidades = 500, @operador = 'Marisol Ruiz';
*/
