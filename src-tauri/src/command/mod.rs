pub mod file;
pub mod web;
pub mod font;
pub mod proxy;
pub mod dir;

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
    start_stream,
    webdav_upload_progress,
    webdav_get_progress
};

pub use font::{
    get_system_fonts
};

pub use proxy::{
    prepare_updater_proxy
};

pub use dir::{
    check_local_dirs_command,
    check_cloud_dirs_command,
    get_local_dir_names_command,
    get_cloud_dir_names_command,
};