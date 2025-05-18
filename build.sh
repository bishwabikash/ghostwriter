#!/bin/bash

# Exit on error
set -e

echo "🚀 Building GhostWriter extension..."

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"

# Increment patch version
echo "Incrementing version..."
npm version patch --no-git-tag-version
NEW_VERSION=$(node -p "require('./package.json').version")
echo "New version: $NEW_VERSION"

# Compile the extension
echo "Compiling extension..."
npm run compile

# Package the extension
echo "Packaging extension..."
npx @vscode/vsce package

# Get a list of all vsix files
VSIX_FILES=($(ls -t *.vsix))
VSIX_COUNT=${#VSIX_FILES[@]}

# If we have more than 2 vsix files, delete the oldest ones
if [ $VSIX_COUNT -gt 2 ]; then
    echo "Keeping only the current and previous version..."
    for (( i=2; i<$VSIX_COUNT; i++ )); do
        echo "Removing old version: ${VSIX_FILES[$i]}"
        rm "${VSIX_FILES[$i]}"
    done
fi

# Report success
echo "✅ Build complete!"
echo "Current version: ghostwriter-$NEW_VERSION.vsix"
if [ $VSIX_COUNT -gt 1 ]; then
    echo "Previous version: ${VSIX_FILES[1]}"
fi 