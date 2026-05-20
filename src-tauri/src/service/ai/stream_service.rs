use futures_util::{
    future::{AbortHandle, Abortable},
    StreamExt,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, State};

use crate::{
    entities::{AiStreamState, Settings},
    service::filesystem::settings_service::load_settings_entity,
    utils::logging::{log_error, log_info},
};

const EVENT_NAME: &str = "assistant-stream-event";
const ANTHROPIC_VERSION: &str = "2023-06-01";
const DEFAULT_MAX_TOKENS: u32 = 2048;

#[derive(Clone, Debug)]
enum ChatEndpointKind {
    OpenAiChatCompletions,
    OpenAiResponses,
    AnthropicMessages,
}

#[derive(Clone, Debug)]
struct ChatConfig {
    provider_type: String,
    model_id: String,
    endpoint_url: String,
    endpoint_kind: ChatEndpointKind,
    api_key: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

fn normalize_endpoint(endpoint: &str) -> String {
    endpoint.trim().trim_end_matches('/').to_string()
}

fn resolve_endpoint_kind(provider_type: &str, endpoint: &str) -> Result<ChatEndpointKind, String> {
    let endpoint = normalize_endpoint(endpoint);
    if endpoint.ends_with("/v1/responses/compact") {
        return Err(
            "/v1/responses/compact 不是对话生成端点，请在设置中改用 /v1/responses".to_string(),
        );
    }
    if endpoint.ends_with("/v1/chat/completions") {
        return Ok(ChatEndpointKind::OpenAiChatCompletions);
    }
    if endpoint.ends_with("/v1/responses") {
        return Ok(ChatEndpointKind::OpenAiResponses);
    }
    if endpoint.ends_with("/v1/messages") || provider_type == "Anthropic" {
        return Ok(ChatEndpointKind::AnthropicMessages);
    }

    Err(format!("不支持的对话端点: {endpoint}"))
}

fn resolve_chat_config(settings: &Settings) -> Result<ChatConfig, String> {
    let chat = settings
        .model_providers
        .get("chat")
        .ok_or_else(|| "尚未配置对话模型".to_string())?;

    if chat.model_id.trim().is_empty() {
        return Err("尚未配置对话模型 ID".to_string());
    }
    if chat.base_url.trim().is_empty() || chat.endpoint.trim().is_empty() {
        return Err("尚未配置对话模型请求地址".to_string());
    }

    let endpoint_kind = resolve_endpoint_kind(&chat.provider_type, &chat.endpoint)?;

    Ok(ChatConfig {
        provider_type: chat.provider_type.clone(),
        model_id: chat.model_id.clone(),
        endpoint_url: format!(
            "{}{}",
            chat.base_url.trim_end_matches('/'),
            chat.endpoint.as_str()
        ),
        endpoint_kind,
        api_key: chat.api_key.clone(),
    })
}

fn build_openai_chat_body(
    config: &ChatConfig,
    system_prompt: &str,
    messages: &[ChatMessage],
) -> Value {
    let mut request_messages = Vec::with_capacity(messages.len() + 1);
    if !system_prompt.trim().is_empty() {
        request_messages.push(json!({
            "role": "system",
            "content": system_prompt,
        }));
    }
    request_messages.extend(messages.iter().map(|message| {
        json!({
            "role": message.role,
            "content": message.content,
        })
    }));

    json!({
        "model": config.model_id,
        "messages": request_messages,
        "stream": true,
    })
}

fn build_openai_responses_body(
    config: &ChatConfig,
    system_prompt: &str,
    messages: &[ChatMessage],
) -> Value {
    let input: Vec<Value> = messages
        .iter()
        .map(|message| {
            json!({
                "role": message.role,
                "content": message.content,
            })
        })
        .collect();

    json!({
        "model": config.model_id,
        "instructions": system_prompt,
        "input": input,
        "stream": true,
    })
}

fn build_anthropic_messages_body(
    config: &ChatConfig,
    system_prompt: &str,
    messages: &[ChatMessage],
) -> Value {
    let request_messages: Vec<Value> = messages
        .iter()
        .filter(|message| message.role == "user" || message.role == "assistant")
        .map(|message| {
            json!({
                "role": message.role,
                "content": message.content,
            })
        })
        .collect();

    json!({
        "model": config.model_id,
        "system": system_prompt,
        "messages": request_messages,
        "max_tokens": DEFAULT_MAX_TOKENS,
        "stream": true,
    })
}

fn build_request_body(config: &ChatConfig, system_prompt: &str, messages: &[ChatMessage]) -> Value {
    match config.endpoint_kind {
        ChatEndpointKind::OpenAiChatCompletions => {
            build_openai_chat_body(config, system_prompt, messages)
        }
        ChatEndpointKind::OpenAiResponses => {
            build_openai_responses_body(config, system_prompt, messages)
        }
        ChatEndpointKind::AnthropicMessages => {
            build_anthropic_messages_body(config, system_prompt, messages)
        }
    }
}

fn extract_delta(endpoint_kind: &ChatEndpointKind, data: &Value) -> Option<String> {
    match endpoint_kind {
        ChatEndpointKind::OpenAiChatCompletions => data
            .get("choices")
            .and_then(|choices| choices.get(0))
            .and_then(|choice| choice.get("delta"))
            .and_then(|delta| delta.get("content"))
            .and_then(Value::as_str)
            .map(ToString::to_string),
        ChatEndpointKind::OpenAiResponses => {
            if data.get("type").and_then(Value::as_str) == Some("response.output_text.delta") {
                return data
                    .get("delta")
                    .and_then(Value::as_str)
                    .map(ToString::to_string);
            }
            None
        }
        ChatEndpointKind::AnthropicMessages => {
            if data.get("type").and_then(Value::as_str) == Some("content_block_delta") {
                return data
                    .get("delta")
                    .and_then(|delta| delta.get("text"))
                    .and_then(Value::as_str)
                    .map(ToString::to_string);
            }
            None
        }
    }
}

fn event_data(event_block: &str) -> Option<String> {
    let data_lines: Vec<String> = event_block
        .lines()
        .filter_map(|line| {
            line.strip_prefix("data:")
                .map(|data| data.trim().to_string())
        })
        .collect();

    if data_lines.is_empty() {
        return None;
    }

    Some(data_lines.join("\n"))
}

fn emit_stream_event(
    app: &AppHandle,
    request_id: &str,
    event: &str,
    payload: Value,
) -> Result<(), String> {
    app.emit_to(
        "reader",
        EVENT_NAME,
        json!({
            "requestId": request_id,
            "event": event,
            "payload": payload,
        }),
    )
    .map_err(|error| format!("failed to emit stream event: {error:?}"))
}

fn emit_delta(app: &AppHandle, request_id: &str, delta: &str) -> Result<(), String> {
    if delta.is_empty() {
        return Ok(());
    }

    emit_stream_event(app, request_id, "delta", json!({ "text": delta }))
}

fn handle_sse_event(
    app: &AppHandle,
    request_id: &str,
    endpoint_kind: &ChatEndpointKind,
    event_block: &str,
) -> Result<bool, String> {
    let Some(data) = event_data(event_block) else {
        return Ok(false);
    };

    if data == "[DONE]" {
        emit_stream_event(app, request_id, "done", json!({}))?;
        return Ok(true);
    }

    let parsed: Value = serde_json::from_str(&data)
        .map_err(|error| format!("failed to parse stream data: {error}; data={data}"))?;

    if let Some(delta) = extract_delta(endpoint_kind, &parsed) {
        emit_delta(app, request_id, &delta)?;
    }

    Ok(false)
}

fn take_registered_abort_handle(state: &State<'_, AiStreamState>, request_id: &str) {
    if let Ok(mut abort_handles) = state.abort_handles.lock() {
        abort_handles.remove(request_id);
    }
}

fn register_abort_handle(
    state: &State<'_, AiStreamState>,
    request_id: &str,
    abort_handle: AbortHandle,
) -> Result<(), String> {
    let mut abort_handles = state
        .abort_handles
        .lock()
        .map_err(|_| "failed to lock ai stream state".to_string())?;

    if let Some(previous) = abort_handles.insert(request_id.to_string(), abort_handle) {
        previous.abort();
    }

    Ok(())
}

async fn run_stream(
    app: AppHandle,
    request_id: String,
    config: ChatConfig,
    system_prompt: String,
    messages: Vec<ChatMessage>,
) -> Result<(), String> {
    let client = reqwest::Client::new();
    let request_body = build_request_body(&config, &system_prompt, &messages).to_string();

    log_info(
        "ai-stream",
        &format!(
            "start-stream requestId={} provider={} endpoint={} messages={}",
            request_id,
            config.provider_type,
            config.endpoint_url,
            messages.len()
        ),
    );

    let mut request = client
        .post(&config.endpoint_url)
        .header("Content-Type", "application/json")
        .header("Accept", "text/event-stream")
        .body(request_body);

    request = match config.endpoint_kind {
        ChatEndpointKind::AnthropicMessages => request
            .header("x-api-key", config.api_key.as_str())
            .header("anthropic-version", ANTHROPIC_VERSION),
        ChatEndpointKind::OpenAiChatCompletions | ChatEndpointKind::OpenAiResponses => {
            request.header("Authorization", format!("Bearer {}", config.api_key))
        }
    };

    let response = request
        .send()
        .await
        .map_err(|error| format!("启动流式请求失败: {error}"))?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("模型服务返回错误状态 {status}: {body}"));
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let bytes = chunk.map_err(|error| format!("接收流式数据失败: {error}"))?;
        buffer.push_str(&String::from_utf8_lossy(bytes.as_ref()).replace("\r\n", "\n"));

