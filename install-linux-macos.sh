#!/usr/bin/env bash
set -euo pipefail
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${HOME}/.config/opencode/agents"
mkdir -p "$TARGET_DIR"
cp "$SRC_DIR"/agents/*.md "$TARGET_DIR"/
echo "Installed company-style role-based SDD agents to: $TARGET_DIR"
echo "Use: @flow-director Start company-style SDD flow from this idea: ..."
