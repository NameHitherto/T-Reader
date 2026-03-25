use futures_util::StreamExt;
use quick_xml::{events::Event, Reader};
use reqwest::Client;
use serde_json::json;
use std::fs::{self, File};
use std::io::Write;
use std::path::Path;
use tauri::{AppHandle, Emitter};

use crate::command::dir::{check_cloud_dirs, check_local_dirs, CLOUD_BOOKS_DIR, CLOUD_PROGRESS_DIR};
use crate::command::load_settings;

fn is_supported_book_file(filename: &str) -> bool {
    filename.ends_with(".epub") || filename.ends_with(".txt")
}

fn to_json_name(book_filename: &str) -> Option<String> {
    let stem = Path::new(book_filename).file_stem()?.to_str()?;
    Some(format!("{}.json", stem))
}

/// 上传文件到云端指定子目录
///
/// # 参数
/// - `subdir`: 云端子目录名称（如 "books", "bookProgress"）
/// - `filename`: 文件名
/// - `contents`: 文件二进制内容
#[tauri::command]
pub async fn webdav_upload(subdir: &str, filename: &str, contents: Vec<u8>) -> Result<(), String> {
    let settings = load_settings()?;

    // 确保云端目录结构完整
    check_cloud_dirs(&settings).await?;

    let client = Client::new();
    let url = format!("{}{}/{}", settings.webdav_url, subdir, filename);

    // 上传文件
    let response = client
        .put(&url)
        .basic_auth(&settings.webdav_user, Some(&settings.webdav_pass))
        .body(contents)
        .send()
        .await
        .map_err(|e| format!("云同步文件上传失败：{:?}", e))?;

    if response.status().is_success() {
        println!("云同步文件上传成功");
    } else {
        println!("云同步文件上传失败：{:?}", response.status());
    }

    Ok(())
}

/// 从云端指定子目录获取文件
///
/// # 参数
/// - `subdir`: 云端子目录名称（如 "books", "bookProgress"）
/// - `filename`: 文件名
#[tauri::command]
pub async fn webdav_get(subdir: &str, filename: &str) -> Result<Vec<u8>, String> {
    let settings = load_settings()?;
    let client = Client::new();
    let url = format!("{}{}/{}", settings.webdav_url, subdir, filename);

    let response = client
        .get(&url)
        .basic_auth(&settings.webdav_user, Some(&settings.webdav_pass))
        .send()
        .await
        .map_err(|e| format!("云同步文件获取失败：{:?}", e))?;

    if response.status().is_success() {
        let body = response.bytes().await.map_err(|e| e.to_string())?;
        Ok(body.to_vec())
    } else {
        println!("云同步文件获取失败：{:?}", response.status());
        Err(format!("云同步文件获取失败：{:?}", response.status()))
    }
}

/// 从云端指定子目录删除文件
///
/// # 参数
/// - `subdir`: 云端子目录名称（如 "books", "bookProgress"）
/// - `filename`: 文件名
#[tauri::command]
pub async fn webdav_delete(subdir: &str, filename: &str) -> Result<(), String> {
    let settings = load_settings()?;
    let client = Client::new();
    let url = format!("{}{}/{}", settings.webdav_url, subdir, filename);

    let response = client
        .delete(&url)
        .basic_auth(&settings.webdav_user, Some(&settings.webdav_pass))
        .send()
        .await
        .map_err(|e| format!("云同步文件删除失败：{:?}", e))?;

    if response.status().is_success() {
        println!("云同步文件删除成功");
    } else {
        println!("云同步文件删除失败：{:?}", response.status());
    }

    Ok(())
}

/// 从云端指定子目录获取文件（原 bookProgress 目录专用）
///
/// # 参数
/// - `subdir`: 云端子目录名称（如 "bookProgress"）
/// - `filename`: 文件名
#[tauri::command]
pub async fn webdav_get_progress(subdir: &str, filename: &str) -> Result<Vec<u8>, String> {
    let settings = load_settings()?;
    let client = Client::new();
    let url = format!("{}{}/{}", settings.webdav_url, subdir, filename);

    let response = client
        .get(&url)
        .basic_auth(&settings.webdav_user, Some(&settings.webdav_pass))
        .send()
        .await
        .map_err(|e| format!("云同步文件获取失败：{:?}", e))?;

    if response.status().is_success() {
        let body = response.bytes().await.map_err(|e| e.to_string())?;
        Ok(body.to_vec())
    } else {
        Err(format!("云同步文件获取失败：{:?}", response.status()))
    }
}

