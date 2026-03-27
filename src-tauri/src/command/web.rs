use futures_util::StreamExt;
use quick_xml::{events::Event, Reader};
use reqwest::Client;
use serde_json::json;
use std::collections::HashSet;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::Path;
use tauri::{AppHandle, Emitter};

use crate::command::dir::{
    check_cloud_dirs, check_local_dirs, CLOUD_BOOKS_DIR, CLOUD_PROGRESS_DIR,
};
use crate::command::load_settings;
use crate::logging::{finish_timer, log_error, log_info, start_timer};

fn is_supported_book_file(filename: &str) -> bool {
    filename.ends_with(".epub") || filename.ends_with(".txt")
}

fn is_config_file(filename: &str) -> bool {
    filename.ends_with(".json")
}

fn get_remote_file_url(base_url: &str, subdir: &str, filename: &str) -> String {
    format!("{}/{}/{}", base_url.trim_end_matches('/'), subdir, filename)
}

fn read_dur_chapter_time(contents: &[u8]) -> Option<i64> {
    let value = serde_json::from_slice::<serde_json::Value>(contents).ok()?;
    value
        .get("durChapterTime")
        .and_then(|dur_chapter_time| dur_chapter_time.as_i64())
}

fn should_upload_local_config(local_contents: &[u8], cloud_contents: &[u8]) -> bool {
    match (
        read_dur_chapter_time(local_contents),
        read_dur_chapter_time(cloud_contents),
    ) {
        (Some(local), Some(cloud)) => local > cloud,
        (Some(_), None) => true,
        (None, Some(_)) => false,
        (None, None) => false,
    }
}

async fn list_remote_files(
    client: &Client,
    base_url: &str,
    subdir: &str,
    username: &str,
    password: &str,
) -> Result<Vec<String>, String> {
    let started_at = start_timer("webdav", "list-remote-files");
    let url = format!("{}/{}/", base_url.trim_end_matches('/'), subdir);
    let response = client
        .request(http::Method::from_bytes(b"PROPFIND").unwrap(), &url)
        .basic_auth(username, Some(password))
        .header("Depth", "1")
        .send()
        .await
        .map_err(|e| format!("failed to list remote files: {:?}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "failed to list remote files: {:?}",
            response.status()
        ));
    }

    let body = response.text().await.map_err(|e| e.to_string())?;
    let files = parse_webdav_response(&body)?;
    log_info(
        "webdav",
        &format!("list-remote-files subdir={} total={}", subdir, files.len()),
    );
    finish_timer("webdav", "list-remote-files", started_at);
    Ok(files)
}

fn list_local_files(dir_path: &Path) -> Result<Vec<String>, String> {
    if !dir_path.exists() {
        fs::create_dir_all(dir_path).map_err(|e| e.to_string())?;
    }

    let mut files = Vec::new();
    for entry in fs::read_dir(dir_path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if let Some(file_name) = entry.path().file_name().and_then(|value| value.to_str()) {
            files.push(file_name.to_string());
        }
    }

    Ok(files)
}

async fn download_remote_file(
    client: &Client,
    base_url: &str,
    subdir: &str,
    filename: &str,
    username: &str,
    password: &str,
) -> Result<Vec<u8>, String> {
    let started_at = start_timer("webdav", "download-remote-file");
    let url = get_remote_file_url(base_url, subdir, filename);
    let response = client
        .get(&url)
        .basic_auth(username, Some(password))
        .send()
        .await
        .map_err(|e| format!("failed to download remote file: {:?}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "failed to download remote file: {:?}",
            response.status()
        ));
    }

    let bytes = response.bytes().await.map_err(|e| e.to_string())?.to_vec();
    log_info(
        "webdav",
        &format!(
            "download-remote-file subdir={} filename={} bytes={}",
            subdir,
            filename,
            bytes.len()
        ),
    );
    finish_timer("webdav", "download-remote-file", started_at);
    Ok(bytes)
}

async fn upload_remote_file(
    client: &Client,
    base_url: &str,
    subdir: &str,
    filename: &str,
    contents: Vec<u8>,
    username: &str,
    password: &str,
) -> Result<(), String> {
    let started_at = start_timer("webdav", "upload-remote-file");
    let content_len = contents.len();
    let url = get_remote_file_url(base_url, subdir, filename);
    let response = client
        .put(&url)
        .basic_auth(username, Some(password))
        .body(contents)
        .send()
        .await
        .map_err(|e| format!("failed to upload remote file: {:?}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "failed to upload remote file: {:?}",
            response.status()
        ));
    }

    log_info(
        "webdav",
        &format!(
            "upload-remote-file subdir={} filename={} bytes={}",
            subdir, filename, content_len
        ),
    );
    finish_timer("webdav", "upload-remote-file", started_at);
    Ok(())
}

