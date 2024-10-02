// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command

use std::fs::{self, File};
use std::io::{self, Write, Read};
use std::env;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
struct Book {
    id: u64,
    cover: String,
    title: String,
    author: String,
    language: String,
    size: String,
    lastRead: String,
    added: String,
    path: String, 
}

#[tauri::command]
fn save_file(filename: &str, contents: &str) -> Result<(), String> {
    // 获取项目根目录
    let mut path = env::current_dir().map_err(|e| e.to_string())?;
    path.push("books");

    // 检查目录是否存在，如果不存在则创建
    if !path.exists() {
        println!("目录 'books' 不存在，正在创建...");
        fs::create_dir_all(&path).map_err(|e| e.to_string())?;
        println!("目录 'books' 创建成功。");
    } else {
        println!("目录 'books' 已存在。");
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
    let mut path = env::current_dir().map_err(|e| e.to_string())?;
    path.push("books");

    if !path.exists() {
        println!("目录 'books' 不存在，正在创建...");
        fs::create_dir_all(&path).map_err(|e| e.to_string())?;
        println!("目录 'books' 创建成功。");
    }

    let mut books = Vec::new();
    for entry in fs::read_dir(path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let mut file = File::open(entry.path()).map_err(|e| e.to_string())?;
        let mut contents = String::new();
        file.read_to_string(&mut contents).map_err(|e| e.to_string())?;
        let book: Book = serde_json::from_str(&contents).map_err(|e| e.to_string())?;
        books.push(book);
    }

    Ok(books)
}

#[tauri::command]
fn delete_book(filename: &str) -> Result<(), String> {
    let mut path = env::current_dir().map_err(|e| e.to_string())?;
    path.push("books");
    path.push(filename);

    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
        println!("书籍 '{}' 删除成功。", filename);
    } else {
        println!("书籍 '{}' 不存在。", filename);
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![save_file, load_books, delete_book])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}