/// 上传文件到云端指定子目录（原 bookProgress 目录专用）
///
/// # 参数
/// - `subdir`: 云端子目录名称（如 "bookProgress"）
/// - `filename`: 文件名
/// - `contents`: 文件二进制内容
#[tauri::command]
pub async fn webdav_upload_progress(subdir: &str, filename: &str, contents: Vec<u8>) -> Result<(), String> {
    let settings = load_settings()?;

    // 确保云端目录结构完整
    check_cloud_dirs(&settings).await?;

    let client = Client::new();
    let url = format!("{}{}/{}", settings.webdav_url, subdir, filename);

    let response = client
        .put(&url)
        .basic_auth(&settings.webdav_user, Some(&settings.webdav_pass))
        .body(contents)
        .send()
        .await
        .map_err(|e| format!("云同步文件上传失败：{:?}", e))?;

    if response.status().is_success() {
        println!("云同步进度文件上传成功");
    } else {
        println!("云同步进度文件上传失败：{:?}", response.status());
    }

    Ok(())
}

#[tauri::command]
pub async fn webdav_sync_files() -> Result<(), String> {
    let settings = load_settings()?;
    let client = Client::new();

    // 确保云端目录结构完整
    check_cloud_dirs(&settings).await?;

    // 获取云端根目录 URL（去掉末尾的 /）
    let base_url = settings.webdav_url.trim_end_matches('/').to_string();

    // 获取云端 books 目录文件列表
    let books_url = format!("{}/{}/", base_url, CLOUD_BOOKS_DIR);
    let response = client
        .request(http::Method::from_bytes(b"PROPFIND").unwrap(), &books_url)
        .basic_auth(&settings.webdav_user, Some(&settings.webdav_pass))
        .header("Depth", "1")
        .send()
        .await
        .map_err(|e| format!("获取云端文件列表失败：{:?}", e))?;

    if !response.status().is_success() {
        return Err(format!("获取云端文件列表失败：{:?}", response.status()));
    }

    let body = response.text().await.map_err(|e| e.to_string())?;
    let cloud_files: Vec<String> = parse_webdav_response(&body)?;

    // 获取本地根目录
    let root_path = check_local_dirs()?;

    // 获取本地 books 目录文件列表
    let books_path = root_path.join(CLOUD_BOOKS_DIR);
    if !books_path.exists() {
        fs::create_dir_all(&books_path).map_err(|e| e.to_string())?;
    }

    let mut local_files = Vec::new();
    for entry in fs::read_dir(&books_path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_path = entry.path();
        if let Some(file_name) = file_path.file_name() {
            if let Some(file_name_str) = file_name.to_str() {
                local_files.push(file_name_str.to_string());
            }
        }
    }

    // 获取云端 bookProgress 目录文件列表
    let progress_url = format!("{}/{}/", base_url, CLOUD_PROGRESS_DIR);
    let response = client
        .request(http::Method::from_bytes(b"PROPFIND").unwrap(), &progress_url)
        .basic_auth(&settings.webdav_user, Some(&settings.webdav_pass))
        .header("Depth", "1")
        .send()
        .await;

    let cloud_progress_files: Vec<String> = if let Ok(resp) = response {
        if resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            parse_webdav_response(&body).unwrap_or_default()
        } else {
            Vec::new()
        }
    } else {
        Vec::new()
    };

    // 获取本地 bookProgress 目录文件列表
    let progress_path = root_path.join(CLOUD_PROGRESS_DIR);
    if !progress_path.exists() {
        fs::create_dir_all(&progress_path).map_err(|e| e.to_string())?;
    }

    let mut local_progress_files = Vec::new();
    for entry in fs::read_dir(&progress_path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_path = entry.path();
        if let Some(file_name) = file_path.file_name() {
            if let Some(file_name_str) = file_name.to_str() {
                local_progress_files.push(file_name_str.to_string());
            }
        }
    }

    // 分离出本地和云端书籍文件（epub/txt）
    let local_books: Vec<String> = local_files
        .iter()
        .filter(|f| is_supported_book_file(f.as_str()))
        .cloned()
        .collect();

    let cloud_books: Vec<String> = cloud_files
        .iter()
        .filter(|f| is_supported_book_file(f.as_str()))
        .cloned()
        .collect();

    // 1. 处理本地和云端都存在的文件 - 保留书籍文件，但下载 json 覆盖本地
    for book in &local_books {
        if cloud_books.contains(book) {
            let Some(json_name) = to_json_name(book) else {
                continue;
            };
            if cloud_progress_files.contains(&json_name) {
                // 下载云端 json 文件覆盖本地
                let json_content = webdav_get_progress(CLOUD_PROGRESS_DIR, &json_name).await?;
                let json_path = progress_path.join(&json_name);
                let mut file = File::create(json_path).map_err(|e| e.to_string())?;
                file.write_all(&json_content).map_err(|e| e.to_string())?;
                println!("同步：下载云端 {} 覆盖本地配置", json_name);
            }
        }
    }

    // 2. 处理本地有但云端没有的文件 - 删除本地文件
    for book in &local_books {
        if !cloud_books.contains(book) {
            // 删除本地书籍文件
            let book_path = books_path.join(book);
            fs::remove_file(&book_path).map_err(|e| format!("删除文件失败：{}", e))?;
            println!("同步：删除本地 {}", book);
            // 检查并删除对应的 json 文件
            let Some(json_name) = to_json_name(book) else {
                continue;
            };
            let json_path = progress_path.join(&json_name);
            if json_path.exists() {
                fs::remove_file(&json_path).map_err(|e| format!("删除文件失败：{}", e))?;
                println!("同步：删除本地 {}", json_name);
            }
        }
    }

    // 3. 处理云端有但本地没有的文件 - 下载到本地
    for book in &cloud_books {
        if !local_books.contains(book) {
            // 下载书籍文件
            let book_content = webdav_get(CLOUD_BOOKS_DIR, book).await?;
            let book_path = books_path.join(book);
            let mut file = File::create(book_path).map_err(|e| e.to_string())?;
            file.write_all(&book_content).map_err(|e| e.to_string())?;
            println!("同步：下载云端 {} 到本地", book);

            // 检查并下载对应的 json 文件
            let Some(json_name) = to_json_name(book) else {
                continue;
            };
            if cloud_progress_files.contains(&json_name) {
                let json_content = webdav_get_progress(CLOUD_PROGRESS_DIR, &json_name).await?;
                let json_path = progress_path.join(&json_name);
                let mut file = File::create(json_path).map_err(|e| e.to_string())?;
                file.write_all(&json_content).map_err(|e| e.to_string())?;
                println!("同步：下载云端 {} 到本地", json_name);
            }
        }
    }

    println!("云同步完成");
    Ok(())
}

