use crate::application::system::{self, HealthStatus};
use crate::infrastructure::database::Database;
use tauri::Manager;

#[tauri::command]
pub fn health_check() -> HealthStatus {
    system::health_check()
}

#[tauri::command]
pub fn schema_version(app: tauri::AppHandle) -> Result<i64, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| "application data directory unavailable".to_owned())?;
    let database = Database::new(app_data_dir.join("skill-panel-next.sqlite3"));

    system::schema_version(&database)
}
