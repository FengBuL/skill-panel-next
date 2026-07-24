use crate::infrastructure::database::Database;
use serde::Serialize;

#[derive(Debug, PartialEq, Serialize)]
pub struct HealthStatus {
    pub status: &'static str,
    pub service: &'static str,
}

pub fn health_check() -> HealthStatus {
    HealthStatus {
        status: "ok",
        service: "skill-panel-next",
    }
}

pub fn schema_version(database: &Database) -> Result<i64, String> {
    database.initialize()
}
