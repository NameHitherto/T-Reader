use sqlx::SqlitePool;

use crate::entities::GalleryImageDto;

const SELECT_COLUMNS: &str = r#"
    id, book_key, book_title, prompt, provider_type, model_id,
    image_path, reference_paths, image_size, created_at
"#;

pub async fn list_gallery_images(
    pool: &SqlitePool,
    book_key: Option<&str>,
) -> Result<Vec<GalleryImageDto>, String> {
    match book_key {
        Some(book_key) => sqlx::query_as::<_, GalleryImageDto>(&format!(
            r#"
            SELECT {SELECT_COLUMNS}
            FROM gallery_images
            WHERE book_key = ?
            ORDER BY created_at DESC, id DESC
            "#
        ))
        .bind(book_key)
        .fetch_all(pool)
        .await
        .map_err(|error| error.to_string()),
        None => sqlx::query_as::<_, GalleryImageDto>(&format!(
            r#"
            SELECT {SELECT_COLUMNS}
            FROM gallery_images
            ORDER BY created_at DESC, id DESC
            "#
        ))
        .fetch_all(pool)
        .await
        .map_err(|error| error.to_string()),
    }
}

pub async fn get_gallery_image(
    pool: &SqlitePool,
    id: &str,
) -> Result<Option<GalleryImageDto>, String> {
    sqlx::query_as::<_, GalleryImageDto>(&format!(
        r#"
        SELECT {SELECT_COLUMNS}
        FROM gallery_images
        WHERE id = ?
        "#
    ))
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|error| error.to_string())
}

pub async fn insert_gallery_image(
    pool: &SqlitePool,
    image: &GalleryImageDto,
) -> Result<GalleryImageDto, String> {
    sqlx::query_as::<_, GalleryImageDto>(&format!(
        r#"
        INSERT INTO gallery_images (
            id, book_key, book_title, prompt, provider_type, model_id,
            image_path, reference_paths, image_size
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING {SELECT_COLUMNS}
        "#
    ))
    .bind(&image.id)
    .bind(&image.book_key)
    .bind(&image.book_title)
    .bind(&image.prompt)
    .bind(&image.provider_type)
    .bind(&image.model_id)
    .bind(&image.image_path)
    .bind(&image.reference_paths)
    .bind(&image.image_size)
    .fetch_one(pool)
    .await
    .map_err(|error| error.to_string())
}

pub async fn delete_gallery_image(pool: &SqlitePool, id: &str) -> Result<(), String> {
    sqlx::query("DELETE FROM gallery_images WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map(|_| ())
        .map_err(|error| error.to_string())
}
