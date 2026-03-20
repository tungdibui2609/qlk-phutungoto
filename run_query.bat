@echo off
set PGPASSWORD=Tung210359@
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U postgres -d qlk_phutungoto -f final_perm_fix.sql > final_fix_result.txt 2>&1
