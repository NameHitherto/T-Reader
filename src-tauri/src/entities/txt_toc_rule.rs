use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct TxtTocRule {
    pub enable: bool,
    #[serde(default)]
    pub example: String,
    pub id: i32,
    pub name: String,
    pub rule: String,
    #[serde(rename = "serialNumber")]
    pub serial_number: u32,
}

#[derive(Serialize)]
pub struct TxtTocRuleItem {
    pub id: i32,
    pub rule: String,
    #[serde(rename = "serialNumber")]
    pub serial_number: u32,
}
