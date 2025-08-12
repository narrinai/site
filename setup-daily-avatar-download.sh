#!/bin/bash

# Setup script for daily avatar download
echo "🔧 Setting up daily avatar download script..."

# Get the current directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
NODE_PATH=$(which node)

# Check if node is installed
if [ -z "$NODE_PATH" ]; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "📝 Found Node.js at: $NODE_PATH"

# Create the cron job command
CRON_COMMAND="0 2 * * * cd '$SCRIPT_DIR' && $NODE_PATH scripts/download-replicate-avatars.js >> scripts/avatar-download.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "download-replicate-avatars"; then
    echo "⚠️  A cron job for download-replicate-avatars already exists:"
    crontab -l | grep "download-replicate-avatars"
    echo ""
    read -p "Do you want to replace it? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Setup cancelled"
        exit 1
    fi
    # Remove existing job
    (crontab -l 2>/dev/null | grep -v "download-replicate-avatars") | crontab -
fi

# Add the new cron job
(crontab -l 2>/dev/null; echo "$CRON_COMMAND") | crontab -

echo "✅ Cron job successfully added!"
echo ""
echo "📅 The script will run daily at 2:00 AM"
echo "📁 Logs will be saved to: $SCRIPT_DIR/scripts/avatar-download.log"
echo ""
echo "To verify the cron job was added, run: crontab -l"
echo "To remove the cron job, run: crontab -e and delete the line"
echo ""
echo "💡 You can also run the script manually at any time with:"
echo "   node scripts/download-replicate-avatars.js"