        while let Some(index) = buffer.find("\n\n") {
            let event_block = buffer[..index].to_string();
            buffer = buffer[index + 2..].to_string();

            if handle_sse_event(&app, &request_id, &config.endpoint_kind, &event_block)? {
                return Ok(());
            }
        }
    }

    emit_stream_event(&app, &request_id, "done", json!({}))?;
    Ok(())
}

pub async fn start_stream(
    app: AppHandle,
    state: State<'_, AiStreamState>,
    request_id: String,
    system_prompt: String,
    messages: String,
) -> Result<(), String> {
    let settings = load_settings_entity()?;
    let config = resolve_chat_config(&settings)?;
    let parsed_messages = serde_json::from_str::<Vec<ChatMessage>>(&messages)
        .map_err(|error| format!("解析对话消息失败: {error}"))?;

    let (abort_handle, abort_registration) = AbortHandle::new_pair();
    register_abort_handle(&state, &request_id, abort_handle)?;

    let result = Abortable::new(
        run_stream(
            app.clone(),
            request_id.clone(),
            config,
            system_prompt,
            parsed_messages,
        ),
        abort_registration,
    )
    .await;

    take_registered_abort_handle(&state, &request_id);

    match result {
        Ok(Ok(())) => Ok(()),
        Ok(Err(error)) => {
            log_error(
                "ai-stream",
                &format!("stream failed requestId={} error={}", request_id, error),
            );
            let _ = emit_stream_event(&app, &request_id, "error", json!({ "message": error }));
            Ok(())
        }
        Err(_) => {
            let _ = emit_stream_event(&app, &request_id, "cancelled", json!({}));
            Ok(())
        }
    }
}

pub fn stop_stream(state: State<'_, AiStreamState>, request_id: String) -> Result<(), String> {
    let mut abort_handles = state
        .abort_handles
        .lock()
        .map_err(|_| "failed to lock ai stream state".to_string())?;

    if let Some(abort_handle) = abort_handles.remove(&request_id) {
        abort_handle.abort();
    }

    Ok(())
}
