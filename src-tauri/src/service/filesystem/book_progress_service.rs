use crate::{
    entities::StoredBook,
    repository::local_fs::{book_progress_repository::load_books, dir_repository::ensure_local_dirs},
    utils::logging::log_info,
};

pub fn load_book_progresses(subdir: &str) -> Result<Vec<StoredBook>, String> {
    let dir_path = ensure_local_dirs()?.join(subdir);
    let books = load_books(&dir_path)?;
    log_info(
        "file",
        &format!("load-books subdir={} total={}", subdir, books.len()),
    );
    Ok(books)
}
