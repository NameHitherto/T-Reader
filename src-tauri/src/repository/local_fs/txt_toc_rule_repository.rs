use std::path::{Path, PathBuf};

use crate::{
    entities::txt_toc_rule::TxtTocRule,
    repository::local_fs::{
        dir_repository::get_local_system_dir,
        file_repository::{ensure_dir, read_text_file, write_binary_file},
    },
    utils::json::from_json_str,
};

const TXT_TOC_RULE_FILE: &str = "txtTocRule.json";

pub fn get_txt_toc_rules_path() -> Result<PathBuf, String> {
    Ok(get_local_system_dir()?.join(TXT_TOC_RULE_FILE))
}

pub fn load_txt_toc_rules() -> Result<Vec<TxtTocRule>, String> {
    let target_path = get_txt_toc_rules_path()?;
    if target_path.exists() {
        return load_txt_toc_rules_from_file(&target_path);
    }

    Ok(default_txt_toc_rules())
}

pub fn ensure_txt_toc_rules_file() -> Result<(), String> {
    let target_path = get_txt_toc_rules_path()?;
    if target_path.exists() {
        return Ok(());
    }

    if let Some(parent) = target_path.parent() {
        ensure_dir(parent)?;
    }

    let rules = load_txt_toc_rules()?;
    let content = serde_json::to_string_pretty(&rules).map_err(|error| error.to_string())?;
    write_binary_file(&target_path, content.as_bytes())
}

fn load_txt_toc_rules_from_file(path: &Path) -> Result<Vec<TxtTocRule>, String> {
    let content = read_text_file(path)?;
    from_json_str(&content)
}

fn default_txt_toc_rules() -> Vec<TxtTocRule> {
    from_json_str(DEFAULT_TXT_TOC_RULES).expect("default txt toc rules should be valid json")
}

const DEFAULT_TXT_TOC_RULES: &str = include_str!("../../constants/default_txt_toc_rules.json");
