-- Create a function to approve an inventory check without touching lots (Accounting focus)
CREATE OR REPLACE FUNCTION approve_inventory_check(
  p_check_id UUID,
  p_reviewer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Verify the check exists and is in the correct status
  IF NOT EXISTS (
    SELECT 1 FROM inventory_checks 
    WHERE id = p_check_id AND status = 'WAITING_FOR_APPROVAL'
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Phiếu không tồn tại hoặc không ở trạng thái chờ duyệt');
  END IF;

  -- 2. Update status of the check (Balance is handled via PNK/PXK, not here)
  UPDATE inventory_checks
  SET 
    status = 'COMPLETED',
    approval_status = 'APPROVED',
    reviewer_id = p_reviewer_id,
    reviewed_at = NOW(),
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_check_id;

  RETURN jsonb_build_object('success', true, 'message', 'Duyệt phiếu kiểm kê thành công. Vui lòng tạo phiếu Nhập/Xuất để cân bằng sổ sách nếu có chênh lệch.');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
