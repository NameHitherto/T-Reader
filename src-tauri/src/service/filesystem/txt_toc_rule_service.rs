use crate::{
    entities::txt_toc_rule::TxtTocRuleItem,
    repository::local_fs::txt_toc_rule_repository::load_txt_toc_rules,
};

pub fn get_enabled_txt_toc_rules() -> Result<Vec<TxtTocRuleItem>, String> {
    let mut rules = load_txt_toc_rules()?
        .into_iter()
        .filter(|r| r.enable)
        .map(|r| TxtTocRuleItem {
            id: r.id,
            rule: r.rule,
            serial_number: r.serial_number,
        })
        .collect::<Vec<_>>();

    rules.sort_by_key(|r| r.serial_number);
    Ok(rules)
}
