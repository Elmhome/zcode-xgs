#!/bin/bash
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
source "$ROOT/scripts/macos.sh"
trap xgs_finish EXIT
xgs_find_node
APP="${ZCODE_APP:-/Applications/ZCode.app}"
CLI="${ZCODE_CLI:-$APP/Contents/Resources/glm/zcode.cjs}"
if [ ! -f "$CLI" ]; then
  printf '找不到 ZCode CLI：%s\n可用 ZCODE_APP 或 ZCODE_CLI 指定安装路径。\n' "$CLI" >&2
  exit 1
fi
cd -- "$ROOT"
printf 'XGS · ZCode\n项目：%s\nNode：%s\n' "$ROOT" "$XGS_NODE"
"$XGS_NODE" --check "$ROOT/hooks/hook.js"
"$XGS_NODE" "$CLI" plugins validate "$ROOT"
case "${1:-}" in
  --check)
    "$XGS_NODE" "$ROOT/scripts/manage.cjs" check
    printf '\n检查通过；未安装或启动会话。\n'
    ;;
  --uninstall)
    "$XGS_NODE" "$ROOT/scripts/manage.cjs" uninstall
    ;;
  --install-only)
    "$XGS_NODE" "$ROOT/scripts/manage.cjs" install
    ;;
  '')
    "$XGS_NODE" "$ROOT/scripts/manage.cjs" install
    printf '\n正在打开 ZCode。如应用已经打开，请完全退出后重开，再新建对话发送 XGS。\n'
    open -a "$APP"
    ;;
  *)
    printf '用法：start.command [--check | --install-only | --uninstall]\n' >&2
    exit 1
    ;;
esac
