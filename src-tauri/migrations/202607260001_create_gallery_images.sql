CREATE TABLE IF NOT EXISTS gallery_images (
    id TEXT PRIMARY KEY NOT NULL,
    book_key TEXT,
    book_title TEXT NOT NULL DEFAULT '',
    prompt TEXT NOT NULL,
    provider_type TEXT NOT NULL DEFAULT '',
    model_id TEXT NOT NULL DEFAULT '',
    image_path TEXT NOT NULL,
    reference_paths TEXT NOT NULL DEFAULT '[]',
    image_size TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gallery_images_book_key ON gallery_images(book_key);
CREATE INDEX IF NOT EXISTS idx_gallery_images_created_at ON gallery_images(created_at);
