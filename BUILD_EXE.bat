@echo off
title Bien dich ServerManager.exe
cd /d "%~dp0"
echo Dang tat ServerManager cu neu dang chay...
taskkill /F /IM ServerManager.exe 2>nul
timeout /t 2 /nobreak >nul
powershell -Command "Remove-Item -Recurse -Force 'build', 'dist' -ErrorAction SilentlyContinue"
echo Dang bien dich ServerManager.exe moi nhat tu server_launcher.py...
python -m PyInstaller --noconfirm ServerManager.spec
if exist dist\ServerManager.exe (
    copy /y dist\ServerManager.exe ServerManager.exe
    echo.
    echo ==============================================
    echo [THANH CONG] Da cap nhat ServerManager.exe moi nhat!
    echo ==============================================
) else (
    echo.
    echo [LOI] Khong the tao file exe.
)
pause
