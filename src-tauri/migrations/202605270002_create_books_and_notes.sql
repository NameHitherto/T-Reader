CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    book_key TEXT NOT NULL UNIQUE,
    file_name TEXT NOT NULL UNIQUE,
    format TEXT NOT NULL DEFAULT 'epub',
    cache_name TEXT NOT NULL,
    has_cover INTEGER NOT NULL DEFAULT 1,
    cover_name TEXT,
    progress REAL NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    webdav_url_root TEXT NOT NULL DEFAULT '',
    webdav_url_folder TEXT NOT NULL DEFAULT '',
    webdav_url TEXT NOT NULL DEFAULT '',
    webdav_user TEXT NOT NULL DEFAULT '',
    webdav_pass TEXT NOT NULL DEFAULT '',
    theme_mode TEXT NOT NULL DEFAULT 'light',
    model_providers TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reader_style_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    font_size REAL NOT NULL DEFAULT 16,
    font_weight REAL NOT NULL DEFAULT 400,
    line_spacing REAL NOT NULL DEFAULT 1.3,
    paragraph_spacing REAL NOT NULL DEFAULT 0.2,
    letter_spacing REAL NOT NULL DEFAULT 0,
    box_padding_top REAL NOT NULL DEFAULT 20,
    box_padding_bottom REAL NOT NULL DEFAULT 20,
    box_padding_horizontal REAL NOT NULL DEFAULT 20,
    column_count REAL NOT NULL DEFAULT 2,
    indent REAL NOT NULL DEFAULT 2,
    font TEXT NOT NULL DEFAULT 'serif',
    color TEXT NOT NULL DEFAULT '#FFFFFF',
    font_color TEXT NOT NULL DEFAULT '#111827',
    background_presets TEXT NOT NULL DEFAULT '{"light":"default","dark":"default"}',
    flow TEXT NOT NULL DEFAULT 'paginated',
    enabled_system_fonts TEXT NOT NULL DEFAULT '[]',
    load_epub_built_in_stylesheet INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
