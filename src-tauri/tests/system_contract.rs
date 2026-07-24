use skill_panel_next_core::application::system::{health_check, schema_version};
use skill_panel_next_core::infrastructure::database::Database;
use tempfile::tempdir;

#[test]
fn health_check_returns_stable_contract() {
    let status = health_check();

    assert_eq!(status.status, "ok");
    assert_eq!(status.service, "skill-panel-next");
}

#[test]
fn database_initialization_applies_schema_once_with_fts5() {
    let directory = tempdir().expect("temporary database directory");
    let database_path = directory.path().join("skill-panel-next.sqlite3");
    let database = Database::new(database_path);

    assert_eq!(schema_version(&database).expect("first migration"), 1);
    assert_eq!(schema_version(&database).expect("repeat migration"), 1);
    assert!(database.has_table("asset_search").expect("FTS5 table"));
}
