use quick_xml::{events::Event, name::QName, Reader};
use std::path::Path;
use urlencoding::decode;

pub fn is_supported_book_file(filename: &str) -> bool {
    is_epub_book_file(filename) || is_txt_book_file(filename)
}

pub fn is_epub_book_file(filename: &str) -> bool {
    filename.to_ascii_lowercase().ends_with(".epub")
}

pub fn is_txt_book_file(filename: &str) -> bool {
    filename.to_ascii_lowercase().ends_with(".txt")
}

pub fn is_config_file(filename: &str) -> bool {
    filename.ends_with(".json")
}

pub fn get_remote_file_url(base_url: &str, subdir: &str, filename: &str) -> String {
    format!("{}/{}/{}", base_url.trim_end_matches('/'), subdir, filename)
}

pub fn read_dur_chapter_time(contents: &[u8]) -> Option<i64> {
    let value = serde_json::from_slice::<serde_json::Value>(contents).ok()?;
    value
        .get("durChapterTime")
        .and_then(|dur_chapter_time| dur_chapter_time.as_i64())
}

pub fn should_upload_local_config(local_contents: &[u8], cloud_contents: &[u8]) -> bool {
    match (
        read_dur_chapter_time(local_contents),
        read_dur_chapter_time(cloud_contents),
    ) {
        (Some(local), Some(cloud)) => local > cloud,
        (Some(_), None) => true,
        (None, Some(_)) => false,
        (None, None) => false,
    }
}

pub fn parse_webdav_response(response: &str) -> Result<Vec<String>, String> {
    let mut reader = Reader::from_str(response);
    reader.config_mut().trim_text(true);
    let mut buf = Vec::new();
    let mut files = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) if e.name().as_ref() == b"d:href" => {
                if let Ok(href) = reader.read_text(QName(b"d:href")) {
                    if !href.ends_with('/') {
                        if let Some(file_name) = Path::new(href.as_ref()).file_name() {
                            if let Some(file_name_str) = file_name.to_str() {
                                let decoded = decode(file_name_str).map_err(|error| {
                                    format!("failed to decode WebDAV href: {:?}", error)
                                })?;
                                files.push(decoded.into_owned());
                            }
                        }
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(error) => {
                return Err(format!("failed to parse WebDAV response: {:?}", error));
            }
            _ => (),
        }
        buf.clear();
    }

    Ok(files)
}
