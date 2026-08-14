use tauri_plugin_log::{Target, TargetKind};
use time::{macros::format_description, OffsetDateTime};

fn build_scoped_message(scope: &str, event: &str) -> String {
    format!("[{scope}] {event}")
}

pub fn build_log_target(kind: TargetKind) -> Target {
    let time_format = format_description!("[hour]:[minute]:[second]");

    Target::new(kind).format(move |out, message, record| {
        let now = OffsetDateTime::now_local().unwrap_or_else(|_| OffsetDateTime::now_utc());

        out.finish(format_args!(
            "[{}][{}]{}",
            now.format(&time_format)
                .unwrap_or_else(|_| "unknown-time".to_string()),
            record.level(),
            message
        ))
    })
}

#[cfg(not(debug_assertions))]
pub fn build_log_file_name() -> String {
    let date_format = format_description!("[year]-[month]-[day]");
    let now = OffsetDateTime::now_local().unwrap_or_else(|_| OffsetDateTime::now_utc());

    format!(
        "{}_{}",
        env!("CARGO_PKG_NAME"),
        now.format(&date_format)
            .unwrap_or_else(|_| "unknown-date".to_string())
    )
}

pub fn log_info(scope: &str, message: &str) {
    log::info!("{}", build_scoped_message(scope, message));
}

pub fn log_warn(scope: &str, message: &str) {
    log::warn!("{}", build_scoped_message(scope, message));
}

pub fn log_error(scope: &str, message: &str) {
    log::error!("{}", build_scoped_message(scope, message));
}
