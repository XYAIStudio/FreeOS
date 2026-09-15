-- V1.00 R5 high-availability cluster registry

CREATE TABLE IF NOT EXISTS cluster_nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_id TEXT UNIQUE NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'follower',
  status TEXT NOT NULL DEFAULT 'online',
  last_heartbeat DATETIME DEFAULT CURRENT_TIMESTAMP,
  metrics_json TEXT NOT NULL DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cluster_nodes_status_heartbeat
  ON cluster_nodes(status, last_heartbeat);
