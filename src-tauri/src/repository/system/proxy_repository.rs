use crate::entities::{ProxyPrepareResult, SystemProxyInfo};

fn first_non_empty_env(keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| std::env::var(key).ok())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn normalize_proxy_url(raw: &str) -> Option<String> {
    let value = raw.trim();
    if value.is_empty() {
        return None;
    }

    let first = value
        .split(';')
        .map(str::trim)
        .find(|item| !item.is_empty())?;

    let mut endpoint = first;
    if let Some((_, rhs)) = first.split_once('=') {
        endpoint = rhs.trim();
    }

    if endpoint.is_empty() {
        return None;
    }

    if endpoint.contains("://") {
        Some(endpoint.to_string())
    } else {
        Some(format!("http://{}", endpoint))
    }
}

fn normalize_bypass_list(raw: Option<String>) -> Option<String> {
    raw.map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn proxy_type_from_scheme(scheme: &str) -> String {
    match scheme.to_ascii_lowercase().as_str() {
        "http" => "HTTP".to_string(),
        "https" => "HTTPS".to_string(),
        "socks5" | "socks5h" => "SOCKS5".to_string(),
        "socks4" | "socks4a" => "SOCKS4".to_string(),
        other => other.to_uppercase(),
    }
}

/// 把归一化后的代理 URL 拆解为 (类型, 主机, 端口)。
/// 解析失败时退回原始字符串，类型/host/port 留空。
fn parse_proxy_endpoint(proxy_url: &str) -> (Option<String>, Option<String>, Option<u16>) {
    let Ok(url) = reqwest::Url::parse(proxy_url) else {
        return (None, None, None);
    };

    let proxy_type = Some(proxy_type_from_scheme(url.scheme()));
    let host = url.host_str().map(|value| value.to_string());
    let port = url.port_or_known_default();

    (proxy_type, host, port)
}

fn build_proxy_info(source: &str, proxy_url: String, bypass_list: Option<String>) -> SystemProxyInfo {
    let (proxy_type, host, port) = parse_proxy_endpoint(&proxy_url);
    SystemProxyInfo {
        enabled: true,
        source: source.to_string(),
        proxy_type,
        host,
        port,
        bypass_list,
        proxy_url: Some(proxy_url),
    }
}

#[cfg(target_os = "windows")]
fn read_windows_system_proxy() -> Option<(String, Option<String>)> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let internet = hkcu
        .open_subkey("Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings")
        .ok()?;

    let enabled: u32 = internet.get_value("ProxyEnable").unwrap_or(0);
    if enabled == 0 {
        return None;
    }

    let server: String = internet.get_value("ProxyServer").ok()?;
    let proxy_url = normalize_proxy_url(&server)?;
    let bypass_list = normalize_bypass_list(internet.get_value("ProxyOverride").ok());

    Some((proxy_url, bypass_list))
}

/// 检测当前系统代理配置（环境变量优先，其次 Windows 注册表）。
pub fn detect_system_proxy() -> SystemProxyInfo {
    if let Some(proxy_url) = first_non_empty_env(&[
        "HTTPS_PROXY",
        "https_proxy",
        "HTTP_PROXY",
        "http_proxy",
        "ALL_PROXY",
        "all_proxy",
    ]) {
        let bypass_list =
            normalize_bypass_list(first_non_empty_env(&["NO_PROXY", "no_proxy"]));
        return build_proxy_info("environment", proxy_url, bypass_list);
    }

    #[cfg(target_os = "windows")]
    if let Some((proxy_url, bypass_list)) = read_windows_system_proxy() {
        return build_proxy_info("system", proxy_url, bypass_list);
    }

    SystemProxyInfo::none()
}

/// 开关关闭时返回 None（直连）；开启时返回检测到的代理 URL。
pub fn resolve_request_proxy_url(proxy_enabled: bool) -> Option<String> {
    if !proxy_enabled {
        return None;
    }
    detect_system_proxy().proxy_url
}

/// 兼容旧接口：更新器用的代理预检测结果。
pub fn detect_updater_proxy() -> ProxyPrepareResult {
    let info = detect_system_proxy();
    match info.proxy_url {
        Some(proxy_url) => ProxyPrepareResult {
            enabled: true,
            proxy_mode: info.source.clone(),
            source: info.source,
            proxy_url: Some(proxy_url),
        },
        None => ProxyPrepareResult {
            enabled: false,
            source: "none".to_string(),
            proxy_mode: "direct".to_string(),
            proxy_url: None,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::{normalize_bypass_list, normalize_proxy_url, parse_proxy_endpoint};

    #[test]
    fn normalize_proxy_url_adds_default_scheme() {
        assert_eq!(
            normalize_proxy_url("127.0.0.1:10808"),
            Some("http://127.0.0.1:10808".to_string())
        );
    }

    #[test]
    fn normalize_proxy_url_handles_per_protocol_form() {
        assert_eq!(
            normalize_proxy_url("http=127.0.0.1:10808;https=127.0.0.1:10808"),
            Some("http://127.0.0.1:10808".to_string())
        );
    }

    #[test]
    fn normalize_proxy_url_keeps_existing_scheme() {
        assert_eq!(
            normalize_proxy_url("socks5://127.0.0.1:1080"),
            Some("socks5://127.0.0.1:1080".to_string())
        );
    }

    #[test]
    fn parse_proxy_endpoint_extracts_http_parts() {
        let (proxy_type, host, port) = parse_proxy_endpoint("http://127.0.0.1:10808");
        assert_eq!(proxy_type, Some("HTTP".to_string()));
        assert_eq!(host, Some("127.0.0.1".to_string()));
        assert_eq!(port, Some(10808));
    }

    #[test]
    fn parse_proxy_endpoint_extracts_socks5_type() {
        let (proxy_type, host, port) = parse_proxy_endpoint("socks5://proxy.local:1080");
        assert_eq!(proxy_type, Some("SOCKS5".to_string()));
        assert_eq!(host, Some("proxy.local".to_string()));
        assert_eq!(port, Some(1080));
    }

    #[test]
    fn parse_proxy_endpoint_uses_default_port() {
        let (_, _, port) = parse_proxy_endpoint("http://proxy.local");
        assert_eq!(port, Some(80));
    }

    #[test]
    fn parse_proxy_endpoint_handles_invalid_url() {
        let (proxy_type, host, port) = parse_proxy_endpoint("not a url");
        assert_eq!(proxy_type, None);
        assert_eq!(host, None);
        assert_eq!(port, None);
    }

    #[test]
    fn normalize_bypass_list_trims_and_filters_empty() {
        assert_eq!(
            normalize_bypass_list(Some(" localhost;127.* ".to_string())),
            Some("localhost;127.*".to_string())
        );
        assert_eq!(normalize_bypass_list(Some("   ".to_string())), None);
        assert_eq!(normalize_bypass_list(None), None);
    }
}
