use std::cmp::Reverse;

use fancy_regex::Regex;

use crate::{entities::txt_toc_rule::TxtTocRuleItem, utils::logging::log_info};

const DEFAULT_MIN_EFFECTIVE_GAP: usize = 1000;
const DEFAULT_MAX_LEN_NO_TOC: usize = 10 * 1024;
const DEFAULT_TRAILING_MERGE_LEN: usize = 100;

#[derive(Clone)]
pub(super) struct TxtChapter {
    pub(super) title: String,
    pub(super) lines: Vec<String>,
}

struct SplitOptions<'a> {
    forced_rule: Option<&'a str>,
    min_effective_gap: usize,
    max_len_no_toc: usize,
    trailing_merge_len: usize,
}

impl Default for SplitOptions<'_> {
    fn default() -> Self {
        Self {
            forced_rule: None,
            min_effective_gap: DEFAULT_MIN_EFFECTIVE_GAP,
            max_len_no_toc: DEFAULT_MAX_LEN_NO_TOC,
            trailing_merge_len: DEFAULT_TRAILING_MERGE_LEN,
        }
    }
}

pub(super) fn split_txt_to_chapters(
    content: &str,
    sample: &str,
    rules: &[TxtTocRuleItem],
) -> Vec<TxtChapter> {
    split_txt_to_chapters_with_options(content, sample, rules, &SplitOptions::default())
}

fn split_txt_to_chapters_with_options(
    content: &str,
    sample: &str,
    rules: &[TxtTocRuleItem],
    options: &SplitOptions<'_>,
) -> Vec<TxtChapter> {
    let selected_rule = options
        .forced_rule
        .map(str::to_owned)
        .or_else(|| select_best_toc_rule(sample, rules, options.min_effective_gap));

    if let Some(rule) = selected_rule {
        match analyze_with_rule(content, &rule) {
            Ok(chapters) if !chapters.is_empty() => return chapters,
            Ok(_) => {}
            Err(error) => log_info(
                "txt-epub",
                &format!("toc-rule-analysis-failed rule={rule} error={error}"),
            ),
        }
    }

    analyze_without_rule(content, options.max_len_no_toc, options.trailing_merge_len)
}

fn select_best_toc_rule(
    sample: &str,
    rules: &[TxtTocRuleItem],
    min_effective_gap: usize,
) -> Option<String> {
    let mut ordered_rules = rules.iter().collect::<Vec<_>>();
    ordered_rules.sort_by_key(|rule| Reverse(rule.serial_number));

    // Legado starts at one, so a rule must have at least one effective hit to win.
    let mut max_effective_hits = 1usize;
    let mut best_rule = None;

    for rule in ordered_rules {
        if rule.rule.trim().is_empty() {
            continue;
        }

        let regex = match compile_multiline_rule(&rule.rule) {
            Ok(regex) => regex,
            Err(error) => {
                log_info(
                    "txt-epub",
                    &format!(
                        "skip-invalid-toc-rule id={} rule={} error={}",
                        rule.id, rule.rule, error
                    ),
                );
                continue;
            }
        };

        let effective_hits = match count_effective_hits(sample, &regex, min_effective_gap) {
            Ok(count) => count,
            Err(error) => {
                log_info(
                    "txt-epub",
                    &format!(
                        "skip-failed-toc-rule id={} rule={} error={}",
                        rule.id, rule.rule, error
                    ),
                );
                continue;
            }
        };

        // Rules are traversed from larger to smaller serialNumber. Replacing on ties
        // therefore reproduces Legado's reversed() + >= preference for smaller numbers.
        if effective_hits >= max_effective_hits {
            max_effective_hits = effective_hits;
            best_rule = Some(rule.rule.clone());
        }
    }

    best_rule
}

fn compile_multiline_rule(rule: &str) -> Result<Regex, String> {
    // Legado compiles every toc rule with Java Pattern.MULTILINE. Prefixing the
    // equivalent inline flag keeps ^ and $ line-aware while preserving rule flags.
    // Java accepts bounded variable-length lookbehind while fancy-regex does not.
    // A positive lookbehind whose only atom is repeated {0,n} is always true, so
    // removing that assertion preserves Java semantics and supports Legado's defaults.
    let compatible_rule = remove_always_true_lookbehinds(rule);
    Regex::new(&format!("(?m){compatible_rule}")).map_err(|error| error.to_string())
}

fn remove_always_true_lookbehinds(rule: &str) -> String {
    let mut compatible = String::with_capacity(rule.len());
    let mut cursor = 0usize;

    while let Some(relative_start) = rule[cursor..].find("(?<=") {
        let start = cursor + relative_start;
        compatible.push_str(&rule[cursor..start]);

        let body_start = start + "(?<=".len();
        let Some(relative_end) = rule[body_start..].find(')') else {
            compatible.push_str(&rule[start..]);
            return compatible;
        };
        let end = body_start + relative_end;
        let body = &rule[body_start..end];

        if is_zero_minimum_single_atom_repetition(body) {
            cursor = end + 1;
        } else {
            compatible.push_str(&rule[start..=end]);
            cursor = end + 1;
        }
    }

    compatible.push_str(&rule[cursor..]);
    compatible
}

