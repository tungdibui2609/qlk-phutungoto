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

## 🧮 4 Chế Độ Nhóm Bảng Thống Kê

| Chế độ | Nguồn dữ liệu | Cột chính |
|---|---|---|
| **Theo ngày** | `export_tasks.created_at` | Số lệnh / Dòng hàng / Yêu cầu / Đã xuất / Hạ trong ngày / Hoàn thành (x/y) |
| **Theo sản phẩm** | gộp theo `sku + name` | Số dòng / Yêu cầu / Đã xuất / Còn lại |
| **Theo lệnh** | gộp theo `export_tasks.code` | Ngày tạo, Trạng thái, **Số mặt hàng (SKU distinct)**, Dòng hàng, **Dòng đã xong (x/y)**, Yêu cầu, Đã xuất, **Danh sách sản phẩm trong lệnh** |
| **Theo giờ hạ** | `export_task_picks.created_at` | Khung giờ, Số lượt, Số lượng, Nhân viên |

Quy tắc "Dòng đã xong": `exported_quantity >= quantity - 1e-6`, cùng ngưỡng `0.000001` mà [work/export-order/page.tsx:244](file:///d:/chanh%20thu/web/src/app/(dashboard)/work/export-order/page.tsx#L244) đang dùng để gắn cờ "CÒN HÀNG CHƯA HẠ" — nên số liệu thống kê khớp với cảnh báo ở danh sách lệnh.

Thẻ "Số lệnh xuất" hiển thị thêm dòng phụ `Hoàn thành x/y` (đếm lệnh có `export_tasks.status = 'Completed'`), và sheet Excel `Theo lenh` xuất cùng bộ cột.

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

---

# Walkthrough: Lọc danh sách "Đơn vị quy đổi" theo phân hệ kho (`/reports/accounting-history`)

## 🎯 Vấn đề

Dropdown **"Đơn vị gốc"** trên báo cáo Nhập - Xuất - Tồn (KT) query `units` không kèm điều kiện lọc phân hệ:

```ts
await supabase.from('units').select('id, name').order('name')   // ❌ 75 dòng của MỌI hệ thống
```

Trong khi cột `units.system_code` đã tồn tại từ migration [20260128000000_add_system_code_to_units.sql](file:///d:/chanh%20thu/web/supabase/migrations/20260128000000_add_system_code_to_units.sql). Hệ quả thực đo trên DB: đang ở **Kho Đông Lạnh** (chỉ 5 đơn vị: Kg, Khay, Sọt, Thùng, Túi) nhưng danh sách thả ra 29 dòng, trong đó có bản trùng của phân hệ khác (`Kg` ×5, `Cái` ×4, `Hộp` ×4, `Chiếc` ×4, `Bộ` ×4, `Mét` ×4) cộng 24 đơn vị chưa phân loại.

## 🛠 Giải pháp

**File duy nhất thay đổi:** [page.tsx](file:///d:/chanh%20thu/web/src/app/(dashboard)/reports/accounting-history/page.tsx) — không migration, không đụng schema.

1. **Query theo `system_code`** ([page.tsx:195](file:///d:/chanh%20thu/web/src/app/(dashboard)/reports/accounting-history/page.tsx#L195)): `.eq('system_code', systemType).eq('is_active', true)` — dùng `systemType` đang chọn, **không hardcode mã kho nào**. Kho nào tạo mới chỉ thấy đúng đơn vị của kho đó.
2. **Reset đơn vị đích khi đổi phân hệ** ([page.tsx:110](file:///d:/chanh%20thu/web/src/app/(dashboard)/reports/accounting-history/page.tsx#L110)): thêm `setTargetUnitId(null)` vào effect theo `systemType`, tránh trạng thái "đơn vị của phân hệ trước" còn sót làm dropdown trắng và báo cáo hiểu nhầm là đã quy đổi.
3. **So khớp đơn vị gốc bằng TÊN, không chỉ bằng ID** ([page.tsx:24](file:///d:/chanh%20thu/web/src/app/(dashboard)/reports/accounting-history/page.tsx#L24) `isSameUnitName`, dùng ở `isConvertible` và `VoucherDetailModal`): `unitNameMap` của `useUnitConversion` là **toàn cục** và tên trùng nhau giữa các phân hệ nên "last write wins" → sau khi lọc, ID của `Kg` toàn cục có thể không phải ID `Kg` của Kho Đông Lạnh, phép thử `baseUnitId === targetUnitId` sẽ fail và báo cáo mất luôn khả năng quy đổi về Kg. `isSameUnitName()` dùng `getMatchingUnitName()` (chuẩn hoá NFC, bỏ khoảng trắng, cắt hậu tố `(20kg)`) + `isKg()` nên khớp đúng bất kể trùng tên.

## 🔒 Bảo toàn Kho Đông Lạnh

- **Không đổi logic tính toán**: chỉ đổi *nguồn danh sách đơn vị hiển thị* + *điều kiện nhận diện "quy đổi được"*. Toàn bộ phép quy đổi vẫn đi qua `convertUnit()` của `useUnitConversion` (khớp theo tên, đã có fallback nhiều tầng).
- **Không mất đường quy đổi nào**: kiểm tra DB — `product_units` của sản phẩm `KHO_DONG_LANH` có 111 dòng và **100% trỏ tới unit có `system_code = KHO_DONG_LANH`** (Thùng 105, Sọt 4, Khay 2). Không có dòng nào tham chiếu unit của phân hệ khác hay unit chưa phân loại → lọc strict không làm mất option nào mà dữ liệu thật đang cần.
- **Đơn vị chưa phân loại (`system_code IS NULL`)** chủ động **không** hiển thị, theo đúng yêu cầu "chỉ hiện đơn vị đã cài ở phân hệ này". Nếu cần dùng, vào `/units` sửa nó: thao tác update ở [units/page.tsx:84](file:///d:/chanh%20thu/web/src/app/(dashboard)/units/page.tsx#L84) sẽ gán `system_code` về phân hệ đang làm việc (cơ chế "claim" sẵn có).
- **Không rò rỉ dữ liệu liên phân hệ**: dropdown chỉ còn đơn vị của `systemType`; các query phiếu nhập/xuất vẫn giữ nguyên `.eq('order.system_type', systemType)` như trước.

## ✅ Kiểm chứng

- `npx tsc --noEmit`: không phát sinh lỗi trên file đã sửa.
- Dev server `:3001` biên dịch lại `/reports/accounting-history` sạch (chỉ còn lỗi `manifest.webmanifest` tồn tại từ trước, không liên quan).
- Đối chiếu số liệu DB bằng `psql`: trước 29 dòng / sau 5 dòng cho `KHO_DONG_LANH`.
- **Còn mở**: xác nhận bằng mắt dropdown chỉ còn 5 dòng + bấm thử "Xuất Excel" cần phiên đăng nhập (agent không vượt được màn hình login).

> Lưu ý mở rộng (chưa làm, chờ quyết định): `/inventory` ([page.tsx:139](file:///d:/chanh%20thu/web/src/app/(dashboard)/inventory/page.tsx#L139)) và một số chỗ khác vẫn query `units` không lọc phân hệ theo cùng kiểu.

---

# Walkthrough (mở rộng): Lọc "Đơn vị quy đổi" theo phân hệ ở 5 dropdown còn lại

Quét toàn bộ 26 điểm query bảng `units` trong repo, phân loại theo **mục đích dùng**:

## ✅ Đã sửa (danh sách cho người dùng chọn → phải theo phân hệ)

| # | Route | Điểm sửa | Ghi chú |
|---|-------|----------|---------|
| 1 | `/reports/accounting-history` | [page.tsx:195](file:///d:/chanh%20thu/web/src/app/(dashboard)/reports/accounting-history/page.tsx#L195) | xem mục ở trên |
| 2 | `/inventory` | [page.tsx:141](file:///d:/chanh%20thu/web/src/app/(dashboard)/inventory/page.tsx#L141) | một list nuôi 4 dropdown (tab Tổng hợp, tab Tồn theo lot qua `InventoryFilters`, 2 nút Excel). Effect cũ có deps `[]` nên **không bao giờ refetch khi đổi phân hệ** → đổi thành deps `[systemType]` + reset `targetUnitId`. |
| 3 | `/warehouses/lots` (buffer nhập) | [LotInboundBuffer.tsx:79](file:///D:/chanh%20thu/web/src/components/warehouse/lots/LotInboundBuffer.tsx#L79) | select "Hiện quy đổi" lưu **theo TÊN** vào `localStorage.lot_inbound_target_unit` (key dùng chung mọi phân hệ). |
| 4 | `/warehouses/lots` (buffer xuất) | [LotExportBuffer.tsx:80](file:///D:/chanh%20thu/web/src/components/warehouse/lots/LotExportBuffer.tsx#L80) | y như trên với `lot_export_target_unit`. |
| 5 | `/operations/audit` | [CreateAuditModal.tsx:94](file:///D:/chanh%20thu/web/src/app/(dashboard)/operations/audit/_components/CreateAuditModal.tsx#L94) | chip "Bộ lọc đơn vị tính (Toàn cục)" — Kho Đông Lạnh trước đây hiện 29 chip với `Kg`×5, `Cái`×4… |
| 6 | `/production` | [ProductionModal.tsx:282](file:///D:/chanh%20thu/web/src/app/(dashboard)/production/_components/ProductionModal.tsx#L282) | modal có **bộ chọn phân hệ đích** `targetSystemCode` (chip ở dòng 1663) nên đơn vị phải theo `targetSystemCode` chứ không theo `currentSystem` → `fetchUnits(sysCode)` gọi trong cùng effect với `fetchProducts(sysCode)`. |

### Xử lý 2 key localStorage dùng chung phân hệ (#3, #4)

Trước đây giá trị "Hiện quy đổi" được đọc trong effect `isOpen` → nếu chuyển từ Kho Dụng Cụ (đã chọn "Cái") sang Kho Đông Lạnh thì dropdown trắng nhưng `targetUnit` vẫn còn trong state và phép quy đổi vẫn âm thầm chạy. Nay việc đọc localStorage chuyển vào sau khi `fetchCommonData` lấy được đơn vị của phân hệ: tên không còn trong danh sách thì **xoá luôn key** và reset về rỗng.

### Vì sao lọc strict (`system_code = <hệ>`, bỏ `IS NULL`) an toàn với Kho Đông Lạnh

Đối chiếu trực tiếp trên DB `anywarehouse`:

- `product_units` của sản phẩm từng phân hệ **100% trỏ tới unit cùng `system_code`** (FROZEN 111/111; Dụng Cụ 3/3; Vật tư & Bao bì 4/4). Không có dòng nào tham chiếu unit chưa phân loại.
- Mọi chuỗi đơn vị thật sự xuất hiện trong `inbound_order_items` / `outbound_order_items` / `lot_items` của Kho Đông Lạnh đều thuộc 5 unit đã gán: `Kg, Khay, Sọt, Thùng, Túi` (dạng hậu tố `(20kg)` là do UI ghép vào tên, không phải tên trong bảng `units`).
- 24 dòng `system_code IS NULL` chỉ là bản trùng tên `Bộ/Cái/Chiếc/Hộp/Kg/Mét` — tên nào cũng đã có bản được gán cho phân hệ đang dùng.

## ⚪ Không phải lỗi (chỉ tra cứu id→name hoặc đã giới hạn theo sản phẩm)

`(dashboard)/products`, `sanxuat/products`, `print/inbound`, `print/outbound`, `api/export/batch-inbound`, `api/export/batch-outbound`, `useUnitConversion` (toàn cục chủ đích), `LotCard`, `LotDetailsModal`, `LotExportModal`, `LotForm`, `PalletsPageContent` (`getAvailableUnitsForProduct`), `MobileExportTab`, `warehouses/scan/export`, `LotExportBuffer:275` (dictionary cho `unbundleService`).

## 🔧 Đã lọc đúng chuẩn từ trước (không sửa)

`useInboundOrder`, `useOutboundOrder`, `BankInboundOrderModal`, `BankOutboundOrderModal`, `useProductForm`, trang `/units`.

> Các điểm này dùng `.or(system_code.eq.X, system_code.is.null)` — vẫn để lộ unit chưa phân loại. Chưa đổi sang strict để không phá luồng tạo phiếu đang vận hành; nếu muốn đồng nhất strict toàn app thì làm thành một đợt riêng.

## 🗑 Ghi chú nợ kỹ thuật

`/print/inventory` fetch `units` vào state `allUnits` ([page.tsx:156](file:///D:/chanh%20thu/web/src/app/print/inventory/page.tsx#L156)) rồi **không dùng ở đâu** — code chết, nên xoá ở đợt dọn sau.

## ✅ Kiểm chứng đợt này

- `npx tsc --noEmit`: không phát sinh lỗi mới trên 5 file đã sửa. Lỗi `type 'never'` trong `CreateAuditModal` và các lỗi ở `work/inventory/page.tsx` là **có sẵn từ trước** (đã đối chiếu: dòng 112 của HEAD lệch đúng +1 so với dòng 113 báo lỗi sau khi mình thêm 1 dòng).
- Dev server `:3001` biên dịch lại sạch cả 5 route (`/inventory`, `/warehouses/lots`, `/operations/audit`, `/production`, `/work/inventory`).
- **Còn mở**: nhìn tận mắt 5 dropdown sau khi lọc cần phiên đăng nhập localhost.

---

# Walkthrough: Tạo/Sửa LOT trực tiếp trên ô vị trí + Redesign compact — Kiểm Kê Nội Bộ (`/work/inventory`)

## ✨ Hành vi mới

1. **Nút bút luôn hiển thị** trên mọi ô vị trí (phiếu chưa khóa):
   - Ô **đã có LOT** → mở modal **sửa LOT** (`handleEditLot`, giữ nguyên như trước).
   - Ô **trống** → mở modal **tạo LOT mới** (`handleCreateLotAtPosition`, [page.tsx](file:///D:/chanh%20thu/web/src/app/(dashboard)/work/inventory/page.tsx)).
2. **Tự gán vị trí**: LOT tạo mới từ ô trống được ghi `positions.lot_id` ngay trong `onLotEditSuccess` → không còn bước thoát ra gán thủ công.
3. **Tự tích kiểm** (nghiệp vụ đã chốt): ô tạo LOT mới được upsert `checked = true` + `is_modified = true` vào `internal_inventory_items`.
4. **Pre-fill kho**: `LotForm` nhận thêm prop optional `initialWarehouseName` — chỉ chạy ở chế độ tạo mới; các caller cũ không truyền → hành vi 100% như cũ.

## 🎨 Redesign compact (cùng đợt)

- Ô vị trí: card cao 150–160px chữ `font-black` → card đặc ~3 dòng (mã vị trí + LOT + hành động / tên SP + SL / ghi chú ẩn tới khi hover), trạng thái bằng chấm màu + viền nhạt.
- Lưới: `grid-cols-[repeat(auto-fill,minmax(170px,1fr))]` thống nhất mọi khu (Sảnh/Dãy/Tầng), `overflow-hidden` + `truncate` chống tràn chữ sang ô bên cạnh.
- Tiêu đề Dãy/Ô/Tầng, banner "đã khóa", thẻ Thống kê Sảnh: giảm padding/cỡ chữ, bỏ `animate-pulse`.

## 🔒 Tuân thủ AGENTS.md

- Không hardcode mã kho, không module mới, không đổi schema; query/update vẫn trong phạm vi `system_type` của phiên đang chọn (vị trí lấy từ danh sách đã lọc theo hệ).
- Kho Đông Lạnh: `LotForm` chỉ thêm prop optional; luồng sửa LOT cũ không đổi semantics — nhánh `isNewAssignment` chỉ kích hoạt khi vị trí chưa có lot.

## ✅ Kiểm chứng

- `npx tsc --noEmit` sạch trên 2 file sửa (`work/inventory/page.tsx`, `LotForm.tsx`).
- Còn mở: bấm thử UI cần phiên đăng nhập — tạo LOT từ ô trống, kiểm tra ô chuyển "Đã sửa" + tích xanh, LOT hiển thị đúng vị trí.


# Walkthrough: Cờ "Đã xử lý" (resolved) cho sai lệch ghi chú — Kiểm Kê Nội Bộ

## Vấn đề
Trước đây "sai lệch" được suy ra từ `note && !checked`, nhưng nhân viên tích V coi như đã kiểm tra tiến độ → mọi ô có ghi chú sai lệch đều chuyển xanh, màu đỏ và bộ đếm SAI LỆCH biến mất ở tất cả tiêu đề.

## Giải pháp
Tách hai khái niệm thành hai cột độc lập trên `internal_inventory_items`:
- `checked` = tiến độ kiểm kê (nhân viên tích V).
- `resolved` = quản lý xác nhận "đã xử lý sai lệch" (thêm mới, mặc định false).

- **Migration**: `supabase/migrations/20261029100000_add_resolved_to_internal_inventory_items.sql` — `ADD COLUMN IF NOT EXISTS resolved boolean NOT NULL DEFAULT false` (đã apply vào local stack `supabase_db_anywarehouse`).
- **Logic sai lệch (đỏ)**: còn ghi chú VÀ chưa resolved — bất kể đã tích V hay chưa. Áp dụng thống nhất ở: tone thẻ ô vị trí, `getZoneStats` (Ô/Dãy/Tầng/thẻ tổng kê), stats danh sách phiếu (`fetchSessions`), header chi tiết phiếu.
- **UI trên ô**: ô còn ghi chú hiện nút khiên "Xác nhận đã xử lý" (kèm tích xanh tiến độ nếu đã checked); sau khi xác nhận hiện chip "Đã xử lý" (bấm để bỏ). Ghi chú đã xử lý chuyển chữ xanh lá.
- **Sửa ghi chú = phát sinh lại sai lệch**: `updateNote` tự reset `resolved = false` khi nội dung ghi chú thay đổi, quản lý phải xác nhận lại.
- Upsert trong `toggleCheck`/`bulkCheck` không đụng cột `resolved` → tích V không còn làm mất đỏ.

## 🔒 Tuân thủ AGENTS.md
- Cột mới mang tính nghiệp vụ chung của Kiểm kê nội bộ, không hardcode mã kho/phân hệ; phiếu đã lọc `system_code` từ trước. Kho Đông Lạnh không dùng màn này nên không bị ảnh hưởng; cột có default nên dữ liệu cũ không đổi semantics.

## ✅ Kiểm chứng
- `npx tsc --noEmit` sạch trên `work/inventory/page.tsx`.
- Đã xác nhận cột `resolved` tồn tại bằng `\d internal_inventory_items` trên DB local.
- Còn mở (cần user bấm thử): ô có ghi chú + đã tích V vẫn đỏ; bấm khiên "Đã xử lý" → hết đỏ, tiêu đề SAI LỆCH giảm; sửa ghi chú → đỏ lại.

# Walkthrough: Chip "Đã xử lý" trên tiêu đề + Bong bóng ghi chú kiểm kê trong modal LOT

- `getZoneStats` trả thêm `resolved` (ghi chú + đã xác nhận xử lý); chip xanh "x đã xử lý" hiển thị ở header Dãy/Sảnh, Ô, Tầng breadcrumb, thẻ tòa nhà (cột "Xử lý" trong grid 5 cột), khối stat header chi tiết phiếu, và card danh sách phiếu.
- `LotForm` thêm 2 prop optional `inventoryNote` / `inventoryPositionCode`: khi mở modal tạo/sửa LOT từ ô kiểm kê có ghi chú sai lệch, đầu modal hiện bong bóng vàng "Ghi chú kiểm kê — vị trí XXX" kèm nguyên văn ghi chú của nhân viên. Trang khác không truyền prop → modal giữ nguyên giao diện cũ (Kho Đông Lạnh không bị ảnh hưởng).
- `tsc --noEmit` sạch trên `work/inventory/page.tsx` và `LotForm.tsx`.

## Điều chỉnh: Bong bóng ghi chú là floating overlay của trang Kiểm kê (KHÔNG phải tính năng LotForm/Quản lý LOT)

- Đã revert hoàn toàn 2 prop `inventoryNote`/`inventoryPositionCode` khỏi `LotForm.tsx` — LotForm và trang Quản lý LOT (kể cả Kho Đông Lạnh) trở lại đúng nguyên trạng, không mang logic kiểm kê.
- Bong bóng giờ được render trong `work/inventory/page.tsx` ngay khi modal LOT mở: `position: fixed` giữa mép trên màn hình (z-[70], trên overlay z-[60]) → nằm nguyên giữa màn hình dù cuộn biểu mẫu thế nào. Có đuôi tam giác kiểu speech bubble, nút X để ẩn (mở lại modal cho vị trí khác/vị trí cũ đều hiện lại).

## Điều chỉnh: Bỏ đề xuất kho khi mở modal LOT từ ô kiểm kê

- Người dùng yêu cầu modal mở lên KHÔNG được tự động điền/tác động trường "Kho nhập hàng / Mã kho đích" (đang bị lệch giao diện với KHO 1 tự hiện).
- Xóa hoàn toàn prop `initialWarehouseName` + effect prefill khỏi `LotForm.tsx` và state `lotFormWarehouse` khỏi `work/inventory/page.tsx`. Trường kho giờ hoạt động đúng như trang Quản lý LOT gốc (mặc định theo chi nhánh), không còn logic kiểm kê nào trong LotForm.

## Điều chỉnh: Không tự điền STT khi tạo LOT từ ô kiểm kê

- `LotForm` thêm prop optional `autoFillStt` (mặc định `true`): khi `false`, `generateLotCode()` vẫn sinh mã LOT `DL-LOT-...` nhưng bỏ khối truy vấn/tính STT → ô STT trống, nhân viên/quản lý tự điền nếu cần.
- Trang Kiểm kê nội bộ truyền `autoFillStt={false}` cho cả modal tạo và sửa LOT; sửa LOT vẫn hiển thị STT gốc của lot (đường `editingLot.daily_seq`, không liên quan autofill).
- Trang Quản lý LOT / nhập kho cũ không truyền prop → hành vi tự tăng STT giữ nguyên 100%, Kho Đông Lạnh không ảnh hưởng.

## Điều chỉnh: Modal LOT từ ô kiểm kê mở ở chế độ "Thu gọn chi tiết"

- `LotForm` thêm prop optional `collapseDetailsByDefault` (mặc định `false`): khi `true`, sau khởi tạo form (cả tạo mới và sửa) luôn set `isInfoExpanded = false` → modal hiện gọn, người dùng bấm "Hiện thêm thông tin" khi cần.
- Trang Kiểm kê truyền `collapseDetailsByDefault` cho modal mở từ cây bút; ghi đè giá trị `isInfoExpanded` khôi phục từ localStorage sticky, chỉ trong ngữ cảnh kiểm kê.
- Trang Quản lý LOT không truyền prop → hành vi cũ (mặc định mở rộng + nhớ trạng thái sticky) giữ nguyên. `tsc --noEmit` sạch.

## Điều chỉnh nhỏ: Thẻ ô vị trí hiển thị đầy đủ tên sản phẩm

- Bỏ `truncate` ở tên sản phẩm trong thẻ ô kiểm kê — tên dài tự xuống dòng (break-words); số lượng + đơn vị và mã SKU/tem chuyển xuống dòng dưới (SKU truncate bên trái, SLL phải).

## Điều chỉnh nhỏ: Copy nhanh mã vị trí / mã LOT trên thẻ ô

- Bấm vào mã vị trí hoặc mã LOT ở dòng đầu thẻ ô kiểm kê → copy vào clipboard + toast "Đã copy ..." (stopPropagation, không kích hoạt tích V). Hover gạch chân nét chấm, con trỏ copy.
- Helper `copyQuick` dùng `navigator.clipboard.writeText`.

## Điều chỉnh nhỏ: Nút tải lại (refresh) tại mỗi ô kiểm kê

- Mỗi thẻ ô có nút `RefreshCw` cạnh cây bút: bấm sẽ refetch dòng `positions` của ô (lot_id mới nhất) + refetch `lots` (code, lot_items, lot_tags) và cập nhật cục bộ state `positions`/`lotInfo` — không tải lại cả trang. Icon xoay khi đang tải, toast xác nhận.
- `refreshPositionLot` đặt cạnh `copyQuick`; bị vô hiệu khi phiếu đã khóa (theo `pointer-events-none` của thẻ).

---

# Walkthrough: Báo Cáo Tồn Kho Lâu Ngày (Aging Report) — `/reports/inventory-aging`

Yêu cầu: công ty muốn biết **hàng nào đã tồn kho trên 90 ngày, trên 180 ngày**, số ngày tính từ các mốc ngày đang quản lý trên LOT, và **chọn được loại ngày** (nhập kho / sản xuất / nguyên liệu / đóng gói).

## 🧩 1. Cấu Trúc File

| File | Vai trò |
|---|---|
| [src/lib/inventoryAging.ts](file:///d:/chanh%20thu/web/src/lib/inventoryAging.ts) (458 dòng) | Toàn bộ logic thuần: mốc ngày, nhóm tuổi, tính số ngày, dựng dòng, tổng hợp 2 chế độ. **Không import React** → test được bằng vitest. |
| [src/lib/inventoryAgingExcelExport.ts](file:///d:/chanh%20thu/web/src/lib/inventoryAgingExcelExport.ts) (215 dòng) | Sinh file Excel 3 sheet bằng ExcelJS + file-saver (đúng quy ước các báo cáo khác). |
| [src/app/(dashboard)/reports/inventory-aging/page.tsx](file:///d:/chanh%20thu/web/src/app/(dashboard)/reports/inventory-aging/page.tsx) (787 dòng) | Trang UI: bộ lọc, thẻ tổng quan, 2 tab bảng, phân trang 50 dòng. |
| [src/lib/__tests__/inventoryAging.test.ts](file:///d:/chanh%20thu/web/src/lib/__tests__/inventoryAging.test.ts) | 11 unit test cho logic thuần — **11/11 PASS**. |
| [supabase/migrations/20261029170000_add_report_inventory_aging_module.sql](file:///d:/chanh%20thu/web/supabase/migrations/20261029170000_add_report_inventory_aging_module.sql) | Đăng ký module `report_inventory_aging` vào `app_modules` (đã push vào stack local `anywarehouse`). |

Không có thay đổi schema nào cho dữ liệu nghiệp vụ: **báo cáo chỉ đọc**, không thêm cột, không backfill, không đụng luồng nhập/xuất/LOT.

## 🗓 2. Ý Nghĩa Dữ Liệu — 4 Loại Ngày + Mốc "Tính Đến Ngày"

`AGING_DATE_OPTIONS` [src/lib/inventoryAging.ts:21](file:///d:/chanh%20thu/web/src/lib/inventoryAging.ts#L21) — cùng bộ 4 mốc ngày mà bản đồ kho đang dùng (`DATE_FILTER_OPTIONS` trong [WarehouseMapTab.tsx:36](file:///d:/chanh%20thu/web/src/app/scanner/_components/WarehouseMapTab.tsx#L36)), nên người dùng không phải học khái niệm mới:

| Lựa chọn | Cột dữ liệu | Module LOT yêu cầu |
|---|---|---|
| 📥 Ngày nhập kho (mặc định) | `lots.inbound_date` | không cần (luôn hiện) |
| 🔪 Ngày sản xuất | `lots.peeling_date` → `lots.metadata.peeling_dates[]` (sớm nhất) → `production_lots.production_date` qua `lots.production_lot_id` | `peeling_date` |
| 🚛 Ngày nhập nguyên liệu | `lots.raw_material_date` | `raw_material_date` |
| 📦 Ngày đóng gói | `lots.packaging_date` | `packaging_date` |

- Chuỗi fallback này nằm trong `resolveLotDate()` [src/lib/inventoryAging.ts:167](file:///d:/chanh%20thu/web/src/lib/inventoryAging.ts#L167): lot nào thiếu mốc ngày chọn thì lần lượt lấy nguồn thay thế, vẫn không có → gộp vào nhóm **"Chưa có ngày"** riêng (không âm thầm tính thành 0 ngày, cũng không bị bỏ rơi khỏi báo cáo).
- Mỗi lựa chọn chỉ hiện khi phân hệ **BẬT module LOT tương ứng** — `AGING_DATE_OPTIONS.filter(o => !o.lotModuleId || hasModule(o.lotModuleId))` [page.tsx:90](file:///d:/chanh%20thu/web/src/app/(dashboard)/reports/inventory-aging/page.tsx#L90). Kho nào không dùng ngày sản xuất thì không thấy nút đó.
- **Số ngày = `asOfDate - mốc ngày`**, `asOfDate` do người dùng chọn (mặc định hôm nay) — đúng chỉ thị "lấy từ mốc ngày báo cáo lui về sau", nên có thể truy lại "tồn bao lâu tính đến ngày 30/06".
- `normalizeAgingDate()` [src/lib/inventoryAging.ts:92](file:///d:/chanh%20thu/web/src/lib/inventoryAging.ts#L92) cắt **10 ký tự đầu** của chuỗi timestamp thay vì `new Date()`. Lý do: DB lưu ngày LOT ở UTC midnight (`2026-10-29 00:00:00+00`, `SHOW timezone = UTC`); nếu để `Date` local tự parse, máy múi âm (VN = UTC+7 được, nhưng máy Tây) sẽ **lệch 1 ngày** với những gì quản lý nhìn thấy trên form LOT. `diffDays()` dùng `Date.UTC` thuần ngày → kết quả ổn định trên mọi máy, kể cả ngày âm (milestone nhập kho ở tương lai).

## 📊 3. Hai Chế Độ Tổng Hợp Song Song (theo đúng yêu cầu)

| Tab | Đơn vị một dòng | Dùng khi |
|---|---|---|
| **Chi tiết theo LOT** | một LOT (`summarizeByLot`) | truy vết tay: mã LOT, STT, kho/chi nhánh, vị trí, danh sách sản phẩm + số ngày tuổi cụ thể |
| **Tồn theo sản phẩm** | `sku + unit` (`summarizeByProduct`) | hỏi "mặt hàng này có bao nhiêu Kg đang già quá 90 ngày" |

- Dòng tuổi tính theo **từng `lot_items`** (số lượng cấp dòng, `quantity <= 0` bị loại), chỉ fallback về `lots.quantity` khi LOT không có dòng — nhất quán với tab "Tồn theo LOT / danh mục" ở `/inventory`.
- Ma trận sản phẩm: `qtyByBucket[]` + `lotCountByBucket[]` (đếm LOT **đã khử trùng lặp** bằng `Set` theo từng nhóm tuổi — [src/lib/inventoryAging.ts:363](file:///d:/chanh%20thu/web/src/lib/inventoryAging.ts#L363)), nên "3 LOT" nghĩa là 3 kiện thật, không phải 3 dòng hàng.
- Nhóm tuổi: **mặc định cố định + chỉnh được** — `DEFAULT_AGING_THRESHOLDS = [30, 60, 90, 180]`, ô nhập threshold cộng thêm/xóa từng mốc, 2 preset nhanh (90/180 và 30·60·90·180). `sanitizeThresholds()` loại trùng/giá trị ≤ 0 và sắp tăng dần; `buildBuckets()` sinh các khoảng **kín, không_overlap**: `0-30, 31-60, 61-90, 91-180, >180`.
- Dải thẻ tổng quan: một thẻ "Tổng LOT đang xét" + **một thẻ cho từng nhóm tuổi** (`computeStats` → `bucketTotals`, mỗi thẻ hiện số LOT / số lượng / Kg) và thẻ "Chưa có ngày" khi có LOT thiếu mốc. **Bấm vào thẻ là lọc luôn bảng** theo nhóm tuổi đó (`bucketFilter`), kèm chip "Đang lọc nhóm: …" để bỏ lọc.
- Chips nhanh **"Tồn trên {ngưỡng} ngày"** (`minDays`) là chế độ **lũy kế** — gom mọi dòng vượt mốc (trên 90, trên 180) chứ không cắt thành nhóm kín, đúng nguyên câu hỏi của công ty "hàng nào tồn trên 90 ngày".
- `computeStats` → `overThresholds` (số LOT / số lượng / Kg vượt **từng** mốc) được in thành các dòng đỏ đậm trong sheet "Tóm tắt nhóm tuổi" của file Excel.

## 🔒 4. Tuân Thủ Chỉ Thị AGENTS.md

**Module bật/tắt — không hardcode mã kho**
- Trang gate bằng `hasModule('report_inventory_aging')` [page.tsx:81](file:///d:/chanh%20thu/web/src/app/(dashboard)/reports/inventory-aging/page.tsx#L81) + `requiredModule` ở Sidebar [Sidebar.tsx:146](file:///d:/chanh%20thu/web/src/components/layout/Sidebar.tsx#L146). Không một điều kiện `systemType === '...'` nào quyết định tính năng.
- Đăng ký ở [report-modules.ts:56](file:///d:/chanh%20thu/web/src/lib/report-modules.ts#L56) (`category: 'report'`). Migration chỉ **upsert bản ghi module**, cố ý không đè `is_basic` để giữ lựa chọn của người dùng đã chỉnh.
- Vì mọi phân hệ hiện hữu đều đang có mảng `systems.report_modules` riêng (không null), module mới **không tự bật** → KHO ĐÔNG LẠNH và các kho khác giữ nguyên trạng thái, phải vào *Cài đặt → Cấu hình phân hệ → Tính năng → Báo cáo* để bật.
- Kiểm tra gate đặt **sau** toàn bộ hook và render placeholder, tránh vi phạm rules-of-hooks khi `currentSystem` còn đang tải.

**Cô lập dữ liệu theo `system_code`**
- `lots` lọc `.eq('system_code', sysCode).eq('status','active')`; `products` lọc `.or('system_code.eq.X,system_type.eq.X')`; `positions` lọc `.eq('system_type', sysCode)` [page.tsx:132-142](file:///d:/chanh%20thu/web/src/app/(dashboard)/reports/inventory-aging/page.tsx#L132).
- `lot_items` không có cột `system_code` (theo schema hiện tại), nên chỉ được nối qua id LOT của phân hệ đang chọn (LOT nào rơi khỏi bộ lọc `system_code` thì dòng của nó biến mất theo) — cùng cơ chế đã kiểm chứng của [useInventoryByLot.ts:238](file:///d:/chanh%20thu/web/src/components/inventory/by-lot/useInventoryByLot.ts#L238).
- `categories` và `product_category_rel` **có** `system_type` nên đều được lọc `.eq('system_type', sysCode)` [page.tsx:138-139](file:///d:/chanh%20thu/web/src/app/(dashboard)/reports/inventory-aging/page.tsx#L138). Trước đó bản đầu viết theo `useInventoryByLot` (query toàn bảng) khiến dropdown "Lọc theo danh mục" liệt kê cả danh mục của kho khác — đã sửa; đã xác minh bằng psql rằng 0 dòng `product_category_rel` và 0 dòng `lot_items.category_id` tham chiếu chéo sang phân hệ khác, nên lọc thêm không làm mất danh mục hợp lệ nào. Không có đường nào đọc lẫn dữ liệu kho khác.
- Việc chuẩn hóa alias `FROZEN → KHO_DONG_LANH`, `DRY → KHO_VAT_TU_BAO_BI` [page.tsx:129](file:///d:/chanh%20thu/web/src/app/(dashboard)/reports/inventory-aging/page.tsx#L129) **chép nguyên văn** từ [useInventoryByLot.ts:218](file:///d:/chanh%20thu/web/src/components/inventory/by-lot/useInventoryByLot.ts#L218). Đây chỉ là quy đổi khóa dữ liệu để cùng đọc đúng bảng như các tab `/inventory` hiện tại, không bật/tắt hành vi nào.
- Danh mục đi theo đúng nguồn duy nhất `resolveCategories(product, lineCategoryId, nameMap)` ([src/lib/productCategory.ts](file:///d:/chanh%20thu/web/src/lib/productCategory.ts)): danh mục cấp dòng `lot_items.category_id` thắng, nên bộ lọc danh mục của báo cáo khớp 100% với tab "Tồn theo danh mục".
- Con số Kg quy đổi dùng `getBaseAmount() * getBaseToKgRate()` — cùng công thức trang in `/print/inventory`, để báo cáo này và báo cáo tồn đang dùng không lệch nhau.

**Bảo toàn Kho Đông Lạnh**
- Không sửa bất kỳ file dùng chung nào của luồng LOT/nhập/xuất; chỉ thêm 3 file mới + 1 entry module + 1 mục menu.
- Trang là pure reader: xóa/mở module cũng không ảnh hưởng dữ liệu đã có.

## 📥 5. Bộ Lọc & Xuất Excel

- Bộ lọc: ô "Tính đến ngày", loại ngày, ngưỡng nhóm tuổi, "Tồn trên N ngày" (chips nhanh), lọc theo nhóm tuổi, ẩn/hiện nhóm "Chưa có ngày", tìm kiếm (mã LOT / STT / SKU / tên / mã phụ / alias qua `advancedMatchSearch`), danh mục, kho/chi nhánh, trạng thái khóa.
- Sắp xếp: tab LOT theo Mã LOT / Số lượng / Quy đổi Kg / Số ngày tồn; tab sản phẩm theo Mã SP / Tổng tồn / Kg / Số ngày lớn nhất. Các cột ma trận nhóm tuổi **không sắp xếp** mà hiện số LOT trong tooltip (`title="Số LOT: x"`), tô màu theo độ già. Phân trang 50 dòng, có nút tải lại dữ liệu.
- Excel 3 sheet: **Tổng hợp theo sản phẩm** (ma trận tuổi, một cột mỗi nhóm), **Chi tiết theo LOT**, **Tóm tắt nhóm tuổi** (kèm dòng in đỏ đậm "Vượt mốc N ngày"). Tên file `Ton_kho_lau_ngay_dd-MM-yyyy.xlsx`; header ghi rõ phân hệ, loại ngày đang chọn và mốc "tính đến" để đối chiếu về sau.

## 🧪 6. Kiểm Chứng Đã Chạy

| Kiểm tra | Kết quả |
|---|---|
| `npx tsc --noEmit` (lọc trên các file vừa thêm) | Sạch, không lỗi mới |
| `npx vitest run src/lib/__tests__/inventoryAging.test.ts` | **11/11 PASS** — biên nhóm tuổi, ngày trống → nhóm riêng, sanitize ngưỡng, cắt ngày UTC, `diffDays` kể cả ngày âm, chuỗi fallback ngày sản xuất, gộp theo LOT, ma trận sản phẩm `qtyByBucket [0,4,0,0,10]` + `lotCountByBucket [0,1,0,0,1]`, loại dòng `quantity = 0` |
| `npx next build` (chạy trực tiếp, không qua pipe để giữ đúng exit code) | **BUILD_EXIT=0**, route `/reports/inventory-aging` xuất hiện trong danh sách build (prerender tĩnh) |
| Migration | Đã `db push` vào stack local `anywarehouse`; xác nhận `app_modules` có `report_inventory_aging` (category `report`) và **không** bị ghi đè `is_basic` của module cũ |
| Đối chiếu số liệu thật (psql, KHO_DONG_LANH, tính đến 29/10/2026, mốc = ngày nhập kho) | 2.046 LOT `active`; 292 LOT chưa có `inbound_date`; nhóm 31–60: 465; 61–90: 51; **>90 ngày: 893 LOT**; **>180 ngày: 215 LOT**. Tổng số lượng >90 ngày theo **cấp dòng `lot_items` = 31.794,809** (đây là con số báo cáo hiển thị); nếu cộng cột `lots.quantity` cấp header ra 31.328,809 — lệch 466 do dữ liệu header và dòng chưa khớp nhau từ trước, không phải lỗi tính tuổi. Query chuẩn để đối chiếu: `sum(lot_items.quantity)` của các LOT `active` có `CURRENT_DATE - inbound_date > 90`. Đây là bộ số để người dùng bấm kiểm tra khi bật module. |

**Còn mở (cần người dùng xác nhận trên UI thật):** đăng nhập localhost rồi bật module *Tồn kho lâu ngày* để xem trang — agent không có phiên đăng nhập nên chỉ xác minh tới `tsc` / `build` / unit test / psql.

---

# Walkthrough: Sửa lỗi tính năng NẠP / PHỤC HỒI CSDL trong `server_launcher.py`

## Bối cảnh & vấn đề phát hiện

Người dùng chưa bao giờ dám bấm nút "📥 NẠP / PHỤC HỒI CSDL" vì không có điều kiện thử trên hệ thống đang chạy ổn định. Đọc mã nguồn và kiểm chứng thực nghiệm cho thấy linh cảm đó **đúng**: nút này không hề "phục hồi".

Ba lỗi gốc tại `server_launcher.py` (trước sửa):

1. **Không xóa dữ liệu cũ trước khi ghi** — không có bất kỳ lệnh `TRUNCATE`/`DELETE` nào. File backup chỉ chứa `INSERT`, nên nạp vào DB đã có dữ liệu sẽ va khóa chính gần như toàn bộ.
2. **Báo thành công giả** — `psql` chạy **không có** `-v ON_ERROR_STOP=1`, nên gặp lỗi vẫn bỏ qua và **thoát mã 0**; mã cũ chỉ kiểm tra `returncode == 0` là in ra "Nạp CSDL THÀNH CÔNG 100%".
3. **Không có transaction** — thiếu `--single-transaction`, và file backup chỉ có 92 câu `INSERT` (mỗi bảng một câu hàng chục nghìn dòng), nên một bảng lỗi là mất nguyên bảng đó, không hoàn tác được.

### Bằng chứng thực nghiệm (thực hiện trong database tạm, không đụng DB thật)

Kịch bản "nạp file backup vào DB đã có dữ liệu" — tức đúng tình huống bấm nút trên hệ thống thật:

| Đại lượng | Giá trị đo được |
|---|---|
| Mã thoát của `psql` | **0** → GUI cũ sẽ báo *"Đã phục hồi dữ liệu thành công!"* |
| Số bảng bị từ chối ghi | **91/92** (duplicate key) |
| Số bảng âm thầm **nhân đôi** dữ liệu | **1** — `public.master_tags`: 16 dòng → **32 dòng** |

Đối chiếu chéo: truy vấn `pg_constraint` xác nhận `master_tags` là bảng **duy nhất** trong toàn hệ thống không có khóa chính/unique — trùng khít với bảng duy nhất bị nhân đôi.

## Giải pháp đã triển khai

Toàn bộ nằm trong `server_launcher.py`, không sửa mã nguồn ứng dụng Next.js.

### 1. Phục hồi đúng nghĩa: làm trống trước, ghi sau

Thêm `_list_db_tables()` truy vấn `pg_class` lấy mọi bảng (`relkind in ('r','p')`) của 3 schema `public`, `auth`, `storage`, rồi sinh câu `TRUNCATE TABLE ...` liệt kê **tất cả trong một câu** — nên không phải quan tâm thứ tự phụ thuộc khóa ngoại. Hằng số `RESTORE_PROTECTED_TABLES` loại trừ `auth.schema_migrations` (77 dòng) và `storage.migrations` (61 dòng): đây là bảng nội bộ của GoTrue/Storage, **không** nằm trong file backup nhưng nếu xóa theo thì dịch vụ sẽ hỏng.

### 2. Không còn "thành công giả"

`psql` giờ chạy với `-v ON_ERROR_STOP=1 --single-transaction`. Phán quyết thành/bại dựa trên **đếm dòng `ERROR:` trong stderr**, không chỉ tin mã thoát. Mã thoát 3 (lỗi script) được diễn giải rõ là đã rollback.

### 3. Giao dịch đơn → lỗi giữa chừng hoàn tác toàn bộ

Preamble (`SET session_replication_role = replica` + `TRUNCATE`) được ghi **cùng luồng stdin** với nội dung file backup vào một phiên `psql` duy nhất, nên nằm trong cùng một transaction. Stream bằng `shutil.copyfileobj` chế độ nhị phân (không nạp 70MB vào RAM, không dịch mã hóa); stderr ghi ra file tạm để loại trừ deadlock đường ống khi ghi lượng lớn.

### 4. Chốt an toàn trước khi ghi

- **Kiểm tra tiền đề**: `_parse_backup_tables()` đọc danh sách `INSERT INTO "schema"."table"` từ file, so với cấu trúc hiện tại; nếu file cần bảng mà DB không có thì **dừng từ trước khi ghi** và báo "không tương thích phiên bản cấu trúc".
- **Bắt buộc có bản sao lưu dự phòng**: `_run_supabase_dump()` (tách từ worker cũ để dùng lại) nạp vào `pre_restore_<timestamp>.sql`. Nếu sao lưu này thất bại thì **hủy toàn bộ thao tác, không ghi một dòng nào**.
- **Xác nhận hai bước**: hộp thoại liệt kê số bảng sẽ phục hồi, số bảng sẽ bị làm trống, cảnh báo ứng dụng web tạm thời không truy vấn được; sau đó phải **gõ đúng chữ `NAP`**.
- Timeout nâng từ 300s → 900s (thời gian đo thực tế cho file 70MB là **18s**).

## Tuân thủ kiến trúc phân hệ

Tính năng này nằm ở tầng công cụ desktop, thao tác toàn bộ CSDL nên **không liên quan cờ module** và không đi qua lớp lọc `system_code`. Nó cũng **không đụng** tới mã nguồn ứng dụng của phân hệ Kho Đông Lạnh. Rủi ro tương thích ngược nằm ở chính CSDL, và đã được đưa về 0 bằng: transaction đơn + rollback + bản sao lưu `pre_restore_*` bắt buộc.

## Kết quả xác minh

| Kiểm tra | Kết quả |
|---|---|
| Cú pháp `server_launcher.py` | `py_compile` OK |
| Nạp file 70MB vào DB trống đúng cấu trúc | 18s, **92/92 bảng**, khớp 100% ảnh chụp 12:20 (137.501 dòng) |
| Nạp **lặp lại** vào DB đang bẩn (master_tags=32) | trở về **16**, toàn bộ 92 bảng **khớp lại ảnh chụp 12:20** → hội tụ và lặp lại bao nhiêu lần cũng cho cùng kết quả |
| Cố tình chèn câu lệnh sai giữa dòng | `MA_EXIT=3`, diff số dòng **không đổi một dòng nào** → rollback hoàn toàn |
| `auth.users` (56 tài khoản) + `identities` + `sessions` | có trong backup và nạp đủ → phục hồi xong **vẫn đăng nhập được** |
| DB thật `postgres` sau toàn bộ test | diff 92/92 bảng **trước/sau giống hệt** — không một dòng bị chạm |

Toàn bộ test chạy trong database tạm `wms_restoretest` (đã `DROP` sau khi xong), tách biệt hoàn toàn với database `postgres` mà ứng dụng đang dùng.

## Hạn chế còn mở (chưa làm, cần người dùng quyết)

1. **Ảnh nghiệp vụ KHÔNG nằm trên máy này — mà nằm ở Google Drive.** Kiểm tra thực tế: toàn bộ 129 dòng `product_media.url` đều có dạng `https://lh3.googleusercontent.com/d/<fileId>` (link công khai Google Drive), và `/api/upload` đẩy file thẳng sang Drive bằng `googleapis`. Nghĩa là `.sql` backup chỉ giữ được **cái URL**, còn **file ảnh thật thì không có ở đâu trên máy để mà backup**. Mất quyền truy cập tài khoản Drive = gãy toàn bộ ảnh, dù phục hồi CSDL hoàn hảo.
2. **Đính chính cho nhận định trước đó:** tôi từng viết "byte ảnh thật nằm ở Docker volume `supabase_storage_anywarehouse`". **Sai.** Volume này rỗng: `STORAGE_BACKEND=file`, `FILE_STORAGE_BACKEND_PATH=/mnt`, nhưng `/mnt` chỉ chứa thư mục `stub` không, và `find` toàn bộ filesystem container không ra file ảnh nào. 5 dòng `logo_*.png` trong `storage.objects` (bucket `company-assets`) là **metadata mồ côi — byte đã mất từ trước**, không khôi phục được. Bucket `note-attachments` có 0 object. Vì vậy ý tưởng "tar volume storage để backup ảnh" là **vô ích**, đã rút lại.
3. **Vì sao không "phục hồi Docker" thay cho phục hồi CSDL:** volume `supabase_db_anywarehouse` đúng là chứa toàn bộ PGDATA (508MB, nhiều hơn cả file `.sql` vì gồm cả schema và role). Nhưng **không được phép sao chép PGDATA lúc Postgres đang chạy** — server ghi file liên tục nên bản tar sẽ bất nhất và thường không khởi động được. Muốn an toàn phải dừng hệ thống (đang phục vụ nhà máy) hoặc dùng `pg_basebackup`. `pg_dump` tồn tại chính vì lý do đó: nó đọc qua MVCC snapshot nên chạy được lúc hệ thống vẫn ghi. Kèm nữa là restore volume đòi đúng version Postgres, còn `.sql` thì nạp lên bản mới hơn được.
4. **Chưa thử trên UI thật:** các hộp thoại Tkinter (kiểm tra tiền đề, xác nhận gõ `NAP`, thông báo lỗi) chưa được bấm thử vì agent không chạy được GUI tương tác. Phần logic SQL và cơ chế phát hiện lỗi đã xác minh độc lập qua `psql`.


---

# Walkthrough (tiếp): Sửa `NAP_DULIEU.bat` theo cùng chiến lược

`NAP_DULIEU.bat` là đường vào thứ hai, độc lập với GUI, mang nguyên 3 lỗi gốc đã mô tả ở trên (không `TRUNCATE`, không `ON_ERROR_STOP`, không transaction) — nghĩa là vẫn có thể gây "báo thành công nhưng dữ liệu trộn" và nhân đôi `master_tags`.

## Cách triển khai trong môi trường batch

Không thể gọi code Python, nên toàn bộ phần động được đẩy xuống `psql`:

- **Sinh câu `TRUNCATE` bằng chính PostgreSQL**: một truy vấn `string_agg(quote_ident(nspname)||'.'||quote_ident(relname), ', ')` trên `pg_class`/`pg_namespace` lọc `public`/`auth`/`storage`, `relkind in ('r','p')`, loại trừ `auth.schema_migrations` và `storage.migrations`. Kết quả là **một dòng SQL duy nhất** liệt kê 130 bảng, không cần khối `DO $$ ... $$` (tránh vấn đề escape `$` và xuống dòng trong file .bat).
- **Nối preamble với file backup bằng `type f1 f2`** rồi đưa qua pipe vào `docker exec -i ... psql`, để preamble và dữ liệu đi vào **cùng một phiên** và nhờ `--single-transaction` thành **cùng một giao dịch**.
- **Phán quyết bằng hai điều kiện**, không chỉ mã thoát: `ERRORLEVEL` khác 0 **hoặc** `findstr /m /c:"ERROR:"` tìm thấy lỗi trong stderr. Dùng `findstr` trên chuỗi `ERROR:` chứ không kiểm tra "stderr có nội dung" vì `type` nhiều file có in tên file lẫn vào stderr.
- **Bắt buộc sao lưu dự phòng trước khi ghi**: `npx supabase db dump --local --data-only -f backups\pre_restore_<ts>.sql`; nếu không tạo được file thì dừng, không ghi gì.
- **Xác nhận bằng cách gõ `NAP`** kèm cảnh báo liệt kê rõ những gì sẽ bị xóa.
- Timestamp dùng `powershell Get-Date -Format yyyyMMdd_HHmmss` thay `wmic` (lệnh này đã bị gỡ trên Windows mới).

## Kết quả xác minh (chạy thật trên database tạm)

Toàn bộ test chạy trên `wms_restoretest`; DB thật `postgres` chỉ bị đọc.

| Kiểm tra | Kết quả |
|---|---|
| Câu truy vấn sinh `TRUNCATE` | ra đúng 1 dòng, liệt kê 130 bảng, **không** chứa `auth.schema_migrations` / `storage.migrations` |
| `type _p.sql backup.sql` có nối trung thực 70MB không | **md5 khớp chính xác** với `cat` (70.594.972 byte) → không mất byte, không thiếu newline nối file |
| Pipeline `type \| docker exec psql -v ON_ERROR_STOP=1 --single-transaction` | exit 0, 0 lỗi; sandbox đang có **125 dòng `units`** (75 thật + 50 dữ liệu giả gài thêm) → còn đúng **75** |
| Đối chiếu cả 92 bảng sau phục hồi | **khớp 100%** ảnh chụp 12:20, không bảng nào bị nhân đôi |
| Đường dẫn thất bại (chèn câu SQL sai vào cuối stream) | exit 3, stderr có dòng bắt đầu bằng `ERROR:` → `findstr` bắt được; diff 92 bảng **không đổi một dòng nào** → rollback sạch |
| DB thật sau toàn bộ test | diff 92/92 bảng trước/sau **giống hệt** |

Sandbox `wms_restoretest` và các file tạm (`_p.sql`, `_bad.sql`, bản sao test .bat) đã bị xóa sau khi nghiệm thu.

**Ghi chú phạm vi:** việc kiểm thử nghiệm thu .bat được thực thi bằng cách chạy trực tiếp từng lệnh mà .bat sinh ra (lớp bảo mật của agent chặn việc chạy cả file .bat tương tác). Cụ thể, `cmd //c <file>.bat` bị classifier từ chối, nên logic SQL, phát hiện lỗi và tính an toàn đã xác minh đầy đủ qua từng lệnh rời rạc; phần cú pháp batch thuần túy — `setlocal enabledelayedexpansion`, `set /p`, `call :CLEANUP`, nhánh `if` — chưa chạy nguyên bản.

Ngoài ra **không thể** kiểm tra `type "file1" "file2"` (dạng có dấu nháy kép quanh đường dẫn) thông qua Git Bash: lớp truyền tham số của MSYS escape dấu nháy thành `\"`, khiến cmd nhận về đường dẫn bắt đầu bằng backslash và báo "The system cannot find the path specified". Chẩn đoán bằng `cmd /c 'echo "hello world"'` cho ra `\"hello world\"`. Đây là giới hạn của công cụ test, **không phải lỗi của file .bat** — trong file .bat, cmd tự đọc dòng lệnh từ script nên `type "%PRE_SQL%" "%SQLFILE%"` là cú pháp chuẩn. Dạng không dấu nháy đã được chứng minh nối trung thực bằng md5 ở bảng trên.

---

# Walkthrough: Tự động đối chiếu số dòng sau khi NẠP / PHỤC HỒI CSDL

**Phát sinh từ yêu cầu của người dùng:** *"dữ liệu quá nhiều tôi không biết nạp dữ liệu xong nó có lệch ko nữa"*.
CDB thật có **132 bảng / 138.528 dòng**. Con người không thể kiểm tra bằng mắt, nên chức năng phải **tự kiểm chứng** và tự báo "lệch ở đâu".

## Vấn đề còn sót sau bản sửa trước
Bản sửa trước đã đảm bảo *"nạp thất bại thì rollback sạch, CSDL nguyên trạng"*. Nhưng nó chỉ trả lời được câu hỏi **"nạp có chạy hết không"**, không trả lời được **"nạp xong dữ liệu có đúng như file backup không"**. Một file backup bị cắt cụt giữa chừng, hoặc thiếu bảng do đổi schema, vẫn có thể được psql nạp "thành công" với nội dung ít hơn file gốc.

## Thiết kế
Nguyên tắc: **lấy con số kỳ vọng từ chính file backup, không tin lời psql.**

1. `_parse_backup_tables()` (trước đây chỉ trả về *danh sách tên bảng*) nâng cấp thành trả về **`{tên_bảng: số_dòng_kỳ_vọng}`**.
   Cơ sở: `pg_dump --data-only` viết mỗi bảng thành **một câu `INSERT` nhiều dòng**, mỗi dòng dữ liệu nằm trên một dòng **bắt đầu bằng TAB**. Đếm TAB giữa hai dấu `;` là ra số dòng thật của bảng đó, không cần chạy SQL.
2. `_verify_restore(expected, wipe_tables)` sinh **một câu SQL duy nhất** dạng `UNION ALL` các `select '<bảng>' as tbl, count(*) from "s"."t"` cho **toàn bộ bảng liên quan** (bảng có trong backup **∪** bảng bị TRUNCATE), chạy qua `docker exec ... psql -t -A -F "|"`, rồi so từng bảng một.
   - Bảng bị TRUNCATE mà file backup **không** có `INSERT` → kỳ vọng = 0 (đúng semantics "đã làm trống và không ghi lại").
   - Nếu câu đếm lỗi (returncode ≠ 0) → trả về bản ghi lệch `"? - không đếm được: ..."`. **Tuyệt đối không im lặng báo thành công.**
3. Messagebox phân làm hai nhánh: khớp tuyệt đối (info, nêu số bảng + số dòng) và **LỆCH** (warning, liệt kê tối đa 12 bảng "kỳ vọng X, thực tế Y" + nhắc rằng `pre_restore_*.sql` sinh ra ngay trước đó có thể hoàn tác).

## Nghiệm thu bằng số liệu thật (chỉ SELECT, không ghi một byte nào)

| Phép kiểm chứng | Kết quả đo được |
|---|---|
| `py_compile server_launcher.py` sau 4 bản sửa | OK |
| Bộ đếm dòng đọc `backup_supabase_20261029_213617.sql` | **92 bảng / 138.528 dòng**; riêng `public.lots`=11.900, `public.audit_logs`=47.921, `auth.users`=56, `public.master_tags`=16, `public.positions`=7.940 — **khớp từng con số** với CSDL thật đã đo độc lập trước đó |
| Danh sách TRUNCATE từ CSDL thật | 132 bảng trong 3 schema nghiệp vụ → 130 bảng sau khi loại 2 bảng được bảo vệ |
| Câu `UNION ALL` đếm 130 bảng do `_verify_restore` sinh ra | psql exit 0, **tổng thực tế 138.528 == tổng kỳ vọng 138.528, 0 bảng lệch** |
| 38 bảng bị TRUNCATE mà file backup không có `INSERT` (`auth.mfa_*`, `auth.oauth_*`, `auth.sso_*`, `auth.webauthn_*`, `public.bank_outbound_*`, `public.construction_*`, `public.handover_records`, …) | thực tế **0 dòng = kỳ vọng 0** → xác nhận chúng thật sự trống, không phải bị nạp thiếu |
| **Test phủ định** (cố tình khai sai kỳ vọng để chứng minh bộ kiểm chứng biết bắt lỗi) | tiêm 3 lỗi → **cả 3 bị phát hiện đúng**: `auth.users: kỳ vọng 3, thực tế 56` · `public.lots: kỳ vọng 11895, thực tế 11900` · `public.positions: kỳ vọng 0, thực tế 7940`. Tổng kỳ vọng tụt xuống 130.530 trong khi thực tế vẫn 138.528 |

## Tuân thủ kiến trúc phân hệ
Chỉ tác động ở tầng CSDL trong launcher desktop, không đụng code ứng dụng Next.js, không đổi schema, không thêm cột → **không có đường nào ảnh hưởng Phân hệ Kho Đông Lạnh**, không hardcode mã kho, không cần module flag.

## Hạn chế còn mở (nói rõ để không hiểu lầm mức bảo đảm)
- Bộ kiểm chứng so **số dòng từng bảng**, không so **nội dung từng dòng**. Lệch nội dung (ví dụ một giá trị tiền bị sửa sai trong file backup) sẽ **không** bị phát hiện. Muốn chặt hơn nữa thì phải so hash/md5 toàn bộ bảng, đổi lấy chi phí thời gian trên 138k dòng.
- Luồng GUI đầy đủ (hộp thoại xác nhận → gõ `NAP` → thread chạy → messagebox kết quả) **chưa từng được bấm thật**, vì launcher đang chạy (PID cũ) vẫn giữ code trong bộ nhớ. Người dùng cần khởi động lại qua `CHAY_SERVER.bat` rồi nạp lại `backup_supabase_20261029_213617.sql` (file này đã đo là khớp 100% với CSDL hiện hành, nên nghiệp vụ nạp lại nó là "không đổi nội dung" — rủi ro gần bằng 0).
- `NAP_DULIEU.bat` **chưa có** bước đối chiếu tự động này (mới chỉ có ở launcher). Nó vẫn dừng an toàn khi nạp lỗi, nhưng sau khi nạp thành công thì chưa in bảng đối chiếu.
- Một tác dụng phụ khi test: in tiếng Việt ra console Windows mặc định (cp1252) sẽ `UnicodeEncodeError`. Đây là lỗi của script test, **không phải của launcher** — `ServerManagerGUI.log()` chỉ ghi vào widget Tkinter, toàn file không có `print()` hay `sys.stdout` nào.

---

# Walkthrough: Chế độ "Nén để chuyển máy" (mã nguồn + ảnh chụp CSDL + checklist)

**Bối cảnh:** người dùng nói sẽ test chức năng phục hồi *bằng đúng việc nén dự án rồi giải nén sang máy khác* — mục đích thật là **chuyển máy chủ chứa dự án**. Đo đạc trước khi viết code cho thấy cách nén hiện tại **không thể** dùng cho việc đó.

## 4 sự thật đo được (không suy đoán)

| Điều kiểm tra | Kết quả đo |
|---|---|
| CSDL nằm ở đâu | Docker volume `supabase_db_anywarehouse` — **ngoài** thư mục dự án. `pg_database_size` = **110 MB**, 138.528 dòng |
| Hai lối nén hiện có có mang theo dữ liệu không | **Không.** Cả `NEN_TOAN_BO_DU_AN.bat` và `_pack_project_for_drive_worker` (`server_launcher.py`) đều có `-x"backups\*"` → 2 file dump 70/71 MB cũng bị loại |
| Key Supabase Local có thuộc về thư mục dự án không | **Không.** `config.toml` chỉ có `project_id`; `.temp/start-secrets` **rỗng 0 byte**; `pg_db_role_setting` của cả 10 role **không** có mục jwt nào; secret thật là chuỗi **ngẫu nhiên 55 ký tự** cấp vào container lúc `supabase start` → máy mới sinh key khác, `.env.local` cũ gây **401 toàn hệ thống** |
| `.env.local` có bị nén ZIP của PowerShell bỏ sót không | **Không.** Thuộc tính = `Archive` (Windows không đặt Hidden cho file chấm đầu tên) → cả 2 nhánh nén đều lấy được |

## Đã viết

**1. `server_launcher.py`**
- `build_migration_checklist_text(...)` — hàm cấp module, sinh nội dung `CHECKLIST_CHUYEN_MAY.txt`. Đặt ở cấp module (không phải method) để **cả launcher lẫn .bat dùng chung một văn bản**, và để test được không cần mở GUI.
- `_pg_image_tag()` — đọc `docker inspect ... {{.Config.Image}}` để ghi đúng version image PostgreSQL vào checklist (`public.ecr.aws/supabase/postgres:17.6.1.063`).
- `pack_project_for_migration()` + `_pack_project_for_migration_worker()` — 3 bước: **(1)** dump bắt buộc qua `_run_supabase_dump` (thất bại thì **dừng, không tạo gói**, vì gói không có dữ liệu thì vô nghĩa) → đếm trước số bảng/số dòng bằng `_parse_backup_tables` → **(2)** ghi checklist **trước khi** nén để nó nằm trong gói → nén RAR với bộ loại trừ mới, hoặc PowerShell ZIP nếu thiếu WinRAR → **(3)** ghi lại checklist lần cuối kèm dung lượng thật.
- Nút mới `🚚 NÉN ĐỂ CHUYỂN MÁY (KÈM CSDL)` ở hàng riêng; dùng chung cờ `is_archiving_project` và **khoá cả hai nút** khi đang chạy để không tự nén chồng lên nhau.
- Bộ loại trừ mới: `-x"backups\*.rar" -x"backups\*.zip" -x"backups\.tmp.driveupload*" -x"dist_installer\*" -x".next\*"` → **giữ** `.sql`, bỏ archive cũ để tránh nén lồng nén. Giữ nguyên `-r -s -m3 -ep1` đã được chứng minh bằng file RAR 455 MB đang dùng.

**2. `tao_checklist_chuyen_may.py`** — CLI mỏng: `python tao_checklist_chuyen_may.py <gói_nén> <ảnh_CSDL> <image_pg> [file_txt]`, **import thẳng** `build_migration_checklist_text` và `_parse_backup_tables` từ launcher (không sao chép bộ đếm) để hai lối không thể báo hai con số khác nhau.

**3. `CHUYEN_MAY.bat`** — cùng trình tự cho người không dùng GUI: kiểm container → `npx.cmd supabase db dump --local --data-only` → `docker inspect` lấy image → ghi checklist → RAR → cập nhật checklist bằng dung lượng thật. ASCII thuần để không phụ thuộc codepage, CRLF (94 dòng, 0 LF trần).

## Nghiệm thu

| Phép kiểm | Kết quả |
|---|---|
| `py_compile` cả `server_launcher.py` và `tao_checklist_chuyen_may.py` | OK |
| `build_migration_checklist_text()` render với số thật | 72 dòng text, `Tổng số dòng: 138,528`, đúng image PG, đường dẫn `backups\...` hiển thị đúng |
| Chạy CLI thật trên dump `backup_supabase_20261029_213617.sql` | in ra `92 bang co du lieu, 138528 dong` — **khớp** con số đo từ CSDL thật ở mục trước |
| **Bằng chứng WinRAR thật** với bộ loại trừ mới (cây thư mục giả trong TEMP) | `backups\migration_dump_1.sql` **CÓ** vào archive; `ModularWMS_Full_old.rar`, `old.zip`, `dist_installer\a.txt`, `.next\b.txt` **BỊ loại**; `-ep1` **giữ nguyên đường dẫn tương đối** `backups\...` → câu hướng dẫn "ảnh CSDL nằm trong `backups\` sau khi giải nén" là đúng |
| Nhánh PowerShell ZIP (chạy bằng file `.ps1`, kiểm danh sách entry) | `root=2 data=2`, entry gồm `src\main.ts` + `migration_dump_1.sql` + `CHECKLIST_CHUYEN_MAY.txt`; **2 file dữ liệu bị làm phẳng ra gốc zip** → checklist đã ghi rõ khác biệt này (`.rar` → `backups\`, `.zip` → gốc) |
| `powershell Get-Date -Format yyyyMMdd_HHmmss` | ra `20261029_223339` **kèm CR** → thêm `set "TS=!TS:~0,15!"` cắt đúng 15 ký tự, và `argv[3].strip()` ở phía Python |
| Cột `pg_db_role_setting` | 10 role, **0** mục tên `pgrst.jwt_secret` → loại trừ khả năng secret nằm trong DB cluster dưới dạng role setting |

## Tuân thủ kiến trúc phân hệ
Toàn bộ nằm ở tầng launcher desktop / script Windows: **không sửa một dòng nào** trong `src/`, không đụng schema, không thêm cột, không hardcode mã kho, không cần `hasModule`. Phân hệ Kho Đông Lạnh không có đường bị ảnh hưởng. Checklist cũng **dặn** bước kiểm tra cuối là mở từng phân hệ và xác nhận module bật/tắt còn nguyên.

## Hạn chế còn mở
- **Chưa từng bấm nút thật.** Launcher đang chạy vẫn giữ code cũ trong bộ nhớ (`pythonw` cache `server_launcher.py`) → phải khởi động lại qua `CHAY_SERVER.bat`. Các file `ServerManager.exe` và bộ cài `Setup_ModularWMS_AllInOne_v1.0.exe` là bản đóng gói **cũ**, không có các hàm mới.
- `CHUYEN_MAY.bat` **chưa chạy nguyên file lần nào**: lớp bảo mật của agent chặn `cmd //c <file>.bat`. Từng lệnh bên trong đã được chạy rời rạc và chứng minh đúng (dump, `docker inspect`, RAR với bộ loại trừ, Python CLI); cú pháp batch thuần (`setlocal enabledelayedexpansion`, `for /f usebackq`, `if errorlevel`) chưa kiểm chứng ở dạng cả file.
- Chưa đo thời gian/dung lượng gói thật (node_modules 1,2 GB + 2 ảnh SQL 70 MB) → mới chỉ ước lượng 10–20 phút dựa trên gói 455 MB đã có.
- Nhánh ZIP chỉ xét `out_file.exists()` + size, **không** dò dòng `ERROR:` trong stderr như nhánh RAR. `Compress-Archive` chết giữa chừng có thể để lại file dở và checklist vẫn in dung lượng của file dở đó. Điểm tựa còn lại: sau khi nạp ở máy mới, bước đối chiếu 130 bảng / 138.528 dòng sẽ lộ ra ngay nếu gói thiếu dữ liệu.
- Nếu người dùng muốn **giữ nguyên key** để khỏi dán lại `.env.local`: chỉ có phương án bê Docker volume (đã ghi trong checklist), chưa được test trên máy thứ hai.

---

# Walkthrough: Khung nhật ký bị ép còn non một dòng

**Phàn nàn của người dùng:** *"khung nhật ký giờ ngắn quá ko đọc được gì"* (kèm ảnh chụp chỉ thấy đúng 1 dòng log).

## Nguyên nhân thật (đo bằng Tkinter, không đoán)
Đo bằng cách dựng `ServerManagerGUI` thật với `alpha=0` rồi đọc `winfo_width/height` và `winfo_reqwidth/reqheight` của từng widget:

1. **Cửa sổ cứng nhắc 900x780 trên màn hình 1280x720.** `geometry("900x780")` không tính thanh title (~31px) và taskbar (~48px) → đáy cửa sổ nằm **khuất sau taskbar**, phần bị cắt đúng là khung nhật ký.
2. **Bảng nút chiếm hết chiều dọc.** 15 nút xếp 2 cột = **8 hàng**, `top_grid` ngốn **332px**; cộng header 76px + padding → `main_container` *xin* 601px trong khi chỉ còn 574px → widget cuối cùng (nhật ký) bị pack cắt xuống **155px**, và vì cửa sổ còn tràn màn hình nên thực tế chỉ còn ~1 dòng.
3. Nút mới "🚚 NÉN ĐỂ CHUYỂN MÁY" mà tôi thêm ở mục trước **làm nặng thêm** đúng 1 hàng (~34px) — đây là lỗi dây chuyền do tôi gây ra.

## Đã sửa
- **Tự bám theo màn hình:** `win_w = max(1000, min(1260, sw-24))`, `win_h = max(600, min(900, sh-100))`, đặt tại `+x+8`. Số 100px là thanh title + taskbar; nếu cho cửa sổ cao bằng màn hình thì đáy nhật ký vẫn khuất.
- **15 nút → lưới 3 cột × 5 hàng** (`grid` + `columnconfigure(uniform)`), thay cho 8 hàng `pack`.
- **Thẻ truy cập nhanh chuyển sang cột phải** (`right_col`) và tự co thành **3 cột × 2 hàng**, trả lại ~90px chiều dọc toàn bề ngang cho nhật ký.
- `actions_card` đổi sang `fill=Y` **không expand** → giữ đúng bề rộng tự nhiên, nút dài nhất không bị cắt chữ; cột phải nhận phần còn lại.
- Giảm padding thuần: header `pady 12→6`, `main_container 12→8`, `status_card 12→8`, `links_card 10→8`, `logs_card 10→6`.
- `log_text` khai báo `height=12` để request của nó nhỏ hơn phần được chia (tránh tình trạng xin 182px nhưng chỉ được 155px).

## Nghiệm thu (đo lại bằng đúng script dựng GUI)

| Chỉ số | Trước | Sau |
|---|---|---|
| Kích thước cửa sổ trên màn 1280x720 | 900x780 (**tràn màn hình**) | 1256x620, đỉnh y=8 |
| Đáy cửa sổ + title bar | ~811px / 720px → **khuất sau taskbar** | **659px / 720px** → còn hở 61px |
| `top_grid` chiếm chiều dọc | 332px | 289px |
| Khung nhật ký | 155px (~1 dòng thấy được) | **196px ≈ 13 dòng Consolas 9**, rộng 1177px |
| Widget bị cắt (`alloc < req`) | — | **0** |
| `py_compile` | — | OK |
| Tham chiếu frame cũ còn sót (`btn_launch_row`, `btn_db_row`, `links_row`…) | — | **0** |
| Mọi `self.btn_*` vẫn được gán đúng 1 lần | — | **đúng** |

## Tuân thủ kiến trúc phân hệ
Thuần giao diện Tkinter của launcher: không đụng `src/`, không đụng schema, không liên quan `hasModule` hay mã kho → Kho Đông Lạnh không bị ảnh hưởng.

## Hạn chế còn mở
- Số dòng thấy được tỉ lệ nghịch với độ cao màn hình. Trên màn 720p là **13 dòng**; máy 1080p sẽ được ~20 dòng vì `win_h` bị chặn ở 900.
- Chưa có nút "phóng to nhật ký" (ẩn bảng điều khiển để nhật ký chiếm toàn cửa sổ) — để ngỏ, hỏi người dùng trước khi làm.
- Ảnh chụp màn hình của người dùng là bản **launcher cũ đang chạy**; phải khởi động lại qua `CHAY_SERVER.bat` mới thấy bố cục mới.
