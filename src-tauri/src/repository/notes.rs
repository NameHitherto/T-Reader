use sqlx::{Sqlite, SqlitePool, Transaction};

use crate::{entities::BookMarkDto, repository::books};

pub async fn load_all_notes(pool: &SqlitePool) -> Result<Vec<BookMarkDto>, String> {
    sqlx::query_as::<_, BookMarkDto>(
        r#"
        SELECT notes.id, notes.content, books.book_key AS book_name,
               notes.book_title, notes.book_cfi, notes.create_time,
               notes.comments, notes.color
        FROM notes
        INNER JOIN books ON books.id = notes.book_id
        ORDER BY notes.create_time DESC
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(|error| error.to_string())
}

pub async fn load_notes_by_book_key(
    pool: &SqlitePool,
    book_key: &str,
) -> Result<Vec<BookMarkDto>, String> {
    sqlx::query_as::<_, BookMarkDto>(
        r#"
        SELECT notes.id, notes.content, books.book_key AS book_name,
               notes.book_title, notes.book_cfi, notes.create_time,
               notes.comments, notes.color
        FROM notes
        INNER JOIN books ON books.id = notes.book_id
        WHERE books.book_key = ?
        ORDER BY notes.create_time DESC
        "#,
    )
    .bind(book_key)
    .fetch_all(pool)
    .await
    .map_err(|error| error.to_string())
}

async fn insert_note(
    tx: &mut Transaction<'_, Sqlite>,
    book_id: &str,
    note: &BookMarkDto,
) -> Result<(), String> {
    sqlx::query(
        r#"
        INSERT INTO notes (
            id, book_id, content, book_title, book_cfi, comments,
            color, create_time, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
            book_id = excluded.book_id,
            content = excluded.content,
            book_title = excluded.book_title,
            book_cfi = excluded.book_cfi,
            comments = excluded.comments,
            color = excluded.color,
            create_time = excluded.create_time,
            updated_at = datetime('now')
        "#,
    )
    .bind(&note.id)
    .bind(book_id)
    .bind(&note.content)
    .bind(&note.book_title)
    .bind(&note.book_cfi)
    .bind(&note.comments)
    .bind(&note.color)
    .bind(&note.create_time)
    .execute(&mut **tx)
    .await
    .map(|_| ())
    .map_err(|error| error.to_string())
}

pub async fn replace_notes_for_book(
    pool: &SqlitePool,
    book_key: &str,
    notes: Vec<BookMarkDto>,
) -> Result<(), String> {
    let Some(book) = books::get_book_by_key(pool, book_key).await? else {
        if notes.is_empty() {
            return Ok(());
        }
        return Err(format!("book not found for key {}", book_key));
    };

    let mut tx = pool.begin().await.map_err(|error| error.to_string())?;
    sqlx::query("DELETE FROM notes WHERE book_id = ?")
        .bind(&book.id)
        .execute(&mut *tx)
        .await
        .map_err(|error| error.to_string())?;

    for note in notes {
        insert_note(&mut tx, &book.id, &note).await?;
    }

    tx.commit().await.map_err(|error| error.to_string())
}

pub async fn save_all_notes(pool: &SqlitePool, notes: Vec<BookMarkDto>) -> Result<(), String> {
    let books_by_key = books::list_books(pool)
        .await?
        .into_iter()
        .map(|book| (book.book_key, book.id))
        .collect::<std::collections::HashMap<_, _>>();
    let mut tx = pool.begin().await.map_err(|error| error.to_string())?;
    sqlx::query("DELETE FROM notes")
        .execute(&mut *tx)
        .await
        .map_err(|error| error.to_string())?;

    for note in notes {
        let Some(book_id) = books_by_key.get(&note.book_name) else {
            return Err(format!("book not found for key {}", note.book_name));
        };
        insert_note(&mut tx, book_id, &note).await?;
    }

    tx.commit().await.map_err(|error| error.to_string())
}

pub async fn remove_notes_by_book_key(pool: &SqlitePool, book_key: &str) -> Result<(), String> {
    let Some(book) = books::get_book_by_key(pool, book_key).await? else {
        return Ok(());
    };

    sqlx::query("DELETE FROM notes WHERE book_id = ?")
        .bind(book.id)
        .execute(pool)
        .await
        .map(|_| ())
        .map_err(|error| error.to_string())
}
