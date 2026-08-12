use std::collections::HashMap;

use serde_json::{json, Value};
use sqlx::{Row, SqlitePool};

use crate::entities::{
    ModelProviderConfig, ReaderStyleSettings, SaveAppSettingsRequest,
    SaveReaderStyleSettingsRequest, Settings,
};

const SETTINGS_ID: i64 = 1;

fn default_model_providers() -> HashMap<String, ModelProviderConfig> {
    HashMap::new()
}

fn normalize_theme_mode(value: String) -> String {
    if value == "dark" {
        "dark".to_string()
    } else {
        "light".to_string()
    }
}

fn normalize_update_channel(value: String) -> String {
    if value == "preview" {
        "preview".to_string()
    } else {
        "stable".to_string()
    }
}

fn normalize_webdav_timeout_seconds(value: i64) -> i64 {
    value.clamp(1, 300)
}

fn default_app_settings() -> Settings {
    Settings {
        webdav_url_root: String::new(),
        webdav_url_folder: String::new(),
        webdav_url: String::new(),
        webdav_user: String::new(),
        webdav_pass: String::new(),
        webdav_timeout_seconds: 30,
        theme_mode: "light".to_string(),
        update_channel: "stable".to_string(),
        model_providers: default_model_providers(),
    }
}

fn default_reader_style_settings() -> ReaderStyleSettings {
    ReaderStyleSettings {
        font_size: 16.0,
        font_weight: 400.0,
        line_spacing: 1.3,
        paragraph_spacing: 0.2,
        letter_spacing: 0.0,
        box_padding_top: 20.0,
        box_padding_bottom: 20.0,
        box_padding_horizontal: 20.0,
        column_count: 2.0,
        indent: 2.0,
        font: "serif".to_string(),
        color: "#FFFFFF".to_string(),
        font_color: "#111827".to_string(),
        background_presets: json!({
            "light": "default",
            "dark": "default",
        }),
        flow: "paginated".to_string(),
        enabled_system_fonts: json!([]),
        load_epub_built_in_stylesheet: false,
    }
}

fn parse_json_value(value: String, fallback: Value) -> Value {
    serde_json::from_str(&value).unwrap_or(fallback)
}

fn parse_model_providers(value: String) -> HashMap<String, ModelProviderConfig> {
    serde_json::from_str(&value).unwrap_or_else(|_| default_model_providers())
}

fn to_json_text<T: serde::Serialize>(value: &T) -> Result<String, String> {
    serde_json::to_string(value).map_err(|error| error.to_string())
}

