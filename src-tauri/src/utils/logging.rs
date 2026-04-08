use std::time::Instant;

use tauri_plugin_log::{Target, TargetKind, WEBVIEW_TARGET};
use time::{macros::format_description, OffsetDateTime};

fn build_scoped_message(window: &str, scope: &str, event: &str) -> String {
    format!("[{window}][{scope}] {event}")
}

pub fn build_log_target(kind: TargetKind) -> Target {
    let date_format = format_description!("[year]-[month]-[day]");
    let time_format = format_description!("[hour]:[minute]:[second]");

    Target::new(kind).format(move |out, message, record| {
        let now = OffsetDateTime::now_local().unwrap_or_else(|_| OffsetDateTime::now_utc());
        let source = if record.target().starts_with(WEBVIEW_TARGET) {
            "frontend"
        } else {
            "backend"
        };

        out.finish(format_args!(
            "[{}][{}][{}][{}]{}",
            now.format(&date_format)
                .unwrap_or_else(|_| "unknown-date".to_string()),
            now.format(&time_format)
                .unwrap_or_else(|_| "unknown-time".to_string()),
            source,
            record.level(),
            message
        ))
    })
}

pub fn log_info(scope: &str, message: &str) {
    log::info!(target: "backend","{}",build_scoped_message("n/a", scope, message));
}

pub fn log_warn(scope: &str, message: &str) {
    log::warn!(target: "backend","{}",build_scoped_message("n/a", scope, message));
}

pub fn log_error(scope: &str, message: &str) {
    log::error!(target: "backend","{}",build_scoped_message("n/a", scope, message));
}

pub fn start_timer(scope: &str, message: &str) -> Instant {
    log_info(scope, &format!("{}:start", message));
    Instant::now()
}

pub fn finish_timer(scope: &str, message: &str, started_at: Instant) {
    log::info!(
        target: "backend",
        "{}",
        build_scoped_message(
            "n/a",
            scope,
            &format!("{}:done durationMs={}", message, started_at.elapsed().as_millis()),
        )
    );
}
