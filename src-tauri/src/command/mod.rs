pub mod file;
pub mod web;

pub use file::{
    save_file,
    load_books,
    delete_book,
    read_file_by_path,
    save_settings,
    load_settings
};

pub use web::{
    webdav_upload,
    webdav_get,
    webdav_delete,
    webdav_sync_files,
    start_stream
};