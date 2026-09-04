use std::{
    fs::{self, File, Metadata, OpenOptions},
    io::{ErrorKind, Read, Write},
    path::{Path, PathBuf},
};

use sha2::{Digest, Sha256};

use crate::{
    entities::{
        FontNameEntry,
        font::{LocalFontEntry, LocalFontWarning, LocalFontsResult},
    },
    repository::font_metadata::parse_font_data,
};

use super::dir_repository::{LOCAL_BOOKS_DIR, LOCAL_FONTS_DIR};

pub const MAX_FONT_BYTES: u64 = 64 * 1024 * 1024;

pub fn validate_filename(filename: &str) -> Result<(), String> {
    let stem = filename
        .split('.')
        .next()
        .unwrap_or_default()
        .trim_end()
        .to_uppercase();
    let reserved = matches!(
        stem.as_str(),
        "CON" | "PRN" | "AUX" | "NUL" | "CONIN$" | "CONOUT$"
    ) || ["COM", "LPT"].iter().any(|prefix| {
        stem.strip_prefix(prefix).is_some_and(|suffix| {
            matches!(
                suffix,
                "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "¹" | "²" | "³"
            )
        })
    });
    if filename.is_empty()
        || filename.encode_utf16().count() > 255
        || filename.ends_with(['.', ' '])
        || filename
            .chars()
            .any(|c| c.is_control() || "<>:\"/\\|?*".contains(c))
        || reserved
    {
        return Err("只接受合法的单个 Windows 文件名，不允许路径或设备名称".to_string());
    }
    Ok(())
}

pub fn font_extension(filename: &str) -> Option<String> {
    let extension = Path::new(filename)
        .extension()?
        .to_str()?
        .to_ascii_lowercase();
    matches!(
        extension.as_str(),
        "ttf" | "otf" | "ttc" | "otc" | "woff" | "woff2"
    )
    .then_some(extension)
}

fn is_link(metadata: &Metadata) -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::fs::MetadataExt;
        metadata.file_attributes() & 0x400 != 0 // FILE_ATTRIBUTE_REPARSE_POINT
    }
    #[cfg(not(target_os = "windows"))]
    {
        metadata.file_type().is_symlink()
    }
}

fn check_directory(path: &Path) -> Result<PathBuf, String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("读取目录失败 {}: {error}", path.display()))?;
    if is_link(&metadata) || !metadata.is_dir() {
        return Err(format!(
            "目录必须是真实目录，不能是链接: {}",
            path.display()
        ));
    }
    path.canonicalize()
        .map_err(|error| format!("解析目录失败: {error}"))
}

fn ensure_directory(path: &Path) -> Result<PathBuf, String> {
    match fs::symlink_metadata(path) {
        Err(error) if error.kind() == ErrorKind::NotFound => {
            fs::create_dir_all(path).map_err(|error| format!("创建目录失败: {error}"))?;
        }
        Err(error) => return Err(format!("读取目录失败: {error}")),
        Ok(_) => {}
    }
    check_directory(path)
}

pub fn prepare_fonts_dir(root: &Path) -> Result<PathBuf, String> {
    let root = ensure_directory(root)?;
    let directory = ensure_directory(&root.join(LOCAL_FONTS_DIR))?;
    check_child_directory(&root, directory)
}

pub fn books_dir(root: &Path) -> Result<PathBuf, String> {
    let root = check_directory(root)?;
    let directory = check_directory(&root.join(LOCAL_BOOKS_DIR))?;
    check_child_directory(&root, directory)
}

fn check_child_directory(root: &Path, directory: PathBuf) -> Result<PathBuf, String> {
    if directory.parent() != Some(root) {
        return Err("目录不在本地持久化根目录内".to_string());
    }
    Ok(directory)
}

/// Open the leaf itself on Windows so a substituted reparse point is never followed.
pub fn open_regular_file(directory: &Path, filename: &str) -> Result<File, String> {
    validate_filename(filename)?;
    let directory = check_directory(directory)?;
    let path = directory.join(filename);
    let metadata =
        fs::symlink_metadata(&path).map_err(|error| format!("读取文件失败 {filename}: {error}"))?;
    if is_link(&metadata) || !metadata.is_file() {
        return Err(format!("只允许普通文件，不能是链接或目录: {filename}"));
    }
    let canonical = path
        .canonicalize()
        .map_err(|error| format!("解析文件路径失败: {error}"))?;
    if canonical.parent() != Some(directory.as_path()) {
        return Err(format!("文件不在指定目录内: {filename}"));
    }
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::fs::OpenOptionsExt;
        options.custom_flags(0x0020_0000); // FILE_FLAG_OPEN_REPARSE_POINT
    }
    let file = options
        .open(path)
        .map_err(|error| format!("打开文件失败 {filename}: {error}"))?;
    let metadata = file
        .metadata()
        .map_err(|error| format!("读取文件属性失败: {error}"))?;
    if is_link(&metadata) || !metadata.is_file() {
        return Err(format!("只允许普通文件: {filename}"));
    }
    Ok(file)
}

