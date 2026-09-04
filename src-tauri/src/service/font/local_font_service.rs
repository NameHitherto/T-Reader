use std::{
    collections::HashSet,
    io::{Read, Seek},
    path::Path,
};

use quick_xml::{Reader, events::Event};
use zip::{ZipArchive, result::ZipError};

use crate::{
    entities::font::{
        DeleteLocalFontResult, ExtractedFontResult, FontExtractionStatus, LocalFontsResult,
    },
    repository::{
        font_metadata::parse_font_data,
        local_fs::{dir_repository::get_local_root_dir, font_repository as fonts},
    },
};

const MAX_TOTAL_BYTES: u64 = 256 * 1024 * 1024;
const MAX_ENCRYPTION_XML_BYTES: u64 = 1024 * 1024;

#[derive(Clone, Copy)]
struct ExtractionLimits {
    per_font: u64,
    total: u64,
}

const LIMITS: ExtractionLimits = ExtractionLimits {
    per_font: fonts::MAX_FONT_BYTES,
    total: MAX_TOTAL_BYTES,
};

pub fn extract_epub_fonts(filename: &str) -> Result<Vec<ExtractedFontResult>, String> {
    extract_epub_fonts_at(&get_local_root_dir()?, filename, LIMITS)
}

pub fn get_local_fonts() -> Result<LocalFontsResult, String> {
    let directory = fonts::prepare_fonts_dir(&get_local_root_dir()?)?;
    fonts::scan_fonts(&directory)
}

pub fn delete_local_font(filename: &str) -> Result<DeleteLocalFontResult, String> {
    fonts::validate_filename(filename)?;
    let directory = fonts::prepare_fonts_dir(&get_local_root_dir()?)?;
    Ok(DeleteLocalFontResult {
        deleted: fonts::delete_font(&directory, filename)?,
    })
}

fn extract_epub_fonts_at(
    root: &Path,
    filename: &str,
    limits: ExtractionLimits,
) -> Result<Vec<ExtractedFontResult>, String> {
    fonts::validate_filename(filename)?;
    if !Path::new(filename)
        .extension()
        .is_some_and(|extension| extension.eq_ignore_ascii_case("epub"))
    {
        return Err("只支持 EPUB 文件".to_string());
    }
    let directory = fonts::prepare_fonts_dir(root)?;
    let file = fonts::open_regular_file(&fonts::books_dir(root)?, filename)?;
    let mut archive =
        ZipArchive::new(file).map_err(|error| format!("无法打开 EPUB 文件: {error}"))?;
    // If encryption declarations cannot be understood, fail before publishing any font.
    let encrypted_paths = read_encrypted_paths(&mut archive)?;
    fonts::check_writable(&directory)?;
    let mut results = Vec::new();
    let mut total_bytes = 0u64;

    for index in 0..archive.len() {
        let source_path = archive
            .name_for_index(index)
            .unwrap_or_default()
            .to_string();
        let Some(extension) = fonts::font_extension(&source_path) else {
            continue;
        };
        let mut result = ExtractedFontResult {
            source_path: source_path.clone(),
            filename: None,
            fonts: Vec::new(),
            status: FontExtractionStatus::Skipped,
            reason: None,
        };
        let outcome = (|| {
            let normalized_path = normalize_archive_path(&source_path)?;
            if encrypted_paths.contains(&normalized_path) {
                return Err("字体声明为混淆或加密资源，未提取".to_string());
            }
            if matches!(extension.as_str(), "woff" | "woff2") {
                return Err("暂不支持 WOFF/WOFF2 字体".to_string());
            }
            let (size, encrypted, regular) = {
                let raw = archive.by_index_raw(index).map_err(|error| {
                    result.status = FontExtractionStatus::Failed;
                    format!("读取 ZIP 条目失败: {error}")
                })?;
                (
                    raw.size(),
                    raw.encrypted(),
                    !raw.is_dir() && !raw.is_symlink(),
                )
            };
            if encrypted {
                return Err("ZIP 条目已加密，未提取".to_string());
            }
            if !regular {
                return Err("字体条目不是普通文件".to_string());
            }
            if size > limits.per_font {
                return Err("字体解压大小超过单文件 64 MiB 限制".to_string());
            }
            let remaining = limits.total.saturating_sub(total_bytes);
            if size > remaining || remaining == 0 {
                return Err("字体解压大小超过单次累计 256 MiB 限制".to_string());
            }
            let entry = archive.by_index(index).map_err(|error| {
                result.status = FontExtractionStatus::Failed;
                format!("打开字体条目失败: {error}")
            })?;
            let mut data = Vec::new();
            let read = entry
                .take(limits.per_font.min(remaining) + 1)
                .read_to_end(&mut data);
            // Include bytes consumed by malformed or otherwise rejected fonts in the budget.
            total_bytes = total_bytes.saturating_add(data.len() as u64);
            if data.len() as u64 > limits.per_font {
                return Err("字体解压大小超过单文件 64 MiB 限制".to_string());
            }
            if total_bytes > limits.total {
                return Err("字体解压大小超过单次累计 256 MiB 限制".to_string());
            }
            read.map_err(|error| {
                result.status = FontExtractionStatus::Failed;
                format!("解压字体失败: {error}")
            })?;
            let (canonical_extension, faces) = parse_font_data(&data)?;
            result.status = FontExtractionStatus::Failed;
            let (filename, created) = fonts::store_font(&directory, canonical_extension, &data)?;
            result.fonts = fonts::local_entries(&directory, &filename, faces);
            result.filename = Some(filename);
            result.status = if created {
                FontExtractionStatus::Extracted
            } else {
                FontExtractionStatus::Existing
            };
            Ok(())
        })();
        if let Err(reason) = outcome {
            result.reason = Some(reason);
        }
        results.push(result);
    }
    Ok(results)
}

