@echo off
title Modular WMS - Sao Luu Du Lieu CSDL Supabase
chcp 65001 >nul
cd /d "%~dp0"

set BACKUP_DIR=D:\chanh thu\backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set FILENAME=%BACKUP_DIR%\backup_supabase_%datetime:~0,8%_%datetime:~8,6%.sql

echo ====================================================================
echo   ⚡ MODULAR WMS - TIEN HANH SAO LUU DU LIEU SUPABASE LOCAL
echo ====================================================================
echo.
echo [1/2] Dang kiem tra va xuat toan bo du lieu database local...
echo.

cmd /c npx.cmd supabase db dump --local --data-only -f "%FILENAME%"

if exist "%FILENAME%" (
    echo.
    echo ====================================================================
    echo  [THANH CONG 100%%] Da sao luu du lieu CSDL vao file:
    echo  %FILENAME%
    echo ====================================================================
) else (
    echo.
    echo [LOI] Khong the tao file sao luu! Vui long kiem tra Supabase co dang chay khong.
)

echo.
echo Nhan phim bat ky de mo thu muc sao luu hoac thoat...
pause >nul
start "" "%BACKUP_DIR%"
exit
