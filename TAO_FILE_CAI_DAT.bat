@echo off
title Modular WMS - Tien Hanh Dong Goi File Cai Dat All-In-One
chcp 65001 >nul
cd /d "%~dp0"

echo ====================================================================
echo   ⚡ MODULAR WMS - DONG GOI 1 FILE CAI DAT ALL-IN-ONE CHO MAY MOI
echo ====================================================================
echo.

set "ISCC_PATH=C:\Users\tungd\AppData\Local\Programs\Inno Setup 6\ISCC.exe"
if not exist "%ISCC_PATH%" (
    echo [LOI] Khong tim thay Inno Setup tai: %ISCC_PATH%
    echo Vui long kiem tra lai duong dan Inno Setup!
    pause
    exit /b 1
)

echo [1/3] Kiem tra va bien dich ServerManager.exe...
if not exist "ServerManager.exe" (
    echo Dang tao file ServerManager.exe bang PyInstaller...
    python -m PyInstaller --onefile --noconsole --name "ServerManager" --clean server_launcher.py
    copy /y "dist\ServerManager.exe" "ServerManager.exe" >nul
) else (
    echo Da co ServerManager.exe san sang.
)

echo.
echo [2/3] Dang dong goi toan bo he thong thanh 1 file cai dat duy nhat...
echo (Qua trinh nen code goc + build production + database se mat khoang 1-3 phut)
echo.

"%ISCC_PATH%" "installer_config.iss"

if errorlevel 1 (
    echo.
    echo [LOI] Qua trinh dong goi gap loi!
    pause
    exit /b 1
)

echo.
echo ====================================================================
echo   [THANH CONG 100%%] FILE CAI DAT DA DUOC TAO TAI:
echo   %~dp0dist_installer\Setup_ModularWMS_AllInOne_v1.0.exe
echo ====================================================================
echo.
echo Dang mo thu muc chua file cai dat...
start "" "%~dp0dist_installer"
pause
