-- V1.00 R5 tenant industry capability selection

CREATE TABLE IF NOT EXISTS tenant_industry_packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL UNIQUE,
  package_id TEXT NOT NULL,
  features_json TEXT NOT NULL DEFAULT '[]',
  activated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
