use serde::Serialize;

/// 系统代理检测结果，用于设置页只读展示与请求代理应用。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemProxyInfo {
    /// 是否检测到可用代理
    pub enabled: bool,
    /// 检测来源："environment" | "system" | "none"
    pub source: String,
    /// 代理类型（由 URL scheme 推导，大写），如 "HTTP" / "HTTPS" / "SOCKS5"
    pub proxy_type: Option<String>,
    /// 代理服务器地址
    pub host: Option<String>,
    /// 代理端口
    pub port: Option<u16>,
    /// 排除列表（绕过代理的地址），原文返回
    pub bypass_list: Option<String>,
    /// 归一化后的完整代理 URL（供 reqwest 使用）
    pub proxy_url: Option<String>,
}

impl SystemProxyInfo {
    pub fn none() -> Self {
        Self {
            enabled: false,
            source: "none".to_string(),
            proxy_type: None,
            host: None,
            port: None,
            bypass_list: None,
            proxy_url: None,
        }
    }
}
