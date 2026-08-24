use std::{
    collections::HashMap,
    io::{Cursor, Read},
};

use quick_xml::events::Event;
use zip::ZipArchive;

use crate::utils::logging::log_warn;

#[derive(Debug, Clone)]
pub struct EpubKnowledgeParagraph {
    pub chapter_index: i64,
    pub chapter_title: String,
    pub paragraph_index: i64,
    pub text: String,
}

#[derive(Debug, Default)]
struct EpubPackage {
    base_dir: String,
    manifest: HashMap<String, String>,
    spine: Vec<String>,
}

pub fn extract_epub_knowledge_paragraphs(
    epub_bytes: &[u8],
) -> Result<Vec<EpubKnowledgeParagraph>, String> {
    let cursor = Cursor::new(epub_bytes);
    let mut archive =
        ZipArchive::new(cursor).map_err(|error| format!("无法打开 EPUB 文件: {}", error))?;

    let opf_path = find_opf_path(&mut archive)?;
    let package = parse_opf_package(&mut archive, &opf_path)?;
    let chapter_titles = parse_ncx_titles(&mut archive, &package);

    if package.spine.is_empty() {
        return Err("EPUB 中没有可读取的正文章节".to_string());
    }

    let mut paragraphs = Vec::new();
    let mut paragraph_index = 0_i64;

    for (chapter_index, idref) in package.spine.iter().enumerate() {
        let Some(href) = package.manifest.get(idref) else {
            log_warn(
                "knowledge-base",
                &format!("spine manifest missing idref={}", idref),
            );
            continue;
        };

        let resolved_path = resolve_epub_path(&package.base_dir, href);
        let title = chapter_titles
            .get(&resolved_path)
            .cloned()
            .unwrap_or_else(|| format!("第 {} 章", chapter_index + 1));

        match read_zip_entry_text(&mut archive, &resolved_path) {
            Ok(content) => {
                let section_paragraphs = extract_xhtml_paragraphs(&content)?;
                for text in section_paragraphs {
                    paragraphs.push(EpubKnowledgeParagraph {
                        chapter_index: chapter_index as i64,
                        chapter_title: title.clone(),
                        paragraph_index,
                        text,
                    });
                    paragraph_index += 1;
                }
            }
            Err(error) => {
                log_warn(
                    "knowledge-base",
                    &format!(
                        "skip-spine-file idref={} path={} error={}",
                        idref, resolved_path, error
                    ),
                );
            }
        }
    }

    if paragraphs.is_empty() {
        return Err("未能从书籍中提取到正文".to_string());
    }

    Ok(paragraphs)
}

fn find_opf_path<R: Read + std::io::Seek>(archive: &mut ZipArchive<R>) -> Result<String, String> {
    let container_path = "META-INF/container.xml";
    let mut container_file = archive
        .by_name(container_path)
        .map_err(|error| format!("无法读取 {}: {}", container_path, error))?;
    let mut container_content = String::new();
    container_file
        .read_to_string(&mut container_content)
        .map_err(|error| format!("读取 container.xml 失败: {}", error))?;

    let mut reader = quick_xml::Reader::from_str(&container_content);
    reader.config_mut().trim_text(true);
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) | Ok(Event::Empty(ref e)) => {
                if e.name().as_ref() == b"rootfile" {
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"full-path" {
                            return Ok(String::from_utf8_lossy(&attr.value).to_string());
                        }
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(error) => return Err(format!("解析 container.xml 失败: {}", error)),
            _ => {}
        }
        buf.clear();
    }

    Err("未找到 OPF 文件路径".to_string())
}

