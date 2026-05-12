use log::info;
use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};

pub const MAIN_LABEL: &str = "main";

pub fn create_main_window(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    info!("[main][window] 主窗口创建中");

    let window = WebviewWindowBuilder::new(app, MAIN_LABEL, WebviewUrl::App("index.html".into()))
        .title("书架")
        .inner_size(880.0, 660.0)
        .min_inner_size(880.0, 660.0)
        .decorations(false)
        .build()?;

    window.on_window_event(|event| {
        if let tauri::WindowEvent::CloseRequested { .. } = event {
            info!("[main][window] 主窗口收到关闭请求，执行销毁程序");
        }
        if let tauri::WindowEvent::Destroyed = event {
            info!("[main][window] 主窗口已销毁");
        }
    });

    info!("[main][window] 主窗口创建成功");
    info!(
        "[main][window] 窗口标签={}, 尺寸=880x660, 装饰=false",
        MAIN_LABEL
    );

    Ok(())
}
