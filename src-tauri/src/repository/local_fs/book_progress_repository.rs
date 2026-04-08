use std::path::Path;

use crate::{
    entities::{Book, StoredBook},
    repository::local_fs::file_repository::{ensure_dir, read_text_file},
    utils::json::from_json_str,
};

pub fn load_books(dir_path: &Path) -> Result<Vec<StoredBook>, String> {
    ensure_dir(dir_path)?;

    let mut books = Vec::new();
    for entry in std::fs::read_dir(dir_path).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let entry_path = entry.path();
        if entry_path.extension().and_then(|s| s.to_str()) == Some("json") {
            let contents = read_text_file(&entry_path)?;
            match from_json_str::<Book>(&contents) {
                Ok(book) => {
                    if let Some(filename) = entry_path.file_name().and_then(|value| value.to_str())
                    {
                        books.push(StoredBook {
                            filename: filename.to_string(),
                            book,
                        });
                    }
                }
                Err(_) => continue,
            }
        }
    }

    Ok(books)
}
