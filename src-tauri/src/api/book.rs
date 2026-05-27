use tauri::State;

use crate::{
    database::DatabaseState,
    entities::{BookRecord, ResolvedBookFile, UpsertBookRequest},
    repository::books,
};

#[tauri::command]
pub async fn list_books(database: State<'_, DatabaseState>) -> Result<Vec<BookRecord>, String> {
    books::list_books(&database.pool).await
}

#[tauri::command]
pub async fn get_book_by_key(
    database: State<'_, DatabaseState>,
    book_key: String,
) -> Result<Option<BookRecord>, String> {
    books::get_book_by_key(&database.pool, &book_key).await
}

#[tauri::command]
pub async fn upsert_book(
    database: State<'_, DatabaseState>,
    request: UpsertBookRequest,
) -> Result<BookRecord, String> {
    books::upsert_book(&database.pool, request).await
}

#[tauri::command]
pub async fn update_book_progress(
    database: State<'_, DatabaseState>,
    book_key: String,
    progress: f64,
) -> Result<BookRecord, String> {
    books::update_book_progress(&database.pool, &book_key, progress).await
}

#[tauri::command]
pub async fn remove_book_by_key(
    database: State<'_, DatabaseState>,
    book_key: String,
) -> Result<(), String> {
    books::remove_book_by_key(&database.pool, &book_key).await
}

#[tauri::command]
pub async fn resolve_book_file(
    database: State<'_, DatabaseState>,
    book_key: String,
) -> Result<Option<ResolvedBookFile>, String> {
    books::resolve_book_file(&database.pool, &book_key).await
}
