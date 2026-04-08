use std::{collections::HashSet, fs::File, io::Read};

use crate::{
    repository::{
        local_fs::{
            dir_repository::{ensure_local_dirs, CLOUD_BOOKS_DIR, CLOUD_PROGRESS_DIR},
            file_repository::{list_files, write_binary_file},
        },
        webdav::{
            client::build_webdav_client,
            file_repository::{download_remote_file, list_remote_files, upload_remote_file},
        },
    },
    service::{filesystem::settings_service::load_settings_entity, webdav::dir_service::ensure_cloud_dirs},
    utils::{
        logging::{finish_timer, log_info, start_timer},
        webdav::{is_config_file, is_supported_book_file, should_upload_local_config},
    },
};

pub async fn webdav_sync_files() -> Result<(), String> {
    let started_at = start_timer("webdav", "webdav-sync-files");
    let settings = load_settings_entity()?;
    let client = build_webdav_client();

    ensure_cloud_dirs(&settings).await?;
    let root_path = ensure_local_dirs()?;

    let books_path = root_path.join(CLOUD_BOOKS_DIR);
    let progress_path = root_path.join(CLOUD_PROGRESS_DIR);

    let local_books: HashSet<String> = list_files(&books_path)?
        .into_iter()
        .filter(|file_name| is_supported_book_file(file_name))
        .collect();
    let cloud_books: HashSet<String> = list_remote_files(&client, &settings, CLOUD_BOOKS_DIR)
        .await?
        .into_iter()
        .filter(|file_name| is_supported_book_file(file_name))
        .collect();

    let local_configs: HashSet<String> = list_files(&progress_path)?
        .into_iter()
        .filter(|file_name| is_config_file(file_name))
        .collect();
    let cloud_configs: HashSet<String> = list_remote_files(&client, &settings, CLOUD_PROGRESS_DIR)
        .await?
        .into_iter()
        .filter(|file_name| is_config_file(file_name))
        .collect();

    log_info(
        "webdav",
        &format!(
            "sync-snapshot local_books={} cloud_books={} local_configs={} cloud_configs={}",
            local_books.len(),
            cloud_books.len(),
            local_configs.len(),
            cloud_configs.len()
        ),
    );

    for file_name in local_books.difference(&cloud_books) {
        let file_path = books_path.join(file_name);
        let mut contents = Vec::new();
        File::open(&file_path)
            .map_err(|error| error.to_string())?
            .read_to_end(&mut contents)
            .map_err(|error| error.to_string())?;
        upload_remote_file(&client, &settings, CLOUD_BOOKS_DIR, file_name, contents).await?;
    }

    for file_name in cloud_books.difference(&local_books) {
        let contents = download_remote_file(&client, &settings, CLOUD_BOOKS_DIR, file_name).await?;
        write_binary_file(&books_path.join(file_name), &contents)?;
    }

    for file_name in local_configs.difference(&cloud_configs) {
        let file_path = progress_path.join(file_name);
        let mut contents = Vec::new();
        File::open(&file_path)
            .map_err(|error| error.to_string())?
            .read_to_end(&mut contents)
            .map_err(|error| error.to_string())?;
        upload_remote_file(&client, &settings, CLOUD_PROGRESS_DIR, file_name, contents).await?;
    }

    for file_name in cloud_configs.difference(&local_configs) {
        let contents =
            download_remote_file(&client, &settings, CLOUD_PROGRESS_DIR, file_name).await?;
        write_binary_file(&progress_path.join(file_name), &contents)?;
    }

    for file_name in local_configs.intersection(&cloud_configs) {
        let local_path = progress_path.join(file_name);
        let mut local_contents = Vec::new();
        File::open(&local_path)
            .map_err(|error| error.to_string())?
            .read_to_end(&mut local_contents)
            .map_err(|error| error.to_string())?;

        let cloud_contents =
            download_remote_file(&client, &settings, CLOUD_PROGRESS_DIR, file_name).await?;

        if should_upload_local_config(&local_contents, &cloud_contents) {
            upload_remote_file(
                &client,
                &settings,
                CLOUD_PROGRESS_DIR,
                file_name,
                local_contents,
            )
            .await?;
        } else {
            write_binary_file(&local_path, &cloud_contents)?;
        }
    }

    finish_timer("webdav", "webdav-sync-files", started_at);
    Ok(())
}
