@echo off
title Modular WMS - Nap / Phuc Hoi Du Lieu CSDL Supabase
chcp 65001 >nul
cd /d "%~dp0"

echo ====================================================================
echo   ⚡ MODULAR WMS - PHUC HOI / NAP DU LIEU VAO SUPABASE LOCAL
echo ====================================================================
echo.

set BACKUP_DIR=%~dp0backups
if not exist "%BACKUP_DIR%" (
    echo [THONG BAO] Chua co thu muc backups tai: %BACKUP_DIR%
    mkdir "%BACKUP_DIR%"
)

echo Kiem tra container PostgreSQL Supabase Local...
docker ps --format "{{.Names}}" | findstr /i "supabase_db_anywarehouse" >nul
if errorlevel 1 (
    echo [CANH BAO] Supabase Local chua duoc khoi dong!
    echo Vui long chay CHAY_SERVER.bat hoac 'npx supabase start' truoc khi nap du lieu.
    pause
    exit /b 1
)

echo.
echo Hay keo tha file .sql can nap vao cua so nay va nhan ENTER:
set /p SQLFILE="Duong dan file SQL: "

if not exist "%SQLFILE%" (
    echo [LOI] Khong tim thay file: %SQLFILE%
    pause
    exit /b 1
)

echo.
echo Dang nap du lieu vao PostgreSQL... Vui long doi vai giay!
docker exec -i supabase_db_anywarehouse psql -U postgres -d postgres < "%SQLFILE%"

echo.
echo ====================================================================
echo   [HOAN TAT] Da thuc hien nap file CSDL xong!
echo ====================================================================
pause
