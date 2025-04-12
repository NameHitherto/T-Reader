// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
use dirs::document_dir;
use quick_xml::events::Event;
use quick_xml::Reader;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::Path;
use std::collections::HashMap;
use serde_json::json;
use futures_util::StreamExt;

#[derive(Serialize, Deserialize)]
struct Book {
    id: String,
    cover: String,
    title: String,
    author: String,
    language: String,
    size: String,
    #[serde(rename = "lastRead")]
    last_read: String,
    added: String,
    path: String,
    location: String,
}

#[derive(Serialize, Deserialize)]
struct Settings {
    #[serde(rename = "webdavUrlRoot")]
    webdav_url_root: String,
    #[serde(rename = "webdavUrlFolder")]
    webdav_url_folder: String,
    #[serde(rename = "webdavUrl")]
    webdav_url: String,
    #[serde(rename = "webdavUser")]
    webdav_user: String,
    #[serde(rename = "webdavPass")]
    webdav_pass: String,
    #[serde(rename = "isAiEnabled")]
    is_ai_enabled: String,
    #[serde(rename = "modelName")]
    model_name: String,
    #[serde(rename = "modelUrl")]
    model_url: String,
    #[serde(rename = "modelApiKey")]
    model_api_key: String,
}

#[tauri::command]
fn save_settings(json_str: &str) -> Result<(), String> {
    let settings_path = document_dir()
        .ok_or("err finding document_dir")?
        .join("T-Reader")
        .join("setting.json");

    let mut settings: HashMap<String, String> = if settings_path.exists() {
        let mut file = File::open(&settings_path).map_err(|e| e.to_string())?;
        let mut contents = String::new();
        file.read_to_string(&mut contents).map_err(|e| e.to_string())?;
        serde_json::from_str(&contents).map_err(|e| e.to_string())?
    } else {
        HashMap::new()
    };

    let new_settings: HashMap<String, String> = serde_json::from_str(json_str).map_err(|e| e.to_string())?;
    for (key, value) in new_settings {
        settings.insert(key, value);
    }

    let settings_json = serde_json::to_string(&settings).map_err(|e| e.to_string())?;
    let mut file = File::create(&settings_path).map_err(|e| e.to_string())?;
    file.write_all(settings_json.as_bytes()).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn load_settings() -> Result<Settings, String> {
    let settings_path = document_dir()
        .ok_or("err finding document_dir")?
        .join("T-Reader")
        .join("setting.json");

    if !settings_path.exists() {
        return Err("Settings file not found".to_string());
    }

    let mut file = File::open(&settings_path).map_err(|e| e.to_string())?;
    let mut contents = String::new();
    file.read_to_string(&mut contents).map_err(|e| e.to_string())?;
    let settings: Settings = serde_json::from_str(&contents).map_err(|e| e.to_string())?;

    Ok(settings)
}

#[tauri::command]
fn save_file(filename: &str, contents: &str, directory: Option<&str>) -> Result<(), String> {
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
        // 在非安卓平台上显式忽略directory变量
        let _ = directory;
        // 获取项目文档目录
        path = document_dir().ok_or("err finding document_dir")?;
        path.push("T-Reader");
    }
    // 检查目录是否存在，如果不存在则创建
    if !path.exists() {
        println!("目录 'T-Reader' 不存在，正在创建...");
        fs::create_dir_all(&path).map_err(|e| e.to_string())?;
        println!("目录 'T-Reader' 创建成功。");
    } else {
        println!("目录 'T-Reader' 已存在。");
    }

    path.push(filename);
    println!("图书保存路径: {:?}", path);

    // 创建文件并写入内容
    let mut file = File::create(&path).map_err(|e| {
        println!("创建文件失败: {}", e);
        e.to_string()
    })?;
    println!("文件创建成功。");

    file.write_all(contents.as_bytes()).map_err(|e| {
        println!("写入书籍失败: {}", e);
        e.to_string()
    })?;
    println!("书籍 '{}' 保存成功。", path.display());

    Ok(())
}

