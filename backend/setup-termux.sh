#!/data/data/com.termux/files/usr/bin/bash

# ==============================================================================
# PICKMI SYSTEM - TERMUX SETUP SCRIPT
# This script installs all necessary packages to run the backend on Android.
# ==============================================================================

echo "Starting Pickmi System - Backend Setup for Termux..."

# 1. Update and upgrade packages
echo "Updating packages..."
pkg update && pkg upgrade -y

# 2. Install Node.js
echo "Installing Node.js..."
pkg install nodejs-lts -y

# 3. Install Chromium (required for WhatsApp Web/Puppeteer)
echo "Installing Chromium and dependencies..."
pkg install chromium -y
pkg install nss freetype harfbuzz libgbm libjpeg-turbo -y

# 4. Install Git and basic tools
echo "Installing Git and tools..."
pkg install git openssh -y

# 5. Setup environment variables (Puppeteer path)
echo "Setting up environment variables..."
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
export PUPPETEER_EXECUTABLE_PATH=$(which chromium)

# Save the executable path in .env if not already present
if [ -f .env ]; then
    if ! grep -q "PUPPETEER_EXECUTABLE_PATH" .env; then
        echo "PUPPETEER_EXECUTABLE_PATH=$PUPPETEER_EXECUTABLE_PATH" >> .env
        echo "Added PUPPETEER_EXECUTABLE_PATH to .env"
    fi
else
    echo "PUPPETEER_EXECUTABLE_PATH=$PUPPETEER_EXECUTABLE_PATH" > .env
    echo "Created .env with PUPPETEER_EXECUTABLE_PATH"
fi

# 6. Install dependencies
echo "Installing Node.js dependencies..."
npm install

echo "--------------------------------------------------------"
echo "SETUP COMPLETE!"
echo "To start the Pickmi Backend server, run:"
echo "node server.js"
echo "--------------------------------------------------------"
