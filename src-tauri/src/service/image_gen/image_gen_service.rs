use std::{
    fs,
    path::{Path, PathBuf},
    time::Duration,
};

use base64::Engine;
use reqwest::Client;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::{
    entities::{GalleryImageDto, GenerateGalleryImageRequest, ModelProviderConfig},
    repository::{
        gallery, local_fs::dir_repository::get_local_root_dir, settings,
        system::proxy_repository::resolve_request_proxy_url,
    },
    utils::logging::{log_error, log_info, log_warn},
};

const GALLERY_SUBDIR: &str = "cached/gallery";
const IMAGE_MODEL_PURPOSE: &str = "image";
const DEFAULT_GENERATIONS_ENDPOINT: &str = "/v1/images/generations";
const EDITS_ENDPOINT: &str = "/v1/images/edits";
const REQUEST_TIMEOUT_SECS: u64 = 180;

fn sniff_image(bytes: &[u8]) -> Option<(&'static str, &'static str)> {
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some(("jpg", "image/jpeg"))
    } else if bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]) {
        Some(("png", "image/png"))
    } else if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some(("webp", "image/webp"))
    } else {
        None
    }
}

fn get_gallery_root() -> Result<PathBuf, String> {
    Ok(get_local_root_dir()?.join(GALLERY_SUBDIR))
}

fn validate_staged_path(relative_path: &str) -> Result<(), String> {
    let normalized = relative_path.replace('\\', "/");
    if normalized.contains("..") || !normalized.starts_with(&format!("{}/", GALLERY_SUBDIR)) {
        return Err(format!("非法的参考图路径: {}", relative_path));
    }
    Ok(())
}

async fn load_image_provider(pool: &SqlitePool) -> Result<ModelProviderConfig, String> {
    let provider = settings::load_app_settings(pool)
        .await?
        .model_providers
        .get(IMAGE_MODEL_PURPOSE)
        .cloned();

    match provider {
        Some(provider) if !provider.base_url.trim().is_empty() && !provider.model_id.trim().is_empty() => {
            Ok(provider)
        }
        _ => Err("请先在设置中配置图像模型".to_string()),
    }
}

fn build_image_client(proxy_enabled: bool) -> Client {
    let mut builder = Client::builder().timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS));

    match resolve_request_proxy_url(proxy_enabled) {
        Some(proxy_url) => {
            if let Ok(reqwest_proxy) = reqwest::Proxy::all(&proxy_url) {
                log_info("image-gen", &format!("using-proxy url={}", proxy_url));
                builder = builder.proxy(reqwest_proxy);
            }
        }
        None => {
            builder = builder.no_proxy();
        }
    }

    builder.build().unwrap_or_else(|_| Client::new())
}

fn build_request_url(base_url: &str, endpoint: &str) -> String {
    format!("{}{}", base_url.trim_end_matches('/'), endpoint)
}

/// 把前端暂存到 cached/gallery/_staging 的参考图移动到本次生成的 refs 目录，
/// 返回 (相对路径列表, 参考图字节列表)。
fn collect_reference_images(
    root_dir: &Path,
    image_dir_relative: &str,
    staged_paths: &[String],
) -> Result<(Vec<String>, Vec<Vec<u8>>), String> {
    if staged_paths.is_empty() {
        return Ok((Vec::new(), Vec::new()));
    }

    let refs_relative = format!("{}/refs", image_dir_relative);
    let refs_dir = root_dir.join(&refs_relative);
    fs::create_dir_all(&refs_dir).map_err(|error| format!("创建参考图目录失败: {}", error))?;

    let mut reference_paths = Vec::new();
    let mut reference_bytes = Vec::new();

    for (index, staged) in staged_paths.iter().enumerate() {
        validate_staged_path(staged)?;
        let source = root_dir.join(staged);
        let bytes = fs::read(&source).map_err(|error| format!("读取参考图失败: {}", error))?;
        let Some((extension, _)) = sniff_image(&bytes) else {
            return Err("参考图仅支持 JPG/JPEG、PNG 或 WebP".to_string());
        };

        let file_name = format!("ref-{}.{}", index + 1, extension);
        let target = refs_dir.join(&file_name);
        fs::write(&target, &bytes).map_err(|error| format!("保存参考图失败: {}", error))?;
        if let Err(error) = fs::remove_file(&source) {
            log_warn(
                "image-gen",
                &format!("remove-staged failed path={} error={}", staged, error),
            );
        }

        reference_paths.push(format!("{}/{}", refs_relative, file_name));
        reference_bytes.push(bytes);
    }

    Ok((reference_paths, reference_bytes))
}

