use reqwest::Client;
use std::time::Duration;

/// 构建 WebDAV HTTP 客户端，超时时间（秒）来自用户配置。
/// 低于 1 秒的配置按 1 秒处理，避免无意义的请求直接超时。
pub fn build_webdav_client(timeout_seconds: i64) -> Client {
    let timeout = Duration::from_secs(timeout_seconds.max(1) as u64);
    Client::builder()
        .timeout(timeout)
        .build()
        .unwrap_or_else(|_| Client::new())
}
