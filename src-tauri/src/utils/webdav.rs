use quick_xml::{events::Event, Reader};
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
            Ok(Event::Start(ref e)) if is_href_element(e.name().as_ref()) => {
                let href = read_href_text(&mut reader, &mut buf)?;
                if !href.ends_with('/') {
                    if let Some(file_name) = Path::new(href.as_str()).file_name() {
                        if let Some(file_name_str) = file_name.to_str() {
                            let decoded = decode(file_name_str).map_err(|error| {
                                format!("failed to decode WebDAV href: {:?}", error)
                            })?;
                            files.push(decoded.into_owned());
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

/// 判断标签是否为任意命名空间前缀下的 `href` 元素。RFC 4918 中 `href` 位于 `DAV:`
/// 命名空间,但服务器可以使用任意前缀(`d:href`、`D:href`、`ns0:href`)或默认命名空间
/// (无前缀 `href`),因此按本地名匹配而非字面匹配前缀。
fn is_href_element(name: &[u8]) -> bool {
    name.rsplit(|&byte| byte == b':')
        .next()
        .is_some_and(|local| local == b"href")
}

/// 读取当前 `href` 元素内的文本。`href` 为叶节点,不含子元素,因此从 Start 事件后
/// 直接收集文本直到 End 事件即可,不受结束标签前缀影响。
fn read_href_text(reader: &mut Reader<&[u8]>, buf: &mut Vec<u8>) -> Result<String, String> {
    let mut text = String::new();
    loop {
        match reader.read_event_into(buf) {
            Ok(Event::Text(t)) => {
                let unescaped = t
                    .unescape()
                    .map_err(|error| format!("failed to unescape WebDAV href: {:?}", error))?;
                text.push_str(&unescaped);
            }
            Ok(Event::End(_)) | Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(error) => {
                return Err(format!("failed to parse WebDAV response: {:?}", error));
            }
        }
        buf.clear();
    }
    Ok(text)
}

#[cfg(test)]
mod tests {
    use super::parse_webdav_response;

    #[test]
    fn parses_standard_d_prefixed_hrefs() {
        let response = r#"<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/dav/books/</D:href>
  </D:response>
  <D:response>
    <D:href>/dav/books/foo.epub</D:href>
  </D:response>
  <D:response>
    <D:href>/dav/books/bar.txt</D:href>
  </D:response>
</D:multistatus>"#;
        assert_eq!(
            parse_webdav_response(response).unwrap(),
            vec!["foo.epub".to_string(), "bar.txt".to_string()]
        );
    }

    #[test]
    fn parses_uppercase_prefix_hrefs() {
        let response = r#"<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>https://example.com/dav/books/novel.epub</D:href>
  </D:response>
</D:multistatus>"#;
        assert_eq!(
            parse_webdav_response(response).unwrap(),
            vec!["novel.epub".to_string()]
        );
    }

    #[test]
    fn parses_arbitrary_prefix_hrefs() {
        let response = r#"<?xml version="1.0" encoding="utf-8"?>
<ns0:multistatus xmlns:ns0="DAV:">
  <ns0:response>
    <ns0:href>/remote.php/dav/files/user/T-Reader/books/readme.txt</ns0:href>
  </ns0:response>
</ns0:multistatus>"#;
        assert_eq!(
            parse_webdav_response(response).unwrap(),
            vec!["readme.txt".to_string()]
        );
    }

    #[test]
    fn parses_default_namespace_unprefixed_hrefs() {
        let response = r#"<?xml version="1.0" encoding="utf-8"?>
<multistatus xmlns="DAV:">
  <response>
    <href>/dav/books/guide.epub</href>
  </response>
</multistatus>"#;
        assert_eq!(
            parse_webdav_response(response).unwrap(),
            vec!["guide.epub".to_string()]
        );
    }

    #[test]
    fn filters_directory_hrefs() {
        let response = r#"<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/dav/books/</D:href>
  </D:response>
  <D:response>
    <D:href>/dav/books/</D:href>
  </D:response>
</D:multistatus>"#;
        assert!(parse_webdav_response(response).unwrap().is_empty());
    }

    #[test]
    fn decodes_percent_encoded_filenames() {
        let response = r#"<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/dav/books/%E4%B8%AD%E6%96%87.epub</D:href>
  </D:response>
</D:multistatus>"#;
        assert_eq!(
            parse_webdav_response(response).unwrap(),
            vec!["中文.epub".to_string()]
        );
    }
}
