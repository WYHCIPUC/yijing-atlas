#!/usr/bin/env bash
# 易经学习网站本地启动脚本（固定 3030 端口）
# 用法：在本目录运行 bash serve.sh，或双击 serve.bat（Windows）
# 然后浏览器打开 http://localhost:3030/

PORT=3030
cd "$(dirname "$0")"

# 优先用 Python（Windows 通常自带），其次 Node
if command -v python >/dev/null 2>&1; then
  echo "启动中... → http://localhost:$PORT/  (按 Ctrl+C 停止)"
  python -m http.server $PORT --bind 0.0.0.0
elif command -v py >/dev/null 2>&1; then
  echo "启动中... → http://localhost:$PORT/  (按 Ctrl+C 停止)"
  py -m http.server $PORT --bind 0.0.0.0
elif command -v npx >/dev/null 2>&1; then
  echo "启动中... → http://localhost:$PORT/  (按 Ctrl+C 停止)"
  npx http-server -p $PORT -a 0.0.0.0 -c-1
else
  echo "未找到 python 或 npx，请先安装 Python 3 或 Node.js" >&2
  exit 1
fi
