use crate::{entities::TxtTocRuleItem, service::filesystem::txt_toc_rule_service};

#[tauri::command]
pub fn get_txt_toc_rules() -> Result<Vec<TxtTocRuleItem>, String> {
    txt_toc_rule_service::get_enabled_txt_toc_rules()
}
