# Walkthrough: Danh Mục Cấp Dòng Cho LOT (`lot_items.category_id`)

Tài liệu này mô tả cách tính năng "chọn danh mục cho từng dòng sản phẩm khi tạo/sửa Lot" tuân thủ kiến trúc phân hệ (`system_type`) và đảm bảo **không làm thay đổi hành vi của phân hệ Kho Đông Lạnh**.

## 🎯 Bối Cảnh Nghiệp Vụ

Hệ thống đang quản lý tồn kho song song hai nguồn:

1. **Sổ sách kế toán** (`/inbound`, `/outbound`): mỗi dòng phiếu (`inbound_order_items` / `outbound_order_items`) đã có `category_id` riêng, nên cùng một mã hàng có thể vào hai danh mục khác nhau (ví dụ `HH1010102.02.002` khai báo là "Hàng hóa Bến Tre" nhưng phiếu nhập ghi nhận là "Hàng hóa Ký Gửi"). Tab **Kế toán** ở `/inventory` đã tổng hợp theo đúng danh mục của dòng phiếu.
2. **Quản lý Lot** (`/warehouses/lots`): dòng lot chỉ có `product_id`, nên số lượng **bắt buộc** bị cộng vào danh mục khai báo trên sản phẩm → lệch với sổ kế toán.

**Giải pháp:** thêm `category_id` vào `lot_items`, cho phép người dùng chọn danh mục ngay trên từng dòng Lot.

---

## 🏗️ 1. Cấu Trúc Dữ Liệu

