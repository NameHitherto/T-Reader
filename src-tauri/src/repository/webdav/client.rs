use reqwest::Client;
use std::time::Duration;

pub fn build_webdav_client() -> Client {
    Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .unwrap_or_else(|_| Client::new())
}
