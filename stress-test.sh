#!/bin/bash

# Exit on error
set -e

echo "========================================"
echo "System Resource Load Generator for Ubuntu"
echo "========================================"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Install required tools if not already installed
echo "Checking and installing required tools..."
if ! command_exists stress-ng; then
    sudo apt-get update
    sudo apt-get install -y stress-ng
fi

if ! command_exists fio; then
    sudo apt-get install -y fio
fi

if ! command_exists iperf3; then
    sudo apt-get install -y iperf3
fi

# Ask for runtime
read -p "Enter test duration in seconds (default: 300): " DURATION
DURATION=${DURATION:-300}

# Ask for CPU load percentage
read -p "Enter CPU load percentage (0-100, default: 80): " CPU_LOAD
CPU_LOAD=${CPU_LOAD:-80}

# Ask for memory size to allocate (in MB)
read -p "Enter memory to use in MB (default: 1024): " MEM_SIZE
MEM_SIZE=${MEM_SIZE:-1024}

# Ask for disk test file size (in MB)
read -p "Enter disk test file size in MB (default: 1024): " DISK_SIZE
DISK_SIZE=${DISK_SIZE:-1024}

# Network test options
echo "Network load test options:"
echo "1) Generate local network traffic (loopback)"
echo "2) Connect to a remote iperf3 server"
echo "3) Skip network test"
read -p "Select an option (default: 1): " NETWORK_OPTION
NETWORK_OPTION=${NETWORK_OPTION:-1}

if [ "$NETWORK_OPTION" -eq 2 ]; then
    read -p "Enter remote iperf3 server IP: " SERVER_IP
    if [ -z "$SERVER_IP" ]; then
        echo "No server IP provided, falling back to loopback test"
        NETWORK_OPTION=1
    fi
fi

echo "========================================"
echo "Starting load tests for $DURATION seconds"
echo "========================================"

# Create a temporary directory for test files
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

# Start CPU load test
echo "Starting CPU load test..."
stress-ng --cpu "$(nproc)" --cpu-load "$CPU_LOAD" --timeout "${DURATION}s" &
CPU_PID=$!
echo "CPU load test started (PID: $CPU_PID)"

# Start memory load test
echo "Starting memory load test..."
stress-ng --vm 2 --vm-bytes "${MEM_SIZE}M" --timeout "${DURATION}s" &
MEM_PID=$!
echo "Memory load test started (PID: $MEM_PID)"

# Start disk I/O load test
echo "Starting disk I/O load test..."
fio --name=disktest --filename="${TEMP_DIR}/testfile" --size="${DISK_SIZE}M" \
    --rw=randrw --rwmixread=50 --bs=4k --direct=1 --runtime="$DURATION" \
    --ioengine=libaio --iodepth=32 --time_based --group_reporting &
DISK_PID=$!
echo "Disk I/O load test started (PID: $DISK_PID)"

# Start network load test
if [ "$NETWORK_OPTION" -eq 1 ]; then
    # Start iperf3 server in the background
    echo "Starting iperf3 server..."
    iperf3 -s -D
    sleep 2
    
    # Start iperf3 client to generate traffic to loopback
    echo "Starting network load test (loopback)..."
    iperf3 -c 127.0.0.1 -t "$DURATION" -P 10 -R &
    NET_PID=$!
    echo "Network load test started (PID: $NET_PID)"
elif [ "$NETWORK_OPTION" -eq 2 ]; then
    echo "Starting network load test (remote server)..."
    iperf3 -c "$SERVER_IP" -t "$DURATION" -P 10 -R &
    NET_PID=$!
    echo "Network load test started (PID: $NET_PID)"
else
    echo "Skipping network test as requested"
    NET_PID=""
fi

echo "========================================"
echo "All tests are running"
echo "This terminal will show test progress"
echo "Tests will complete in $DURATION seconds"
echo "Press Ctrl+C to stop tests early"
echo "========================================"

# Wait for all processes to complete
wait_with_timeout() {
    local timeout=$1
    local pid=$2
    local description=$3
    
    if [ -n "$pid" ]; then
        # Check if process exists
        if kill -0 "$pid" 2>/dev/null; then
            echo "Waiting for $description to complete (timeout: ${timeout}s)"
            timeout "$timeout" tail --pid="$pid" -f /dev/null || {
                echo "$description did not complete in time, killing process..."
                kill -9 "$pid" 2>/dev/null || true
            }
        fi
    fi
}

# Trap interrupts to clean up
trap 'echo "Interrupted, cleaning up..."; pkill -P $$; exit 1' INT TERM

# Wait for all processes with a timeout
wait_with_timeout "$((DURATION + 30))" "$CPU_PID" "CPU test"
wait_with_timeout "$((DURATION + 30))" "$MEM_PID" "memory test"
wait_with_timeout "$((DURATION + 30))" "$DISK_PID" "disk test"
wait_with_timeout "$((DURATION + 30))" "$NET_PID" "network test"

# Stop iperf3 server if we started it
if [ "$NETWORK_OPTION" -eq 1 ]; then
    echo "Stopping iperf3 server..."
    pkill -f "iperf3 -s" || true
fi

# Clean up
echo "Cleaning up temporary files..."
cd /
rm -rf "$TEMP_DIR"

echo "========================================"
echo "All tests completed"
echo "========================================"