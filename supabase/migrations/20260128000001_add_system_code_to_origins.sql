-- Migration to add system_code to origins table
alter table "public"."origins" add column "system_code" text;
alter table "public"."origins" add constraint "origins_system_code_fkey" FOREIGN KEY (system_code) REFERENCES systems(code);
comment on column "public"."origins"."system_code" is 'Mã hệ thống kho (FROZEN, CHEMICAL, etc.)';
