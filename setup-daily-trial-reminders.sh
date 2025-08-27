#!/bin/bash

# Setup script for daily trial reminder emails
echo "📧 Setting up daily trial reminder email script..."

# Get the current directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Create the cron job command to call Netlify function daily
CRON_COMMAND="0 9 * * * curl -X POST https://narrin.ai/.netlify/functions/send-trial-reminders >> '$SCRIPT_DIR/scripts/trial-reminders.log' 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "send-trial-reminders"; then
    echo "⚠️  A cron job for send-trial-reminders already exists:"
    crontab -l | grep "send-trial-reminders"
    echo ""
    read -p "Do you want to replace it? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Setup cancelled"
        exit 1
    fi
    # Remove existing job
    (crontab -l 2>/dev/null | grep -v "send-trial-reminders") | crontab -
fi

# Add the new cron job
(crontab -l 2>/dev/null; echo "$CRON_COMMAND") | crontab -

echo "✅ Cron job successfully added!"
echo ""
echo "📅 The trial reminder emails will be sent daily at 9:00 AM"
echo "📁 Logs will be saved to: $SCRIPT_DIR/scripts/trial-reminders.log"
echo ""
echo "📧 This will check for:"
echo "   • Users whose trial ends tomorrow → 'ending soon' email"
echo "   • Users whose trial ended yesterday → 'expired' email"
echo ""
echo "To verify the cron job was added, run: crontab -l"
echo "To remove the cron job, run: crontab -e and delete the line"
echo ""
echo "💡 You can test the emails manually at any time with:"
echo "   curl -X POST https://narrin.ai/.netlify/functions/test-trial-emails"