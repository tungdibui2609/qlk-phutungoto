-- Quản lý Mã Phụ là quản lý TỪNG thẻ tag đơn lẻ (nguyên liệu), không phải chuỗi ghép.
-- Tag dạng khuôn mẫu "TRUNG HÙNG>@>XẤU" phải đăng ký 2 master tag: "TRUNG HÙNG" và "XẤU".
-- Segment "@" là placeholder mã SKU nên KHÔNG phải một tag -> bỏ qua.

create or replace function public.fn_register_master_tag_from_lot_tag()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_system_code  public.lots.system_code%type;
    v_company_id   public.lots.company_id%type;
    v_segment      text;
begin
    if coalesce(NEW.tag, '') = '' then
        return NEW;
    end if;

    select l.system_code, l.company_id
      into v_system_code, v_company_id
      from public.lots l
     where l.id = NEW.lot_id;

    if v_system_code is null then
        return NEW;
    end if;

    FOR v_segment IN
        SELECT btrim(replace(seg, '@', ''))
          FROM unnest(regexp_split_to_array(upper(NEW.tag), '>')) AS s(seg)
    LOOP
        IF v_segment <> '' THEN
            insert into public.master_tags (name, system_code, company_id, created_by, created_at)
            values (v_segment, v_system_code, v_company_id, NEW.added_by, coalesce(NEW.added_at, now()))
            on conflict (name, system_code) do nothing;
        END IF;
    END LOOP;

    return NEW;
exception when others then
    raise warning 'Bo qua dang ky master_tags cho tag "%": %', NEW.tag, SQLERRM;
    return NEW;
end;
$$;

-- Dọn các bản ghi master_tags đang lưu cả chuỗi khuôn mẫu thay vì từng tag đơn lẻ
delete from public.master_tags
 where position('>' in name) > 0 or position('@' in name) > 0;

-- Nạp lại nguyên liệu từ mọi chuỗi mã phụ đang gắn trên LOT
insert into public.master_tags (name, system_code, company_id, created_at)
select distinct seg, sc, cid, min(added_at)
from (
    select btrim(replace(seg_raw, '@', ''))      as seg,
           l.system_code                         as sc,
           l.company_id                          as cid,
           coalesce(t.added_at, now())           as added_at
      from public.lot_tags t
      join public.lots l on l.id = t.lot_id
      cross join lateral unnest(regexp_split_to_array(upper(t.tag), '>')) as s(seg_raw)
) x
where seg <> ''
group by seg, sc, cid
on conflict (name, system_code) do nothing;
