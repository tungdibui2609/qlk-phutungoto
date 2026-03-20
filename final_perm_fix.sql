-- Cập nhật quyền trực tiếp vào user_profiles để bypass check ở SelectSystemPage
UPDATE public.user_profiles 
SET 
    allowed_systems = '{"ALL"}',
    permissions = '{"system.full_access"}',
    department = 'Hệ thống'
WHERE id IN ('6306ecf2-22ad-4d25-8986-91831c14fe27', '1d502b01-df8b-4f27-9965-fa550a5b4096');

-- Đảm bảo các system có code khớp với ICON_MAP (KHO_DONG_LANH, KHO_VAT_TU_BAO_BI, etc.)
-- Hiện tại đã khớp trong perms_result.txt
