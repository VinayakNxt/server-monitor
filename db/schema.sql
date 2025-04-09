-- Schema for Server Metrics Database

-- Create tables for storing server information and metrics

-- Create servers table to store information about servers being monitored
CREATE TABLE IF NOT EXISTS servers (
  id SERIAL PRIMARY KEY, -- Unique identifier for each server
  hostname VARCHAR(255) UNIQUE NOT NULL, -- Unique hostname of the server
  platform VARCHAR(100), -- Operating system platform (e.g., Windows, Linux)
  release VARCHAR(100), -- OS release version
  first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Timestamp when the server was first added
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Timestamp when the server was last updated
);

-- Create metrics table to store performance metrics for servers
CREATE TABLE IF NOT EXISTS metrics (
  id SERIAL PRIMARY KEY, -- Unique identifier for each metric entry
  server_hostname VARCHAR(255) REFERENCES servers(hostname), -- Hostname of the server (foreign key)
  timestamp TIMESTAMP NOT NULL, -- Timestamp when the metric was recorded
  cpu_usage NUMERIC, -- CPU usage percentage
  cpu_cores INTEGER, -- Number of CPU cores
  cpu_model VARCHAR(255), -- CPU model name
  cpu_speed NUMERIC, -- CPU speed in GHz
  cpu_load_1m NUMERIC, -- CPU load average over 1 minute
  cpu_load_5m NUMERIC, -- CPU load average over 5 minutes
  cpu_load_15m NUMERIC, -- CPU load average over 15 minutes
  memory_total BIGINT, -- Total memory in bytes
  memory_free BIGINT, -- Free memory in bytes
  memory_used BIGINT, -- Used memory in bytes
  memory_percentage NUMERIC, -- Memory usage percentage
  disk_filesystem VARCHAR(255), -- Filesystem name
  disk_size BIGINT, -- Total disk size in bytes
  disk_used BIGINT, -- Used disk space in bytes
  disk_available BIGINT, -- Available disk space in bytes
  disk_percentage NUMERIC, -- Disk usage percentage
  network_interface VARCHAR(100), -- Network interface name
  network_rx_bytes BIGINT, -- Received bytes on the network
  network_tx_bytes BIGINT, -- Transmitted bytes on the network
  network_rx_rate NUMERIC, -- Network receive rate
  network_tx_rate NUMERIC, -- Network transmit rate
  network_connections INTEGER, -- Number of active network connections
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Timestamp when the metric entry was created
);

-- Create processes table to store information about running processes
CREATE TABLE IF NOT EXISTS processes (
  id SERIAL PRIMARY KEY, -- Unique identifier for each process entry
  metric_id INTEGER REFERENCES metrics(id) ON DELETE CASCADE, -- Metric entry ID (foreign key)
  pid VARCHAR(20), -- Process ID
  name VARCHAR(255), -- Process name
  cpu_usage NUMERIC -- CPU usage percentage for the process
);

-- Create indexes for better query performance on metrics and processes tables
CREATE INDEX IF NOT EXISTS idx_metrics_server_timestamp ON metrics (server_hostname, timestamp); -- Index for server hostname and timestamp
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics (timestamp); -- Index for timestamp
CREATE INDEX IF NOT EXISTS idx_processes_metric_id ON processes (metric_id); -- Index for metric ID

-- Create a function to automatically update the last_seen timestamp in the servers table
CREATE OR REPLACE FUNCTION update_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_seen = CURRENT_TIMESTAMP; -- Update the last_seen column to the current timestamp
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to invoke the update_last_seen function before updating the servers table
CREATE TRIGGER update_servers_last_seen
BEFORE UPDATE ON servers
FOR EACH ROW
EXECUTE FUNCTION update_last_seen();

-- Create a view to display the latest metrics for each server
CREATE OR REPLACE VIEW latest_server_metrics AS
WITH latest_metric_ids AS (
  SELECT DISTINCT ON (server_hostname) 
    id, -- Metric ID
    server_hostname -- Server hostname
  FROM metrics
  ORDER BY server_hostname, timestamp DESC -- Get the latest metric for each server
)
SELECT 
  m.*, -- All columns from the metrics table
  s.platform, -- Platform from the servers table
  s.release, -- OS release from the servers table
  s.first_seen, -- First seen timestamp from the servers table
  s.last_seen -- Last seen timestamp from the servers table
FROM metrics m
JOIN latest_metric_ids lm ON m.id = lm.id -- Join with the latest metrics
JOIN servers s ON m.server_hostname = s.hostname; -- Join with the servers table

-- Create a function to clean up old metrics data older than a specified number of days
CREATE OR REPLACE FUNCTION cleanup_old_metrics(days_to_keep INTEGER)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER; -- Variable to store the number of deleted rows
BEGIN
  DELETE FROM metrics
  WHERE timestamp < NOW() - (days_to_keep * INTERVAL '1 day'); -- Delete metrics older than the specified days
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT; -- Get the number of rows deleted
  RETURN deleted_count; -- Return the count of deleted rows
END;
$$ LANGUAGE plpgsql;

-- Create a materialized view to aggregate weekly metrics for reporting purposes
CREATE MATERIALIZED VIEW weekly_metrics_summary AS
SELECT
  server_hostname, -- Server hostname
  date_trunc('week', timestamp) AS week_start, -- Start of the week
  AVG(cpu_usage) AS avg_cpu, -- Average CPU usage
  MAX(cpu_usage) AS max_cpu, -- Maximum CPU usage
  AVG(memory_percentage) AS avg_memory, -- Average memory usage percentage
  MAX(memory_percentage) AS max_memory, -- Maximum memory usage percentage
  AVG(disk_percentage) AS avg_disk, -- Average disk usage percentage
  MAX(disk_percentage) AS max_disk, -- Maximum disk usage percentage
  AVG(network_connections) AS avg_connections, -- Average number of network connections
  MAX(network_connections) AS max_connections -- Maximum number of network connections
FROM metrics
GROUP BY server_hostname, date_trunc('week', timestamp); -- Group by server and week

-- Create a unique index on the materialized view for efficient querying
CREATE UNIQUE INDEX idx_weekly_metrics_summary 
ON weekly_metrics_summary (server_hostname, week_start);

-- Create a function to refresh the materialized view for weekly metrics summary
CREATE OR REPLACE FUNCTION refresh_weekly_summary()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY weekly_metrics_summary; -- Refresh the materialized view concurrently
END;
$$ LANGUAGE plpgsql;