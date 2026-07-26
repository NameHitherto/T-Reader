use tauri::State;

use crate::{
    database::DatabaseState,
    entities::{GalleryImageDto, GenerateGalleryImageRequest},
    repository::gallery,
    service::image_gen::image_gen_service,
};

#[tauri::command]
pub async fn list_gallery_images(
    database: State<'_, DatabaseState>,
    book_key: Option<String>,
) -> Result<Vec<GalleryImageDto>, String> {
    gallery::list_gallery_images(&database.pool, book_key.as_deref()).await
}

#[tauri::command]
pub async fn delete_gallery_image(
    database: State<'_, DatabaseState>,
    id: String,
) -> Result<(), String> {
    image_gen_service::delete_gallery_image(&database.pool, &id).await
}

#[tauri::command]
pub async fn generate_gallery_image(
    database: State<'_, DatabaseState>,
    request: GenerateGalleryImageRequest,
) -> Result<GalleryImageDto, String> {
    image_gen_service::generate_gallery_image(&database.pool, request).await
}
