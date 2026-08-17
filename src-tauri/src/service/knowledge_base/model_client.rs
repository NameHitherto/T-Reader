use std::time::Duration;

use futures_util::StreamExt;
use reqwest::Client;
use serde_json::{Value, json};
use sqlx::SqlitePool;
use tauri::ipc::Channel;

use crate::{
    entities::{KnowledgeAnswerStreamChunk, ModelProviderConfig, Settings},
    repository::{
        settings as settings_repository, system::proxy_repository::resolve_request_proxy_url,
    },
    utils::logging::{log_error, log_info},
};

const EMBEDDING_MODEL_PURPOSE: &str = "embedding";
const RERANK_MODEL_PURPOSE: &str = "rerank";
const CHAT_MODEL_PURPOSE: &str = "chat";
const EMBEDDING_BATCH_SIZE: usize = 20;
const EMBEDDING_TIMEOUT_SECS: u64 = 120;
const RERANK_TIMEOUT_SECS: u64 = 120;
const CHAT_TIMEOUT_SECS: u64 = 180;
const MAX_OUTPUT_TOKENS: u32 = 4096;
const DEFAULT_EMBEDDING_ENDPOINT: &str = "/v1/embeddings";
const DEFAULT_RERANK_ENDPOINT: &str = "/v1/rerank";
const DEFAULT_OPENAI_ENDPOINT: &str = "/v1/chat/completions";
const DEFAULT_ANTHROPIC_ENDPOINT: &str = "/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";

pub async fn load_app_settings(pool: &SqlitePool) -> Result<Settings, String> {
    settings_repository::load_app_settings(pool).await
}

pub async fn get_chat_provider(pool: &SqlitePool) -> Result<ModelProviderConfig, String> {
    let settings = load_app_settings(pool).await?;
    load_provider(&settings, CHAT_MODEL_PURPOSE, "对话")
}

pub async fn get_embedding_provider(pool: &SqlitePool) -> Result<ModelProviderConfig, String> {
    let settings = load_app_settings(pool).await?;
    load_provider(&settings, EMBEDDING_MODEL_PURPOSE, "嵌入")
}

pub async fn get_rerank_provider(pool: &SqlitePool) -> Result<ModelProviderConfig, String> {
    let settings = load_app_settings(pool).await?;
    load_provider(&settings, RERANK_MODEL_PURPOSE, "重排序")
}

fn load_provider(
    settings: &Settings,
    purpose: &str,
    label: &str,
) -> Result<ModelProviderConfig, String> {
    let provider = settings
        .model_providers
        .get(purpose)
        .cloned()
        .filter(|provider| {
            !provider.base_url.trim().is_empty() && !provider.model_id.trim().is_empty()
        })
        .ok_or_else(|| format!("请先在设置中配置{}模型", label))?;

    if matches!(provider.provider_type.as_str(), "OpenAI" | "Anthropic")
        && provider.api_key.trim().is_empty()
    {
        return Err(format!("{} 模型需要填写 API Key", provider.provider_type));
    }

    Ok(provider)
}

fn build_client(proxy_enabled: bool, timeout_secs: u64) -> Client {
    let mut builder = Client::builder().timeout(Duration::from_secs(timeout_secs));

    match resolve_request_proxy_url(proxy_enabled) {
        Some(proxy_url) => {
            if let Ok(reqwest_proxy) = reqwest::Proxy::all(&proxy_url) {
                log_info(
                    "knowledge-base-model",
                    &format!("using-proxy url={}", proxy_url),
                );
                builder = builder.proxy(reqwest_proxy);
            }
        }
        None => {
            builder = builder.no_proxy();
        }
    }

    builder.build().unwrap_or_else(|_| Client::new())
}

