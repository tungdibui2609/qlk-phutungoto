-- Migration to add system_code to audit_logs table
alter table "public"."audit_logs" add column "system_code" text;
alter table "public"."audit_logs" add constraint "audit_logs_system_code_fkey" FOREIGN KEY (system_code) REFERENCES systems(code);
comment on column "public"."audit_logs"."system_code" is 'Mã hệ thống kho (FROZEN, CHEMICAL, etc.)';
create index idx_audit_logs_system_code on public.audit_logs(system_code);
