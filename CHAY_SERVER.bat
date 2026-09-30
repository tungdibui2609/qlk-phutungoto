@echo off
title Modular WMS - Server Launcher
cd /d "%~dp0"
if exist "%~dp0ServerManager.exe" (
    start "" "%~dp0ServerManager.exe"
) else (
    start "" pythonw server_launcher.py
)
exit
