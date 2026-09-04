use super::*;
use crate::repository::font_metadata::test_support::{collection_bytes, font_bytes};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Cursor, Write},
    path::PathBuf,
};
use zip::{ZipWriter, write::SimpleFileOptions};

struct TestRoot(PathBuf);

impl TestRoot {
    fn new() -> Self {
        let path =
            std::env::temp_dir().join(format!("t-reader-font-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&path).unwrap();
        fs::create_dir(path.join("books")).unwrap();
        Self(path)
    }

    fn epub(&self, entries: &[(&str, &[u8])]) {
        let mut zip = ZipWriter::new(Cursor::new(Vec::new()));
        for (name, data) in entries {
            zip.start_file(
                *name,
                SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored),
            )
            .unwrap();
            zip.write_all(data).unwrap();
        }
        fs::write(
            self.0.join("books/test.epub"),
            zip.finish().unwrap().into_inner(),
        )
        .unwrap();
    }

    fn extract(&self) -> Vec<ExtractedFontResult> {
        extract_epub_fonts_at(&self.0, "test.epub", LIMITS).unwrap()
    }

    fn directory(&self) -> PathBuf {
        fonts::prepare_fonts_dir(&self.0).unwrap()
    }
}

impl Drop for TestRoot {
    fn drop(&mut self) {
        // Only this fixture's uniquely-created temporary tree is removed.
        assert_eq!(self.0.parent(), Some(std::env::temp_dir().as_path()));
        let _ = fs::remove_dir_all(&self.0);
    }
}

#[test]
fn extract_scan_repeat_and_delete_font() {
    let root = TestRoot::new();
    let data = font_bytes(400);
    root.epub(&[("OEBPS/fonts/body.TTF", &data)]);
    let first = root.extract();
    assert_eq!(first[0].status, FontExtractionStatus::Extracted);
    let filename = first[0].filename.as_ref().unwrap();
    assert_eq!(filename, &format!("{:x}.ttf", Sha256::digest(&data)));
    assert_eq!(fs::read(root.directory().join(filename)).unwrap(), data);
    assert_eq!(first[0].fonts.len(), 1);
    let scanned = fonts::scan_fonts(&root.directory()).unwrap();
    assert!(scanned.warnings.is_empty());
    assert_eq!(scanned.fonts[0].filename, *filename);
    assert_eq!(scanned.fonts[0].font.weight, Some(400));
    assert!(Path::new(scanned.fonts[0].font.path.as_ref().unwrap()).is_absolute());
    assert_eq!(root.extract()[0].status, FontExtractionStatus::Existing);
    assert_eq!(fs::read_dir(root.directory()).unwrap().count(), 1);
    assert!(fonts::delete_font(&root.directory(), filename).unwrap());
    assert!(!fonts::delete_font(&root.directory(), filename).unwrap());
    assert!(
        fonts::scan_fonts(&root.directory())
            .unwrap()
            .fonts
            .is_empty()
    );
}

#[test]
fn deduplicates_across_paths_and_books_but_keeps_different_content() {
    let root = TestRoot::new();
    let regular = font_bytes(400);
    let bold = font_bytes(700);
    root.epub(&[
        ("a/body.ttf", &regular),
        ("b/body.ttf", &bold),
        ("c/alias.otf", &regular),
    ]);
    let items = root.extract();
    assert_eq!(items[0].status, FontExtractionStatus::Extracted);
    assert_eq!(items[1].status, FontExtractionStatus::Extracted);
    assert_eq!(items[2].status, FontExtractionStatus::Existing);
    assert_eq!(items[0].filename, items[2].filename);
    assert_ne!(items[0].filename, items[1].filename);
    fs::copy(
        root.0.join("books/test.epub"),
        root.0.join("books/other.EPUB"),
    )
    .unwrap();
    let again = extract_epub_fonts_at(&root.0, "other.EPUB", LIMITS).unwrap();
    assert!(
        again
            .iter()
            .all(|item| item.status == FontExtractionStatus::Existing)
    );
    assert_eq!(fs::read_dir(root.directory()).unwrap().count(), 2);
}

#[test]
fn collection_faces_share_one_file_and_delete_together() {
    let root = TestRoot::new();
    let data = collection_bytes();
    root.epub(&[("fonts/body.TTC", &data)]);
    let items = root.extract();
    assert_eq!(items[0].status, FontExtractionStatus::Extracted);
    assert!(items[0].fonts.len() >= 2);
    let filename = items[0].filename.as_ref().unwrap();
    for (index, entry) in items[0].fonts.iter().enumerate() {
        assert_eq!(entry.filename, *filename);
        assert_eq!(entry.font.face_index as usize, index);
    }
    assert_eq!(
        fonts::scan_fonts(&root.directory()).unwrap().fonts.len(),
        items[0].fonts.len()
    );
    assert!(fonts::delete_font(&root.directory(), filename).unwrap());
    assert!(
        fonts::scan_fonts(&root.directory())
            .unwrap()
            .fonts
            .is_empty()
    );
}

#[test]
fn reports_invalid_and_unsupported_fonts_while_preserving_successes() {
    let root = TestRoot::new();
    let good = font_bytes(400);
    root.epub(&[
        ("bad.ttf", b"invalid"),
        ("web.WOFF2", b"wOF2"),
        ("good.ttf", &good),
        ("chapter.xhtml", b"text"),
    ]);
    let items = root.extract();
    assert_eq!(items.len(), 3);
    assert_eq!(items[0].status, FontExtractionStatus::Skipped);
    assert_eq!(items[1].status, FontExtractionStatus::Skipped);
    assert!(items[0].reason.is_some());
    assert!(items[1].reason.as_ref().unwrap().contains("WOFF"));
    assert_eq!(items[2].status, FontExtractionStatus::Extracted);
    assert_eq!(fs::read_dir(root.directory()).unwrap().count(), 1);
}

#[test]
fn rejects_invalid_source_files_and_accepts_fontless_archives() {
    let root = TestRoot::new();
    assert!(extract_epub_fonts_at(&root.0, "missing.epub", LIMITS).is_err());
    assert!(extract_epub_fonts_at(&root.0, "test.txt", LIMITS).is_err());
    fs::write(root.0.join("books/test.epub"), b"not a ZIP").unwrap();
    assert!(extract_epub_fonts_at(&root.0, "test.epub", LIMITS).is_err());
    root.epub(&[("chapter.xhtml", b"no fonts")]);
    assert!(root.extract().is_empty());
    root.epub(&[]);
    assert!(root.extract().is_empty());
}

#[test]
fn reads_namespaced_encryption_declarations_and_decodes_uri() {
    let root = TestRoot::new();
    let good = font_bytes(400);
    let xml = r#"<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:e="http://www.w3.org/2001/04/xmlenc#"><e:EncryptedData><e:EncryptionMethod Algorithm="http://www.idpf.org/2008/embedding"/><e:CipherData><e:CipherReference URI="./OEBPS/body%20font.ttf"/></e:CipherData></e:EncryptedData></encryption>"#;
    root.epub(&[
        ("META-INF/encryption.xml", xml.as_bytes()),
        ("OEBPS/body font.ttf", &good),
        ("normal.ttf", &good),
    ]);
    let items = root.extract();
    assert_eq!(items[0].status, FontExtractionStatus::Skipped);
    assert!(items[0].reason.as_ref().unwrap().contains("混淆"));
    assert_eq!(items[1].status, FontExtractionStatus::Extracted);
}

#[test]
fn malformed_encryption_declarations_fail_before_writes() {
    let root = TestRoot::new();
    let good = font_bytes(400);
    for xml in [
        "",
        "<encryption>",
        "<wrong/>",
        "<encryption/><encryption/>",
        "<encryption><CipherReference/></encryption>",
        "<encryption></wrong>",
    ] {
        root.epub(&[
            ("good.ttf", &good),
            ("META-INF/encryption.xml", xml.as_bytes()),
        ]);
        assert!(
            extract_epub_fonts_at(&root.0, "test.epub", LIMITS).is_err(),
            "{xml}"
        );
        assert_eq!(fs::read_dir(root.directory()).unwrap().count(), 0);
    }
}

#[test]
fn applies_single_and_total_decompression_limits() {
    let root = TestRoot::new();
    let good = font_bytes(400);
    let length = good.len() as u64;
    root.epub(&[("one.ttf", &good), ("two.ttf", &good)]);
    let items = extract_epub_fonts_at(
        &root.0,
        "test.epub",
        ExtractionLimits {
            per_font: length - 1,
            total: length * 10,
        },
    )
    .unwrap();
    assert!(
        items
            .iter()
            .all(|item| item.status == FontExtractionStatus::Skipped)
    );
    assert!(items[0].reason.as_ref().unwrap().contains("单文件"));
    let items = extract_epub_fonts_at(
        &root.0,
        "test.epub",
        ExtractionLimits {
            per_font: length,
            total: length,
        },
    )
    .unwrap();
    assert_eq!(items[0].status, FontExtractionStatus::Extracted);
    assert_eq!(items[1].status, FontExtractionStatus::Skipped);
    assert!(items[1].reason.as_ref().unwrap().contains("累计"));
}

#[test]
fn invalid_font_bytes_also_consume_the_total_budget() {
    let root = TestRoot::new();
    let good = font_bytes(400);
    let invalid = vec![0; good.len()];
    root.epub(&[("bad.ttf", &invalid), ("good.ttf", &good)]);
    let items = extract_epub_fonts_at(
        &root.0,
        "test.epub",
        ExtractionLimits {
            per_font: good.len() as u64,
            total: good.len() as u64,
        },
    )
    .unwrap();
    assert_eq!(items[0].status, FontExtractionStatus::Skipped);
    assert_eq!(items[1].status, FontExtractionStatus::Skipped);
    assert!(items[1].reason.as_ref().unwrap().contains("累计"));
}

#[test]
fn validates_windows_filenames_and_archive_paths() {
    let root = TestRoot::new();
    for filename in [
        "",
        ".",
        "..",
        "../a.ttf",
        "a/b.ttf",
        "a\\b.ttf",
        "C:\\a.ttf",
        "C:a.ttf",
        "\\\\server\\a.ttf",
        "file.ttf:stream",
        "CON.ttf",
        "LPT1.ttf",
        "com¹.ttf",
        "trailing.ttf.",
        "trailing.ttf ",
        "a?.ttf",
        "a\0.ttf",
    ] {
        assert!(fonts::validate_filename(filename).is_err(), "{filename:?}");
        assert!(
            fonts::delete_font(&root.directory(), filename).is_err(),
            "{filename:?}"
        );
    }
    assert!(fonts::validate_filename("中文 字体.TTF").is_ok());
    let good = font_bytes(400);
    root.epub(&[
        ("../escape.ttf", &good),
        ("/absolute.ttf", &good),
        ("safe.ttf", &good),
    ]);
    let items = root.extract();
    assert_eq!(items[0].status, FontExtractionStatus::Skipped);
    assert_eq!(items[1].status, FontExtractionStatus::Skipped);
    assert_eq!(items[2].status, FontExtractionStatus::Extracted);
    assert!(!root.0.join("escape.ttf").exists());
}

#[test]
fn scans_manual_files_warns_on_damage_and_does_not_recurse() {
    let root = TestRoot::new();
    let directory = root.directory();
    fs::write(directory.join("手动.TTF"), font_bytes(400)).unwrap();
    fs::write(directory.join("broken.otf"), b"invalid").unwrap();
    fs::write(directory.join("web.woff"), b"wOFF").unwrap();
    fs::write(directory.join("readme.txt"), b"ignore").unwrap();
    fs::create_dir(directory.join("nested")).unwrap();
    fs::write(directory.join("nested/ignored.ttf"), font_bytes(700)).unwrap();
    let scanned = fonts::scan_fonts(&directory).unwrap();
    assert_eq!(scanned.fonts.len(), 1);
    assert_eq!(scanned.fonts[0].filename, "手动.TTF");
    assert_eq!(scanned.warnings.len(), 2);
    assert_eq!(scanned.warnings[0].filename, "broken.otf");
    assert!(fonts::delete_font(&directory, "broken.otf").unwrap());
    assert!(fonts::delete_font(&directory, "readme.txt").is_err());
    assert!(directory.join("readme.txt").exists());
}

#[test]
fn conflicting_file_is_never_overwritten_and_other_fonts_still_extract() {
    let root = TestRoot::new();
    let good = font_bytes(400);
    let other = font_bytes(700);
    let filename = format!("{:x}.ttf", Sha256::digest(&good));
    fs::write(root.directory().join(&filename), b"keep me").unwrap();
    root.epub(&[("conflict.ttf", &good), ("other.ttf", &other)]);
    let items = root.extract();
    assert_eq!(items[0].status, FontExtractionStatus::Failed);
    assert_eq!(items[1].status, FontExtractionStatus::Extracted);
    assert_eq!(
        fs::read(root.directory().join(filename)).unwrap(),
        b"keep me"
    );
    assert_eq!(fs::read_dir(root.directory()).unwrap().count(), 2);
}

#[test]
fn concurrent_extraction_publishes_one_complete_file() {
    let root = TestRoot::new();
    let good = font_bytes(400);
    root.epub(&[("font.ttf", &good)]);
    let workers: Vec<_> = (0..4)
        .map(|_| {
            let path = root.0.clone();
            std::thread::spawn(move || extract_epub_fonts_at(&path, "test.epub", LIMITS).unwrap())
        })
        .collect();
    let statuses: Vec<_> = workers
        .into_iter()
        .map(|worker| worker.join().unwrap().remove(0).status)
        .collect();
    assert_eq!(
        statuses
            .iter()
            .filter(|status| **status == FontExtractionStatus::Extracted)
            .count(),
        1
    );
    assert_eq!(
        statuses
            .iter()
            .filter(|status| **status == FontExtractionStatus::Existing)
            .count(),
        3
    );
    assert_eq!(fs::read_dir(root.directory()).unwrap().count(), 1);
    assert_eq!(fonts::scan_fonts(&root.directory()).unwrap().fonts.len(), 1);
}

#[test]
fn corrupt_zip_entry_is_failed_without_preventing_other_fonts() {
    let root = TestRoot::new();
    let good = font_bytes(400);
    let other = font_bytes(700);
    root.epub(&[("corrupt.ttf", &good), ("valid.ttf", &other)]);
    let path = root.0.join("books/test.epub");
    let mut archive = fs::read(&path).unwrap();
    let start = archive
        .windows(good.len())
        .position(|window| window == good)
        .unwrap();
    archive[start + good.len() - 1] ^= 1;
    fs::write(path, archive).unwrap();
    let items = root.extract();
    assert_eq!(items[0].status, FontExtractionStatus::Failed);
    assert_eq!(items[1].status, FontExtractionStatus::Extracted);
    assert_eq!(fs::read_dir(root.directory()).unwrap().count(), 1);
}

#[test]
fn font_directories_are_not_read_or_deleted_as_files() {
    let root = TestRoot::new();
    let directory = root.directory();
    fs::create_dir(directory.join("folder.ttf")).unwrap();
    fs::write(directory.join("folder.ttf/keep.txt"), b"keep").unwrap();
    assert!(fonts::delete_font(&directory, "folder.ttf").is_err());
    assert!(fonts::scan_fonts(&directory).unwrap().fonts.is_empty());
    assert!(directory.join("folder.ttf/keep.txt").exists());
}

#[test]
fn command_serialization_keeps_flat_snake_case_metadata() {
    let root = TestRoot::new();
    root.epub(&[("font.ttf", &font_bytes(400))]);
    let value = serde_json::to_value(root.extract()).unwrap();
    assert_eq!(value[0]["status"], "extracted");
    assert_eq!(value[0]["source_path"], "font.ttf");
    assert!(value[0]["fonts"][0]["display_family"].is_string());
    assert_eq!(value[0]["fonts"][0]["face_index"], 0);
    assert!(value[0]["fonts"][0].get("font").is_none());
}

#[cfg(target_os = "windows")]
#[test]
fn reports_windows_file_sharing_error_and_allows_retry() {
    use std::os::windows::fs::OpenOptionsExt;
    let root = TestRoot::new();
    let directory = root.directory();
    let path = directory.join("locked.ttf");
    fs::write(&path, font_bytes(400)).unwrap();
    let locked = fs::OpenOptions::new()
        .read(true)
        .share_mode(0)
        .open(&path)
        .unwrap();
    let result = fonts::delete_font(&directory, "locked.ttf");
    assert!(result.is_err());
    assert!(path.exists());
    drop(locked);
    assert!(fonts::delete_font(&directory, "locked.ttf").unwrap());
}

#[test]
fn unavailable_font_directory_is_a_command_error() {
    let root = TestRoot::new();
    root.epub(&[("font.ttf", &font_bytes(400))]);
    fs::write(root.0.join("fonts"), b"not a directory").unwrap();
    assert!(extract_epub_fonts_at(&root.0, "test.epub", LIMITS).is_err());
    assert_eq!(fs::read(root.0.join("fonts")).unwrap(), b"not a directory");
}

#[test]
fn skips_zip_encrypted_entries_without_reading_payload() {
    let root = TestRoot::new();
    root.epub(&[("encrypted.ttf", &font_bytes(400))]);
    let path = root.0.join("books/test.epub");
    let mut archive = fs::read(&path).unwrap();
    let central = archive
        .windows(4)
        .position(|window| window == b"PK\x01\x02")
        .unwrap();
    archive[6] |= 1;
    archive[central + 8] |= 1;
    fs::write(path, archive).unwrap();
    let items = root.extract();
    assert_eq!(items[0].status, FontExtractionStatus::Skipped);
    assert!(items[0].reason.as_ref().unwrap().contains("已加密"));
    assert_eq!(fs::read_dir(root.directory()).unwrap().count(), 0);
}

#[cfg(target_os = "windows")]
#[test]
#[ignore = "需要 Windows 开发者模式或 SeCreateSymbolicLinkPrivilege；使用 --ignored 单独运行"]
fn rejects_symbolic_links_for_fonts_and_book_directories() {
    use std::os::windows::fs::{symlink_dir, symlink_file};
    let root = TestRoot::new();
    let outside = TestRoot::new();
    let target = outside.0.join("font.ttf");
    fs::write(&target, font_bytes(400)).unwrap();
    let directory = root.directory();
    let link = directory.join("linked.ttf");
    symlink_file(&target, &link).expect("需要 Windows 符号链接创建权限");
    assert!(fonts::open_regular_file(&directory, "linked.ttf").is_err());
    assert!(fonts::delete_font(&directory, "linked.ttf").is_err());
    let scanned = fonts::scan_fonts(&directory).unwrap();
    assert!(scanned.fonts.is_empty());
    assert_eq!(scanned.warnings.len(), 1);
    fs::remove_file(link).unwrap();
    fs::remove_dir(&directory).unwrap();
    symlink_dir(&outside.0, &directory).unwrap();
    assert!(fonts::prepare_fonts_dir(&root.0).is_err());
    fs::remove_dir(&directory).unwrap();
    fs::remove_dir(root.0.join("books")).unwrap();
    symlink_dir(&outside.0, root.0.join("books")).unwrap();
    assert!(fonts::books_dir(&root.0).is_err());
    fs::remove_dir(root.0.join("books")).unwrap();
    assert!(target.exists());
}
