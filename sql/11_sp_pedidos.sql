/* ===========================================================================
   11_sp_pedidos.sql
   Vínculo pedido → surtido.
   Expuesto por Fabric como:
       mutation { executeCrearSurtidoDesdePedido(...) }
       mutation { executeActualizarEstadoPedido(...) }

   POR QUÉ EXISTE ESTE ARCHIVO
   ---------------------------
   El módulo de pedidos necesita dos cosas del lado del server:

     1. `surtido.pedido_id`, la columna que ata una orden de surtido al pedido
        del ERP que la originó.
     2. Un SP que abra esa orden y marque el pedido como 'asignado' **en la
        misma transacción**. Si fueran dos llamadas desde el cliente, una caída
        entre ambas dejaría un pedido 'pendiente' con surtido ya abierto: la UI
        volvería a ofrecer "Crear surtido" sobre un pedido que ya lo tiene.

   CONTRATO (el que consume lib/queries.ts — no cambiarlo sin cambiar allá):

       executeCrearSurtidoDesdePedido(
         id: String, pedido_id: String, pedido: String, cliente: String,
         lineas: Int, operador: String, prioridad: String
       ): [CrearSurtidoDesdePedido!]!

   Dos cosas de este contrato que conviene tener presentes:

     - **No recibe `estado`.** El surtido nace siempre 'pendiente'; arrancarlo
       es un cambio de estatus posterior, por ActualizarEstadoSurtido, que es
       donde vive la regla de "no se pasa a 'surtiendo' sin operador".
     - **`pedido` (folio), `cliente` y `lineas` llegan del navegador**, no los
       deriva el SP del pedido. Quien llama los toma del registro y el Route
       Handler solo los reenvía, así que hoy la coherencia entre el surtido y
       su pedido depende del llamador.

   MEJORA PENDIENTE — validar la integridad contra la tabla `cliente`
   -----------------------------------------------------------------
   La tabla `cliente` se integra en un release posterior. Cuando exista, este
   SP es el lugar donde cierra el hueco de arriba: en vez de aceptar `@cliente`
   como texto libre, se valida —o de plano se sustituye por una FK a
   `cliente`— y se compara `@pedido` contra dbo.pedido antes del INSERT:

       IF NOT EXISTS (SELECT 1 FROM dbo.pedido
                       WHERE id = @pedido_id AND folio = @pedido AND cliente = @cliente)
       BEGIN
           THROW 50037, 'El folio o el cliente no corresponden al pedido.', 1;
       END

   Se deja anotado y no implementado a propósito: sin la tabla `cliente` la
   comparación sería contra el mismo texto libre que se quiere dejar de tener,
   y adelantar el THROW divergiría del SP ya desplegado. Al hacerlo, agregar
   50037 a la tabla de errores de README.md.

   IDEMPOTENCIA. `@id` lo genera el navegador con crypto.randomUUID() y llega
   siempre. Un reintento tras una respuesta perdida cae sobre el mismo id y no
   abre un segundo surtido; el índice único sobre `pedido_id` cierra la otra
   puerta, la de dos usuarios asignando el mismo pedido a la vez.

   SUPUESTO A VERIFICAR: los tipos de los parámetros están escritos contra las
   convenciones de 08_sp_altas.sql, no contra el DDL real de `pedido` y
   `pedido_linea`. Antes de ejecutar, cotejar nombres de tabla y longitudes con
   09_diagnostico_columnas.sql.
   =========================================================================== */

SET NOCOUNT ON;
GO

/* ---------------------------------------------------------------------------
   Columna de vínculo + índice único
   Idempotente: se puede volver a correr sin efecto.
   --------------------------------------------------------------------------- */

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
     WHERE object_id = OBJECT_ID('dbo.surtido') AND name = 'pedido_id'
)
BEGIN
    ALTER TABLE dbo.surtido ADD pedido_id NVARCHAR(50) NULL;
END
GO

/* Un pedido se atiende con una sola orden de surtido. El filtro deja fuera los
   NULL: las altas manuales sin pedido asociado siguen siendo tantas como haga
   falta. */
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
     WHERE object_id = OBJECT_ID('dbo.surtido') AND name = 'UQ_surtido_pedido_id'
)
BEGIN
    CREATE UNIQUE INDEX UQ_surtido_pedido_id
        ON dbo.surtido (pedido_id)
     WHERE pedido_id IS NOT NULL;
END
GO

/* ---------------------------------------------------------------------------
   dbo.CrearSurtidoDesdePedido
   --------------------------------------------------------------------------- */

