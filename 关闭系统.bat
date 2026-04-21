@echo off
chcp 65001 >nul 2>&1
title Close Weight Tracker

echo ==============================================
echo   Weight Tracker - Close System
echo ==============================================
echo.

:: 检查是否有进程在监听 5000 端口
netstat -ano | findstr ":5000 " | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo [INFO] System is not running.
    echo.
    timeout /t 3
    exit /b 0
)

echo [STOP] Stopping server...

:: 通过端口找到 PID 并终止
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000 " ^| findstr "LISTENING"') do (
    echo [STOP] Killing PID: %%a
    taskkill /PID %%a /F >nul 2>&1
)

:: 等待1秒确认
timeout /t 1 /nobreak >nul

:: 验证是否关闭成功
netstat -ano | findstr ":5000 " | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo.
    echo ==============================================
    echo   [OK] System closed successfully!
    echo ==============================================
) else (
    echo.
    echo [WARN] Some processes may still be running.
    echo Check Task Manager for python.exe
)

echo.
timeout /t 3
