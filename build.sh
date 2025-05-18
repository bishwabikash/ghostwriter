#!/bin/bash

# Exit on error
set -e

# Automatic settings, no manual options
KEEP_COUNT=1

echo "🚀 Building GhostWriter extension..."

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"

# Determine if this is a pre-release version
if [[ "$CURRENT_VERSION" == *"-rc."* ]]; then
    IS_RC=true
else
    IS_RC=false
fi

# Auto-determine version increment type based on git commits
echo "Analyzing git commits for version increment type..."

# Get the latest git tag if it exists
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "none")

if [ "$LATEST_TAG" = "none" ]; then
    # No tags found, check all commits
    COMMIT_RANGE="HEAD"
else
    # Check commits since the latest tag
    COMMIT_RANGE="$LATEST_TAG..HEAD"
fi

# Look for specific patterns in commit messages to determine increment type
if git log $COMMIT_RANGE --grep="BREAKING CHANGE" --grep="!:" -i --oneline | grep -q .; then
    # Breaking changes indicate major version bump
    INCREMENT_TYPE="major"
elif git log $COMMIT_RANGE --grep="feat:" --grep="feature:" -i --oneline | grep -q .; then
    # New features indicate minor version bump
    INCREMENT_TYPE="minor"
elif git log $COMMIT_RANGE --grep="rc" --grep="release candidate" -i --oneline | grep -q .; then
    # Release candidate changes
    INCREMENT_TYPE="rc"
else
    # Default to patch for fixes, docs, etc.
    INCREMENT_TYPE="patch"
fi

echo "Detected version increment: $INCREMENT_TYPE"

# Handle version increments
if [ "$INCREMENT_TYPE" = "rc" ]; then
    # Handle release candidates
    if [ "$IS_RC" = true ]; then
        # Already a release candidate, increment the RC number
        RC_BASE=${CURRENT_VERSION%-rc.*}
        RC_NUM=${CURRENT_VERSION#*-rc.}
        NEW_RC_NUM=$((RC_NUM + 1))
        NEW_VERSION="$RC_BASE-rc.$NEW_RC_NUM"
        
        # Update package.json manually
        sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json
        echo "Incremented release candidate: $CURRENT_VERSION -> $NEW_VERSION"
    else
        # Create a new release candidate from the current version
        NEW_VERSION="$CURRENT_VERSION-rc.1"
        
        # Update package.json manually
        sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json
        echo "Created release candidate: $CURRENT_VERSION -> $NEW_VERSION"
    fi
else
    # Handle normal version increments or convert RC to final
    if [ "$IS_RC" = true ] && [ "$INCREMENT_TYPE" = "patch" ]; then
        # Convert RC to final release
        NEW_VERSION=${CURRENT_VERSION%-rc.*}
        
        # Update package.json manually
        sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json
        echo "Finalized from release candidate: $CURRENT_VERSION -> $NEW_VERSION"
    else
        # Normal version increment
        echo "Incrementing $INCREMENT_TYPE version..."
        npm version $INCREMENT_TYPE --no-git-tag-version
        NEW_VERSION=$(node -p "require('./package.json').version")
        echo "New version: $NEW_VERSION"
    fi
fi

# Compile the extension
echo "Compiling extension..."
npm run compile

# Ensure SVG images are converted to PNG format (VS Code has restrictions on SVGs)
echo "Converting SVG images to PNG format..."

# Check for svgexport tool
if ! command -v svgexport &> /dev/null; then
    echo "Warning: svgexport not found. Installing with npm..."
    npm install -g svgexport
fi

# Convert main icon
if [ -f "resources/icon.svg" ]; then
    echo "Converting icon.svg to PNG..."
    svgexport resources/icon.svg resources/icon.png 128:128
fi

# Convert images in resources/images directory
if [ -d "resources/images" ]; then
    for SVG_FILE in resources/images/*.svg; do
        if [ -f "$SVG_FILE" ]; then
            PNG_FILE="${SVG_FILE%.svg}.png"
            
            # Get dimensions from SVG if possible, or use defaults
            WIDTH=$(grep -o 'width="[0-9]*"' "$SVG_FILE" | grep -o '[0-9]*' || echo "800")
            HEIGHT=$(grep -o 'height="[0-9]*"' "$SVG_FILE" | grep -o '[0-9]*' || echo "600")
            
            echo "Converting $SVG_FILE to PNG ($WIDTH x $HEIGHT)..."
            svgexport "$SVG_FILE" "$PNG_FILE" "${WIDTH}:${HEIGHT}"
            
            # Update references in README.md
            SVG_BASENAME=$(basename "$SVG_FILE")
            PNG_BASENAME=$(basename "$PNG_FILE")
            if grep -q "$SVG_BASENAME" README.md; then
                echo "Updating reference in README.md: $SVG_BASENAME -> $PNG_BASENAME"
                sed -i '' "s/$SVG_BASENAME/$PNG_BASENAME/g" README.md
            fi
        fi
    done
fi

# Package the extension
echo "Packaging extension..."
npx @vscode/vsce package

# Create git tag for this version
echo "Creating git tag for version $NEW_VERSION..."
git add package.json
git commit -m "Bump version to $NEW_VERSION"
git tag -a "v$NEW_VERSION" -m "Version $NEW_VERSION"
echo "Tag created. Use 'git push --tags' to push the new tag to remote repository."

# Get a list of all vsix files
VSIX_FILES=($(ls -t *.vsix))
VSIX_COUNT=${#VSIX_FILES[@]}

# Keep only the most recent versions
if [ $VSIX_COUNT -gt $((KEEP_COUNT + 1)) ]; then
    echo "Keeping only the current and $KEEP_COUNT previous version(s)..."
    for (( i=$((KEEP_COUNT + 1)); i<$VSIX_COUNT; i++ )); do
        echo "Removing old version: ${VSIX_FILES[$i]}"
        rm "${VSIX_FILES[$i]}"
    done
fi

# Report success
echo "✅ Build complete!"
echo "Current version: ghostwriter-$NEW_VERSION.vsix"

# List kept previous versions
if [ $VSIX_COUNT -gt 1 ]; then
    echo "Previous version(s):"
    for (( i=1; i<=KEEP_COUNT && i<$VSIX_COUNT; i++ )); do
        echo "  ${VSIX_FILES[$i]}"
    done
fi

# Display instructions based on build type
if [ "$INCREMENT_TYPE" = "rc" ]; then
    echo ""
    echo "📝 Release Candidate Notes:"
    echo "- This is a pre-release version for testing"
    echo "- Run this script again and the RC will be incremented"
elif [ "$IS_RC" = true ] && [ "$INCREMENT_TYPE" = "patch" ]; then
    echo ""
    echo "🎉 Release Notes:"
    echo "- Successfully finalized from release candidate to stable version"
fi 