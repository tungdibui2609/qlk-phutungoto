-- Tự động đăng ký Mã Phụ (master_tags) từ mọi dòng lot_tags được ghi vào
-- Người dùng gõ mã phụ mới khi tạo/sửa LOT thì mã phải tự xuất hiện ở trang Quản lý Mã Phụ,
-- không bắt buộc tạo trước trong quản lý.

create unique index if not exists master_tags_name_system_code_key
    on public.master_tags (name, system_code);

create or replace function public.fn_register_master_tag_from_lot_tag()
returns trigger
language plpgsql
as $$
declare
    v_system_code  public.lots.system_code%type;
    v_company_id   public.lots.company_id%type;
    v_tag          text := upper(btrim(coalesce(NEW.tag, '')));
begin
    if v_tag = '' then
        return NEW;
    end if;

    select l.system_code, l.company_id
      into v_system_code, v_company_id
      from public.lots l
     where l.id = NEW.lot_id;

    if v_system_code is null then
        return NEW;
    end if;

    insert into public.master_tags (name, system_code, company_id, created_by, created_at)
    values (v_tag, v_system_code, v_company_id, NEW.added_by, coalesce(NEW.added_at, now()))
    on conflict (name, system_code) do nothing;

    return NEW;
end;
$$;

drop trigger if exists trg_register_master_tag_from_lot_tag on public.lot_tags;

create trigger trg_register_master_tag_from_lot_tag
    after insert on public.lot_tags
    for each row
    execute function public.fn_register_master_tag_from_lot_tag();

-- Nạp lại lịch sử: những mã phụ đang gắn trên LOT nhưng chưa có trong danh sách quản lý
insert into public.master_tags (name, system_code, company_id, created_at)
select distinct upper(btrim(t.tag)), l.system_code, l.company_id, min(coalesce(t.added_at, now()))
  from public.lot_tags t
  join public.lots l on l.id = t.lot_id
 where btrim(coalesce(t.tag, '')) <> ''
 group by upper(btrim(t.tag)), l.system_code, l.company_id
on conflict (name, system_code) do nothing;
