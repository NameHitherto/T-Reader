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