async fn request_image_bytes(
    client: &Client,
    provider: &ModelProviderConfig,
    prompt: &str,
    size: Option<&str>,
    reference_bytes: &[Vec<u8>],
) -> Result<Vec<u8>, String> {
    let response = if reference_bytes.is_empty() {
        let endpoint = if provider.endpoint.trim().is_empty() {
            DEFAULT_GENERATIONS_ENDPOINT
        } else {
            provider.endpoint.trim()
        };
        let mut body = serde_json::json!({
            "model": provider.model_id,
            "prompt": prompt,
            "n": 1,
            "response_format": "b64_json",
        });
        if let Some(size) = size {
            body["size"] = serde_json::Value::String(size.to_string());
        }

        client
            .post(build_request_url(&provider.base_url, endpoint))
            .bearer_auth(&provider.api_key)
            .json(&body)
            .send()
            .await
    } else {
        let mut form = reqwest::multipart::Form::new()
            .text("model", provider.model_id.clone())
            .text("prompt", prompt.to_string())
            .text("n", "1")
            .text("response_format", "b64_json");
        if let Some(size) = size {
            form = form.text("size", size.to_string());
        }
        for (index, bytes) in reference_bytes.iter().enumerate() {
            let Some((extension, mime_type)) = sniff_image(bytes) else {
                return Err("参考图仅支持 JPG/JPEG、PNG 或 WebP".to_string());
            };
            let part = reqwest::multipart::Part::bytes(bytes.clone())
                .file_name(format!("ref-{}.{}", index + 1, extension))
                .mime_str(mime_type)
                .map_err(|error| format!("构建参考图请求失败: {}", error))?;
            form = form.part("image[]", part);
        }

        client
            .post(build_request_url(&provider.base_url, EDITS_ENDPOINT))
            .bearer_auth(&provider.api_key)
            .multipart(form)
            .send()
            .await
    };

    let response = response.map_err(|error| format!("图像生成请求失败: {}", error))?;
    let status = response.status();
    let body_text = response
        .text()
        .await
        .map_err(|error| format!("读取图像生成响应失败: {}", error))?;

    if !status.is_success() {
        let snippet: String = body_text.chars().take(500).collect();
        log_error(
            "image-gen",
            &format!("request failed status={} body={}", status, snippet),
        );
        return Err(format!("图像生成失败({}): {}", status.as_u16(), snippet));
    }

    let payload: serde_json::Value = serde_json::from_str(&body_text)
        .map_err(|error| format!("解析图像生成响应失败: {}", error))?;
    let first_item = payload
        .get("data")
        .and_then(|data| data.get(0))
        .ok_or_else(|| "图像生成响应中没有图片数据".to_string())?;

    if let Some(b64_content) = first_item.get("b64_json").and_then(|value| value.as_str()) {
        return base64::engine::general_purpose::STANDARD
            .decode(b64_content)
            .map_err(|error| format!("解码图片数据失败: {}", error));
    }

    if let Some(image_url) = first_item.get("url").and_then(|value| value.as_str()) {
        let download = client
            .get(image_url)
            .send()
            .await
            .map_err(|error| format!("下载生成图片失败: {}", error))?;
        if !download.status().is_success() {
            return Err(format!("下载生成图片失败({})", download.status().as_u16()));
        }
        return download
            .bytes()
            .await
            .map(|bytes| bytes.to_vec())
            .map_err(|error| format!("下载生成图片失败: {}", error));
    }

    Err("图像生成响应中没有 b64_json 或 url 字段".to_string())
}

