@echo off
chcp 65001 >nul 2>&1
title Weight Tracker

echo ==============================================
echo   Weight Tracker - Yi Jian Qi Dong
echo ==============================================
echo.

:: 切换到脚本所在目录（即项目根目录）
cd /d "%~dp0"

:: --- 检查 Python ---
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found!
    echo.
    echo   Please install Python 3.8+:
    echo   https://www.python.org/downloads/
    echo   Make sure to check: Add Python to PATH
    echo.
    pause
    exit /b 1
)

:: --- 检查是否已经在运行 ---
netstat -ano | findstr ":5000 " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo [INFO] System is already running!
    echo.
    echo   Browser: http://localhost:5000
    echo.
    echo   To restart, run: close.bat
    echo.
    start http://localhost:5000
    timeout /t 5
    exit /b 0
)

:: --- 检查并安装依赖 ---
set NEED_INSTALL=0

python -c "import flask" >nul 2>&1
if errorlevel 1 set NEED_INSTALL=1

python -c "import waitress" >nul 2>&1
if errorlevel 1 set NEED_INSTALL=1

python -c "import requests" >nul 2>&1
if errorlevel 1 set NEED_INSTALL=1

if %NEED_INSTALL%==1 (
    echo [INSTALL] Missing dependencies, installing...
    echo.
    python -m pip install -r requirements.txt --quiet
    if errorlevel 1 (
        echo [ERROR] Install failed! Check your network.
        echo.
        echo   Try: pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
        echo.
        pause
        exit /b 1
    )
    echo [INSTALL] Done!
    echo.
)

:: --- 初始化数据库 ---
if not exist "backend\data\weight_tracker.db" (
    echo [INIT] First run, creating database...
    python -c "from backend.init_db import init_database; init_database()"
    echo [INIT] Database created!
    echo.
)

:: --- 启动服务 ---
echo [START] Starting Waitress server...
echo.

:: 后台启动服务
start /b "WeightTracker" python -m backend.app

:: 等待服务就绪（最多15秒）
echo [WAIT] Server starting...
set /a count=0
:wait_loop
timeout /t 1 /nobreak >nul
set /a count+=1
netstat -ano | findstr ":5000 " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 goto :ready
if %count% lss 15 goto :wait_loop

echo [WARN] Server start timeout!
pause
exit /b 1

:ready
echo.
echo ==============================================
echo   [OK] System started successfully!
echo.
echo   Browser:  http://localhost:5000
echo   Database: backend\data\weight_tracker.db
echo.
echo   To stop:  close.bat
echo ==============================================
echo.

:: 自动打开浏览器
start http://localhost:5000

:: 保持窗口显示日志
echo [LOG] Waitress running, showing backend logs...
echo      Press Ctrl+C or close this window to stop.
echo.
python -m backend.app
