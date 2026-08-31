use reqwest::Client;
use std::sync::Mutex;
use std::time::Duration;

use crate::{
    repository::system::proxy_repository::resolve_request_proxy_url,
    utils::logging::log_info,
};

/// 进程级缓存的 WebDAV 客户端，键为 (timeout_seconds, proxy_enabled)。
/// reqwest::Client 内部共享连接池，复用可避免为每个文件重复建立连接。
static CLIENT_CACHE: Mutex<Option<(i64, bool, Client)>> = Mutex::new(None);

/// 构建 WebDAV HTTP 客户端，超时时间（秒）来自用户配置。
/// 低于 1 秒的配置按 1 秒处理，避免无意义的请求直接超时。
/// proxy_enabled 为 true 时应用检测到的系统代理，否则强制直连。
/// 当超时或代理配置未变化时复用缓存的客户端，否则重建。
pub fn build_webdav_client(timeout_seconds: i64, proxy_enabled: bool) -> Client {
    if let Ok(guard) = CLIENT_CACHE.lock() {
        if let Some((cached_timeout, cached_proxy, cached_client)) = guard.as_ref() {
            if *cached_timeout == timeout_seconds && *cached_proxy == proxy_enabled {
                return cached_client.clone();
            }
        }
    }

    let client = build_client(timeout_seconds, proxy_enabled);
    if let Ok(mut guard) = CLIENT_CACHE.lock() {
        *guard = Some((timeout_seconds, proxy_enabled, client.clone()));
    }
    client
}

fn build_client(timeout_seconds: i64, proxy_enabled: bool) -> Client {
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
