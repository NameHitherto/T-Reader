use serde_json::Value;

/// 未配置上下文窗口时的默认大小：100K tokens。
pub const DEFAULT_CONTEXT_WINDOW_TOKENS: usize = 100 * 1024;

/// 估算误差与消息 role 包装开销的安全边距。
const SAFETY_MARGIN_TOKENS: usize = 512;

/// 使用 cl100k_base 分词估算 token 数；编码器不可用时回退到启发式估算
/// （CJK 字符约 1 token/字，其余约 1 token/4 字符）。
fn estimate_tokens(text: &str) -> usize {
    if text.is_empty() {
        return 0;
    }

    if let Ok(bpe) = tiktoken_rs::cl100k_base() {
        return bpe.encode_with_special_tokens(text).len();
    }

    let mut cjk_chars = 0usize;
    let mut other_chars = 0usize;
    for ch in text.chars() {
        if ('\u{4e00}'..='\u{9fff}').contains(&ch)
            || ('\u{3400}'..='\u{4dbf}').contains(&ch)
            || ('\u{f900}'..='\u{faff}').contains(&ch)
        {
            cjk_chars += 1;
        } else {
            other_chars += 1;
        }
    }
    cjk_chars + other_chars.div_ceil(4)
}

fn message_tokens(message: &Value) -> usize {
    message
        .get("content")
        .and_then(Value::as_str)
        .map(estimate_tokens)
        .unwrap_or(0)
}

fn resolve_context_window(context_window: Option<i64>) -> usize {
    context_window
        .and_then(|value| usize::try_from(value).ok())
        .filter(|value| *value > 0)
        .unwrap_or(DEFAULT_CONTEXT_WINDOW_TOKENS)
}

/// 按上下文窗口裁剪对话消息：从最新往最旧保留，超预算的历史消息被丢弃。
/// system prompt 单独超过预算时返回错误。
pub fn fit_messages_to_context(
    system_prompt: &str,
    messages: Vec<Value>,
    context_window: Option<i64>,
    reserve_output_tokens: usize,
) -> Result<Vec<Value>, String> {
    let window = resolve_context_window(context_window);
    let budget = window
        .saturating_sub(reserve_output_tokens)
        .saturating_sub(SAFETY_MARGIN_TOKENS);

    let system_tokens = estimate_tokens(system_prompt);
    if system_tokens > budget {
        return Err(format!(
            "配置的上下文窗口（{} tokens）不足以容纳当前上下文（约 {} tokens），请调大上下文窗口",
            window, system_tokens
        ));
    }

    let mut remaining = budget - system_tokens;
    let mut kept: Vec<Value> = Vec::with_capacity(messages.len());
    for message in messages.into_iter().rev() {
        let tokens = message_tokens(&message);
        if tokens > remaining {
            break;
        }
        remaining -= tokens;
        kept.push(message);
    }
    kept.reverse();

    Ok(kept)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn estimate_tokens_counts_cjk_and_latin() {
        assert!(estimate_tokens("你好世界") >= 4);
        assert!(estimate_tokens("hello world") >= 2);
        assert_eq!(estimate_tokens(""), 0);
    }

    #[test]
    fn uses_default_window_when_unset() {
        let messages = vec![json!({"role": "user", "content": "hi"})];
        let result = fit_messages_to_context("system", messages.clone(), None, 4096).unwrap();
        assert_eq!(result, messages);

        let result = fit_messages_to_context("system", messages.clone(), Some(0), 4096).unwrap();
        assert_eq!(result, messages);
    }

    #[test]
    fn drops_oldest_messages_when_over_budget() {
        let window = (4096 + SAFETY_MARGIN_TOKENS + 64) as i64;
        let messages = vec![
            json!({"role": "user", "content": "最早的很长消息 ".repeat(200)}),
            json!({"role": "assistant", "content": "旧回复 ".repeat(200)}),
            json!({"role": "user", "content": "短"}),
        ];
        let result = fit_messages_to_context("system", messages, Some(window), 4096).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0]["content"], "短");
    }

    #[test]
    fn errors_when_system_prompt_exceeds_window() {
        let system = "长".repeat(10_000);
        let result = fit_messages_to_context(&system, vec![], Some(4096 + 512 + 10), 4096);
        assert!(result.is_err());
    }
}
