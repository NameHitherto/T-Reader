ALTER TABLE reader_style_settings ADD COLUMN epub_built_in_stylesheet_mode TEXT NOT NULL DEFAULT 'filtered';

UPDATE reader_style_settings
SET epub_built_in_stylesheet_mode = CASE
  WHEN load_epub_built_in_stylesheet = 1 THEN 'preserved'
  ELSE 'removed'
END
WHERE load_epub_built_in_stylesheet IS NOT NULL;
