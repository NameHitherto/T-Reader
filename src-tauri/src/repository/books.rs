use sqlx::SqlitePool;
use uuid::Uuid;

use crate::{
    entities::{BookRecord, ResolvedBookFile, UpsertBookRequest},
    service::book_identity::{build_book_key, hash_book_key},
};

pub async fn list_books(pool: &SqlitePool) -> Result<Vec<BookRecord>, String> {
    sqlx::query_as::<_, BookRecord>(
        r#"
        SELECT id, title, author, book_key, file_name, format, cache_name,
               has_cover, cover_name, created_at, updated_at
        FROM books
        ORDER BY updated_at DESC, title ASC
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(|error| error.to_string())
}

pub async fn get_book_by_key(
    pool: &SqlitePool,
    book_key: &str,
) -> Result<Option<BookRecord>, String> {
    sqlx::query_as::<_, BookRecord>(
        r#"
        SELECT id, title, author, book_key, file_name, format, cache_name,
               has_cover, cover_name, created_at, updated_at
        FROM books
        WHERE book_key = ?
        "#,
    )
    .bind(book_key)
    .fetch_optional(pool)
    .await
    .map_err(|error| error.to_string())
}

pub async fn upsert_book(
    pool: &SqlitePool,
    request: UpsertBookRequest,
) -> Result<BookRecord, String> {
    let title = crate::service::book_identity::build_book_title(Some(&request.title));
    let author = crate::service::book_identity::build_book_title(Some(&request.author));
    let book_key = request
        .book_key
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| build_book_key(Some(&title), Some(&author)));
    let format = request.format.unwrap_or_else(|| "epub".to_string());
    let cache_name = request
        .cache_name
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| hash_book_key(&book_key));
    let has_cover = request.has_cover.unwrap_or(false);

    sqlx::query_as::<_, BookRecord>(
        r#"
        INSERT INTO books (
            id, title, author, book_key, file_name, format, cache_name,
            has_cover, cover_name, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(book_key) DO UPDATE SET
            title = excluded.title,
            author = excluded.author,
            file_name = excluded.file_name,
            format = excluded.format,
            cache_name = excluded.cache_name,
            has_cover = excluded.has_cover,
            cover_name = excluded.cover_name,
            updated_at = datetime('now')
        RETURNING id, title, author, book_key, file_name, format, cache_name,
                  has_cover, cover_name, created_at, updated_at
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(title)
    .bind(author)
    .bind(book_key)
    .bind(request.file_name.trim())
    .bind(format)
    .bind(cache_name)
    .bind(has_cover)
    .bind(request.cover_name)
    .fetch_one(pool)
    .await
    .map_err(|error| error.to_string())
}

pub async fn remove_book_by_key(pool: &SqlitePool, book_key: &str) -> Result<(), String> {
    sqlx::query("DELETE FROM books WHERE book_key = ?")
        .bind(book_key)
        .execute(pool)
        .await
        .map(|_| ())
        .map_err(|error| error.to_string())
}

pub async fn resolve_book_file(
    pool: &SqlitePool,
    book_key: &str,
) -> Result<Option<ResolvedBookFile>, String> {
    let record = get_book_by_key(pool, book_key).await?;

    Ok(record.map(|book| ResolvedBookFile {
        file_name: book.file_name,
        format: book.format,
    }))
}