CREATE OR ALTER PROCEDURE dbo.CrearSurtidoDesdePedido
    @id        NVARCHAR(50),
    @pedido_id NVARCHAR(50),
    @pedido    NVARCHAR(30),      -- folio del pedido, se copia a surtido.pedido
    @cliente   NVARCHAR(200),
    @lineas    INT           = NULL,
    @operador  NVARCHAR(120) = NULL,
    @prioridad NVARCHAR(10)  = 'Media'
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @id IS NULL OR LTRIM(RTRIM(@id)) = ''
    BEGIN
        THROW 50001, 'El id del surtido es obligatorio.', 1;
    END

    IF @pedido_id IS NULL OR LTRIM(RTRIM(@pedido_id)) = ''
    BEGIN
        THROW 50001, 'El id del pedido es obligatorio.', 1;
    END

    IF @pedido IS NULL OR LTRIM(RTRIM(@pedido)) = ''
    BEGIN
        THROW 50030, 'El folio del pedido es obligatorio.', 1;
    END

    IF @cliente IS NULL OR LTRIM(RTRIM(@cliente)) = ''
    BEGIN
        THROW 50031, 'El cliente es obligatorio.', 1;
    END

    IF @lineas IS NOT NULL AND @lineas < 0
    BEGIN
        THROW 50032, 'Las líneas no pueden ser negativas.', 1;
    END

    SET @prioridad = COALESCE(NULLIF(LTRIM(RTRIM(@prioridad)), ''), 'Media');

    IF @prioridad NOT IN ('Alta','Media','Baja')
    BEGIN
        THROW 50034, 'Prioridad de surtido inválida. Valores permitidos: Alta, Media, Baja.', 1;
    END

    /* Reintento idempotente: si el id ya existe, se devuelve tal cual está y no
       se toca nada. Es lo que hace que reenviar el formulario tras una
       respuesta perdida no abra un segundo surtido. */
    IF EXISTS (SELECT 1 FROM dbo.surtido WHERE id = @id)
    BEGIN
        SELECT id, pedido, pedido_id, cliente, lineas, operador, prioridad, estado
          FROM dbo.surtido
         WHERE id = @id;
        RETURN;
    END

    DECLARE @estadoPedido NVARCHAR(20);

    SELECT @estadoPedido = estado
      FROM dbo.pedido
     WHERE id = @pedido_id;

    IF @estadoPedido IS NULL
    BEGIN
        THROW 50020, 'No existe un pedido con ese id.', 1;
    END

    IF @estadoPedido <> 'pendiente'
    BEGIN
        THROW 50036, 'El pedido ya no está pendiente: solo un pedido pendiente puede asignarse a surtido.', 1;
    END

    BEGIN TRANSACTION;

        INSERT INTO dbo.surtido
            (id, pedido, pedido_id, cliente, lineas, operador, prioridad, estado,
             created_at, updated_at)
        VALUES
            (@id, @pedido, @pedido_id, @cliente, @lineas, @operador, @prioridad, 'pendiente',
             SYSUTCDATETIME(), NULL);

        UPDATE dbo.pedido
           SET estado     = 'asignado',
               updated_at = SYSUTCDATETIME()
         WHERE id = @pedido_id;

    COMMIT TRANSACTION;

    SELECT id, pedido, pedido_id, cliente, lineas, operador, prioridad, estado
      FROM dbo.surtido
     WHERE id = @id;
END
GO

/* ---------------------------------------------------------------------------
   dbo.ActualizarEstadoPedido
   --------------------------------------------------------------------------- */
/* Para mover el estado de un pedido fuera del flujo de surtido. El único uso
   en la app es cancelar: 'asignado' lo pone CrearSurtidoDesdePedido dentro de
   su transacción, y 'completado' lo cierra la operación. */

CREATE OR ALTER PROCEDURE dbo.ActualizarEstadoPedido
    @id     NVARCHAR(50),
    @estado NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    IF @id IS NULL OR LTRIM(RTRIM(@id)) = ''
    BEGIN
        THROW 50001, 'El id del pedido es obligatorio.', 1;
    END

    IF @estado IS NULL OR @estado NOT IN ('pendiente','asignado','completado','cancelado')
    BEGIN
        THROW 50010, 'Estado de pedido inválido. Valores permitidos: pendiente, asignado, completado, cancelado.', 1;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.pedido WHERE id = @id)
    BEGIN
        THROW 50020, 'No existe un pedido con ese id.', 1;
    END

    UPDATE dbo.pedido
       SET estado     = @estado,
           updated_at = SYSUTCDATETIME()
     WHERE id = @id;

    SELECT id, folio, cliente, fecha_pedido, fecha_requerida, direccion_entrega,
           estado, notas, created_at, updated_at
      FROM dbo.pedido
     WHERE id = @id;
END
GO

/* Pruebas:
   EXEC dbo.CrearSurtidoDesdePedido
        @id = '00000000-0000-0000-0000-000000000001',
        @pedido_id = 'ped-3', @pedido = 'PD-90121', @cliente = 'Walmart',
        @lineas = 3, @operador = 'Ana Ruiz', @prioridad = 'Alta';

   EXEC dbo.ActualizarEstadoPedido @id = 'ped-4', @estado = 'cancelado';
*/
