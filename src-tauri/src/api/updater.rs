use tauri::{ipc::Channel, AppHandle, State};

use crate::{
    entities::{AppUpdateCheckResult, AppUpdateProgressEvent, AppUpdateState, ProxyPrepareResult},
    service::updater::update_service,
};

#[tauri::command]
pub fn prepare_updater_proxy() -> Result<ProxyPrepareResult, String> {
    update_service::prepare_updater_proxy()
}

#[tauri::command]
pub async fn check_app_update(
    app: AppHandle,
    state: State<'_, AppUpdateState>,
) -> Result<AppUpdateCheckResult, String> {
    update_service::check_app_update(app, state).await
}

#[tauri::command]
pub async fn install_app_update(
    update_token: String,
    on_event: Channel<AppUpdateProgressEvent>,
    state: State<'_, AppUpdateState>,
) -> Result<(), String> {
    update_service::install_app_update(update_token, on_event, state).await
}
