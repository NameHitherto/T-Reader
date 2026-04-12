use std::{
    fs::{self, File},
    io::{Read, Write},
    path::{Path, PathBuf},
};

use crate::utils::logging::log_info;

pub fn ensure_dir(dir_path: &Path) -> Result<(), String> {
    if !dir_path.exists() {
        fs::create_dir_all(dir_path).map_err(|error| error.to_string())?;
    }

    Ok(())
}

pub fn write_text_file(file_path: &Path, contents: &str) -> Result<(), String> {
    if let Some(parent) = file_path.parent() {
        ensure_dir(parent)?;
    }

    let mut file = File::create(file_path).map_err(|error| error.to_string())?;
    file.write_all(contents.as_bytes())
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn read_text_file(file_path: &Path) -> Result<String, String> {
    let mut file = File::open(file_path).map_err(|error| error.to_string())?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)
        .map_err(|error| error.to_string())?;
    Ok(contents)
}

pub fn read_binary_file(file_path: &Path) -> Result<Vec<u8>, String> {
    let mut file = File::open(file_path).map_err(|error| error.to_string())?;
    let mut contents = Vec::new();
    file.read_to_end(&mut contents)
        .map_err(|error| error.to_string())?;
    Ok(contents)
}

pub fn write_binary_file(file_path: &Path, contents: &[u8]) -> Result<(), String> {
    if let Some(parent) = file_path.parent() {
        ensure_dir(parent)?;
    }

    let mut file = File::create(file_path).map_err(|error| error.to_string())?;
    file.write_all(contents).map_err(|error| error.to_string())?;
    Ok(())
}

pub fn copy_file(source_path: &Path, target_path: &Path) -> Result<u64, String> {
    if let Some(parent) = target_path.parent() {
        ensure_dir(parent)?;
    }

    fs::copy(source_path, target_path).map_err(|error| error.to_string())
}

pub fn delete_file(file_path: &Path) -> Result<(), String> {
    if file_path.exists() {
        fs::remove_file(file_path).map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub fn list_files(dir_path: &Path) -> Result<Vec<String>, String> {
    ensure_dir(dir_path)?;

    let mut filenames = Vec::new();
    for entry in fs::read_dir(dir_path).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let entry_path = entry.path();
        if let Some(file_name) = entry_path.file_name().and_then(|value| value.to_str()) {
            filenames.push(file_name.to_string());
        }
    }
    Ok(filenames)
}

pub fn log_file_copy(scope: &str, source_path: &Path, target_path: &Path, bytes: u64) {
    log_info(
        scope,
        &format!(
            "copy-file source={} target={} bytes={}",
            source_path.display(),
            target_path.display(),
            bytes
        ),
    );
}

pub fn log_text_write(scope: &str, file_path: &Path, bytes: usize) {
    log_info(
        scope,
        &format!("save-file path={} bytes={}", file_path.display(), bytes),
    );
}

pub fn log_binary_read(scope: &str, file_path: &Path, bytes: usize) {
    log_info(
        scope,
        &format!("read-file path={} bytes={}", file_path.display(), bytes),
    );
}

pub fn log_binary_write(scope: &str, file_path: &Path, bytes: usize) {
    log_info(
        scope,
        &format!("write-file path={} bytes={}", file_path.display(), bytes),
    );
}

pub fn join_subdir(root_path: &Path, subdir: &str) -> PathBuf {
    root_path.join(subdir)
}
