use crate::utils::logging::log_info;
use serde_json::{json, Value};
use std::{
    sync::atomic::{AtomicU64, Ordering},
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

use crate::{
    entities::{
        DispatchReaderEventResult, OpenReaderWindowResult, PendingBookDeleteMessage,
        PendingLoadMessage, PrepareReaderBookDeleteResult, ReaderWindowRuntime, ReaderWindowState,
    },
    utils::time::now_millis,
};

const READER_LABEL: &str = "reader";
const MAIN_LABEL: &str = "main";
const LOAD_BOOK_EVENT: &str = "load-book-key";
const READER_WINDOW_HIDE_EVENT: &str = "reader-window-hide";
const PREPARE_BOOK_DELETE_EVENT: &str = "prepare-book-delete";
const OPEN_TIMEOUT_MS: u64 = 7000;
const BOOK_DELETE_TIMEOUT_MS: u64 = 7000;
const ACK_RETRY_WAIT_MS: u64 = 1800;
const ACK_RETRY_LIMIT: u8 = 1;
const MIN_WINDOW_WIDTH: f64 = 880.0;
const MIN_WINDOW_HEIGHT: f64 = 660.0;
const INITIAL_WINDOW_WIDTH: f64 = 1280.0;
const INITIAL_WINDOW_HEIGHT: f64 = 960.0;

static READER_MESSAGE_COUNTER: AtomicU64 = AtomicU64::new(1);

fn next_reader_message_id() -> String {
    let sequence = READER_MESSAGE_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("reader-message-{}-{}", now_millis(), sequence)
}

/// 启动时预创建 reader 窗口（隐藏状态），生命周期贯穿整个应用会话。
pub fn precreate_reader_window(app: &AppHandle) -> Result<(), String> {
    log_info("window", "reader-window-precreating");

    let window =
        WebviewWindowBuilder::new(app, READER_LABEL, WebviewUrl::App("reader.html".into()))
            .title("阅读")
            .decorations(false)
            .min_inner_size(MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT)
            .inner_size(INITIAL_WINDOW_WIDTH, INITIAL_WINDOW_HEIGHT)
            .focused(false)
            .visible(false)
            .build()
            .map_err(|error| format!("failed to pre-create reader window: {:?}", error))?;

    window.on_window_event(move |event| {
        if let tauri::WindowEvent::Destroyed = event {
            log_info("window", "reader-window-destroyed");
        }
    });

    log_info("window", "reader-window-precreate-done");
    Ok(())
}

fn reset_runtime(runtime: &mut ReaderWindowRuntime) {
    runtime.is_ready = false;
    runtime.pending_load = None;
    runtime.awaiting_message_id = None;
    runtime.pending_book_delete = None;
    runtime.awaiting_book_delete_message_id = None;
    runtime.last_book_delete_affected = None;
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

fn emit_pending_book_delete(
    app: &AppHandle,
    payload: &PendingBookDeleteMessage,
) -> Result<(), String> {
    app.emit_to(
        READER_LABEL,
        PREPARE_BOOK_DELETE_EVENT,
        json!({
            "bookKey": payload.book_key,
            "messageId": payload.message_id,
        }),
    )
    .map_err(|error| format!("failed to emit reader book delete event: {:?}", error))
}

fn ensure_reader_window_exists(
    app: &AppHandle,
    state: &State<'_, ReaderWindowState>,
) -> Result<bool, String> {
    if app.get_webview_window(READER_LABEL).is_some() {
        // 窗口已存在，确保可见
        if let Some(window) = app.get_webview_window(READER_LABEL) {
            let visible = window
                .is_visible()
                .map_err(|e| format!("检查窗口可见性失败: {:?}", e))?;
            if !visible {
                window
                    .show()
                    .map_err(|e| format!("显示阅读器窗口失败: {:?}", e))?;
                window
                    .set_focus()
                    .map_err(|e| format!("聚焦阅读器窗口失败: {:?}", e))?;
                log_info("window", "reader-window-shown");
            } else {
                window
                    .set_focus()
                    .map_err(|e| format!("聚焦阅读器窗口失败: {:?}", e))?;
            }
        }
        return Ok(false);
    }

    // 兜底：窗口被意外销毁后重新创建
    log_info("window", "reader-window-recreating");

    let app_handle = app.clone();
    let window =
        WebviewWindowBuilder::new(app, READER_LABEL, WebviewUrl::App("reader.html".into()))
            .title("阅读")
            .decorations(false)
            .min_inner_size(MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT)
            .inner_size(INITIAL_WINDOW_WIDTH, INITIAL_WINDOW_HEIGHT)
            .build()
            .map_err(|error| format!("failed to create reader window: {:?}", error))?;
    window
        .set_focus()
        .map_err(|error| format!("failed to focus reader window: {:?}", error))?;

    window.on_window_event(move |event| {
        use tauri::WindowEvent;
        if let WindowEvent::CloseRequested { .. } = event {
            if let Some(state) = app_handle.try_state::<crate::entities::ReaderWindowState>() {
                if let Ok(mut runtime) = state.inner.lock() {
                    reset_runtime(&mut runtime);
                }
            }
            log_info("window", "reader-window-close-requested");
        }
        if let WindowEvent::Destroyed = event {
            log_info("window", "reader-window-destroyed");
        }
    });

    let mut runtime = state
        .inner
        .lock()
        .map_err(|_| "failed to lock reader window state".to_string())?;
    runtime.is_ready = false;
    runtime.last_seen_at = now_millis();

    log_info(
        "window",
        &format!("reader-window-created label={} size=880x660", READER_LABEL),
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

    log_info(
        "window",
        &format!("reader-window-open bookKey={} created={}", book_key_for_log, created),
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

    log_info("window", "reader-frontend-ready");
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

    log_info(
        "window",
        &format!("reader-book-load-acked messageId={}", message_id),
    );

    Ok(())
}

pub async fn prepare_reader_book_delete(
    app: AppHandle,
    state: State<'_, ReaderWindowState>,
    book_key: String,
) -> Result<PrepareReaderBookDeleteResult, String> {
    let message_id = next_reader_message_id();

    if app.get_webview_window(READER_LABEL).is_none() {
        return Ok(PrepareReaderBookDeleteResult {
            acknowledged: true,
            affected: false,
            message_id,
        });
    }

    let payload = {
        let mut runtime = state
            .inner
            .lock()
            .map_err(|_| "failed to lock reader window state".to_string())?;

        if !runtime.is_ready {
            return Err("reader 尚未就绪，无法确认书籍清理".to_string());
        }
        if runtime.awaiting_book_delete_message_id.is_some() {
            return Err("reader 正在处理另一项书籍清理请求".to_string());
        }

        let payload = PendingBookDeleteMessage {
            book_key,
            message_id: message_id.clone(),
        };
        runtime.pending_book_delete = Some(payload.clone());
        runtime.awaiting_book_delete_message_id = Some(message_id.clone());
        runtime.last_book_delete_affected = None;
        runtime.last_seen_at = now_millis();
        payload
    };

    if let Err(error) = emit_pending_book_delete(&app, &payload) {
        let mut runtime = state
            .inner
            .lock()
            .map_err(|_| "failed to lock reader window state".to_string())?;
        if runtime.awaiting_book_delete_message_id.as_deref() == Some(message_id.as_str()) {
            runtime.pending_book_delete = None;
            runtime.awaiting_book_delete_message_id = None;
            runtime.last_book_delete_affected = None;
        }
        return Err(error);
    }
    let start = Instant::now();
    let timeout = Duration::from_millis(BOOK_DELETE_TIMEOUT_MS);

    loop {
        if start.elapsed() >= timeout {
            let mut runtime = state
                .inner
                .lock()
                .map_err(|_| "failed to lock reader window state".to_string())?;
            if runtime.awaiting_book_delete_message_id.as_deref() == Some(message_id.as_str()) {
                runtime.pending_book_delete = None;
                runtime.awaiting_book_delete_message_id = None;
                runtime.last_book_delete_affected = None;
            }
            return Err("reader 书籍清理超时，删除操作已中止".to_string());
        }

        if app.get_webview_window(READER_LABEL).is_none() {
            let mut runtime = state
                .inner
                .lock()
                .map_err(|_| "failed to lock reader window state".to_string())?;
            reset_runtime(&mut runtime);
            return Err("reader 窗口在书籍清理期间不可用".to_string());
        }

        let acknowledged_result = {
            let runtime = state
                .inner
                .lock()
                .map_err(|_| "failed to lock reader window state".to_string())?;

            if runtime.awaiting_book_delete_message_id.is_none() {
                runtime.last_book_delete_affected
            } else {
                None
            }
        };

        if let Some(affected) = acknowledged_result {
            if affected {
                if let Some(window) = app.get_webview_window(READER_LABEL) {
                    window
                        .hide()
                        .map_err(|error| format!("隐藏阅读器窗口失败: {:?}", error))?;
                }
            }

            log_info(
                "window",
                &format!("reader-book-delete-cleanup-acked messageId={} affected={}", message_id, affected),
            );
            return Ok(PrepareReaderBookDeleteResult {
                acknowledged: true,
                affected,
                message_id,
            });
        }

        thread::sleep(Duration::from_millis(80));
    }
}

pub fn ack_reader_book_delete(
    state: State<'_, ReaderWindowState>,
    message_id: String,
    affected: bool,
) -> Result<(), String> {
    let mut runtime = state
        .inner
        .lock()
        .map_err(|_| "failed to lock reader window state".to_string())?;

    runtime.last_seen_at = now_millis();
    if runtime.awaiting_book_delete_message_id.as_deref() != Some(message_id.as_str()) {
        return Err("reader 书籍清理确认消息已过期".to_string());
    }

    runtime.pending_book_delete = None;
    runtime.awaiting_book_delete_message_id = None;
    runtime.last_book_delete_affected = Some(affected);
    Ok(())
}

pub fn hide_reader_window(
    app: AppHandle,
    state: State<'_, ReaderWindowState>,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(READER_LABEL) {
        app.emit_to(READER_LABEL, READER_WINDOW_HIDE_EVENT, json!({}))
            .map_err(|error| format!("发送阅读器隐藏事件失败: {:?}", error))?;
        window
            .hide()
            .map_err(|error| format!("隐藏阅读器窗口失败: {:?}", error))?;
    }
    log_info("window", "reader-window-hidden");

    let mut runtime = state
        .inner
        .lock()
        .map_err(|_| "failed to lock reader window state".to_string())?;
    // 隐藏时不重置 runtime，前端仍在运行，保留 ready 状态
    runtime.pending_load = None;
    runtime.awaiting_message_id = None;
    runtime.last_acked_message_id = None;
    runtime.last_seen_at = now_millis();

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

    log_info("window", &format!("main-event-dispatched event={}", event_name));
    Ok(DispatchReaderEventResult { delivered: true })
}
