#!/bin/bash

# Daily Avatar Download Script
# This script should be run daily to download any Replicate avatars and save them locally

echo "🔄 Starting daily avatar download process..."
cd "/Users/sebastiaansmits/Documents/Narrin AI"

# Check if there are any Replicate URLs to download
echo "🔍 Checking for Replicate avatars..."
RESPONSE=$(curl -s "https://narrin.ai/.netlify/functions/regenerate-avatars?secret=avatarurls12345")
COUNT=$(echo $RESPONSE | grep -o '"count":[0-9]*' | cut -d':' -f2)

if [ "$COUNT" = "0" ]; then
    echo "✅ No Replicate avatars found. All avatars are already local!"
    exit 0
fi

echo "📊 Found $COUNT characters with Replicate avatars"
echo "📥 Running download script..."

# Run the Node.js download script
node scripts/download-replicate-avatars.js

# Check if the script was successful
if [ $? -eq 0 ]; then
    echo "✅ Avatar download completed successfully"
    
    # Optional: Commit the new avatars to git
    echo "💾 Adding new avatars to git..."
    git add avatars/
    
    if git diff --cached --quiet; then
        echo "ℹ️ No new avatars to commit"
    else
        git commit -m "Add newly downloaded avatars from Replicate

🤖 Generated with Claude Code
        
Co-Authored-By: Claude <noreply@anthropic.com>"
        
        echo "📤 Pushing to remote repository..."
        git push
        echo "✅ New avatars committed and pushed"
    fi
else
    echo "❌ Avatar download failed"
    exit 1
fi

echo "🎉 Daily avatar download process complete!"