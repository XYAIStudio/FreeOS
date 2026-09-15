-- Tenant-specific product module visibility

CREATE TABLE IF NOT EXISTS tenant_module_settings (
  tenant_id INTEGER NOT NULL,
  module_key TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_by INTEGER,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_module_settings_tenant
  ON tenant_module_settings(tenant_id);