fn normalize_archive_path(path: &str) -> Result<String, String> {
    if path.starts_with('/') || path.contains(['\\', ':', '\0']) {
        return Err("EPUB 资源路径非法".to_string());
    }
    let mut parts = Vec::new();
    for part in path.split('/') {
        match part {
            "" | "." => {}
            ".." => return Err("EPUB 资源路径不能包含上级目录".to_string()),
            value => parts.push(value),
        }
    }
    if parts.is_empty() {
        return Err("EPUB 资源路径为空".to_string());
    }
    Ok(parts.join("/"))
}

fn read_encrypted_paths<R: Read + Seek>(
    archive: &mut ZipArchive<R>,
) -> Result<HashSet<String>, String> {
    let entry = match archive.by_name("META-INF/encryption.xml") {
        Ok(entry) => entry,
        Err(ZipError::FileNotFound) => return Ok(HashSet::new()),
        Err(error) => return Err(format!("读取字体加密声明失败: {error}")),
    };
    if entry.size() > MAX_ENCRYPTION_XML_BYTES {
        return Err("字体加密声明超过 1 MiB 限制".to_string());
    }
    let mut xml = String::new();
    entry
        .take(MAX_ENCRYPTION_XML_BYTES + 1)
        .read_to_string(&mut xml)
        .map_err(|error| format!("读取字体加密声明失败: {error}"))?;
    if xml.len() as u64 > MAX_ENCRYPTION_XML_BYTES {
        return Err("字体加密声明超过 1 MiB 限制".to_string());
    }
    let mut reader = Reader::from_str(&xml);
    let mut paths = HashSet::new();
    let mut depth = 0usize;
    let mut saw_root = false;
    loop {
        let event = reader
            .read_event()
            .map_err(|error| format!("解析字体加密声明失败: {error}"))?;
        match &event {
            Event::Start(element) | Event::Empty(element) => {
                if depth == 0 {
                    if saw_root || element.local_name().as_ref() != b"encryption" {
                        return Err("字体加密声明必须有唯一的 encryption 根元素".to_string());
                    }
                    saw_root = true;
                }
                if matches!(event, Event::Start(_)) {
                    depth += 1;
                }
                if element.local_name().as_ref() == b"CipherReference" {
                    let mut uri = None;
                    for attr in element.attributes() {
                        let attr =
                            attr.map_err(|error| format!("解析加密资源属性失败: {error}"))?;
                        if attr.key.as_ref() == b"URI" {
                            uri = Some(
                                attr.unescape_value()
                                    .map_err(|error| error.to_string())?
                                    .into_owned(),
                            );
                        }
                    }
                    let uri = uri.ok_or("加密资源缺少 URI")?;
                    let decoded = urlencoding::decode(&uri)
                        .map_err(|error| format!("加密资源 URI 非法: {error}"))?;
                    paths.insert(normalize_archive_path(&decoded)?);
                }
            }
            Event::End(_) => {
                depth = depth.checked_sub(1).ok_or("字体加密声明的标签不匹配")?;
            }
            Event::Text(text) if depth == 0 => {
                if !text
                    .unescape()
                    .map_err(|error| error.to_string())?
                    .trim()
                    .is_empty()
                {
                    return Err("字体加密声明包含根元素外的文本".to_string());
                }
            }
            Event::DocType(_) => return Err("字体加密声明不支持 DTD".to_string()),
            Event::Eof => break,
            _ => {}
        }
    }
    if !saw_root || depth != 0 {
        return Err("字体加密声明为空或标签未闭合".to_string());
    }
    Ok(paths)
}

#[cfg(test)]
mod tests;