pub fn read_font_file(directory: &Path, filename: &str) -> Result<Vec<u8>, String> {
    let file = open_regular_file(directory, filename)?;
    if file.metadata().map_err(|error| error.to_string())?.len() > MAX_FONT_BYTES {
        return Err("字体文件超过 64 MiB 限制".to_string());
    }
    let mut data = Vec::new();
    file.take(MAX_FONT_BYTES + 1)
        .read_to_end(&mut data)
        .map_err(|error| format!("读取字体失败: {error}"))?;
    if data.len() as u64 > MAX_FONT_BYTES {
        return Err("字体文件超过 64 MiB 限制".to_string());
    }
    Ok(data)
}

pub fn local_entries(
    directory: &Path,
    filename: &str,
    faces: Vec<FontNameEntry>,
) -> Vec<LocalFontEntry> {
    let path = directory.join(filename).to_string_lossy().into_owned();
    faces
        .into_iter()
        .map(|mut font| {
            font.path = Some(path.clone());
            LocalFontEntry {
                filename: filename.to_string(),
                font,
            }
        })
        .collect()
}

/// Publish a completed file with a no-clobber move on Windows.
/// Concurrent imports can share the winner; a conflicting existing file is never replaced.
pub fn store_font(
    directory: &Path,
    extension: &str,
    data: &[u8],
) -> Result<(String, bool), String> {
    let directory = check_directory(directory)?;
    let filename = format!("{:x}.{extension}", Sha256::digest(data));
    let destination = directory.join(&filename);
    match fs::symlink_metadata(&destination) {
        Ok(_) => return compare_existing(&directory, &filename, data),
        Err(error) if error.kind() == ErrorKind::NotFound => {}
        Err(error) => return Err(format!("检查已有字体失败: {error}")),
    }

    let mut temp_file = tempfile::Builder::new()
        .prefix(".font-")
        .suffix(".tmp")
        .tempfile_in(&directory)
        .map_err(|error| format!("创建字体临时文件失败: {error}"))?;
    temp_file
        .write_all(data)
        .and_then(|_| temp_file.as_file().sync_all())
        .map_err(|error| format!("写入字体失败: {error}"))?;
    match temp_file.persist_noclobber(&destination) {
        Ok(_) => Ok((filename, true)),
        Err(error) => {
            let publish_error = error.error;
            error
                .file
                .close()
                .map_err(|error| format!("清理字体临时文件失败: {error}"))?;
            if publish_error.kind() == ErrorKind::AlreadyExists {
                compare_existing(&directory, &filename, data)
            } else {
                Err(format!("发布字体文件失败: {publish_error}"))
            }
        }
    }
}

pub fn check_writable(directory: &Path) -> Result<(), String> {
    let directory = check_directory(directory)?;
    tempfile::Builder::new()
        .prefix(".font-")
        .suffix(".tmp")
        .tempfile_in(directory)
        .map_err(|error| format!("字体目录不可写: {error}"))?
        .close()
        .map_err(|error| format!("字体目录临时文件无法清理: {error}"))
}

fn compare_existing(
    directory: &Path,
    filename: &str,
    data: &[u8],
) -> Result<(String, bool), String> {
    if read_font_file(directory, filename)? != data {
        return Err(format!("已有同名文件内容不符，未覆盖: {filename}"));
    }
    Ok((filename.to_string(), false))
}

pub fn scan_fonts(directory: &Path) -> Result<LocalFontsResult, String> {
    let directory = check_directory(directory)?;
    let mut result = LocalFontsResult::default();
    for entry in fs::read_dir(&directory).map_err(|error| format!("读取字体目录失败: {error}"))?
    {
        let entry = match entry {
            Ok(entry) => entry,
            Err(error) => {
                result.warnings.push(LocalFontWarning {
                    filename: String::new(),
                    reason: error.to_string(),
                });
                continue;
            }
        };
        let filename = entry.file_name().to_string_lossy().into_owned();
        if font_extension(&filename).is_none() {
            continue;
        }
        let parsed = read_font_file(&directory, &filename)
            .and_then(|data| parse_font_data(&data).map(|(_, faces)| faces));
        match parsed {
            Ok(faces) => result
                .fonts
                .extend(local_entries(&directory, &filename, faces)),
            Err(reason) => result.warnings.push(LocalFontWarning { filename, reason }),
        }
    }
    result.fonts.sort_by(|a, b| {
        a.font
            .display_family
            .cmp(&b.font.display_family)
            .then_with(|| a.filename.cmp(&b.filename))
            .then_with(|| a.font.face_index.cmp(&b.font.face_index))
    });
    result.warnings.sort_by(|a, b| a.filename.cmp(&b.filename));
    Ok(result)
}

pub fn delete_font(directory: &Path, filename: &str) -> Result<bool, String> {
    validate_filename(filename)?;
    if font_extension(filename).is_none() {
        return Err("只允许删除字体文件".to_string());
    }
    let directory = check_directory(directory)?;
    let path = directory.join(filename);
    match fs::symlink_metadata(&path) {
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(false),
        Err(error) => return Err(format!("读取字体文件失败: {error}")),
        Ok(_) => {}
    }
    drop(open_regular_file(&directory, filename)?);
    match fs::remove_file(path) {
        Ok(()) => Ok(true),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(false),
        Err(error) => Err(format!("删除字体失败 {filename}: {error}")),
    }
}
