use serde::Serialize;
use std::collections::HashMap;

pub fn from_json_str<T>(contents: &str) -> Result<T, String>
where
    T: serde::de::DeserializeOwned,
{
    serde_json::from_str(contents).map_err(|error| error.to_string())
}

pub fn to_pretty_json_string<T>(value: &T) -> Result<String, String>
where
    T: Serialize,
{
    serde_json::to_string_pretty(value).map_err(|error| error.to_string())
}

pub fn merge_string_maps(
    current: HashMap<String, String>,
    next: HashMap<String, String>,
) -> HashMap<String, String> {
    let mut merged = current;
    for (key, value) in next {
        merged.insert(key, value);
    }
    merged
}
