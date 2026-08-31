use sha2::{Digest, Sha256};

const INVALID_FILENAME_CHARS: [char; 9] = ['<', '>', ':', '"', '/', '\\', '|', '?', '*'];

fn normalize_book_identity_part(value: Option<&str>, fallback: &str) -> String {
    let replaced: String = value
        .unwrap_or_default()
        .chars()
        .map(|ch| {
            if ch.is_control() || INVALID_FILENAME_CHARS.contains(&ch) {
                '_'
            } else {
                ch
            }
        })
        .collect();

    let normalized = replaced.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.is_empty() {
        fallback.to_string()
    } else {
        normalized
    }
}

pub fn build_book_title(title: Option<&str>) -> String {
    normalize_book_identity_part(title, "untitled")
}

pub fn build_book_key(title: Option<&str>, author: Option<&str>) -> String {
    let title = normalize_book_identity_part(title, "untitled");
    let author = normalize_book_identity_part(author, "unknown");

    format!("{}_{}", title, author)
}

/// 缓存目录名使用 SHA-256 前 8 字节（16 位十六进制）缩短后的哈希，
/// 在保证书籍库场景下碰撞概率可忽略的同时避免目录名过长。
const HASH_BYTE_LEN: usize = 8;

pub fn hash_book_key(book_key: &str) -> String {
    let digest = Sha256::digest(book_key.as_bytes());
    digest[..HASH_BYTE_LEN]
        .iter()
        .map(|byte| format!("{:02x}", byte))
        .collect()
}
