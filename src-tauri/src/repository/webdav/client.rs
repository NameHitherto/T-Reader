use reqwest::Client;
use std::time::Duration;

use crate::{
    repository::system::proxy_repository::resolve_request_proxy_url,
    utils::logging::log_info,
};

/// 构建 WebDAV HTTP 客户端，超时时间（秒）来自用户配置。
/// 低于 1 秒的配置按 1 秒处理，避免无意义的请求直接超时。
/// proxy_enabled 为 true 时应用检测到的系统代理，否则强制直连。
pub fn build_webdav_client(timeout_seconds: i64, proxy_enabled: bool) -> Client {
    let timeout = Duration::from_secs(timeout_seconds.max(1) as u64);
    let mut builder = Client::builder().timeout(timeout);

    match resolve_request_proxy_url(proxy_enabled) {
        Some(proxy_url) => {
            if let Ok(reqwest_proxy) = reqwest::Proxy::all(&proxy_url) {
                log_info("webdav", &format!("using-proxy url={}", proxy_url));
                builder = builder.proxy(reqwest_proxy);
            }
        }
        None => {
            builder = builder.no_proxy();
        }
    }

    builder.build().unwrap_or_else(|_| Client::new())
}