#[tauri::command]
pub async fn webdav_upload(subdir: &str, filename: &str, contents: Vec<u8>) -> Result<(), String> {
    let started_at = start_timer("webdav", "webdav-upload");
    let settings = load_settings()?;
    check_cloud_dirs(&settings).await?;
    let client = Client::new();
    let result = upload_remote_file(
        &client,
        &settings.webdav_url,
        subdir,
        filename,
        contents,
        &settings.webdav_user,
        &settings.webdav_pass,
    )
    .await;
    if result.is_ok() {
        finish_timer("webdav", "webdav-upload", started_at);
    }
    result
}

#[tauri::command]
pub async fn webdav_get(subdir: &str, filename: &str) -> Result<Vec<u8>, String> {
    let started_at = start_timer("webdav", "webdav-get");
    let settings = load_settings()?;
    let client = Client::new();
    let result = download_remote_file(
        &client,
        &settings.webdav_url,
        subdir,
        filename,
        &settings.webdav_user,
        &settings.webdav_pass,
    )
    .await;
    if result.is_ok() {
        finish_timer("webdav", "webdav-get", started_at);
    }
    result
}

#[tauri::command]
pub async fn webdav_exists(subdir: &str, filename: &str) -> Result<bool, String> {
    let settings = load_settings()?;
    let client = Client::new();
    let url = get_remote_file_url(&settings.webdav_url, subdir, filename);

    let response = client
        .request(http::Method::from_bytes(b"PROPFIND").unwrap(), &url)
        .basic_auth(&settings.webdav_user, Some(&settings.webdav_pass))
        .header("Depth", "0")
        .send()
        .await
        .map_err(|e| format!("failed to check remote file exists: {:?}", e))?;

    if response.status().is_success() {
        return Ok(true);
    }

    if response.status().as_u16() == 404 {
        return Ok(false);
    }

    Err(format!(
        "failed to check remote file exists: {:?}",
        response.status()
    ))
}

#[tauri::command]
pub async fn webdav_delete(subdir: &str, filename: &str) -> Result<(), String> {
    let settings = load_settings()?;
    let client = Client::new();
    let url = get_remote_file_url(&settings.webdav_url, subdir, filename);

    let response = client
        .delete(&url)
        .basic_auth(&settings.webdav_user, Some(&settings.webdav_pass))
        .send()
        .await
        .map_err(|e| format!("failed to delete remote file: {:?}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "failed to delete remote file: {:?}",
            response.status()
        ));
    }

    log_info(
        "webdav",
        &format!("webdav-delete subdir={} filename={}", subdir, filename),
    );
    Ok(())
}

#[tauri::command]
pub async fn webdav_sync_files() -> Result<(), String> {
    let started_at = start_timer("webdav", "webdav-sync-files");
    let settings = load_settings()?;
    let client = Client::new();
    let base_url = settings.webdav_url.trim_end_matches('/').to_string();

    check_cloud_dirs(&settings).await?;
    let root_path = check_local_dirs()?;

    let books_path = root_path.join(CLOUD_BOOKS_DIR);
    let progress_path = root_path.join(CLOUD_PROGRESS_DIR);

    let local_books: HashSet<String> = list_local_files(&books_path)?
        .into_iter()
        .filter(|file_name| is_supported_book_file(file_name))
        .collect();
    let cloud_books: HashSet<String> = list_remote_files(
        &client,
        &base_url,
        CLOUD_BOOKS_DIR,
        &settings.webdav_user,
        &settings.webdav_pass,
    )
    .await?
    .into_iter()
    .filter(|file_name| is_supported_book_file(file_name))
    .collect();

    let local_configs: HashSet<String> = list_local_files(&progress_path)?
        .into_iter()
        .filter(|file_name| is_config_file(file_name))
        .collect();
    let cloud_configs: HashSet<String> = list_remote_files(
        &client,
        &base_url,
        CLOUD_PROGRESS_DIR,
        &settings.webdav_user,
        &settings.webdav_pass,
    )
    .await?
    .into_iter()
    .filter(|file_name| is_config_file(file_name))
    .collect();

    log_info(
        "webdav",
        &format!(
            "sync-snapshot local_books={} cloud_books={} local_configs={} cloud_configs={}",
            local_books.len(),
            cloud_books.len(),
            local_configs.len(),
            cloud_configs.len()
        ),
    );

    for file_name in local_books.difference(&cloud_books) {
        let file_path = books_path.join(file_name);
        let mut contents = Vec::new();
        File::open(&file_path)
            .map_err(|e| e.to_string())?
            .read_to_end(&mut contents)
            .map_err(|e| e.to_string())?;
        upload_remote_file(
            &client,
            &base_url,
            CLOUD_BOOKS_DIR,
            file_name,
            contents,
            &settings.webdav_user,
            &settings.webdav_pass,
        )
        .await?;
    }

    for file_name in cloud_books.difference(&local_books) {
        let contents = download_remote_file(
            &client,
            &base_url,
            CLOUD_BOOKS_DIR,
            file_name,
            &settings.webdav_user,
            &settings.webdav_pass,
        )
        .await?;
        let file_path = books_path.join(file_name);
        let mut file = File::create(file_path).map_err(|e| e.to_string())?;
        file.write_all(&contents).map_err(|e| e.to_string())?;
    }

    for file_name in local_configs.difference(&cloud_configs) {
        let file_path = progress_path.join(file_name);
        let mut contents = Vec::new();
        File::open(&file_path)
            .map_err(|e| e.to_string())?
            .read_to_end(&mut contents)
            .map_err(|e| e.to_string())?;
        upload_remote_file(
            &client,
            &base_url,
            CLOUD_PROGRESS_DIR,
            file_name,
            contents,
            &settings.webdav_user,
            &settings.webdav_pass,
        )
        .await?;
    }

    for file_name in cloud_configs.difference(&local_configs) {
        let contents = download_remote_file(
            &client,
            &base_url,
            CLOUD_PROGRESS_DIR,
            file_name,
            &settings.webdav_user,
            &settings.webdav_pass,
        )
        .await?;
        let file_path = progress_path.join(file_name);
        let mut file = File::create(file_path).map_err(|e| e.to_string())?;
        file.write_all(&contents).map_err(|e| e.to_string())?;
    }

    for file_name in local_configs.intersection(&cloud_configs) {
        let local_path = progress_path.join(file_name);
        let mut local_contents = Vec::new();
        File::open(&local_path)
            .map_err(|e| e.to_string())?
            .read_to_end(&mut local_contents)
            .map_err(|e| e.to_string())?;

        let cloud_contents = download_remote_file(
            &client,
            &base_url,
            CLOUD_PROGRESS_DIR,
            file_name,
            &settings.webdav_user,
            &settings.webdav_pass,
        )
        .await?;

        if should_upload_local_config(&local_contents, &cloud_contents) {
            upload_remote_file(
                &client,
                &base_url,
                CLOUD_PROGRESS_DIR,
                file_name,
                local_contents,
                &settings.webdav_user,
                &settings.webdav_pass,
            )
            .await?;
        } else {
            let mut file = File::create(&local_path).map_err(|e| e.to_string())?;
            file.write_all(&cloud_contents).map_err(|e| e.to_string())?;
        }
    }

    finish_timer("webdav", "webdav-sync-files", started_at);
    Ok(())
}

