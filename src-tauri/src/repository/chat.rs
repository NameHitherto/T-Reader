use sqlx::SqlitePool;
use uuid::Uuid;

use crate::{entities::BookChatMessageDto, repository::books};

const SELECT_COLUMNS: &str = "id, role, content, provider_type, model_id, created_at";

pub async fn list_book_chat_messages(
    pool: &SqlitePool,
    book_key: &str,
) -> Result<Vec<BookChatMessageDto>, String> {
    let book = books::get_book_by_key(pool, book_key)
        .await?
        .ok_or_else(|| format!("book not found for key {}", book_key))?;

    sqlx::query_as::<_, BookChatMessageDto>(&format!(
        r#"
        SELECT chat.id, chat.role, chat.content, chat.provider_type, chat.model_id, chat.created_at
        FROM book_chat_messages chat
        WHERE chat.book_id = ?
        ORDER BY chat.created_at ASC, chat.id ASC
        "#,
    ))
    .bind(book.id)
    .fetch_all(pool)
    .await
    .map_err(|error| error.to_string())
}

pub async fn insert_book_chat_message(
    pool: &SqlitePool,
    book_key: &str,
    role: &str,
    content: &str,
    provider_type: &str,
    model_id: &str,
) -> Result<BookChatMessageDto, String> {
    let book = books::get_book_by_key(pool, book_key)
        .await?
        .ok_or_else(|| format!("book not found for key {}", book_key))?;

    sqlx::query_as::<_, BookChatMessageDto>(&format!(
        r#"
        INSERT INTO book_chat_messages (
            id, book_id, role, content, provider_type, model_id
        )
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING {SELECT_COLUMNS}
        "#,
    ))
    .bind(Uuid::new_v4().to_string())
    .bind(book.id)
    .bind(role)
    .bind(content)
    .bind(provider_type)
    .bind(model_id)
    .fetch_one(pool)
    .await
    .map_err(|error| error.to_string())
}

pub async fn clear_book_chat_messages(
    pool: &SqlitePool,
    book_key: &str,
) -> Result<(), String> {
    let Some(book) = books::get_book_by_key(pool, book_key).await? else {
        return Ok(());
    };

    sqlx::query("DELETE FROM book_chat_messages WHERE book_id = ?")
        .bind(book.id)
        .execute(pool)
        .await
        .map(|_| ())
        .map_err(|error| error.to_string())
}