pub fn parse_webdav_response(response: &str) -> Result<Vec<String>, String> {
    // 解析 WebDAV 响应，提取文件列表
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
            Err(e) => return Err(format!("解析 WebDAV 响应失败：{:?}", e)),
            _ => (),
        }
        buf.clear();
    }

    Ok(files)
}

#[tauri::command]
pub async fn start_stream(app: AppHandle, messages: String) -> Result<(), String> {
    let setting = load_settings()?;
    let client = Client::new();
    const EVENT_NAME: &str = "stream-chunk";
    if setting.is_ai_enabled != "true" {
        return Err("AI 功能未启用".to_string());
    }
    let api_key = setting.model_api_key;
    let api_url = setting.model_url;
    let model_name = setting.model_name;

    // 构建请求体
    let request_body = json!({
        "model": model_name,
        "messages": serde_json::from_str::<serde_json::Value>(&messages)
            .map_err(|e| format!("解析 messages 失败：{:?}", e))?,
        "stream": true
    }).to_string();

    // 发起 SSE 请求
    let response = client
        .post(api_url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Accept", "text/event-stream")
        .body(request_body)
        .send()
        .await
        .map_err(|e| format!("发起 SSE 请求失败：{:?}", e))?;

    let mut stream = response.bytes_stream();

    // 处理流数据
    while let Some(chunk) = stream.next().await {
        match chunk {
            Ok(bytes) => {
                let chunk_vec: Vec<u8> = bytes.to_vec();
                let chunk_str = String::from_utf8_lossy(&chunk_vec);

                // 根据 "data:" 分割内容
                for data in chunk_str.split("data:") {
                    let data = data.trim(); // 去除前后空白
                    if data.is_empty() {
                        continue;
                    }
                    let json_str = data.trim_end_matches('\n');

                    app.emit_to("reader", EVENT_NAME, json!({"chunk": json_str}))
                        .map_err(|e| format!("发送流数据失败：{:?}", e))?;
                }
            }
            Err(e) => {
                return Err(format!("接收流数据失败：{:?}", e));
            }
        }
    }

    Ok(())
}
