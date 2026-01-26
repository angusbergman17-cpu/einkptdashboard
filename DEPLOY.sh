#!/bin/bash
###############################################################################
# PTV-TRMNL Easy Deployment Script
# Automated setup for server deployment and device flashing
#
# Copyright (c) 2026 Angus Bergman
# Licensed under CC BY-NC 4.0
# https://creativecommons.org/licenses/by-nc/4.0/
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "========================================="
echo "    PTV-TRMNL Deployment Script"
echo "========================================="
echo -e "${NC}"

# Function to print status
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    echo -e "\n${BLUE}Checking prerequisites...${NC}"

    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js not found. Please install Node.js 18 or later."
        exit 1
    fi
    NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version $NODE_VERSION found. Version 18 or later required."
        exit 1
    fi
    print_status "Node.js $(node -v) found"

    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm not found. Please install npm."
        exit 1
    fi
    print_status "npm $(npm -v) found"

    # Check git
    if ! command -v git &> /dev/null; then
        print_error "git not found. Please install git."
        exit 1
    fi
    print_status "git $(git --version | cut -d ' ' -f 3) found"

    # Check PlatformIO (optional for firmware)
    if command -v pio &> /dev/null; then
        print_status "PlatformIO $(pio --version | cut -d ' ' -f 3) found"
        HAS_PIO=true
    else
        print_warning "PlatformIO not found (optional - needed for firmware flashing)"
        HAS_PIO=false
    fi
}

# Setup environment
setup_environment() {
    echo -e "\n${BLUE}Setting up environment...${NC}"

    # Check if .env exists
    if [ -f ".env" ]; then
        print_info ".env file already exists"
        read -p "Do you want to reconfigure API keys? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return
        fi
    fi

    # Get API keys
    echo -e "\n${YELLOW}API Configuration${NC}"
    echo "You'll need:"
    echo "  1. Google Places API key"
    echo "  2. Transport Victoria OpenData API key (UUID format)"
    echo ""

    read -p "Enter Google Places API key: " GOOGLE_KEY
    read -p "Enter Transport Victoria API key: " TRANSPORT_VIC_KEY

    # Create .env file
    cat > .env <<EOF
# PTV-TRMNL Environment Configuration
# Generated: $(date)

# Transport Victoria OpenData API
ODATA_API_KEY=${TRANSPORT_VIC_KEY}

# Google Places API (new)
GOOGLE_PLACES_API_KEY=${GOOGLE_KEY}

# Server Configuration
NODE_ENV=production
PORT=3000
EOF

    print_status ".env file created"
}

# Install dependencies
install_dependencies() {
    echo -e "\n${BLUE}Installing dependencies...${NC}"

    npm install
    print_status "Dependencies installed"
}

# Start server
start_server() {
    echo -e "\n${BLUE}Starting server...${NC}"

    # Check if server is already running
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
        print_warning "Server already running on port 3000"
        read -p "Stop existing server and restart? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            lsof -Pi :3000 -sTCP:LISTEN -t | xargs kill -9 2>/dev/null || true
            sleep 2
        else
            return
        fi
    fi

    # Start server
    npm start &
    SERVER_PID=$!

    # Wait for server to start
    echo "Waiting for server to start..."
    sleep 5

    # Check if server is running
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
        print_status "Server started successfully (PID: $SERVER_PID)"
        print_info "Admin interface: http://localhost:3000/admin"
        print_info "API endpoint: http://localhost:3000/api/display"
        print_info "Preview: http://localhost:3000/preview"
    else
        print_error "Server failed to start"
        exit 1
    fi
}

# Flash firmware
flash_firmware() {
    if [ "$HAS_PIO" = false ]; then
        print_warning "PlatformIO not installed - skipping firmware flash"
        return
    fi

    echo -e "\n${BLUE}Firmware Flashing${NC}"
    read -p "Do you want to flash firmware to device? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        return
    fi

    # Check for connected device
    echo "Checking for connected devices..."
    if ! pio device list | grep -q "/dev/"; then
        print_error "No device connected via USB"
        return
    fi

    print_status "Device found"

    # Update SERVER_URL in config.h
    echo "Configuring server URL..."
    read -p "Enter your server URL (or press Enter for localhost): " SERVER_URL
    if [ -z "$SERVER_URL" ]; then
        SERVER_URL="http://localhost:3000"
    fi

    # Update config.h
    sed -i.bak "s|#define SERVER_URL.*|#define SERVER_URL \"${SERVER_URL}\"|" firmware/include/config.h
    print_status "Server URL configured: $SERVER_URL"

    # Flash firmware
    echo "Flashing firmware..."
    cd firmware
    pio run -t upload -e trmnl
    cd ..

    print_status "Firmware flashed successfully"
    print_info "Device will reboot and show setup screen"
}

# Test deployment
test_deployment() {
    echo -e "\n${BLUE}Testing deployment...${NC}"

    # Test server endpoints
    if curl -s http://localhost:3000/admin > /dev/null; then
        print_status "Admin interface accessible"
    else
        print_error "Admin interface not accessible"
    fi

    if curl -s http://localhost:3000/api/display > /dev/null; then
        print_status "API endpoint accessible"
    else
        print_error "API endpoint not accessible"
    fi

    print_info "\nDeployment test complete"
}

# Main deployment flow
main() {
    echo -e "\n${BLUE}Starting deployment...${NC}\n"

    check_prerequisites
    setup_environment
    install_dependencies
    start_server
    flash_firmware
    test_deployment

    echo -e "\n${GREEN}=========================================${NC}"
    echo -e "${GREEN}    Deployment Complete!${NC}"
    echo -e "${GREEN}=========================================${NC}"
    echo ""
    echo -e "Next steps:"
    echo -e "  1. Open ${BLUE}http://localhost:3000/admin${NC}"
    echo -e "  2. Follow the step-by-step setup wizard"
    echo -e "  3. Configure your API keys, locations, and journey"
    echo -e "  4. View your live transit display"
    echo ""
    echo -e "Documentation:"
    echo -e "  - ${BLUE}START-HERE.md${NC} - Quick start guide"
    echo -e "  - ${BLUE}DEPLOYMENT-TEMPLATE.md${NC} - Full deployment guide"
    echo -e "  - ${BLUE}DEVELOPMENT-RULES.md${NC} - Development guidelines"
    echo ""
    echo -e "Server logs: ${BLUE}server.log${NC}"
    echo -e "Stop server: ${BLUE}kill $SERVER_PID${NC}"
    echo ""
}

# Run main function
main
