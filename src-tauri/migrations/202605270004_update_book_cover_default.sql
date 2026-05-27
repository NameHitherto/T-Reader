UPDATE books
SET has_cover = 1
WHERE cover_name IS NOT NULL;

PRAGMA writable_schema = ON;

UPDATE sqlite_schema
SET sql = replace(
    sql,
    'has_cover INTEGER NOT NULL DEFAULT 0',
    'has_cover INTEGER NOT NULL DEFAULT 1'
)
WHERE type = 'table'
  AND name = 'books'
  AND sql LIKE '%has_cover INTEGER NOT NULL DEFAULT 0%';

PRAGMA writable_schema = OFF;
