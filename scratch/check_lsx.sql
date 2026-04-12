SELECT 
    l.production_id,
    p.name as product_name,
    p.sku,
    li.unit,
    li.quantity,
    li.initial_quantity,
    l.lot_code,
    l.id as lot_id
FROM public.lot_items li
JOIN public.lots l ON l.id = li.lot_id
JOIN public.products p ON p.id = li.product_id
JOIN public.productions pr ON pr.id = l.production_id
WHERE pr.code LIKE '%20260326-4986-L2%'
ORDER BY p.name, l.lot_code;