async fn persist_app_settings(pool: &SqlitePool, settings: Settings) -> Result<Settings, String> {
    let model_providers = to_json_text(&settings.model_providers)?;

    sqlx::query(
        r#"
        INSERT INTO app_settings (
            id, webdav_url_root, webdav_url_folder, webdav_url, webdav_user, webdav_pass,
            webdav_timeout_seconds, theme_mode, update_channel, model_providers, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
            webdav_url_root = excluded.webdav_url_root,
            webdav_url_folder = excluded.webdav_url_folder,
            webdav_url = excluded.webdav_url,
            webdav_user = excluded.webdav_user,
            webdav_pass = excluded.webdav_pass,
            webdav_timeout_seconds = excluded.webdav_timeout_seconds,
            theme_mode = excluded.theme_mode,
            update_channel = excluded.update_channel,
            model_providers = excluded.model_providers,
            updated_at = datetime('now')
        "#,
    )
    .bind(SETTINGS_ID)
    .bind(&settings.webdav_url_root)
    .bind(&settings.webdav_url_folder)
    .bind(&settings.webdav_url)
    .bind(&settings.webdav_user)
    .bind(&settings.webdav_pass)
    .bind(settings.webdav_timeout_seconds)
    .bind(&settings.theme_mode)
    .bind(&settings.update_channel)
    .bind(model_providers)
    .execute(pool)
    .await
    .map_err(|error| error.to_string())?;

    Ok(settings)
}

pub async fn load_app_settings(pool: &SqlitePool) -> Result<Settings, String> {
    let row = sqlx::query(
        r#"
        SELECT webdav_url_root, webdav_url_folder, webdav_url, webdav_user, webdav_pass,
               webdav_timeout_seconds, theme_mode, update_channel, model_providers
        FROM app_settings
        WHERE id = 1
        "#,
    )
    .fetch_optional(pool)
    .await
    .map_err(|error| error.to_string())?;

    let Some(row) = row else {
        return persist_app_settings(pool, default_app_settings()).await;
    };

    Ok(Settings {
        webdav_url_root: row
            .try_get::<String, _>("webdav_url_root")
            .unwrap_or_default(),
        webdav_url_folder: row
            .try_get::<String, _>("webdav_url_folder")
            .unwrap_or_default(),
        webdav_url: row.try_get::<String, _>("webdav_url").unwrap_or_default(),
        webdav_user: row.try_get::<String, _>("webdav_user").unwrap_or_default(),
        webdav_pass: row.try_get::<String, _>("webdav_pass").unwrap_or_default(),
        webdav_timeout_seconds: normalize_webdav_timeout_seconds(
            row.try_get::<i64, _>("webdav_timeout_seconds")
                .unwrap_or_else(|_| 30),
        ),
        theme_mode: normalize_theme_mode(
            row.try_get::<String, _>("theme_mode")
                .unwrap_or_else(|_| "light".to_string()),
        ),
        update_channel: normalize_update_channel(
            row.try_get::<String, _>("update_channel")
                .unwrap_or_else(|_| "stable".to_string()),
        ),
        model_providers: parse_model_providers(
            row.try_get::<String, _>("model_providers")
                .unwrap_or_else(|_| "{}".to_string()),
        ),
    })
}

pub async fn save_app_settings(
    pool: &SqlitePool,
    request: SaveAppSettingsRequest,
) -> Result<Settings, String> {
    let mut current = load_app_settings(pool).await?;

    if let Some(value) = request.webdav_url_root {
        current.webdav_url_root = value;
    }
    if let Some(value) = request.webdav_url_folder {
        current.webdav_url_folder = value;
    }
    if let Some(value) = request.webdav_url {
        current.webdav_url = value;
    }
    if let Some(value) = request.webdav_user {
        current.webdav_user = value;
    }
    if let Some(value) = request.webdav_pass {
        current.webdav_pass = value;
    }
    if let Some(value) = request.webdav_timeout_seconds {
        current.webdav_timeout_seconds = normalize_webdav_timeout_seconds(value);
    }
    if let Some(value) = request.theme_mode {
        current.theme_mode = normalize_theme_mode(value);
    }
    if let Some(value) = request.update_channel {
        current.update_channel = normalize_update_channel(value);
    }
    if let Some(value) = request.model_providers {
        current.model_providers = value;
    }

    persist_app_settings(pool, current).await
}

async fn persist_reader_style_settings(
    pool: &SqlitePool,
    settings: ReaderStyleSettings,
) -> Result<ReaderStyleSettings, String> {
    sqlx::query(
        r#"
        INSERT INTO reader_style_settings (
            id, font_size, font_weight, line_spacing, paragraph_spacing, letter_spacing,
            box_padding_top, box_padding_bottom, box_padding_horizontal, column_count, indent,
            font, color, font_color, background_presets, flow, enabled_system_fonts,
            load_epub_built_in_stylesheet, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
            font_size = excluded.font_size,
            font_weight = excluded.font_weight,
            line_spacing = excluded.line_spacing,
            paragraph_spacing = excluded.paragraph_spacing,
            letter_spacing = excluded.letter_spacing,
            box_padding_top = excluded.box_padding_top,
            box_padding_bottom = excluded.box_padding_bottom,
            box_padding_horizontal = excluded.box_padding_horizontal,
            column_count = excluded.column_count,
            indent = excluded.indent,
            font = excluded.font,
            color = excluded.color,
            font_color = excluded.font_color,
            background_presets = excluded.background_presets,
            flow = excluded.flow,
            enabled_system_fonts = excluded.enabled_system_fonts,
            load_epub_built_in_stylesheet = excluded.load_epub_built_in_stylesheet,
            updated_at = datetime('now')
        "#,
    )
    .bind(SETTINGS_ID)
    .bind(settings.font_size)
    .bind(settings.font_weight)
    .bind(settings.line_spacing)
    .bind(settings.paragraph_spacing)
    .bind(settings.letter_spacing)
    .bind(settings.box_padding_top)
    .bind(settings.box_padding_bottom)
    .bind(settings.box_padding_horizontal)
    .bind(settings.column_count)
    .bind(settings.indent)
    .bind(&settings.font)
    .bind(&settings.color)
    .bind(&settings.font_color)
    .bind(to_json_text(&settings.background_presets)?)
    .bind(&settings.flow)
    .bind(to_json_text(&settings.enabled_system_fonts)?)
    .bind(settings.load_epub_built_in_stylesheet)
    .execute(pool)
    .await
    .map_err(|error| error.to_string())?;

    Ok(settings)
}

pub async fn load_reader_style_settings(pool: &SqlitePool) -> Result<ReaderStyleSettings, String> {
    let row = sqlx::query(
        r#"
        SELECT font_size, font_weight, line_spacing, paragraph_spacing, letter_spacing,
               box_padding_top, box_padding_bottom, box_padding_horizontal, column_count, indent,
               font, color, font_color, background_presets, flow, enabled_system_fonts,
               load_epub_built_in_stylesheet
        FROM reader_style_settings
        WHERE id = 1
        "#,
    )
    .fetch_optional(pool)
    .await
    .map_err(|error| error.to_string())?;

    let Some(row) = row else {
        return persist_reader_style_settings(pool, default_reader_style_settings()).await;
    };

    Ok(ReaderStyleSettings {
        font_size: row.try_get::<f64, _>("font_size").unwrap_or(16.0),
        font_weight: row.try_get::<f64, _>("font_weight").unwrap_or(400.0),
        line_spacing: row.try_get::<f64, _>("line_spacing").unwrap_or(1.3),
        paragraph_spacing: row.try_get::<f64, _>("paragraph_spacing").unwrap_or(0.2),
        letter_spacing: row.try_get::<f64, _>("letter_spacing").unwrap_or(0.0),
        box_padding_top: row.try_get::<f64, _>("box_padding_top").unwrap_or(20.0),
        box_padding_bottom: row.try_get::<f64, _>("box_padding_bottom").unwrap_or(20.0),
        box_padding_horizontal: row
            .try_get::<f64, _>("box_padding_horizontal")
            .unwrap_or(20.0),
        column_count: row.try_get::<f64, _>("column_count").unwrap_or(2.0),
        indent: row.try_get::<f64, _>("indent").unwrap_or(2.0),
        font: row
            .try_get::<String, _>("font")
            .unwrap_or_else(|_| "serif".to_string()),
        color: row
            .try_get::<String, _>("color")
            .unwrap_or_else(|_| "#FFFFFF".to_string()),
        font_color: row
            .try_get::<String, _>("font_color")
            .unwrap_or_else(|_| "#111827".to_string()),
        background_presets: parse_json_value(
            row.try_get::<String, _>("background_presets")
                .unwrap_or_else(|_| r#"{"light":"default","dark":"default"}"#.to_string()),
            json!({
                "light": "default",
                "dark": "default",
            }),
        ),
        flow: row
            .try_get::<String, _>("flow")
            .unwrap_or_else(|_| "paginated".to_string()),
        enabled_system_fonts: parse_json_value(
            row.try_get::<String, _>("enabled_system_fonts")
                .unwrap_or_else(|_| "[]".to_string()),
            json!([]),
        ),
        load_epub_built_in_stylesheet: row
            .try_get::<bool, _>("load_epub_built_in_stylesheet")
            .unwrap_or(false),
    })
}

pub async fn save_reader_style_settings(
    pool: &SqlitePool,
    request: SaveReaderStyleSettingsRequest,
) -> Result<ReaderStyleSettings, String> {
    let mut current = load_reader_style_settings(pool).await?;

    if let Some(value) = request.font_size {
        current.font_size = value;
    }
    if let Some(value) = request.font_weight {
        current.font_weight = value;
    }
    if let Some(value) = request.line_spacing {
        current.line_spacing = value;
    }
    if let Some(value) = request.paragraph_spacing {
        current.paragraph_spacing = value;
    }
    if let Some(value) = request.letter_spacing {
        current.letter_spacing = value;
    }
    if let Some(value) = request.box_padding_top {
        current.box_padding_top = value;
    }
    if let Some(value) = request.box_padding_bottom {
        current.box_padding_bottom = value;
    }
    if let Some(value) = request.box_padding_horizontal {
        current.box_padding_horizontal = value;
    }
    if let Some(value) = request.column_count {
        current.column_count = value;
    }
    if let Some(value) = request.indent {
        current.indent = value;
    }
    if let Some(value) = request.font {
        current.font = value;
    }
    if let Some(value) = request.color {
        current.color = value;
    }
    if let Some(value) = request.font_color {
        current.font_color = value;
    }
    if let Some(value) = request.background_presets {
        current.background_presets = value;
    }
    if let Some(value) = request.flow {
        current.flow = value;
    }
    if let Some(value) = request.enabled_system_fonts {
        current.enabled_system_fonts = value;
    }
    if let Some(value) = request.load_epub_built_in_stylesheet {
        current.load_epub_built_in_stylesheet = value;
    }

    persist_reader_style_settings(pool, current).await
}
