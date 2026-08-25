use std::{io::Cursor, path::Path};

use chardetng::EncodingDetector;
use encoding_rs::Encoding;
use epub_builder::{EpubBuilder, EpubContent, ReferenceType, ZipLibrary};

use crate::{
    repository::local_fs::file_repository::{read_binary_file, write_binary_file},
    service::fs::{
        txt_chapter_split_service::{split_txt_to_chapters, TxtChapter},
        txt_toc_rule_service::get_enabled_txt_toc_rules,
    },
    utils::logging::log_info,
};

#[derive(Clone)]
pub struct TxtInferredMeta {
    pub title: String,
    pub author: String,
}

pub fn infer_txt_meta_from_filename(file_name: &str) -> TxtInferredMeta {
    let title = Path::new(file_name)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .unwrap_or("untitled")
        .to_string();

    TxtInferredMeta {
        title,
        author: String::new(),
    }
}

pub fn to_epub_file_name(file_name: &str) -> String {
    let stem = Path::new(file_name)
        .file_stem()
        .and_then(|value| value.to_str())
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .unwrap_or("untitled");

    return format!("{stem}.epub");
}

pub fn convert_txt_file_to_epub(
    source_path: &Path,
    source_file_name: &str,
    target_dir: &Path,
) -> Result<String, String> {
    let txt_bytes = read_binary_file(source_path)?;
    convert_txt_bytes_to_epub(source_file_name, &txt_bytes, target_dir)
}

pub fn convert_txt_bytes_to_epub(
    source_file_name: &str,
    txt_bytes: &[u8],
    target_dir: &Path,
) -> Result<String, String> {
    let meta = infer_txt_meta_from_filename(source_file_name);
    let encoding = detect_txt_encoding(txt_bytes);
    let decoded_txt = decode_txt_bytes_with_encoding(txt_bytes, encoding);
    let sample_end = txt_bytes.len().min(512_000);
    let decoded_sample = decode_txt_bytes_with_encoding(&txt_bytes[..sample_end], encoding);
    let chapters = split_txt_into_chapters(&decoded_txt, &decoded_sample)?;
    let epub_bytes = build_epub_bytes(&meta, &chapters)?;
    let epub_file_name = to_epub_file_name(source_file_name);
    let target_path = target_dir.join(&epub_file_name);

    write_binary_file(&target_path, &epub_bytes)?;
    log_info(
        "txt-epub",
        &format!(
            "convert-txt-to-epub source={} target={} title={} chapterCount={} bytes={}",
            source_file_name,
            target_path.display(),
            meta.title,
            chapters.len(),
            epub_bytes.len()
        ),
    );

    Ok(epub_file_name)
}

fn detect_txt_encoding(bytes: &[u8]) -> &'static Encoding {
    let mut detector = EncodingDetector::new();
    detector.feed(bytes, true);
    detector.guess(None, true)
}

fn decode_txt_bytes_with_encoding(bytes: &[u8], encoding: &'static Encoding) -> String {
    let (decoded, _, _) = encoding.decode(bytes);
    normalize_decoded_txt(decoded.as_ref())
}

fn normalize_decoded_txt(text: &str) -> String {
    text.strip_prefix('\u{feff}')
        .unwrap_or(text)
        .replace("\r\n", "\n")
        .replace('\r', "\n")
}

fn split_txt_into_chapters(content: &str, sample: &str) -> Result<Vec<TxtChapter>, String> {
    let heading_rules = get_enabled_txt_toc_rules()?;
    Ok(split_txt_to_chapters(content, sample, &heading_rules))
}
fn build_epub_bytes(meta: &TxtInferredMeta, chapters: &[TxtChapter]) -> Result<Vec<u8>, String> {
    let mut builder = EpubBuilder::new(ZipLibrary::new().map_err(|error| error.to_string())?)
        .map_err(|error| error.to_string())?;
    builder
        .metadata("title", &meta.title)
        .map_err(|error| error.to_string())?;
    if !meta.author.trim().is_empty() {
        builder
            .metadata("creator", &meta.author)
            .map_err(|error| error.to_string())?;
    }
    builder
        .metadata("generator", "T-Reader")
        .map_err(|error| error.to_string())?;

    for (index, chapter) in chapters.iter().enumerate() {
        let chapter_path = format!("chapters/chapter-{}.xhtml", index + 1);
        let chapter_html = render_chapter_html(chapter);
        builder
            .add_content(
                EpubContent::new(chapter_path, Cursor::new(chapter_html.into_bytes()))
                    .title(chapter.title.as_str())
                    .reftype(ReferenceType::Text),
            )
            .map_err(|error| error.to_string())?;
    }

    let mut output = Vec::new();
    builder
        .generate(&mut output)
        .map_err(|error| error.to_string())?;
    Ok(output)
}

fn render_chapter_html(chapter: &TxtChapter) -> String {
    let title = escape_html(&chapter.title);
    let body = render_chapter_body(&chapter.lines);

    return format!(
        r#"<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>{title}</title>
  <meta charset="utf-8" />
</head>
<body>
  <h1>{title}</h1>
  {body}
</body>
</html>"#
    );
}

fn render_chapter_body(lines: &[String]) -> String {
    let mut paragraphs = Vec::new();

    for line in lines {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        paragraphs.push(format!("<p>{}</p>", escape_html(trimmed)));
    }

    if paragraphs.is_empty() {
        "<p></p>".to_string()
    } else {
        paragraphs.join("\n  ")
    }
}

fn escape_html(raw: &str) -> String {
    raw.chars()
        .flat_map(|value| match value {
            '&' => "&amp;".chars().collect::<Vec<_>>(),
            '<' => "&lt;".chars().collect::<Vec<_>>(),
            '>' => "&gt;".chars().collect::<Vec<_>>(),
            '"' => "&quot;".chars().collect::<Vec<_>>(),
            '\'' => "&#39;".chars().collect::<Vec<_>>(),
            _ => vec![value],
        })
        .collect()
}
