use log::info;
use serde_json::{json, Value};
use std::{
    sync::atomic::{AtomicU64, Ordering},
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

use crate::{
    entities::{
        DispatchReaderEventResult, OpenReaderWindowResult, PendingLoadMessage, ReaderWindowRuntime,
        ReaderWindowState,
    },
    utils::time::now_millis,
};

const READER_LABEL: &str = "reader";
const MAIN_LABEL: &str = "main";
const LOAD_BOOK_EVENT: &str = "load-book-key";
const OPEN_TIMEOUT_MS: u64 = 7000;
const ACK_RETRY_WAIT_MS: u64 = 1800;
const ACK_RETRY_LIMIT: u8 = 1;

static READER_MESSAGE_COUNTER: AtomicU64 = AtomicU64::new(1);

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

    info!("[reader][window] 阅读器窗口创建中");

    let app_handle = app.clone();
    let window =
        WebviewWindowBuilder::new(app, READER_LABEL, WebviewUrl::App("reader.html".into()))
            .title("阅读")
            .decorations(false)
            .min_inner_size(880.0, 660.0)
            .build()
            .map_err(|error| format!("failed to create reader window: {:?}", error))?;

    window.on_window_event(move |event| {
        use tauri::WindowEvent;
        if let WindowEvent::CloseRequested { .. } = event {
            if let Some(state) = app_handle.try_state::<crate::entities::ReaderWindowState>() {
                if let Ok(mut runtime) = state.inner.lock() {
                    reset_runtime(&mut runtime);
                }
            }
            info!("[reader][window] 阅读器窗口收到关闭请求，重置运行时状态");
        }
        if let WindowEvent::Destroyed = event {
            info!("[reader][window] 阅读器窗口已销毁");
        }
    });

    let mut runtime = state
        .inner
        .lock()
        .map_err(|_| "failed to lock reader window state".to_string())?;
    runtime.is_ready = false;
    runtime.last_seen_at = now_millis();

    info!(
        "[reader][window] 阅读器窗口创建成功 (标签={}, 尺寸=880x660)",
        READER_LABEL
    );

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

pub async fn open_reader_window(
    app: AppHandle,
    state: State<'_, ReaderWindowState>,
    book_key: String,
    cfi: Option<String>,
) -> Result<OpenReaderWindowResult, String> {
    let created = ensure_reader_window_exists(&app, &state)?;
    let message_id = next_reader_message_id();
    let book_key_for_log = book_key.clone();

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

    info!(
        "[reader][window] 打开阅读器窗口 (bookKey={}, created={})",
        book_key_for_log, created
    );
    let acknowledged = wait_reader_load_ack(&app, &state).await?;

    Ok(OpenReaderWindowResult {
        created,
        acknowledged,
        message_id,
    })
}

pub fn reader_window_ready(state: State<'_, ReaderWindowState>) -> Result<(), String> {
    let mut runtime = state
        .inner
        .lock()
        .map_err(|_| "failed to lock reader window state".to_string())?;
    runtime.is_ready = true;
    runtime.last_seen_at = now_millis();

    info!("[reader][window] 阅读器前端就绪");
    Ok(())
}

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
        runtime.last_acked_message_id = Some(message_id.clone());
    }

    info!(
        "[reader][window] 阅读器确认书籍加载 (messageId={})",
        message_id
    );

    Ok(())
}

pub fn close_reader_window(
    app: AppHandle,
    state: State<'_, ReaderWindowState>,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(READER_LABEL) {
        window
            .close()
            .map_err(|error| format!("failed to close reader window: {:?}", error))?;
    }
    info!("[reader][window] 阅读器窗口关闭命令已执行");

    let mut runtime = state
        .inner
        .lock()
        .map_err(|_| "failed to lock reader window state".to_string())?;
    reset_runtime(&mut runtime);

    Ok(())
}

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

pub fn dispatch_main_event(
    app: AppHandle,
    event_name: String,
    payload: Option<Value>,
) -> Result<DispatchReaderEventResult, String> {
    if app.get_webview_window(MAIN_LABEL).is_none() {
        return Ok(DispatchReaderEventResult { delivered: false });
    }

    app.emit_to(
        MAIN_LABEL,
        event_name.as_str(),
        payload.unwrap_or_else(|| json!({})),
    )
    .map_err(|error| format!("failed to dispatch main event: {:?}", error))?;

    info!("[main][window] 分发事件到主窗口完成 (event={})", event_name);
    Ok(DispatchReaderEventResult { delivered: true })
}
