use sqlx::{Sqlite, SqlitePool, Transaction};

use crate::entities::font::{LocalFontEntry, LocalFontsResult};

// 阅读侧只查询解析后保存的元数据，不读取字体目录或解析字体文件。
pub async fn load_fonts(pool: &SqlitePool) -> Result<LocalFontsResult, String> {
    let rows: Vec<String> =
        sqlx::query_scalar("SELECT metadata FROM local_fonts ORDER BY filename, face_index")
            .fetch_all(pool)
            .await
            .map_err(|error| format!("读取字体记录失败: {error}"))?;
    let fonts = rows
        .into_iter()
        .map(|row| {
            serde_json::from_str(&row).map_err(|error| format!("读取字体元数据失败: {error}"))
        })
        .collect::<Result<Vec<LocalFontEntry>, String>>()?;
    Ok(LocalFontsResult {
        fonts,
        warnings: Vec::new(),
    })
}

async fn insert_fonts(
    transaction: &mut Transaction<'_, Sqlite>,
    fonts: &[LocalFontEntry],
) -> Result<(), String> {
    for font in fonts {
        let metadata = serde_json::to_string(font).map_err(|error| error.to_string())?;
        sqlx::query(
            "INSERT INTO local_fonts (filename, face_index, metadata) VALUES (?, ?, ?)
             ON CONFLICT(filename, face_index) DO UPDATE SET metadata = excluded.metadata",
        )
        .bind(&font.filename)
        .bind(i64::from(font.font.face_index))
        .bind(metadata)
        .execute(&mut **transaction)
        .await
        .map_err(|error| format!("保存字体记录失败: {error}"))?;
    }
    Ok(())
}

pub async fn save_fonts(pool: &SqlitePool, fonts: &[LocalFontEntry]) -> Result<(), String> {
    let mut transaction = pool.begin().await.map_err(|error| error.to_string())?;
    insert_fonts(&mut transaction, fonts).await?;
    transaction
        .commit()
        .await
        .map_err(|error| error.to_string())
}

// 设置侧扫描成功后原子替换目录快照，清除已删除或已失效的记录。
pub async fn replace_fonts(pool: &SqlitePool, fonts: &[LocalFontEntry]) -> Result<(), String> {
    let mut transaction = pool.begin().await.map_err(|error| error.to_string())?;
    sqlx::query("DELETE FROM local_fonts")
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;
    insert_fonts(&mut transaction, fonts).await?;
    transaction
        .commit()
        .await
        .map_err(|error| error.to_string())
}

pub async fn delete_font(pool: &SqlitePool, filename: &str) -> Result<(), String> {
    sqlx::query("DELETE FROM local_fonts WHERE filename = ?")
        .bind(filename)
        .execute(pool)
        .await
        .map_err(|error| format!("删除字体记录失败: {error}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::entities::font::FontNameEntry;
    use sqlx::sqlite::SqlitePoolOptions;

    fn entry(filename: &str, face_index: u32) -> LocalFontEntry {
        LocalFontEntry {
            filename: filename.to_string(),
            font: FontNameEntry {
                family: "Example".to_string(),
                display_family: "示例字体".to_string(),
                subfamily: Some("Regular".to_string()),
                full_name: None,
                postscript_name: Some("Example-Regular".to_string()),
                weight: Some(400),
                // 查询必须仅依赖数据库，即使文件不在本机也不触发扫描或解析。
                path: Some(format!("Z:/missing/fonts/{filename}")),
                face_index,
                family_aliases: vec!["示例字体".to_string()],
            },
        }
    }

    #[test]
    fn catalog_round_trip_replace_and_delete_use_only_database() {
        tauri::async_runtime::block_on(async {
            let pool = SqlitePoolOptions::new()
                .max_connections(1)
                .connect("sqlite::memory:")
                .await
                .unwrap();
            sqlx::migrate!("./migrations").run(&pool).await.unwrap();
            assert!(load_fonts(&pool).await.unwrap().fonts.is_empty());

            save_fonts(&pool, &[entry("hash.ttc", 0), entry("hash.ttc", 1)])
                .await
                .unwrap();
            save_fonts(&pool, &[entry("other.ttf", 0)]).await.unwrap();
            let loaded = load_fonts(&pool).await.unwrap();
            assert_eq!(loaded.fonts.len(), 3);
            assert_eq!(loaded.fonts[0].font.display_family, "示例字体");
            assert_eq!(loaded.fonts[1].font.face_index, 1);
            assert_eq!(
                loaded.fonts[0].font.path.as_deref(),
                Some("Z:/missing/fonts/hash.ttc")
            );

            let mut updated = entry("hash.ttc", 0);
            updated.font.weight = Some(700);
            save_fonts(&pool, &[updated]).await.unwrap();
            let loaded = load_fonts(&pool).await.unwrap();
            assert_eq!(loaded.fonts.len(), 3);
            assert_eq!(loaded.fonts[0].font.weight, Some(700));

            delete_font(&pool, "HASH.TTC").await.unwrap();
            let loaded = load_fonts(&pool).await.unwrap();
            assert_eq!(loaded.fonts.len(), 1);
            assert_eq!(loaded.fonts[0].filename, "other.ttf");

            replace_fonts(&pool, &[entry("new.ttf", 0)]).await.unwrap();
            let loaded = load_fonts(&pool).await.unwrap();
            assert_eq!(loaded.fonts.len(), 1);
            assert_eq!(loaded.fonts[0].filename, "new.ttf");
            replace_fonts(&pool, &[]).await.unwrap();
            assert!(load_fonts(&pool).await.unwrap().fonts.is_empty());
            pool.close().await;
        });
    }
}
