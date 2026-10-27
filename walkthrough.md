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
