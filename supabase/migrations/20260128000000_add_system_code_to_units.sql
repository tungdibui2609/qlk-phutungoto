alter table "public"."units" add column "system_code" text;

alter table "public"."units" add constraint "units_system_code_fkey" FOREIGN KEY (system_code) REFERENCES systems(code);

comment on column "public"."units"."system_code" is 'Mã hệ thống kho (FROZEN, CHEMICAL, etc.)';
