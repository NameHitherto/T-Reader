use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum CloudSyncBookStatus {
    Normal,
    Upload,
    Download,
}

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum CloudSyncBookAction {
    Upload,
    Download,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudSyncPreviewItem {
    pub file_name: String,
    pub local_exists: bool,
    pub cloud_exists: bool,
    pub status: CloudSyncBookStatus,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudSyncPreviewResult {
    pub book_items: Vec<CloudSyncPreviewItem>,
    pub normal_count: usize,
    pub upload_count: usize,
    pub download_count: usize,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudSyncBookSelection {
    pub file_name: String,
    pub action: CloudSyncBookAction,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudSyncApplyRequest {
    pub book_selections: Vec<CloudSyncBookSelection>,
}

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudSyncApplyResult {
    pub uploaded_book_count: usize,
    pub downloaded_book_count: usize,
    pub uploaded_config_count: usize,
    pub downloaded_config_count: usize,
    pub replaced_config_count: usize,
    pub skipped_count: usize,
}

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReconcileProgressConfigsResult {
    /// 从云端拉取并写回本地的进度配置文件名
    pub pulled_files: Vec<String>,
    /// 本地较新、上传到云端的进度配置文件名
    pub pushed_files: Vec<String>,
    /// 云端已删除、本地同步清理的进度配置文件名（预留）
    pub removed_files: Vec<String>,
    /// 无变化的进度配置数量
    pub unchanged_count: usize,
}
