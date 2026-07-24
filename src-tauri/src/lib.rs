pub mod application;
pub mod commands;
pub mod domain;
pub mod infrastructure;
pub mod security;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::system::health_check,
            commands::system::schema_version
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Skill Panel Next");
}
