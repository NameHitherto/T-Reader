use std::path::PathBuf;

use crate::{
    entities::txt_toc_rule::TxtTocRule,
    repository::local_fs::{dir_repository::get_local_system_dir, file_repository::read_text_file},
    utils::json::from_json_str,
};

const TXT_TOC_RULE_FILE: &str = "txtTocRule.json";

pub fn get_txt_toc_rule_path() -> Result<PathBuf, String> {
    Ok(get_local_system_dir()?.join(TXT_TOC_RULE_FILE))
}

pub fn load_txt_toc_rules() -> Result<Vec<TxtTocRule>, String> {
    let path = get_txt_toc_rule_path()?;

    if path.exists() {
        let content = read_text_file(&path)?;
        from_json_str(&content)
    } else {
        Ok(default_txt_toc_rules())
    }
}

fn default_txt_toc_rules() -> Vec<TxtTocRule> {
    from_json_str(DEFAULT_TXT_TOC_RULES).expect("default txt toc rules should be valid json")
}

const DEFAULT_TXT_TOC_RULES: &str = include_str!("../../constants/default_txt_toc_rules.json");
