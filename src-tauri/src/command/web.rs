use futures_util::StreamExt;
use quick_xml::{events::Event, Reader};
use reqwest::Client;
use serde_json::json;
use std::fs::{self, File};
use std::io::Write;
use std::path::Path;
use dirs::document_dir;
use tauri::{AppHandle, Emitter};

use crate::command::load_settings;

fn is_supported_book_file(filename: &str) -> bool {
    filename.ends_with(".epub") || filename.ends_with(".txt")
}

fn to_json_name(book_filename: &str) -> Option<String> {
    let stem = Path::new(book_filename).file_stem()?.to_str()?;
    Some(format!("{}.json", stem))
}

#[tauri::command]
pub async fn webdav_upload(filename: &str, contents: Vec<u8>) -> Result<(), String> {
    let settings = load_settings()?;
    let client = Client::new();
    let url = format!("{}{}", settings.webdav_url, filename);

    // 确保目标目录存在
    let mkcol_url = settings.webdav_url.to_string();
    let _ = client
        .request(http::Method::from_bytes(b"MKCOL").unwrap(), &mkcol_url)
        .basic_auth(&settings.webdav_user, Some(&settings.webdav_pass))
        .send()
        .await
        .map_err(|e| format!("创建目录失败: {:?}", e))?;

    // 上传文件
    let response = client
        .put(&url)
        .basic_auth(&settings.webdav_user, Some(&settings.webdav_pass))
        .body(contents)
        .send()
        .await
        .map_err(|e| format!("云同步文件上传失败: {:?}", e))?;

    if response.status().is_success() {
        println!("云同步文件上传成功");
    } else {
        println!("云同步文件上传失败: {:?}", response.status());
    }

    Ok(())
}

#[tauri::command]
pub async fn webdav_get(filename: &str) -> Result<Vec<u8>, String> {
    let settings = load_settings()?;
    let client = Client::new();
    let url = format!("{}{}", settings.webdav_url, filename);

    let response = client
        .get(&url)
        .basic_auth(&settings.webdav_user, Some(&settings.webdav_pass))
        .send()
        .await
        .map_err(|e| format!("云同步文件获取失败: {:?}", e))?;

    if response.status().is_success() {
        let body = response.bytes().await.map_err(|e| e.to_string())?;
        Ok(body.to_vec())
    } else {
        println!("云同步文件获取失败: {:?}", response.status());
        Err(format!("云同步文件获取失败: {:?}", response.status()))
    }
}

#[tauri::command]
pub async fn webdav_delete(filename: &str) -> Result<(), String> {
    let settings = load_settings()?;
    let client = Client::new();
    let url = format!("{}{}", settings.webdav_url, filename);

    let response = client
        .delete(&url)
        .basic_auth(&settings.webdav_user, Some(&settings.webdav_pass))
        .send()
        .await
        .map_err(|e| format!("云同步文件删除失败: {:?}", e))?;

    if response.status().is_success() {
        println!("云同步文件删除成功");
    } else {
        println!("云同步文件删除失败: {:?}", response.status());
    }

    Ok(())
}

