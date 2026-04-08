use crate::entities::ProxyPrepareResult;

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

#[cfg(target_os = "windows")]
fn read_windows_system_proxy() -> Option<String> {
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
    normalize_proxy_url(&server)
}

pub fn detect_updater_proxy() -> ProxyPrepareResult {
    if let Some(proxy_url) = first_non_empty_env(&[
        "HTTPS_PROXY",
        "https_proxy",
        "HTTP_PROXY",
        "http_proxy",
        "ALL_PROXY",
        "all_proxy",
    ]) {
        return ProxyPrepareResult {
            enabled: true,
            source: "environment".to_string(),
            proxy_mode: "environment".to_string(),
            proxy_url: Some(proxy_url),
        };
    }

    #[cfg(target_os = "windows")]
    if let Some(proxy_url) = read_windows_system_proxy() {
        return ProxyPrepareResult {
            enabled: true,
            source: "system".to_string(),
            proxy_mode: "system".to_string(),
            proxy_url: Some(proxy_url),
        };
    }

    ProxyPrepareResult {
        enabled: false,
        source: "none".to_string(),
        proxy_mode: "direct".to_string(),
        proxy_url: None,
    }
}
