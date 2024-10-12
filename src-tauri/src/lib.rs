// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
use dirs::document_dir;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{Read, Write};

#[derive(Serialize, Deserialize)]
struct Book {
    id: u64,
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

#[tauri::command]
fn save_file(filename: &str, contents: &str) -> Result<(), String> {
    // 获取项目文档目录
    let mut path = document_dir().ok_or("err finding document_dir")?;
    path.push("T-Reader");

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
fn load_books() -> Result<Vec<Book>, String> {
    let mut path = document_dir().ok_or("err finding document_dir")?;
    path.push("T-Reader");

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
            match serde_json::from_str::<Book>(&contents){
                Ok(book) => books.push(book),
                Err(e) => {
                    println!("解析书籍失败: {}", e);
                    continue;
                }
            }
        }
    }

    Ok(books)
}

#[tauri::command]
fn delete_book(filename: &str) -> Result<(), String> {
    let mut path = document_dir().ok_or("err finding document_dir")?;
    path.push("T-Reader");
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![save_file, load_books, delete_book, read_file_by_path])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