#[tauri::command]
fn load_books(directory: Option<&str>) -> Result<Vec<Book>, String> {
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

    if !path.exists() {
        println!("目录 'T-Reader' 不存在，正在创建...");
        fs::create_dir_all(&path).map_err(|e| e.to_string())?;
        println!("目录 'T-Reader' 创建成功。");
    }

    let mut books = Vec::new();
    for entry in fs::read_dir(&path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            let mut file = File::open(&path).map_err(|e| e.to_string())?;
            let mut contents = String::new();
            file.read_to_string(&mut contents)
                .map_err(|e| e.to_string())?;
            match serde_json::from_str::<Book>(&contents) {
                Ok(book) => books.push(book),
                Err(e) => {
                    println!("解析{}失败: {}", path.display(), e);
                    continue;
                }
            }
        }
    }

    Ok(books)
}

#[tauri::command]
fn delete_book(filename: &str, directory: Option<&str>) -> Result<(), String> {
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
    path.push(filename);

    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
        println!("书籍 '{}' 删除成功。", filename);

        // 删除对应的 EPUB 文件，需要后续进行实现
    } else {
        println!("书籍 '{}' 不存在。", filename);
    }

    Ok(())
}

#[tauri::command]
fn read_file_by_path(filepath: &str) -> Result<Vec<u8>, String> {
    println!("正在打开{}处的文件", filepath);
    let mut file = File::open(filepath).map_err(|e| e.to_string())?;
    let mut contents = Vec::new();
    file.read_to_end(&mut contents).map_err(|e| e.to_string())?;
    Ok(contents)
}

#[tauri::command]
async fn webdav_upload(filename: &str, contents: Vec<u8>) -> Result<(), String> {
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
async fn webdav_get(filename: &str) -> Result<Vec<u8>, String> {
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
async fn webdav_delete(filename: &str) -> Result<(), String> {
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
async fn webdav_sync_files(directory: Option<&str>) -> Result<(), String> {
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

    // 分离出本地和云端的 epub 和 json 文件
    let local_epubs: Vec<String> = local_files.iter()
        .filter(|f| f.ends_with(".epub"))
        .cloned()
        .collect();
    
    let cloud_epubs: Vec<String> = cloud_files.iter()
        .filter(|f| f.ends_with(".epub"))
        .cloned()
        .collect();

    // 1. 处理本地和云端都存在的文件 - 保留epub，但下载json覆盖本地
    for epub in &local_epubs {
        if cloud_epubs.contains(epub) {
            let json_name = epub.replace(".epub", ".json");
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

    // 2. 处理本地有但云端没有的文件 - 上传到云端
    for epub in &local_epubs {
        if !cloud_epubs.contains(epub) {
            // 上传epub文件
            let epub_path = path.join(epub);
            let epub_content = fs::read(&epub_path).map_err(|e| format!("读取文件失败: {}", e))?;
            webdav_upload(epub, epub_content).await?;
            println!("同步: 上传本地 {} 到云端", epub);

            // 检查并上传对应的json文件
            let json_name = epub.replace(".epub", ".json");
            let json_path = path.join(&json_name);
            if json_path.exists() {
                let json_content = fs::read(&json_path).map_err(|e| format!("读取文件失败: {}", e))?;
                webdav_upload(&json_name, json_content).await?;
                println!("同步: 上传本地 {} 到云端", json_name);
            }
        }
    }

    // 3. 处理云端有但本地没有的文件 - 下载到本地
    for epub in &cloud_epubs {
        if !local_epubs.contains(epub) {
            // 下载epub文件
            let epub_content = webdav_get(epub).await?;
            let epub_path = path.join(epub);
            let mut file = File::create(epub_path).map_err(|e| e.to_string())?;
            file.write_all(&epub_content).map_err(|e| e.to_string())?;
            println!("同步: 下载云端 {} 到本地", epub);

            // 检查并下载对应的json文件
            let json_name = epub.replace(".epub", ".json");
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

fn parse_webdav_response(response: &str) -> Result<Vec<String>, String> {
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
async fn start_stream(app: AppHandle, messages: String) -> Result<(), String> {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            save_file,
            load_books,
            delete_book,
            read_file_by_path,
            webdav_upload,
            webdav_get,
            webdav_delete,
            webdav_sync_files,
            save_settings,
            load_settings,
            start_stream
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
