use std::time::Instant;

pub fn log_info(scope: &str, message: &str) {
    println!("[backend][{}] {}", scope, message);
}

pub fn log_warn(scope: &str, message: &str) {
    println!("[backend][{}][warn] {}", scope, message);
}

pub fn log_error(scope: &str, message: &str) {
    eprintln!("[backend][{}][error] {}", scope, message);
}

pub fn start_timer(scope: &str, message: &str) -> Instant {
    log_info(scope, &format!("{}:start", message));
    Instant::now()
}

pub fn finish_timer(scope: &str, message: &str, started_at: Instant) {
    log_info(
        scope,
        &format!(
            "{}:done elapsed_ms={}",
            message,
            started_at.elapsed().as_millis()
        ),
    );
}
