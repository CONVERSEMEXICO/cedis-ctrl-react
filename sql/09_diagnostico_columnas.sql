/* ===========================================================================
   09_diagnostico_columnas.sql
   Diagnóstico: tamaños reales de las columnas contra lo que escriben los SP
   de alta (08_sp_altas.sql, 05_sp_incidencias.sql, 06_sp_productividad.sql).

   POR QUÉ EXISTE ESTE ARCHIVO
   ---------------------------
   Cuando un INSERT no cabe en su columna, SQL levanta el error 8152/2628
   ("String or binary data would be truncated") y la API for GraphQL de Fabric
   lo devuelve envuelto así:

       { "errors": [{ "message": "The data in the request exceeds the limits
         in data source.", "path": ["executeCrearEmbarque"],
         "extensions": { "code": "BadRequest" } }], "data": null }

   Es decir: el mensaje habla de "la petición", pero el que no cabe puede ser
   un valor que genera el propio SP. El sospechoso número uno es `id`: los SP
   de alta generan `CONVERT(NVARCHAR(36), NEWID())` —36 caracteres— mientras
   que las filas existentes traen ids cortos del estilo 'emb-1'. Si la tabla se
   creó con la medida de esos ids, ninguna alta cabe.

   Este script no modifica nada: solo reporta. El arreglo va en
   10_ampliar_id.sql.
   =========================================================================== */

SET NOCOUNT ON;
GO

/* ---------------------------------------------------------------------------
   1. Tipo y longitud de cada columna de las seis tablas
   `caracteres` = -1 significa MAX.
   --------------------------------------------------------------------------- */

SELECT
    tabla       = OBJECT_NAME(c.object_id),
    columna     = c.name,
    tipo        = t.name,
    caracteres  = CASE
                     WHEN c.max_length = -1                  THEN -1
                     WHEN t.name IN ('nchar','nvarchar')     THEN c.max_length / 2
                     WHEN t.name IN ('char','varchar')       THEN c.max_length
                     ELSE NULL
                  END,
    acepta_null = c.is_nullable
  FROM sys.columns c
  JOIN sys.types   t ON t.user_type_id = c.user_type_id
 WHERE c.object_id IN (
           OBJECT_ID('dbo.embarques'),   OBJECT_ID('dbo.recepciones'),
           OBJECT_ID('dbo.surtido'),     OBJECT_ID('dbo.etiquetado'),
           OBJECT_ID('dbo.incidencias'), OBJECT_ID('dbo.productividad'))
 ORDER BY tabla, c.column_id;

/* ---------------------------------------------------------------------------
   2. Columnas `id` que no alcanzan para el GUID de 36 caracteres
   Si esta consulta devuelve filas, esa es la causa del BadRequest.
   --------------------------------------------------------------------------- */

SELECT
    tabla      = OBJECT_NAME(c.object_id),
    tipo       = t.name,
    caracteres = CASE WHEN t.name IN ('nchar','nvarchar') THEN c.max_length / 2 ELSE c.max_length END,
    necesita   = 36
  FROM sys.columns c
  JOIN sys.types   t ON t.user_type_id = c.user_type_id
 WHERE c.name = 'id'
   AND c.object_id IN (
           OBJECT_ID('dbo.embarques'),   OBJECT_ID('dbo.recepciones'),
           OBJECT_ID('dbo.surtido'),     OBJECT_ID('dbo.etiquetado'),
           OBJECT_ID('dbo.incidencias'), OBJECT_ID('dbo.productividad'))
   AND t.name IN ('char','varchar','nchar','nvarchar')
   AND c.max_length <> -1
   AND (CASE WHEN t.name IN ('nchar','nvarchar') THEN c.max_length / 2 ELSE c.max_length END) < 36;

/* ---------------------------------------------------------------------------
   3. Longitud máxima que ya guarda cada columna de texto que escriben las
   altas. Sirve para descartar al resto de los campos: si el máximo actual está
   lejos del tamaño declarado, esa columna no es la que revienta.
   --------------------------------------------------------------------------- */

SELECT 'embarques' AS tabla,
       MAX(LEN(id)) AS id, MAX(LEN(folio)) AS folio, MAX(LEN(destino)) AS destino,
       MAX(LEN(transportista)) AS transportista, MAX(LEN(hora_salida)) AS hora_salida,
       MAX(LEN(estado)) AS estado
  FROM dbo.embarques;
GO

/* ---------------------------------------------------------------------------
   4. Restricciones colgadas de `id`
   Un DEFAULT o un CHECK sobre la columna bloquea el ALTER COLUMN con
   "Msg 5074 ... is dependent on column 'id'". 10_ampliar_id.sql quita y
   recrea el DEFAULT solo; los CHECK los deja para revisión manual.
   --------------------------------------------------------------------------- */

SELECT tabla = OBJECT_NAME(dc.parent_object_id), tipo = 'DEFAULT',
       nombre = dc.name, definicion = dc.definition
  FROM sys.default_constraints dc
  JOIN sys.columns c ON c.object_id = dc.parent_object_id
                    AND c.column_id = dc.parent_column_id
 WHERE c.name = 'id'
UNION ALL
SELECT tabla = OBJECT_NAME(cc.parent_object_id), tipo = 'CHECK',
       nombre = cc.name, definicion = cc.definition
  FROM sys.check_constraints cc
  JOIN sys.columns c ON c.object_id = cc.parent_object_id
                    AND c.column_id = cc.parent_column_id
 WHERE c.name = 'id'
 ORDER BY tabla, tipo;
GO