pub async fn embed_texts(pool: &SqlitePool, texts: &[String]) -> Result<Vec<Vec<f32>>, String> {
    if texts.is_empty() {
        return Ok(Vec::new());
    }

    let settings = load_app_settings(pool).await?;
    let provider = load_provider(&settings, EMBEDDING_MODEL_PURPOSE, "嵌入")?;
    let client = build_client(settings.proxy_enabled, EMBEDDING_TIMEOUT_SECS);

    let batch_size = provider
        .batch_size
        .and_then(|value| usize::try_from(value).ok())
        .filter(|value| *value > 0)
        .unwrap_or(EMBEDDING_BATCH_SIZE);
    let expected_dimension = provider
        .vector_dimension
        .and_then(|value| usize::try_from(value).ok())
        .filter(|value| *value > 0);

    let mut embeddings = Vec::with_capacity(texts.len());
    let mut dimension = None;

    for batch in texts.chunks(batch_size) {
        let batch_embeddings = send_embedding_batch(&client, &provider, batch).await?;
        for embedding in batch_embeddings {
            let current_dimension = embedding.len();
            if let Some(expected) = expected_dimension {
                if current_dimension != expected {
                    return Err(format!(
                        "嵌入向量维度 {} 与配置的 {} 不一致",
                        current_dimension, expected
                    ));
                }
            }
            match dimension {
                None => dimension = Some(current_dimension),
                Some(existing) if existing != current_dimension => {
                    return Err("嵌入模型返回了不一致的向量维度".to_string());
                }
                _ => {}
            }
            embeddings.push(embedding);
        }
    }

    if embeddings.len() != texts.len() {
        return Err("嵌入模型返回数量与请求不一致".to_string());
    }

    Ok(embeddings)
}

pub async fn embed_query(pool: &SqlitePool, text: &str) -> Result<Vec<f32>, String> {
    let embeddings = embed_texts(pool, &[text.to_string()]).await?;
    embeddings
        .into_iter()
        .next()
        .ok_or_else(|| "嵌入模型未返回查询向量".to_string())
}

async fn send_embedding_batch(
    client: &Client,
    provider: &ModelProviderConfig,
    texts: &[String],
) -> Result<Vec<Vec<f32>>, String> {
    let endpoint = if provider.endpoint.trim().is_empty() {
        DEFAULT_EMBEDDING_ENDPOINT
    } else {
        provider.endpoint.trim()
    };

    let payload = json!({
        "model": provider.model_id,
        "input": texts,
    });

    let mut request = client.post(provider.request_url(endpoint)).json(&payload);
    if !provider.api_key.trim().is_empty() {
        request = request.bearer_auth(&provider.api_key);
    }

    let response = request
        .send()
        .await
        .map_err(|error| format!("嵌入请求失败: {}", error))?;
    let status = response.status();
    let body = response.text().await.unwrap_or_else(|_| String::new());

    if !status.is_success() {
        let snippet: String = body.chars().take(500).collect();
        log_error(
            "knowledge-base-model",
            &format!("embedding failed status={} body={}", status, snippet),
        );
        return Err(format!("嵌入请求失败({}): {}", status.as_u16(), snippet));
    }

    let payload: Value =
        serde_json::from_str(&body).map_err(|error| format!("解析嵌入响应失败: {}", error))?;
    let data = payload
        .get("data")
        .and_then(Value::as_array)
        .ok_or_else(|| "嵌入响应缺少 data 数组".to_string())?;

    data.iter()
        .map(|item| {
            let embedding = item
                .get("embedding")
                .and_then(Value::as_array)
                .ok_or_else(|| "嵌入响应项缺少 embedding 数组".to_string())?;
            embedding
                .iter()
                .map(|value| {
                    value
                        .as_f64()
                        .map(|number| number as f32)
                        .ok_or_else(|| "嵌入向量包含非数值元素".to_string())
                })
                .collect()
        })
        .collect()
}