fn parse_opf_package<R: Read + std::io::Seek>(
    archive: &mut ZipArchive<R>,
    opf_path: &str,
) -> Result<EpubPackage, String> {
    let mut opf_file = archive
        .by_name(opf_path)
        .map_err(|error| format!("无法读取 OPF 文件 {}: {}", opf_path, error))?;
    let mut opf_content = String::new();
    opf_file
        .read_to_string(&mut opf_content)
        .map_err(|error| format!("读取 OPF 文件失败: {}", error))?;

    let mut package = EpubPackage {
        base_dir: std::path::Path::new(opf_path)
            .parent()
            .and_then(|path| path.to_str())
            .unwrap_or("")
            .to_string(),
        ..EpubPackage::default()
    };

    let mut reader = quick_xml::Reader::from_str(&opf_content);
    reader.config_mut().trim_text(true);
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) | Ok(Event::Empty(ref e)) => {
                let name = e.name().local_name();
                let name = name.as_ref();
                if name == b"item" {
                    let mut id = None;
                    let mut href = None;
                    for attr in e.attributes().flatten() {
                        match attr.key.as_ref() {
                            b"id" => id = Some(String::from_utf8_lossy(&attr.value).to_string()),
                            b"href" => {
                                href = Some(String::from_utf8_lossy(&attr.value).to_string())
                            }
                            _ => {}
                        }
                    }
                    if let (Some(id), Some(href)) = (id, href) {
                        package.manifest.insert(id, href);
                    }
                } else if name == b"itemref" {
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"idref" {
                            package
                                .spine
                                .push(String::from_utf8_lossy(&attr.value).to_string());
                        }
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(error) => return Err(format!("解析 OPF 失败: {}", error)),
            _ => {}
        }
        buf.clear();
    }

    Ok(package)
}

fn parse_ncx_titles<R: Read + std::io::Seek>(
    archive: &mut ZipArchive<R>,
    package: &EpubPackage,
) -> HashMap<String, String> {
    let candidates = [
        "toc.ncx",
        "OEBPS/toc.ncx",
        "OPS/toc.ncx",
        "navigation.ncx",
        "nav.xhtml",
    ];

    let mut ncx_path = None;
    for candidate in candidates {
        if archive.by_name(candidate).is_ok() {
            ncx_path = Some(candidate.to_string());
            break;
        }
    }

    let Some(ncx_path) = ncx_path else {
        return HashMap::new();
    };

    let Ok(content) = read_zip_entry_text(archive, &ncx_path) else {
        return HashMap::new();
    };

    let mut titles = HashMap::new();
    let mut reader = quick_xml::Reader::from_str(&content);
    reader.config_mut().trim_text(true);
    let mut buf = Vec::new();
    let mut current_label = String::new();
    let mut current_src = String::new();
    let mut in_label = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) | Ok(Event::Empty(ref e)) => {
                let name = e.name().local_name();
                let name = name.as_ref();
                if name == b"navLabel" || name == b"label" {
                    current_label.clear();
                    current_src.clear();
                    in_label = true;
                } else if name == b"content" {
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"src" {
                            current_src = String::from_utf8_lossy(&attr.value).to_string();
                        }
                    }
                }
            }
            Ok(Event::Text(ref e)) if in_label => {
                current_label.push_str(&e.unescape().unwrap_or_default().to_string());
            }
            Ok(Event::End(ref e)) => {
                let name = e.name().local_name();
                let name = name.as_ref();
                if name == b"navLabel" || name == b"label" {
                    if !current_label.trim().is_empty() && !current_src.is_empty() {
                        let resolved = resolve_epub_path(&package.base_dir, &current_src);
                        titles.insert(resolved, current_label.trim().to_string());
                    }
                    in_label = false;
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }

    titles
}

fn resolve_epub_path(base_dir: &str, href: &str) -> String {
    let clean_href = href.split('#').next().unwrap_or(href);
    let joined = if clean_href.starts_with('/') {
        clean_href.trim_start_matches('/').to_string()
    } else if base_dir.is_empty() {
        clean_href.to_string()
    } else {
        format!("{}/{}", base_dir.trim_end_matches('/'), clean_href)
    };

    let normalized_path = joined.replace('\\', "/");
    let mut parts: Vec<&str> = Vec::new();
    for part in normalized_path.split('/') {
        match part {
            "" | "." => {}
            ".." => {
                parts.pop();
            }
            value => parts.push(value),
        }
    }

    parts.join("/")
}

