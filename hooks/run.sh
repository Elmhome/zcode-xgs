#!/bin/bash
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
source "$ROOT/scripts/macos.sh"
xgs_find_node
exec "$XGS_NODE" "$ROOT/hooks/hook.js"
