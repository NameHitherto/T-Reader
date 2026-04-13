pub fn from_json_str<T>(contents: &str) -> Result<T, String>
where
    T: serde::de::DeserializeOwned,
{
    serde_json::from_str(contents).map_err(|error| error.to_string())
}
