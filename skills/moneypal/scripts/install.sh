#!/bin/sh
# 包外引导入口（POSIX）：只做定位与转发，业务判断全部在 bootstrap.mjs，避免两套平台逻辑漂移。
set -eu

script_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if ! command -v node >/dev/null 2>&1; then
  echo "需要 Node.js 22.9.0+；请先安装 Node 后重新运行本脚本。" >&2
  exit 1
fi

exec node "$script_directory/bootstrap.mjs" "$@"