#[tauri::command]
pub async fn webdav_sync_files(directory: Option<&str>) -> Result<(), String> {
    let settings = load_settings()?;
    let client = Client::new();
    let url = settings.webdav_url.to_string();

    // 获取云端文件列表
    let response = client
        .request(http::Method::from_bytes(b"PROPFIND").unwrap(), &url)
        .basic_auth(&settings.webdav_user, Some(&settings.webdav_pass))
        .header("Depth", "1")
        .send()
        .await
        .map_err(|e| format!("获取云端文件列表失败: {:?}", e))?;

    if !response.status().is_success() {
        return Err(format!("获取云端文件列表失败: {:?}", response.status()));
    }

    let body = response.text().await.map_err(|e| e.to_string())?;
    let cloud_files: Vec<String> = parse_webdav_response(&body)?;

    let mut path;
    #[cfg(target_os = "android")]
    {
        // 此时文档目录需要前端提供
        path = directory
            .map(|s| std::path::PathBuf::from(s))
            .unwrap_or_else(|| {
                document_dir()
                    .expect("err finding document_dir")
                    .join("T-Reader")
            });
    }
    #[cfg(not(target_os = "android"))]
    {
        path = document_dir().ok_or("err finding document_dir")?;
        path.push("T-Reader");
        // 在非安卓平台上显式忽略directory变量
        let _ = directory;
    }

    // 检查目录是否存在，如果不存在则创建
    if !path.exists() {
        println!("目录 'T-Reader' 不存在，正在创建...");
        fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }

    // 获取本地文件列表
    let mut local_files = Vec::new();
    for entry in fs::read_dir(&path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_path = entry.path();
        if let Some(file_name) = file_path.file_name() {
            if let Some(file_name_str) = file_name.to_str() {
                local_files.push(file_name_str.to_string());
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

    // 1. 处理本地和云端都存在的文件 - 保留书籍文件，但下载json覆盖本地
    for book in &local_books {
        if cloud_books.contains(book) {
            let Some(json_name) = to_json_name(book) else {
                continue;
            };
            if cloud_files.contains(&json_name) {
                // 下载云端json文件覆盖本地
                let json_content = webdav_get(&json_name).await?;
                let json_path = path.join(&json_name);
                let mut file = File::create(json_path).map_err(|e| e.to_string())?;
                file.write_all(&json_content).map_err(|e| e.to_string())?;
                println!("同步: 下载云端 {} 覆盖本地配置", json_name);
            }
        }
    }

    // 2. 处理本地有但云端没有的文件 - 删除本地文件
    for book in &local_books {
        if !cloud_books.contains(book) {
            // 删除本地书籍文件
            let book_path = path.join(book);
            fs::remove_file(&book_path).map_err(|e| format!("删除文件失败: {}", e))?;
            println!("同步: 删除本地 {}", book);
            // 检查并删除对应的json文件
            let Some(json_name) = to_json_name(book) else {
                continue;
            };
            let json_path = path.join(&json_name);
            if json_path.exists() {
                fs::remove_file(&json_path).map_err(|e| format!("删除文件失败: {}", e))?;
                println!("同步: 删除本地 {}", json_name);
            }
        }
    }

    // 3. 处理云端有但本地没有的文件 - 下载到本地
    for book in &cloud_books {
        if !local_books.contains(book) {
            // 下载书籍文件
            let book_content = webdav_get(book).await?;
            let book_path = path.join(book);
            let mut file = File::create(book_path).map_err(|e| e.to_string())?;
            file.write_all(&book_content).map_err(|e| e.to_string())?;
            println!("同步: 下载云端 {} 到本地", book);

            // 检查并下载对应的json文件
            let Some(json_name) = to_json_name(book) else {
                continue;
            };
            if cloud_files.contains(&json_name) {
                let json_content = webdav_get(&json_name).await?;
                let json_path = path.join(&json_name);
                let mut file = File::create(json_path).map_err(|e| e.to_string())?;
                file.write_all(&json_content).map_err(|e| e.to_string())?;
                println!("同步: 下载云端 {} 到本地", json_name);
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
            Err(e) => return Err(format!("解析 WebDAV 响应失败: {:?}", e)),
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
            .map_err(|e| format!("解析messages失败: {:?}", e))?,
        "stream": true
    }).to_string();

    // 发起SSE请求
    let response = client
        .post(api_url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Accept", "text/event-stream")
        .body(request_body)
        .send()
        .await
        .map_err(|e| format!("发起SSE请求失败: {:?}", e))?;

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
                        .map_err(|e| format!("发送流数据失败: {:?}", e))?;
                }
            }
            Err(e) => {
                return Err(format!("接收流数据失败: {:?}", e));
            }
        }
    }

    Ok(())
}