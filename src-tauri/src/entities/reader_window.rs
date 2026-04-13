use serde::Serialize;
use std::sync::Mutex;

#[derive(Clone)]
pub struct PendingLoadMessage {
    pub book_key: String,
    pub cfi: String,
    pub message_id: String,
}

#[derive(Default)]
pub struct ReaderWindowRuntime {
    pub is_ready: bool,
    pub pending_load: Option<PendingLoadMessage>,
    pub awaiting_message_id: Option<String>,
    pub last_acked_message_id: Option<String>,
    pub last_seen_at: u64,
}

#[derive(Default)]
pub struct ReaderWindowState {
    pub inner: Mutex<ReaderWindowRuntime>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenReaderWindowResult {
    pub created: bool,
    pub acknowledged: bool,
    pub message_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DispatchReaderEventResult {
    pub delivered: bool,
}
