use std::path::PathBuf;

use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions},
    SqlitePool,
};

use crate::{
    repository::local_fs::{dir_repository::get_local_system_dir, file_repository::ensure_dir},
    utils::logging::{log_error, log_info},
};

const DATABASE_FILE_NAME: &str = "t-reader.db";
const MAX_CONNECTIONS: u32 = 4;
const MIN_CONNECTIONS: u32 = 1;

#[derive(Clone)]
#[allow(dead_code)]
pub struct DatabaseState {
    pub pool: SqlitePool,
    pub path: PathBuf,
}

pub async fn initialize_database() -> Result<DatabaseState, String> {
    let database_path = get_database_path()?;
    if let Some(parent) = database_path.parent() {
        ensure_dir(parent)?;
    }

    log_info(
        "database",
        &format!("initializing path={}", database_path.display()),
    );

    let pool = create_pool(&database_path).await?;
    run_migrations(&pool).await?;
    health_check(&pool).await?;

    log_info(
        "database",
        &format!("ready path={}", database_path.display()),
    );

    Ok(DatabaseState {
        pool,
        path: database_path,
    })
}

fn get_database_path() -> Result<PathBuf, String> {
    Ok(get_local_system_dir()?.join(DATABASE_FILE_NAME))
}

async fn create_pool(database_path: &PathBuf) -> Result<SqlitePool, String> {
    let options = SqliteConnectOptions::new()
        .filename(database_path)
        .create_if_missing(true)
        .foreign_keys(true)
        .journal_mode(SqliteJournalMode::Wal);

    let pool = SqlitePoolOptions::new()
        .min_connections(MIN_CONNECTIONS)
        .max_connections(MAX_CONNECTIONS)
        .connect_with(options)
        .await
        .map_err(|error| {
            log_error("database", &format!("connect failed error={}", error));
            error.to_string()
        })?;

    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&pool)
        .await
        .map_err(|error| {
            log_error(
                "database",
                &format!("enable-foreign-keys failed error={}", error),
            );
            error.to_string()
        })?;

    sqlx::query("PRAGMA journal_mode = WAL")
        .execute(&pool)
        .await
        .map_err(|error| {
            log_error("database", &format!("enable-wal failed error={}", error));
            error.to_string()
        })?;

    Ok(pool)
}

async fn run_migrations(pool: &SqlitePool) -> Result<(), String> {
    sqlx::migrate!("./migrations")
        .run(pool)
        .await
        .map_err(|error| {
            log_error("database", &format!("migration failed error={}", error));
            error.to_string()
        })
}

async fn health_check(pool: &SqlitePool) -> Result<(), String> {
    let one: i64 = sqlx::query_scalar("SELECT 1")
        .fetch_one(pool)
        .await
        .map_err(|error| {
            log_error("database", &format!("select-one failed error={}", error));
            error.to_string()
        })?;

    if one != 1 {
        let message = format!("select-one returned unexpected value={}", one);
        log_error("database", &message);
        return Err(message);
    }

    let sqlite_version: String = sqlx::query_scalar("SELECT sqlite_version()")
        .fetch_one(pool)
        .await
        .map_err(|error| {
            log_error(
                "database",
                &format!("sqlite-version failed error={}", error),
            );
            error.to_string()
        })?;

    let migration_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM _sqlx_migrations")
        .fetch_one(pool)
        .await
        .map_err(|error| {
            log_error(
                "database",
                &format!("migration-metadata-check failed error={}", error),
            );
            error.to_string()
        })?;

    log_info(
        "database",
        &format!(
            "health-check ok sqliteVersion={} migrations={}",
            sqlite_version, migration_count
        ),
    );

    Ok(())
}
