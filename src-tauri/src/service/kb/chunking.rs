use crate::service::kb::epub_knowledge_extractor::EpubKnowledgeParagraph;

const MIN_CHUNK_CHARS: usize = 400;
const MAX_CHUNK_CHARS: usize = 800;
const OVERLAP_CHARS: usize = 80;

#[derive(Debug, Clone)]
pub struct KnowledgeChunkDraft {
    pub chapter_index: i64,
    pub chapter_title: String,
    pub paragraph_index: i64,
    pub content: String,
}

pub fn build_knowledge_chunks(
    paragraphs: &[EpubKnowledgeParagraph],
) -> Result<Vec<KnowledgeChunkDraft>, String> {
    let mut chunks = Vec::new();
    let mut current = String::new();
    let mut current_chapter_index = 0_i64;
    let mut current_chapter_title = String::new();
    let mut current_paragraph_index = 0_i64;

    for paragraph in paragraphs {
        let paragraph_len = paragraph.text.chars().count();
        let chapter_changed = paragraph.chapter_index != current_chapter_index;

        if !current.is_empty()
            && (chapter_changed || current.chars().count() + 1 + paragraph_len > MAX_CHUNK_CHARS)
        {
            chunks.push(KnowledgeChunkDraft {
                chapter_index: current_chapter_index,
                chapter_title: current_chapter_title.clone(),
                paragraph_index: current_paragraph_index,
                content: current.trim().to_string(),
            });
            current.clear();
        }

        if current.is_empty() {
            current_chapter_index = paragraph.chapter_index;
            current_chapter_title = paragraph.chapter_title.clone();
            current_paragraph_index = paragraph.paragraph_index;
        }

        if paragraph_len > MAX_CHUNK_CHARS {
            if !current.is_empty() {
                chunks.push(KnowledgeChunkDraft {
                    chapter_index: current_chapter_index,
                    chapter_title: current_chapter_title.clone(),
                    paragraph_index: current_paragraph_index,
                    content: current.trim().to_string(),
                });
                current.clear();
            }

            for part in split_long_text(&paragraph.text, MAX_CHUNK_CHARS, OVERLAP_CHARS) {
                chunks.push(KnowledgeChunkDraft {
                    chapter_index: paragraph.chapter_index,
                    chapter_title: paragraph.chapter_title.clone(),
                    paragraph_index: paragraph.paragraph_index,
                    content: part,
                });
            }
            continue;
        }

        if current.is_empty() {
            current.push_str(&paragraph.text);
        } else {
            current.push(' ');
            current.push_str(&paragraph.text);
        }
    }

    if !current.trim().is_empty() {
        chunks.push(KnowledgeChunkDraft {
            chapter_index: current_chapter_index,
            chapter_title: current_chapter_title,
            paragraph_index: current_paragraph_index,
            content: current.trim().to_string(),
        });
    }

    if chunks.is_empty() {
        return Err("未生成可嵌入的文本块".to_string());
    }

    let total_chars: usize = chunks
        .iter()
        .map(|chunk| chunk.content.chars().count())
        .sum();
    let _ = MIN_CHUNK_CHARS;
    log_chunk_summary(chunks.len(), total_chars);
    Ok(chunks)
}

fn log_chunk_summary(chunk_count: usize, char_count: usize) {
    crate::utils::logging::log_info(
        "knowledge-base",
        &format!(
            "chunking-complete chunks={} chars={}",
            chunk_count, char_count
        ),
    );
}

fn split_long_text(text: &str, max_chars: usize, overlap_chars: usize) -> Vec<String> {
    let text_chars: Vec<char> = text.chars().collect();
    if text_chars.len() <= max_chars {
        return vec![text.to_string()];
    }

    let sentence_boundaries = sentence_end_indices(&text_chars);
    let mut chunks = Vec::new();
    let mut start = 0_usize;

    while start < text_chars.len() {
        let mut end = (start + max_chars).min(text_chars.len());
        if end < text_chars.len() {
            if let Some(boundary) = sentence_boundaries
                .iter()
                .rev()
                .find(|boundary| **boundary > start && **boundary < end)
            {
                end = *boundary;
            }
        }

        let chunk: String = text_chars[start..end].iter().collect();
        chunks.push(chunk);

        if end >= text_chars.len() {
            break;
        }

        let overlap_start = start.saturating_add(max_chars.saturating_sub(overlap_chars));
        start = overlap_start.max(start + 1);
    }

    chunks
}

fn sentence_end_indices(text_chars: &[char]) -> Vec<usize> {
    let terminators = ['。', '！', '？', '.', '!', '?', '；', ';'];
    let mut indices = Vec::new();
    for (index, ch) in text_chars.iter().enumerate() {
        if terminators.contains(ch) {
            indices.push(index + 1);
        }
    }
    indices
}

#[cfg(test)]
mod tests {
    use super::{build_knowledge_chunks, split_long_text};
    use crate::service::kb::epub_knowledge_extractor::EpubKnowledgeParagraph;

    #[test]
    fn merges_short_paragraphs() {
        let paragraphs = vec![
            EpubKnowledgeParagraph {
                chapter_index: 0,
                chapter_title: "第一章".to_string(),
                paragraph_index: 0,
                text: "短段落一".to_string(),
            },
            EpubKnowledgeParagraph {
                chapter_index: 0,
                chapter_title: "第一章".to_string(),
                paragraph_index: 1,
                text: "短段落二".to_string(),
            },
        ];
        let chunks = build_knowledge_chunks(&paragraphs).unwrap();
        assert_eq!(chunks.len(), 1);
        assert!(chunks[0].content.contains("短段落一"));
        assert!(chunks[0].content.contains("短段落二"));
    }

    #[test]
    fn splits_long_paragraph() {
        let long_text = "句号结尾。".repeat(200);
        let parts = split_long_text(&long_text, 50, 5);
        assert!(parts.len() > 1);
    }
}
