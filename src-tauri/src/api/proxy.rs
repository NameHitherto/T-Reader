use crate::{entities::SystemProxyInfo, repository::system::proxy_repository};

/// 检测当前系统代理配置（环境变量优先，其次系统设置），用于设置页只读展示。
#[tauri::command]
pub fn detect_system_proxy() -> Result<SystemProxyInfo, String> {
    Ok(proxy_repository::detect_system_proxy())
}
