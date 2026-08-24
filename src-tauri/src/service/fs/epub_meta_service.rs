use std::io::{Cursor, Read};
use zip::ZipArchive;

use crate::utils::logging::{log_info, log_warn};

#[derive(Clone, Debug)]
pub struct EpubMetadata {
    pub title: String,
    pub author: String,
}

/// 从 EPUB 字节流中解析元数据（title, author）
pub fn parse_epub_metadata(epub_bytes: &[u8]) -> Result<EpubMetadata, String> {
    let cursor = Cursor::new(epub_bytes);
    let mut archive = ZipArchive::new(cursor).map_err(|error| {
        format!("无法打开 EPUB 文件: {}", error)
    })?;

    // 1. 读取 META-INF/container.xml 找到 OPF 文件路径
    let opf_path = find_opf_path(&mut archive)?;

    // 2. 读取 OPF 文件并解析元数据
    parse_opf_metadata(&mut archive, &opf_path)
}

/// 从 container.xml 中找到 OPF 文件路径
fn find_opf_path<R: Read + std::io::Seek>(
    archive: &mut ZipArchive<R>,
) -> Result<String, String> {
    let container_path = "META-INF/container.xml";
    let mut container_file = archive
        .by_name(container_path)
        .map_err(|error| format!("无法读取 {}: {}", container_path, error))?;

    let mut container_content = String::new();
    container_file
        .read_to_string(&mut container_content)
        .map_err(|error| format!("读取 container.xml 失败: {}", error))?;

    // 解析 XML 查找 rootfile 元素
    // 格式: <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
    let mut reader = quick_xml::Reader::from_str(&container_content);
    reader.config_mut().trim_text(true);

    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(quick_xml::events::Event::Start(ref e))
            | Ok(quick_xml::events::Event::Empty(ref e)) => {
                if e.name().as_ref() == b"rootfile" {
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"full-path" {
                            let path = String::from_utf8_lossy(&attr.value).to_string();
                            log_info(
                                "epub-meta",
                                &format!("found-opf-path path={}", path),
                            );
                            return Ok(path);
                        }
                    }
                }
            }
            Ok(quick_xml::events::Event::Eof) => break,
            Err(error) => {
                return Err(format!("解析 container.xml 失败: {}", error));
            }
            _ => {}
        }
        buf.clear();
    }

    Err("未找到 OPF 文件路径".to_string())
}

/// 从 OPF 文件中解析 title 和 author
fn parse_opf_metadata<R: Read + std::io::Seek>(
    archive: &mut ZipArchive<R>,
    opf_path: &str,
) -> Result<EpubMetadata, String> {
    let mut opf_file = archive
        .by_name(opf_path)
        .map_err(|error| format!("无法读取 OPF 文件 {}: {}", opf_path, error))?;

    let mut opf_content = String::new();
    opf_file
        .read_to_string(&mut opf_content)
        .map_err(|error| format!("读取 OPF 文件失败: {}", error))?;

    let mut reader = quick_xml::Reader::from_str(&opf_content);
    reader.config_mut().trim_text(true);

    let mut title = String::new();
    let mut author = String::new();
    let mut current_element = None;
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(quick_xml::events::Event::Start(ref e)) => {
                let local_name = e.name().local_name();
                let local_name_str = std::str::from_utf8(local_name.as_ref()).unwrap_or("");

                match local_name_str {
                    "title" => current_element = Some("title"),
                    "creator" => current_element = Some("creator"),
                    _ => {}
                }
            }
            Ok(quick_xml::events::Event::Text(ref e)) => {
                if let Some(element) = current_element {
                    let text = e.unescape().unwrap_or_default().to_string();
                    let trimmed = text.trim();
                    if !trimmed.is_empty() {
                        match element {
                            "title" if title.is_empty() => title = trimmed.to_string(),
                            "creator" if author.is_empty() => author = trimmed.to_string(),
                            _ => {}
                        }
                    }
                }
            }
            Ok(quick_xml::events::Event::End(_)) => {
                current_element = None;
            }
            Ok(quick_xml::events::Event::Eof) => break,
            Err(error) => {
                log_warn(
                    "epub-meta",
                    &format!("parse-opf-error error={}", error),
                );
                break;
            }
            _ => {}
        }
        buf.clear();
    }

    // 如果 title 为空，使用文件名作为 fallback
    if title.is_empty() {
        let stem = std::path::Path::new(opf_path)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("untitled");
        title = stem.to_string();
        log_warn(
            "epub-meta",
            &format!("title-empty-fallback-to-filename title={}", title),
        );
    }

    log_info(
        "epub-meta",
        &format!(
            "parsed-epub-metadata title={} author={} opf={}",
            title, author, opf_path
        ),
    );

    Ok(EpubMetadata { title, author })
}
