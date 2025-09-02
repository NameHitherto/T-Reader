use dirs::document_dir;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::collections::HashMap;

use crate::model::{Book, Settings};

#[tauri::command]
pub fn save_settings(json_str: &str) -> Result<(), String> {
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
pub fn load_settings() -> Result<Settings, String> {
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
pub fn save_file(filename: &str, contents: &str, directory: Option<&str>) -> Result<(), String> {
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
pub fn load_books(directory: Option<&str>) -> Result<Vec<Book>, String> {
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
pub fn delete_book(filename: &str, directory: Option<&str>) -> Result<(), String> {
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
pub fn read_file_by_path(filepath: &str) -> Result<Vec<u8>, String> {
    println!("正在打开{}处的文件", filepath);
    let mut file = File::open(filepath).map_err(|e| e.to_string())?;
    let mut contents = Vec::new();
    file.read_to_end(&mut contents).map_err(|e| e.to_string())?;
    Ok(contents)
}