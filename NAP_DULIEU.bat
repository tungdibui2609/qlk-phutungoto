@echo off
setlocal enabledelayedexpansion
title Modular WMS - Nap / Phuc Hoi Du Lieu CSDL Supabase
chcp 65001 >nul
cd /d "%~dp0"

echo ====================================================================
echo   MODULAR WMS - PHUC HOI DU LIEU VAO SUPABASE LOCAL
echo   (Lam trang bang cu + ghi lai, trong MOT giao dich co the hoan tac)
echo ====================================================================
echo.

set BACKUP_DIR=%~dp0backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"`) do set TS=%%I
if not defined TS set "TS=%RANDOM%"

echo [1/5] Kiem tra container PostgreSQL Supabase Local...
docker ps --format "{{.Names}}" | findstr /i "supabase_db_anywarehouse" >nul
if errorlevel 1 (
    echo [CANH BAO] Supabase Local chua duoc khoi dong!
    echo Vui long chay CHAY_SERVER.bat hoac 'npx supabase start' truoc khi nap du lieu.
    pause
    exit /b 1
)

echo.
echo Hay keo tha file .sql can phuc hoi vao cua so nay va nhan ENTER:
set /p SQLFILE="Duong dan file SQL: "
if not exist "%SQLFILE%" (
    echo [LOI] Khong tim thay file: %SQLFILE%
    pause
    exit /b 1
)

echo.
echo ====================================================================
echo   CANH BAO - DAY LA PHUC HOI, KHONG PHAI NAP THEM:
echo   * Toan bo du lieu hien tai trong cac bang thuoc public / auth / storage
echo     se bi XOA, sau do ghi lai dung noi dung file backup.
echo   * Moi du lieu tao SAU thoi diem sao luu se MAT.
echo   * Bang noi bo auth.schema_migrations va storage.migrations KHONG bi xoa
echo     (xoa vao la GoTrue / Storage cua Supabase se hong).
echo   * Ung dung web se tam thoi khong truy van duoc trong luc nap.
echo   * Neu co bat ky loi nao, toan bo duoc ROLLBACK - CSDL gi nguyen nhu cu.
echo ====================================================================
set CONFIRM=
set /p CONFIRM="Gõ đúng chữ NAP de tiep tuc: "
if /I not "!CONFIRM!"=="NAP" (
    echo.
    echo [HUY] Da huy. CSDL chua bi thay doi bat ky dong nao.
    pause
    exit /b 0
)

echo.
echo [2/5] Tu dong sao luu du lieu hien tai de phong hoan tac...
set "SAFETY=%BACKUP_DIR%\pre_restore_%TS%.sql"
cmd /c npx.cmd supabase db dump --local --data-only -f "%SAFETY%" >nul 2>&1
if not exist "%SAFETY%" (
    echo [LOI] KHONG sao luu duoc du lieu hien tai. DUNG LAI, khong ghi gi ca.
    echo        CSDL van nguyen ven. Kiem tra Supabase Local dang chay roi thu lai.
    pause
    exit /b 1
)
echo        Da giu lai trang thai hien tai tai: !SAFETY!

echo.
echo [3/5] Lay danh sach cac bang se lam trang...
set "TRUNC_SQL=%TEMP%\wms_truncate_%TS%.sql"
set "PRE_SQL=%TEMP%\wms_preamble_%TS%.sql"
docker exec supabase_db_anywarehouse psql -U postgres -d postgres -t -A -c "select 'TRUNCATE TABLE ' || string_agg(quote_ident(n.nspname)||'.'||quote_ident(c.relname), ', ' order by n.nspname, c.relname) || ';' from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public','auth','storage') and c.relkind in ('r','p') and not (n.nspname='auth' and c.relname='schema_migrations') and not (n.nspname='storage' and c.relname='migrations');" > "%TRUNC_SQL%" 2>nul
findstr /m /c:"TRUNCATE TABLE" "%TRUNC_SQL%" >nul
if errorlevel 1 (
    echo [LOI] Khong lay duoc danh sach bang tu CSDL. DUNG LAI, khong ghi gi ca.
    call :CLEANUP
    pause
    exit /b 1
)

> "%PRE_SQL%" echo SET session_replication_role = replica;
type "%TRUNC_SQL%" >> "%PRE_SQL%"
echo.>> "%PRE_SQL%"

echo [4/5] Dang phuc hoi (TRUNCATE + ghi lai trong mot giao dich)...
set "ERR_LOG=%TEMP%\wms_restore_err_%TS%.txt"
type "%PRE_SQL%" "%SQLFILE%" | docker exec -i supabase_db_anywarehouse psql -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction -q 2> "%ERR_LOG%"
set RC=%ERRORLEVEL%

echo [5/5] Ket luan...
set FAILED=0
if not "%RC%"=="0" set FAILED=1
findstr /m /c:"ERROR:" "%ERR_LOG%" >nul && set FAILED=1
echo.
if "!FAILED!"=="1" (
    echo ====================================================================
    echo   [THAT BAI] Toan bo giao dich da duoc ROLLBACK.
    echo   CSDL cua ban VAN GIUNG nguyen trang thai nhu truoc khi nap.
    echo ====================================================================
    echo Cac loi ghi nhan duoc:
    findstr /c:"ERROR:" /c:"FATAL" "%ERR_LOG%"
    echo.
    echo Neu loi la "relation ... does not exist" thi file backup nay thuoc
    echo mot phien ban cau truc khac - can chay migration dung phien ban truoc
    echo roi moi phuc hoi, khong the nap bang nut nay.
    echo.
    echo Ban sao luu du phong vua tao: !SAFETY!
) else (
    echo ====================================================================
    echo   [HOAN TAT] Da phuc hoi du lieu tu:
    echo   %SQLFILE%
    echo ====================================================================
    echo Neu day KHONG phai du lieu ban mong muon, trang thai truoc khi nap
    echo nam trong file: !SAFETY!
)

call :CLEANUP
echo.
echo Mo thu muc backups? (Y/N)
set /p OPENB="> "
if /I "!OPENB!"=="Y" start "" "%BACKUP_DIR%"
pause
exit /b 0

:CLEANUP
del "%TRUNC_SQL%" >nul 2>&1
del "%PRE_SQL%" >nul 2>&1
del "%ERR_LOG%" >nul 2>&1
exit /b 0
