use std::fs::{self, File};
use std::io::{Read, Write};
use std::collections::HashMap;

use crate::command::dir::{check_local_dirs, get_local_system_dir, get_local_root_dir};
use crate::model::{Book, Settings};

#[tauri::command]
pub fn save_settings(json_str: &str) -> Result<(), String> {
    // 确保本地目录结构完整并获取系统目录路径
    let system_path = get_local_system_dir()?;

    // 确保系统目录存在
    if !system_path.exists() {
        fs::create_dir_all(&system_path).map_err(|e| e.to_string())?;
    }

    let settings_path = system_path.join("setting.json");

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
pub fn load_settings() -> Result<Settings, String> {
    // 确保本地目录结构完整并获取系统目录路径
    let system_path = get_local_system_dir()?;

    // 确保系统目录存在
    if !system_path.exists() {
        fs::create_dir_all(&system_path).map_err(|e| e.to_string())?;
    }

    let settings_path = system_path.join("setting.json");

    if !settings_path.exists() {
        return Err("Settings file not found".to_string());
    }

    let mut file = File::open(&settings_path).map_err(|e| e.to_string())?;
    let mut contents = String::new();
    file.read_to_string(&mut contents).map_err(|e| e.to_string())?;
    let settings: Settings = serde_json::from_str(&contents).map_err(|e| e.to_string())?;

    Ok(settings)
}

/// 保存文件到本地子目录
///
/// # 参数
/// - `subdir`: 子目录名称（如 "books", "bookProgress", "system" 等）
/// - `filename`: 文件名
/// - `contents`: 文件内容（文本格式）
#[tauri::command]
pub fn save_file(subdir: &str, filename: &str, contents: &str) -> Result<(), String> {
    // 检查并确保本地目录结构完整
    let root_path = check_local_dirs()?;

    // 构建子目录路径
    let dir_path = root_path.join(subdir);

    // 确保子目录存在
    if !dir_path.exists() {
        fs::create_dir_all(&dir_path).map_err(|e| e.to_string())?;
    }

    let file_path = dir_path.join(filename);
    println!("文件保存路径：{:?}", file_path);

    // 创建文件并写入内容
    let mut file = File::create(&file_path).map_err(|e| {
        println!("创建文件失败：{}", e);
        e.to_string()
    })?;
    println!("文件创建成功。");

    file.write_all(contents.as_bytes()).map_err(|e| {
        println!("写入文件失败：{}", e);
        e.to_string()
    })?;
    println!("文件 '{}' 保存成功。", file_path.display());

    Ok(())
}

/// 从本地子目录加载书籍配置列表
///
/// # 参数
/// - `subdir`: 子目录名称（如 "bookProgress"）
#[tauri::command]
pub fn load_books(subdir: &str) -> Result<Vec<Book>, String> {
    // 检查并确保本地目录结构完整
    let root_path = check_local_dirs()?;

    // 构建子目录路径
    let dir_path = root_path.join(subdir);

    if !dir_path.exists() {
        println!("目录 '{}' 不存在，正在创建...", subdir);
        fs::create_dir_all(&dir_path).map_err(|e| e.to_string())?;
        println!("目录 '{}' 创建成功。", subdir);
    }

    let mut books = Vec::new();
    for entry in fs::read_dir(&dir_path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let entry_path = entry.path();
        if entry_path.extension().and_then(|s| s.to_str()) == Some("json") {
            let mut file = File::open(&entry_path).map_err(|e| e.to_string())?;
            let mut contents = String::new();
            file.read_to_string(&mut contents)
                .map_err(|e| e.to_string())?;
            match serde_json::from_str::<Book>(&contents) {
                Ok(book) => books.push(book),
                Err(e) => {
                    println!("解析{}失败：{}", entry_path.display(), e);
                    continue;
                }
            }
        }
    }

    Ok(books)
}

/// 从本地子目录删除文件
///
/// # 参数
/// - `subdir`: 子目录名称（如 "books", "bookProgress"）
/// - `filename`: 文件名
#[tauri::command]
pub fn delete_book(subdir: &str, filename: &str) -> Result<(), String> {
    // 检查并确保本地目录结构完整
    check_local_dirs()?;

    // 构建子目录路径
    let root_path = get_local_root_dir()?;
    let dir_path = root_path.join(subdir);

    let file_path = dir_path.join(filename);

    if file_path.exists() {
        fs::remove_file(&file_path).map_err(|e| e.to_string())?;
        println!("文件 '{}' 删除成功。", filename);
    } else {
        println!("文件 '{}' 不存在。", filename);
    }

    Ok(())
}

/// 从本地子目录读取文件二进制内容
///
/// # 参数
/// - `subdir`: 子目录名称（如 "books", "bookProgress", "system" 等）
/// - `filename`: 文件名
#[tauri::command]
pub fn read_file(subdir: &str, filename: &str) -> Result<Vec<u8>, String> {
    // 检查并确保本地目录结构完整
    let root_path = check_local_dirs()?;

    // 构建子目录路径
    let dir_path = root_path.join(subdir);

    let file_path = dir_path.join(filename);
    println!("正在从 {} 读取文件：{}", subdir, filename);
    let mut file = File::open(&file_path).map_err(|e| {
        println!("打开文件失败：{}", e);
        e.to_string()
    })?;
    let mut contents = Vec::new();
    file.read_to_end(&mut contents).map_err(|e| e.to_string())?;
    Ok(contents)
}

/// 写入文件到本地子目录（二进制）
///
/// # 参数
/// - `subdir`: 子目录名称（如 "books", "bookProgress", "system" 等）
/// - `filename`: 文件名
/// - `contents`: 文件二进制内容
#[tauri::command]
pub fn write_file(subdir: &str, filename: &str, contents: Vec<u8>) -> Result<(), String> {
    // 检查并确保本地目录结构完整
    let root_path = check_local_dirs()?;

    // 构建子目录路径
    let dir_path = root_path.join(subdir);

    // 确保子目录存在
    if !dir_path.exists() {
        fs::create_dir_all(&dir_path).map_err(|e| e.to_string())?;
    }

    let file_path = dir_path.join(filename);
    println!("正在写入文件到 {}: {}", subdir, filename);

    let mut file = File::create(&file_path).map_err(|e| {
        println!("创建文件失败：{}", e);
        e.to_string()
    })?;

    file.write_all(&contents).map_err(|e| {
        println!("写入文件失败：{}", e);
        e.to_string()
    })?;

    println!("文件写入成功");
    Ok(())
}

#[tauri::command]
pub fn read_file_by_path(filepath: &str) -> Result<Vec<u8>, String> {
    println!("正在打开{}处的文件", filepath);
    let mut file = File::open(filepath).map_err(|e| e.to_string())?;
    let mut contents = Vec::new();
    file.read_to_end(&mut contents).map_err(|e| e.to_string())?;
    Ok(contents)
}
