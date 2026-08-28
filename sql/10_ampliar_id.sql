/* ===========================================================================
   10_ampliar_id.sql
   Amplía `id` a NVARCHAR(50) en las tablas donde la columna quedó más corta
   que el GUID de 36 caracteres que generan los SP de alta.

   POR QUÉ
   -------
   Ver 09_diagnostico_columnas.sql: con `id` corto (las filas históricas traen
   'emb-1', 'rec-2', …) el INSERT de los SP de alta trunca, SQL levanta el
   error 8152 y Fabric lo devuelve como
   "The data in the request exceeds the limits in data source." (BadRequest).

   NVARCHAR(50) es la medida que ya declaran todos los SP para `@id` y la que
   asume `types/cedis.ts` (`id: string`).

   El DEFAULT que cuelga de la columna (el que provoca "Msg 5074 ... is
   dependent on column 'id'") se quita antes del ALTER y se recrea igual, con
   el mismo nombre y la misma definición, después.

   Idempotente: si la columna ya alcanza, no toca nada. No convierte tablas con
   `id` UNIQUEIDENTIFIER o INT IDENTITY —esas necesitan otra decisión, y el
   script lo dice en la salida en vez de adivinar.

   Corre primero 09_diagnostico_columnas.sql y revisa el resultado.
   Después de correr este script: Fabric > API for GraphQL > Manage data >
   refrescar el esquema.
   =========================================================================== */

SET NOCOUNT ON;
GO

DECLARE @tablas TABLE (nombre SYSNAME);
INSERT INTO @tablas (nombre)
VALUES ('embarques'), ('recepciones'), ('surtido'),
       ('etiquetado'), ('incidencias'), ('productividad');

DECLARE @tabla   SYSNAME,
        @tipo    SYSNAME,
        @largo   INT,
        @nulos   BIT,
        @pk      SYSNAME,
        @colsPk  INT,
        @indices INT,
        @checks  INT,
        @df      SYSNAME,
        @dfDef   NVARCHAR(MAX),
        @sql     NVARCHAR(MAX);

