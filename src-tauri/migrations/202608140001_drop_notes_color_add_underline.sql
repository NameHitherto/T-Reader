ALTER TABLE notes DROP COLUMN color;
ALTER TABLE notes ADD COLUMN underline_color TEXT;
ALTER TABLE notes ADD COLUMN underline_type TEXT;
ALTER TABLE notes ADD COLUMN underline_width REAL;
