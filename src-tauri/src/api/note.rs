use tauri::State;

use crate::{database::DatabaseState, entities::BookMarkDto, repository::notes};

#[tauri::command]
pub async fn load_all_notes(
    database: State<'_, DatabaseState>,
) -> Result<Vec<BookMarkDto>, String> {
    notes::load_all_notes(&database.pool).await
}

#[tauri::command]
pub async fn load_notes_by_book_key(
    database: State<'_, DatabaseState>,
    book_key: String,
) -> Result<Vec<BookMarkDto>, String> {
    notes::load_notes_by_book_key(&database.pool, &book_key).await
}

#[tauri::command]
pub async fn replace_notes_for_book(
    database: State<'_, DatabaseState>,
    book_key: String,
    notes: Vec<BookMarkDto>,
) -> Result<(), String> {
    notes::replace_notes_for_book(&database.pool, &book_key, notes).await
}

#[tauri::command]
pub async fn save_all_notes(
    database: State<'_, DatabaseState>,
    notes: Vec<BookMarkDto>,
) -> Result<(), String> {
    notes::save_all_notes(&database.pool, notes).await
}

#[tauri::command]
pub async fn remove_notes_by_book_key(
    database: State<'_, DatabaseState>,
    book_key: String,
) -> Result<(), String> {
    notes::remove_notes_by_book_key(&database.pool, &book_key).await
}
