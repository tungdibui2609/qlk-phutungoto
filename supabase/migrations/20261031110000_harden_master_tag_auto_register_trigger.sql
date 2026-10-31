-- Gia cố trigger tự đăng ký master_tags:
-- 1) SECURITY DEFINER để vẫn đọc được lots / ghi được master_tags dù vai trò gọi bị RLS giới hạn.
-- 2) Bọc EXCEPTION để mọi lỗi đăng ký mã phụ KHÔNG bao giờ làm fail thao tác gắn mã phụ của người dùng
--    (đặc biệt luồng tạo/sửa LOT của Kho Đông Lạnh).

create or replace function public.fn_register_master_tag_from_lot_tag()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
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
exception when others then
    raise warning 'Bo qua dang ky master_tags cho tag "%": %', v_tag, SQLERRM;
    return NEW;
end;
$$;
