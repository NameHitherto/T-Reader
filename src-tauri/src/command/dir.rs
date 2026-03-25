use dirs::document_dir;
use std::fs;
use serde::Serialize;

/// 本地目录结构配置
/// T-Reader/
///   ├── books/         # 书籍文件 (epub/txt)
///   ├── bookProgress/  # 阅读进度配置 (json)
///   ├── cached/        # 缓存文件
///   └── system/        # 系统文件 (设置等)
const LOCAL_BOOKS_DIR: &str = "books";
const LOCAL_PROGRESS_DIR: &str = "bookProgress";
const LOCAL_CACHED_DIR: &str = "cached";
pub const LOCAL_SYSTEM_DIR: &str = "system";

/// 云端目录结构配置
/// /T-Reader/
///   ├── books/         # 书籍文件 (epub/txt)
///   └── bookProgress/  # 阅读进度配置 (json)
pub const CLOUD_BOOKS_DIR: &str = "books";
pub const CLOUD_PROGRESS_DIR: &str = "bookProgress";

/// 本地目录子目录列表
const LOCAL_SUBDIRS: [&str; 4] = [LOCAL_BOOKS_DIR, LOCAL_PROGRESS_DIR, LOCAL_CACHED_DIR, LOCAL_SYSTEM_DIR];

/// 云端目录子目录列表
const CLOUD_SUBDIRS: [&str; 2] = [CLOUD_BOOKS_DIR, CLOUD_PROGRESS_DIR];

/// 本地目录名称结构（供前端查询）
#[derive(Serialize, Clone)]
pub struct LocalDirNames {
    pub books: String,
    pub progress: String,
    pub cached: String,
    pub system: String,
}

/// 云端目录名称结构（供前端查询）
#[derive(Serialize, Clone)]
pub struct CloudDirNames {
    pub books: String,
    pub progress: String,
}

/// 获取本地目录名称
pub fn get_local_dir_names() -> LocalDirNames {
    LocalDirNames {
        books: LOCAL_BOOKS_DIR.to_string(),
        progress: LOCAL_PROGRESS_DIR.to_string(),
        cached: LOCAL_CACHED_DIR.to_string(),
        system: LOCAL_SYSTEM_DIR.to_string(),
    }
}

/// 获取云端目录名称
pub fn get_cloud_dir_names() -> CloudDirNames {
    CloudDirNames {
        books: CLOUD_BOOKS_DIR.to_string(),
        progress: CLOUD_PROGRESS_DIR.to_string(),
    }
}

/// 获取本地 T-Reader 根目录路径
pub fn get_local_root_dir() -> Result<std::path::PathBuf, String> {
    let mut path = document_dir().ok_or("err finding document_dir")?;
    path.push("T-Reader");
    Ok(path)
}

/// 获取本地书籍目录路径
pub fn get_local_books_dir() -> Result<std::path::PathBuf, String> {
    let root = get_local_root_dir()?;
    Ok(root.join(LOCAL_BOOKS_DIR))
}

/// 获取本地进度目录路径
pub fn get_local_progress_dir() -> Result<std::path::PathBuf, String> {
    let root = get_local_root_dir()?;
    Ok(root.join(LOCAL_PROGRESS_DIR))
}

/// 获取本地缓存目录路径
pub fn get_local_cached_dir() -> Result<std::path::PathBuf, String> {
    let root = get_local_root_dir()?;
    Ok(root.join(LOCAL_CACHED_DIR))
}

/// 获取本地系统目录路径
pub fn get_local_system_dir() -> Result<std::path::PathBuf, String> {
    let root = get_local_root_dir()?;
    Ok(root.join(LOCAL_SYSTEM_DIR))
}

/// 检查并创建本地目录结构
/// 返回根目录路径
pub fn check_local_dirs() -> Result<std::path::PathBuf, String> {
    let root_path = get_local_root_dir()?;

    // 检查根目录是否存在，如果不存在则创建
    if !root_path.exists() {
        println!("本地根目录 'T-Reader' 不存在，正在创建...");
        fs::create_dir_all(&root_path).map_err(|e| {
            println!("创建本地根目录失败：{}", e);
            e.to_string()
        })?;
        println!("本地根目录 'T-Reader' 创建成功。");
    }

    // 检查并创建子目录
    for subdir in LOCAL_SUBDIRS.iter() {
        let subdir_path = root_path.join(subdir);
        if !subdir_path.exists() {
            println!("本地子目录 '{}' 不存在，正在创建...", subdir);
            fs::create_dir_all(&subdir_path).map_err(|e| {
                println!("创建子目录 {} 失败：{}", subdir, e);
                e.to_string()
            })?;
            println!("本地子目录 '{}' 创建成功。", subdir);
        }
    }

    println!("本地目录结构检查完成。");
    Ok(root_path)
}

/// 检查云端目录结构
/// 通过 MKCOL 方法检查并创建不存在的目录
pub async fn check_cloud_dirs(settings: &crate::model::Settings) -> Result<(), String> {
    let client = reqwest::Client::new();

    // 检查并创建每个子目录
    for subdir in CLOUD_SUBDIRS.iter() {
        let dir_url = format!("{}{}/", settings.webdav_url, subdir);

        // 使用 MKCOL 方法创建目录（如果已存在会返回 409，这是正常的）
        let response = client
            .request(http::Method::from_bytes(b"MKCOL").unwrap(), &dir_url)
            .basic_auth(&settings.webdav_user, Some(&settings.webdav_pass))
            .send()
            .await;

        match response {
            Ok(resp) => {
                let status = resp.status();
                if status.is_success() {
                    println!("云端目录 '{}' 创建成功。", subdir);
                } else if status.as_u16() == 409 {
                    // 409 Conflict 表示目录已存在
                    println!("云端目录 '{}' 已存在。", subdir);
                } else {
                    println!("云端目录 '{}' 检查/创建结果：{:?}", subdir, status);
                }
            }
            Err(e) => {
                println!("检查云端目录 '{}' 失败：{:?}", subdir, e);
                // 不返回错误，因为这可能只是目录已存在的正常情况
            }
        }
    }

    // 确保根目录存在（通过 MKCOL）
    let root_url = settings.webdav_url.trim_end_matches('/').to_string() + "/";
    let _ = client
        .request(http::Method::from_bytes(b"MKCOL").unwrap(), &root_url)
        .basic_auth(&settings.webdav_user, Some(&settings.webdav_pass))
        .send()
        .await;

    println!("云端目录结构检查完成。");
    Ok(())
}

/// Tauri 命令：检查本地目录结构
#[tauri::command]
pub fn check_local_dirs_command() -> Result<String, String> {
    let root_path = check_local_dirs()?;
    Ok(root_path.to_string_lossy().to_string())
}

/// Tauri 命令：检查云端目录结构
#[tauri::command]
pub async fn check_cloud_dirs_command() -> Result<(), String> {
    let settings = crate::command::load_settings()?;
    check_cloud_dirs(&settings).await
}

/// Tauri 命令：获取本地目录名称
#[tauri::command]
pub fn get_local_dir_names_command() -> LocalDirNames {
    get_local_dir_names()
}

/// Tauri 命令：获取云端目录名称
#[tauri::command]
pub fn get_cloud_dir_names_command() -> CloudDirNames {
    get_cloud_dir_names()
}