pub async fn rerank_documents(
    pool: &SqlitePool,
    query: &str,
    documents: &[String],
    top_n: usize,
) -> Result<Vec<(usize, f32)>, String> {
    if documents.is_empty() {
        return Ok(Vec::new());
    }

    let settings = load_app_settings(pool).await?;
    let provider = load_provider(&settings, RERANK_MODEL_PURPOSE, "重排序")?;
    let client = build_client(settings.proxy_enabled, RERANK_TIMEOUT_SECS);

    let endpoint = if provider.endpoint.trim().is_empty() {
        DEFAULT_RERANK_ENDPOINT
    } else {
        provider.endpoint.trim()
    };
    let url = provider.request_url(endpoint);

    let payload = json!({
        "model": provider.model_id,
        "query": query,
        "documents": documents,
        "top_n": top_n,
    });

    let mut request = client.post(url).json(&payload);
    if !provider.api_key.trim().is_empty() {
        request = request.bearer_auth(&provider.api_key);
    }

    let response = request
        .send()
        .await
        .map_err(|error| format!("重排序请求失败: {}", error))?;
    let status = response.status();
    let body = response.text().await.unwrap_or_else(|_| String::new());

    if !status.is_success() {
        let snippet: String = body.chars().take(500).collect();
        log_error(
            "knowledge-base-model",
            &format!("rerank failed status={} body={}", status, snippet),
        );
        return Err(format!("重排序请求失败({}): {}", status.as_u16(), snippet));
    }

    let payload: Value =
        serde_json::from_str(&body).map_err(|error| format!("解析重排序响应失败: {}", error))?;
    let results = payload
        .get("results")
        .and_then(Value::as_array)
        .or_else(|| payload.get("data").and_then(Value::as_array))
        .ok_or_else(|| "重排序响应缺少 results 数组".to_string())?;

    let mut ranked = Vec::new();
    for item in results {
        let index = item
            .get("index")
            .and_then(Value::as_u64)
            .or_else(|| {
                item.get("index")
                    .and_then(Value::as_i64)
                    .map(|value| value as u64)
            })
            .unwrap_or(0) as usize;
        let score = item
            .get("relevance_score")
            .and_then(Value::as_f64)
            .or_else(|| item.get("score").and_then(Value::as_f64))
            .unwrap_or(0.0) as f32;

        if index < documents.len() {
            ranked.push((index, score));
        }
    }

    ranked.sort_by(|left, right| {
        right
            .1
            .partial_cmp(&left.1)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    ranked.truncate(top_n);
    Ok(ranked)
}

pub async fn stream_chat_completion(
    pool: &SqlitePool,
    system_prompt: &str,
    messages: Vec<Value>,
    on_event: &Channel<KnowledgeAnswerStreamChunk>,
) -> Result<String, String> {
    let settings = load_app_settings(pool).await?;
    let provider = load_provider(&settings, CHAT_MODEL_PURPOSE, "对话")?;
    let client = build_client(settings.proxy_enabled, CHAT_TIMEOUT_SECS);

    let response = match provider.provider_type.as_str() {
        "Anthropic" => send_anthropic_chat(&client, &provider, system_prompt, messages).await?,
        _ => send_openai_chat(&client, &provider, system_prompt, messages).await?,
    };

    stream_chat_response(response, &provider.provider_type, on_event).await
}

fn is_openai_responses_endpoint(endpoint: &str) -> bool {
    endpoint.trim_end_matches('/').ends_with("/v1/responses")
}

async fn send_openai_chat(
    client: &Client,
    provider: &ModelProviderConfig,
    system_prompt: &str,
    messages: Vec<Value>,
) -> Result<reqwest::Response, String> {
    let endpoint = if provider.full_url {
        ""
    } else if provider.endpoint.trim().is_empty() {
        DEFAULT_OPENAI_ENDPOINT
    } else {
        let endpoint = provider.endpoint.trim();
        if is_openai_responses_endpoint(endpoint) {
            return Err("当前版本仅支持 OpenAI /v1/chat/completions 端点".to_string());
        }
        endpoint
    };

    let mut body = Vec::with_capacity(messages.len() + 1);
    body.push(json!({
        "role": "system",
        "content": system_prompt,
    }));
    body.extend(messages);

    let payload = json!({
        "model": provider.model_id,
        "stream": true,
        "messages": body,
    });

    let mut request = client.post(provider.request_url(endpoint)).json(&payload);
    if !provider.api_key.trim().is_empty() {
        request = request.bearer_auth(&provider.api_key);
    }

    request
        .send()
        .await
        .map_err(|error| format!("对话请求失败: {}", error))
}

async fn send_anthropic_chat(
    client: &Client,
    provider: &ModelProviderConfig,
    system_prompt: &str,
    messages: Vec<Value>,
) -> Result<reqwest::Response, String> {
    let endpoint = if provider.full_url {
        ""
    } else if provider.endpoint.trim().is_empty() {
        DEFAULT_ANTHROPIC_ENDPOINT
    } else {
        provider.endpoint.trim()
    };

    let payload = json!({
        "model": provider.model_id,
        "max_tokens": MAX_OUTPUT_TOKENS,
        "stream": true,
        "system": system_prompt,
        "messages": messages,
    });

    client
        .post(provider.request_url(endpoint))
        .header("x-api-key", &provider.api_key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .json(&payload)
        .send()
        .await
        .map_err(|error| format!("对话请求失败: {}", error))
}

fn send_stream_chunk(channel: &Channel<KnowledgeAnswerStreamChunk>, text: &str) {
    let _ = channel.send(KnowledgeAnswerStreamChunk {
        text: text.to_string(),
    });
}

fn parse_openai_data(data: &str) -> Result<Option<String>, String> {
    if data == "[DONE]" {
        return Ok(None);
    }

    let payload: Value = serde_json::from_str(data)
        .map_err(|error| format!("解析 OpenAI 流式响应失败: {}", error))?;

    if let Some(message) = payload
        .get("error")
        .and_then(|error| error.get("message"))
        .and_then(Value::as_str)
    {
        return Err(message.to_string());
    }

    let delta = payload
        .get("choices")
        .and_then(|choices| choices.get(0))
        .and_then(|choice| choice.get("delta"))
        .and_then(|delta| delta.get("content"))
        .and_then(Value::as_str);

    Ok(delta.map(ToString::to_string))
}

fn parse_anthropic_data(data: &str) -> Result<Option<String>, String> {
    let payload: Value = serde_json::from_str(data)
        .map_err(|error| format!("解析 Anthropic 流式响应失败: {}", error))?;

    if payload.get("type").and_then(Value::as_str) == Some("error") {
        let message = payload
            .get("error")
            .and_then(|error| error.get("message"))
            .and_then(Value::as_str)
            .unwrap_or("Anthropic 流式响应错误");
        return Err(message.to_string());
    }

    let delta = payload
        .get("delta")
        .and_then(|delta| delta.get("text"))
        .and_then(Value::as_str);

    Ok(delta.map(ToString::to_string))
}

async fn stream_chat_response(
    response: reqwest::Response,
    provider_type: &str,
    channel: &Channel<KnowledgeAnswerStreamChunk>,
) -> Result<String, String> {
    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_else(|_| String::new());
        let snippet: String = body.chars().take(500).collect();
        log_error(
            "knowledge-base-model",
            &format!("chat failed status={} body={}", status, snippet),
        );
        return Err(format!("对话请求失败({}): {}", status.as_u16(), snippet));
    }

    let mut stream = response.bytes_stream();
    let mut pending = String::new();
    let mut current_event = String::new();
    let mut answer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| format!("读取流式响应失败: {}", error))?;
        pending.push_str(&String::from_utf8_lossy(chunk.as_ref()));

        while let Some(newline_pos) = pending.find('\n') {
            let line = pending[..newline_pos].to_string();
            pending.drain(..=newline_pos);
            let line = line.trim_end_matches('\r');

            if line.is_empty() {
                current_event.clear();
                continue;
            }

            if let Some(event_name) = line.strip_prefix("event:") {
                current_event = event_name.trim().to_string();
                continue;
            }

            let Some(data) = line.strip_prefix("data:") else {
                continue;
            };
            let data = data.trim();

            let delta = if provider_type == "Anthropic" {
                if current_event == "content_block_delta" {
                    parse_anthropic_data(data)?
                } else if current_event == "error" {
                    return Err(parse_anthropic_data(data)
                        .err()
                        .unwrap_or_else(|| "Anthropic 流式响应错误".to_string()));
                } else {
                    None
                }
            } else {
                parse_openai_data(data)?
            };

            if let Some(delta) = delta {
                if !delta.is_empty() {
                    answer.push_str(&delta);
                    send_stream_chunk(channel, &delta);
                }
            }
        }
    }

    if !pending.trim().is_empty() {
        let line = pending.trim_end_matches('\r');
        let data = line.strip_prefix("data:").unwrap_or(line).trim();
        let delta = if provider_type == "Anthropic" {
            if current_event == "content_block_delta" {
                parse_anthropic_data(data)?
            } else {
                None
            }
        } else {
            parse_openai_data(data)?
        };
        if let Some(delta) = delta {
            if !delta.is_empty() {
                answer.push_str(&delta);
                send_stream_chunk(channel, &delta);
            }
        }
    }

    let normalized_answer = answer.trim().to_string();
    if normalized_answer.is_empty() {
        return Err("模型未返回有效内容".to_string());
    }

    Ok(normalized_answer)
}
