#!/bin/bash

# Exit on error
set -e

# Default settings
INCREMENT_TYPE="auto"
KEEP_COUNT=1
AUTO_MODE=true
RC_MODE=false

# Display help text
function show_help {
    echo "GhostWriter Build Script"
    echo "------------------------"
    echo "Usage: ./build.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help               Show this help message"
    echo "  -t, --type TYPE          Version increment type: auto, patch, minor, major, rc (default: auto)"
    echo "  -c, --clean              Clean all previous builds"
    echo "  -k, --keep NUM           Number of previous versions to keep (default: 1)"
    echo "  -m, --manual             Disable automatic version determination (use with -t)"
    echo ""
    echo "Examples:"
    echo "  ./build.sh                           # Auto-determine version increment based on git commits"
    echo "  ./build.sh -t patch                  # Force patch version increment (0.0.1 -> 0.0.2)"
    echo "  ./build.sh -t minor                  # Force minor version increment (0.0.1 -> 0.1.0)"
    echo "  ./build.sh -t major                  # Force major version increment (0.0.1 -> 1.0.0)"
    echo "  ./build.sh -t rc                     # Create/increment release candidate (0.0.1 -> 0.0.1-rc.1)"
    echo "  ./build.sh -c                        # Clean all previous builds"
    echo "  ./build.sh -k 3                      # Keep 3 most recent versions"
    echo "  ./build.sh -m -t minor               # Force minor version, don't auto-determine"
    echo ""
    echo "Auto mode detects version type based on git commit messages:"
    echo "  - Major: Messages containing 'BREAKING CHANGE' or '!:'"
    echo "  - Minor: Messages containing 'feat:' or 'feature:'"
    echo "  - Patch: All other changes (fixes, docs, refactor, etc.)"
    echo "  - RC: Messages containing 'rc' or 'release candidate'"
}

# Parse command line arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -h|--help) show_help; exit 0 ;;
        -t|--type) 
            INCREMENT_TYPE="$2"
            if [[ ! "$INCREMENT_TYPE" =~ ^(auto|patch|minor|major|rc)$ ]]; then
                echo "Error: Version type must be 'auto', 'patch', 'minor', 'major', or 'rc'."
                exit 1
            fi
            shift ;;
        -c|--clean) CLEAN_ALL=true ;;
        -k|--keep)
            KEEP_COUNT="$2"
            if ! [[ "$KEEP_COUNT" =~ ^[0-9]+$ ]]; then
                echo "Error: Keep count must be a number."
                exit 1
            fi
            shift ;;
        -m|--manual) AUTO_MODE=false ;;
        *) echo "Unknown parameter: $1"; show_help; exit 1 ;;
    esac
    shift
done

echo "🚀 Building GhostWriter extension..."

# Clean all builds if requested
if [ "$CLEAN_ALL" = true ]; then
    echo "Cleaning all previous builds..."
    rm -f *.vsix
fi

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"

# Determine if this is a pre-release version
if [[ "$CURRENT_VERSION" == *"-rc."* ]]; then
    IS_RC=true
else
    IS_RC=false
fi

# Auto-determine version increment type based on git commits if in auto mode
if [ "$INCREMENT_TYPE" = "auto" ] && [ "$AUTO_MODE" = true ]; then
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
fi

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

# Package the extension
echo "Packaging extension..."
npx @vscode/vsce package

# Create git tag for this version if in auto mode
if [ "$AUTO_MODE" = true ]; then
    echo "Creating git tag for version $NEW_VERSION..."
    git add package.json
    git commit -m "Bump version to $NEW_VERSION"
    git tag -a "v$NEW_VERSION" -m "Version $NEW_VERSION"
    echo "Tag created. Use 'git push --tags' to push the new tag to remote repository."
fi

# Get a list of all vsix files
VSIX_FILES=($(ls -t *.vsix))
VSIX_COUNT=${#VSIX_FILES[@]}

# Keep only the specified number of recent versions
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
    echo "- To finalize this RC, run: ./build.sh -t patch"
elif [ "$IS_RC" = true ] && [ "$INCREMENT_TYPE" = "patch" ]; then
    echo ""
    echo "🎉 Release Notes:"
    echo "- Successfully finalized from release candidate to stable version"
fi 