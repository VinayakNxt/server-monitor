#!/bin/bash

# Server Monitor Installation Script
# This script installs and configures the server monitoring system

# Configuration
INSTALL_DIR="/opt/server-monitor"
SERVICE_NAME="server-monitor"
GITHUB_REPO="your-github-repo/server-monitor" # Change this to your actual repository

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root${NC}"
  exit 1
fi

# Print section header
section() {
  echo -e "\n${GREEN}=== $1 ===${NC}"
}

# Check and install dependencies
install_dependencies() {
  section "Checking and installing dependencies"
  
  # Check if Node.js is installed
  if ! command -v node &> /dev/null; then
    echo "Node.js not found. Installing..."
    
    # Add NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
    
    # Install Node.js
    apt-get install -y nodejs
  else
    NODE_VERSION=$(node -v)
    echo "Node.js is already installed: $NODE_VERSION"
  fi
  
  # Check if Git is installed
  if ! command -v git &> /dev/null; then
    echo "Git not found. Installing..."
    apt-get install -y git
  else
    echo "Git is already installed"
  fi
}

# Create installation directory
create_install_dir() {
  section "Creating installation directory"
  
  mkdir -p $INSTALL_DIR
  echo "Created directory: $INSTALL_DIR"
}

# Clone the repository or download the package
get_application() {
  section "Downloading application"
  
  cd $INSTALL_DIR
  
  # If the repository exists, pull the latest changes
  if [ -d ".git" ]; then
    echo "Repository exists, pulling latest changes..."
    git pull
  else
    # Clone the repository
    echo "Cloning repository..."
    git clone https://github.com/$GITHUB_REPO .
  fi
}

# Install Node.js dependencies
install_node_dependencies() {
  section "Installing Node.js dependencies"
  
  cd $INSTALL_DIR
  npm install --production
}

# Create environment file
create_env_file() {
  section "Creating environment file"
  
  if [ ! -f "$INSTALL_DIR/.env" ]; then
    echo "Creating .env file from example..."
    cp $INSTALL_DIR/.env.example $INSTALL_DIR/.env
    
    # Set the server ID to the hostname
    HOSTNAME=$(hostname)
    sed -i "s/SERVER_ID=/SERVER_ID=$HOSTNAME/" $INSTALL_DIR/.env
    
    echo -e "${YELLOW}Please edit $INSTALL_DIR/.env to configure your database connection${NC}"
  else
    echo ".env file already exists, skipping"
  fi
}

# Create systemd service
create_systemd_service() {
  section "Creating systemd service"
  
  cat > /etc/systemd/system/$SERVICE_NAME.service << EOF
[Unit]
Description=Server Metrics Monitor
After=network.target

[Service]
ExecStart=/usr/bin/node $INSTALL_DIR/src/index.js
WorkingDirectory=$INSTALL_DIR
Restart=always
User=root
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

  echo "Created systemd service: $SERVICE_NAME"
  
  # Reload systemd
  systemctl daemon-reload
}

# Setup database
setup_database() {
  section "Setting up database"
  
  read -p "Do you want to setup the database schema now? (y/n): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd $INSTALL_DIR
    node scripts/setup-db.js
  else
    echo -e "${YELLOW}You can run the database setup later with: node $INSTALL_DIR/scripts/setup-db.js${NC}"
  fi
}

# Enable and start the service
start_service() {
  section "Starting service"
  
  read -p "Do you want to enable and start the service now? (y/n): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    systemctl enable $SERVICE_NAME
    systemctl start $SERVICE_NAME
    echo "Service started and enabled on boot"
  else
    echo -e "${YELLOW}You can start the service later with: systemctl start $SERVICE_NAME${NC}"
  fi
}

# Print installation summary
print_summary() {
  section "Installation Summary"
  
  echo -e "Server Monitor installed to: ${GREEN}$INSTALL_DIR${NC}"
  echo -e "Configuration file: ${GREEN}$INSTALL_DIR/.env${NC}"
  echo -e "Systemd service: ${GREEN}$SERVICE_NAME${NC}"
  echo
  echo -e "To check status: ${YELLOW}systemctl status $SERVICE_NAME${NC}"
  echo -e "To view logs: ${YELLOW}journalctl -u $SERVICE_NAME${NC}"
  echo -e "To edit configuration: ${YELLOW}vi $INSTALL_DIR/.env${NC}"
  echo
  echo -e "${GREEN}Installation complete!${NC}"
}

# Main installation process
main() {
  echo -e "${GREEN}Starting Server Monitor installation...${NC}"
  
  install_dependencies
  create_install_dir
  get_application
  install_node_dependencies
  create_env_file
  create_systemd_service
  setup_database
  start_service
  print_summary
}

# Run the installation
main