pub fn parse_webdav_response(response: &str) -> Result<Vec<String>, String> {
    let mut reader = Reader::from_str(response);
    reader.trim_text(true);
    let mut buf = Vec::new();
    let mut files = Vec::new();

    loop {
        match reader.read_event(&mut buf) {
            Ok(Event::Start(ref e)) if e.name() == b"d:href" => {
                if let Ok(href) = reader.read_text(b"d:href", &mut Vec::new()) {
                    if !href.ends_with('/') {
                        if let Some(file_name) = Path::new(&href).file_name() {
                            if let Some(file_name_str) = file_name.to_str() {
                                files.push(file_name_str.to_string());
                            }
                        }
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("failed to parse WebDAV response: {:?}", e)),
            _ => (),
        }
        buf.clear();
    }

    Ok(files)
}

#[tauri::command]
pub async fn start_stream(app: AppHandle, messages: String) -> Result<(), String> {
    let started_at = start_timer("ai-stream", "start-stream");
    let setting = load_settings()?;
    let client = Client::new();
    const EVENT_NAME: &str = "stream-chunk";
    if setting.is_ai_enabled != "true" {
        return Err("AI feature is disabled".to_string());
    }
    let api_key = setting.model_api_key;
    let api_url = setting.model_url;
    let model_name = setting.model_name;

    log_info(
        "ai-stream",
        &format!(
            "start-stream model={} message_chars={}",
            model_name,
            messages.len()
        ),
    );

    let request_body = json!({
        "model": model_name,
        "messages": serde_json::from_str::<serde_json::Value>(&messages)
            .map_err(|e| format!("failed to parse messages: {:?}", e))?,
        "stream": true
    })
    .to_string();

    let response = client
        .post(api_url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Accept", "text/event-stream")
        .body(request_body)
        .send()
        .await
        .map_err(|e| format!("failed to start stream: {:?}", e))?;

    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        match chunk {
            Ok(bytes) => {
                let chunk_vec: Vec<u8> = bytes.to_vec();
                let chunk_str = String::from_utf8_lossy(&chunk_vec);

                for data in chunk_str.split("data:") {
                    let data = data.trim();
                    if data.is_empty() {
                        continue;
                    }
                    let json_str = data.trim_end_matches('\n');

                    app.emit_to("reader", EVENT_NAME, json!({ "chunk": json_str }))
                        .map_err(|e| format!("failed to emit stream chunk: {:?}", e))?;
                }
            }
            Err(e) => {
                log_error("ai-stream", &format!("stream-receive failed error={}", e));
                return Err(format!("failed to receive stream data: {:?}", e));
            }
        }
    }

    finish_timer("ai-stream", "start-stream", started_at);
    Ok(())
}
