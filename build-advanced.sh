#!/bin/bash

# Exit on error
set -e

# Default version increment type
INCREMENT_TYPE="patch"

# Display help text
function show_help {
    echo "GhostWriter Build Script"
    echo "------------------------"
    echo "Usage: ./build-advanced.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help               Show this help message"
    echo "  -t, --type TYPE          Version increment type: patch, minor, or major (default: patch)"
    echo "  -c, --clean              Clean all previous builds"
    echo "  -k, --keep NUM           Number of previous versions to keep (default: 1)"
    echo ""
    echo "Examples:"
    echo "  ./build-advanced.sh                  # Increment patch version (0.0.1 -> 0.0.2)"
    echo "  ./build-advanced.sh -t minor         # Increment minor version (0.0.1 -> 0.1.0)"
    echo "  ./build-advanced.sh -t major         # Increment major version (0.0.1 -> 1.0.0)"
    echo "  ./build-advanced.sh -c               # Clean all previous builds and create new one"
    echo "  ./build-advanced.sh -k 3             # Keep 3 most recent versions"
}

# Parse command line arguments
KEEP_COUNT=1

while [[ "$#" -gt 0 ]]; do
    case $1 in
        -h|--help) show_help; exit 0 ;;
        -t|--type) 
            INCREMENT_TYPE="$2"
            if [[ ! "$INCREMENT_TYPE" =~ ^(patch|minor|major)$ ]]; then
                echo "Error: Version type must be 'patch', 'minor', or 'major'."
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

# Increment version
echo "Incrementing $INCREMENT_TYPE version..."
npm version $INCREMENT_TYPE --no-git-tag-version
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