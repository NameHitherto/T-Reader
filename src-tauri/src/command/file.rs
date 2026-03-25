use std::fs::{self, File};
use std::io::{Read, Write};
use std::collections::HashMap;

use crate::command::dir::{check_local_dirs, get_local_system_dir, get_local_progress_dir, get_local_books_dir};
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

#[tauri::command]
pub fn save_file(filename: &str, contents: &str, directory: Option<&str>) -> Result<(), String> {
    let path;
    #[cfg(target_os = "android")]
    {
        // 此时文档目录需要前端提供
        path = directory
            .map(|s| std::path::PathBuf::from(s))
            .unwrap_or_else(|| {
                std::path::PathBuf::from("T-Reader")
            });
    }
    #[cfg(not(target_os = "android"))]
    {
        // 在非安卓平台上显式忽略 directory 变量
        let _ = directory;
        // 检查并确保本地目录结构完整，文件保存到根目录
        path = check_local_dirs()?;
    }

    let file_path = path.join(filename);
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

#[tauri::command]
pub fn load_books(directory: Option<&str>) -> Result<Vec<Book>, String> {
    let path;
    #[cfg(target_os = "android")]
    {
        // 此时文档目录需要前端提供
        path = directory
            .map(|s| std::path::PathBuf::from(s))
            .unwrap_or_else(|| {
                std::path::PathBuf::from("T-Reader")
            });
    }
    #[cfg(not(target_os = "android"))]
    {
        // 在非安卓平台上显式忽略 directory 变量
        let _ = directory;
        // 检查并确保本地目录结构完整，书籍配置在 bookProgress 目录下
        path = get_local_progress_dir()?;
    }

    if !path.exists() {
        println!("目录 'bookProgress' 不存在，正在创建...");
        fs::create_dir_all(&path).map_err(|e| e.to_string())?;
        println!("目录 'bookProgress' 创建成功。");
    }

    let mut books = Vec::new();
    for entry in fs::read_dir(&path).map_err(|e| e.to_string())? {
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

#[tauri::command]
pub fn delete_book(filename: &str, directory: Option<&str>) -> Result<(), String> {
    // 检查并确保本地目录结构完整
    check_local_dirs()?;

    // 根据文件名判断删除哪个目录的文件
    let path;
    #[cfg(target_os = "android")]
    {
        // 此时文档目录需要前端提供
        path = directory
            .map(|s| std::path::PathBuf::from(s))
            .unwrap_or_else(|| {
                std::path::PathBuf::from("T-Reader")
            });
    }
    #[cfg(not(target_os = "android"))]
    {
        // 在非安卓平台上显式忽略 directory 变量
        let _ = directory;
        // JSON 文件在 bookProgress 目录，书籍文件在 books 目录
        if filename.ends_with(".json") {
            path = get_local_progress_dir()?;
        } else {
            path = get_local_books_dir()?;
        }
    }
    let file_path = path.join(filename);

    if file_path.exists() {
        fs::remove_file(&file_path).map_err(|e| e.to_string())?;
        println!("文件 '{}' 删除成功。", filename);
    } else {
        println!("文件 '{}' 不存在。", filename);
    }

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
