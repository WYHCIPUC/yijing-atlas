@echo off
REM 易经学习网站本地启动脚本（固定 3030 端口）
REM 双击此文件即可启动，浏览器打开 http://localhost:3030/
cd /d "%~dp0"
echo 启动中... 打开 http://localhost:3030/  (关闭此窗口停止)
where python >nul 2>&1 && (
  python -m http.server 3030 --bind 0.0.0.0
) || (
  where py >nul 2>&1 && (
    py -m http.server 3030 --bind 0.0.0.0
  ) || (
    echo 未找到 Python，请先安装 Python 3
    pause
  )
)
