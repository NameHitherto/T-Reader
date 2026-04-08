use std::path::PathBuf;

use crate::{
    repository::local_fs::{
        dir_repository::{ensure_local_dirs, get_local_root_dir},
        file_repository::{
            delete_file, join_subdir, list_files, log_binary_read, log_binary_write,
            log_text_write, read_binary_file, read_file_by_path, write_binary_file,
            write_text_file,
        },
    },
    utils::logging::log_info,
};

fn resolve_subdir_path(subdir: &str) -> Result<PathBuf, String> {
    Ok(join_subdir(&ensure_local_dirs()?, subdir))
}

pub fn save_text_file_to_subdir(subdir: &str, filename: &str, contents: &str) -> Result<(), String> {
    let dir_path = resolve_subdir_path(subdir)?;
    let file_path = dir_path.join(filename);
    write_text_file(&file_path, contents)?;
    log_text_write("file", &file_path, contents.len());
    Ok(())
}

pub fn read_binary_file_from_subdir(subdir: &str, filename: &str) -> Result<Vec<u8>, String> {
    let dir_path = resolve_subdir_path(subdir)?;
    let file_path = dir_path.join(filename);
    let contents = read_binary_file(&file_path)?;
    log_binary_read("file", &file_path, contents.len());
    Ok(contents)
}

pub fn write_binary_file_to_subdir(
    subdir: &str,
    filename: &str,
    contents: &[u8],
) -> Result<(), String> {
    let dir_path = resolve_subdir_path(subdir)?;
    let file_path = dir_path.join(filename);
    write_binary_file(&file_path, contents)?;
    log_binary_write("file", &file_path, contents.len());
    Ok(())
}

pub fn delete_file_from_subdir(subdir: &str, filename: &str) -> Result<(), String> {
    ensure_local_dirs()?;
    let file_path = get_local_root_dir()?.join(subdir).join(filename);
    delete_file(&file_path)?;
    log_info("file", &format!("delete-book path={}", file_path.display()));
    Ok(())
}

pub fn list_files_in_subdir(subdir: &str) -> Result<Vec<String>, String> {
    let dir_path = resolve_subdir_path(subdir)?;
    let filenames = list_files(&dir_path)?;
    log_info(
        "file",
        &format!("list-files subdir={} total={}", subdir, filenames.len()),
    );
    Ok(filenames)
}

pub fn read_file_from_path(filepath: &str) -> Result<Vec<u8>, String> {
    let contents = read_file_by_path(filepath)?;
    log_info(
        "file",
        &format!("read-file-by-path path={} bytes={}", filepath, contents.len()),
    );
    Ok(contents)
}
