use rusqlite::{Connection, params};
use std::fs;
use std::path::{Path, PathBuf};

pub struct Database {
    path: PathBuf,
}

impl Database {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    pub fn initialize(&self) -> Result<i64, String> {
        let mut connection = self.open()?;

        connection
            .execute_batch(
                "PRAGMA foreign_keys = ON;
                 CREATE TABLE IF NOT EXISTS schema_migrations (
                   version INTEGER PRIMARY KEY,
                   name TEXT NOT NULL,
                   applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                 );",
            )
            .map_err(safe_database_error)?;

        let current_version = read_schema_version(&connection)?;
        if current_version < 1 {
            let transaction = connection.transaction().map_err(safe_database_error)?;
            transaction
                .execute_batch(include_str!("../../migrations/0001_initial.sql"))
                .map_err(safe_database_error)?;
            transaction.commit().map_err(safe_database_error)?;
        }

        read_schema_version(&connection)
    }

    pub fn has_table(&self, table_name: &str) -> Result<bool, String> {
        let connection = self.open()?;
        connection
            .query_row(
                "SELECT EXISTS(
                   SELECT 1 FROM sqlite_master WHERE name = ?1
                 )",
                params![table_name],
                |row| row.get(0),
            )
            .map_err(safe_database_error)
    }

    fn open(&self) -> Result<Connection, String> {
        if let Some(parent) = self.path.parent() {
            create_database_directory(parent)?;
        }

        Connection::open(&self.path).map_err(safe_database_error)
    }
}

fn create_database_directory(path: &Path) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|_| "unable to prepare application data".to_owned())
}

fn read_schema_version(connection: &Connection) -> Result<i64, String> {
    connection
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
            [],
            |row| row.get(0),
        )
        .map_err(safe_database_error)
}

fn safe_database_error(_error: rusqlite::Error) -> String {
    "database operation failed".to_owned()
}
