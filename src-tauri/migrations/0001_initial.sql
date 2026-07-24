CREATE TABLE app_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE VIRTUAL TABLE asset_search USING fts5(
  asset_id UNINDEXED,
  name,
  description,
  content
);

INSERT INTO schema_migrations (version, name)
VALUES (1, 'initial');