fn read_zip_entry_text<R: Read + std::io::Seek>(
    archive: &mut ZipArchive<R>,
    path: &str,
) -> Result<String, String> {
    let decoded_path;
    let lookup_path = if archive.by_name(path).is_ok() {
        path
    } else {
        decoded_path =
            urlencoding::decode(path).map_err(|error| format!("解析 EPUB 路径失败: {}", error))?;
        decoded_path.as_ref()
    };
    let mut file = archive
        .by_name(lookup_path)
        .map_err(|error| format!("无法读取 EPUB 文件 {}: {}", path, error))?;

    let mut content = String::new();
    file.read_to_string(&mut content)
        .map_err(|error| format!("读取 EPUB 文件失败: {}", error))?;
    Ok(content)
}

fn is_block_start(name: &[u8]) -> bool {
    name == b"p"
        || name == b"div"
        || name == b"section"
        || name == b"article"
        || name == b"h1"
        || name == b"h2"
        || name == b"h3"
        || name == b"h4"
        || name == b"h5"
        || name == b"h6"
        || name == b"li"
        || name == b"blockquote"
        || name == b"tr"
        || name == b"td"
        || name == b"th"
}

fn is_block_end(name: &[u8]) -> bool {
    is_block_start(name)
}

fn is_skippable(name: &[u8]) -> bool {
    name == b"script" || name == b"style"
}

fn flush_paragraph(output: &mut Vec<String>, paragraph: &mut String) {
    let text = paragraph.trim();
    if text.is_empty() {
        return;
    }

    output.push(text.to_string());
    paragraph.clear();
}

fn append_inline_text(paragraph: &mut String, text: &str) {
    let normalized = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.is_empty() {
        return;
    }

    if !paragraph.is_empty() {
        paragraph.push(' ');
    }
    paragraph.push_str(&normalized);
}

fn extract_xhtml_paragraphs(content: &str) -> Result<Vec<String>, String> {
    let mut reader = quick_xml::Reader::from_str(content);
    reader.config_mut().trim_text(true);

    let mut output = Vec::new();
    let mut paragraph = String::new();
    let mut skip_depth = 0_u32;
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let name = e.name().local_name();
                let name = name.as_ref();
                if skip_depth > 0 {
                    if is_skippable(name) {
                        skip_depth += 1;
                    }
                    buf.clear();
                    continue;
                }
                if is_skippable(name) {
                    flush_paragraph(&mut output, &mut paragraph);
                    skip_depth = 1;
                } else if is_block_start(name) {
                    flush_paragraph(&mut output, &mut paragraph);
                }
            }
            Ok(Event::Empty(ref e)) => {
                let name = e.name().local_name();
                let name = name.as_ref();
                if skip_depth > 0 {
                    buf.clear();
                    continue;
                }
                if name == b"br" || is_block_start(name) {
                    flush_paragraph(&mut output, &mut paragraph);
                }
            }
            Ok(Event::End(ref e)) => {
                let name = e.name().local_name();
                let name = name.as_ref();
                if skip_depth > 0 {
                    if is_skippable(name) {
                        skip_depth = skip_depth.saturating_sub(1);
                    }
                } else if is_block_end(name) || name == b"br" {
                    flush_paragraph(&mut output, &mut paragraph);
                }
            }
            Ok(Event::Text(ref e)) => {
                if skip_depth == 0 {
                    let text = e.unescape().unwrap_or_default().to_string();
                    append_inline_text(&mut paragraph, &text);
                }
            }
            Ok(Event::CData(ref e)) => {
                if skip_depth == 0 {
                    let text = String::from_utf8_lossy(e.as_ref()).to_string();
                    append_inline_text(&mut paragraph, &text);
                }
            }
            Ok(Event::Eof) => break,
            Err(error) => return Err(format!("解析 XHTML 失败: {}", error)),
            _ => {}
        }
        buf.clear();
    }

    flush_paragraph(&mut output, &mut paragraph);
    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::extract_xhtml_paragraphs;

    #[test]
    fn extracts_paragraphs_in_order() {
        let html = r#"<html><body><h1>标题</h1><p>第一段</p><script>var x=1;</script><p>第二段</p></body></html>"#;
        let paragraphs = extract_xhtml_paragraphs(html).unwrap();
        assert!(paragraphs.iter().any(|text| text == "标题"));
        assert!(paragraphs.iter().any(|text| text == "第一段"));
        assert!(paragraphs.iter().any(|text| text == "第二段"));
        assert!(!paragraphs.iter().any(|text| text.contains("var x")));
    }
}