pub async fn generate_gallery_image(
    pool: &SqlitePool,
    request: GenerateGalleryImageRequest,
) -> Result<GalleryImageDto, String> {
    let prompt = request.prompt.trim().to_string();
    if prompt.is_empty() {
        return Err("提示词不能为空".to_string());
    }

    let provider = load_image_provider(pool).await?;
    let root_dir = get_local_root_dir()?;

    let id = Uuid::new_v4().to_string();
    let image_dir_relative = format!("{}/{}", GALLERY_SUBDIR, id);
    let image_dir = root_dir.join(&image_dir_relative);
    fs::create_dir_all(&image_dir).map_err(|error| format!("创建图片目录失败: {}", error))?;

    let result = generate_into_dir(
        pool,
        &provider,
        &root_dir,
        &image_dir_relative,
        &id,
        &prompt,
        &request,
    )
    .await;

    if result.is_err() {
        if let Err(error) = fs::remove_dir_all(&image_dir) {
            log_warn(
                "image-gen",
                &format!("cleanup failed dir={} error={}", image_dir.display(), error),
            );
        }
    }

    result
}

async fn generate_into_dir(
    pool: &SqlitePool,
    provider: &ModelProviderConfig,
    root_dir: &Path,
    image_dir_relative: &str,
    id: &str,
    prompt: &str,
    request: &GenerateGalleryImageRequest,
) -> Result<GalleryImageDto, String> {
    let (reference_paths, reference_bytes) =
        collect_reference_images(root_dir, image_dir_relative, &request.reference_paths)?;

    log_info(
        "image-gen",
        &format!(
            "generating id={} provider={} model={} refs={}",
            id,
            provider.provider_type,
            provider.model_id,
            reference_bytes.len()
        ),
    );

    let proxy_enabled = settings::load_app_settings(pool)
        .await
        .map(|value| value.proxy_enabled)
        .unwrap_or(false);
    let client = build_image_client(proxy_enabled);
    let image_bytes = request_image_bytes(
        &client,
        provider,
        prompt,
        request.size.as_deref(),
        &reference_bytes,
    )
    .await?;

    let Some((extension, _)) = sniff_image(&image_bytes) else {
        return Err("生成的图片格式无法识别".to_string());
    };
    let image_path = format!("{}/image.{}", image_dir_relative, extension);
    fs::write(root_dir.join(&image_path), &image_bytes)
        .map_err(|error| format!("保存生成图片失败: {}", error))?;

    let dto = GalleryImageDto {
        id: id.to_string(),
        book_key: request.book_key.clone(),
        book_title: request.book_title.clone().unwrap_or_default(),
        prompt: prompt.to_string(),
        provider_type: provider.provider_type.clone(),
        model_id: provider.model_id.clone(),
        image_path,
        reference_paths: serde_json::to_string(&reference_paths)
            .map_err(|error| format!("序列化参考图路径失败: {}", error))?,
        image_size: request.size.clone(),
        created_at: String::new(),
    };

    let inserted = gallery::insert_gallery_image(pool, &dto).await?;
    log_info("image-gen", &format!("generated id={} path={}", id, inserted.image_path));
    Ok(inserted)
}

pub async fn delete_gallery_image(pool: &SqlitePool, id: &str) -> Result<(), String> {
    let record = gallery::get_gallery_image(pool, id).await?;
    gallery::delete_gallery_image(pool, id).await?;

    if record.is_some() {
        let image_dir = get_gallery_root()?.join(id);
        if image_dir.exists() {
            if let Err(error) = fs::remove_dir_all(&image_dir) {
                log_warn(
                    "image-gen",
                    &format!("remove-dir failed dir={} error={}", image_dir.display(), error),
                );
            }
        }
    }

    log_info("image-gen", &format!("deleted id={}", id));
    Ok(())
}
