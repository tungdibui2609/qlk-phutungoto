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

echo [1/3] Bien dich ServerManager.exe moi nhat tu server_launcher.py...
taskkill /F /IM ServerManager.exe 2>nul
timeout /t 2 /nobreak >nul
powershell -Command "Remove-Item -Recurse -Force 'build', 'dist' -ErrorAction SilentlyContinue"
python -m PyInstaller --noconfirm ServerManager.spec
if exist "dist\ServerManager.exe" (
    copy /y "dist\ServerManager.exe" "ServerManager.exe" >nul
    echo Da cap nhat ServerManager.exe moi nhat.
) else (
    echo [CANH BAO] Khong the tao file exe moi, su dung file hien co.
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
