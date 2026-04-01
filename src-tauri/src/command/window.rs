use serde::Serialize;
use serde_json::{json, Value};
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Mutex,
};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

const READER_LABEL: &str = "reader";
const LOAD_BOOK_EVENT: &str = "load-book-key";
const OPEN_TIMEOUT_MS: u64 = 7000;
const ACK_RETRY_WAIT_MS: u64 = 1800;
const ACK_RETRY_LIMIT: u8 = 1;

static READER_MESSAGE_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Clone)]
struct PendingLoadMessage {
    book_key: String,
    cfi: String,
    message_id: String,
}

#[derive(Default)]
struct ReaderWindowRuntime {
    is_ready: bool,
    pending_load: Option<PendingLoadMessage>,
    awaiting_message_id: Option<String>,
    last_acked_message_id: Option<String>,
    last_seen_at: u64,
}

#[derive(Default)]
pub struct ReaderWindowState {
    inner: Mutex<ReaderWindowRuntime>,
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

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn next_reader_message_id() -> String {
    let sequence = READER_MESSAGE_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("reader-message-{}-{}", now_millis(), sequence)
}

fn reset_runtime(runtime: &mut ReaderWindowRuntime) {
    runtime.is_ready = false;
    runtime.pending_load = None;
    runtime.awaiting_message_id = None;
    runtime.last_seen_at = now_millis();
}

fn emit_pending_load(app: &AppHandle, payload: &PendingLoadMessage) -> Result<(), String> {
    app.emit_to(
        READER_LABEL,
        LOAD_BOOK_EVENT,
        json!({
            "bookKey": payload.book_key,
            "cfi": payload.cfi,
            "messageId": payload.message_id,
        }),
    )
    .map_err(|error| format!("failed to emit pending load event: {:?}", error))
}

fn ensure_reader_window_exists(
    app: &AppHandle,
    state: &State<'_, ReaderWindowState>,
) -> Result<bool, String> {
    if app.get_webview_window(READER_LABEL).is_some() {
        return Ok(false);
    }

    WebviewWindowBuilder::new(
        app,
        READER_LABEL,
        WebviewUrl::App("reader.html".into()),
    )
    .title("阅读")
    .decorations(false)
    .min_inner_size(880.0, 660.0)
    .build()
    .map_err(|error| format!("failed to create reader window: {:?}", error))?;

    let mut runtime = state
        .inner
        .lock()
        .map_err(|_| "failed to lock reader window state".to_string())?;
    runtime.is_ready = false;
    runtime.last_seen_at = now_millis();

    Ok(true)
}

async fn wait_reader_load_ack(
    app: &AppHandle,
    state: &State<'_, ReaderWindowState>,
) -> Result<bool, String> {
    let start = Instant::now();
    let timeout = Duration::from_millis(OPEN_TIMEOUT_MS);
    let retry_interval = Duration::from_millis(ACK_RETRY_WAIT_MS);
    let mut last_emit_at: Option<Instant> = None;
    let mut retry_count: u8 = 0;

    loop {
        if start.elapsed() >= timeout {
            return Err("reader 初始化超时，未收到加载确认".to_string());
        }

        if app.get_webview_window(READER_LABEL).is_none() {
            let mut runtime = state
                .inner
                .lock()
                .map_err(|_| "failed to lock reader window state".to_string())?;
            reset_runtime(&mut runtime);
            return Err("reader 窗口不可用".to_string());
        }

        let mut next_emit: Option<PendingLoadMessage> = None;
        {
            let runtime = state
                .inner
                .lock()
                .map_err(|_| "failed to lock reader window state".to_string())?;

            if runtime.awaiting_message_id.is_none() {
                return Ok(true);
            }

            if !runtime.is_ready {
                // Reader 窗口尚未就绪，继续等待 ready 信号。
            } else if last_emit_at.is_none() {
                next_emit = runtime.pending_load.clone();
            } else if let Some(last_sent) = last_emit_at {
                if last_sent.elapsed() >= retry_interval {
                    if retry_count >= ACK_RETRY_LIMIT {
                        return Err("reader 未确认书籍加载消息".to_string());
                    }
                    retry_count += 1;
                    next_emit = runtime.pending_load.clone();
                }
            }
        }

        if let Some(payload) = next_emit {
            emit_pending_load(app, &payload)?;
            last_emit_at = Some(Instant::now());
        }

        thread::sleep(Duration::from_millis(120));
    }
}

#[tauri::command]
pub async fn open_reader_window(
    app: AppHandle,
    state: State<'_, ReaderWindowState>,
    book_key: String,
    cfi: Option<String>,
) -> Result<OpenReaderWindowResult, String> {
    let created = ensure_reader_window_exists(&app, &state)?;
    let message_id = next_reader_message_id();

    {
        let mut runtime = state
            .inner
            .lock()
            .map_err(|_| "failed to lock reader window state".to_string())?;
        runtime.pending_load = Some(PendingLoadMessage {
            book_key,
            cfi: cfi.unwrap_or_default(),
            message_id: message_id.clone(),
        });
        runtime.awaiting_message_id = Some(message_id.clone());
        runtime.last_seen_at = now_millis();
    }

    let acknowledged = wait_reader_load_ack(&app, &state).await?;

    Ok(OpenReaderWindowResult {
        created,
        acknowledged,
        message_id,
    })
}

#[tauri::command]
pub fn reader_window_ready(state: State<'_, ReaderWindowState>) -> Result<(), String> {
    let mut runtime = state
        .inner
        .lock()
        .map_err(|_| "failed to lock reader window state".to_string())?;
    runtime.is_ready = true;
    runtime.last_seen_at = now_millis();
    Ok(())
}

#[tauri::command]
pub fn ack_reader_load(
    state: State<'_, ReaderWindowState>,
    message_id: String,
) -> Result<(), String> {
    let mut runtime = state
        .inner
        .lock()
        .map_err(|_| "failed to lock reader window state".to_string())?;

    runtime.last_seen_at = now_millis();

    if runtime.awaiting_message_id.as_deref() == Some(message_id.as_str()) {
        runtime.awaiting_message_id = None;
        runtime.pending_load = None;
        runtime.last_acked_message_id = Some(message_id);
    }

    Ok(())
}

#[tauri::command]
pub fn close_reader_window(
    app: AppHandle,
    state: State<'_, ReaderWindowState>,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(READER_LABEL) {
        window
            .close()
            .map_err(|error| format!("failed to close reader window: {:?}", error))?;
    }

    let mut runtime = state
        .inner
        .lock()
        .map_err(|_| "failed to lock reader window state".to_string())?;
    reset_runtime(&mut runtime);

    Ok(())
}

#[tauri::command]
pub fn dispatch_reader_event(
    app: AppHandle,
    state: State<'_, ReaderWindowState>,
    event_name: String,
    payload: Option<Value>,
) -> Result<DispatchReaderEventResult, String> {
    if app.get_webview_window(READER_LABEL).is_none() {
        let mut runtime = state
            .inner
            .lock()
            .map_err(|_| "failed to lock reader window state".to_string())?;
        reset_runtime(&mut runtime);
        return Ok(DispatchReaderEventResult { delivered: false });
    }

    let is_ready = {
        let runtime = state
            .inner
            .lock()
            .map_err(|_| "failed to lock reader window state".to_string())?;
        runtime.is_ready
    };

    if !is_ready {
        return Ok(DispatchReaderEventResult { delivered: false });
    }

    app.emit_to(
        READER_LABEL,
        event_name.as_str(),
        payload.unwrap_or_else(|| json!({})),
    )
    .map_err(|error| format!("failed to dispatch reader event: {:?}", error))?;

    Ok(DispatchReaderEventResult { delivered: true })
}
