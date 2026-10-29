@echo off
title Modular WMS - Nen de chuyen may (kem ca du lieu CSDL)
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ====================================================================
echo   MODULAR WMS - NEN DE CHUYEN MAY  (ma nguon + node_modules + ANH CSDL)
echo ====================================================================
echo.
echo   Khac voi NEN_TOAN_BO_DU_AN.bat: file nay KHONG loai tru thu muc
echo   backups, nen anh chup CSDL nam BEN TRONG goi nen. May giai ra se
echo   co du du lieu, chi can nap lai bang nut "NAP / PHUC HOI CSDL".
echo.

set "BACKUP_DIR=%~dp0backups"
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

echo [1/5] Kiem tra container PostgreSQL Supabase Local...
docker ps --format "{{.Names}}" | findstr /i "supabase_db_anywarehouse" >nul
if errorlevel 1 (
    echo [CANH BAO] Supabase Local chua chay! Hay mo CHAY_SERVER.bat hoac chay 'npx supabase start' truoc.
    pause
    exit /b 1
)

set "WINRAR_EXE=C:\Program Files\WinRAR\Rar.exe"
if not exist "!WINRAR_EXE!" set "WINRAR_EXE=C:\Program Files\WinRAR\WinRAR.exe"
if not exist "!WINRAR_EXE!" set "WINRAR_EXE=C:\Program Files (x86)\WinRAR\Rar.exe"
if not exist "!WINRAR_EXE!" (
    echo [LOI] Khong tim thay WinRAR tren may nay. Hay dung nut "NEN DE CHUYEN MAY"
    echo       trong launcher - truong hop thieu WinRAR no se tu nen sang ZIP.
    pause
    exit /b 1
)

for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"`) do set "TS=%%I"
if defined TS set "TS=!TS:~0,15!"
if not defined TS set "TS=manual"
set "DUMP=%BACKUP_DIR%\migration_dump_%TS%.sql"
set "ARCHIVE=%BACKUP_DIR%\ModularWMS_ChuyenMay_%TS%.rar"
echo       ^> Anh CSDL      : migration_dump_%TS%.sql
echo       ^> Goi chuyen may: ModularWMS_ChuyenMay_%TS%.rar
echo.

echo [2/5] Xuat anh chup CSDL (data-only)...
set "DO_NOT_TRACK=1"
set "SUPABASE_TELEMETRY=false"
cmd /c npx.cmd supabase db dump --local --data-only -f "%DUMP%"
if not exist "%DUMP%" (
    echo [LOI] Khong xuat duoc anh CSDL - DUNG LAI, chua tao goi nen.
    pause
    exit /b 1
)
echo       ^> OK, da co anh CSDL.
echo.

set "PGIMAGE="
for /f "usebackq delims=" %%I in (`docker inspect supabase_db_anywarehouse --format "{{.Config.Image}}"`) do set "PGIMAGE=%%I"

echo [3/5] Viet CHECKLIST_CHUYEN_MAY.txt...
python tao_checklist_chuyen_may.py "%ARCHIVE%" "%DUMP%" "%PGIMAGE%"
if errorlevel 1 echo [CANH BAO] Khong viet duoc checklist, van tiep tuc nen.
echo.

echo [4/5] Nen RAR5 (giu backups\*.sql, bo .rar/.zip/.next/dist_installer)...
echo       CO THE KEU 10-20 PHUT vi node_modules ~1.2 GB, xin doi may.
"!WINRAR_EXE!" a -r -s -m3 -ep1 -x"backups\*.rar" -x"backups\*.zip" -x"backups\.tmp.driveupload*" -x"dist_installer\*" -x".next\*" "!ARCHIVE!" *
if not exist "!ARCHIVE!" (
    echo [LOI] WinRAR khong tao duoc goi nen!
    pause
    exit /b 1
)
echo.

echo [5/5] Cap nhat checklist bang dung luong that (file nam NGOAI goi nen)...
python tao_checklist_chuyen_may.py "!ARCHIVE!" "!DUMP!" "!PGIMAGE%"

echo.
echo ====================================================================
echo   [HOAN TAT] Goi chuyen may da san sang:
echo   !ARCHIVE!
echo.
echo   HAI CAI BAY PHAI XU LY O MAY MOI (checklist nhac lai ky):
echo     1) Key Supabase Local sinh ngau nhien theo may - chay 'npx supabase status'
echo        o may moi roi dan anon_key + service_role moi vao .env.local.
echo     2) .next khong duoc nen - bam 'Build Production' trong launcher may moi.
echo.
echo   CANH BAO: file nen chua .env.local (mat khau Gmail, Google Drive token,
echo   service_role). Giu rieng tu, tuyet doi khong commit len git.
echo ====================================================================
start "" "%BACKUP_DIR%"
pause
endlocal
