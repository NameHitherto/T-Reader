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

/// 远程文件元数据，来自 PROPFIND 响应中的 getetag / getlastmodified / getcontentlength。
/// 任一字段在服务端缺失时为 None。
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct RemoteFileMeta {
    pub file_name: String,
    pub etag: Option<String>,
    pub last_modified: Option<String>,
    pub content_length: Option<u64>,
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
    Ok(parse_webdav_response_meta(response)?
        .into_iter()
        .map(|meta| meta.file_name)
        .collect())
}

/// 解析 PROPFIND 响应，返回每个非目录资源的文件名及可用元数据。
/// 服务端未返回某元数据时对应字段为 None。
pub fn parse_webdav_response_meta(response: &str) -> Result<Vec<RemoteFileMeta>, String> {
    let mut reader = Reader::from_str(response);
    reader.config_mut().trim_text(true);
    let mut buf = Vec::new();
    let mut metas = Vec::new();

    let mut current_href: Option<String> = None;
    let mut current_etag: Option<String> = None;
    let mut current_last_modified: Option<String> = None;
    let mut current_content_length: Option<u64> = None;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => match local_name(e.name().as_ref()) {
                b"response" => {
                    current_href = None;
                    current_etag = None;
                    current_last_modified = None;
                    current_content_length = None;
                }
                b"href" => {
                    current_href = Some(read_element_text(&mut reader, &mut buf)?);
                }
                b"getetag" => {
                    current_etag = Some(read_element_text(&mut reader, &mut buf)?);
                }
                b"getlastmodified" => {
                    current_last_modified = Some(read_element_text(&mut reader, &mut buf)?);
                }
                b"getcontentlength" => {
                    let text = read_element_text(&mut reader, &mut buf)?;
                    current_content_length = text.trim().parse::<u64>().ok();
                }
                _ => {}
            },
            Ok(Event::End(ref e)) if local_name(e.name().as_ref()) == b"response" => {
                if let Some(href) = current_href.take() {
                    if !href.ends_with('/') {
                        if let Some(file_name) = Path::new(&href).file_name().and_then(|s| s.to_str())
                        {
                            let decoded = decode(file_name).map_err(|error| {
                                format!("failed to decode WebDAV href: {:?}", error)
                            })?;
                            metas.push(RemoteFileMeta {
                                file_name: decoded.into_owned(),
                                etag: current_etag.take(),
                                last_modified: current_last_modified.take(),
                                content_length: current_content_length.take(),
                            });
                        }
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(error) => {
                return Err(format!("failed to parse WebDAV response: {:?}", error));
            }
            _ => {}
        }
        buf.clear();
    }

    Ok(metas)
}

/// 取标签的本地名（去掉命名空间前缀）。RFC 4918 中属性位于 `DAV:` 命名空间,
/// 但服务器可使用任意前缀(`d:href`、`D:href`、`ns0:href`)或默认命名空间(无前缀)。
fn local_name(name: &[u8]) -> &[u8] {
    name.rsplit(|&byte| byte == b':')
        .next()
        .unwrap_or(name)
}

/// 读取当前叶节点元素内的文本，直到其 End 事件或 Eof。
fn read_element_text(reader: &mut Reader<&[u8]>, buf: &mut Vec<u8>) -> Result<String, String> {
    let mut text = String::new();
    loop {
        match reader.read_event_into(buf) {
            Ok(Event::Text(t)) => {
                let unescaped = t
                    .unescape()
                    .map_err(|error| format!("failed to unescape WebDAV element: {:?}", error))?;
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
    use super::{parse_webdav_response, parse_webdav_response_meta, RemoteFileMeta};

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

    #[test]
    fn parses_file_metadata_within_response() {
        let response = r#"<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/dav/books/</D:href>
    <D:propstat><D:prop>
      <D:getetag>"dir-etag"</D:getetag>
    </D:prop></D:propstat>
  </D:response>
  <D:response>
    <D:href>/dav/books/foo.epub</D:href>
    <D:propstat><D:prop>
      <D:getetag>"abc123"</D:getetag>
      <D:getlastmodified>Wed, 01 Jan 2025 00:00:00 GMT</D:getlastmodified>
      <D:getcontentlength>1024</D:getcontentlength>
    </D:prop></D:propstat>
  </D:response>
</D:multistatus>"#;
        assert_eq!(
            parse_webdav_response_meta(response).unwrap(),
            vec![RemoteFileMeta {
                file_name: "foo.epub".to_string(),
                etag: Some("\"abc123\"".to_string()),
                last_modified: Some("Wed, 01 Jan 2025 00:00:00 GMT".to_string()),
                content_length: Some(1024),
            }]
        );
    }

    #[test]
    fn parses_metadata_with_missing_fields_as_none() {
        let response = r#"<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/dav/books/plain.txt</D:href>
  </D:response>
</D:multistatus>"#;
        assert_eq!(
            parse_webdav_response_meta(response).unwrap(),
            vec![RemoteFileMeta {
                file_name: "plain.txt".to_string(),
                etag: None,
                last_modified: None,
                content_length: None,
            }]
        );
    }
}
