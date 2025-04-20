#!/bin/bash

# Script to automate migration of private repo to a new public GitHub repo with sanitized code

# Usage: ./migrate-to-public-repo.sh <new-public-repo-url>

if [ -z "$1" ]; then
  echo "Usage: $0 <new-public-repo-url>"
  exit 1
fi

NEW_REPO_URL=$1

echo "Starting migration to new public repo: $NEW_REPO_URL"

# Step 1: Remove existing git history
echo "Removing existing .git directory..."
rm -rf .git

# Step 2: Initialize new git repo
echo "Initializing new git repository..."
git init

# Step 3: Add all files
echo "Adding all files..."
git add .

# Step 4: Commit changes
echo "Committing changes..."
git commit -m "Initial commit for public repo - sanitized code"

# Step 5: Add new remote
echo "Adding new remote origin: $NEW_REPO_URL"
git remote add origin $NEW_REPO_URL

# Step 6: Push to new repo
echo "Pushing to new public repository..."
git branch -M main
git push -u origin main

echo "Migration complete. Your sanitized code is now pushed to the public repository."
