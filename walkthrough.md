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

## 🔧 Vòng 2 — Đối chiếu lệch số liệu với tab Tồn theo LOT (30/10/2026)

Người dùng phát hiện file Excel báo cáo tuổi ra **9.213 Thùng** cho SKU `TP101020104.002`, trong khi `/inventory` → tab Tồn theo LOT ra **8.152**. psql chỉ ra cả hai đều "đúng theo luật riêng", lệch nhau đúng 2 quy tắc:

| Thành phần | Thùng |
|---|---|
| Tổng `lot_items.quantity` mọi LOT `active` (báo cáo tuổi, chế độ Tất cả chi nhánh) | **9.213** |
| …thuộc chi nhánh `CN Cư M'gar` | 8.163 |
| …thuộc 35 LOT **bỏ trống `warehouse_name`** → `/inventory` đang lọc chi nhánh nên không thấy | 1.050 |
| LOT nằm ở **ô vị trí lẻ đã ĐÓNG** (`systems.modules.loose_positions[id].isClosed`) | 11 |
| Tab Tồn theo LOT hiển thị (8.163 − 11) | **8.152** ✓ |

**Đã sửa:** báo cáo tuổi nay áp **cùng quy tắc ô lẻ đang đóng** với tab Tồn theo LOT:
- Đọc `systems.modules.loose_positions` của phân hệ (đúng `.eq('code', sysCode)`), lập `closedLooseLots` là tập LOT có **ít nhất một** vị trí nằm trong ô đã đóng — giống hệt `lot.positions.some(...)` ở [useInventoryByLot.ts:452](file:///d:/chanh%20thu/web/src/components/inventory/by-lot/useInventoryByLot.ts#L452).
- Mặc định **ẩn** các LOT đó, kèm checkbox **"Xem cả ô lẻ đang đóng (N LOT)"** ngay cạnh checkbox "Hiển thị LOT chưa có …" — cùng nhãn/cùng ý nghĩa với [InventoryFilters.tsx:190](file:///d:/chanh%20thu/web/src/components/inventory/by-lot/InventoryFilters.tsx#L190).
- Bộ lọc đặt ở `filteredLines` **trước** khi `summarizeByLot` / `summarizeByProduct` / `computeStats`, nên thẻ tổng quan, bảng và file Excel cùng trừ một con số — không còn cảnh Excel 9.213 còn màn hình 9.202.
- Phân hệ không dùng ô vị trí lẻ → `loose_positions` rỗng → tập LOT bị ẩn rỗng, hành vi giữ nguyên 100%.

**Chênh lệch chi nhánh còn lại (1.050 thùng) là do trạng thái bộ lọc, không phải lỗi:** `/inventory` đang chọn chi nhánh `CN Cư M'gar`, báo cáo tuổi xuất file ở "Tất cả kho/chi nhánh" (trong đó có 35 LOT không ghi `warehouse_name`). Kiểm chứng chéo: chọn chi nhánh "Tất cả" tại `/inventory` → tab Tồn theo LOT ra **9.202** = 9.213 − 11.

**Kiểm chứng vòng 2:** `npx tsc --noEmit` sạch trên file sửa; `npx next build` exit 0; psql xác nhận đúng 1 LOT của SKU này (11 thùng) nằm trên ô đã đóng, và 8.163 − 11 = 8.152 khớp số người dùng nhìn thấy.

**Đã xử lý dữ liệu (30/10/2026):** kiểm tra toàn bộ phân hệ cho thấy **45 LOT `active` + 1 LOT `exported`** của Kho Đông Lạnh bị trống `warehouse_name` (1.350 thùng), **100% mang `metadata.pallet_tag` + `box_count`** → sinh ra từ màn **Kho kiện** (`PalletsPageContent.tsx:2065` dựng `lotPayload` không có khóa `warehouse_name`, khác `LotForm.tsx:1138` luôn gán chi nhánh `is_default`). Người dùng duyệt **backfill**: 46 LOT này đã được gán lại chi nhánh mặc định lấy từ bảng `branches` (`CN Cư M'gar`, `is_default = true`) — không hardcode trong câu lệnh, có điều kiện chặn nếu phân hệ có ≠1 chi nhánh mặc định. Sau backfill: 0 LOT trống chi nhánh, SKU `TP101020104.002` = 9.213 thùng đều thuộc `CN Cư M'gar`. Danh sách gốc + rollback: `lot_warehouse_backfill_20261030.csv` và `rollback_lot_warehouse_backfill_20261030.sql` (ngoài repo, trong `~/.qoder/tmp`).

**Còn mở (người dùng chủ đích chưa làm):** sửa `PalletsPageContent` để chặn nguồn sinh LOT thiếu chi nhánh, và bỏ hardcode `"CN Cư M'gar"` ở `RecreateLotModal.tsx:112`. ⚠️ Chứng nào màn Kho kiện còn thiếu `warehouse_name` thì LOT mới vẫn tiếp tục trống chi nhánh và khoảng lệch sẽ tái sinh.

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

# Walkthrough: Kiểm toán toàn bộ tính năng còn lại của `server_launcher.py` (F1–F7) + 3 chức năng mới (A1–A3)

## 🎯 Bối cảnh
Người dùng yêu cầu: *"kiểm tra thêm các tính năng còn lại có cần sửa cái nào không, hoặc bạn thấy cần chức năng gì nữa thì cứ thêm giúp tôi"*. Phạm vi lần này là **launcher desktop** (`server_launcher.py`, ~2.9k dòng Tkinter), không đụng `src/` của web app.

## 🔴 F1 — Ghi `config.yml` của Cloudflare Tunnel: từ "sửa chuỗi + ghi đè" sang ghi an toàn
Lỗi cũ: mọi thao tác bật/tắt/xóa/thêm tên miền chỉ `content.replace(...)` rồi ghi thẳng. Một chuỗi con gặp nhiều chỗ là sửa nhầm sang tên miền khác; file hỏng thì mất luôn cấu hình đang chạy.

Sửa:
- `write_tunnel_config()` backup `config.yml.bak_<stamp>` (giữ 5 bản gần nhất), ghi ra `.new.tmp`, **chặn bằng PyYAML trước khi `os.replace`** (`_tunnel_yaml_usable`: phải có `ingress` dạng list), chỉ thay file khi YAML còn hợp lệ; dọn file tạm khi lỗi.
- `_walk_ingress_lines()` + `_hostname_matches()` khớp theo **ranh giới dấu chấm** → `thu.click` không thể ăn nhầm `chanhthu.click`; `_comment_belongs_to_domain()` lấy domain nguyên token bằng regex thay vì tìm chuỗi con.
- `toggle_domain_status` / `delete_domain_from_tunnel` đếm số dòng thực sự đổi, **không ghi nếu không có gì thay đổi**, và **đọc lại file để xác nhận** trước khi báo thành công.
- `add_domain_to_tunnel` trước đây tự tính đường dẫn config riêng → **đó là gốc rễ vụ nhiễm file thật** (xem mục ⚠️). Nay đi qua `get_tunnel_config_targets()`, strip `:port`, validate domain bằng `re.fullmatch`, và cảnh báo `.local` (Chrome không resolve mDNS).
- `_insert_domain_rules()` chỉ thế chỗ **catch-all cuối cùng** và thừa hưởng thụt lề của nó; hết `ingress` thì lấy thụt lề từ `- hostname:` đầu tiên — bản cũ append ở thụt lề 0, tạo YAML hỏng (chính bộ chặn PyYAML bắt được).
- `read_tunnel_domains()` bỏ luôn **fallback hardcode** `[{chanhthu.click: True}, {sarita.click: True}]` — đọc không được file thì báo lỗi, không bịa trạng thái.

## 🟠 F2 — Worker `CHẠY HỆ THỐNG` / `DỪNG TẤT CẢ`
- Cờ `is_starting_all`/`is_stopping_all` nay nhả trong `finally` (trước đây nếu một bước raise là cờ kẹt vĩnh viễn → nút bấm không phản hồi nữa, phải mở lại launcher).
- Không còn in "HỆ THỐNG ĐÃ SẴN SÀNG" khi có bước lỗi; `_log_start_summary()` liệt kê từng bước OK/FAIL và chỉ tên các tên miền **thực sự có trong config**.
- `_ensure_tunnel_running()` thăm 6 giây và báo đúng "cloudflared đã chết" thay vì mặc định báo "✅ đã kết nối!".
- `_stop_all_steps()` dùng `taskkill /T` theo PID (trước đây `taskkill /IM cloudflared.exe` giết **mọi** tiến trình cloudflared, kể cả của việc khác) và nghiệm thu bằng cách kiểm tra **cổng đã đóng thật**.
- `_spawn_logged()` đặt `encoding="utf-8", errors="replace"` cho mọi pipe; `_stream_proc_logs` không còn `except: pass` — mất dòng log giờ in rõ "⚠️ Mất dòng log của dịch vụ này: …".

## 🟡 F3–F7
- **F4 Bộ tối ưu DNS:** hộp thoại cảnh báo trước (áp lên **mọi** network adapter + cách hoàn tác); `ShellExecuteW` từng bị bỏ qua kết quả, nay kiểm tra `≤32` = UAC bị từ chối và nói thẳng; timeout 900s → 40s; nghiệm thu bằng cách **đọc lại** DNS sau khi ghi, không "tuyên bố thành công".
- **F5 `BẬT/TẮT DEV`:** thêm cờ `is_toggling_dev`, chạy ở thread, dùng `wait_ports_open()` để báo "đã lên" chỉ khi :3001 thực sự mở.
- **F6 `kill_process_on_port`:** phân tích cột `netstat -ano` và so **đúng cổng** (bản cũ tìm chuỗi con nên port `3001` có thể dính `13001`).
- **F7 Bác sĩ môi trường:** lỗi DNS hiển thị → "❓ Không kiểm tra được DNS (…)" thay vì đánh dấu đỏ oan; `_doc_log()` chặn `TclError` khi cửa sổ đã bị đóng giữa chừng (đây là nguyên nhân crash log âm thầm); `_install_via_winget` dùng UTF-8 + `CREATE_NO_WINDOW` + watchdog 15 phút + xác minh lại bằng `winget list --id`.
- **Build production:** timeout 300s → 1800s và chỉ báo thành công khi `.next/BUILD_ID` tồn tại (`npx next build` chạy ~8 phút, bản cũ cắt giữa chừng rồi báo lỗi giả).
- **`supabase db dump`:** timeout 180s → 1800s (ảnh chụp 139k dòng mất ~9 phút).
- **Inno Setup:** phát hiện `.exe` không tươi (`st_mtime`) và báo riêng trường hợp ISCC thoát 0 mà không sinh file.
- **`ensure_tunnel_ready()`** trả `(ok, lý do)` và liệt kê từng file copy thất bại — nút đồng bộ không còn báo OK khi thực ra chưa copy gì.

## 🐞 Bug thật tìm thấy khi rà: sao lưu lỗi → `NameError`
`_backup_database_worker` ở nhánh lỗi vẫn ghi `err_msg = res.stderr or res.stdout …`, nhưng biến `res` đã bị xoá khi refactor sang `_run_supabase_dump()`. **Mọi lần sao lưu thất bại đều ném `NameError`** thay vì hiện nguyên nhân. Đã sửa thành dùng `err_msg` trả về, kèm gợi ý kiểm tra cổng 64322.

## ✨ A1 — Nút `🔎 So sánh backup ↔ CSDL` (dry-run, CHỈ ĐỌC)
Người dùng chuyển máy sang máy khác nên cần biết "nạp file này vào thì thay đổi những gì" **trước** khi bấm NẠP (nút đó xoá toàn bộ dữ liệu hiện tại).
- Chọn file `.sql` → `_parse_backup_tables()` đếm số dòng file sẽ sinh ra → `_list_db_tables()` + `_count_db_tables()` đếm số dòng CSDL thật → đối chiếu. **Không TRUNCATE/INSERT/UPDATE nào được phát sinh.**
- Báo cáo 4 loại: bảng CSDL đang thiếu (→ nút NẠP sẽ từ chối, phải migration), bảng lệch số dòng (sắp theo độ lệch giảm dần), bảng **đang có dữ liệu nhưng không có trong file** (nạp vào sẽ thành bảng rỗng ☠️), và kết luận.
- `_count_db_tables()` được tách ra từ `_verify_restore()` để dùng chung; `_verify_restore()` giữ nguyên hành vi đã nghiệm thu trước.
- Đo trên dữ liệu thật: file 67.7 MB / 92 bảng, CSDL 132 bảng → chạy **1.5 giây**, phát hiện đúng 3 bảng lệch (`auth.audit_log_entries +4`, `auth.refresh_tokens +2`, `public.audit_logs +2`) — đều là bảng audit ghi thêm sau 21:36.

## ✨ A2 — Vệ sinh thư mục backup
Mỗi ảnh chụp ~68 MB, tích tụ sẽ ngốn hàng chục GB (và Drive sẽ đồng bộ hết).
- Khi mở launcher và sau mỗi lần sao lưu: in ra **số ảnh chụp, tổng dung lượng, bản mới nhất cách bao nhiêu giờ**; quá 3 ngày thì cảnh báo; thư mục trống thì báo "KHÔNG có gì để phục hồi".
- Nút `🧹 Dọn backup cũ` **không tự xóa**: chỉ liệt kê đúng danh sách file sẽ xóa + dung lượng, yêu cầu xác nhận, luôn giữ `BACKUP_KEEP_COUNT = 14` bản mới nhất. Từ chối hộp thoại ⇒ 0 file bị xoá.

## ✨ A3 — Nút `📤 Lưu nhật ký ra file`
Ghi toàn bộ khung nhật ký ra `.txt` **có BOM UTF-8** (Notepad Windows mới hiển thị đúng dấu) kèm header ngày giờ/tên máy/đường dẫn dự án — để dán cho người khác soi lỗi.

## 📐 Bố cục: 3 nút mới không chiếm hàng nào, khung nhật ký cao thêm 36px
Ba nút mới đặt ở **hàng tiêu đề nhật ký** (vốn đã tồn tại) nên lưới điều khiển vẫn là 3×5. Con số dưới đây **đo bằng script dựng GUI với `alpha=0`** trên đúng màn 1280x720:

| Chỉ số | Trước | Sau |
|---|---|---|
| Cửa sổ | 1256x620 (đáy 628) | 1256x650 (đáy **658**/720, vẫn trên taskbar) |
| `top_grid` (lưới nút + trạng thái + link nhanh) | 289px | **289px (không đổi)** |
| `logs_card` | 241px | 271px |
| Khung nhật ký `Text` | 196px (~13 dòng) | **232px (~15 dòng Consolas 9)**, rộng 1177px |
| Số nút ở hàng tiêu đề | 1 | 4 — đo `winfo_rootx + width` từng nút, tất cả nằm gọn trong cửa sổ, không cắt chữ |

Chiều cao tăng thêm đến từ `win_h = sh - 100` → `sh - 70`. Có thử siết padding của thẻ nút (12→8), khoảng cách nút (3→2) và `top_grid` (10→6) nhưng **đo lại thấy `top_grid` vẫn đúng 289px** — chiều cao vùng đó do cột phải (bảng trạng thái + link nhanh) quyết chứ không phải lưới nút, nên đã **hoàn tác** những chỉnh sửa vô ích, chỉ giữ `win_h` và padding nhỏ bên trong `logs_card`.

## 🧪 Nghiệm thu
- `python -m py_compile server_launcher.py`: **OK**.
- Quét tham chiếu biến mồ côi: mọi `res.stdout/res.stderr` còn lại đều có dòng gán `res` trong cùng hàm.
- Probe F1 (`f1_tunnel_probe.py`, 16 nhóm): **tất cả kiểm qua đạt**, gồm nhóm 16 chốt chặn "probe không được chạm file config thật".
- Probe A1–A3 (19 nhóm, `types.SimpleNamespace` giả lập toàn bộ Tk + DB): **tất cả đạt**. Đáng chú ý: nhóm 10 chứng minh SQL do A1 sinh ra **chỉ là `SELECT count(*)`**, không chứa `truncate/delete/insert/update/drop/alter/create`; nhóm 7 chứng minh prune giữ đúng 14 bản **mới nhất**.
- Smoke GUI `alpha=0`: 25 kiểm tra đạt, `~/.cloudflared/config.yml` **không đổi hash** trước/sau.

## ⚠️ Công khai sự cố: probe từng ghi vào `~/.cloudflared\config.yml` thật
Khi chạy probe F1 lượt đầu, `add_domain_to_tunnel()` tự tính đường dẫn config riêng nên **đi vòng hàm đã bị giả lập**, và ghi thử nghiệm vào đúng file cấu hình đang chạy trên máy. Đã:
1. So sánh từng dòng với template `tunnel_setup/config.yml` để chứng minh **chỉ phần probe thêm vào, không mất rule hợp lệ nào**;
2. Khôi phục file về nguyên trạng (đã kiểm hash, hiện là `98370d57…cd72`, chạy probe lại nhiều lần vẫn nguyên);
3. Giữ bản nhiễm làm bằng chứng tại `~/.cloudflared\config.yml.probe_contaminated_20261029_230633`;
4. Sửa cấu trúc (đi qua `get_tunnel_config_targets()`) + thêm nhóm 16 vào probe để không tái diễn.

## 🔁 Việc người dùng cần làm
Launcher đang chạy bằng `pythonw` tiến trình cũ vẫn giữ **mã cũ trong RAM**. Phải đóng hẳn rồi khởi động lại qua `CHAY_SERVER.bat` (bản `.exe` đóng gói càng không tự cập nhật) mới thấy 3 nút mới và bố cục mới.

## Tuân thủ kiến trúc phân hệ
Toàn bộ thay đổi nằm trong launcher (Tkinter + Docker/psql/cloudflared). Không sửa `src/`, không đổi schema, không đụng `hasModule`, không hardcode mã kho nào ⇒ **Kho Đông Lạnh không bị ảnh hưởng**; `system_code` không đổi ý nghĩa.

## Hạn chế còn mở
- A1 đọc-đếm theo kiểu `count(*)` từng bảng; với CSDL rất lớn có thể chậm (đã đặt timeout 300s, báo lỗi rõ thay vì im lặng).
- A2 prune vẫn là thao tác thủ công có xác nhận — chủ đích, vì xoá backup là không hoàn tác.
- Chưa kiểm chứng được trên GUI thật (agent không đăng nhập/không bấm nút hộ được); mọi kết luận ở trên tới từ probe + đo layout headless.

# Walkthrough: Sửa lỗi "Docker đã chạy mà launcher vẫn báo chưa sẵn sàng"

## 🎯 Triệu chứng người dùng báo
Ảnh chụp 08:56:06→08:56:46: bảng trạng thái tô xanh `Docker Desktop Engine • HOẠT ĐỘNG`, nhưng bước 1 của `CHẠY HỆ THỐNG` in
`🐳 Docker chưa chạy. Đang tự động mở Docker Desktop...` → `⏳ Đang đợi Docker Engine khởi động hoàn tất...` → `❌ Lỗi: Docker Desktop chưa sẵn sàng`
và **dừng luôn**, nên Supabase/Next.js/Tunnel không được khởi động ("không chạy được server").

## 🔎 Nguyên nhân gốc (3 lớp, đều đã kiểm chứng bằng đo)
1. **Kiểm tra kép không chốt kết quả.** Code cũ:
   `while not is_docker_ready() and retries < 40: ...` **rồi sau vòng lặp lại** `if not is_docker_ready():` một lần nữa.
   Khi engine đang lên chập chờn, vòng lặp thoát ra vì một lần `docker info` trả OK, nhưng câu kiểm tra *độc lập* ngay sau đó lại fail ⇒ báo "chưa sẵn sàng" dù Docker thật đã chạy. Đây là điểm khớp đúng với ảnh: vòng lặp chỉ chạy ~39 giây (thoát sớm) chứ không hết 40 lần × 2s.
2. **Timeout 3 giây quá hẹp.** `is_docker_ready()` chạy `docker info` với `timeout=3`; đúng lúc Docker Desktop đang khởi động WSL2 thì một lần hỏi có thể lâu hơn 3s → trả False oan.
3. **Mở Docker Desktop lần hai ngay khi nó đang chạy.** `Popen([str(p)], shell=True)` được gọi vô điều kiện. Đồng thời `shell=True` + argv dạng list là cách dùng sai trên Windows (dễ vỡ với đường dẫn có dấu cách, mà `Docker Desktop.exe` chính là như vậy).

## 🛠 Đã sửa
- **`docker_engine_status(timeout=8) -> (ok, lý_do)`** ([server_launcher.py:242](file:///D:/chanh%20thu/web/server_launcher.py#L242)) hỏi `docker info --format {{.ServerVersion}}`.
  Lý do dùng `--format`: **đã đo** và thấy `docker info` *không* format vẫn in nguyên mục `Client:` dù daemon chết (rc=1) — nên "stdout có nội dung" không phải bằng chứng engine sống. Với `--format`, rc=0 chỉ khi chính engine trả lời, và stdout cho ra version để báo đích danh.
  Hàm phân biệt 4 nguyên nhân và nói khác nhau: không có `docker` trong PATH / engine không trả lời trong Xs / lỗi gọi / `docker info` trả lỗi (kèm stderr rút gọn). `is_docker_ready()` chỉ còn là wrapper.
- **`docker_desktop_app_running()`** ([server_launcher.py:275](file:///D:/chanh%20thu/web/server_launcher.py#L275)) dò tiến trình `com.docker.backend.exe` để biết app **đã mở hay chưa**.
  *Bài học khi viết hàm này:* bản đầu dùng `tasklist /FI "IMAGES eq ..."` — bộ lọc đúng phải là **`IMAGENAME`**. Sai một chữ thì tasklist báo `ERROR: The search filter cannot be recognized`, hàm trả False **oan**, và launcher lại đi mở Docker Desktop lần hai. Đã bắt được nhờ chạy hàm thật, không phải nhờ đọc code.
- **`_wait_docker_engine()`** ([server_launcher.py:2359](file:///D:/chanh%20thu/web/server_launcher.py#L2359)):
  - chờ theo **ngân sách đồng hồ treo** `DOCKER_WAIT_SECONDS = 180` (thay cho "40 lần × 2s" không nói lên gì), mỗi `DOCKER_POLL_SECONDS = 3` giây hỏi lại;
  - **chốt (latch) kết quả**: biến `ready` được dùng trực tiếp làm quyết định, **không kiểm tra lại lần hai** — hết kịch bản flap;
  - chỉ `Popen` khi `com.docker.backend` **không** tồn tại, và bỏ `shell=True` (argv list thuần, đường dẫn có dấu cách an toàn);
  - in heartbeat mỗi ~15s kèm **nguyên nhân thật** từ `docker info` + số giây còn lại, để người dùng biết nó đang chờ chứ không phải đã chết;
  - khi hết giờ, báo đúng câu cuối cùng engine trả lời và hướng dẫn xử lý (mở Docker Desktop tay chờ badge xanh / bấm 🩺 Bác sĩ môi trường).
- Quét toàn file xem còn chỗ nào mắc cùng kiểu "kiểm tra kép": chỉ còn `wait_ports_open()` là vòng chờ thứ hai, và nó **an toàn** vì trả về tập cổng vẫn đóng tính ngay trong vòng lặp.

## 🧪 Nghiệm thu
Probe 8 nhóm với `docker_engine_status`/`tasklist` được kịch bản hoá (không gọi `docker` thật, không mở Docker Desktop thật) — **tất cả kiểm tra đạt**, trong đó:
- nhóm 4 tái hiện đúng kịch bản của người dùng `False → True → False` và khẳng định kết quả cuối **phải là True** (chốt kết quả) và **không hỏi lần hai**;
- nhóm 3 khẳng định khi app chưa chạy thì `Popen` gọi **đúng 1 lần**, argv là list một phần tử, đường dẫn `Docker Desktop.exe` có dấu cách vẫn tồn tại thật;
- nhóm 6 khẳng định bộ lọc là `IMAGENAME eq com.docker.backend.exe` và khi tasklist lỗi thì hàm trả False chứ không bịa "đang chạy";
- nhóm 7 phân biệt đủ 4 loại nguyên nhân (PATH / timeout / stderr / rc=0 kèm version).
Chạy với Docker **thật** đang bật: `_wait_docker_engine()` trả `(True, 'Docker Engine 29.9.2')` sau **0.40s**, không in dòng chờ nào.
`py_compile` OK; dựng GUI `alpha=0` vẫn 1256x650, khung nhật ký 1177x232px.

⚠️ Một nhóm probe ban đầu **đánh lừa chính nó**: `make()` đã ghi đè `docker_desktop_app_running` ở cấp module, nên phép thử "phát hiện app đang chạy" thật ra đo hàm stub và cho kết quả OK giả. Phải lưu bản thật từ lúc import rồi gọi lại — nếu không sẽ không bao giờ phát hiện ra lỗi `IMAGES` ở trên.

## Tuân thủ kiến trúc phân hệ
Chỉ đụng tầng khởi động hạ tầng của launcher (Docker/CLI). Không sửa `src/`, không đụng schema, không liên quan `system_code` hay `hasModule` ⇒ Kho Đông Lạnh không bị ảnh hưởng.

## Việc người dùng cần làm
Tắt hẳn launcher (tiến trình `pythonw` cũ vẫn giữ code cũ trong RAM) rồi mở lại bằng `CHAY_SERVER.bat`, bấm 🚀 CHẠY HỆ THỐNG. Nếu Docker Desktop thật sự chưa lên sau 180s, dòng `❌` giờ sẽ kèm **nguyên nhân cụ thể** từ `docker info` — gửi đúng dòng đó (hoặc bấm 📤 Lưu nhật ký ra file) là chẩn đoán được tiếp.

## Hạn chế còn mở
- 180s vẫn có thể ngắn trên máy lạnh/WSL2 chậm; chưa có nút "chờ tiếp" mà sẽ báo lỗi kèm nguyên nhân để người dùng bấm lại.
- Nếu Docker Desktop chạy ở chế độ cần đăng nhập/quyền admin thì engine có thể không lên mãi; launcher chỉ báo nguyên nhân chứ không tự xử lý.

# Walkthrough: LOT bắt buộc mang chi nhánh + Bộ lọc chi nhánh ở trang Quản lý LOT

Yêu cầu: *"code tạo lot bắt buộc phải có chọn chi nhánh, vẫn ưu tiên chọn chi nhánh mặc định (CN Cư M'gar), nhưng bắt buộc không được để lot nào trống"* + *"ở trang quản lý lot bộ lọc phải có thêm chi nhánh và chọn mặc định"*.

## 1. Các file đã chạm

| File | Vai trò thay đổi |
| --- | --- |
| [src/lib/branches.ts](file:///d:/chanh%20thu/web/src/lib/branches.ts) (**mới**) | Bộ 3 hàm dùng chung: `getScopedBranches()` lọc chi nhánh thuộc phân hệ đang làm việc, `getDefaultBranchName()` lấy chi nhánh `is_default`, `fetchDefaultBranchName()` đọc thẳng DB cho các luồng tạo LOT không có sẵn danh sách chi nhánh. Kèm 2 hằng `BRANCH_FILTER_ALL` / `BRANCH_FILTER_NONE`. |
| [LotForm.tsx](file:///d:/chanh%20thu/web/src/app/(dashboard)/warehouses/lots/_components/LotForm.tsx) | Chặn lưu khi thiếu chi nhánh, gợi ý sẵn chi nhánh mặc định, ẩn nút "Xóa", datalist chỉ còn chi nhánh đúng phân hệ. |
| [PalletsPageContent.tsx](file:///d:/chanh%20thu/web/src/app/(dashboard)/warehouses/pallets/_components/PalletsPageContent.tsx) | `lotPayload` (luồng tạo LOT từ pallet — **nguồn gốc của 46 LOT thiếu chi nhánh**) giờ có `warehouse_name`. |
| [RecreateLotModal.tsx](file:///d:/chanh%20thu/web/src/components/lots/RecreateLotModal.tsx) | Bỏ hardcode `"CN Cư M'gar"`, thay bằng chi nhánh mặc định của phân hệ đang làm việc. |
| [LotBulkCloneModal.tsx](file:///d:/chanh%20thu/web/src/components/warehouse/lots/LotBulkCloneModal.tsx) | LOT nhân bản giữ chi nhánh LOT gốc; LOT gốc trống thì lấy chi nhánh mặc định. |
| [useLotManagement.ts](file:///d:/chanh%20thu/web/src/app/(dashboard)/warehouses/lots/_hooks/useLotManagement.ts) | State `branchFilter` (mặc định = chi nhánh mặc định của phân hệ), áp bộ lọc **phía server** vào truy vấn LOT, thêm vào danh sách phụ thuộc refetch. `branches` phát cho UI giờ đã scope theo phân hệ. |
| [LotFilter.tsx](file:///d:/chanh%20thu/web/src/app/(dashboard)/warehouses/lots/_components/LotFilter.tsx) | Pill **"Chi nhánh"** mới ở hàng "Khu vực / Dãy hàng": Tất cả · từng chi nhánh · Chưa gắn chi nhánh. |
| [LotPageManager.tsx](file:///d:/chanh%20thu/web/src/app/(dashboard)/warehouses/lots/_components/LotPageManager.tsx) | Nối `branchFilter` / `setBranchFilter` / `branches` từ hook xuống `LotFilter`. |

## 2. "Bắt buộc" được kích hoạt bằng gì (không hardcode mã kho)

## 2. Mô hình nghiệp vụ đúng: chi nhánh là cấp CÔNG TY

Người dùng xác nhận mô hình: **1 công ty → nhiều chi nhánh → trong 1 chi nhánh có Kho Đông Lạnh, Kho Bao Bì, Kho Nguyên Liệu...** Nên LOT ở kho nào cũng phải chọn được chi nhánh. Điều kiện bật tính bắt buộc **không** phải `systemType === 'KHO_DONG_LANH'` mà là *công ty của phân hệ đang làm việc có khai báo chi nhánh hay không*:

```
branchesOfCompany = branches có company_id trùng công ty của phân hệ đang chọn
requireBranch     = ô "Kho nhập hàng" đang hiển thị && branchesOfCompany.length > 0
```

- Chánh Thu (`b503014d…`): `CN Cư M'gar` (`is_default = true`) → **bắt buộc ở cả 4 kho** của công ty, gợi ý sẵn đúng chi nhánh này.
- Tenant chưa khai chi nhánh (Sarita, Alibaba, Toàn Thắng, Tài Phát và các kho DEFAULT): danh sách rỗng → **không chặn lưu**, giữ hành vi cũ. Đúng tinh thần "chưa bật cấu hình → không bị ảnh hưởng".
- Cột `branches.system_type` **không** còn được dùng để lọc nữa: nó vốn làm chi nhánh của Kho Đông Lạnh biến mất khỏi form LOT của kho bao bì — trái mô hình. Cô lập giờ chỉ còn theo `company_id` (multi-tenant). Trước bản sửa này, datalist của form LOT liệt kê *mọi* chi nhánh của *mọi* công ty.

## 3. Hành vi cụ thể

**Form tạo/sửa LOT** — [LotForm.tsx:172-189](file:///d:/chanh%20thu/web/src/app/(dashboard)/warehouses/lots/_components/LotForm.tsx#L172):
- `handleSubmit()` [dòng 941](file:///d:/chanh%20thu/web/src/app/(dashboard)/warehouses/lots/_components/LotForm.tsx#L941): nếu thiếu chi nhánh → mở rộng khối thông tin, báo toast *"Bắt buộc chọn Kho / Chi nhánh nhập hàng trước khi lưu LOT"* và **dừng trước khi** set `isSubmitting` (nút Lưu không bị kẹt trạng thái).
- Ô nhập viền đỏ + dấu `*` đỏ trên nhãn khi đang trống; placeholder đổi thành "Bắt buộc: ...".
- Nút **"Xóa"** bị ẩn khi bắt buộc (trước đây là con đường ngắn nhất dẫn tới LOT trống).
- Mở form tạo mới → tự điền chi nhánh mặc định (kể cả khi danh sách chi nhánh tải xong *sau* khi mở form). Mở form sửa một LOT cũ đang trống → cũng tự điền, để lần lưu kế tiếp tự vá dữ liệu.

**Các luồng tạo LOT không qua form**: tạo LOT từ pallet, khôi phục LOT, nhân bản LOT — tất cả đều tự gắn chi nhánh mặc định của công ty, không còn khả năng sinh LOT trống. `LotSplitModal` đã thừa kế chi nhánh từ LOT gốc nên giữ nguyên.

**Bộ lọc trang Quản lý LOT**: giá trị mặc định khi vào trang (và khi đổi phân hệ) = chi nhánh mặc định của công ty; chọn "Tất cả chi nhánh" để trở về như cũ. Bộ lọc chạy **trên server** (`.eq('warehouse_name', ...)`, hoặc `.is('warehouse_name', null)` cho "Chưa gắn chi nhánh") nên phân trang, tổng số LOT và mọi pill khác (Vị trí, Khóa, STT, Khu vực, Tìm kiếm) đều nhân đúng — không phải lọc sau khi đã cắt trang.

## 4. Kiểm chứng đã chạy

| Bước | Kết quả |
| --- | --- |
| `npx vitest run src/lib/__tests__/branches.test.ts` | **7/7 PASS** — chi nhánh là cấp công ty (mọi kho cùng công ty đều thấy), không lộ chi nhánh công ty khác, công ty chưa khai → rỗng, bỏ dòng thiếu tên, tài khoản chưa gắn công ty → giữ danh sách cũ, ưu tiên `is_default`, fallback `BRANCH_FILTER_ALL` |
| `npx tsc --noEmit` | **264 lỗi = đúng mức nền** của repo; các file vừa sửa **không** phát sinh lỗi mới (2 lỗi còn lại ở `RecreateLotModal.tsx:99,100` nằm trên dòng code **không đụng tới**, có từ trước) |
| `npx next build` | `BUILD_EXIT=0` |
| `psql` đối chiếu dữ liệu thật | `select ... from lots` theo từng `status`: **0 dòng** có `warehouse_name` NULL hoặc rỗng (kể cả `exported`) → bộ lọc mặc định **không ẩn** LOT nào của Kho Đông Lạnh (2047 LOT active đều thuộc `CN Cư M'gar`) |
| Đo `branches` / `systems` | Công ty Chánh Thu (`b503014d…`) currently có **1** chi nhánh (`CN Cư M'gar`, `is_default = true`) dùng chung cho cả 4 phân hệ của họ; các tenant khác **0** chi nhánh → không bị ép |
| Kiểm tra tiêu thụ dữ liệu | `branches` từ `useLotManagement` chỉ được `LotForm` và `LotFilter` dùng → việc scope không ảnh hưởng nơi khác |

## 5. Hệ quả cần biết: `warehouse_name` đang bị dùng làm 2 việc

> ✅ **Đã xử lý** — xem "# Walkthrough: Tách "Khu vực Chờ" ra khỏi chi nhánh" bên dưới (cột mới `lots.staging_area_code`, các site ghi/đọc đã đổi, 3 LOT `KBB1` đã vá). Nội dung mục này giữ lại làm bằng chứng gốc rễ.

Đây chính là gốc rễ của lỗi "LOT thiếu chi nhánh" mà người dùng giải thích: khi làm module cho kho bao bì, "chuyển vào sảnh chờ" bị các agent trước hiểu thành **ghi mã sơ đồ kho vào `lots.warehouse_name`**, tức lấy chỗ của chi nhánh. Bằng chứng trong code hiện tại:

- [LotAssignPositionModal.tsx:341-346](file:///D:/chanh%20thu/web/src/components/warehouse/lots/LotAssignPositionModal.tsx#L341): "đưa vào Khu vực Chờ" = `update({ warehouse_name: matchedLayout.code })` → **ghi đè, xóa mất chi nhánh**, toast báo *"Đã đưa lô hàng vào Khu vực Chờ của Kho …"*.
- [LotCard.tsx:566-581](file:///D:/chanh%20thu/web/src/app/(dashboard)/warehouses/lots/_components/LotCard.tsx#L566): badge "… (Chờ xếp)" bật ra từ chính `lot.warehouse_name` khi LOT chưa có ô kệ →LOT Kho Đông Lạnh có chi nhánh cũng bị đọc thành "đang chờ xếp".
- [warehouseArrangement.ts:287](file:///D:/chanh%20thu/web/src/lib/warehouseArrangement.ts#L287) ưu tiên "Đang ở Sảnh (chờ xếp)" và [map/page.tsx:1227](file:///D:/chanh%20thu/web/src/app/(dashboard)/warehouses/map/page.tsx#L1227) + [useMapFilters.ts:219](file:///D:/chanh%20thu/web/src/app/(dashboard)/warehouses/map/_hooks/useMapFilters.ts#L219), [:317](file:///D:/chanh%20thu/web/src/app/(dashboard)/warehouses/map/_hooks/useMapFilters.ts#L317) cũng đọc `warehouse_name` làm thông tin vị trí.
- Dữ liệu thật: **2 LOT** `KHO_VAT_TU_BAO_BI` mang `warehouse_name = 'KBB1'` (mã `warehouse_layouts`, "Kho Bao Bì") chứ không phải chi nhánh → trên trang Quản lý LOT của kho bao bì, bộ lọc mặc định CN Cư M'gar sẽ **ẩn 2 LOT này** cho tới khi tách xong khái niệm.

## 6. Việc người dùng cần tự bấm (agent không có phiên đăng nhập)

1. `/warehouses/lots` (Kho Đông Lạnh): pill "Chi nhánh" mặc định sẵn **CN Cư M'gar**; thử đổi sang "Tất cả chi nhánh" rồi "Chưa gắn chi nhánh" (kết quả phải rỗng).
2. Bấm "Tạo LOT" → ô Kho đã điền sẵn CN Cư M'gar, **không còn nút Xóa**; xóa tay nội dung rồi bấm Lưu → phải thấy toast đỏ và không tạo LOT.
3. Sửa một LOT bất kỳ → lưu → kiểm tra vẫn còn đúng chi nhánh.
4. Tạo LOT từ màn Pallets → mở LOT mới, đối chiếu `warehouse_name`.
5. Chuyển sang Kho Vật Tư & Bao Bì: form LOT **cũng** bắt buộc chi nhánh (theo mô hình mới). Lưu ý 2 LOT `KBB1` cũ sẽ bị ẩn khi đang lọc CN Cư M'gar — chọn "Tất cả chi nhánh" để thấy lại, hoặc chờ bước tách "Khu vực Chờ" ở mục 7.

## 7. Còn mở (chờ người dùng chốt phương án)
- ~~Tách kho dữ liệu: `lots.warehouse_name` **chỉ** chứa chi nhánh; "Hàng chờ xếp kho (Khu vực Chờ)" phải nằm ở trường/khái niệm riêng~~ → **đã làm** bằng cột `staging_area_code` (Walkthrough kế tiếp).
- `BranchManagerSection` (Cài đặt → Chi nhánh) chưa có ô chọn "thuộc chi nhánh nào cho kho nào"; chi nhánh hiện chỉ gắn `company_id`.
- Bộ lọc chỉ khớp **đúng chuỗi** `warehouse_name`; hai chi nhánh viết hoa/thường khác nhau sẽ là hai mục khác nhau (dữ liệu hiện tại chưa có trường hợp này).
- Các hàm gán hàng loạt (nút "Gán vị trí cho LOT chưa gán") vẫn đếm trên toàn phân hệ, không theo chi nhánh đang lọc.

---

# Walkthrough: Tách "Khu vực Chờ" ra khỏi chi nhánh (cột mới `lots.staging_area_code`)

## 1. Quy tắc nghiệp vụ sau thay đổi

| Khái niệm | Nơi lưu | Ai ghi | Module điều khiển |
| --- | --- | --- | --- |
| **Chi nhánh nhập hàng** | `lots.warehouse_name` (tên chi nhánh, cấp **công ty**) | Form LOT, màn Pallets, tạo lại LOT, nhân bản LOT | `warehouse_name` (module cơ bản, luôn bật) |
| **Hàng chờ xếp kho (Khu vực Chờ)** | `lots.staging_area_code` (mã `warehouse_layouts`, VD `KBB1`) | Nút "Gán mã vị trí" + ô Khu vực Chờ trong form LOT | `warehouse_staging_area` (form) / `warehouse_staging_area` hoặc `warehouse_layout_2d` (modal + badge) |
| **Đã lên ô kệ** | `positions.lot_id` | Mọi luồng gán vị trí | — |

Bất biến mới: ** Lô đã nằm trên ô vị trí thật thì `staging_area_code` phải rỗng**, và **không luồng nào còn ghi/xóa `warehouse_name` khi thao tác vị trí**.

Kiểm tra trạng thái module thật trong CSDL (`systems.modules → utility_modules`): không phân hệ nào bật `warehouse_staging_area`; `warehouse_layout_2d` chỉ có ở **Kho Dụng Cụ** và **Kho Vật Tư & Bao Bì**. **Kho Đông Lạnh không bật cả hai** ⇒ mọi nhánh code `isStagingEnabled` đều `false` với kho Đông Lạnh, phân hệ này không nhận code mới nào.

## 2. File đã sửa

| File | Vai trò |
| --- | --- |
| [supabase/migrations/20261030114500_add_staging_area_code_to_lots.sql](file:///D:/chanh%20thu/web/supabase/migrations/20261030114500_add_staging_area_code_to_lots.sql) | Thêm cột `staging_area_code text` (thuận tăng, đã `db push --local`) |
| [LotAssignPositionModal.tsx:269](file:///D:/chanh%20thu/web/src/components/warehouse/lots/LotAssignPositionModal.tsx#L269) | "Xóa vị trí" trước đây `update({warehouse_name: null})` (xóa luôn chi nhánh) → nay chỉ xóa `staging_area_code` |
| [LotAssignPositionModal.tsx:342-346](file:///D:/chanh%20thu/web/src/components/warehouse/lots/LotAssignPositionModal.tsx#L342) | Đưa lô vào Khu vực Chờ: ghi `staging_area_code`, **không đụng** `warehouse_name`; audit + `operation_history` ghi `previous_staging_area` |
| [LotAssignPositionModal.tsx:583](file:///D:/chanh%20thu/web/src/components/warehouse/lots/LotAssignPositionModal.tsx#L583) và [:727](file:///D:/chanh%20thu/web/src/components/warehouse/lots/LotAssignPositionModal.tsx#L727) | Gán vào ô kệ thật (thủ công + tự động vào sảnh) → xóa `staging_area_code` |
| [LotAssignPositionModal.tsx:25](file:///D:/chanh%20thu/web/src/components/warehouse/lots/LotAssignPositionModal.tsx#L25), [:820](file:///D:/chanh%20thu/web/src/components/warehouse/lots/LotAssignPositionModal.tsx#L820) | Giá trị khởi tạo của ô nhập lấy từ khu chờ (không phải chi nhánh); header tách 2 chip "Chờ: …" / "Chi nhánh: …" |
| [LotForm.tsx:1625-1690](file:///D:/chanh%20thu/web/src/app/(dashboard)/warehouses/lots/_components/LotForm.tsx#L1625) | Ô **"Hàng chờ xếp kho (Khu vực Chờ)"** riêng, chỉ hiện khi bật `warehouse_staging_area`, chip chọn nhanh theo `warehouse_layouts` |
| [LotForm.tsx:1557-1622](file:///D:/chanh%20thu/web/src/app/(dashboard)/warehouses/lots/_components/LotForm.tsx#L1557) | Ô cũ đổi thành **"Chi nhánh nhập hàng"**: datalist/chip **chỉ còn chi nhánh của công ty**, bỏ hoàn toàn mã sơ đồ kho |
| [LotForm.tsx:1173](file:///D:/chanh%20thu/web/src/app/(dashboard)/warehouses/lots/_components/LotForm.tsx#L1173) | Payload chỉ gồm `staging_area_code` khi module bật ⇒ phân hệ chưa bật không bị ghi đè cột này |
| [LotForm.tsx:1013](file:///D:/chanh%20thu/web/src/app/(dashboard)/warehouses/lots/_components/LotForm.tsx#L1013) | Audit "Khu vực Chờ: X → Y" tách khỏi audit "Chi nhánh: X → Y" |
| [LotCard.tsx:566](file:///D:/chanh%20thu/web/src/app/(dashboard)/warehouses/lots/_components/LotCard.tsx#L566) | Badge hổ phách "… (Chờ xếp)" nay đọc `staging_area_code` (trước đây đọc `warehouse_name`) |
| [WarehouseLayoutViewer.tsx:862-868](file:///D:/chanh%20thu/web/src/components/warehouse/layout-manager/WarehouseLayoutViewer.tsx#L862) | Khay "Khu vực Chờ Nhập Kho" trên sơ đồ lọc theo `stagingAreaCode` thay vì `warehouseName` |
| [map/page.tsx:1227](file:///D:/chanh%20thu/web/src/app/(dashboard)/warehouses/map/page.tsx#L1227), [:1259](file:///D:/chanh%20thu/web/src/app/(dashboard)/warehouses/map/page.tsx#L1259) | Select + DTO của hàng chờ bổ sung `staging_area_code` |
| [useMapFilters.ts:220](file:///D:/chanh%20thu/web/src/app/(dashboard)/warehouses/map/_hooks/useMapFilters.ts#L220) | Từ khóa tìm kiếm "all" gồm cả mã khu chờ |
| [useLotManagement.ts:39](file:///D:/chanh%20thu/web/src/app/(dashboard)/warehouses/lots/_hooks/useLotManagement.ts#L39) | Kiểu `Lot` có `staging_area_code` (select đã dùng `*` nên dữ liệu về sẵn) |
| [LotSplitModal.tsx:156](file:///D:/chanh%20thu/web/src/components/warehouse/lots/LotSplitModal.tsx#L156) | LOT tách ra kế thừa đúng khu chờ của LOT gốc |
| [LotDetailsModal.tsx:376-381](file:///D:/chanh%20thu/web/src/components/warehouse/lots/LotDetailsModal.tsx#L376), [scan/page.tsx:482](file:///D:/chanh%20thu/web/src/app/(dashboard)/warehouses/lots/scan/page.tsx#L482), [MobileCreateLotTab.tsx:402](file:///D:/chanh%20thu/web/src/app/mobile/_tabs/MobileCreateLotTab.tsx#L402) | nhãn "Kho:" → "Chi nhánh:" + thêm chip khu chờ |
| [lot-modules.ts:19-21](file:///D:/chanh%20thu/web/src/lib/lot-modules.ts#L19), [utility-modules.ts:143](file:///D:/chanh%20thu/web/src/lib/utility-modules.ts#L143) | Module `warehouse_name` đổi tên hiển thị "Chi nhánh nhập hàng"; mô tả module khu chờ ghi rõ cột `staging_area_code` |

Không có site nào khác còn ghi `warehouse_name` của bảng `lots` bằng mã sơ đồ kho — đã kiểm tra bằng grep toàn `src` (các `warehouse_name` còn lại thuộc `inbound_orders` / `outbound_orders` / `audit_sessions`, bản chất đã là chi nhánh).

## 3. Kiểm chứng

| Bước | Kết quả |
| --- | --- |
| `npx vitest run src/lib/__tests__/branches.test.ts` | **7/7 PASS** (luật chi nhánh cấp công ty không đổi) |
| `npx tsc --noEmit` | **264 lỗi = đúng mức nền**; grep theo 13 file vừa sửa → **0 lỗi mới** |
| `npx next build` | `BUILD_EXIT=0` |
| `supabase db push --local --yes` | Migration áp ok; `\d lots` có `staging_area_code text` nullable |
| `psql` đối chiếu sau vá | `select system_code, warehouse_name, count(*) from lots group by 1,2` → **3 nhóm, toàn bộ là `CN Cư M'gar`, 0 dòng NULL / 0 dòng ngoài danh sách `branches.name`** (trước vá: 3 dòng `KBB1`, trong đó 1 dòng thuộc Kho Đông Lạnh) |

## 4. Dữ liệu đã vá — 3 LOT, không phải 2

Lệnh `warehouse_name not in (select name from branches)` trả về **3** dòng (báo cáo trước đó chỉ đếm 2 LOT bao bì, bỏ sót 1 LOT kho đông lạnh đã xuất kho):

| LOT | Phân hệ | `warehouse_name` trước → sau | `staging_area_code` |
| --- | --- | --- | ---|
| `VTBB-LOT-6W3TEM` | KHO_VAT_TU_BAO_BI | `KBB1` → `CN Cư M'gar` | `NULL` |
| `VTBB-LOT-4U84MD` | KHO_VAT_TU_BAO_BI | `KBB1` → `CN Cư M'gar` | `NULL` |
| `DL-LOT-090326-001` (exported) | KHO_DONG_LANH | `KBB1` → `CN Cư M'gar` | `NULL` |

Lý do 2 LOT bao bì **không** nhận `staging_area_code='KBB1'`: cả hai đang gắn ô vị trí thật (`PHONG-01-02`, `PHONG-01-01`) — mã `KBB1` chỉ là vết của bước "đưa vào hàng chờ" trước khi xếp ô, và theo bất biến ở mục 1 thì lô đã lên ô thì khu chờ phải rỗng.
Bút toán: [backups/prestate_staging_split_20261030.csv](file:///D:/chanh%20thu/web/backups/prestate_staging_split_20261030.csv) (trạng thái trước), [backups/apply_staging_split_20261030.sql](file:///D:/chanh%20thu/web/backups/apply_staging_split_20261030.sql), [backups/rollback_staging_split_20261030.sql](file:///D:/chanh%20thu/web/backups/rollback_staging_split_20261030.sql) (hoàn nguyên đúng 3 dòng này).

## 5. Hệ quả trên UI cần biết

- **Badge "(Chờ xếp)" ở thẻ LOT**: biến mất với các LOT chỉ có chi nhánh mà chưa lên ô — chúng trở về nút đỏ "Chưa gán". Kho Đông Lạnh không đổi (phân hệ này chưa bật `warehouse_layout_2d`/`warehouse_staging_area`, trước sau đều là "Chưa gán").
- **Khay "Khu vực Chờ Nhập Kho" trên sơ đồ 2D** (Kho Dụng Cụ, Kho Vật Tư & Bao Bì): lô chưa có `staging_area_code` vẫn xuất hiện ở **mọi** layout — giữ đúng fallback cũ (`if (!staging) return true`). Số LOT chưa có vị trí hiện đo được: Kho Đông Lạnh 1, Kho Dụng Cụ 28 active + 59 "Đã xuất hết cho công trình", Kho Vật Tư & Bao Bì 0.
- **Ô "Chi nhánh nhập hàng" không còn gợi ý `KBB1`/`KBB2`**: muốn đưa lô vào hàng chờ ngay lúc tạo LOT, phải bật Cài đặt phân hệ → Tính năng → "Hàng chờ xếp kho (Khu vực Chờ)"; nếu chưa bật thì dùng nút "Gán mã vị trí" (modal vẫn nhận mã layout qua `warehouse_layout_2d`).

## 6. Việc người dùng cần tự bấm (agent không có phiên đăng nhập)

1. `/warehouses/lots` (Kho Đông Lạnh): mở 1 LOT → sửa → lưu → `warehouse_name` vẫn là CN Cư M'gar (không bị xóa).
2. Kho Vật Tư & Bao Bì → mở `VTBB-LOT-6W3TEM`: pill/badge **không** còn "KBB1 (Chờ xếp)", chip "Chi nhánh: CN Cư M'gar"; 2 LOT này nay hiện khi lọc CN Cư M'gar.
3. Kho Vật Tư & Bao Bì → "Gán mã vị trí" → nhập `KBB2` → lưu: LOT vào hàng chờ KBB2, **chi nhánh vẫn còn CN Cư M'gar**; badge hổ phách "KBB2 (Chờ xếp)".
4. Cùng LOT đó, gán vào một ô kệ thật → badge khu chờ biến mất, `staging_area_code` về NULL.
5. Ở modal đó bấm ô "Xóa" (để trống mã) → LOT về "Chưa gán" nhưng `warehouse_name` **không** bị xóa.
6. (Sau khi bật module) Tạo LOT ở Kho Vật Tư & Bao Bì: thấy 2 ô riêng — "Chi nhánh nhập hàng" (bắt buộc) và "Hàng chờ xếp kho (Khu vực Chờ)".

## 7. Còn mở
- `warehouse_staging_area` chưa được bật ở bất kỳ phân hệ nào → ô Khu vực Chờ trong form LOT đang ẩn; cần bật trong Cài đặt nếu muốn chọn khu chờ ngay khi tạo LOT.
- Modal "Gán mã vị trí" vẫn dùng gộp `warehouse_staging_area || warehouse_layout_2d` (giữ hành vi cũ cho 2 phân hệ bao bì/dụng cụ); form LOT thì gate chặt theo `warehouse_staging_area`. Nếu muốn thống nhất một mối, cần người dùng chốt.
- Khái niệm "sảnh chờ" (`zones.is_hall` + `positions`) vẫn là đường thứ hai để diễn đạt "chưa lên kệ"; `warehouseArrangement.ts:287` ưu tiên "Đang ở Sảnh" đang dùng ngả này và không đụng `staging_area_code`.
- `BranchManagerSection` vẫn chưa cho chọn phân hệ/công ty ngay trên UI; `staging_area_code` chỉ khớp **đúng chuỗi** mã layout (viết hoa/thường khác nhau = khác khu).

# Walkthrough: Sửa nhanh số lượng trên thẻ LOT

## Phạm vi và cách dùng

- Tại `/warehouses/lots`, bấm trực tiếp vào badge số lượng của từng dòng sản phẩm trên thẻ LOT. Khi rê chuột vào badge sẽ hiện biểu tượng cây bút.
- Nhập số lượng mới (hỗ trợ dấu phẩy hoặc dấu chấm thập phân), bấm **Enter** hoặc nút tích để lưu; bấm **Escape** hoặc nút X để hủy.
- Chỉ tài khoản có quyền quản lý LOT và LOT không bị khóa mới thấy tương tác sửa. Số lượng phải lớn hơn 0.

## Toàn vẹn dữ liệu và phân hệ

- Cập nhật đúng `lot_items.id` kèm điều kiện `lot_id`; tổng `lots.quantity` được tính lại từ toàn bộ dòng sản phẩm.
- Cập nhật LOT có điều kiện `system_code` của phân hệ hiện tại; không truy vấn hay thay đổi dữ liệu phân hệ khác.
- Ghi lịch sử sửa nhanh vào `metadata.system_history.edits`. Khi module `lot_accounting_sync` đang bật, thao tác cũng cập nhật phiếu nháp mới tạo hoặc tạo điều chỉnh tăng/giảm tương ứng, giống form sửa LOT đầy đủ.
- Nếu bước đồng bộ tổng LOT thất bại, hệ thống khôi phục số lượng dòng sản phẩm về giá trị trước đó rồi tải lại dữ liệu.

## Kiểm chứng

- `npx tsc --noEmit --pretty false`: các file thay đổi không có lỗi TypeScript; toàn dự án vẫn còn các lỗi nền đã biết.
- Server dev chạy tại `http://localhost:3001`; trình duyệt bị chuyển về `/login`, nên chưa xác minh được thao tác bấm/lưu thật bằng tài khoản đăng nhập.
- Cần kiểm tra thủ công: sửa tăng và giảm một dòng, kiểm tra badge tổng đầu thẻ cập nhật, tải lại trang vẫn giữ số mới; thử Enter/Escape, dấu phẩy thập phân, LOT bị khóa và LOT nhiều sản phẩm.

# Walkthrough: Điều tra tab "Tồn theo Mã phụ" có vẻ thiếu số liệu

## Kết luận chẩn đoán (đo trực tiếp trên Supabase local, không suy đoán)

Giả thuyết "bị limit ở cơ sở dữ liệu" là **KHÔNG đúng**. Đã kiểm chứng bằng cách gọi thẳng PostgREST với cùng cách phân trang mà route dùng:

- `lots` phân hệ lạnh, `status <> 'hidden'`: **11.836 dòng** — route lấy về **đủ 11.836**, không thiếu, không trùng (12 trang × 1.000).
- `lot_items` nhúng trong các LOT đó: **2.118 dòng**, tổng số lượng **135.200,11**.
- `lot_tags`: **1.085 dòng**, **56 tag** khác nhau, **0** tag mồ côi (mọi `lot_item_id` đều còn tồn tại), **0** tag cấp LOT (tất cả đều gắn theo dòng).
- `units` 75, `products` 847, `product_units` 121 → đều dưới 1.000 nên một trang là đủ.
- PostgREST local không đặt `db-max-rows`, nên `range()` lấy hết.

Vậy tab **không mất dữ liệu khi đọc từ database**. Nguyên nhân khiến số liệu "có vẻ thiếu/thừa" là ở tầng hiển thị và bộ lọc:

### 1. Bộ lọc bị ẩn nhưng vẫn đang áp dụng (nguyên nhân chính)

Thanh lọc chung ở `src/app/(dashboard)/inventory/page.tsx:272` chỉ hiển thị cho tab `accounting`, `category`, `lot`, `labels`. Tab `tags` **không hiện thanh lọc** nhưng `InventoryByTag` vẫn nhận `selectedBranch`, `targetUnitId`, `searchTerm`, `searchMode` và vẫn gửi lên API.

Hệ quả: gõ tìm kiếm hoặc chọn "Quy đổi" ở tab khác rồi chuyển sang tab Mã phụ thì số liệu bị thu hẹp mà người dùng không thấy lý do, cũng không thấy nút xóa bộ lọc. Mặc định `selectedBranch` còn bị nhận giá trị chi nhánh mặc định ("CN Cư M'gar") chứ không phải "Tất cả".

### 2. Một dòng tag cộng gộp nhiều đơn vị khác nhau (sai bản chất số)

API gom theo khóa `sku + đơn vị` nhưng `totalQuantity` của tag lại cộng **tất cả** các khóa đó, còn nhãn "Đơn vị" chỉ lấy đơn vị của sản phẩm đầu tiên. Có **7 tag** đang trộn đơn vị, ví dụ đo được:

| Tag | Thực tế | Số đang hiển thị |
|---|---|---|
| TRUNG HÙNG | 11.716,90 Kg + 300 Thùng(20kg) | 12.016,90 (một nhãn đơn vị) |
| HÀNG TỪ BẾN TRE | 4.965 Thùng(20kg) + 3.005 Thùng(13kg) + 1.607,2 Kg | 9.577,20 |
| IQF | 1.485 Thùng(10kg) + 238 Thùng(20kg) + 60 Thùng | 1.783,00 |

Biến thể "Thùng (20 Kg)" và "Thùng (20kg)" thì `canonicalizeUnit()` đã gộp đúng (lower-case, bỏ khoảng trắng), nên không phải lỗi ở đây.

### 3. Hai tab vốn khác phạm vi lọc (không phải bug, nhưng gây hiểu nhầm)

Tab LOT mặc định `positionFilter = 'has_position'` và `lockFilter = 'unlocked'`; tab Mã phụ **bỏ qua cả hai bộ lọc này**. Đo trên phân hệ lạnh: LOT có vị trí = **126.932,31**, LOT chưa có vị trí = **8.267,80** (bị tab LOT loại ra nhưng tab Mã phụ vẫn tính). Vì vậy số hai tab chênh nhau là **đúng thiết kế**, không phải mất dữ liệu.

## Đã sửa

1. `src/app/api/inventory/by-tag/route.ts`: thêm `.order('id')` cho cả helper `fetchAllWithPagination` và vòng phân trang `lots`. Phân trang `range()` mà không có thứ tự ổn định là rủi ro thật (PostgreSQL không đảm bảo thứ tự giữa các lần truy vấn) khi dữ liệu vượt 1.000 dòng.
2. `src/components/inventory/InventoryByTag.tsx`: thêm dải cảnh báo nêu rõ bộ lọc đang áp dụng (kho, đơn vị quy đổi, từ khóa + chế độ tìm) kèm nút **"Hiện toàn bộ"**, để tab Mã phụ không còn âm thầm lọc số liệu.
3. `src/components/inventory/InventoryByTag.tsx`: sửa khóa React khi hiển thị sản phẩm trong một nút cây — trước đây `key={p.productCode}` bị trùng khi cùng một mã hàng xuất hiện ở hai đơn vị khác nhau trong cùng tag.
4. `src/app/(dashboard)/inventory/page.tsx`: truyền `onClearFilters` để nút "Hiện toàn bộ" xóa đồng thời từ khóa, chế độ tìm, đơn vị quy đổi và đưa kho về "Tất cả".

5. `src/components/inventory/InventoryByTag.tsx`: **tách dòng theo từng đơn vị** (phương án được chọn). Mỗi nút cây giờ giữ `unitTotals: Map<đơn vị, số lượng>` và hiển thị một dòng `<tr>` riêng cho từng đơn vị thay vì cộng gộp rồi dán một nhãn đơn vị. Dòng đầu mang tên tag, các dòng sau thụt đúng cột và tag có nhiều đơn vị được gắn nhãn "N đơn vị". Cách gom này khớp với trang in `/print/inventory?type=tags` (vốn đã nhóm theo `danh mục + SKU + canonicalizeUnit(đơn vị)`).

## Tuân thủ kiến trúc phân hệ

- Không đụng vào logic ghi dữ liệu; chỉ thay đổi đọc/hiển thị.
- Query vẫn giữ nguyên điều kiện lọc `system_code` (qua `normalizedSystemType`); không thêm bất kỳ mã kho/phân hệ hardcode nào.
- Phân hệ Kho Đông Lạnh chỉ nhận thay đổi hiển thị (dải cảnh báo, thứ tự lấy dữ liệu), số liệu đầu ra không đổi khi không bật bộ lọc ẩn.

## Kiểm chứng

- Đo đếm và tổng số liệu bằng `psql` trong container `supabase_db_anywarehouse`.
- Gọi PostgREST trực tiếp bằng service key để tái hiện đúng vòng phân trang của route: 11.836/11.836 dòng, không thiếu, không trùng.
- `npx tsc --noEmit`: các file đã sửa không có lỗi TypeScript.
- `GET /api/inventory/by-tag` trên dev :3001 trả 401 (chặn ở middleware) chứ không phải 500, xác nhận route mới biên dịch hợp lệ.
- Chưa xác minh được giao diện thật vì phiên đăng nhập thuộc về người dùng.

## Số liệu đối chiếu sau khi tách dòng theo đơn vị (kho lạnh, bỏ mọi bộ lọc ẩn)

Tổng `lot_items` của các LOT không ẩn = **135.200,11** (2.118 dòng, 2.071 LOT có hàng).

| Mã phụ | Trước (cộng gộp) | Sau (tách theo đơn vị) |
|---|---|---|
| TRUNG HÙNG | 12.016,90 (nhãn "Kg") | 11.716,90 Kg + 300,00 Thùng (20kg) |
| HÀNG TỪ BẾN TRE | 9.577,20 | 4.965,00 Thùng(20kg) + 3.005,00 Thùng(13kg) + 1.607,20 Kg |
| ĐÃ RW | 681,00 | 591,00 Thùng(10kg) + 90,00 Thùng(12kg) |
| IQF | 1.783,00 | 1.485,00 Thùng(10kg) + 238,00 Thùng(20kg) + 60,00 Thùng |
| NẤM | 1.168,00 | 1.052,00 Thùng(20kg) + 116,00 Kg |
| VỤN | — | chỉ một đơn vị Thùng(20kg) nên vẫn một dòng |
| Chưa gắn mã | 85.893,81 | nhiều dòng, mỗi dòng một đơn vị |

Số dòng gốc của tab không đổi: **56 mã phụ + "Chưa gắn mã" = 57 nhóm**; chỉ những nhóm đa đơn vị mới sinh thêm dòng.

Người dùng cần kiểm tra trực tiếp trên `http://localhost:3001/inventory` → tab "Tồn theo Mã phụ":
1. Dải cảnh báo màu vàng xuất hiện khi còn bộ lọc ẩn và nút "Hiện toàn bộ" làm mất dải này.
2. Bấm vào "TRUNG HÙNG" phải thấy 2 dòng (Kg / Thùng (20kg)) và badge "2 đơn vị".
3. Cộng nhẩm các dòng con theo từng đơn vị phải khớp số dòng cha cùng đơn vị.

# Walkthrough: Mã phụ tự đăng ký vào trang Quản lý Mã Phụ

## Vấn đề đo được

Trang `http://localhost:3001/warehouses/lot-codes` chỉ đọc bảng `master_tags` (qua `api/lot-tags/master/route.ts:15`), còn mã phụ người dùng gõ khi tạo LOT lại ghi vào `lot_tags`. Hai bảng không hề được đồng bộ:

- `lot_tags` đang dùng: **56 mã**.
- `master_tags` có: **17 mã**, chỉ **4** trùng với mã đang dùng.
- **52 mã phụ đang gắn trên LOT nhưng không xuất hiện ở trang quản lý.**

Trước đây chỉ `LotBulkAssignTagModal.tsx:113` là cố ghi `master_tags` bằng `upsert(onConflict: 'name,system_code')`, nhưng bảng `master_tags` **không có unique constraint nào** cho cặp đó (bảng còn không có PK) → câu upsert này chắc chắn lỗi runtime. Các luồng ghi mã phụ khác (LotForm, LotTagModal, Pallets, Map, RecreateLot, LotMerge, mobile/offline sync) không ghi `master_tags` chút nào.

## Giải pháp: trigger trong database

Làm ở tầng CSDL thay vì sửa ~10 điểm ghi phía client, để mọi luồng (web, mobile, đồng bộ offline) đều được che phủ và không thể bỏ sót:

1. `supabase/migrations/20261031100000_auto_register_master_tags_from_lot_tags.sql`
   - `create unique index master_tags_name_system_code_key on master_tags (name, system_code)` → làm cho `upsert(onConflict: 'name,system_code')` cũ hoạt động đúng và cho phép ghi idempotent.
   - Trigger `trg_register_master_tag_from_lot_tag` (AFTER INSERT on `lot_tags`): suy ra `system_code` + `company_id` **từ LOT cha**, rồi insert `master_tags` với `on conflict do nothing`.
   - Backfill toàn bộ mã đang dùng nhưng chưa có trong master.
2. `supabase/migrations/20261031110000_harden_master_tag_auto_register_trigger.sql`
   - `security definer` + `set search_path = public, pg_temp`: hàm vẫn đọc được `lots` và ghi được `master_tags` dù vai trò gọi bị RLS siết.
   - Bọc `exception when others` để **không bao giờ** làm fail thao tác gắn mã phụ; chỉ `raise warning`.

## Tuân thủ kiến trúc phân hệ

- Không hardcode mã phân hệ: `system_code` của master tag lấy trực tiếp từ `lots.system_code` của LOT vừa gắn mã, nên kho nào tạo mã phụ thì mã chỉ xuất hiện trong kho đó.
- Không sửa bất kỳ luồng ghi nào của Kho Đông Lạnh; trigger chỉ thêm dòng vào danh sách gợi ý, không đụng dữ liệu LOT.
- `lot_tags` không có policy chặn ghi, `master_tags` có policy "Enable all access"; trigger chạy `security definer` nên an toàn trước thay đổi policy tương lai.
- `_backfill` giữ nguyên `created_at` sớm nhất của mỗi mã (`min(added_at)`) để lịch sử không bị dồn về thời điểm chạy migration.

## Kiểm chứng (đã chạy trên stack Supabase local `anywarehouse`)

- `npx supabase db push --local` áp cả hai migration.
- Sau backfill: `master_tags` 17 → **70 dòng**, số "mã đang dùng mà thiếu trong master" = **0**.
- Test trigger trong transaction có rollback: gắn tag `'  TEST TU DONG DANG KY  '` → `master_tags` có đúng 1 dòng, `system_code = KHO_DONG_LANH` (suy ra từ LOT cha, tự cắt khoảng trắng và hoa hóa); gắn lần hai **không tạo bản ghi trùng**.
- Test cô lập lỗi: cố tình `drop index master_tags_name_system_code_key` trong transaction rồi gắn tag → `lot_tags` **vẫn lưu thành công** dù phần đăng ký master thất bại, rồi `rollback` nên index không mất.
- Xác nhận `prosecdef = true` trên hàm trigger; `master_tags` còn 0 dòng tên `TEST%`.
- Hệ quả hiển thị: trang Quản lý Mã Phụ và `LotTagModal`/`LotBulkAssignTagModal` (nguồn gợi ý `/api/lot-tags/master`) giờ liệt kê đủ 70 mã.

## Ghi chú cho người dùng

- Mã phụ dạng chuỗi phân cấp (ví dụ `TRUNG HÙNG>@>XẤU`, trong đó `@` là placeholder mã sản phẩm) được đăng ký **nguyên chuỗi người dùng gõ**. Nếu muốn trang quản lý chỉ lưu từng thành phần rời ("TRUNG HÙNG", "XẤU") thì cần chốt lại nghiệp vụ.
- Xóa một mã khỏi trang quản lý không xóa khỏi LOT, và trigger không tự xóa master tag khi không còn LOT nào dùng — đúng ý nghĩa của nút "Xóa khỏi danh sách Master" hiện tại.
- Bản production local `:3000` chưa build lại theo yêu cầu; thay đổi này nằm ở database nên cả `:3000` lẫn `:3001` đều đã nhận dữ liệu mới.

## Điều chỉnh: master_tags lưu từng tag đơn lẻ, không lưu chuỗi khuôn mẫu

Người dùng chốt nghiệp vụ: **Quản lý Mã Phụ là quản lý từng thẻ tag đơn lẻ**, còn `TRUNG HÙNG>@>XẤU` là chuỗi được GHÉP từ các tag đó (`@` chỉ là placeholder mã SKU, không phải một tag). Trigger ở mục trên đang lưu nguyên chuỗi → sai.

`supabase/migrations/20261031120000_master_tags_store_atoms_not_chains.sql`:
- Hàm trigger mới tách `NEW.tag` theo `>` bằng `regexp_split_to_array`, với mỗi segment: `btrim(replace(seg, '@', ''))`, bỏ qua segment rỗng → chỉ đăng ký nguyên liệu.
- Xóa các dòng `master_tags` đang chứa `>` hoặc `@` (bản ghi chuỗi khuôn mẫu).
- Backfill lại theo cùng logic tách segment.

Cách làm này khớp chính xác logic mà `LotTagModal.tsx:232-244` vẫn tự làm từ trước (`trimmed.split(>)`, bỏ qua `part !== '@'`) — tức là trigger giờ chỉ mở rộng cùng một nghiệp vụ ra mọi luồng ghi khác (LotForm, Pallets, Map, Recreate, Merge, mobile/offline) thay vì chỉ riêng modal này.

### Kiểm chứng

- `npx supabase db push --local` (lần đầu báo `syntax error at or near "array"` vì viết `FOREACH ... ARRAY` sai cú pháp plpgsql; đã đổi sang `FOR v_segment IN SELECT unnest(...)`, áp dụng thành công).
- Sau migration: `master_tags` còn **69 dòng**, số dòng chứa `>` hoặc `@` = **0**; `TRUNG HÙNG` và `XẤU` đều có mặt.
- Test trong transaction có rollback: gắn chuỗi `KHO A>@>LO AI>@>HANG LOAI X` → đăng ký đúng **3** master tag `KHO A | LO AI | HANG LOAI X`, segment `@` bị bỏ qua.
- Không còn ghi dư bản ghi test (`rollback`), `master_tags` trở lại 69.

## Sửa cách dựng cây "Tồn theo Mã phụ" cho chuỗi có placeholder @

Người dùng chốt nghiệp vụ hiển thị: với chuỗi `TRUNG HÙNG>@>XẤU`, cấp `@` **chính là cấp SẢN PHẨM**, nên cây phải là

```
TRUNG HÙNG                       11.660,3 Kg
  [SP HH1010101.02.004  Sầu riêng cấp đông nguyên trái ... • 1 LOT]   466 Kg
      XẤU                                                              466 Kg
```

nghĩa là dòng sản phẩm (badge mã + tên + số LOT, giống thẻ LOT) nằm **ngay tại vị trí `@`** và bấm vào mới nở các tag con phía sau. Trước đây `InventoryByTag.tsx` thay `@` bằng mã SKU rồi coi đó là một node nhãn thường, nên sản phẩm bị đẩy xuống tận lá và không có tên/LOT.

Thay đổi trong `src/components/inventory/InventoryByTag.tsx`:
- Tách `tagItem.tag.split('>')` và nhận diện segment chứa `@` → node `isSkuLevel`, `name` = mã SKU, `productName` = tên sản phẩm, `lotCount` cộng dồn theo các dòng đơn vị của cùng SKU, `hasUnconvertible` bật khi có dòng lỗi quy đổi.
- Khóa đường đi của node sản phẩm là `@::<SKU>` để các SKU khác nhau không gộp làm một, còn tag không có `@` giữ nguyên cách dựng cũ.
- `unitTotals` vẫn nhân bản theo đơn vị nên node sản phẩm có nhiều đơn vị vẫn tách nhiều dòng đúng quy tắc đã chốt.
- Nếu chuỗi **đã có** cấp `@` (`hasSkuLevel`) thì không gắn `products` vào lá nữa, tránh in lại dòng sản phẩm hai lần.
- Node sản phẩm được nền `bg-stone-50/70` để đọc như một dòng sản phẩm thật.

### Kiểm chứng

- `npx tsc --noEmit`: `InventoryByTag.tsx` không lỗi TypeScript.
- Trích xuất đúng thuật toán dựng cây sang script Node chạy với dữ liệu thật lấy từ DB (tag `TRUNG HÙNG` 11.194,3 Kg/32 LOT + 360 Thùng(20kg)/18 LOT, và chuỗi `TRUNG HÙNG>@>XẤU` 466 Kg/1 LOT cho SKU `HH1010101.02.004`): cây ra đúng 3 cấp như mong đợi, không còn dòng sản phẩm trùng ở lá, tổng cấp cha `11.660,3 Kg = 11.194,3 + 466` khớp.
- Chưa bấm thử trên trình duyệt vì cần phiên đăng nhập của người dùng.

## Chốt cây Mã phụ: gộp 1 sản phẩm = 1 dòng, số LOT không cộng trùng

Người dùng chỉ ra hai lỗi còn lại của mục trên (ảnh chụp 2 dòng trùng mã SKU): hai dòng cùng SKU dưới `TRUNG HÙNG` phải **gộp thành một dòng sản phẩm 33 LOT**, và tag con `XẤU` **không được** sinh thêm một dòng sản phẩm lồng bên trong nó.

Quy tắc nghiệp vụ đã chốt: `TRUNG HÙNG` (tag lớn) **chứa sản phẩm**; `TRUNG HÙNG>@>XẤU` nghĩa là `TRUNG HÙNG` chứa sản phẩm đó và **trong sản phẩm đó** chứa tag `XẤU` — đúng cấp bậc cha → con.

### src/app/api/inventory/by-tag/route.ts

- Mỗi nhóm sản phẩm trong một tag vốn đã gom `lotCodes` (mã pallet distinct) để tính `lotCount`, nhưng chỉ trả `lotCodes.length`. Nay gửi kèm mảng `lotCodes` để UI gộp được các dòng đơn vị khác nhau của cùng SKU mà không cộng trùng LOT.
- Chi phí đo được: tổng số bộ `(tag, SKU, đơn vị, LOT)` distinct toàn phân hệ Kho Đông là **1.060** (tag cấp dòng) + **1.057** (nhóm "Chưa gắn mã") ≈ 2,1 nghìn chuỗi mã pallet, không làm phình response.

### src/components/inventory/InventoryByTag.tsx

- `HierarchyNode` đổi `lotCount: number` → `lotCodes: Set<string>`; dòng sản phẩm hiển thị `node.lotCodes.size`. Nhờ `ensureNode` memo theo đường đi (`TRUNG HÙNG > @::SKU`), hai dòng đơn vị Kg và Thùng của cùng SKU trỏ về **cùng một node** nên Set tự khử trùng: `32 LOT (Kg) ∪ 1 LOT (chuỗi XẤU) = 33`.
- Đường đi của node sản phẩm dựng từ cấp `@` luôn dùng `sku` **không** gắn hậu tố đơn vị, nên các đơn vị khác nhau của cùng SKU gộp làm một.
- Điều kiện gắn node sản phẩm vào cuối chuỗi đổi từ "nút cuối không phải cấp @" → "**chuỗi không có segment `@` nào**" (`hasSkuSegment`). Đây chính là bug sinh ra `[SP ... ] 1 LOT` lồng dưới `XẤU`: chuỗi `TRUNG HÙNG>@>XẤU` kết thúc bằng tag thường nên bị coi là tag một cấp.
- Gộp vòng lặp segment cho gọn: mỗi cấp (tag thường hoặc sản phẩm) đều cộng số lượng vào node vừa dựng, nên cấp cha luôn bằng tổng các cấp con (`11.660,3 Kg = 11.194,3 + 466`).

### Kiểm chứng

- Phân loại toàn bộ chuỗi `lot_tags` đang có trong DB: **1.088 dòng dạng một cấp không `@`** (56 tag distinct) và **1 dòng dạng `A>@>B`** → bộ dựng cây phủ 100% hình thái dữ liệu thật, không nhánh nào rơi ra ngoài.
- Chạy lại script Node dựng cây bằng chính dữ liệu thật trích từ psql (kèm mảng mã pallet), kết quả đúng cây mong muốn:

```
TRUNG HÙNG                                            11.716,9 Kg
TRUNG HÙNG                                              360 Thùng (20kg)
  [SP HH1010101.02.004 | Sầu riêng... | 33 LOT]      11.660,3 Kg
      XẤU                                                466 Kg
  [SP HH101020104.002 | ... | 10 LOT]                  300 Thùng (20kg)
  [SP HH101020104.001 | ... | 2 LOT]                    60 Thùng (20kg)
  [SP HH1010102.02.004 | ... | 1 LOT]                   56,6 Kg
```

  Dòng `XẤU` không còn node sản phẩm lồng dưới; `lotCodes` của node 33 LOT in ra đúng 33 mã distinct.
- `npx tsc --noEmit` sạch trên 2 file đã sửa (lỗi TS2349 do dòng `(product.lotCodes || []).forEach` bị nối với lệnh trước đó đã đổi sang `for...of`).
- Không đụng luồng Kho Đông Lạnh ở phía ghi dữ liệu: chỉ đổi API đọc + component đọc của tab Mã phụ.
- Chưa bấm thử trên trình duyệt vì cần phiên đăng nhập của người dùng; xác minh hộ trên `http://localhost:3001/inventory` tab "Tồn theo Mã phụ" (bấm `TRUNG HÙNG` → dòng SKU 33 LOT → bấm tiếp ra `XẤU`).

### Sửa tiếp: ô tên bị trống ở các dòng đơn vị thứ 2 trở đi

Người dùng hỏi "vì sao có phần trống tên sản phẩm vậy" (ảnh: dòng `360 | Thùng (20kg)` của `TRUNG HÙNG` có ô tên trống). Nguyên nhân: mỗi dòng đơn vị là một `<tr>` riêng và ô tên chỉ in ở `rowIdx === 0`, các dòng sau để `<div className="w-4 h-4" />` thay thế nên tạo khoảng trống như thể thiếu dữ liệu.

`InventoryByTag.tsx` đổi sang gộp ô: `<td rowSpan={unitRows.length} className="px-4 py-3 align-top">` chỉ render ở dòng đầu, các dòng sau chỉ còn 2 ô số lượng + đơn vị. Toàn bộ khối tên (chevron, badge SKU, tên, `N LOT`, badge "N đơn vị") nằm trong ô gộp, `align-top` để nhãn luôn canh theo dòng số đầu tiên.

Kiểm chứng: `npx tsc --noEmit` sạch; dev server `:3001` đã biên dịch lại (bundle 11:28 có `rowSpan`). Lưu ý cùng lúc đó overlay `Runtime TypeError: ensureNode(...) is not a function` trong trình duyệt là **bundle stale** của bản code cũ `(product.lotCodes || []).forEach(...)` nối lệnh ASI với dòng phía trên; bản sửa `for...of` đã nằm trong bundle 11:13 và không còn mẫu `ensureNode(...)(` nào trong `.next`.

# Walkthrough: Tách bạch Mã Phụ khỏi Mã LOT Sản Xuất (bỏ nhóm giả `LSX:`)

Người dùng chốt nguyên tắc: **"mã phụ là mã phụ, mã lot sản xuất thuộc trang khác"**. Trang Quản lý Mã Phụ (`/warehouses/lot-codes`) vốn đã sạch, nhưng **tab Tồn theo Mã phụ** lại đang chứa nhóm mã sản xuất.

## Hiện trạng đo được trước khi sửa

- `master_tags` Kho Đông: 69 dòng, **0 dòng** là mã SX/`LSX:`/`MERGED_`/`SPLIT` → trigger tự đăng ký không hề bị ô nhiễm.
- `lot_tags`: 1.102 dòng, **100% cấp dòng sản phẩm, 0 dòng cấp thẻ LOT**, 0 tag hệ thống → việc người dùng trước đây xóa chỗ gắn trùng vào thẻ LOT **không phải nguyên nhân** của các lỗi hiển thị (API vốn gộp bằng `new Set([...generalTags, ...specificTags])` nên trùng 2 cấp cũng chỉ tính 1 lần).
- Nguyên nhân thật: `by-tag/route.ts` **tự chế** tag giả `LSX: <production_code || batch_code || productions.code>` rồi đem gom nhóm như mã phụ → **28 nhóm LSX phủ 5.336 LOT (45% tồn Kho Đông)**, ví dụ `LSX: LSX010526` 1.002 pallet, `LSX: DONA 1 TÚI` 456 pallet, nằm lẫn với `TRUNG HÙNG`, `CONT1`...

## Thay đổi

1. `src/app/api/inventory/by-tag/route.ts`: xóa 3 dòng push `LSX:` (201-204) và bỏ `production_code, batch_code, productions (code)` khỏi select vì không còn ai dùng → tab Mã phụ trên màn hình chỉ còn đúng tag người dùng gắn + nhóm "Chưa gắn mã".
2. `src/app/print/inventory/page.tsx:514-521`: báo cáo in dùng chung một đoạn `lotTags` cho cả `lot`/`category`/`tags`, nên thêm điều kiện `if (type !== 'tags')` quanh chỗ push `LSX:`. Báo cáo in "Tồn theo Mã phụ" vì thế không còn cấp nhóm `◆ LSX:...`; các dòng rơi hết vào nhánh `nonLsxItems` và in thẳng tên mã phụ.
3. **Không đụng** tab Tồn theo LOT: `useInventoryByLot.ts:601-604` vẫn gắn chip `LSX:` và `InventoryTable.tsx:207-232` vẫn tách `LSX:` làm cấp nhóm cha, mã phụ là cấp con, dòng không tag ghi "Không có mã phụ" — đó là cách hiển thị đúng đã có sẵn, Phân hệ Kho Đông giữ nguyên.

## Kiểm chứng

- `npx tsc --noEmit` sạch trên 3 file (`by-tag/route.ts`, `InventoryByTag.tsx`, `print/inventory/page.tsx`).
- DB: số nhóm tag thật của Kho Đông = **61**, số nhóm `LSX:` còn trong `lot_tags` = **0**.
- Bundle dev `.next/dev/static/chunks/app/(dashboard)/inventory/page.js` chỉ còn 3 lần xuất hiện `LSX: `, cả 3 đều là `tagStr.includes('LSX: ')` / `parts.find(...)` của nhánh **tách chip trong tab LOT**, không còn chỗ nào **sinh** `LSX:` trong luồng mã phụ.
- Chưa bấm thử trình duyệt vì cần phiên đăng nhập của người dùng.

## Việc còn treo (đã báo cáo, chờ người dùng duyệt)

- **Không xóa** dữ liệu sản xuất: `production_lots` (88 dòng, tạo 30/05→29/08/2026) không có bảng nào FK tới nên xóa sẽ không báo lỗi mà âm thầm cắt liên kết của **5.292 LOT vẫn còn tồn**; `productions` (30 dòng) có FK từ `lots.production_id` (5.336 LOT) và `box_labels` (1.541 tem) nên xóa là mất lịch sử in tem; 20+ file đang đọc `production_lots` gồm `/production`, fresh-materials, delivery-settings, LotForm, Sơ đồ kho, Lệnh xuất kho, 4 trang in và `LotReconciliationTable`. Hướng an toàn nếu muốn "dẹp": tắt module `production_code` theo phân hệ, giữ nguyên data.
- **Chưa file nào** trong repo ghi quy tắc "mã phụ ≠ mã LOT sản xuất": `grep` toàn bộ `agents.md`, `docs/PROJECT_GUIDELINE.md`, `docs/developer_guide_modules.md`, `ARCHITECTURE.md`, `README.md` cho `mã phụ|lot_tags|master_tags` = 0 kết quả. `agents.md` mới chỉ có mục phân biệt các loại mã LOT (`production_code` vs `code` pallet vs `lot_code`).
- Tab mới "Tồn theo Mã SX": **tạm gác**, vì nguồn data là module đã bỏ không nhập liệu và `production_lots.lot_code` đang chứa cả mã pallet bị ghi nhầm (`DL-LOT-110526-4104` = 310 pallet).

# Walkthrough: Tab mới "Tồn theo Lệnh SX" (module bật/tắt theo phân hệ)

Người dùng yêu cầu: *"bạn làm riêng cho tôi 1 tab tồn theo lệnh sản xuất nữa đi, tôi xem thử"*. Tab này tách bạch hoàn toàn khỏi tab Mã phụ: nó gom theo **Lệnh sản xuất › Mã lot SX › Sản phẩm**, đúng nơi dữ liệu SX thuộc về.

## Tuân thủ kiến trúc dự án

- **Không hardcode mã kho**: tab chỉ hiện khi `hasModule('report_inventory_by_production')` trả về `true`. Định danh module khai báo ở `src/lib/report-modules.ts` (`is_basic: true`, icon `Factory`). Kho nào bật trong *Cài đặt phân hệ → Tính năng* thì tab tự hiện; kho tắt thì tab biến mất, giao diện cũ không đổi.
- **Cô lập dữ liệu theo phân hệ**: `src/app/api/inventory/by-production/route.ts` luôn lọc `system_code` (kèm alias FROZEN→KHO_DONG_LANH, DRY→KHO_VAT_TU_BAO_BI như các API tồn kho khác) và dùng `fetchAllWithPagination(...).order('id').range(...)` để né giới hạn 1.000 dòng của PostgREST.
- **Không đụng Kho Đông Lạnh**: toàn bộ là code đọc (API mới + component mới + 1 điều kiện render tab). Luồng nhập/xuất, form LOT, tab LOT/Mã phụ giữ nguyên.

## Thay đổi

1. **`src/app/api/inventory/by-production/route.ts` (mới)**: vì `production_lots` **không có FK** từ bảng `lots`, route phải tự dựng map: `productions (id, code, name)` + `production_lots (id, lot_code, production_date, production_id)`, rồi nối theo `lots.production_lot_id` / `lots.production_id`. Dự phòng: `lotCode = prodLot?.lot_code || lot.production_code || 'Không có mã lot SX'`, `orderCode = order?.code || 'Chưa gắn lệnh SX'`. Tìm kiếm hỗ trợ theo tên sản phẩm, mã SKU, mã pallet, mã lệnh, mã lot SX.
2. **`src/components/inventory/InventoryByProduction.tsx` (mới)**: bảng 3 cấp, mỗi cấp tách dòng theo từng đơn vị và gộp ô nhãn bằng `rowSpan` (rút kinh nghiệm từ lỗi "ô tên trống" của tab Mã phụ). **Không cộng dồn xuyên đơn vị** — `Kg` và `Thùng` luôn là dòng riêng; gộp đơn vị bằng `canonicalizeUnit` nên `Thùng (20kg)` và `Thùng (20 Kg)` tính chung một dòng. Số pallet lấy từ `Set<string>` mã kiện, không cộng `lotCount` (tránh lỗi 51 vs 33 LOT).
3. **`src/app/(dashboard)/inventory/page.tsx`**: import component, thêm `'production'` vào union type của `activeTab`, chèn tab có điều kiện `hasModule(...)`, mở điều kiện thanh lọc cho `activeTab === 'production'`.
4. **DB (đã tự áp)**: `update systems set report_modules = array_append(report_modules, 'report_inventory_by_production') where code = 'KHO_DONG_LANH'` → `UPDATE 1`. Bắt buộc ghi thẳng vì các phân hệ đã có mảng `report_modules` lưu sẵn nên giá trị `is_basic` mặc định không tự áp dụng. Trước: `{report_hall_summary, report_floor_1, report_warehouse_map_log, report_warehouse_movements, report_inventory_aging}`; sau: thêm `report_inventory_by_production`.

## Kiểm chứng

- `npx tsc --noEmit` sạch trên cả 5 file liên quan: `report-modules.ts`, `InventoryByProduction.tsx`, `by-production/route.ts`, `inventory/page.tsx`, `InventoryByTag.tsx`.
- Bundle dev `.next` chứa chuỗi `Tồn theo Lệnh SX` và route `by-production` → tab đã vào UI.
- Tên cột của route mới xác nhận bằng PostgREST qua Kong `:64321` (HTTP 200 cho `productions?select=id,code,name`, `production_lots?select=id,lot_code,production_date,production_id`, `lots?select=id,code,production_id,production_lot_id,production_code`). Mảng rỗng ở 2 bảng đầu là RLS với anon key, không phải lỗi schema.
- **Đối chiếu số học bằng SQL với tab Tồn theo LOT**: 2.127/2.127 dòng sản phẩm được gom (0 dòng rơi), và **đủ 10 đơn vị khớp tuyệt đối** — Kg 74.217,1 · Thùng (20kg) 23.561,0 · Thùng (13kg) 16.722,0 · Thùng (10kg) 12.799,0 · Thùng (20 Kg) 4.708,0 · Thùng (12kg) 3.017,0 · Sọt (30kg) 455,0 · Thùng 163,0 · Thùng (15kg) 42,0 · Thùng (9kg) 8,0.
- Chưa bấm thử trên trình duyệt vì agent không có phiên đăng nhập; người dùng vui lòng reload `http://localhost:3001/inventory` (hard reload) → tab "Tồn theo Lệnh SX".

## Còn treo

- Chưa làm trang in/Excel cho tab mới.
- Mới bật module cho KHO_DONG_LANH; các phân hệ khác muốn dùng phải bật trong *Cài đặt phân hệ → Tính năng*.
- Nguồn data vẫn là module SX đã ngừng nhập liệu, nên một số LOT sẽ vào nhóm "Chưa gắn lệnh SX" / "Không có mã lot SX" (kể cả các mã `DL-LOT-...` ghi nhầm sang `production_lots.lot_code`).

## Bổ sung bắt buộc: đăng ký module vào `app_modules` (nếu không, tab không hiện)

Kiểm tra lại logic `hasModule` ở `src/contexts/SystemContext.tsx:352-428` thì thấy: với module nhóm báo cáo, `hasModule` **chỉ cần** `systems.report_modules` chứa id **khi `isBasic` đúng**, mà `isBasic` lấy từ danh sách `BASIC_MODULE_IDS` + bảng `app_modules` (`select id from app_modules where is_basic = true`, dòng 74) — **không** lấy từ `is_basic` khai báo trong file TS. Module mới chưa có dòng trong `app_modules` → `isBasic = false` → `hasModule` trả `false` ngay ở dòng 421, tab sẽ **không bao giờ hiện** dù đã append vào `systems.report_modules`.

Đã sửa bằng migration `supabase/migrations/20261031130000_add_report_inventory_by_production_module.sql` (đã áp dụng và ghi lịch sử `supabase_migrations.schema_migrations`):
1. `INSERT ... ON CONFLICT (id) DO UPDATE` đăng ký `report_inventory_by_production` vào `app_modules` với `category='report'`, `is_basic=true` (đồng bộ `src/lib/module-sync.ts` cũng làm đúng việc này khi chạy).
2. `UPDATE systems ... array_append` cho `KHO_DONG_LANH`, có điều kiện `NOT (... = ANY(report_modules))` nên chạy lại không tạo trùng; kết quả thực tế `UPDATE 0` vì đã bật trước đó.

Cửa kiểm chứng sau khi sửa: `select id, is_basic from app_modules where id like 'report%'` → **7 dòng**, có `report_inventory_by_production = t`; `systems.report_modules` của `KHO_DONG_LANH` chứa id này. Module cũng xuất hiện trong *Cài đặt phân hệ → Tính năng → Báo cáo* vì `UnifiedSystemConfig.tsx:30` render toàn bộ `REPORT_MODULES`.

## Quy mô dữ liệu tab mới đo được (Kho Đông Lạnh, `status <> 'hidden'`)

- **11.857 LOT**: 5.336 có `production_id`, 5.292 có `production_lot_id`, nhưng **6.508 LOT (55%) không gắn cả hai** → vào nhóm "Chưa gắn lệnh SX" (**6.545 pallet, 118.484,1 sản phẩm**).
- **27 nhóm lệnh**, lớn nhất sau nhóm "chưa gắn": `LSX030526` 411 pallet/11.156,0 · `LSX190526` 658 pallet/2.640,0 · `LSX010626` 163 pallet/780,0 · `LSX040426` 51 pallet/660,0 · `LSX010426-2` 14 pallet/658,0.
- Bộ lọc trạng thái của route mới là `.neq('status','hidden')` — **giống hệt** `by-tag/route.ts:104`, nên số liệu tab Lệnh SX so sánh được trực tiếp với tab Mã phụ và tab LOT.
- Hệ quả: vì module sản xuất đã ngừng nhập liệu, phần lớn tồn kho nằm ở nhóm "Chưa gắn lệnh SX". Tab vẫn hữu ích để xem 5.336 LOT có truy xuất, nhưng người dùng cần biết con số 55% này trước khi đánh giá.

# Walkthrough: Hiện STT của LOT trong ô vị trí ở trang Kiểm kê nội bộ

## Thay đổi
- `src/app/(dashboard)/work/inventory/page.tsx`
  - `loadDetail`: thêm `daily_seq` vào select của `fetchInChunks('lots', ...)` và lưu `stt: decodeSTT(l.daily_seq)` vào `lotInfo[l.id]`.
  - `refreshPositionLot`: cùng thay đổi cho đường reload dữ liệu một ô (nút RefreshCw).
  - `renderInventoryPosition`: thêm chip STT màu hổ phách (`shrink-0`) ngay sau mã vị trí trên dòng 1 của card; chip chỉ hiện khi LOT có `daily_seq`.

## Tuân thủ kiến trúc
- **Không hardcode mã kho**: trang dùng `systemType` từ `useSystem()`; query lots đã lọc gián tiếp qua `lot_id` của `positions` thuộc `system_type` hiện hành. Không thêm điều kiện theo tên/mã kho.
- **Không cần module mới**: đây là thay đổi hiển thị thuần túy trên dữ liệu đã có (`lots.daily_seq`), không thêm schema, không thêm cột.
- **Cô lập phân hệ**: `lotInfo` chỉ chứa lot của các vị trí thuộc phiên kiểm kê đang mở → không rò rỉ dữ liệu phân hệ khác.
- **Kho Đông Lạnh**: thẻ STT dùng giá trị `daily_seq` người dùng đã nhập; khi LOT chưa có STT thì giao diện giữ nguyên như trước (không hiện chip, không hiện `--`).

## Kiểm chứng đã thực hiện
- `npx tsc --noEmit` → 0 lỗi trên file `work/inventory/page.tsx`.
- Chưa kiểm chứng UI trực tiếp: `localhost:3000` là bản build prod cũ (cần rebuild mới thấy thay đổi), và agent không có phiên đăng nhập.

# Walkthrough: Kiểm toán chức năng XUẤT FILE cho tab "Tồn theo Mã phụ" và "Tồn theo Lệnh SX"

Yêu cầu: "kiểm tra các chức năng xuất file đã hoàn thiện và đã đúng chưa (tồn kho theo mã phụ, tồn kho theo lệnh sản xuất)". Hai đường xuất đều đi qua cùng một pipeline: nút ở `src/app/(dashboard)/inventory/page.tsx:453-533` mở `/print/inventory?type=<tab>&export=excel`, trang in này tự tính dữ liệu rồi gọi `exportInventoryReportToExcel` (`src/lib/inventoryReportExcelExport.ts`) hoặc `window.print()`.

## 1. Lỗi tìm thấy và đã sửa — tab Mã phụ

**(a) Mã phụ bị "lan" giữa các dòng sản phẩm trong cùng một pallet (nghiêm trọng nhất).**
`src/app/print/inventory/page.tsx` cũ gán *toàn bộ* `lot_tags` của thẻ LOT cho *mọi* dòng hàng, nên tag gắn ở cấp dòng (`lot_tags.lot_item_id`) bị rơi sang các dòng khác cùng pallet.
Đo trên Kho Đông Lạnh (`systems.code='KHO_DONG_LANH'`, `status='active'`): 45 LOT có hơn 1 dòng, 18 LOT trong đó có các dòng gắn tag khác nhau, hậu quả **24 dòng hàng / 378 sản phẩm** bị gán nhầm mã phụ trong file Excel và bản in.
Sửa: chỉ lấy tag không có `lot_item_id` (cấp thẻ LOT) —
```ts
const lotTags = (lot.lot_tags || []).filter((t: any) => !t.lot_item_id).map((t: any) => t.tag).filter(Boolean) as string[]
```
Đồng thời select thêm `lot_item_id` vào query `lot_tags` (dòng 447).

**(b) Mã LOT sản xuất bị tính nhầm thành mã phụ.**
Trước đây `LSX: <production_code>` luôn được push vào danh sách tag. Vì đã chốt "mã phụ là mã phụ, mã lot sản xuất thuộc trang khác" nên nay chỉ push khi `type !== 'tags'` — tab Mã phụ (màn hình, Excel, bản in) không còn nhóm theo mã SX nữa; tab LOT/Danh mục giữ nguyên hành vi cũ.

**(c) Tiêu đề Excel sai.** `data.type === 'tags'` rơi vào nhánh `category` và in ra "BÁO CÁO TỒN KHO THEO DANH MỤC". Đã thêm nhánh `'tags'` → **"BÁO CÁO TỒN KHO THEO MÃ PHỤ"** (`inventoryReportExcelExport.ts:149-157`).

**(d) Cột "Mã phụ / Phân loại".** Với `type='tags'` cột này vẫn hiển thị (chuỗi tag đã làm phẳng, ví dụ `TRUNG HÙNG; XẤU`); riêng chế độ tổng hợp LOT thì ẩn — `showTags = data.type !== 'category' && !isLotSummary`.

## 2. Thiếu và đã bổ sung — tab Lệnh SX

Trước khi kiểm toán, tab này **không có** đường xuất nào: `type='production'` không tồn tại trong union type của file Excel và trang in không có khối render. Đã bổ sung đủ hai đầu:

- `inventoryReportExcelExport.ts`: thêm `'production'` vào union `type`; bộ 9 cột mới STT | Mã Lệnh SX | Mã Lot SX | Ngày SX | Mã SP | Tên sản phẩm | ĐVT | Số lượng | Số kiện (dòng 79-); ghi dữ liệu phẳng theo bộ ba (lệnh, lot SX, sản phẩm) ở dòng 747-; **tổng cộng theo từng ĐVT**, không phải một con số gộp (`unitTotals`, dòng 776-, key = `canonicalizeUnit(unit)` nên "Thùng (20kg)" và "Thùng (20 Kg)" về cùng một dòng TỔNG CỘNG).
- `print/inventory/page.tsx`: dựng bảng 7 cột (STT | Mã Lot SX | Mã SP | Tên sản phẩm | ĐVT | Số lượng | Số kiện), mỗi lệnh SX có một dòng header `◆ LỆNH SX: ... — ... · N mã lot SX • M kiện`; `handleExportExcel` nhận `productionItems` và điều kiện auto-export đã tính `productionItems.length > 0`.
- Ngày SX trong Excel hiển thị `dd/MM/yyyy` qua helper `formatDmy` (dòng 23) — thay cho `toLocaleDateString('vi-VN')` vốn không bù 0 và không xác định giữa các môi trường Node.

## 3. Sửa quy tắc "không cộng chéo đơn vị" ở API

`src/app/api/inventory/by-production/route.ts` trước đó trả `totalQuantity` cộng `p.quantity` của mọi sản phẩm bất kể ĐVT (Thùng + Kg + Sọt ra một số vô nghĩa). Đã bỏ hẳn `orderTotal`/`totalQuantity`; người dùng chỉ thấy tổng theo từng ĐVT, đúng quy tắc đã chốt cho mọi view tồn kho.

## 4. Kiểm chứng đã thực hiện

- **Unit test mới** `src/lib/__tests__/inventoryReportExcelExport.test.ts` — 5 test, **tất cả pass**. Test mock `file-saver` rồi **đọc lại workbook** bằng `ExcelJS.xlsx.load(blob.arrayBuffer())` để kiểm tra ô thực tế: 9 header; mỗi (lệnh, lot SX, SP, ĐVT) một dòng; `kgRow[8]=100` (số kiện), `kgRow[9]=1`; ngày `03/05/2026` có bù 0; **hai** dòng TỔNG CỘNG = 50 *Thùng (20kg)* và 100 *Kg*, không bao giờ ra 150; hai cách viết "Thùng (20kg)"/"Thùng (20 Kg)" gộp một dòng; tiêu đề đúng cho `tags` và `lot`.
- `npx tsc --noEmit` lọc trên các file touched (`inventoryReportExcelExport`, `by-production`, `print/inventory`, `InventoryByProduction*`, `(dashboard)/inventory/page`) → **0 lỗi**. (Toàn repo vẫn còn hàng trăm lỗi tsc cũ không liên quan — xem memory "tsc is not a clean gate".)
- `npx vitest run` toàn suite → 64 pass, 2 fail cũ ở `WarehouseSearchReportModal.test.tsx` (có trước, không liên quan).
- **Đối chiếu số liệu bằng dữ liệu thật** qua `/print/inventory?type=tags` (trang in public, chạy được không cần login): tổng theo từng ĐVT khớp **chính xác** với baseline SQL — Kg 73.906,109 · Thùng(20kg) 28.398 (= 23.690 + 4.708) · Thùng(13kg) 16.955 · Thùng(10kg) 11.779 · Thùng(12kg) 3.017 · Sọt 408 · Thùng 163 · Thùng(15kg) 42 · Thùng(9kg) 8; tổng danh mục 134.676,109. Không còn nhóm `◆ LSX:` nào; chuỗi tag làm phẳng đúng dạng `▪ TRUNG HÙNG; XẤU`; và thấy rõ kết quả của fix (a): `▪ 5 TRÁI ANH XỨNG` còn **3** sản phẩm thay vì 36.
- **Đúng về mặt số học của sheet Mã phụ**: mỗi dòng Excel là một *tổ hợp tag phân biệt*, nên tag cha và tag con không bao giờ bị cộng hai lần; dòng nhóm tính theo (SKU × ĐVT chuẩn hóa).

## 5. Giới hạn còn lại (cần người dùng quyết)

1. Tab Lệnh SX (cả màn hình, Excel lẫn bản in) **không áp** bộ lọc `categoryIds`, `zoneId`, `dateFrom/dateTo`. Ba đầu vào này vẫn được nút xuất gửi đi nhưng route bỏ qua → màn hình và file luôn khớp nhau, chỉ là không lọc được.
2. Trang in vẫn tải **toàn bộ lots** rồi lọc `system_code` bằng JS (`print/inventory/page.tsx:486-494`), query ở dòng 442 không có `.eq('system_code', ...)` server-side — trái với tinh thần "query PHẢI lọc system_code" trong `agents.md`. Chưa sửa vì đụng đường dẫn của tab LOT/Mã phụ/Danh mục đang dùng ổn định.
3. Bộ lọc trạng thái khác nhau giữa màn hình (`neq hidden`) và trang in (`eq active`). Kiểm tra an toàn: các lot đã xuất (9.805) và lot `KHO_DUNG_CU` trạng thái "Đã xuất hết cho công trình" (59) đều có **0 dòng / 0 số lượng**, nên hiện tại hai con số trùng nhau.
4. Mọi báo cáo xuất ra **cùng một tên file** `Ton_kho_<ISO date>.xlsx` → rất dễ ghi đè; nên thêm hậu tố theo loại báo cáo.
5. `type === 'labels'` không nằm trong điều kiện auto-export (lỗi có trước, chưa đụng).
6. Sheet Excel Mã phụ vẫn là danh sách phẳng theo tổ hợp tag, **không** dựng cây lồng như màn hình (cha → SKU → con). Chủ động chọn: Excel phẳng dễ lọc/pivot hơn; chỉ đổi nếu người dùng yêu cầu.

## 6. Tuân thủ kiến trúc

- Không hardcode mã kho: đường xuất mới chỉ kích hoạt khi `hasModule('report_inventory_by_production')`; không có điều kiện theo `code === 'KHO_DONG_LANH'`.
- Kho Đông Lạnh: fix (a)+(b) **có** thay đổi số liệu tab Mã phụ — theo hướng sửa số sai thành số đúng (378 sản phẩm bị gán nhầm). Toàn bộ loại báo cáo khác (`lot`, `category`, `accounting`, `labels`) giữ nguyên từng cột; đã chốt bằng test tiêu đề + baseline đối chiếu.
- Cô lập phân hệ: route `by-production` lọc `system_code` server-side bằng `.eq('system_code', systemType)`; chỉ thêm module `report` vào `app_modules`/`systems.report_modules`.
- Không đụng dữ liệu: không xóa `productions` / `production_lots`; không migration nào sửa cột hay dòng dữ liệu tồn kho.
