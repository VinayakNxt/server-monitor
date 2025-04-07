-- Schema for Server Metrics Database

-- Create tables for storing server information and metrics
-- Create servers table
CREATE TABLE IF NOT EXISTS servers (
  id SERIAL PRIMARY KEY,
  hostname VARCHAR(255) UNIQUE NOT NULL,
  platform VARCHAR(100),
  release VARCHAR(100),
  first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create metrics table
CREATE TABLE IF NOT EXISTS metrics (
  id SERIAL PRIMARY KEY,
  server_hostname VARCHAR(255) REFERENCES servers(hostname),
  timestamp TIMESTAMP NOT NULL,
  cpu_usage NUMERIC,
  cpu_cores INTEGER,
  cpu_model VARCHAR(255),
  cpu_speed NUMERIC,
  cpu_load_1m NUMERIC,
  cpu_load_5m NUMERIC,
  cpu_load_15m NUMERIC,
  memory_total BIGINT,
  memory_free BIGINT,
  memory_used BIGINT,
  memory_percentage NUMERIC,
  disk_filesystem VARCHAR(255),
  disk_size BIGINT,
  disk_used BIGINT,
  disk_available BIGINT,
  disk_percentage NUMERIC,
  network_interface VARCHAR(100),
  network_rx_bytes BIGINT,
  network_tx_bytes BIGINT,
  network_rx_rate NUMERIC,
  network_tx_rate NUMERIC,
  network_connections INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create processes table
CREATE TABLE IF NOT EXISTS processes (
  id SERIAL PRIMARY KEY,
  metric_id INTEGER REFERENCES metrics(id) ON DELETE CASCADE,
  pid VARCHAR(20),
  name VARCHAR(255),
  cpu_usage NUMERIC
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_metrics_server_timestamp ON metrics (server_hostname, timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics (timestamp);
CREATE INDEX IF NOT EXISTS idx_processes_metric_id ON processes (metric_id);

-- Create a function to automatically update the last_seen timestamp
CREATE OR REPLACE FUNCTION update_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_seen = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update the last_seen timestamp
CREATE TRIGGER update_servers_last_seen
BEFORE UPDATE ON servers
FOR EACH ROW
EXECUTE FUNCTION update_last_seen();

-- Create a view for the latest metrics from each server
CREATE OR REPLACE VIEW latest_server_metrics AS
WITH latest_metric_ids AS (
  SELECT DISTINCT ON (server_hostname) 
    id,
    server_hostname
  FROM metrics
  ORDER BY server_hostname, timestamp DESC
)
SELECT 
  m.*,
  s.platform,
  s.release,
  s.first_seen,
  s.last_seen
FROM metrics m
JOIN latest_metric_ids lm ON m.id = lm.id
JOIN servers s ON m.server_hostname = s.hostname;

-- Create a function to clean up old metrics data
CREATE OR REPLACE FUNCTION cleanup_old_metrics(days_to_keep INTEGER)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM metrics
  WHERE timestamp < NOW() - (days_to_keep * INTERVAL '1 day');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create materialized view for weekly metrics aggregation (helps with reporting)
CREATE MATERIALIZED VIEW weekly_metrics_summary AS
SELECT
  server_hostname,
  date_trunc('week', timestamp) AS week_start,
  AVG(cpu_usage) AS avg_cpu,
  MAX(cpu_usage) AS max_cpu,
  AVG(memory_percentage) AS avg_memory,
  MAX(memory_percentage) AS max_memory,
  AVG(disk_percentage) AS avg_disk,
  MAX(disk_percentage) AS max_disk,
  AVG(network_connections) AS avg_connections,
  MAX(network_connections) AS max_connections
FROM metrics
GROUP BY server_hostname, date_trunc('week', timestamp);

CREATE UNIQUE INDEX idx_weekly_metrics_summary 
ON weekly_metrics_summary (server_hostname, week_start);

-- Create a function to refresh the weekly summary
CREATE OR REPLACE FUNCTION refresh_weekly_summary()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY weekly_metrics_summary;
END;
$$ LANGUAGE plpgsql;