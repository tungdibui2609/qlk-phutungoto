-- Migration to add system_code to operational_notes table
alter table "public"."operational_notes" add column "system_code" text;
alter table "public"."operational_notes" add constraint "operational_notes_system_code_fkey" FOREIGN KEY (system_code) REFERENCES systems(code);
comment on column "public"."operational_notes"."system_code" is 'Mã hệ thống kho (FROZEN, CHEMICAL, etc.)';
