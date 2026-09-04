CREATE TABLE IF NOT EXISTS local_fonts (
    filename TEXT NOT NULL COLLATE NOCASE,
    face_index INTEGER NOT NULL,
    metadata TEXT NOT NULL,
    PRIMARY KEY (filename, face_index)
);
