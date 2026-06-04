#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
echo "Installing armiai globally from: $ROOT"
npm install -g .
echo "Done. Try: armiai doctor"