fn is_zero_minimum_single_atom_repetition(body: &str) -> bool {
    let Some(quantifier_start) = body.rfind("{0,") else {
        return false;
    };
    let atom = &body[..quantifier_start];
    let quantifier = &body[quantifier_start..];

    if !quantifier.ends_with('}')
        || quantifier[3..quantifier.len() - 1]
            .chars()
            .any(|character| !character.is_ascii_digit())
    {
        return false;
    }

    if atom.starts_with('[') && atom.ends_with(']') {
        return true;
    }

    (atom.starts_with('\\') && atom.chars().count() == 2) || atom.chars().count() == 1
}

fn count_effective_hits(
    content: &str,
    regex: &Regex,
    min_effective_gap: usize,
) -> Result<usize, String> {
    let mut effective_hits = 0usize;
    let mut previous_accepted_end = None;
    let mut search_from = 0usize;

    while search_from <= content.len() {
        let Some(found) = regex
            .find_from_pos(content, search_from)
            .map_err(|error| error.to_string())?
        else {
            break;
        };

        let is_effective = previous_accepted_end.is_none_or(|previous_end| {
            content[previous_end..found.start()].chars().count() > min_effective_gap
        });

        if is_effective {
            effective_hits += 1;
            previous_accepted_end = Some(found.end());
        }

        let Some(next_position) = next_search_position(content, found.start(), found.end()) else {
            break;
        };
        search_from = next_position;
    }

    Ok(effective_hits)
}

fn analyze_with_rule(content: &str, rule: &str) -> Result<Vec<TxtChapter>, String> {
    let regex = compile_multiline_rule(rule)?;
    let matches = collect_matches(content, &regex)?;

    if matches.is_empty() {
        return Ok(Vec::new());
    }

    let mut chapters = Vec::with_capacity(matches.len() + 1);
    let first_start = matches[0].0;
    if has_non_blank(&content[..first_start]) {
        chapters.push(TxtChapter {
            title: "前言".to_string(),
            lines: text_to_lines(&content[..first_start]),
        });
    }

    for (index, (start, end)) in matches.iter().copied().enumerate() {
        let body_end = matches
            .get(index + 1)
            .map(|(next_start, _)| *next_start)
            .unwrap_or(content.len());

        chapters.push(TxtChapter {
            title: normalize_heading(&content[start..end]),
            lines: text_to_lines(&content[end..body_end]),
        });
    }

    Ok(chapters)
}

fn collect_matches(content: &str, regex: &Regex) -> Result<Vec<(usize, usize)>, String> {
    let mut matches = Vec::new();
    let mut search_from = 0usize;

    while search_from <= content.len() {
        let Some(found) = regex
            .find_from_pos(content, search_from)
            .map_err(|error| error.to_string())?
        else {
            break;
        };
        matches.push((found.start(), found.end()));

        let Some(next_position) = next_search_position(content, found.start(), found.end()) else {
            break;
        };
        search_from = next_position;
    }

    Ok(matches)
}

fn next_search_position(content: &str, start: usize, end: usize) -> Option<usize> {
    if end > start {
        return Some(end);
    }
    if end >= content.len() {
        return None;
    }

    content[end..]
        .chars()
        .next()
        .map(|character| end + character.len_utf8())
}

fn analyze_without_rule(
    content: &str,
    max_len: usize,
    trailing_merge_len: usize,
) -> Vec<TxtChapter> {
    if content.is_empty() {
        return vec![TxtChapter {
            title: "正文".to_string(),
            lines: Vec::new(),
        }];
    }

    let max_len = max_len.max(1);
    let mut ranges = Vec::new();
    let mut start = 0usize;

    while start < content.len() {
        let remaining = content.len() - start;
        if !ranges.is_empty() && remaining < trailing_merge_len {
            if let Some((_, previous_end)) = ranges.last_mut() {
                *previous_end = content.len();
            }
            break;
        }

        let end = find_fallback_split_end(content, start, max_len);
        ranges.push((start, end));
        start = end;
    }

    ranges
        .into_iter()
        .enumerate()
        .map(|(index, (start, end))| TxtChapter {
            title: format!("第{}章({start})", index + 1),
            lines: text_to_lines(&content[start..end]),
        })
        .collect()
}

fn find_fallback_split_end(content: &str, start: usize, max_len: usize) -> usize {
    let remaining = content.len() - start;
    if remaining <= max_len {
        return content.len();
    }

    let mut target = start + max_len;
    while target > start && !content.is_char_boundary(target) {
        target -= 1;
    }

    if let Some(relative_newline) = content[target..].find('\n') {
        return target + relative_newline + 1;
    }

    if target > start {
        target
    } else {
        content[start..]
            .chars()
            .next()
            .map(|character| start + character.len_utf8())
            .unwrap_or(content.len())
    }
}

fn text_to_lines(text: &str) -> Vec<String> {
    text.split('\n').map(str::to_owned).collect()
}

fn has_non_blank(text: &str) -> bool {
    text.chars().any(|character| !character.is_whitespace())
}

fn normalize_heading(raw: &str) -> String {
    let heading = raw.trim();
    if heading.is_empty() {
        "未命名章节".to_string()
    } else {
        heading.to_string()
    }
}
