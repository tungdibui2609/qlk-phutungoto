-- Chạy đoạn mã này trong SQL Editor của Supabase MỘT LẦN DUY NHẤT.
-- Đoạn mã này sẽ tạo ra một Trigger tự động: Mỗi khi bạn đổi tên Chi nhánh/Kho ở phần Cài đặt, 
-- hệ thống sẽ tự động đi tìm tất cả các LOT, Phiếu nhập, Phiếu xuất cũ và cập nhật lại tên cho đồng bộ.

BEGIN;

-- 1. Tạo hàm (Function) xử lý việc cập nhật
CREATE OR REPLACE FUNCTION public.handle_branch_rename()
RETURNS trigger AS $$
BEGIN
    -- Chỉ chạy khi tên chi nhánh thực sự bị thay đổi
    IF NEW.name <> OLD.name THEN
        
        -- Cập nhật bảng lots
        UPDATE public.lots 
        SET warehouse_name = NEW.name 
        WHERE warehouse_name = OLD.name;
        
        -- Cập nhật bảng inbound_orders
        UPDATE public.inbound_orders 
        SET warehouse_name = NEW.name 
        WHERE warehouse_name = OLD.name;
        
        -- Cập nhật bảng outbound_orders
        UPDATE public.outbound_orders 
        SET warehouse_name = NEW.name 
        WHERE warehouse_name = OLD.name;
        
        -- Cập nhật bảng inventory_checks
        UPDATE public.inventory_checks 
        SET warehouse_name = NEW.name 
        WHERE warehouse_name = OLD.name;

        -- Cập nhật bảng locations
        UPDATE public.locations 
        SET name = NEW.name 
        WHERE name = OLD.name;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Đảm bảo hàm thuộc quyền sở hữu đúng
ALTER FUNCTION public.handle_branch_rename() OWNER TO "postgres";

-- 3. Xóa Trigger cũ nếu đã từng tạo (tránh bị lỗi trùng lặp)
DROP TRIGGER IF EXISTS on_branch_name_change ON public.branches;

-- 4. Gắn Trigger vào bảng branches
CREATE TRIGGER on_branch_name_change
AFTER UPDATE OF name ON public.branches
FOR EACH ROW
EXECUTE FUNCTION public.handle_branch_rename();

COMMIT;
