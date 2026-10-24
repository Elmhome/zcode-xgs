#!/bin/bash
# Shared by the Finder launcher and process hooks. No output on success.
xgs_find_node() {
  export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
  XGS_NODE=""
  if [ -n "${NODE_EXE:-}" ]; then
    XGS_NODE="$(command -v "$NODE_EXE")" || return 1
  elif command -v node >/dev/null 2>&1; then
    XGS_NODE="$(command -v node)"
  else
    local candidate
    for candidate in "${NVM_DIR:-$HOME/.nvm}"/versions/node/*/bin/node "$HOME/.volta/bin/node" "/Applications/DeepSeek Harness.app/Contents/Resources/runtime/primary-runtime/dependencies/node/bin/node"; do
      if [ -x "$candidate" ] && { [ -z "$XGS_NODE" ] || [ "$candidate" -nt "$XGS_NODE" ]; }; then
        XGS_NODE="$candidate"
      fi
    done
  fi
  if [ -z "$XGS_NODE" ]; then
    printf '找不到 Node.js，请安装后重试：https://nodejs.org/\n' >&2
    return 1
  fi
  export PATH="$(dirname -- "$XGS_NODE"):$PATH"
}
xgs_finish() {
  local status=$?
  if [ "$status" -ne 0 ]; then
    printf '\n操作失败（退出码 %s），请查看上面的错误信息。\n' "$status" >&2
    if [ -t 0 ]; then read -r -p '按回车键关闭…' _ || true; fi
  fi
}
