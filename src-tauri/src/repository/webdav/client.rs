use reqwest::Client;

pub fn build_webdav_client() -> Client {
    Client::new()
}
