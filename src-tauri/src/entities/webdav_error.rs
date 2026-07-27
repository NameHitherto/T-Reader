use serde::Serialize;
use std::fmt;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebDavError {
    /// HTTP 状态码（网络错误时为 0）
    pub status_code: u16,
    /// 操作类型：delete / upload / download / exists / list
    pub operation: String,
    /// 资源路径
    pub resource: String,
    /// 原始错误信息
    pub message: String,
}

impl fmt::Display for WebDavError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.message)
    }
}
