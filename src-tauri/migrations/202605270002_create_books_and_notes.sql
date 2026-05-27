CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    book_key TEXT NOT NULL UNIQUE,
    file_name TEXT NOT NULL UNIQUE,
    format TEXT NOT NULL DEFAULT 'epub',
    cache_name TEXT NOT NULL,
    has_cover INTEGER NOT NULL DEFAULT 0,
    cover_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_books_book_key ON books(book_key);
CREATE INDEX IF NOT EXISTS idx_books_file_name ON books(file_name);

CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY NOT NULL,
    book_id TEXT NOT NULL,
    content TEXT NOT NULL,
    book_title TEXT NOT NULL,
    book_cfi TEXT NOT NULL,
    comments TEXT,
    color TEXT,
    has_border INTEGER,
    create_time TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notes_book_id ON notes(book_id);
CREATE INDEX IF NOT EXISTS idx_notes_create_time ON notes(create_time);
