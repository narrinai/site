#!/bin/bash

echo "⚠️  WARNING: This will rewrite Git history!"
echo "Make sure you've already revoked the old API key in Airtable."
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Create a backup branch
    git branch backup-before-clean
    
    # Use git filter-repo (more modern than filter-branch)
    echo "Cleaning repository..."
    
    # First, let's try with git's built-in functionality
    git filter-branch --tree-filter "
        if [ -f scripts/fetch-airtable-avatars.js ]; then
            sed -i '' 's/patxeVJCLQH53flsH\.821cb409f4264bd63eec0185093933e5d718d96d5e1b865aa8901c6b5ff398ac/[REMOVED-API-KEY]/g' scripts/fetch-airtable-avatars.js
        fi
    " --tag-name-filter cat -- --all
    
    echo "✅ Git history cleaned!"
    echo ""
    echo "Next steps:"
    echo "1. Review the changes: git log -p -S 'patxeVJCLQH53flsH'"
    echo "2. If everything looks good, force push: git push --force"
    echo "3. Delete the backup branch: git branch -d backup-before-clean"
    echo ""
    echo "⚠️  Note: Force pushing will rewrite remote history. Make sure to coordinate with your team."
else
    echo "Cancelled."
fi