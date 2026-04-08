use futures_util::StreamExt;
use serde_json::json;
use tauri::{AppHandle, Emitter};

use crate::{
    service::filesystem::settings_service::load_settings_entity,
    utils::logging::{log_error, log_info},
};

pub async fn start_stream(app: AppHandle, messages: String) -> Result<(), String> {
    let settings = load_settings_entity()?;
    let client = reqwest::Client::new();
    const EVENT_NAME: &str = "stream-chunk";

    if settings.is_ai_enabled != "true" {
        return Err("AI feature is disabled".to_string());
    }

    log_info(
        "ai-stream",
        &format!(
            "start-stream model={} message_chars={}",
            settings.model_name,
            messages.len()
        ),
    );

    let request_body = json!({
        "model": settings.model_name,
        "messages": serde_json::from_str::<serde_json::Value>(&messages)
            .map_err(|error| format!("failed to parse messages: {:?}", error))?,
        "stream": true
    })
    .to_string();

    let response = client
        .post(settings.model_url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", settings.model_api_key))
        .header("Accept", "text/event-stream")
        .body(request_body)
        .send()
        .await
        .map_err(|error| format!("failed to start stream: {:?}", error))?;

    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        match chunk {
            Ok(bytes) => {
                let chunk_str = String::from_utf8_lossy(bytes.as_ref());
                for data in chunk_str.split("data:") {
                    let data = data.trim();
                    if data.is_empty() {
                        continue;
                    }

                    let json_str = data.trim_end_matches('\n');
                    app.emit_to("reader", EVENT_NAME, json!({ "chunk": json_str }))
                        .map_err(|error| {
                            format!("failed to emit stream chunk: {:?}", error)
                        })?;
                }
            }
            Err(error) => {
                log_error("ai-stream", &format!("stream-receive failed error={}", error));
                return Err(format!("failed to receive stream data: {:?}", error));
            }
        }
    }

    Ok(())
}
