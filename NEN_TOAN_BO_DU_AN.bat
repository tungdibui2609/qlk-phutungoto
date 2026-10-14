@echo off
title Modular WMS - Nen Toan Bo Thu Muc Du An (Dong Bo Google Drive)
chcp 65001 >nul
cd /d "%~dp0"

echo ====================================================================
echo   MODULAR WMS - NÉN TOÀN BỘ THƯ MỤC DỰ ÁN ĐỂ ĐỒNG BỘ GOOGLE DRIVE
echo ====================================================================
echo.

if not exist "backups" mkdir "backups"

for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set "TIMESTAMP=%datetime:~0,8%_%datetime:~8,6%"
if "%TIMESTAMP%"=="_" (
    set "TIMESTAMP=%date:~10,4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
    set "TIMESTAMP=%TIMESTAMP: =0%"
)

set "WINRAR_EXE=C:\Program Files\WinRAR\Rar.exe"
if not exist "%WINRAR_EXE%" (
    set "WINRAR_EXE=C:\Program Files\WinRAR\WinRAR.exe"
)

if exist "%WINRAR_EXE%" (
    echo [1/2] Tim thay WinRAR! Dang tien hanh nen RAR5 (Giu nguyen node_modules, bo qua thu muc build .next)...
    set "OUTPUT_FILE=%~dp0backups\ModularWMS_Full_%TIMESTAMP%.rar"
    "%WINRAR_EXE%" a -r -s -m3 -ep1 -x"backups\*" -x"dist_installer\*" -x".next\*" "!OUTPUT_FILE!" *
) else (
    echo [1/2] Dang su dung PowerShell de nen file ZIP...
    set "OUTPUT_FILE=%~dp0backups\ModularWMS_Full_%TIMESTAMP%.zip"
    powershell -NoProfile -Command "$dest = '%~dp0backups\ModularWMS_Full_%TIMESTAMP%.zip'; Compress-Archive -Path (Get-ChildItem -Path '%~dp0' -Exclude 'backups','dist_installer','.next') -DestinationPath $dest -CompressionLevel Optimal"
)

if exist "%OUTPUT_FILE%" (
    echo.
    echo ====================================================================
    echo   [THANH CONG 100%%] FILE NEN DA DUOC TAO TAI:
    echo   %OUTPUT_FILE%
    echo ====================================================================
    echo.
    echo Dang mo thu muc backups...
    start "" "%~dp0backups"
) else (
    echo.
    echo [LOI] Khong the tao file nen! Vui long kiem tra lai.
)

pause