**Migration:** [20261026120000_add_category_id_to_lot_items.sql](file:///d:/chanh%20thu/web/supabase/migrations/20261026120000_add_category_id_to_lot_items.sql)

```sql
ALTER TABLE public.lot_items ADD COLUMN IF NOT EXISTS category_id UUID
  REFERENCES public.categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_lot_items_category_id ON public.lot_items USING btree (category_id);
```

**TUYỆT ĐỐI KHÔNG backfill.** `NULL` mang ngữ nghĩa *"kế thừa danh mục khai báo trên sản phẩm"* — tức là giữ nguyên 100% kết quả hiển thị của dữ liệu đang có. Đây là cơ chế bảo toàn cho Kho Đông Lạnh: dữ liệu cũ không bị đổi nghĩa, chỉ cần chưa có dòng nào được gán danh mục thì hệ thống hành xử y như trước.

Quy tắc phân giải (áp dụng thống nhất mọi nơi):

```
danh mục của dòng = lot_items.category_id ?? products.category_id
```

Khi `lot_items.category_id` đã được gán, nó **thắng tuyệt đối**: danh mục phụ trong `product_category_rel` bị bỏ qua, mỗi dòng chỉ thuộc **một** danh mục → tổng cộng của tab "Tồn theo danh mục" khớp với tab Kế toán, hết cảnh trùng lặp/gộp đôi.

---

## 🎨 2. Giao Diện Tạo/Sửa Lot

**File:** [LotForm.tsx](file:///d:/chanh%20thu/web/src/app/(dashboard)/warehouses/lots/_components/LotForm.tsx)

- Tải danh mục theo phân hệ hiện hành, có lọc `system_type`:
  ```tsx
  supabase.from('categories').select('id, name')
    .eq('system_type', currentSystem.code)
    .order('name')
  ```
- Mỗi dòng sản phẩm có thêm `<select>` danh mục, **mặc định tự điền** `products.category_id` khi chọn sản phẩm; người dùng bấm chọn danh mục khác nếu muốn.
- Ô chọn chỉ hiện khi phân hệ **có khai báo danh mục** (`categories.length > 0`) — cùng hành vi với dòng phiếu nhập/xuất hiện tại, không cần cờ module.
- Ghi `category_id` vào `itemsToInsert`, `itemsToUpdate`, và vào buffer đồng bộ kế toán (`metadata.system_history`).
- Bộ so sánh chênh lệch khi sửa Lot (Scenario B) nay dùng khóa `product_id | unit | category_id`, nên đổi danh mục một dòng sẽ sinh đúng bản ghi điều chỉnh tăng/giảm thay vì bị gộp nhầm.

---

## 📊 3. Tab "Tồn Theo Lot / Danh Mục" Tại `/inventory`

**File:** [useInventoryByLot.ts](file:///d:/chanh%20thu/web/src/components/inventory/by-lot/useInventoryByLot.ts)

- Query `lot_items` bổ sung cột `category_id`.
- `getCatNames()` / `getCatIds()` / `getSearchable()` nhận thêm tham số `lineCategoryId`; nếu có thì trả về **duy nhất** danh mục của dòng, không cộng dồn `product_category_rel`.
- Khóa nhóm tổng hợp nay gắn cả danh mục: `${sku}__${unit}__${categoryId}` (kể cả nhánh `UNCONVERTIBLE`), nhờ đó hai dòng cùng mã hàng nhưng khác danh mục tách thành hai dòng tồn riêng — đúng như tab Kế toán.
- Bộ lọc theo danh mục và tìm kiếm theo danh mục cũng đọc `item.category_id`.

**File:** [InventoryByCategory.tsx](file:///d:/chanh%20thu/web/src/components/inventory/InventoryByCategory.tsx) — sửa bug `useMemo` thiếu dependency `selectedCategoryIds` khiến danh mục đã chọn không cập nhật lại kết quả.

**File:** [src/app/print/inventory/page.tsx](file:///d:/chanh%20thu/web/src/app/print/inventory/page.tsx) — trang in/Xuất Excel (`/print/inventory?type=lot`) có luồng tổng hợp **lặp lại** riêng (không dùng `useInventoryByLot`), trước đây chỉ query `lot_items(... products(...))` rồi suy danh mục từ sản phẩm. Nay:
- Select thêm `category_id` trong `lot_items(...)`.
- `primaryCatId = item.category_id || item.products?.category_id || ...` — danh mục cấp dòng thắng tuyệt đối.
- Vì bảng "DANH MỤC: ..." dựng từ `item.categoryIds`, cả báo cáo trên màn hình lẫn file Excel (`inventoryReportExcelExport.ts`, sheet Chi tiết/Tổng hợp) đều tự đúng theo, không cần sửa file export.

---

## 🔄 4. Kế Thừa Danh Mục Qua Mọi Luồng Thao Tác Lot

Nếu bỏ sót, chỉ một lần tách/ghộp lot cũng làm dòng "Hàng hóa Ký Gửi" âm thầm nhảy về "Hàng hóa Bến Tre". Đã bịt toàn bộ các điểm ghi `lot_items`:

| Luồng | File | Cách xử lý |
|---|---|---|
| Tách lot | [LotSplitModal.tsx](file:///d:/chanh%20thu/web/src/components/warehouse/lots/LotSplitModal.tsx) | `category_id: item.category_id ?? null` |
| Tách tự động (số lẻ) | [lotService.ts](file:///d:/chanh%20thu/web/src/services/warehouse/lotService.ts) | `category_id: item.category_id ?? null` |
| Gộp lot | [LotMergeModal.tsx](file:///d:/chanh%20thu/web/src/components/warehouse/lots/LotMergeModal.tsx) | `sourceItem.category_id ?? products?.category_id ?? null` |
| Tách/bó gói | [unbundleService.ts](file:///d:/chanh%20thu/web/src/services/inventory/unbundleService.ts) | Giữ nguyên `category_id` bản ghi gốc |
| Đổi mã hàng loạt | [LotBulkChangeProductModal.tsx](file:///d:/chanh%20thu/web/src/components/warehouse/lots/LotBulkChangeProductModal.tsx) | Set `category_id: null` — danh mục cũ thuộc sản phẩm cũ, phải quay về kế thừa |
| Tạo lại lot | [RecreateLotModal.tsx](file:///d:/chanh%20thu/web/src/components/lots/RecreateLotModal.tsx) | Truyền `categoryId` sang insert |
| Nhân bản lot hàng loạt | [LotBulkCloneModal.tsx](file:///d:/chanh%20thu/web/src/components/warehouse/lots/LotBulkCloneModal.tsx) | Đã dùng spread `lot_items(*)` nên tự kế thừa — không cần sửa |
| Đồng bộ PNK | [LotInboundBuffer.tsx](file:///d:/chanh%20thu/web/src/components/warehouse/lots/LotInboundBuffer.tsx) | Khóa gộp `product_id\|unit\|category_id`, ghi `category_id` vào `inbound_order_items` |
| Đồng bộ PXK | [LotExportBuffer.tsx](file:///d:/chanh%20thu/web/src/components/warehouse/lots/LotExportBuffer.tsx) | Tương tự chiều xuất |
| Lịch sử xuất lot | [LotExportModal.tsx](file:///d:/chanh%20thu/web/src/components/warehouse/lots/LotExportModal.tsx) | Lưu `category_id` vào `system_history.exports` |
| Tìm kiếm theo danh mục | [useLotManagement.ts](file:///d:/chanh%20thu/web/src/app/(dashboard)/warehouses/lots/_hooks/useLotManagement.ts) | Ngoài danh mục sản phẩm, truy vấn thêm `lot_items.category_id IN (...)` |

**Có chủ đích không sửa:** `SiteDirectInboundModal.tsx` và `PalletsPageContent.tsx` — hai luồng này không có ngữ cảnh danh mục ngay tại chỗ nhập, nên để `NULL` (kế thừa từ sản phẩm), đúng như bên phiếu lệnh.

Kết quả: vòng lặp **Lot ⇄ Kế toán** khép kín. Danh mục chọn trên dòng Lot chảy vào draft buffer, sang PNK/PXK, và ngược lại — hai hệ thống song song luôn cùng một con số.

---

## 🔒 5. Tuân Thủ Chỉ Thị AGENTS.md

**Cô lập phân hệ (`system_type`)**
- Danh mục nạp về luôn lọc `.eq('system_type', currentSystem.code)` → danh mục của Kho Đông Lạnh không thể xuất hiện trong dropdown của kho khác.
- Nhánh tìm kiếm theo danh mục cấp dòng cũng giữ nguyên chuỗi ràng buộc cô lập:
  ```ts
  .eq('lots.system_code', currentSystem.code)
  .neq('lots.status', 'hidden')
  .neq('lots.status', 'exported')
  ```

**Không hardcode mã kho**
- Không có bất kỳ điều kiện `systemType === '...'` nào. Điều kiện hiển thị duy nhất là *phân hệ có đang khai báo danh mục hay không*, giống hệt cơ chế của dòng phiếu nhập/xuất. Kho nào không dùng danh mục → UI và logic giữ nguyên trạng thái cơ bản.

**Bảo toàn Kho Đông Lạnh**
- Cột mới cho phép `NULL`, không backfill, không ràng buộc NOT NULL, không đổi khóa chính.
- Mọi công thức phân giải đều là `danh_mục_dòng ?? danh_mục_sản_phẩm` → với dữ liệu chưa gán, kết quả trả về **giống từng con số** so với trước khi sửa.
- Không đụng đến schema, form hay luồng xuất/nhập của Kho Đông Lạnh.

---

## 🧪 6. Cách Kiểm Thử

1. **Migration đã được áp** bằng `npx supabase db push --local` vào stack local `anywarehouse` (cùng database với `https://api.chanhthu.click`). Xác nhận: cột `lot_items.category_id` (`uuid`, nullable) + index `idx_lot_items_category_id` đã tồn tại, 2.165 dòng hiện có đều `NULL` → dữ liệu cũ kế thừa danh mục khai báo trên sản phẩm, hành vi hiển thị không đổi.
   [supabase/migrations/20261026120000_add_category_id_to_lot_items.sql](file:///d:/chanh%20thu/web/supabase/migrations/20261026120000_add_category_id_to_lot_items.sql)
2. Vào `/warehouses/lots` (đảm bảo đang ở kho có bật danh mục) → Tạo Lot: mỗi dòng sản phẩm có ô danh mục, mặc định = danh mục khai báo của sản phẩm.
3. Đổi danh mục một dòng (ví dụ sang "Hàng hóa Ký Gửi") → Lưu → mở lại Lot kiểm tra giá trị được giữ.
4. Vào `/inventory` → tab **Tồn theo lot / Tồn theo danh mục**: dòng hàng đó xuất hiện ở danh mục đã chọn, không còn bị cộng vào danh mục khai báo; tổng hai tab Kế toán và Danh mục khớp nhau.
5. Kiểm tra hồi quy: tách Lot, gộp Lot, đổi mã hàng loạt, đồng bộ PNK/PXK — danh mục dòng vẫn đúng.
6. **Kiểm tra Kho Đông Lạnh**: tạo Lot mới tại Kho Đông Lạnh, xác nhận không phát sinh lỗi và số liệu tồn hiển thị như cũ.

**Tình hình type-check:** `npx tsc --noEmit` không còn lỗi mới trong toàn bộ 14 file đã sửa (repo có sẵn nhiều lỗi type cũ do `Database` type chưa đầy đủ; 2 lỗi còn lại ở `RecreateLotModal.tsx:98-99` nằm trên code cũ, đã xác minh là có từ trước).

---

## ✅ Vòng 2 — Đã xử lý tiếp (26/10/2026)

**1. Sửa `/api/inventory` tự mâu thuẫn** — [src/app/api/inventory/route.ts:376](file:///D:/chanh%20thu/web/src/app/api/inventory/route.ts#L376)
Trước đây `searchMode=category` tính lại danh mục từ `products.category_id`, trong khi dòng 247 và bộ lọc `categoryIds` (dòng 405-410) lại dùng `item.category_id` của dòng phiếu → cùng một trang, lọc ra mà tìm không ra. Nay ô tìm kiếm dùng `i.categoryName` (đã tính theo đúng thứ tự ưu tiên), chỉ fallback về sản phẩm khi dòng phiếu trống.

**2. Thêm cột "Danh mục" vào tab Tồn theo lot** — [by-lot/InventoryTable.tsx](file:///D:/chanh%20thu/web/src/components/inventory/by-lot/InventoryTable.tsx), [MobileLotList.tsx](file:///D:/chanh%20thu/web/src/components/inventory/MobileLotList.tsx), [InventoryByLot.tsx](file:///D:/chanh%20thu/web/src/components/inventory/InventoryByLot.tsx)
- Cột mới suy từ `group.categoryIds` (đã có sẵn trong `useInventoryByLot`, đã nằm trong khóa nhóm `${sku}__${unit}__${categoryId}`), hiển thị dạng chip; dòng chưa gán hiện "—".
- `InventoryTable` nhận prop `categoryMap` **có giá trị mặc định `{}`** → khi phân hệ chưa có danh mục thì cột ẩn hoàn toàn (đã kiểm chứng bằng smoke render: 5 cột, không còn "Danh mục"). Không có site nào khác render component này nên không ảnh hưởng luồng cũ.
- 7 `colSpan` của dòng con (LSX / tháng / mã phụ) chuyển thành `showCategoryCol ? 3 : 2` để không lệch khung.

**Kiểm chứng:** `npx tsc --noEmit` sạch trên 5 file sửa; render thật trên dev server tạm (`:3002`, đã dừng và xóa file smoke) với 3 trường hợp: dòng có danh mục, dòng nhiều danh mục, dòng chưa gán.

---

## ✅ Vòng 3 — Hoàn tất 4 điểm lệch (26/10/2026)

**3. Một nguồn danh mục duy nhất: [src/lib/productCategory.ts](file:///D:/chanh%20thu/web/src/lib/productCategory.ts)**
`resolveCategories(product, lineCategoryId, nameMap)` trả `{ ids, names, primaryId, primaryName }` theo đúng thứ tự: **dòng LOT/phiếu > `products.category_id` > rel `is_primary` > rel đầu tiên**. Dòng LOT thắng tuyệt đối nên không bao giờ cộng dồn rel khi người dùng đã gán tay. `extractProductCategories()` giữ nguyên shape cũ để bản đồ kho không phải đổi UI.

Đã bỏ toàn bộ bản sao suy danh mục cục bộ và chuyển về helper:
- [useWarehouseData.ts](file:///D:/chanh%20thu/web/src/app/(dashboard)/warehouses/map/_hooks/useWarehouseData.ts) — xóa 44 dòng hàm cục bộ, 2 call-site `lot_items` truyền thêm `item.category_id`, 2 select thêm `category_id`.
- [print/warehouse-map/page.tsx](file:///D:/chanh%20thu/web/src/app/print/warehouse-map/page.tsx) — xóa bản sao thứ hai (44 dòng), dùng chung helper, select thêm `category_id`.
- [warehouses/status/page.tsx](file:///D:/chanh%20thu/web/src/app/(dashboard)/warehouses/status/page.tsx) — trước chỉ đọc `product_category_rel`; nay `resolveCategories(it.products, it.category_id).ids` (cả 2 nhánh select đều được bổ sung `category_id`).
- [api/inventory/by-label/route.ts](file:///D:/chanh%20thu/web/src/app/api/inventory/by-label/route.ts) — bộ lọc danh mục trước bỏ sót `products.category_id`, nay qua helper.
- [useInventoryByLot.ts](file:///D:/chanh%20thu/web/src/components/inventory/by-lot/useInventoryByLot.ts) — 2 hàm `getCatNames`/`getCatIds` nội bộ (25 dòng) giờ là 2 dòng gọi helper, loại bỏ luôn sự lệch âm thầm `getCatIds(lot.products)` ở cấp lot.

**4. Cảnh báo lệch danh mục khi nhập/xuất (mềm, không chặn)** — [CategoryStockHint.tsx](file:///D:/chanh%20thu/web/src/components/inventory/shared/CategoryStockHint.tsx)
- Gắn dưới ô chọn danh mục ở cả 4 chỗ (desktop + mobile của [InboundItemsTable](file:///D:/chanh%20thu/web/src/components/inventory/inbound/InboundItemsTable.tsx) và [OutboundItemsTable](file:///D:/chanh%20thu/web/src/components/inventory/outbound/OutboundItemsTable.tsx)).
- Truy vấn `lot_items` theo `product_id` **có lọc `lots.system_code`** (đúng quy tắc cô lập phân hệ), gộp theo (danh mục, ĐVT), cache 30 giây; chỉ hiện khi dòng phiếu đã chọn danh mục và tồn đang gắn danh mục **khác**.
- Không chặn lưu phiếu: người dùng có quyền xuất khác danh mục, chỉ cần được nhìn thấy.
- Phát hiện thêm một điểm rò dữ liệu trên đường đi: [QuickBulkExportModal.tsx:226](file:///D:/chanh%20thu/web/src/components/warehouse/map/QuickBulkExportModal.tsx#L226) dựng `exportItemsData` mà **không mang `category_id`** → danh mục dòng lot mất hút khi lập phiếu từ bản đồ kho. Đã bổ sung giống `LotExportModal.tsx:240`.

**Kiểm chứng vòng 3:** `tsc` sạch trên 12 file sửa + 2 file mới. Render thật trên dev server tạm `:3002` (đã dừng, đã xóa file smoke): 4/4 case của `resolveCategories` PASS; `CategoryStockHint` với dữ liệu thiệt in ra `⚠ Tồn đang gắn danh mục khác: HÀNG HÓA KÝ GỬI 517 Kg` (= 250,2 + 266,8 của hai lot đã gán), và im lặng ở cả hai case còn lại (chọn đúng danh mục / chưa chọn).

**Riêng ý "thêm cột danh mục vào bảng `lots`": KHÔNG làm** — danh mục thuộc cấp dòng, một lot có thể mang nhiều danh mục; thêm cột ở cấp lot sẽ buộc hệ thống "chọn bừa" một giá trị.

---

## ⏭ Việc còn mở

- `product_category_rel` vẫn chưa được **sổ kế toán** (`/api/inventory`) dùng làm nguồn nhóm — mỗi dòng phiếu chỉ mang một danh mục duy nhất, nên sản phẩm hai danh mục không chia được tồn theo từng danh mục ở tab kế toán. Cần quyết định nghiệp vụ trước khi làm.
- `export_task_items` không có `category_id` và không liên kết FK với `outbound_order_items`, nên luồng "lệnh xuất → duyệt xuất" (`work/export-order/[id]`) chưa thể đối chiếu danh mục dòng phiếu với dòng lot. Muốn cảnh báo ở đó phải thêm cột/metadata.
- `LotBulkChangeProductModal.tsx:193` vẫn set `category_id: null` khi đổi sản phẩm hàng loạt (chấp nhận được vì đổi sản phẩm thì danh mục cũ không còn đúng, nhưng nên cân nhắc hỏi người dùng).

---

# Walkthrough: Tab Thống Kê Xuất Kho (`/work/export-order?tab=stats`)

Tính năng chỉ **thêm một tab mới** vào trang danh sách lệnh xuất. Toàn bộ logic cũ (danh sách, duyệt yêu cầu lấy, xóa/hoàn thành, modal tạo lệnh, tra cứu lịch sử) giữ nguyên 100%.

## 🧩 Cấu Trúc

| File | Vai trò |
|---|---|
| [ExportOrderStatsPanel.tsx](file:///d:/chanh%20thu/web/src/components/export/ExportOrderStatsPanel.tsx) | Panel thống kê: lọc kỳ, thẻ tổng quan, biểu đồ, bảng nhóm, xuất Excel |
| [exportOrderReportExcelExport.ts](file:///d:/chanh%20thu/web/src/lib/exportOrderReportExcelExport.ts) | Sinh file Excel 5 sheet bằng ExcelJS + file-saver |
| [work/export-order/page.tsx](file:///d:/chanh%20thu/web/src/app/(dashboard)/work/export-order/page.tsx) | Thêm state `viewMode: 'LIST' \| 'STATS'` + deep link `?tab=stats` |

## 🗓 Ba Trục Thời Gian (không trộn lẫn)

1. **Theo ngày / theo sản phẩm** → `export_task_items` join `export_tasks!inner`, lọc `export_tasks.created_at` trong kỳ (nguồn "lệnh xuất cái gì, bao nhiêu": `quantity` yêu cầu vs `exported_quantity` đã xuất).
2. **Theo giờ hạ / nhân viên** → `export_task_picks.created_at` (thời điểm hạ hàng thực tế, có `picker_id`). Block này bọc trong `try/catch`: phân hệ nào chưa có bảng/luồng hạ hàng thì thống kê vẫn chạy, chỉ ẩn nhóm "Theo giờ hạ".
3. **Kỳ báo cáo** do người dùng chọn (mặc định 7 ngày, preset Hôm nay / 7 ngày / Tháng này / 90 ngày).

## 🔒 Bảo Toàn Kho Đông Lạnh & Rule Hệ Thống

- **Không đụng schema**: không migration, không cột mới, không đụng luồng xuất/nhập đang vận hành.
- **Không hardcode mã kho / `systemType`**: panel chỉ dùng `currentSystem.code` đang chọn.
- **Cô lập phân hệ (`system_code`)**: query items lọc `.eq('export_tasks.system_code', ...)`; query picks lọc `.eq('system_code', ...)` trên chính bảng `export_task_picks` **và** kiểm tra lại `task.system_code` ở bước render nếu PostgREST trả về task khác phân hệ. Không có đường nào đọc dữ liệu phân hệ khác.
- **Module bật/tắt**: tab đặt bên trong trang đã được gate bởi `work_export_order` ([utility-modules.ts:101](file:///d:/chanh%20thu/web/src/lib/utility-modules.ts#L101), dùng qua `requiredModule` ở [Sidebar.tsx:177](file:///d:/chanh%20thu/web/src/components/layout/Sidebar.tsx#L177)) → kho nào bật lệnh xuất thì có thống kê, kho tắt module thì không thấy cả trang. Kho Đông Lạnh (chưa bật module báo cáo mới) không nhận thêm flag nào, nên trạng thái cơ bản giữ nguyên.

## ✅ Kiểm Chứng Đã Chạy

- `npx tsc --noEmit`: 3 file mới/sửa không phát sinh lỗi (repo còn nhiều lỗi type tồn tại từ trước ở `operations/audit`, `categories`, `customers` — không liên quan).
- `npm run build`: exit code 0, route `/work/export-order` biên dịch sạch.
- `vitest src/lib/__tests__/exportOrderReportExcelExport.test.ts`: **PASS 3/3** — giải workbook thật bằng ExcelJS để đếm sheet và đối chiếu ô (`B5`, `E5`, `F5`), gồm cả case ẩn sheet "Lịch sử hạ hàng" khi không có dữ liệu pick.
- **Còn mở**: xác minh render thật + bấm "Xuất Excel" cần phiên đăng nhập localhost (chặn ở màn hình đăng nhập).

## 🐆 Lỗi Đã Gặp Khi Chạy Thật (ghi lại để lần sau không lặp)

**`column export_task_items.notes does not exist`** — bảng `export_task_items` **không có** cột ghi chú. Schema thật ([20260413000000_fix_production_stats_use_initial_qty.sql:15](file:///d:/chanh%20thu/web/supabase/migrations/20260413000000_fix_production_stats_use_initial_qty.sql#L15)): `id, task_id, lot_id, product_id, quantity, unit, metadata, created_at` + `exported_quantity`, `position_id`, `priority`, `status` (bổ sung ở các migration sau). Ghi chú nằm ở **cấp lệnh**: `export_tasks.notes` ([20260810040350_20260621000004_missing_columns.sql:78](file:///d:/chanh%20thu/web/supabase/migrations/20260810040350_20260621000004_missing_columns.sql#L78)); `metadata` của dòng chỉ chứa `picks[]`.

→ Đã đổi sang `export_tasks!inner(code, status, notes, created_at, system_code)` và rename field `itemNotes` → `taskNotes` cho đúng bản chất dữ liệu.

**Bài học**: Supabase client ở đây dùng bảng `export_task*` **không có trong `database.types.ts`**, nên PostgREST báo lỗi lúc chạy chứ `tsc` không bắt được → phải đối chiếu `CREATE TABLE`/`ALTER TABLE` trong `supabase/migrations/` trước khi chọn cột.