WHILE EXISTS (SELECT 1 FROM @tablas)
BEGIN
    SELECT TOP (1) @tabla = nombre FROM @tablas ORDER BY nombre;
    DELETE FROM @tablas WHERE nombre = @tabla;

    SET @tipo = NULL; SET @largo = NULL; SET @nulos = NULL;
    SET @df = NULL; SET @dfDef = NULL;

    SELECT @tipo  = t.name,
           @nulos = c.is_nullable,
           @largo = CASE
                       WHEN c.max_length = -1              THEN 2147483647
                       WHEN t.name IN ('nchar','nvarchar') THEN c.max_length / 2
                       ELSE c.max_length
                    END
      FROM sys.columns c
      JOIN sys.types   t ON t.user_type_id = c.user_type_id
     WHERE c.object_id = OBJECT_ID('dbo.' + @tabla)
       AND c.name = 'id';

    IF @tipo IS NULL
    BEGIN
        PRINT 'omitida: dbo.' + @tabla + ' no existe o no tiene columna id.';
        CONTINUE;
    END

    IF @tipo NOT IN ('char','varchar','nchar','nvarchar')
    BEGIN
        PRINT 'revisar a mano: dbo.' + @tabla + '.id es ' + @tipo
            + ' — los SP de alta escriben texto de 36 caracteres.';
        CONTINUE;
    END

    IF @largo >= 36
    BEGIN
        PRINT 'ok: dbo.' + @tabla + '.id ya acepta ' + CAST(@largo AS VARCHAR(11)) + ' caracteres.';
        CONTINUE;
    END

    -- Índices sobre `id` que no sean la PK: hay que quitarlos antes del ALTER
    -- y no los recrea este script, así que mejor detenerse y avisar.
    SELECT @indices = COUNT(*)
      FROM sys.index_columns ic
      JOIN sys.indexes i ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
     WHERE ic.object_id = OBJECT_ID('dbo.' + @tabla)
       AND c.name = 'id'
       AND i.is_primary_key = 0;

    IF @indices > 0
    BEGIN
        PRINT 'revisar a mano: dbo.' + @tabla + '.id tiene índices además de la PK.';
        CONTINUE;
    END

    -- PK de la tabla: solo se puede recrear tal cual si es exactamente (id).
    SET @pk = NULL; SET @colsPk = NULL;

    SELECT @pk     = kc.name,
           @colsPk = (SELECT COUNT(*) FROM sys.index_columns ic
                       WHERE ic.object_id = kc.parent_object_id
                         AND ic.index_id  = kc.unique_index_id)
      FROM sys.key_constraints kc
     WHERE kc.parent_object_id = OBJECT_ID('dbo.' + @tabla)
       AND kc.type = 'PK';

    IF @pk IS NOT NULL AND @colsPk <> 1
    BEGIN
        PRINT 'revisar a mano: la PK de dbo.' + @tabla + ' es compuesta.';
        CONTINUE;
    END

    -- CHECK sobre `id`: también bloquean el ALTER (Msg 5074) y recrearlos a
    -- ciegas es riesgoso, así que se avisa y se deja la tabla como está.
    SELECT @checks = COUNT(*)
      FROM sys.check_constraints cc
      JOIN sys.columns c ON c.object_id = cc.parent_object_id
                        AND c.column_id = cc.parent_column_id
     WHERE cc.parent_object_id = OBJECT_ID('dbo.' + @tabla)
       AND c.name = 'id';

    IF @checks > 0
    BEGIN
        PRINT 'revisar a mano: dbo.' + @tabla + '.id tiene restricciones CHECK.';
        CONTINUE;
    END

    -- DEFAULT sobre `id` (Msg 5074: "The object 'DF__embarques__id__…' is
    -- dependent on column 'id'"). Se guarda nombre y definición para volver a
    -- crearlo idéntico después del ALTER.
    SELECT @df    = dc.name,
           @dfDef = dc.definition
      FROM sys.default_constraints dc
      JOIN sys.columns c ON c.object_id = dc.parent_object_id
                        AND c.column_id = dc.parent_column_id
     WHERE dc.parent_object_id = OBJECT_ID('dbo.' + @tabla)
       AND c.name = 'id';

    IF @df IS NOT NULL
    BEGIN
        SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@tabla) + N' DROP CONSTRAINT ' + QUOTENAME(@df) + N';';
        EXEC sys.sp_executesql @sql;
    END

    IF @pk IS NOT NULL
    BEGIN
        SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@tabla) + N' DROP CONSTRAINT ' + QUOTENAME(@pk) + N';';
        EXEC sys.sp_executesql @sql;
    END

    SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@tabla) + N' ALTER COLUMN id NVARCHAR(50) '
             + CASE WHEN @nulos = 1 THEN N'NULL' ELSE N'NOT NULL' END + N';';
    EXEC sys.sp_executesql @sql;

    IF @pk IS NOT NULL
    BEGIN
        SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@tabla) + N' ADD CONSTRAINT ' + QUOTENAME(@pk)
                 + N' PRIMARY KEY (id);';
        EXEC sys.sp_executesql @sql;
    END

    -- `dc.definition` ya viene entre paréntesis: '(newid())', '('')', …
    IF @df IS NOT NULL
    BEGIN
        SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@tabla) + N' ADD CONSTRAINT ' + QUOTENAME(@df)
                 + N' DEFAULT ' + @dfDef + N' FOR id;';
        EXEC sys.sp_executesql @sql;
        PRINT '  DEFAULT recreado en dbo.' + @tabla + '.id: ' + @dfDef;
    END

    PRINT 'ampliada: dbo.' + @tabla + '.id de ' + @tipo + '(' + CAST(@largo AS VARCHAR(11))
        + ') a NVARCHAR(50).';
END
GO

/* Verificación: no debe devolver filas.
   SELECT OBJECT_NAME(c.object_id), c.max_length
     FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
    WHERE c.name = 'id' AND t.name IN ('nchar','nvarchar')
      AND c.max_length / 2 < 36
      AND c.object_id IN (OBJECT_ID('dbo.embarques'), OBJECT_ID('dbo.recepciones'),
                          OBJECT_ID('dbo.surtido'),   OBJECT_ID('dbo.etiquetado'),
                          OBJECT_ID('dbo.incidencias'), OBJECT_ID('dbo.productividad'));
*/
