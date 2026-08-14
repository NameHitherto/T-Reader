use serde_json::Value;
use tauri::{AppHandle, Manager, State};

use crate::{
    entities::{
        DispatchReaderEventResult, OpenReaderWindowResult, PrepareReaderBookDeleteResult,
        ReaderWindowState,
    },
    service::window::reader_window_service,
    utils::logging::log_info,
};

#[tauri::command]
pub async fn open_reader_window(
    app: AppHandle,
    state: State<'_, ReaderWindowState>,
    book_key: String,
    cfi: Option<String>,
) -> Result<OpenReaderWindowResult, String> {
    reader_window_service::open_reader_window(app, state, book_key, cfi).await
}

#[tauri::command]
pub fn reader_window_ready(state: State<'_, ReaderWindowState>) -> Result<(), String> {
    reader_window_service::reader_window_ready(state)
}

#[tauri::command]
pub fn ack_reader_load(
    state: State<'_, ReaderWindowState>,
    message_id: String,
) -> Result<(), String> {
    reader_window_service::ack_reader_load(state, message_id)
}

#[tauri::command]
pub async fn prepare_reader_book_delete(
    app: AppHandle,
    state: State<'_, ReaderWindowState>,
    book_key: String,
) -> Result<PrepareReaderBookDeleteResult, String> {
    reader_window_service::prepare_reader_book_delete(app, state, book_key).await
}

#[tauri::command]
pub fn ack_reader_book_delete(
    state: State<'_, ReaderWindowState>,
    message_id: String,
    affected: bool,
) -> Result<(), String> {
    reader_window_service::ack_reader_book_delete(state, message_id, affected)
}

#[tauri::command]
pub fn hide_reader_window(
    app: AppHandle,
    state: State<'_, ReaderWindowState>,
) -> Result<(), String> {
    reader_window_service::hide_reader_window(app, state)
}

#[tauri::command]
pub fn dispatch_reader_event(
    app: AppHandle,
    state: State<'_, ReaderWindowState>,
    event_name: String,
    payload: Option<Value>,
) -> Result<DispatchReaderEventResult, String> {
    reader_window_service::dispatch_reader_event(app, state, event_name, payload)
}

#[tauri::command]
pub fn dispatch_main_event(
    app: AppHandle,
    event_name: String,
    payload: Option<Value>,
) -> Result<DispatchReaderEventResult, String> {
    reader_window_service::dispatch_main_event(app, event_name, payload)
}

// ============================================================
// 通用窗口控制命令 (适用于 main / reader 两个窗口)
// 窗口最大化和窗口全屏是互斥的，因此需要先检查当前状态再执行相应的操作
// ============================================================

#[tauri::command]
pub fn window_minimize(app: AppHandle, label: String) -> Result<(), String> {
    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("窗口 '{}' 不存在", label))?;

    // Windows 平台：当窗口处于最大化状态时，直接最小化会产生 WebView
    // 渲染异常（黑块）。需要先取消最大化，再执行最小化。
    #[cfg(target_os = "windows")]
    {
        let is_maximized = window
            .is_maximized()
            .map_err(|e| format!("检查最大化状态失败: {:?}", e))?;
        if is_maximized {
            window
                .unmaximize()
                .map_err(|e| format!("取消最大化失败: {:?}", e))?;
            // 给 DWM 一帧的时间完成窗口状态切换，避免最小化动画与
            // 最大化解除动画重叠导致黑块。
            std::thread::sleep(std::time::Duration::from_millis(16));
        }
    }

    window
        .minimize()
        .map_err(|e| format!("窗口最小化失败: {:?}", e))?;
    log_info("window", &format!("window-minimized label={}", label));
    Ok(())
}

#[tauri::command]
pub fn window_toggle_maximize(app: AppHandle, label: String) -> Result<(), String> {
    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("窗口 '{}' 不存在", label))?;

    let is_fullscreen = window
        .is_fullscreen()
        .map_err(|e| format!("检查全屏状态失败: {:?}", e))?;
    if is_fullscreen {
        window
            .set_fullscreen(false)
            .map_err(|e| format!("退出全屏失败: {:?}", e))?;
        log_info("window", &format!("window-exit-fullscreen label={}", label));
        return Ok(());
    }

    let is_maximized = window
        .is_maximized()
        .map_err(|e| format!("检查最大化状态失败: {:?}", e))?;
    if is_maximized {
        window
            .unmaximize()
            .map_err(|e| format!("取消最大化失败: {:?}", e))?;
        log_info("window", &format!("window-unmaximized label={}", label));
    } else {
        window
            .maximize()
            .map_err(|e| format!("最大化失败: {:?}", e))?;
        log_info("window", &format!("window-maximized label={}", label));
    }

    Ok(())
}

#[tauri::command]
pub fn window_toggle_fullscreen(app: AppHandle, label: String) -> Result<(), String> {
    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("窗口 '{}' 不存在", label))?;

    let is_fullscreen = window
        .is_fullscreen()
        .map_err(|e| format!("检查全屏状态失败: {:?}", e))?;

    if is_fullscreen {
        window
            .set_fullscreen(false)
            .map_err(|e| format!("退出全屏失败: {:?}", e))?;
        log_info("window", &format!("window-exit-fullscreen label={}", label));
        return Ok(());
    }

    let is_maximized = window
        .is_maximized()
        .map_err(|e| format!("检查最大化状态失败: {:?}", e))?;

    if is_maximized {
        window
            .unmaximize()
            .map_err(|e| format!("取消最大化失败: {:?}", e))?;
        log_info("window", &format!("window-unmaximized label={}", label));
    } else {
        window
            .set_fullscreen(true)
            .map_err(|e| format!("进入全屏失败: {:?}", e))?;
        log_info("window", &format!("window-enter-fullscreen label={}", label));
    }
    Ok(())
}

#[tauri::command]
pub fn window_show(app: AppHandle, label: String) -> Result<(), String> {
    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("窗口 '{}' 不存在", label))?;
    window
        .show()
        .map_err(|e| format!("窗口显示失败: {:?}", e))?;
    window
        .set_focus()
        .map_err(|e| format!("窗口聚焦失败: {:?}", e))?;
    log_info("window", &format!("window-shown label={}", label));
    Ok(())
}

#[tauri::command]
pub fn window_hide(app: AppHandle, label: String) -> Result<(), String> {
    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("窗口 '{}' 不存在", label))?;
    window
        .hide()
        .map_err(|e| format!("窗口隐藏失败: {:?}", e))?;
    log_info("window", &format!("window-hidden label={}", label));
    Ok(())
}

#[tauri::command]
pub fn app_close(app: AppHandle) -> Result<(), String> {
    if let Some(reader) = app.get_webview_window("reader") {
        reader
            .close()
            .map_err(|e| format!("关闭 reader 窗口失败: {:?}", e))?;
        log_info("window", "reader-window-close-command");
    }

    if let Some(main) = app.get_webview_window("main") {
        main.close()
            .map_err(|e| format!("关闭 main 窗口失败: {:?}", e))?;
        log_info("window", "main-window-close-command");
    }

    Ok(())
}
