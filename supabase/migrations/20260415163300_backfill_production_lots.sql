-- SQL Backfill: Khôi phục liên kết cho các Pallet cũ
-- Tự động tìm và gán production_lot_id dựa trên Lệnh sản xuất và Sản phẩm

UPDATE public.lots l
SET production_lot_id = sub.pl_id
FROM (
    SELECT DISTINCT ON (l.id)
        l.id as lot_id,
        pl.id as pl_id
    FROM public.lots l
    JOIN public.lot_items li ON li.lot_id = l.id
    JOIN public.production_lots pl ON pl.production_id = l.production_id AND pl.product_id = li.product_id
    WHERE l.production_lot_id IS NULL 
      AND l.production_id IS NOT NULL
    ORDER BY l.id, pl.created_at ASC
) sub
WHERE l.id = sub.lot_id;

-- Thông báo kết quả (Comment)
-- Lệnh trên sẽ giúp hiển thị lại sản lượng thực tế cho các Lệnh sản xuất đã có pallet từ trước.
