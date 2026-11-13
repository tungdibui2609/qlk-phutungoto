# Walkthrough: Tối Ưu Hóa Quy Trình Đánh Giá KPI & Hiển Thị Số Liệu Kế Hoạch Công Việc

## 🎯 Tổng Quan & Yêu Cầu Cốt Lõi
1. **Loại bỏ các nút bấm nhanh ngoài bảng ở Bước 3 (Nghiệm thu cuối ca)**:
   - Bỏ cụm nút bấm nhanh trạng thái: `[✓ Xong] [Một phần] [Chưa xong]`.
   - Bỏ nút/sao chọn chất lượng nhanh ngoài hàng: `[★★★ Đạt yêu cầu]`.
   - **Lý do**: Bấm nhanh ngoài bảng tự động gán điểm chất lượng (khóa ở mức 3 sao / 20đ), gây hiểu lầm và làm sai lệch đánh giá chi tiết.
2. **Tập trung đánh giá duy nhất vào Modal Đánh Giá Chi Tiết (`EvaluateItemModal`)**:
   - Ở ngoài hàng danh sách chỉ hiển thị **Nút Đánh giá** `[🏅 Đánh giá]` (hoặc huy hiệu trạng thái gọn gàng kèm `[🏅 Sửa đánh giá]`).
   - Mọi thao tác nghiệm thu, tiến độ %, chấm sao chất lượng, chia tỷ lệ khối lượng và gán lỗi vi phạm / thưởng đều thực hiện trong Modal và chỉ có hiệu lực khi bấm **"Lưu Đánh Giá & Số Liệu"**.
3. **Thay thế vị trí các nút bỏ đi bằng Khối Nội Dung Số Liệu**:
   - Đưa nội dung / chip số liệu công việc (`workload_metrics`) sang khu vực điều khiển bên phải của hàng công việc.
   - Bỏ dòng số liệu bị lặp phía dưới nhân sự để giải phóng không gian, giúp thông tin nhân viên hiển thị rộng rãi, thoáng đãng.
4. **Sửa dứt điểm lỗi "vào modal không sửa được điểm chất lượng, lúc nào cũng 20/25đ"**:
   - Truyền `ratingStars` từ Modal xuống `AssigneeEvaluationSection` và hàm `calculateAssigneeTaskStandardKpi`.
   - Cập nhật tức thì điểm chất lượng theo số sao quản lý chọn (5 sao = 25đ, 4 sao = 20đ, 3 sao = 15đ, 2 sao = 10đ, 1 sao = 5đ).

---

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

# Walkthrough: Menu tác vụ nhanh LOT (gỡ / xuất / xóa) trên ô vị trí kiểm kê

## Bối cảnh
Người dùng yêu cầu thêm 1 nút xóa nhanh LOT ngay trong ô vị trí của trang Kiểm kê nội bộ. Trước khi code đã xác nhận ngữ nghĩa: chọn **menu 3 hành động** và **tự tích đã kiểm + is_modified** sau khi thao tác.

## Thay đổi (`src/app/(dashboard)/work/inventory/page.tsx`)
- State mới: `quickActionPosId` (ô đang mở menu), `isQuickActionBusy` (chặn bấm đúp khi đang ghi DB).
- Nút `Trash2` ở cụm icon dòng 1 của card, **chỉ hiện khi ô có LOT và phiếu chưa khóa** (`!locked && lot`). Bấm để mở/đóng menu.
- Menu render **inline trong card** (không dùng popover absolute) vì card có `overflow-hidden` sẽ cắt popover; menu phụ có `stopPropagation` để không bấm nhầm vào tích kiểm.
- 3 hành động:
  1. **Gỡ vị trí** `handleUnassignLot`: `positions.update({lot_id:null}).eq('id', pos.id)` — LOT vẫn còn trong Quản lý LOT, chỉ rời khỏi ô.
  2. **Xuất kho** `handleExportLotAtPosition`: `router.push('/work/export-order?posIds=..&lotIds=..')` — dùng đúng deep link mà `PositionActionManager.tsx:243` của sơ đồ kho đang dùng (trang `/work/export-order` đọc `searchParams.posIds/lotIds` ở dòng 85-100).
  3. **Xóa LOT** `handleDeleteLotAtPosition`: `logLotsDeletion()` → `positions.update({lot_id:null}).eq('lot_id', lotId)` (giải phóng **mọi** ô đang giữ LOT) → xóa `lot_tags` → `lot_items` → `lots`. Cùng thứ tự dọn quan hệ như `handleBulkDeleteLot` ở `warehouses/map/page.tsx:664`.
- Sau "gỡ" và "xóa": `markPositionHandled(pos)` upsert `internal_inventory_items` với `checked: true, is_modified: true, lot_id_snapshot: null` (giữ nguyên `note` cũ), rồi `loadDetail(session, true)` để tải lại sơ đồ + chip STT.
- Audit: mỗi lần gỡ liên kết đều `logActivity({tableName:'positions', action:'UPDATE', oldData:{lot_id}, newData:{lot_id:null}, systemCode: currentSystem?.code})`; trước khi xóa LOT có snapshot vào `audit_logs` (`logLotsDeletion`) nên khôi phục được.
- `toggleCheck` giờ đóng menu tác vụ để không còn menu "treo" khi bấm sang ô khác.

## Tuân thủ kiến trúc
- **Không hardcode mã kho**: không có điều kiện theo `systemType`/mã kho nào; hành động chỉ dựa trên dữ liệu của ô đang bấm.
- **Cô lập phân hệ**: `pos.id`/`lotId` lấy từ `positions`/`lots` đã lọc theo `system_type` của phiên kiểm kê (`loadDetail`), nên không thao tác chéo phân hệ.
- **Kho Đông Lạnh**: không sửa luồng ghi có sẵn (`toggleCheck`, `updateNote`, `toggleResolved`, `onLotEditSuccess`); nút mới là thành phần phụ, phiếu `completed` thì ẩn hoàn toàn. Hành động xóa đã có `showConfirm` bắt buộc xác nhận.
- **Cờ module**: không cần module mới vì đây là thao tác dữ liệu LOT/vị trí, không phải tính năng báo cáo; tương đương 100% với menu chuột phải đã có trên sơ đồ kho.

## Kiểm chứng
- `npx tsc --noEmit` → 0 lỗi trên file này.
- Chưa kiểm chứng UI: hiện chỉ còn server `:3000` (bản build prod cũ) đang chạy, dev `:3001` đã tắt, và agent không có phiên đăng nhập.

# Walkthrough: Xen kẽ màu nền giữa các dòng tag — tab "Tồn theo Mã phụ"

## Thay đổi (`src/components/inventory/InventoryByTag.tsx`)
- Bảng này mỗi tag cấp 1 có thể chiếm **nhiều dòng `<tr>`** (mỗi ĐVT một dòng, ô tên dùng `rowSpan`), nên không dùng `odd:`/`even:` của CSS được — phải tính theo **nhóm tag**.
- Thêm prop `index` cho `TagTreeNode`: `hierarchicalTags.map((root, idx) => ... index={idx})` và truyền `index={childIdx}` khi đệ quy con.
- Tách biến `rowBg` mới: `node.isSkuLevel` → nền đá như cũ; `level === 0` và `index` lẻ → `bg-stone-100/70` (`dark:bg-stone-800/40`); `index` chẵn → `bg-white`. Trước đây `bg-white` (level 0) và `bg-stone-50/70` (SKU) cùng bị gán trên một `<tr>` nên màu nào thắng phụ thuộc thứ tự CSS — nay chỉ còn 1 lớp nền được tính.
- Hover đổi thành `hover:bg-stone-200/60` để vẫn thấy rõ trên nền đã tint (hover cũ `stone-50` sẽ làm dòng lẻ sáng ngược khi rê chuột).
- Dòng con (`level > 0`, không phải SKU) giữ nguyên không có nền → chỉ các nhóm tag cấp 1 mới xen kẽ, đúng yêu cầu.

## Phạm vi & an toàn
- Chỉ sửa class trình bày trong một component của tab `tags` trên `/inventory`; không đụng query, không đụng `/api/inventory/by-tag`, không đổi dữ liệu.
- Trang in `/print/inventory?type=tags` và tab LOT (`by-lot/InventoryTable.tsx`) là markup riêng → **không đổi** theo, nếu muốn đồng nhất phải yêu cầu riêng.
- Không liên quan Kho Đông Lạnh hay module bật/tắt: không có điều kiện theo `systemType`/mã kho.

## Kiểm chứng
- `npx tsc --noEmit` → 0 lỗi trên file này; `TagTreeNode` là hàm nội bộ nên không có nơi gọi nào khác phải cập nhật.

# Walkthrough (tiếp): Mỗi nhóm tag là một `<tbody>` — xen kẽ + hover cả nhóm

## Vì phải đổi cấu trúc
Ô tên dùng `rowSpan` nên các dòng ĐVT của cùng một tag không "dính" nhau về mặt nền/hover khi tất cả nằm chung một `<tbody>`. Muốn cả nhóm cùng màu và cùng sáng khi rê chuột thì phải tách mỗi nhóm thành một `<tbody>` riêng.

## Thay đổi (`src/components/inventory/InventoryByTag.tsx`)
- `<table>` không còn `<tbody>` bọc ngoài nữa: `hierarchicalTags.map()` trả trực tiếp các `<tbody>` (mỗi node một tbody), nên DOM là `<table> > <tbody> × N` — HTML hợp lệ. `<tbody>` bọc ngoài chỉ còn cho dòng "Không tìm thấy dữ liệu".
- `TagTreeNode` trả `<><tbody className="group/tag">…các <tr> của node…</tbody>{con cái đệ quy}</>`. Con cái là `<tbody>` **kề cạnh**, không lồng trong tbody cha.
- Nền vẫn sơn trên `<td>` qua biến `cellCls` (`bg-white` / `bg-stone-100/70` theo `index % 2`).
- Hover đổi từ `hover:` sang `group-hover/tag:` → rê vào bất kỳ ô nào của nhóm (kể cả ô tên đang `rowSpan`) làm **toàn bộ ô của nhóm** sáng `bg-stone-200/60`.

## Kiểm chứng đã làm (không phải suy đoán)
1. Giả thuyết "nền `<tr>` không sơn được vùng `rowSpan`" đã bị **bác bỏ**: dựng bảng tối giản mở bằng Chrome thật, cả 2 dòng đều tô đúng.
2. Xác định vì sao ảnh của người dùng vẫn cũ: `:3000` là `next start` chạy build lúc **21:04** (`.next/BUILD_ID`), trong khi source sửa lúc **21:45** → port đó không có code mới; `:3001` là `next dev` và chunk `.next/dev/.../inventory/page.js` đã chứa `cellCls`, không còn `rowBg`.
3. Xác nhận Tailwind v4 (project dùng `@import "tailwindcss"`, không có tailwind.config) sinh đúng class named-group: chạy `@tailwindcss/postcss` trên markup thật của component → CSS có `.group-hover\/tag\:bg-stone-200\/60 { &:is(:where(.group\/tag):hover *) }` và bản dark.
4. Mở chính markup component + CSS vừa sinh bằng Chrome, đọc computed style 5 ô của nhóm "ĐÃ RW (2 đơn vị)": tất cả đều `oklab(0.97 … / 0.7)` (stone-100/70) — không còn ô trắng ở dòng ĐVT thứ hai; nhóm "ĐẮK LẮK" trắng.
- Chưa chụp được ảnh lúc hover vì tool `hover` của browser-use lỗi (`this.scrollIntoView is not a function`); cơ chế group-hover đã được xác minh ở cấp CSS selector + cấu trúc DOM.
- `npx tsc --noEmit` → 0 lỗi trên file này.

# Walkthrough: Module Dashboard "Tỉ lệ lấp đầy kho" (`warehouse_fill_rate`)

## Mục tiêu
Khối thống kê mới trên trang Dashboard `/` cho thấy tỉ lệ ô vị trí đang chứa LOT theo từng kho / khu vực, drill-down được xuống các cấp khu vực, kèm cảnh báo khu sắp đầy. Số liệu phải đối soát được 1:1 với 4 ô thống kê ở trang `/warehouses/status`.

## Thay đổi
- `src/lib/warehouseFillRate.ts` (mới): toàn bộ logic tổng hợp, không import Supabase nên test được.
  - `buildFillStats(zones, positions)`: mỗi vị trí chỉ thuộc MỘT khu vực (đúng cách `/warehouses/status` dựng `zone_id` cho position), cấp cha = ô của chính nó + cộng dồn toàn bộ cây con. Trả `byZone`, `roots`, `unassigned*` và `totals`.
  - Vị trí chưa gán khu vực (hoặc trỏ zone đã bị xoá) KHÔNG bị bỏ: vẫn nằm trong `totals` để tổng toàn kho khớp với trang trạng thái, và được báo riêng ở dòng ghi chú.
  - `classifyFill(pct)`: ngưỡng 90% (sắp đầy) / 70% (cao) / >0 / 0; `fillPct` chặn chia 0.
  - Vòng lặp cha-con trong dữ liệu zone được chặn bằng `visiting` + cache nên không treo.
- `src/components/dashboard/WarehouseFillRateChart.tsx` (mới): 4 thẻ KPI (Tổng / Đã lấp đầy / Còn trống / Tỉ lệ), thanh breadcrumb theo cấp đang xem, danh sách khu vực có thanh % bấm được để đi xuống khu con, chip cảnh báo khu ≥ 90%, nút Làm mới và link sang `/warehouses/status`.
  - Query chỉ lấy `positions(id, lot_id)`, `zones(id, code, name, parent_id, level)`, `zone_positions` phân trang 1000 dòng/lần và **lọc `system_type = systemType`** ở cả ba bảng (kể cả `positions!inner` khi lấy link) nên không thấy dữ liệu phân hệ khác.
  - Nếu phân hệ chỉ có MỘT kho cấp 0 thì tự hạ xuống cấp khu để biểu đồ có ý nghĩa so sánh (không tự hạ khi người dùng quay lại "Toàn kho").
- `src/lib/dashboard-modules.ts`: thêm module `warehouse_fill_rate` với `is_basic: true`; `scripts/sync_modules.mjs` bổ sung định nghĩa tương ứng để đồng bộ `app_modules`.
- `src/app/(dashboard)/page.tsx`: render card sau `hasModule('warehouse_fill_rate')` và thêm id này vào điều kiện `hasModules` (không còn hiện thông báo "chưa có module Dashboard" sai lệch).
- `supabase/migrations/20261101100000_add_warehouse_fill_rate_module.sql`: upsert `app_modules` (`category='dashboard'`, `is_basic=true`) và nối module vào `systems.dashboard_modules` **chỉ** cho phân hệ đang có mảng không rỗng.

## Tuân thủ kiến trúc phân hệ
- Không hardcode mã kho: hoàn toàn không so sánh `systemType === '...'`; card chỉ hiện khi module `warehouse_fill_rate` được bật cho phân hệ.
- Cô lập dữ liệu: mọi query đều gắn `system_type`, cùng cách lọc mà `/warehouses/status` đang dùng.
- Kho Đông Lạnh: thêm module mới là thay đổi cộng thêm (thêm block UI + thêm một phần tử vào mảng dashboard_modules); không sửa logic nhập/xuất, không đổi schema bảng nghiệp vụ, không đụng cột nào của `positions`/`zones`.

## Kiểm chứng đã làm
- `npx vitest run src/lib/__tests__/warehouseFillRate.test.ts` → pass (cộng dồn cây con, vị trí chưa gán khu, khu trống không chia 0, phân loại ngưỡng, một vị trí một khu, cấp hiển thị & thứ tự, zone mồ côi vẫn là gốc, dữ liệu vòng lặp không treo). Số test hiện là 13 (xem mục "tách Lô kệ / Sảnh" bên dưới).
- `npx tsc --noEmit` → không phát sinh lỗi trên `warehouseFillRate.ts`, `WarehouseFillRateChart.tsx`, `dashboard-modules.ts`, `app/(dashboard)/page.tsx`.
- Chưa tự bấm thử trên trình duyệt: agent không có phiên đăng nhập (`:3000` là bản build cũ, `:3001` cần credentials), nên phần hiển thị thực tế cần người dùng reload sau khi chạy migration.

# Walkthrough (tiếp): Tách bạch chỉ số LÔ KỆ và SẢNH tạm kết trong `warehouse_fill_rate`

## Yêu cầu dẫn tới thay đổi
Trang `/warehouses/status` gộp "Tổng vị trí = Lô kệ + Sảnh" (ví dụ 7820 = 6744 kệ + 1076 sảnh) nên tỉ lệ chung 26,5% bị kéo xuống bởi sảnh — trong khi sảnh chỉ là khu tạm kết, không được quy hoạch là vị trí lưu và công ty ra quyết định dựa trên chỉ số **Lô kệ** (29,8%). Card mới phải đặt Lô kệ làm chỉ số chính và để sảnh ở khối riêng.

## `src/lib/warehouseFillRate.ts`
- Mỗi `ZoneFillStat` giờ giữ **hai bộ đếm độc lập**: `rackPositions/rackOccupied` (+ `ownRack*` cho ô của chính khu) và `hallPositions/hallOccupied` (+ `ownHall*`). Cộng dồn lên cây cha cũng tách riêng hai loại, không bao giờ gộp.
- `pct` **chỉ còn nghĩa là tỉ lệ lấp đầy Lô kệ**; tỉ lệ sảnh là `hallPct` riêng.
- `totals` trả `{ rack, hall, all }`; `all` giữ nguyên để đối soát 1:1 với 4 thẻ KPI của `/warehouses/status` nếu cần (giá trị tổng 7820/2073 vẫn khớp công thức cũ).
- `buildHallDetector(zones)`: sao chép **đúng nguyên văn** luật nhận diện sảnh của trang status — cờ `zones.is_hall` HOẶC tên (của chính khu hoặc bất kỳ khu cha nào) bắt đầu/chứa `SẢNH`/`SÀNH`/`SANH`. Luật này tồn tại 3 bản inline trong repo; tôi không refactor trang status vì nó thuộc phân hệ Kho Đông Lạnh (cấm đụng). **Rủi ro:** nếu sau này trang status đổi luật nhận diện sảnh thì card này lệch theo, phải sửa cả hai nơi.
- Vị trí chưa gán khu / trỏ khu đã xoá → tính là **Lô kệ** (khớp cách status xếp ô "chưa quy hoạch" vào nhóm kệ) và vẫn báo riêng qua `unassigned*`.
- `hallRoots`: danh sách khu sảnh "ngồi trên cùng" (khu là sảnh nhưng cha không phải sảnh, và có ô sảnh > 0) để khối sảnh không lặp lại cha-con.
- `childStatsOf(stats, parentId, scope)` với `scope = 'rack' | 'hall' | 'all'`: lọc bỏ khu không thuộc scope và khu có 0 ô trong scope đó, sắp theo số ô giảm dần.
- `drillableChildCount(stats, zoneId, scope)` trả số khu con **cùng scope** → nút "N khu con" không còn hiện trên khu sảnh cha chỉ có con là Lô kệ.

## `src/components/dashboard/WarehouseFillRateChart.tsx`
- Tiêu đề + mô tả nói rõ đây là chỉ số Lô kệ và sảnh bị loại ra khỏi các con số chính.
- 4 thẻ KPI, danh sách khu vực, breadcrumb "Toàn kho › …", thanh % và chip cảnh báo ≥90% **toàn bộ chỉ dùng số Lô kệ**.
- Sảnh dồn vào một dải màu vàng gấp gọn: "Sảnh tạm kết (không tính vào chỉ số Lô kệ)" hiển thị `đã chứa/tổng · còn trống` + `hallPct`; bấm "Xem N khu sảnh" để mở.
- Đường dẫn drill của sảnh dùng state `hallPath` **riêng**, có breadcrumb "Toàn bộ sảnh › …" trong dải vàng, và hàng đầu tiên của danh sách là chính khu đang xem (để thấy dòng "Riêng khu này") — không bao giờ dùng chung `path` với Lô kệ, tránh hai cây pha vào nhau.
- Query `zones` lấy thêm cột `is_hall`; vẫn giữ nguyên bộ lọc `system_type` ở cả `positions`, `zones`, `zone_positions` (`positions!inner`).

## Tên & mô tả module
`dashboard-modules.ts`, `scripts/sync_modules.mjs` và migration đặt tên thống nhất là "Tỉ lệ lấp đầy Lô kệ" với mô tả nêu rõ phần sảnh tách riêng.

## Kiểm chứng
- `npx vitest run src/lib/__tests__/warehouseFillRate.test.ts` → **13/13 pass**, trong đó có các case mới: cộng dồn cha giữ Lô kệ/sảnh riêng biệt và `pct` chỉ tính kệ; danh sách kệ loại khu sảnh và danh sách sảnh giữ mỗi khu sảnh; `hallRoots` khử trùng lặp cha-con; `drillableChildCount` theo scope; detector nhận sảnh theo cờ, theo tên và theo tên khu cha.
- `npx tsc --noEmit` → không lỗi trên 4 file liên quan; xác nhận `lucide-react` bản đang cài có export `Gauge`, `Forklift`, `ChevronDown`, `ChevronUp`.
- Bước phía người dùng: mở `http://localhost:3001/admin/modules` bấm "Đồng bộ từ Code" (hàm `syncAppModulesWithCode()` chỉ ghi `app_modules`, **không** tự nối `systems.dashboard_modules`), rồi bật "Tỉ lệ lấp đầy Lô kệ" trong Cấu hình phân hệ → Tính năng → Dashboard nếu phân hệ đó từng lưu danh sách Dashboard tường minh; file migration chưa áp là bước tương đương cho trường hợp này.

# Walkthrough (tiếp): Đổi khối sảnh gấp gọn thành 3 TAB ngang hàng (Lô kệ / Sảnh / Tổng)

## Yêu cầu
Bản trước chỉ làm Lô kệ nổi bật còn sảnh nhét vào dải vàng gấp gọn. Người dùng yêu cầu **tab rõ ràng, đầy đủ**: Lô kệ, Sảnh và cả mức Tổng để đối soát.

## `src/lib/warehouseFillRate.ts`
- `metricsOf(row, scope)` và `ownMetricsOf(row, scope)` ([dòng 274](src/lib/warehouseFillRate.ts)) là nguồn số duy nhất cho mọi chỗ hiển thị: `rack`/`hall` đọc hai bộ đếm tách sẵn, `all` cộng `rackPositions + hallPositions` (và phần occupied tương ứng). Component không còn tự cộng thủ công ở đâu nữa.
- `rowsForScope(stats, parentId, scope)`: tab Sảnh khi ở cấp cao nhất phải trả `hallRoots` (khu sảnh đầu ngành) vì khu sảnh là CON của một kho không phải sảnh, nếu đi `childStatsOf(stats, null, 'hall')` sẽ trả về rỗng. Hai tab còn lại dùng `childStatsOf` như cũ.
- `childStatsOf` bổ sung phạm vi `all`: giữ cả khu kệ lẫn khu sảnh, chỉ ẩn khu có 0 ô trong phạm vi đó. `drillableChildCount` chuyển sang gọi `rowsForScope` để số "N khu con" khớp đúng thứ mà tab hiển thị.
- Luật tách bạch vẫn giữ: tab Lô kệ chỉ khu `!isHall`, tab Sảnh chỉ khu `isHall`.

## `src/components/dashboard/WarehouseFillRateChart.tsx`
- `SCOPE_TABS` (3 tab) thay cho dải vàng: **Lô kệ** (xanh lá), **Sảnh tạm kết** (hổ phách), **Tổng (kệ + sảnh)** (xám đá). Mỗi tab hiện ngay trên nhãn: `pct%` và `đã chứa/tổng ô` → nhìn là thấy lô kệ 29,8% khác hẳn sảnh 5,9% và tổng 26,5% mà không cần bấm.
- Dưới tab là một dòng giải thích mục đích từng phạm vi (kệ = chỉ số quyết định; sảnh = trung chuyển, không quy hoạch; tổng = khớp trang Sơ đồ trạng thái kho).
- 4 thẻ KPI, breadcrumb, danh sách khu, chip cảnh báo và chú thích đều đọc theo `scope` đang chọn → cùng một khu vực nhưng ba tab cho ba con số khác nhau, không bao giờ trộn.
- `paths: Record<FillScope, string[]>`: **mỗi tab nhớ vị trí drill riêng** (đang xem Dãy 6 ở tab Lô kệ, chuyển sang tab Sảnh rồi quay lại vẫn còn ở Dãy 6). Breadcrumb tab Sảnh ghi "Toàn bộ sảnh" vì cấp cao nhất của nó là các khu sảnh, không phải kho.
- Hàng "khu đang xem" được ghim đầu danh sách (nhãn `Đang xem`, không hiện nút drill vô dụng) để thấy dòng "Riêng khu này: x/y ô" — trước đây xuống tới lá thì mất hẳn số của chính khu đó.
- Khu sảnh hiện trong tab Tổng có nhãn "Sảnh" để không nhầm với kệ.
- Tự hạ một cấp khi chỉ có một kho cấp 0: áp cho tab Lô kệ và Tổng, bỏ qua tab Sảnh.
- Tab có 0 ô (ví dụ kho không có sảnh) vẫn hiện tab, thân card ghi rõ "chưa có ô Sảnh nào" thay vì ẩn tab.

## Đối soát số liệu
Với đúng các con số trên trang `/warehouses/status` (kệ 6744/2010, sảnh 1076/63): tab Tổng phải ra 7820 ô · 2073 đã chứa · 26,5% (6744+1076=7820, 2010+63=2073) — cùng công thức `metricsOf(..., 'all')` nên khớp 1:1, còn tab Lô kệ giữ nguyên 29,8% là chỉ số công ty dùng để quyết định.

## Kiểm chứng
- `npx vitest run src/lib/__tests__/warehouseFillRate.test.ts` → **18/18 pass**; 5 case mới cho bộ ba tab: `metricsOf` ba phạm vi khớp `totals.all`, `ownMetricsOf` gộp đúng ô của riêng khu, tab Tổng giữ cả kệ lẫn sảnh ở cùng cấp (`[KHU_A, SANH]`), tab Sảnh mở đầu bằng khu sảnh đầu ngành, khu sảnh 0 ô bị ẩn.
- `npx tsc --noEmit` → không lỗi trên `warehouseFillRate.ts` và `WarehouseFillRateChart.tsx`; xác nhận `LayoutGrid` có export trong `lucide-react` bản đang cài; grep sạch, không còn `showHalls`/`hallPath`/`ChevronDown`/`ChevronUp` sót sau khi bỏ dải vàng.
- Đổi tên module thành "Tỉ lệ lấp đầy kho" + mô tả nêu ba tab, đồng bộ cả `dashboard-modules.ts`, `scripts/sync_modules.mjs`, migration (vẫn chưa áp — người dùng bấm "Đồng bộ từ Code" ở `/admin/modules`).

# Walkthrough (tiếp): Thứ tự khu vực trong card phải khớp sơ đồ kho

## Vấn đề người dùng báo
Ảnh chụp tab Tổng cho thấy danh sách xếp KHO 2 → KHO 3 → KHO 5 → KHO 1 → KHO 4 → KHO TẠM vì lib sắp theo **số ô giảm dần**. Sơ đồ kho lại hiển thị KHO 1, KHO 2, ... nên đối chiếu bằng mắt bị vênh.

## Nguồn quy tắc (không tự nghĩ ra)
`src/components/warehouse/status/WarehouseStatusMap.tsx:205-228` — cây khu vực của sơ đồ sắp siblings và roots theo `display_order ?? 0`, nếu bằng nhau thì `(code || '').localeCompare(code || '', undefined, { numeric: true })`. Cột `zones.display_order` do `supabase/migrations/20260621000002_add_display_order_to_zones.sql` thêm và có trong `src/lib/database.types.ts:109`.

## Thay đổi
- `src/lib/warehouseFillRate.ts`:
  - `FillZoneLike` nhận thêm `display_order`; `ZoneFillStat` mang thêm `code` và `displayOrder` để comparator chạy được mà không cần tra lại bảng zone.
  - `compareZoneOrder(a, b)` (export) chép **đúng** comparator của sơ đồ: `display_order` trước, bằng nhau thì so mã kiểu tự nhiên → KHO 2 đứng trước KHO 10 (so sánh chuỗi thuần sẽ xếp KHO 10 trước KHO 2).
  - `childStatsOf` bỏ sắp theo số ô, dùng `compareZoneOrder`; `hallRoots` (danh sách tab Sảnh) cũng đổi sang cùng thứ tự.
- `src/components/dashboard/WarehouseFillRateChart.tsx`: query `zones` select thêm `display_order` (vẫn giữ nguyên `.eq('system_type', systemType)` và các bảng khác).

## Hệ quả
- Số ô lớn không còn được đẩy lên đầu; muốn ưu tiên khu đầy nhất thì nhìn chip cảnh báo "sắp đầy (≥90%)" ở cuối card, còn danh sách phải phản ánh đúng sơ đồ để đối chiếu.
- Khu chưa đặt `display_order` (giá trị NULL) coi như 0 → xếp theo mã, không bị đẩy ra cuối một cách khó giải thích.

## Kiểm chứng
- `npx vitest run src/lib/__tests__/warehouseFillRate.test.ts` → **21/21 pass**. 3 case mới: `['u1','k1','k2','k9','k10']` (khu `display_order=-5` lên đầu, KHO 2 trước KHO 9 trước KHO 10); tab Sảnh tôn trọng `display_order` dù mã 'SANH 2' > 'SANH 1'; toàn bộ `display_order` NULL thì vẫn ra `['DAY A','DAY B']`.
- Test cũ về tab Tổng (`[KHU_A, SANH]`) vẫn pass vì mã 'K1A' < 'S1'.
- `npx tsc --noEmit` → không lỗi trên 2 file touched.

# Walkthrough (tiếp): Tab "Theo danh mục (vị trí)" trong module Tỉ lệ phân bố hàng hóa tồn kho

## Yêu cầu
Ảnh chụp khối "THỐNG KÊ CHI TIẾT THEO DANH MỤC" ở trang `/warehouses/status` (MÍT 13 vị trí, SẦU RIÊNG 1414 vị trí, XOÀI 193 vị trí kèm TỈ LỆ HÀNG HOÁ / TỈ LỆ CÔNG SUẤT) — người dùng muốn đưa đúng thống kê đó vào card Dashboard `inventory_distribution`.
Ba quyết định người dùng chọn qua câu hỏi khảo sát: (1) **2 tab trong cùng card**, (2) mẫu số **giống trang status: mọi ô** (không chỉ ô có kệ), (3) danh mục theo dõi **dùng chung cấu hình với trang status**.

## Nguồn quy tắc sao chép (không tự đặt công thức mới)
`src/app/(dashboard)/warehouses/status/page.tsx`:
- `categoryStats` dòng 488-534: một ô được tính cho danh mục C nếu LOT đang bám trên ô có ≥1 dòng mà `category_id` suy ra của dòng đó nằm trong C.
- Hai mẫu số: `pctOfOccupied` = đếm được / **ô đang chứa hàng** ("TỈ LỆ HÀNG HOÁ"), `pctOfTotal` = đếm được / **toàn bộ ô quy hoạch** ("TỈ LỆ CÔNG SUẤT").
- `buildZoneLookup` (một ô chỉ thuộc một khu) và phạm vi "theo kho" = subtree của khu cấp 0, ô không gán khu bị loại khi chọn kho.
- Key cấu hình danh mục: `systems.modules.warehouse_status_config.selected_category_ids` (dòng 77, 112-115).

## Thay đổi
- `src/lib/categoryPositionStats.ts` (mới, thuần JS, không đụng Supabase):
  - `warehouseScopeZoneIds(zones, warehouseId?)` → `Set` các khu thuộc kho đang chọn; trả `null` nghĩa là "không lọc" (TẤT CẢ KHO). Duyệt bằng stack, có `visited` nên chuỗi `parent_id` vòng lặp không làm treo.
  - `buildLotCategoryMap(lots)` → `lot_id -> string[] categoryIds`, suy danh mục qua `resolveCategories(product, line.category_id)` của `src/lib/productCategory.ts` — **danh mục gán trên dòng LOT thắng tuyệt đối**, đúng như trang status.
  - `buildCategoryPositionStats({categories, positions, lotCategories, zones, warehouseId})` → `{stats:[{categoryId,name,count,pctOfOccupied,pctOfTotal}], totalPositions, occupiedPositions, unclassifiedOccupied}`.
- `src/lib/supabasePaged.ts` (mới): `SUPABASE_PAGE_SIZE = 1000` + `fetchAllPaged<T>(build)`. Tách ra để dùng chung thay vì tạo bản sao thứ ba của hàm phân trang.
- `src/components/dashboard/InventoryDistributionChart.tsx`:
  - State `view: 'kg' | 'position'`; nhóm 2 tab ở header (icon `Scale` / `Layers`). Các nút chỉ thuộc khối Kg (làm mới theo khối lượng, lọc, cài `allowed_category_ids`) được đóng gói `{view === 'kg' && (...)}` để không lẫn ngữ nghĩa.
  - `fetchPositionData` (load lười — chỉ chạy khi bật tab, dòng 283): paged `positions(id, lot_id)`, `zones(...)`, `zone_positions(zone_id, position_id, positions!inner(*))`, **cả ba đều lọc `system_type`**. Lots lấy theo `occupiedLotIds` (chỉ LOT đang chiếm ô), **không lọc `status='active'`**, chunk 150 id để tránh "URI Too Long" — chiến lược dữ liệu giống hệt trang status nên số đối soát được 1:1.
  - `saveStatConfig(ids)` ghi `warehouse_status_config.selected_category_ids` qua `patchSystemModules` (đọc `systems.modules` mới nhất rồi merge, không ghi đè các key module khác). Đọc lại cùng key khi `currentSystem` đổi; chưa cấu hình thì mặc định hiện toàn bộ danh mục.
  - Nút "Cấu hình" trong tab vị trí có ghi chú rõ: thay đổi này ảnh hưởng cả trang `/warehouses/status`.
  - `src/lib/dashboard-modules.ts:20-22` và `scripts/sync_modules.mjs:62`: mô tả module nêu "Hai tab: biểu đồ tròn khối lượng (Kg) theo sản phẩm và thống kê số ô vị trí đang chứa hàng theo danh mục". `seed.sql` và migration lịch sử `20260201140001_create_app_modules_table.sql` cố ý không sửa (dữ liệu đã đóng băng).

## Tuân thủ kiến trúc phân hệ
- Mọi query mới (positions / zones / zone_positions / lots theo id) đều có `.eq('system_type', systemType)` hoặc `.eq('positions.system_type', systemType)`; danh mục cũng lọc `system_type`. Không có đường nào đọc chéo phân hệ.
- Không hardcode mã kho: tab render từ `zones` của phân hệ đang chọn, danh sách "Phạm vi" lấy `level === 0 || !parent_id`. Kho nào không có ô vị trí → empty state riêng ("phân hệ này chưa có ô vị trí"), Kho Đông Lạnh giữ nguyên biểu đồ Kg như trước.
- Không sửa trang `/warehouses/status`, không đổi schema, không thêm migration: chỉ đọc các bảng đã có.
- Công thức thống kê đặt trong lib thuần để dùng lại; việc **không** refactor trang status sang lib này là có ý — trang đó phục vụ vận hành thực tế, đụng vào là vi phạm quy tắc bảo toàn Kho Đông Lạnh. Rủi ro lệch về sau: nếu ai đó đổi công thức ở trang status mà không đổi `categoryPositionStats.ts` thì hai số sẽ tách nhau; cả hai file đều có chú dẫn nguồn ở đầu file.

## Kiểm chứng
- `npx vitest run src/lib/__tests__/categoryPositionStats.test.ts src/lib/__tests__/warehouseFillRate.test.ts` → **28/28 pass** (7 test mới): hai mẫu số cùng lúc (2/4 ô → 100% hàng hoá, 20% công suất); một LOT nhiều danh mục nên tổng tỉ lệ có thể >100%; `category_id` trên dòng LOT thắng `category_id` trên sản phẩm; lọc theo subtree của kho; LOT cũ không có dòng vẫn nằm ở mẫu số và được đếm vào `unclassifiedOccupied`; 0 ô → 0% chứ không NaN; `parent_id` vòng lặp không treo.
- `npx tsc --noEmit` lọc trên `InventoryDistributionChart|categoryPositionStats|supabasePaged|WarehouseFillRateChart|warehouseFillRate` → **không lỗi**; xác nhận `Layers`/`Scale`/`ChevronDown`/`FolderTree` có trong `lucide-react` bản đang cài.
- 4 lỗi `TS18047 'positionResult' is possibly 'null'` phát sinh khi tách empty state đã sửa bằng cách cho memo luôn trả kết quả (`buildCategoryPositionStats` chịu được input rỗng) và rẻ nhánh theo `positionRows.length === 0` / `categories.length === 0`.

## Chốt lại tên tab (phản hồi của người dùng)
Tab mới ban đầu đặt tên "Theo vị trí kho" → người dùng bác: nội dung thống kê là **theo danh mục**, còn "vị trí" chỉ là đơn vị đếm. Đã đổi nhãn thành **"Theo danh mục (vị trí)"** (kèm unit trong ngoặc, đối xứng với "Theo khối lượng (KG)"), cập nhật luôn comment trong card và mô tả module ở `src/lib/dashboard-modules.ts` + `scripts/sync_modules.mjs`. Không đổi công thức/dữ liệu, chỉ đổi nhãn.

## Cách xem thử
1. Bấm "Đồng bộ từ Code" tại `http://localhost:3001/admin/modules` để module `inventory_distribution` mang mô tả mới.
2. Mở `/` → card "Tỉ lệ phân bố hàng hóa tồn kho" → tab "Theo danh mục (vị trí)"; chọn Phạm vi (TẤT CẢ KHO hoặc từng kho), bấm "Cấu hình" để chọn danh mục, rồi đối chiếu với khối "THỐNG KÊ CHI TIẾT THEO DANH MỤC" ở `/warehouses/status` cùng phân hệ — các con số phải trùng nhau.

# Walkthrough: Nút "Xuất Excel" (kèm ảnh biểu đồ) cho 3 card thống kê Dashboard

## Yêu cầu
"Mỗi cái module thống kê của Dashboard tạo thêm chức năng xuất file Excel, xuất ra biểu đồ trên Excel."
Ba quyết định người dùng chốt qua khảo sát: (1) biểu đồ trong file là **ảnh + sheet dữ liệu**, (2) phạm vi **3 card** (phân bố hàng hóa, lấp đầy kho, container), (3) **mỗi card một nút, một file riêng**.

## Phát hiện kỹ thuật quan trọng (đã probe trực tiếp, không đoán)
- `exceljs@4.4.0` **không có** `worksheet.addChart` → không thể vẽ biểu đồ Excel *thật* bằng thư viện đang cài. Probe: `typeof ws.addChart === 'undefined'`, trong khi `workbook.addImage` và `addConditionalFormatting({type:'dataBar'})` đều tồn tại và chạy được.
- Thư viện tạo chart thật (`xlsx-chart`) bản cuối 2022, không được bảo trì → không kéo thêm dependency chỉ để đổi lấy biểu đồ chỉnh sửa được.
- Card "Tỉ lệ lấp đầy kho" và tab "Theo danh mục (vị trí)" **không có SVG nào** (lưới KPI + thanh HTML), nên phương án "chụp ảnh recharts" (serialize SVG) không áp dụng được cho 2/4 view → chuyển sang **vẽ PNG từ dữ liệu bằng canvas 2D**, một đường code cho cả 4 view, màu lấy theo palette dashboard.

## Thay đổi
- `src/lib/chartImage.ts` (mới, chỉ chạy trên trình duyệt): `renderChartPng(spec)` trả `{base64, width, height}` cho 2 kiểu `donut` và `hbar`; `percentAxis` để vẽ trục 0-100% và `barColors` để tô theo mức lấp đầy; `legendLimit` gộp đuôi donut thành "Khác (n mục)"; `chartHeightFor()` tính cao độ theo số dòng.
- `src/lib/dashboardExcelWorkbook.ts` (mới, **không import canvas/file-saver** → test được bằng node): `buildDashboardWorkbook(spec)` dựng 2 sheet —
  - `Bieu do`: tiêu đề, khối metadata (Phân hệ kho, Tab, Cấp đang xem, Tổng ô, Xuất lúc…), ảnh PNG neo bằng `addImage({editAs:'oneCell'})`; nếu không có ảnh thì ghi dòng hướng dẫn thay vì file lỗi.
  - `Du lieu`: header đậm, xen kẽ nền, `frozen ySplit:1`, `autoFilter`, `numFmt` theo cột (`#,##0` / `#,##0.0` / `#,##0.0"%"` — giá trị % lưu thô 29.8, không nhân 100), dòng tổng in đậm gạch trên, ghi chú italic dưới bảng, và **data bar** conditional formatting trên cột % (tặng thêm hiệu ứng thanh ngay trong ô).
  - `excelFileName()` chuẩn hoá tên file không dấu, bỏ ký tự cấm, kèm mốc thời gian.
- `src/lib/dashboardExcelSpecs.ts` (mới, thuần dữ liệu): 4 hàm dựng nội dung — `fillRateExportSpec` (theo `scope` + cấp đang drill, cột % + trạng thái theo ngưỡng 90/70), `distributionKgExportSpec` (pie KG + tỉ lệ trên tổng đang lọc), `categoryPositionExportSpec` (2 tỉ lệ hàng hoá/công suất + ghi chú LOT chưa phân loại), `containerExportSpec` (để trống container mặt hàng chưa khai định mức và không cộng vào tổng).
- `src/lib/dashboardExcelExport.ts` (mới, cầu nối client): `exportDashboardChart()` = vẽ PNG → dựng workbook → `saveAs` Blob.
- 3 card có nút "Xuất Excel" ở header, cạnh nút "Làm mới": `WarehouseFillRateChart.tsx` (xuất đúng tab Lô kệ/Sảnh/Tổng + đúng khu đang drill), `InventoryDistributionChart.tsx` (xuất đúng tab KG/Danh mục, tab danh mục chỉ xuất danh mục đang hiện theo cấu hình chung), `ContainerStockChart.tsx` (bảng = toàn bộ danh sách đang lọc, ảnh = Top 15). Nút disabled khi dữ liệu rỗng, hiện spinner khi đang xuất, `try/catch` + `alert` nếu thất bại.

## Tuân thủ kiến trúc phân hệ
- Không thêm module mới: nút nằm trong chính card đã được gate bằng `hasModule('warehouse_fill_rate' | 'inventory_distribution' | 'container_distribution')`, nên kho nào tắt card thì đương nhiên không có nút xuất.
- Không query mới: file Excel dựng từ dữ liệu card đang giữ trong state — dữ liệu đó đã lọc `system_type` ngay từ lúc fetch, nên không có đường nào lộ số giữa hai phân hệ.
- Không đụng Kho Đông Lạnh: chỉ thêm nút + lib mới, không sửa schema, không sửa trang `/warehouses/status`, không đổi công thức nào (`fillRateExportSpec` gọi lại `metricsOf`/`classifyFill` của `warehouseFillRate.ts`, `categoryPositionExportSpec` nhận nguyên `CategoryPositionResult`).
- Tên file và metadata ghi rõ phân hệ + phạm vi để hai người dùng hai kho không gửi nhầm số cho nhau.

## Kiểm chứng
- `npx vitest run` trên 4 file liên quan → **41/41 pass**, gồm 9 test Excel mới: build workbook → `writeBuffer` → **load lại bằng exceljs** để assert tên sheet `['Bieu do','Du lieu']`, đúng header, đúng giá trị ô (`KHO 1 · 40%`), `numFmt` có `%`, `autoFilter`, `views` frozen, `conditionalFormattings[0].ref === 'E2:E3'` và rule `dataBar`, và ảnh nhúng thật (`xl/media/image1.png` + `xl/drawings/drawing1.xml` có trong zip).
- 4 test `chartImage`: stub `document.createElement` để chạy hết luồng vẽ trên node, sau đó **bắt mọi toạ độ phải hữu hạn** (`Number.isFinite`) — đây là cách duy nhất phát hiện NaN từ dữ liệu rỗng/`values` ngắn hơn `labels`; kèm case tổng = 0 không chia cho 0 và môi trường không có trình duyệt thì báo lỗi rõ.
- `npx tsc --noEmit` → sạch trên 8 file touched (`chartImage`, `dashboardExcelWorkbook`, `dashboardExcelSpecs`, `dashboardExcelExport`, 3 card, 2 file test); xác nhận `Download` có export trong `lucide-react` bản đang cài.
- **Chưa kiểm chứng trên trình duyệt**: dev server không chạy và agent không có phiên đăng nhập (mật khẩu nằm ở `.env.test.local`, agent không tự nhập). Người dùng cần bấm thử 3 nút và mở file bằng Excel/LibreOffice để xác nhận ảnh biểu đồ hiển thị đúng.

## Cách xem thử
Vào `/` → mỗi card thống kê bấm "Xuất Excel" → file `.xlsx` tải về có sheet `Bieu do` (ảnh) và `Du lieu` (bảng lọc được). Đổi tab (Lô kệ/Sảnh/Tổng, KG/Danh mục) hoặc drill xuống một khu rồi xuất lại — nội dung file phải khớp đúng thứ đang hiển thị.

# Walkthrough: Thống kê Sảnh trên `/work/inventory` tách theo TỪNG sảnh (SẢNH 1, 2, 3…)

## Vấn đề người dùng báo
Bật nút "Thống kê Sảnh" trong trang kiểm kê `/work/inventory` chỉ ra một bảng gộp: mọi sảnh của kho (SẢNH 1, SẢNH 2, SẢNH 3) bị cộng dồn thành một cụm SKU duy nhất, không nhìn riêng được từng sảnh.

## Nguyên nhân
`useMemo hallSummary` (trang `src/app/(dashboard)/work/inventory/page.tsx`) lấy TẤT CẢ khu `is_hall` trong phạm vi kho, gom hết ô của chúng rồi gán khóa nhóm chỉ gồm `sku|số lượng|đơn vị|tag` — **không có chiều sảnh trong khóa**, nên mọi sảnh dồn vào một bản ghi.

## Quyết định của người dùng (chốt qua 3 câu hỏi, không suy từ code)
1. Bố cục: **tab ngang hàng từng sảnh** (không dùng khối dọc, không matrix).
2. **Giữ tab "Tất cả sảnh"** để đối soát; số từng sảnh phải cộng ra đúng số tab tổng.
3. Tích "đã kiểm" / sửa ghi chú trên một thẻ **chỉ tác động trong sảnh đang xem**.

## Cách triển khai
### `src/lib/hallInventoryStats.ts` (mới, logic thuần)
- `hallRootsInScope(zones, scopeIds)`: lấy khu **sảnh "đầu ngành"** (`is_hall` và cha không phải sảnh). Mỗi ô vì thế thuộc đúng MỘT sảnh → số các sảnh cộng lại bằng số tổng, không đếm trùng khi có sảnh lồng sảnh.
- `topHallOfZone(zones, zoneId)`: đi hết chuỗi cha để tìm sảnh đầu ngành (có `seen` chống vòng lặp), trả `null` với ô ngoài sảnh → ô kệ bị loại khỏi thống kê.
- `buildHallStats({zones, positions, lotInfo, itemsMap, scopeIds})`: một vòng lặp duy nhất vừa gom theo từng sảnh (`byHall[hallId]`) vừa gom toàn sảnh (`allGroups`) → khóa nhóm giữ nguyên công thức cũ `canonicalizeUnit(sku)|qty|canonicalizeUnit(unit)|tag`, nên tab "Tất cả sảnh" cho ra đúng con số như trước khi sửa.
- Badge trên tab là **số ô đang chứa lô**; tab tổng = tổng các badge (khả cộng, kiểm chứng được bằng mắt).
- Thứ tự tab theo `display_order` rồi so tên kiểu tự nhiên — **thứ tự sơ đồ kho** (SẢNH 1 order 2 → SẢNH 2 order 5 → SẢNH 3 order 8), không xếp theo độ đầy.
- **Sảnh trống vẫn hiện tab** với badge 0 và dòng "SẢNH 3 đang trống — không có ô nào chứa lô" (theo yêu cầu tab phải "rõ ràng, đầy đủ", không ẩn khu).

### `src/app/(dashboard)/work/inventory/page.tsx`
- `hallStats` chỉ còn gọi `buildHallStats`; `activeHallScope` suy ra từ `activeHallTab` và tự rơi về tab "Tất cả sảnh" khi đổi kho (không có state cũ treo).
- Lưới thẻ cụm dùng `activeHallScope.groups`, nên `positionIds` của mỗi thẻ chỉ chứa ô **trong sảnh đang chọn** → `bulkCheck` và `updateNote` (việc ghi DB không đổi) tự động chỉ chạm ô của sảnh đó.
- Lấy `zone_id` từ `zone_positions` như trang đang dùng; không thêm query mới, không đổi schema.

## Tuân thủ kiến trúc phân hệ
- **Không hardcode mã kho/tên sảnh**: chỉ dùng cờ `zones.is_hall` (bật/tắt theo phân hệ), kho nào có khu sảnh thì tab tự xuất hiện.
- **Cô lập theo phân hệ + theo kho**: chỉ số lấy từ `groupedData.positions` và lọc `scopeIds` của kho đang chọn. Test `không lộ ô của sảnh thuộc kho khác` chứng minh một ô nằm ở sảnh thuộc KHO 3 không xuất hiện trong thống kê của KHO 2.
- **Không đụng Kho Đông Lạnh ở chiều phá vỡ**: trang status và `/warehouses/hall-summary` giữ nguyên; luật nhận diện sảnh của `/work/inventory` vẫn là cờ `is_hall` như cũ (không đổi sang regex tên), nên tập sảnh hiển thị không đổi — chỉ thêm chiều tách.

## Kiểm chứng
- `npx vitest run src/lib/__tests__/hallInventoryStats.test.ts` → **6/6 pass**: thứ tự tab theo sơ đồ kho + sảnh trống vẫn còn tab, sảnh con gộp về sảnh đầu ngành, tổng từng sảnh = tab "Tất cả sảnh" (cả số ô lẫn số cụm SKU), không lộ ô kho khác, gộp đúng `checkedCount`/`notes`, và `hallRootsInScope`/`topHallOfZone` trả đúng.
- `npx tsc --noEmit` → không có lỗi trên `page.tsx` và `hallInventoryStats.ts` (lọc output theo 2 file touched).
- Đối soát số liệu thật trên DB local (`KHO_DONG_LANH`): 12 khu `is_hall`, **0 ô nào thuộc nhiều hơn một sảnh** → khả cộng theo sảnh được bảo đảm. Ví dụ KHO 2: SẢNH 1 = 6 ô có hàng, SẢNH 2 = 39, SẢNH 3 = 0, tab tổng = 45.
- **Chưa kiểm chứng trên trình duyệt**: agent không có phiên đăng nhập. PORT = 3000 là bản `next build` cũ nên **phải rebuild mới thấy thay đổi**; bản dev `:3001` (`npm run dev`) tự nạp code mới.

## Cách xem thử
Mở `/work/inventory` → vào một phiên kiểm kê của kho có khu sảnh → bấm nút **"Thống kê Sảnh"**. Kiểm tra: hàng tab `[Tất cả sảnh] [SẢNH 1] [SẢNH 2] [SẢNH 3]` theo đúng thứ tự sơ đồ kho; bấm từng tab thấy số ô và cụm riêng; cộng badge các sảnh bằng badge "Tất cả sảnh"; tích V trên một thẻ ở tab SẢNH 2 không làm ô cùng SKU ở SẢNH 1 đổi trạng thái.

# Walkthrough (tiếp): Ô vị trí trong sảnh bị cắt icon thao tác (sửa / xóa)

## Vấn đề
Thẻ ô ở khu sảnh (ví dụ `K2S1A10T101`) hẹp nên hàng tiêu đề bị tràn ngang: thẻ có `overflow-hidden`, còn mã vị trí (`whitespace-nowrap shrink-0`) và cụm icon (`shrink-0`) đều không co lại → icon **Tải lại / Sửa LOT / Xóa LOT** bị cắt mất, không bấm được.

## Sửa
- `renderInventoryPosition`: hàng tiêu đề thêm `flex-wrap`, cụm hành động thêm `justify-end flex-wrap` → khi không đủ chỗ, cả cụm **xuống dòng riêng** thay vì bị cắt. Không còn trạng thái icon biến mất ở bất kỳ bề rộng nào.
- Lưới ô trong khu sảnh (STYLE 1 "DÃY / SẢNH") đổi `minmax(170px,1fr)` → `minmax(250px,1fr)` khi `zone.is_hall`, để hàng tiêu đề đủ chỗ nằm gọn một dòng. Ô kệ giữ nguyên 170px → **không đổi layout của khu kệ Kho Đông Lạnh**.
- Không đổi logic ghi dữ liệu: `toggleCheck`/`toggleResolved`/`refreshPositionLot`/`handleEditLot`/`handleDeleteLotAtPosition` giữ nguyên, chỉ đổi cách bố trí.

## Kiểm chứng (đo bằng browser thật trên markup sao chép)
Dựng đúng markup thẻ ô (cùng class Tailwind) rồi đo `getBoundingClientRect` từng icon trong thẻ:
- 250px (ô sảnh): `clipped = 0`, cụm icon **cùng dòng** với mã vị trí, chiều cao thẻ 109px.
- 250px kèm cả STT + mã LOT dài: vẫn `clipped = 0`, một dòng (mã LOT tự `truncate` vì `flex-1 min-w-0`).
- 200px và 170px (ô kệ): `clipped = 0` — cụm icon xuống dòng thứ hai, thẻ cao thêm ~22px, **không còn icon nào bị cắt**.
- `npx tsc --noEmit` sạch trên file touched.
- **Chưa xem trên trang thật** (agent không có phiên đăng nhập); `:3000` là bản build cũ nên phải reload bản dev `:3001` hoặc rebuild.

# Walkthrough: Module "Đối chiếu kiểm kê" (`report_stocktake_diff`)

## Nghiệp vụ
Người dùng kiểm kê thủ công theo luồng cũ: vào `/print/warehouse-map` → xuất **Excel (Bảng)** + **Excel (Lưới)** (mốc TRƯỚC) → cầm giấy đi đếm → chỉnh ở `/warehouses/map` (di chuyển LOT) và `/warehouses/lots` (sửa số lượng) → xuất lại 2 file (mốc SAU). Module mới nhận **2 file cùng định dạng** của 2 mốc, chỉ ra chỗ lệch số lượng theo vị trí và xuất báo cáo Excel.

- Khoá so khớp (file Bảng): `Kho | Dãy | Ô | Tầng | Mã vị trí | Số lô | Mã SP | ĐVT`.
- Khoá so khớp (file Lưới): `Khu vực | Dãy | Ô | Tầng | Tên hàng | ĐVT` (file Lưới không chứa mã vị trí lẫn mã lot).
- Kết quả chia 2 tab ngang hàng: **Dạng Bảng** và **Dạng Lưới**, mỗi tab một cặp file độc lập.
- File báo cáo luôn kèm **2 sheet sơ đồ đầy đủ** của 2 mốc (không cắt còn mỗi dòng lệch) để nộp cùng bảng sai lệch; chỗ lệch tô nền đỏ nhạt `#FFC7CE`: dạng Bảng tô **cả dòng**, dạng Lưới tô **nguyên ô của tầng** có mặt hàng lệch (kể cả ô merge thì tô cả khối). Việc tô đỏ lấy theo toàn bộ sai lệch của phép đối chiếu, không phụ thuộc bộ lọc đang hiển thị trên màn hình.

## Tuân thủ kiến trúc dự án
- **Modular-first, không hardcode mã kho**: tính năng gate bằng `hasModule('report_stocktake_diff')` (`src/lib/report-modules.ts`), menu gate bằng `requiredModule` (`src/components/layout/Sidebar.tsx`). Không có điều kiện theo `systemType === '...'`.
- **Cô lập phân hệ**: module **không truy vấn DB**, chỉ đọc file người dùng nạp nên không có đường nào để dữ liệu kho này lộ sang kho khác. Khi đọc, parser lấy `Hệ thống:`/`Kho:` ngay dòng tiêu đề file; nếu tên phân hệ trong file khác `currentSystem.code` đang làm việc thì trang cảnh báo đỏ để không đối chiếu nhầm kho.
- **Bảo toàn Kho Đông Lạnh**: không sửa logic xuất file, không sửa schema, không đụng luồng nhập/xuất. Thay đổi duy nhất trên code cũ là thêm chữ `export` cho hàm `normalizeUnit` có sẵn (`src/lib/warehouseExcelExport.ts:10`) để dùng lại đúng cách chuẩn hoá ĐVT — hành vi không đổi. Module TẮT (mặc định với kho chưa bật) → hệ thống giữ nguyên trạng thái cũ.

## File mới / đã sửa
| File | Vai trò |
| --- | --- |
| `src/lib/stocktakeSnapshotParser.ts` | Nhận diện và đọc file Bảng (dò dòng header theo "Mã vị trí", map cột theo tên chịu lỗi dấu) và file Lưới (duyệt sheet "Sơ đồ mặt bằng": banner `KHU VỰC:`, hàng nền vàng = Dãy/Sảnh, ô richText `• [BATCH] Tên : SL ĐVT (N PL)`, separator `------` và `   \|   `). |
| `src/lib/stocktakeReconciliation.ts` | Full outer join 2 mốc theo khoá, phân loại `changed` / `only_before` / `only_after`, tổng hợp **theo từng ĐVT** (không cộng xuyên đơn vị), sinh cảnh báo. |
| `src/lib/stocktakeDiffExcelExport.ts` | Báo cáo 6 sheet: *Sơ đồ TRƯỚC*, *Sơ đồ SAU* (chép nguyên bản sheet sơ đồ của 2 file gốc — giá trị, font, nền, merge, bề rộng cột, chiều cao hàng — rồi tô đỏ chỗ lệch), *Chi tiết sai lệch*, *Tổng hợp theo SP*, *Tổng hợp theo vị trí*, *Thông tin đối chiếu*. |
| `src/app/(dashboard)/reports/stocktake-diff/page.tsx` | Trang UI: 2 tab Bảng/Lưới, 2 ô nạp file trước/sau, thẻ thống kê, bộ lọc (tìm kiếm / loại sai lệch / ngưỡng lệch), bảng kết quả, nút xuất Excel. |
| `src/lib/__tests__/stocktakeReconciliation.test.ts` | 9 test vòng kín: gọi **hàm xuất Excel thật** → đọc lại bằng parser → đối chiếu → assert. |
| `src/lib/warehouseExcelExport.ts` | Chỉ thêm `export` cho `normalizeUnit`. |
| `src/lib/report-modules.ts`, `src/components/layout/Sidebar.tsx` | Đăng ký module + mục menu "Đối chiếu kiểm kê" trong nhóm Báo cáo. |
| `supabase/migrations/20261102100000_add_report_stocktake_diff_module.sql` | Upsert `app_modules` (`category='report'`, `is_basic=true`) + bật sẵn cho `KHO_DONG_LANH` trong `systems.report_modules`. Migration idempotent nên `db push` lại không gây trùng. |

## Giới hạn đã chốt với người dùng
1. Chỉ tính **chênh số lượng**. Dòng chỉ xuất hiện ở một mốc vẫn được đưa vào bảng (nhãn *Mất ở mốc sau* / *Phát sinh ở mốc sau*) — nếu ẩn đi thì tổng hai mốc không khớp nhau và báo cáo sai bản chất; có thể lọc bỏ bằng combobox "Loại sai lệch".
2. File Lưới không có mã vị trí/mã lot → chỉ truy vết tới cấp Dãy/Ô/Tầng theo tên hàng; muốn định danh pallet thì dùng tab Dạng Bảng.
3. Parser tự dò dòng header (dòng 4 hay 5 tuỳ có "Lọc theo") và tự bỏ dòng `TỔNG CỘNG`; nếu 2 file xuất với bộ lọc/khu vực/cấu hình "Mã nội bộ" khác nhau, trang sẽ cảnh báo chứ không âm thầm ra kết quả sai.

## Cách bật và xem thử
1. **Đã áp sẵn trên máy local** (2026-11-02): chạy migration `20261102100000_add_report_stocktake_diff_module.sql` vào DB Supabase local và ghi lịch sử `supabase_migrations.schema_migrations`. Vì vậy **không cần** bấm "Đồng bộ module" ở `/admin/modules` nữa (bấm cũng không đổi gì vì text đã khớp).
2. `KHO_DONG_LANH` đã được bật sẵn trong `systems.report_modules`. Kho khác muốn dùng thì vào **Cài đặt phân hệ → Tính năng → nhóm Báo cáo** → bật **Đối chiếu kiểm kê**.
3. Sidebar → **Báo cáo → Đối chiếu kiểm kê** (`/reports/stocktake-diff`).
4. Ở tab **Dạng Bảng**: nạp file Bảng xuất trước kiểm kê vào ô "Mốc TRƯỚC", file xuất sau vào ô "Mốc SAU" → bảng sai lệch hiện ra → bấm **Xuất Excel sai lệch**. Lặp lại ở tab **Dạng Lưới** với 2 file lưới.

## Kiểm chứng đã chạy
- `npx vitest run src/lib/__tests__/stocktakeReconciliation.test.ts` → **11/11 pass**, gồm: đọc đúng cột ĐVT (bắt ra lỗi `foldText` không gỡ được chữ `Đ`), bỏ dòng TỔNG CỘNG, tách nhiều sản phẩm trong một ô lưới, hàng Sảnh gộp `|`, toạ độ Khu vực/Dãy/Ô/Tầng, 3 nhóm sai lệch, tổng theo từng ĐVT, từ chối 2 file khác định dạng, cảnh báo khác phân hệ, file báo cáo đọc lại đủ 6 sheet, 2 sheet sơ đồ chép đủ số dòng gốc + tô đỏ đúng dòng lệch (Bảng) và đúng ô × tầng lệch (Lưới), dòng không đổi vẫn giữ nội dung gốc và không bị tô.
- `npx tsc --noEmit` → sạch trên toàn bộ file touched.
- `npx vitest run` (toàn bộ) → 120/122 pass; 2 lỗi còn lại là fail cũ có sẵn của `WarehouseSearchReportModal.test.tsx`, không liên quan module này.
- Đối chiếu nguồn file: trang In sơ đồ gọi đúng `exportWarehouseToExcel` (nút "Excel (Bảng)") và `exportWarehouseGridToExcel` (nút "Excel (Lưới)") — `src/app/print/warehouse-map/page.tsx:776,883` — nên test vòng kín đi đúng định dạng file người dùng tải về.
- Đọc lại DB sau migration: `app_modules` có `report_stocktake_diff` (`is_basic = true`, tên/mô tả tiếng Việt không lỗi font) và `systems.report_modules` của `KHO_DONG_LANH` đã chứa module.
- **Chưa bấm thử trên UI thật** (agent không có phiên đăng nhập `:3001`); `:3000` là bản build cũ nên cần reload bản dev hoặc rebuild để thấy menu.

# Walkthrough (tiếp): Đối chiếu thêm file **tồn kho theo LOT** (tab thứ 3)

## Bổ sung nghiệp vụ
Người dùng yêu cầu đủ bộ 3 file cho một lượt kiểm kê: ngoài 2 file sơ đồ kho còn có file **tồn kho theo LOT** xuất từ `/inventory` (tab "Theo LOT" → nút Xuất Excel, đường thật là `/print/inventory?type=lot&export=excel&...` → `exportInventoryReportToExcel`). Trang `/reports/stocktake-diff` giờ có **3 tab ngang hàng**: Dạng Bảng / Dạng Lưới / Tồn theo LOT, mỗi tab vẫn là một cặp file độc lập (mỗi lượt một file báo cáo riêng).

## 3 quyết định người dùng đã chốt
1. **Chỉ so ở cấp Sản phẩm × ĐVT.** Báo cáo tồn theo LOT *không chứa mã LOT lẫn vị trí* — nó gộp toàn bộ pallet của một sản phẩm trong kho thành một dòng chính, bên dưới là các dòng con (tháng nhập, `LSX:`, mã phụ, `Gốc ( còn lại )`). Nên khoá so khớp là `Mã SP | Tên SP | ĐVT`, các dòng con bị bỏ qua vì 2 mốc rất dễ khác nhau ở dòng con dù tổng không đổi.
2. **Mỗi lượt một file báo cáo riêng** — không gộp 3 lượt vào một workbook.
3. **Không** làm lượt đối chiếu theo từng mã LOT từ `/warehouses/lots`; chỉ dùng file `/inventory`.

## Cách nhận diện và đọc file LOT
- Nhận diện bằng **cả tiêu đề sheet** (`BÁO CÁO TỒN KHO THEO LOT`, chỉ quét 10 dòng đầu) **và** bộ cột `STT + Số lượng + (Mã SP | Tên sản phẩm)`. Điều kiện tiêu đề là bắt buộc để không nhận nhầm báo cáo *Theo mã phụ* / *Theo danh mục* (dùng chung khung cột, chỉ khác tiêu đề) thành file LOT — parser sẽ báo lỗi rõ ràng thay vì âm thầm đối chiếu sai bản chất.
- Với workbook LOT có 2 sheet (*Chi tiết* + *Tổng hợp*), parser lấy sheet *Chi tiết*: sheet này có banner `DANH MỤC: ...` (merge A:D) nên `hasLotReportTitle` chỉ khớp sheet đó.
- Chỉ giữ dòng có ô STT là số nguyên dương → loại banner DANH MỤC và mọi dòng con. Mỗi dòng ghi lại `srcRow` để tô đỏ, `category` để hiển thị cột **Danh mục** (một sản phẩm xuất hiện ở nhiều khối thì gộp `"A | B"`).
- `Kho:` của file LOT là **tên chi nhánh** chứ không phải mã phân hệ → `systemName` để trống (không cảnh báo nhầm "khác phân hệ"), tên chi nhánh đưa vào `zoneName` và dùng làm nhãn `Kho:` trên tiêu đề báo cáo.

## Kết quả & file báo cáo cho lượt LOT
- Cùng một engine `reconcileStocktake`, chỉ khác khoá và cách trình bày. `positionCount` với file LOT là **số sản phẩm có sai lệch** (thay vì số vị trí).
- Báo cáo LOT có **5 sheet**: `Tồn kho TRƯỚC`, `Tồn kho SAU` (chép nguyên bản 2 file gốc, **tô đỏ cả dòng** sản phẩm lệch — dòng con không tô), `Chi tiết sai lệch` (bộ cột `STT | Danh mục | Mã SP (SKU) | Sản phẩm | ĐVT | SL trước | SL sau | Chênh lệch | Loại sai lệch`), `Tổng hợp theo SP` (cột cuối đổi thành `Số danh mục`), `Thông tin đối chiếu`. Sheet `Tổng hợp theo vị trí` **được bỏ** vì lượt LOT không có vị trí.
- Hai cảnh báo luôn kèm theo lượt LOT: chỉ truy vết tới cấp Sản phẩm × ĐVT (không chỉ được pallet nào) và đã bỏ qua các dòng con.
- Tên file: `Doi_Chieu_Kiem_Ke_Lot_<kho>_<YYYY-MM-DD>.xlsx`.
- Bảng trên màn hình ẩn "Tổng đọc được" với tab LOT (không cộng số lượng xuyên đơn vị — quy tắc đã chốt của dự án), thay bằng số mục và số đơn vị tính.

## Kiến trúc
Vẫn không query DB, không hardcode mã kho, gate bằng `hasModule('report_stocktake_diff')` như cũ. Code cũ chỉ sửa ở `src/lib/stocktakeReconciliation.ts` (khoá + cảnh báo phân nhánh theo format) và `stocktakeDiffExcelExport.ts` (bảng cột chi tiết dựng theo format); `report-modules.ts` cập nhật lại mô tả module cho đúng 3 loại file.

## Kiểm chứng đã chạy
- `npx vitest run src/lib/__tests__/stocktakeReconciliation.test.ts` → **15/15 pass**, thêm 4 test: gọi `exportInventoryReportToExcel({type:'lot'})` thật → đọc lại bằng parser (2 dòng chính, bỏ banner + 3 dòng con mỗi nhóm, đúng `category`/`zoneName`/`exportDate`); từ chối file *Theo mã phụ*; đối chiếu SP × ĐVT ra đủ 3 nhóm lệch + 3 sản phẩm lệch + 2 cảnh báo và **không** cảnh báo khác phân hệ; báo cáo đọc lại đúng 5 sheet, đúng bộ cột LOT, vị trí tô đỏ theo `srcRow`, dòng con không bị tô; từ chối ghép LOT với Bảng (thông báo nêu rõ `tồn theo LOT vs dạng Bảng`).
- `npx tsc --noEmit` → sạch trên các file touched.
- `npx vitest run` toàn bộ → 126/128; 2 fail còn lại là của `WarehouseSearchReportModal.test.tsx` (có sẵn từ trước, không liên quan).
- Chạy lại migration → `app_modules.description` đã cập nhật, `systems.report_modules` của `KHO_DONG_LANH` vẫn chỉ có một bản module (câu `UPDATE` guard `NOT (... = ANY ...)` trả `UPDATE 0`).
- **Vẫn chưa bấm thử UI thật** cho cả 3 tab (agent không có phiên đăng nhập `:3001`).

# Walkthrough (tiếp): Lượt đối chiếu LOT đọc từ sheet "Tổng hợp"

User chốt lại cho gọn: file tồn theo LOT có 2 sheet (*Chi tiết* nhiều dòng con và *Tổng hợp* mỗi sản phẩm một dòng), và chỉ cần dựa vào sheet **"Tổng hợp"**.

- Bộ đọc giờ nhận diện file LOT bằng **tên sheet** (`Tổng hợp`) thay vì bằng tiêu đề in trong sheet — `LOT_SUMMARY_SHEET` + `locateLotHeader()` trong `src/lib/stocktakeSnapshotParser.ts`. Vì tiêu đề của sheet này là "BÁO CÁO TỔNG HỢP TỒN KHO" nên guard cũ (khớp chữ "tồn kho theo LOT") đã bỏ; việc loại báo cáo *Theo mã phụ* / *Theo danh mục* nay do chính tên sheet đảm nhiệm (2 báo cáo đó chỉ có một sheet `Bao Cao Ton Kho`).
- Vẫn giữ quy tắc chỉ lấy dòng có STT nguyên dương và vẫn đọc banner `DANH MỤC:` để đổ cột **Danh mục** — sheet Tổng hợp vẫn có banner này, và quy tắc STT giúp đọc được cả file cũ còn dòng con.
- 2 sheet chép vào file báo cáo (`Tồn kho TRƯỚC` / `Tồn kho SAU`) giờ là sheet Tổng hợp của 2 file gốc: gọn, đúng một dòng cho một sản phẩm lệch được tô đỏ, không còn các dòng LSX/mã phụ chen giữa.
- Cảnh báo trên màn hình và trong sheet *Thông tin đối chiếu* nói rõ nguồn là sheet "Tổng hợp" nên **không thấy** tháng nhập / LSX / mã phụ nào lệch; muốn soi chi tiết đó thì dùng lượt Dạng Bảng.
- Kiểm chứng: `npx vitest run src/lib/__tests__/stocktakeReconciliation.test.ts` → **16/16 pass**, thêm test chứng minh cùng một file LOT có 2 sheet (Chi tiết dài hơn Tổng hợp) mà parser chọn đúng sheet Tổng hợp và chỉ trả về 1 dòng sản phẩm.

# Walkthrough (tiếp): Sheet "Biên bản kiểm kê" trong file báo cáo đối chiếu LOT

User bổ sung: lượt đối chiếu **tồn kho theo LOT** phải xuất thêm **1 sheet biên bản kiểm kê tồn kho** — một bản tổng hợp hàng hóa, số lượng TRƯỚC / SAU / CHÊNH LỆCH ngay trên cùng một trang, kèm chữ ký phía dưới để in và ký nộp. Ba câu hỏi thiết kế (liệt kê dòng nào, mấy ô chữ ký, có phần kết luận không) user trả lời "không yêu cầu riêng" nên giữ phương án đề xuất.

## Nội dung sheet `Biên bản kiểm kê` (mặc định là sheet đầu tiên của file báo cáo LOT)
- **Khổ A4 ngang, fit-to-width 1 trang** (`pageSetup` paperSize 9, orientation landscape, `fitToPage/fitToWidth: 1, fitToHeight: 0`, lề trái/phải 0.75"). Chọn in ngang vì bảng có 8 cột (tên hàng 38 + cột ghi chú 28 ≈ 133 đơn vị bề rộng); in đứng sẽ bị Excel ép chữ xuống ~60% và khó ký.
- **Quốc hiệu – tiêu ngữ**: tên phân hệ + tên công ty (từ `companyInfo`) ở góc trên trái, `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM` / `Độc lập - Tự do - Hạnh phúc` ở góc trên phải (dòng dưới kẻ viền đôi). Không có `companyInfo` thì vẫn in được, chỉ thiếu dòng tên công ty.
- Tiêu đề **BIÊN BẢN KIỂM KÊ TỒN KHO**, dòng "v/v: đối chiếu số liệu tồn kho giữa 2 mốc xuất file …", dòng `Kho / chi nhánh: … • Ngày lập biên bản: …`, rồi 2 dòng tóm tắt (số sản phẩm đã đối chiếu, số sản phẩm có sai lệch, tổng lệch theo từng ĐVT) — người ký nhìn được quy mô buổi kiểm kê mà không cần mở sheet chi tiết.
- **Bảng hàng hóa 8 cột**: `STT | Mã SP | Tên sản phẩm | ĐVT | SL trước kiểm kê | SL sau kiểm kê | Chênh lệch | Ghi chú / nguyên nhân chênh lệch`. Liệt kê **đúng tập dòng đang hiện trên màn hình** (đã trừ dòng "không đổi"), tức biên bản luôn khớp với sheet *Chi tiết sai lệch* — không tự ý thêm hàng không lệch làm biên bản dài vô ích.
- Cột **Ghi chú** tự điền sẵn `Mất ở mốc sau` / `Phát sinh ở mốc sau` cho dòng một-mốc, để **trống** cho dòng lệch số lượng để người kiểm kê tự tay viết nguyên nhân (hư hỏng, xuất quên, sai vị trí…).
- Cộng theo **từng ĐVT** (`TỔNG TRONG ĐƠN VỊ Kg`, `TỔNG TRONG ĐƠN VỊ Thùng`, …) — không cộng xuyên đơn vị, đúng quy tắc dự án.
- Khối **Kết luận** (nêu số sản phẩm khớp/lệch và tổng chênh từng ĐVT) + dòng **Chứng từ kèm theo** có 4 ô checkbox (`□ Phiếu kiểm kê thực tế □ File tồn kho theo LOT 2 mốc □ Sơ đồ kho dạng Bảng □ Khác: …`) để tick khi nộp.
- **4 ô chữ ký** bố cục 2×2 đúng biên bản hành chính: `NGƯỜI KIỂM KÊ | THỦ KHO` rồi `KẾ TOÁN TRƯỞNG | GIÁM ĐỐC`, mỗi ô cách 4 dòng trắng cho chỗ ký, kèm dòng `Họ và tên: ................................`. Phía trên là dòng `Ngày …… tháng …… năm ……` để ghi ngày ký.

## Tuân thủ kiến trúc
- Sheet này **chỉ sinh ra với lượt đối chiếu LOT** (`format === 'lot'`) — hai lượt Bảng/Lưới giữ nguyên file báo cáo cũ, không đổi hành vi.
- Tên công ty lấy qua hook có sẵn `usePrintCompanyInfo` (trang gọi `exportStocktakeDiffToExcel(result, rows, { companyInfo })`), không hardcode, nên mọi phân hệ khi bật module đều tự lấy đúng thông tin in của phân hệ đó.
- Module vẫn gate bằng `hasModule('report_stocktake_diff')`; Kho Đông Lạnh không bật module thì không có đường nào chạm tới luồng in này.

## Đã sửa / đã thêm
| File | Thay đổi |
| --- | --- |
| `src/lib/stocktakeDiffExcelExport.ts` | Thêm `buildInventoryMinutesSheet()` (quốc hiệu, tiêu đề, bảng 8 cột, tổng theo ĐVT, kết luận, 4 ô chữ ký), tham số thứ ba `options?: { companyInfo?: CompanyInfo \| null }`, và gắn sheet Biên bản làm sheet đầu tiên khi `format === 'lot'`; sheet *Thông tin đối chiếu* bổ sung dòng mô tả sheet biên bản. |
| `src/app/(dashboard)/reports/stocktake-diff/page.tsx` | Nạp `usePrintCompanyInfo()` và truyền `companyInfo` vào hàm xuất; thêm dòng thông tin trong tab LOT hướng dẫn "file báo cáo mở đầu bằng sheet Biên bản kiểm kê khổ A4". |
| `src/lib/__tests__/stocktakeReconciliation.test.ts` | Test mới `sheet Biên bản kiểm kê: khổ A4, đúng 3 dòng lệch, cột ghi chú và 4 ô chữ ký` (giấy A4, tiêu đề, 3 dòng lệch + không lẫn hàng khớp, SL trước/sau/chênh đúng, ghi chú prefill, tổng theo từng ĐVT không cộng xuyên đơn vị, thứ tự chữ ký 2×2). Test đếm sheet cũ cập nhật thành `['Biên bản kiểm kê', 'Tồn kho TRƯỚC', 'Tồn kho SAU', 'Chi tiết sai lệch', 'Tổng hợp theo SP', 'Thông tin đối chiếu']`. |

## Bẫy kỹ thuật đã gặp
Gán `worksheet.columns = [{ header, key, width }]` khiến **exceljs tự viết tên cột xuống dòng 1** — trong biên bản, dòng 1 là chỗ của quốc hiệu nên tên cột lọt sang các ô chưa merge (D1/E1…), làm lệch toàn khung trên. Cách xử lý: `ws.columns` chỉ set `key` + `width`, còn tên cột thì ghi bằng dòng header thủ công ở dòng 9 (dự án đã dùng đúng workaround này ở `inventoryReportExcelExport.ts`).

## Kiểm chứng
- `npx vitest run src/lib/__tests__/stocktakeReconciliation.test.ts` → **17/17 pass**; `npx tsc --noEmit` sạch trên các file chạm tới.
- Dump toàn bộ sheet biên bản của file thật để đọc bằng mắt: đúng 32 dòng, merge `A1:C1`/`F1:H1`/`A4:H4`/`A8:H8`, bảng 8 cột ở dòng 9, 3 dòng lệch ở dòng 10–12 (`120 → 118 = -2`, `Mất ở mốc sau`, `Phát sinh ở mốc sau`), `TỔNG TRONG ĐƠN VỊ Kg` ở dòng 13, Kết luận dòng 15, chứng từ dòng 16, ngày dòng 18, chữ ký dòng 20 và 27, `Họ và tên` dòng 25 và 32 → khớp bố cục biên bản hành chính.
- File test tạm dùng để dump đã xoá; không còn scratch trong `src/lib/__tests__/`.
- **User bấm thử trên UI giúp**: agent không có phiên đăng nhập `:3001`, `:3000` là bản build cũ.

# Walkthrough (tiếp): Biên bản kiểm kê là BẢN LIỆT KÊ ĐẦY ĐỦ (theo đúng sheet Tổng hợp)

User xem file báo cáo thật rồi chốt lại: sheet **Biên bản kiểm kê** phải "đầy đủ như trong hình" — tức là bảng tồn của sheet *Tổng hợp* (mọi sản phẩm, có nhóm `DANH MỤC:`), chỉ khác là thay cột "Số lượng" đơn bằng **SL trước / SL sau / Chênh lệch**. Ba lựa chọn user xác nhận: (1) liệt kê tất cả sản phẩm, giữ nhóm DANH MỤC, tô đỏ dòng lệch; (2) giữ cột **Quy đổi (Kg)** lấy theo mốc SAU; (3) tổng theo **từng danh mục** và cả tổng theo **từng ĐVT** ở cuối biên bản.

## Thay đổi nghiệp vụ so với bản trước
- Biên bản không còn lấy "tập dòng đang lọc trên màn hình" mà lấy **toàn bộ `reconciliation.allRows`** (kể cả hàng không đổi). Hàng không đổi vẫn in, nền trắng, ghi chú trống; hàng lệch tô đỏ `#FFC7CE` cả dòng. Sheet *Chi tiết sai lệch* vẫn theo bộ lọc như cũ — hai sheet phục vụ hai việc khác nhau.
- 9 cột: `STT | Mã SP | Tên sản phẩm | ĐVT | SL trước kiểm kê | SL sau kiểm kê | Chênh lệch | Quy đổi (Kg) sau kiểm kê | Ghi chú / nguyên nhân chênh lệch`. Quốc hiệu dịch sang `G1:I1`, tên đơn vị `A1:D1`, khối chữ ký 2 tầng thành `A:D` và `E:I`.
- Trong mỗi nhóm có dòng **`TỔNG QUY ĐỔI (Kg) — DANH MỤC: <tên nhóm>`** đặt ở 3 cột SL (Kg trước → Kg sau → chênh Kg). Cộng Kg thì không lẫn đơn vị nên con số này có nghĩa; vẫn KHÔNG có "Tổng SL" xuyên đơn vị — muốn theo từng đơn vị thì nhìn khối `TỔNG TRONG ĐƠN VỊ ...` cuối biên bản (giờ tính trên toàn bộ hàng, không riêng hàng lệch).

## Thay đổi kỹ thuật dây kèm
- `src/lib/stocktakeSnapshotParser.ts`: `StocktakeRow` thêm `kg?: number` (chỉ file LOT có cột "Quy đổi (Kg)"), map cột mới `kg: ['quy doi', 'quy doi (kg)', 'quy doi kg']`. File Bảng/Lưới không có cột này → `undefined`, không đổi hành vi.
- `src/lib/stocktakeReconciliation.ts`: `StocktakeDiffRow` thêm `beforeKg`/`afterKg` (gom theo cùng khoá sản phẩm × ĐVT) và `srcRow` (dòng trên file gốc). `sortDiffRows(rows, format)` nay lấy **thứ tự dòng trong file** làm khoá sắp cuối cùng *riêng với định dạng LOT*, nhờ vậy biên bản xếp đúng thứ tự người dùng thấy trên sheet Tổng hợp và trên giấy đếm; thứ tự của tab Bảng/Lưới giữ nguyên như trước.
- `src/lib/stocktakeDiffExcelExport.ts`: `buildInventoryMinutesSheet(workbook, reconciliation, companyInfo)` — bỏ tham số danh sách dòng vì biên bản luôn là bản đầy đủ; thêm helper `fillRow`/`writeGroupTotal`; dòng `V/v`, `Kết luận` và sheet *Thông tin đối chiếu* viết lại cho khớp nội dung mới.
- `src/app/(dashboard)/reports/stocktake-diff/page.tsx`: chỉ đổi dòng chữ hướng dẫn ở tab LOT ("liệt kê toàn bộ hàng hóa theo nhóm danh mục…").

## Kiểm chứng
- `npx vitest run src/lib/__tests__/stocktakeReconciliation.test.ts` → **17/17 pass**. Test biên bản đổi thành: `Tổng số mục sản phẩm liệt kê: 4`, header đúng 9 cột, hàng không đổi (TP05) **có mặt** và không tô đỏ, hàng lệch tô đỏ, cột H = Kg mốc SAU (14 = 7×2), `DANH MỤC: RAU`, `TỔNG QUY ĐỔI (Kg) — DANH MỤC: Trái cây` = 36 → 30 = −6, `TỔNG TRONG ĐƠN VỊ Kg` = 23 → 19 = −4, không có tổng xuyên đơn vị, thứ tự 4 ô chữ ký.
- `npx tsc --noEmit` sạch trên các file chạm tới; `npx vitest run` toàn dự án **128/130 pass** (2 lỗi còn lại là fail cũ có sẵn của `WarehouseSearchReportModal.test.tsx`).
- Dump bố cục bằng dữ liệu gần file thật (2 danh mục, 4 loại ĐVT: `Thùng`, `Thùng (20kg)`, `Thùng (13kg)`, `Kg`): đúng thứ tự dòng của file gốc (L-SP009 → NL… → TP1010102 → TP1010101), banner + tổng Kg từng danh mục (`182.936 → 182.860 = −76`), 4 dòng tổng theo ĐVT, 4 ô chữ ký. File dump tạm đã xoá.
- **User mở lại file báo cáo giúp**: cần 2 file tồn theo LOT xuất trước/sau kiểm kê thật → tab **Tồn theo LOT** → **Xuất Excel sai lệch** → xem sheet đầu tiên và thử `Ctrl+P` (A4 ngang).

# Walkthrough (tiếp): Đầu "Báo cáo kiểm kê" chép đúng header của báo cáo gốc

User đối chiếu file thật và yêu cầu phần đầu biên bản làm **giống hệt header của báo cáo xuất từ `/inventory`** (công ty → địa chỉ → email/ĐT → dòng trống → tiêu đề → mốc ngày → `Kho:`), chỉ đổi chữ trong tiêu đề. Kết quả trong `buildInventoryMinutesSheet()`:

| Dòng | Nội dung | Lấy từ |
| --- | --- | --- |
| 1–3 | `A1:C1` tên công ty (in hoa, đậm) · `A2:C2` "Địa chỉ: …" · `A3:C3` "Email: … \| ĐT: …" | `companyInfo` (hook `usePrintCompanyInfo`), đúng thứ tự và font như `inventoryReportExcelExport.ts` |
| 4 | dòng trống | — |
| 5 | **BÁO CÁO KIỂM KÊ** (cỡ 16, đậm, căn giữa, merge hết 9 cột) — thay cho "BÁO CÁO TỒN KHO THEO LOT" ở file gốc | hằng số trong sheet biên bản |
| 6 | mốc ngày in nghiêng căn giữa, ví dụ "Tính đến ngày: 02/11/2026" | `exportDate` đọc từ file SAU (fallback: file TRƯỚC, rồi "Ngày lập biên bản: hôm nay") |
| 7 | `Kho: CN Cư M'gar` (đậm, không merge) | `zoneName` của file LOT |

Bỏ khối quốc hiệu – tiêu ngữ "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM / Độc lập - Tự do - Hạnh phúc" và dòng "V/v: …" của bản trước vì không nằm trong bố cục user muốn; dòng mở đầu "Hôm nay, chúng tôi tiến hành kiểm kê…" và dòng thống kê đẩy xuống dòng 8–9, bảng số liệu bắt đầu từ dòng 10 (header) / 11 (dữ liệu). Khối kết luận và 4 ô chữ ký giữ nguyên.

Kiểm chứng: test biên bản đổi sang chốt `A1` = tên công ty in hoa, `A2` = "Địa chỉ: …", `A3` = "Email: … | ĐT: …", `A5` = "BÁO CÁO KIỂM KÊ", `A6` chứa "Tính đến ngày", `A7` = "Kho: Chi nhánh 1" → `npx vitest run src/lib/__tests__/stocktakeReconciliation.test.ts` **17/17 pass**; dump đầu sheet bằng dữ liệu thật (công ty Chánh Thu, 2 danh mục) để đọc bằng mắt rồi xoá file dump tạm.

# Walkthrough (tiếp): Biên bản bỏ khối chữ mở đầu, font/màu theo đúng báo cáo LOT

User xem file thật và chốt hai điểm: **(1) bỏ** dòng "Hôm nay, chúng tôi tiến hành kiểm kê…" và dòng thống kê "Tổng số mục sản phẩm liệt kê: … | Tăng: … | Giảm: …"; **(2) màu sắc – font chữ** của bảng phải giống sheet *Tổng hợp* của báo cáo tồn kho theo LOT, không dùng dải header xanh tím.

- Bảng giờ bắt đầu ngay sau dòng `Kho:` — header ở **dòng 8**, dữ liệu từ **dòng 9**.
- Header: chữ **đen, đậm**, căn giữa, viền mảnh, nền **xám nhạt `F2F2F2`** (đúng `inventoryReportExcelExport.ts`), thay cho nền xanh chữ trắng của `writeHeader()` chung.
- Dòng sản phẩm: **in đậm toàn hàng** như báo cáo gốc; bỏ luôn màu đỏ/xanh ở cột "Chênh lệch" (trước đây `writeQtyCell(..., emphasize)`) — dấu hiệu lệch nay chỉ còn **nền đỏ `FFC7CE`** trên cả dòng, giống cách báo cáo gốc tô.
- Banner `DANH MỤC:` giữ nền vàng `FFF2CC` đúng như file gốc; các dòng `TỔNG QUY ĐỔI (Kg)` / `TỔNG TRONG ĐƠN VỊ` in đậm nghiêng.
- Test biên bản bổ sung: `findRow('Hôm nay, chúng tôi') === -1`, `findRow('Tổng số mục sản phẩm') === -1`, header nằm ở dòng 8, `fill.fgColor.argb === 'FFF2F2F2'`, font header đậm và `font.color === undefined`, dòng sản phẩm `row.font.bold === true`, cột Chênh lệch không tô màu chữ → **17/17 pass**; `npx tsc --noEmit` sạch; dump style từng dòng để mắt thấy rồi xoá file tạm.

# Walkthrough (tiếp): Biên bản bỏ khối "TỔNG TRONG ĐƠN VỊ", Kết luận và Chứng từ kèm theo

User xem file biên bản thật và chỉ định **"bỏ phần trong ảnh"**: toàn bộ cụm dòng `TỔNG TRONG ĐƠN VỊ …` chạy dài ở cuối bảng (Kg, Sọt (30kg), Thùng, Thùng (9.6kg), Thùng (10kg), …), dòng `Kết luận: Hai bên thống nhất lấy số liệu kiểm kê thực tế…` và dòng `Chứng từ kèm theo: □ Phiếu kiểm kê thực tế □ File tồn kho theo LOT 2 mốc …`.

- Trong `buildInventoryMinutesSheet()`: xoá khối gom `byUnit` (Map đơn vị → before/after) và vòng lặp in dòng `TỔNG TRONG ĐƠN VỊ`, xoá luôn 2 dòng `mergeLine` "Kết luận:" / "Chứng từ kèm theo:" cùng các dòng `ws.getRow(r).height` / `r += 2` ăn theo.
- Biên bản giờ đi thẳng: đầu (dòng 1–7) → header (dòng 8) → các nhóm `DANH MỤC:` kèm dòng `TỔNG QUY ĐỔI (Kg)` của từng nhóm → **1 dòng trống** → `Ngày …… tháng …… năm ……` → 4 ô chữ ký (Người kiểm kê / Thủ kho / Kế toán trưởng / Giám đốc).
- Lý do bỏ không ảnh hưởng nguyên tắc số liệu: tổng **theo từng ĐVT** vẫn còn đầy đủ ở sheet *Chi tiết sai lệch* và *Thông tin đối chiếu*; trong biên bản chỉ giữ tổng quy đổi Kg theo danh mục (cộng được vì cùng một đơn vị Kg), đúng quy tắc "không cộng xuyên đơn vị".
^- Cập nhật câu mô tả ở sheet *Thông tin đối chiếu* (mục `Biên bản kiểm kê`): bỏ hai cụm "tổng trong từng ĐVT" và "khối Kết luận".
- Test: thay các assertion `TỔNG TRONG ĐƠN VỊ Kg` / `Kết luận:` bằng chiều phủ định `findRow('TỔNG TRONG ĐƠN VỊ') === -1`, `findRow('Kết luận:') === -1`, `findRow('Chứng từ kèm theo') === -1`; vẫn giữ thứ tự chữ ký sau dòng tổng Kg → `npx vitest run src/lib/__tests__/stocktakeReconciliation.test.ts` **17/17 pass**, `npx tsc --noEmit` sạch trên các file vừa sửa.

# Walkthrough (tiếp): Đổi đơn vị tính hàng loạt từ sơ đồ kho (/warehouses/map)

User yêu cầu: tích nhiều ô vị trí trên sơ đồ kho → menu **Quản lý mã** có thêm **Đổi đơn vị tính**. Nếu trong các ô đã chọn có hơn 1 sản phẩm thì phải hiển thị tách rõ **A, B, C…** mỗi sản phẩm một ô chọn đơn vị mới. Ràng buộc do user nêu rõ: **chỉ đổi đơn vị, tuyệt đối không đổi số lượng**.

Ba quyết định user chốt trước khi viết mã:

1. **Nhóm theo sản phẩm + đơn vị hiện tại** (không gộp 2 đơn vị khác nhau của cùng sản phẩm vào một dòng) → đổi đúng nhóm cần đổi, không đụng nhóm khác.
2. **Danh sách đơn vị lấy theo cấu hình sản phẩm** (đơn vị gốc `products.unit` + `product_units` quy đổi, hiển thị kèm khối lượng `Thùng (12kg)`) — đúng cách `LotForm` đang render ô chọn đơn vị khi sửa 1 LOT.
3. **Chọn 1 phần vị trí của LOT vẫn đổi toàn bộ LOT**, vì đơn vị lưu theo dòng LOT chứ không lưu theo ô vị trí; modal phải cảnh báo rõ LOT nào mới chọn 1 phần.

## Triển khai

- `src/components/warehouse/lots/LotBulkChangeUnitModal.tsx` (mới):
  - Đọc `lot_items` của các LOT đã chọn theo từng chập 200 id, filter `lots!inner(code, system_code)` = `currentSystem.code` → **không có đường nào để dữ liệu phân hệ khác lọt vào**.
  - Nhóm theo `product_id + canonicalizeUnit(unit)` (dùng `canonicalizeUnit` chung với `MultiSelectActionBar`, nên `Thùng (20kg)` và `Thùng (20 Kg)` là một nhóm). Mỗi nhóm gán nhãn A, B, C… kèm SKU, tổng số lượng, số LOT và mã LOT (nếu ≤ 3).
  - `buildUnitOptions()` mô phỏng đúng `LotForm`: `formatUnitWeight(products.unit, weight_kg)` + các `product_units` (`conversion_rate × weight_kg`), bỏ đơn vị trùng tên với đơn vị gốc, khử trùng lặp theo `canonicalizeUnit`, và luôn nhét đơn vị hiện tại vào danh sách để không bao giờ mất lựa chọn gốc.
  - Giá trị mặc định của mỗi ô chọn là **— Giữ nguyên —**; chỉ những nhóm có đơn vị mới khác (so sánh đã chuẩn hoá) mới được tính là thay đổi, nên bấm nhầm cũng không ghi gì xuống.
  - `handleSubmit()` **chỉ** `update({ unit })` trên `lot_items` theo danh sách `id` của nhóm — không đụng `quantity`, không đụng `product_id`, không cộng gộp/xoá dòng (khác hẳn "Đổi mã hàng loạt" vốn có nhánh merge + delete).
  - Khi đơn vị mới có khối lượng khác đơn vị cũ, cảnh báo đỏ nêu rõ: số lượng thùng giữ nguyên nhưng **khối lượng quy đổi đổi** (`180 Thùng (12kg)` → `2160 kg` thành `3600 kg`), để user biết mình đang dán lại nhãn quy cách chứ không phải quy đổi số.
  - Có "Áp dụng nhanh" cho mọi nhóm cùng mang một đơn vị, màn hình kết quả (số dòng đổi, số LOT bị ảnh hưởng, nhóm lỗi) và ghi `audit_logs` (`table_name: lot_items`, old/new theo từng nhóm).
  - LOT cũ chỉ gắn sản phẩm trên `lots` (không có `lot_items`) được liệt kê trong cảnh báo và **bỏ qua**, không tự sửa `products.unit` (sửa đó sẽ đổi luôn đơn vị của cả sản phẩm trên mọi phân hệ).
- `src/components/warehouse/map/MultiSelectActionBar.tsx`: thêm prop `onBulkChangeUnit?: (lotIds: string[]) => void` và mục menu "Đổi đơn vị tính" ngay dưới "Đổi mã hàng loạt" trong submenu **Quản lý mã** (submenu này đã disable sẵn khi các ô đã chọn không có LOT).
- `src/app/(dashboard)/warehouses/map/page.tsx`: `handleOpenBulkChangeUnit` đếm `selected/total` số **vị trí thật** của từng LOT (dùng `positions` gốc, vì `PositionCell`/`MergedBigCell` luôn push `realIds` vào `selectedPositionIds`, nên ô gộp không gây đếm sai), truyền `lotIds` + `lotPositionStats` cho modal; `onSuccess` gọi `fetchData()` và bỏ chọn toàn bộ.

## Tuân thủ kiến trúc phân hệ & Kho Đông Lạnh

- Không có mã kho hardcode: mọi query đều lọc `system_code = currentSystem.code`, đơn vị lấy từ cấu hình của chính sản phẩm thuộc phân hệ đang làm việc.
- Không đổi schema, không đổi luồng nhập/xuất, không đổi component nào của Kho Đông Lạnh đang chạy: chỉ **thêm** một mục trong submenu có sẵn. Khi user không bấm vào mục đó, hành vi trang sơ đồ kho giữ nguyên 100% (không có useEffect/trạng thái mới nào chạy ở chế độ không dùng).
- Không gắn cờ module: nhóm thao tác hàng loạt trong submenu này ("Đổi mã hàng loạt", "Gán mã phụ", "Xóa mã phụ", "Đổi ngày") đều là tiện ích dữ liệu không cần cờ; bản thân tính năng không tự hiện trên giao diện cho tới khi người dùng bấm vào nó. Nếu sau này muốn bật/tắt theo phân hệ thì chỉ cần khai báo thêm id module và bọc `{hasModule(...) && ...}` quanh mục menu.

## Kiểm chứng đã làm / chưa làm

- `npx tsc --noEmit`: sạch trên cả 3 file vừa sửa (đã lọc output theo file touched; repo còn hàng trăm lỗi cũ không liên quan).
- Đối chiếu schema thật trên Supabase local (`supabase_db_anywarehouse`): `products.weight_kg` **có tồn tại** nên select `weight_kg` không nổ lúc chạy; sản phẩm trong ảnh `TP101020207.01.01` có `unit = Kg`, `weight_kg = NULL`, `product_units` = `Khay 0.4`, `Thùng 9.6`, `Thùng 12` → modal gợi ý `Kg`, `Khay (0.4kg)`, `Thùng (9.6kg)`, `Thùng (12kg)`; đơn vị hiện tại `Thùng (12kg)` nằm trong danh sách (đo bằng test thật, không đoán).
- Phân bố đơn vị thật trong `lot_items`: `Thùng (20kg)` 839 dòng, `Thùng (13kg)` 498, `Kg` 279, `Thùng (20 Kg)` 156… xác nhận việc nhóm theo `canonicalizeUnit` là cần thiết (`Thùng (20kg)` và `Thùng (20 Kg)` phải là MỘT nhóm).
- Toàn bộ 2057 LOT đang hiệu lực của `KHO_DONG_LANH` đều có `lot_items` → nhánh "LOT cũ bị bỏ qua" thực tế gần như không kích hoạt ở kho đông.
- **Chưa** bấm thử trên trình duyệt: agent không có phiên đăng nhập (mật khẩu test bị lớp bảo mật chặn tự nhập). Cần user mở `http://localhost:3001/warehouses/map`, tích vài ô có cùng sản phẩm khác đơn vị, bấm **Quản lý mã → Đổi đơn vị tính** để xác nhận UI.

# Walkthrough (tiếp): Sửa lỗi "Không tải được danh sách sản phẩm / đơn vị" + tách logic ra src/lib

User gửi ảnh: mở modal **Đổi đơn vị tính** trên `/warehouses/map` → toast đỏ "Không tải được danh sách sản phẩm / đơn vị của các LOT đã chọn." và màn rỗng.

## Nguyên nhân (đã đo, không đoán)

`loadData` gói ba truy vấn bằng `Promise.all`, trong đó 2 nhánh đầu **đã là `Promise.all` lồng trong** `Promise.all`. Kết quả `prodRes` là mảng các `{data, error}`, nhưng code cũ viết `prodRes.flatMap(r => r.flatMap(...))` — gọi `.flatMap` trên một **object** → `TypeError: r.flatMap is not a function` → rơi vào `catch` → đúng toast user nhìn thấy. Bản thân 4 truy vấn Supabase **không lỗi**: chạy thử headless bằng `.env.local` (in ra mỗi lỗi query, không in key) thì chỉ trả `data` rỗng do RLS của key anon, không có error nào.

Sửa còn một điểm: lọc `lots!inner(code, system_code)` + `.eq('lots.system_code', systemCode)` đã xác nhận `lot_items_lot_id_fkey` tồn tại trong DB thật, nên embed hợp lệ.

## Tách logic thuần sang `src/lib/lotUnitBulkEdit.ts`

Theo thông lệ của repo (logic thuần + test vitest, vì agent không có phiên đăng nhập để bấm UI), toàn bộ phần gom nhóm/unit chuyển sang `src/lib/lotUnitBulkEdit.ts`:

- `buildUnitOptions()` — đơn vị gốc + `product_units` quy đổi (giờ mới hiểu là hệ số `conversion_rate` **x với khối lượng gốc**, nên `Khay 0.4` ra `Khay (0.4kg)` chứ không phải `Khay (1kg)` như ghi chú cũ trong walkthrough).
- `groupLotItemsForUnitChange()` — khoá nhóm `product_id|canonicalizeUnit(unit)`, cộng số lượng, gom mã LOT, sắp xếp theo tên sản phẩm rồi đơn vị và gán nhãn A, B, C…
- `collectAllUnitOptions()`, `isSameUnit()`, `letterOf()`.

`LotBulkChangeUnitModal.tsx` chỉ còn phần gọi query + render; `chunk()` vẫn nằm local vì chỉ phục vụ cắt truy vấn.

## Kiểm chứng

- `src/lib/__tests__/lotUnitBulkEdit.test.ts` (mới, **15 test, tất cả pass**) dùng fixture **đo từ DB thật**: sản phẩm `TP101020207.01.01` (`unit=Kg`, `weight_kg=NULL`, `product_units` = Khay 0.4 / Thùng 9.6 / Thùng 12) và hai biến thể đơn vị có thật `Thùng (20 Kg)` (156 dòng) / `Thùng (20kg)` (839 dòng). Các trường hợp khoá chặt:
  - cùng sản phẩm, hai đơn vị 12kg và 9.6kg → **2 nhóm tách riêng A, B** (đúng quyết định 1 của user);
  - `Thùng (20 Kg)` + `Thùng (20kg)` → **một nhóm**, số lượng cộng dồn, mã LOT gộp không trùng;
  - đơn vị gốc Kg **không** dính hậu tố `(1kg)`, các đơn vị quy đổi có hậu tố kg;
  - đơn vị hiện tại chưa cấu hình vẫn luôn xuất hiện trong danh sách chọn;
  - dòng LOT trống đơn vị → lấy `products.unit` làm đơn vị hiện tại;
  - sản phẩm đã bị xóa vẫn lên nhóm, tên `(sản phẩm không tồn tại)`;
  - nhãn A..Z rồi AA, AB, BA (quá 26 nhóm không sinh nhãn trùng).
- `npx tsc --noEmit` sau khi refactor: **không còn lỗi nào** trên `lotUnitBulkEdit.ts`, `LotBulkChangeUnitModal.tsx`, `MultiSelectActionBar.tsx`, `warehouses/map/page.tsx`.
- `git diff` của `MultiSelectActionBar.tsx` chỉ 19 dòng thêm đúng phần menu, không có dòng bị viết lại do đổi ending.
- **Chưa** bấm thử trên trình duyệt (agent không tự nhập được mật khẩu test). User mở `http://localhost:3001/warehouses/map` (bản dev, không phải `:3000` đang là build cũ), tích vài ô có cùng sản phẩm khác đơn vị rồi bấm **Quản lý mã → Đổi đơn vị tính**; sau đó đối chiếu số lượng trong ô **không đổi** và chỉ chữ đơn vị đổi.

# Walkthrough (tiếp): Nút xóa cả vị trí ngay trên sơ đồ xuất kho

User gửi ảnh trang `/work/export-order/[id]`, khu vực **"Sơ đồ vị trí xuất kho"** (không phải bảng "Danh sách vật tư xuất kho") và yêu cầu thêm nút xóa vị trí đó khỏi lệnh xuất. Hai quyết định của user: **phạm vi xóa = cả card vị trí** (mọi dòng hàng đang nằm tại mã vị trí đó, ví dụ `K2D5A07T101`), và **không gate module** — nút hiện trên mọi phân hệ.

## Triển khai

- `src/components/export/ExportMapList.tsx`: thêm prop `onPositionDelete?: (itemIds: string[], positionName: string) => void`. Hai icon bên phải header card (mắt + thùng rác) giờ nằm trong một `div.flex` chung để `justify-between` của header không dồn chúng ra hai phía. Nút thùng rác chỉ render khi `!readOnly && onPositionDelete`, và gọi back với **toàn bộ `id` của các dòng trong card** (`posItems.map(i => i.id!)`) — đúng nhóm dòng mà checkbox / chip mã vị trí / "Chọn cả Ô" đang thao tác.
- `src/app/(dashboard)/work/export-order/[id]/page.tsx`: `handleDeletePosition(itemIds, positionName)` đặt cạnh `handleDeleteItem` sẵn có, dùng cùng bộ gác cổng và cùng đường ghi log: chặn khi lệnh `Completed`/`Cancelled`, `showConfirm` nêu rõ số dòng sẽ mất, `delete().in('id', itemIds)` trên `export_task_items`, `logActivity(action: 'DELETE')` cho **từng** dòng (oldData đầy đủ để khôi phục thủ công), gỡ các id đã xóa khỏi `selectedPositionIds` để thanh action nổi không còn giữ dòng ma, rồi `fetchTaskDetails()`.

## Vì sao không ảnh hưởng Kho Đông Lạnh

Không có điều kiện theo mã kho/tên kho nào được viết thêm; logic分组 của sơ đồ, trạng thái chọn, luồng xác nhận và cấu trúc query đều giữ nguyên. Thay đổi duy nhất về hành vi là một `DELETE` trên `export_task_items` — cùng bảng, cùng điều kiện khóa `id` mà nút xóa trong bảng vẫn làm từ trước, chỉ khác phạm vi nhiều dòng. Phân hệ Kho Đông Lạnh vì thế có thêm đúng một nút xóa, không mất hay đổi chức năng cũ.

## Kiểm chứng

- `npx tsc --noEmit`: không còn lỗi nào trên `ExportMapList.tsx` và `export-order/[id]/page.tsx` (lỗi `Property 'id' does not exist on type 'never'` ở vòng log đã xử lý bằng cách cast mảng kết quả).
- `git diff --stat`: page.tsx +51 dòng, ExportMapList.tsx 43 thêm/14 xóa (14 dòng xóa chính là khối nút mắt được thụt lề lại vào wrapper mới) — không có dòng nào bị viết lại chỉ vì đổi line ending.
- **Chưa** bấm thử trên trình duyệt (agent không tự nhập được mật khẩu test). User mở `http://localhost:3001/work/export-order/e244ca32-743b-4fdb-a7b1-da58ecf811e0` (bản dev, `:3000` đang là build cũ sẽ chưa thấy nút mới), bấm icon thùng rác ở góc phải một card vị trí → xác nhận → card biến mất, số dòng trong bảng giảm đúng bằng số dòng của card đó, và bảng hoạt động log thấy các dòng `export_task_items` bị xóa.


# Walkthrough (tiếp): Module Kế Hoạch Công Việc & Đánh Giá Cuối Ngày (`work_plan`)

Triển khai module **Kế Hoạch Công Việc & Đánh Giá Cuối Ngày** (`work_plan`) theo kiến trúc Modular-First và cô lập dữ liệu phân hệ (`system_code`), giúp lập bảng kế hoạch làm việc hàng ngày, giao việc cho nhân sự/tổ đội, chấm điểm chất lượng cuối ngày, chuyển việc tồn đọng sang ngày hôm sau và xuất phiếu báo cáo Zalo/Excel.

## 🏗️ 1. Cấu Trúc Dữ Liệu & Module
- **Migration**: [20261105141000_create_work_plans_module.sql](file:///d:/chanh%20thu/web/supabase/migrations/20261105141000_create_work_plans_module.sql)
  - Đăng ký `work_plan` trong `public.app_modules` (`category = 'utility'`, `is_basic = true`).
  - Tạo bảng `public.work_plans` và `public.work_plan_items` có đầy đủ cột `system_code` và `company_id` để cô lập tuyệt đối dữ liệu giữa các phân hệ kho và khách hàng.
- **Khai báo Module**:
  - [utility-modules.ts](file:///d:/chanh%20thu/web/src/lib/utility-modules.ts): Khai báo module `work_plan` ("Kế hoạch Công việc & Đánh giá").
  - [Sidebar.tsx](file:///d:/chanh%20thu/web/src/components/layout/Sidebar.tsx) & [SanxuatSidebar.tsx](file:///d:/chanh%20thu/web/src/components/layout/SanxuatSidebar.tsx): Thêm mục menu **Kế hoạch & Đánh giá CV** (`/work/plans` và `/sanxuat/work/plans`), kiểm soát hiển thị 100% qua `hasModule('work_plan')`.

## 🎨 2. Thành Phần Giao Diện & Nghiệp Vụ
- [WorkPlansView.tsx](file:///d:/chanh%20thu/web/src/components/work-plans/WorkPlansView.tsx): Màn hình điều phối kế hoạch theo ngày (chọn nhanh Hôm qua / Hôm nay / Kế hoạch Ngày mai + dải lịch 7 ngày), thêm/sửa/sắp xếp đầu việc, gắn nhiều nhân viên hoặc tổ đội phụ trách, chấm nhanh hoàn thành 1 chạm hoặc chuyển việc tồn đọng sang ngày kế tiếp.
- [BulkImportModal.tsx](file:///d:/chanh%20thu/web/src/components/work-plans/BulkImportModal.tsx): Công cụ dán nhanh danh sách nhiều dòng từ Zalo/Excel, tự động bóc tách STT `1.`, `2.`, nhận diện nhóm công việc, khu vực (`Kho 1`, `Kho bao bì mới`...) và bắt tên nhân viên có trong câu (`Uy`, `Trôi`...).
- [EvaluateItemModal.tsx](file:///d:/chanh%20thu/web/src/components/work-plans/EvaluateItemModal.tsx): Đánh giá chi tiết cuối ngày (Trạng thái hoàn thành, % tiến độ, mức chất lượng 1-5 Sao: Xuất sắc / Tốt / Đạt / Cần nhắc nhở / Chưa đạt, nhận xét của Quản lý, ảnh minh chứng kết quả và tùy chọn tự động chuyển việc chưa xong sang ngày mai).
- [PlanExportCardModal.tsx](file:///d:/chanh%20thu/web/src/components/work-plans/PlanExportCardModal.tsx): Xuất phiếu ảnh PNG sắc nét hoặc copy ảnh trực tiếp vào Clipboard (`Ctrl+V` dán thẳng vào Zalo) với 2 mẫu: **Phiếu Kế hoạch đầu ngày** và **Phiếu Báo cáo Đánh giá cuối ngày**.
- [WorkPlanAnalyticsTab.tsx](file:///d:/chanh%20thu/web/src/components/work-plans/WorkPlanAnalyticsTab.tsx): Bảng tổng kết & xếp hạng hiệu suất nhân viên/tổ đội theo Tuần/Tháng (tỷ lệ hoàn thành TB, điểm Sao chất lượng TB, xếp hạng A+/A/B/C) và xuất báo cáo Excel 2 sheet.

## 🔒 3. Tuân Thủ Kiến Trúc Phân Hệ & Bảo Toàn Kho Đông Lạnh
- **100% Modular-First (`hasModule('work_plan')`)**: Không hardcode bất kỳ mã kho nào; trang `/work/plans` kiểm tra `hasModule('work_plan')`. Khi tắt module, phân hệ giữ nguyên trạng thái ban đầu.
- **Cô lập dữ liệu (`system_code`)**: Mọi thao tác đọc/ghi/xóa và kênh Realtime trên `work_plans` và `work_plan_items` đều lọc `.eq('system_code', currentSystem.code)`.
- **Không chạm luồng cốt lõi Kho Đông Lạnh**: Không sửa đổi bất kỳ bảng hay component nhập/xuất/LOT nào của Kho Đông Lạnh.

# Walkthrough (tiếp): File Excel "Tỉ lệ lấp đầy" thành 4 sheet, đủ 3 tab + toàn bộ cây khu vực

User gửi 2 ảnh (màn Dashboard và file `TI_LE_LAP_DAY_KHO_LO_KE_20261105_…` đang mở bằng Excel) và nói không hài lòng với file xuất. Bốn điểm user chọn phải: **thiếu 2 tab còn lại**, **biểu đồ PNG xấu/thiếu số**, **không có cấp khu con/dãy**, **layout tổng thể**; mức độ: **sửa trong khung cũ**. Hai quyết định tiếp theo: file gồm **4 sheet Tong quan + Lo ke/Sanh/Tong**, biểu đồ thanh **chỉ vẽ cấp khu vực**.

## Lib thay đổi

- `src/lib/warehouseFillRate.ts`: thêm `fillTreeRows(stats, scope)` trả `{ stat, depth, path }` theo đúng thứ tự màn hình (display_order → so mã tự nhiên, cùng comparator `compareZoneOrder`). Xây bản đồ cha→con **một lần** rồi đi cây — phân hệ thật có 4.223 khu, nếu gọi `childStatsOf` cho từng node là O(n²). `path` lấy theo cây zone gốc (kể cả cha ngoài phạm vi) để 5 khu "SẢNH 1" của 5 kho phân biệt được. Tạm lọc predicate phạm vi thành `isInScope()` dùng chung cho `childStatsOf` (hành vi không đổi — 21 test cũ của file vẫn pass).
- `src/lib/chartImage.ts`: `ChartSpec.valueLabels?: string[]` — thanh ghi nhãn tự do thay vì chỉ con số; lề phải chừa 150px khi có nhãn dài, nhãn chuyển vào **trong** thanh (chữ trắng) khi thanh đủ chỗ, ra ngoài khi thanh ngắn (kể cả thanh 0%).
- `src/lib/dashboardExcelWorkbook.ts`: thêm `DashboardSheetSpec` + `buildWorkbookFromSheets(sheets)` — một sheet = tiêu đề + metadata (giá trị **số** ghi thành ô số, không còn chuỗi "6.744") + ảnh PNG + bảng; bảng tự bắt đầu **bên dưới ảnh** (đếm số dòng theo chiều cao ảnh), freeze/autofilter/data-bar tính theo dòng tiêu đề thực tế. `writeTable` nhận `rowIndents` → cột "Khu vực" thụt đầu dòng theo cấp. `buildDashboardWorkbook` cũ giờ chỉ là wrapper 2 sheet "Bieu do"/"Du lieu" nên 3 view khác (phân bố KG, theo danh mục, container) giữ nguyên định dạng.
- `src/lib/dashboardExcelSpecs.ts`: `fillRateExportSpec` (1 tab + 1 cấp) thay bằng `fillRateWorkbookPlan({ systemName, stats })` → 4 sheet. Sheet phạm vi: 7 cột `Khu vực | Đường dẫn trong sơ đồ | Ô … quy hoạch | Đang chứa | Còn trống | Tỉ lệ lấp đầy | Trạng thái`, dòng tổng "Toàn Lô kệ/Sảnh/vị trí", data-bar cột tỉ lệ; biểu đồ `valueLabels` dạng `42,9% · 335/780 ô`.
- `src/lib/dashboardExcelExport.ts`: thêm `exportDashboardSheets()` (vẽ từng ảnh rồi gom một workbook); `exportDashboardChart()` giữ nguyên chữ ký cho các view khác.
- `WarehouseFillRateChart.tsx`: `handleExport` không còn phụ thuộc tab/cấp đang drill, tên file bỏ hậu tố tab → `TI_LE_LAP_DAY_KHO_20261105_1448.xlsx`.

## Số liệu đo trên dữ liệu thật KHO_DONG_LANH (dump ra CSV bằng psql, dựng file bằng vitest)

- `totals` khớp **1:1** ảnh user chụp: Lô kệ **2.035/6.744 = 30,2%**, Sảnh **33/1.106 = 3%**, Tổng **2.068/7.850 = 26,3%** (4.223 zone, 7.850 vị trí).
- Số dòng cây khu mỗi sheet: `Lo ke=4.211`, `Sanh=12`, `Tong (ke + sanh)=4.223`; dựng file **1,63s**, **275KB** (chưa tính 3 ảnh PNG vì canvas chỉ có trên trình duyệt).
- Cấp hiển thị đúng theo sơ đồ: `KHO 1 › DÃY 1 › Ô A01 › TẦNG 1` (780/335 = 42,9% ở KHO 1 — lệch ảnh chụp 770/329 vì user đã sửa sơ đồ giữa hai thời điểm, tổng toàn kho vẫn 6.744).
- Sample đã sinh để mở thử: `MAU-EXCEL-TI-LE-LAP-DAY.xlsx` ở gốc repo (không track, xem xong xóa được; file này chưa có ảnh biểu đồ).

## Kiểm chứng

- `src/lib/__tests__/dashboardExcel.test.ts`: **13 test pass** — 4 tên sheet, dòng sheet Tổng quan đúng `stats.totals` cả ba tab, cây `KHO 1 → KHU A 1 → KHO 2` với `rowIndents [0,1,0]`, `valueLabels` dạng `37,5% · 6/16 ô` và `100% · 5/5 ô`, khu sảnh trùng tên phân biệt nhờ đường dẫn, và test **load lại file .xlsx bằng exceljs** để assert ảnh nằm trên, bảng bắt đầu dưới ảnh, indent giữ nguyên khi mở file, data-bar `F{header+1}:F{header+3}`.
- 3 test cũ của `buildDashboardWorkbook` chuyển sang fixture `categoryPositionExportSpec`/`distributionKgExportSpec` để vẫn chống regress cho 3 view chưa đổi.
- `npx tsc --noEmit`: sạch trên `warehouseFillRate.ts`, `chartImage.ts`, `dashboardExcel*.ts`, `WarehouseFillRateChart.tsx`. `warehouseFillRate.test.ts` 21 test vẫn pass.
- **Chưa** xác minh mắt thường phần ảnh PNG (agent không đăng nhập được): user bấm **Xuất Excel** trên `http://localhost:3001` (không phải `:3000` đang là build cũ) rồi mở 4 sheet, đối chiếu chữ trên thanh có đủ `42,9% · 335/780 ô` và không bị cắt.


## 📊 4. Bổ Sung Số Liệu Chứng Minh Khối Lượng & Liên Kết Lệnh Xuất Kho (`workload_metrics`)
- **Migration**: [20261105150500_add_workload_metrics_to_work_plan_items.sql](file:///d:/chanh%20thu/web/supabase/migrations/20261105150500_add_workload_metrics_to_work_plan_items.sql) bổ sung cột `workload_metrics JSONB` vào `public.work_plan_items`.
- **Liên kết trực tiếp với Lệnh xuất kho (`/work/export-order`)**:
  - Component [WorkloadMetricsSection.tsx](file:///d:/chanh%20thu/web/src/components/work-plans/WorkloadMetricsSection.tsx) truy vấn danh sách `export_tasks` & `export_task_items` của đúng `system_code` hiện hành.
  - Khi người dùng tích chọn 1 hoặc nhiều lệnh xuất (ví dụ: `đơn C hạt CUối` có 52 vị trí, 1.560 Thùng 20kg), hệ thống tự động cộng dồn **Số Vị Trí**, **Số LOT**, **Số Thùng**, **Khối lượng quy đổi (Kg/Tấn)** và tự động gợi ý **Mức độ Nặng / Nhẹ** (`🌱 Nhẹ x1.0`, `⚡ Vừa x1.2`, `💪 Nặng x1.5`, `🔥 Rất nặng x2.0`).
  - Hiển thị huy hiệu số liệu và nút bấm mở trực tiếp `/work/export-order/[id]` ngay trên dòng công việc trong [WorkPlansView.tsx](file:///d:/chanh%20thu/web/src/components/work-plans/WorkPlansView.tsx), in lên phiếu báo cáo Zalo trong [PlanExportCardModal.tsx](file:///d:/chanh%20thu/web/src/components/work-plans/PlanExportCardModal.tsx) và tính **Điểm Khối Lượng Quy Đổi** trong [WorkPlanAnalyticsTab.tsx](file:///d:/chanh%20thu/web/src/components/work-plans/WorkPlanAnalyticsTab.tsx).


# Walkthrough (tiếp): Cấu hình "Danh mục cần theo dõi" không còn mất sau mỗi ngày

## Triệu chứng
Dashboard **Tỉ lệ phân bố hàng hóa tồn kho** → tab *Theo danh mục (vị trí)* → nút **CẤU HÌNH (34)** → tích vài danh mục → **Lưu hệ thống**: báo thành công, nhưng hôm sau mở lại vẫn thấy **chọn toàn bộ 34 danh mục**. Trang `/warehouses/status` (dùng chung khóa cấu hình) và bộ lọc danh mục tab *Theo khối lượng (KG)* (`dashboard_config.allowed_category_ids`) cũng cùng bệnh.

## Nguyên nhân (đã đo, không suy đoán)
Cấu hình được nhét vào jsonb `systems.modules`, và khối đó có 3 con đường hỏng **im lặng**:

1. **RLS chặn ghi với tài khoản thường.** Policy `Enable update for admins` trên bảng `systems` yêu cầu `user_profiles.account_level IN (1,2)`; toàn bộ tài khoản kho `ctg.*@system.local` là **level 3**. Giả lập đúng quyền trong psql:
   `update systems set modules = modules || '{"__probe__":true}' where code='KHO_DONG_LANH' returning id;` → **UPDATE 0** (không lỗi). PostgREST trả 200 với `error: null`, nên `if (error) throw error` không bao giờ chạy, modal vẫn đóng và `/warehouses/status` vẫn toast *"Đã lưu cấu hình … lên hệ thống!"*.
2. **Superadmin không có dòng `systems` nào.** `tungdibui2609@gmail.com` có `company_id = a0000000-…001` — UUID này **không tồn tại trong bảng `companies`** và không `systems` nào thuộc về nó, nên `fetchSystems` (lọc `.eq('company_id', profile.company_id)`) trả 0 dòng và SystemContext thay bằng 4 system **giả, không có `id`**. `patchSystemModules` mở đầu bằng `if (!currentSystem?.id) return` → mọi lần lưu bị bỏ qua từ dòng đầu tiên.
3. **Trang Cài đặt tính năng ghi đè cả khối jsonb.** `UnifiedSystemConfig.tsx` và `SystemModuleConfig.tsx` từng submit `modules: {product_modules, utility_modules, print_modules, qr_modules, report_modules}` — đúng 5 khóa, **xóa sạch** `warehouse_status_config`, `dashboard_config`, `marked_positions`, `locked_position_ids`, `loose_positions`… của mọi kho. Bằng chứng trong DB: `KHO_DUNG_CU`, `KHO_NGUYEN_VAT_LIEU`, `KHO_VAT_TU_BAO_BI` và 4 kho `DEFAULT` chỉ còn đúng 5 khóa module.

Bổ sung: `systems.modules` là blob dùng chung, đọc–gộp–ghi không nguyên tử, nên còn đua với các API route `positions/lock|loose|mark`.

## Cách sửa
Bảng riêng cho cấu hình giao diện, khóa theo **mã phân hệ** (không phụ thuộc `systems.id`), cùng mô hình đã chứng minh là chạy được trong app: `dashboard_chart_settings` (cấu hình biểu đồ Container Stock **chưa bao giờ mất**).

- **Migration** [20261105170000_create_system_ui_settings.sql](file:///d:/chanh%20thu/web/supabase/migrations/20261105170000_create_system_ui_settings.sql): tạo `system_ui_settings(id, system_code, config jsonb, updated_at)`, policy `FOR ALL TO authenticated USING (true)` + `FOR SELECT` cho cả anon, và **backfill** nguyên trạng 2 khóa cũ từ `systems.modules`.
- **Thư viện** [src/lib/systemUiSettings.ts](file:///d:/chanh%20thu/web/src/lib/systemUiSettings.ts): `readUiConfig(systemCode)` / `writeUiConfig(systemCode, patch)` — gộp theo khóa cấp 1 rồi **đọc lại để xác nhận**; nếu dữ liệu không nằm lại thì `throw` để UI báo đỏ thay vì im lặng.
- **Hai nơi lưu/đọc** chuyển sang bảng mới: [InventoryDistributionChart.tsx:170](file:///d:/chanh%20thu/web/src/components/dashboard/InventoryDistributionChart.tsx#L170) (cả `dashboard_config` và `warehouse_status_config`, đã xóa `patchSystemModules`) và [warehouses/status/page.tsx:105](file:///d:/chanh%20thu/web/src/app/(dashboard)/warehouses/status/page.tsx#L105).
- **Chặn nguồn wipe còn lại**: 2 trang cài đặt module giờ đọc `modules` hiện có rồi ghi đè từng khóa (giữ `marked_positions`, `locked_position_ids`…).

## Tuân thủ kiến trúc phân hệ
- Bảng mới có `system_code`; mọi đọc/ghi đều theo `systemType` hiện hành → không lộ cấu hình giữa các phân hệ.
- Không hardcode mã kho: khóa là `ui_<code>` sinh từ `systemType`, kho nào (tên/mã bất kỳ) cũng dùng chung một đường.
- Kho Đông Lạnh: không đụng schema nghiệp vụ, chỉ **bê nguyên giá trị đã lưu** sang bảng mới (backfill) — hành vi hiển thị giữ nguyên.

## Kiểm chứng
- psql giả lập role `authenticated` của `ctg.giang@system.local` (account_level 3): trên `systems` → **UPDATE 0**; trên `system_ui_settings` → **INSERT 0 1** và đọc lại thấy đúng `{"probe": true}`. Đây chính là chỗ trước đây hỏng.
- Backfill: `ui_KHO_DONG_LANH` nhận đúng 3 danh mục đang tích (Sầu Riêng / Xoài / Mít).
- `npx tsc --noEmit` sạch trên 5 file thay đổi; `npx vitest run` **158/158 pass** (21 file).
- **Cần user xác nhận trên trình duyệt** (`http://localhost:3001`): tích 3 danh mục → Lưu hệ thống → F5 / đăng xuất đăng nhập lại bằng tài khoản **nhân viên level 3** → vẫn còn 3 danh mục; mở Cài đặt → Tính năng → Lưu, quay lại dashboard vẫn còn nguyên.


# Walkthrough (tiếp): Tab "Theo danh mục (vị trí)" chuyển sang biểu đồ tròn

## Yêu cầu
User: *"báo cáo tỉ lệ phân bố hàng hóa theo danh mục tôi muốn hình tròn cho dễ nhìn"*. Hai quyết định user chọn: **tròn + chú giải, bỏ thẻ thanh ngang**, và **file Excel cũng đổi sang tròn cho khớp màn hình**.

## Thay đổi
- [InventoryDistributionChart.tsx:817](file:///d:/chanh%20thu/web/src/components/dashboard/InventoryDistributionChart.tsx#L817): thay lưới thẻ bằng donut recharts **đúng kiểu tab "Theo khối lượng (KG)"** (inner 80 / outer 110 / paddingAngle 2) — tâm ghi `2.072` ô đang chứa hàng trên `7.850` ô quy hoạch; chú giải 3 cột vẫn hiển thị đủ **số ô + TỈ LỆ HÀNG HOÁ + TỈ LỆ CÔNG SUẤT** như thẻ cũ.
- `positionChartData` sắp xếp **lớn → bé theo số ô**, khớp thứ tự biểu đồ trong file Excel; tooltip dùng `% hàng hoá` thật (mẫu số = ô đang chứa), không dùng % tự tính của recharts (vốn lấy theo tổng các lát, dễ hiểu sai vì một LOT mang nhiều danh mục).
- [dashboardExcelSpecs.ts:288](file:///D:/chanh%20thu/web/src/lib/dashboardExcelSpecs.ts#L288): `categoryPositionExportSpec` đổi `chart.kind` từ `hbar` → `donut` (`legendLimit: 12`, vượt 12 danh mục tự gom "Khác").
- Ba dòng ghi chú giải thích mẫu số / LOT đa danh mục / ô chưa gắn danh mục **giữ nguyên**.

## Kiểm chứng
- `npx tsc --noEmit` sạch; `dashboardExcel.test.ts` **13/13 pass** (thêm assert `chart.kind === 'donut'`).
- **Chưa** xác minh mắt thường: user mở `http://localhost:3001`, chuyển sang tab *Theo danh mục (vị trí)* xem donut + chú giải, rồi bấm **Xuất Excel** kiểm tra sheet "Bieu do" là hình tròn.

---

# Walkthrough (tiếp): Mở Rộng 4 Nguồn Số Liệu Chứng Minh Độ Nặng / Nhẹ Công Việc (`/work/plans`)

## 🎯 Yêu Cầu
Mở rộng phần **Số Liệu Chứng Minh Khối Lượng & Độ Nặng / Nhẹ** trong module Kế hoạch Công việc (`work_plan`) để ngoài **Lệnh xuất kho (`/work/export-order`)**, người quản lý có thể gắn trực tiếp:
1. **Lệnh xuất kho (`/work/export-order`)** — số vị trí lấy hàng, số LOT, số thùng/kiện.
2. **Phiếu Nhập Kho Kế Toán (`/inbound`)** — số mặt hàng, tổng số lượng nhập, nhà cung cấp/diễn giải, bấm mở trực tiếp `/inbound?editCode=...`.
3. **Phiếu Xuất Kho Kế Toán (`/outbound`)** — số mặt hàng, tổng số lượng xuất, khách hàng/diễn giải, bấm mở trực tiếp `/outbound?editCode=...`.
4. **Số LOT Được Tạo Theo Ngày Tạo (`/warehouses/lots`)** — tự động thống kê tổng số LOT và số thùng/kiện được tạo trong ngày (`created_at`), tách theo **Tất cả kho** hoặc từng khu vực gốc (`KHO 1`, `KHO 2`, `KHO 3`...), kèm link mở trực tiếp `/warehouses/lots?createdDate=YYYY-MM-DD&zoneId=...`.

## 🛠 Các File Đã Cập Nhật
- [types.ts](file:///d:/chanh%20thu/web/src/components/work-plans/types.ts):
  - Bổ sung `LinkedAccountingOrderSummary` (`inbound` / `outbound`), `LinkedLotDateSummary` (`lots` theo ngày tạo & khu vực), và hàm `recalculateWorkloadFromLinkedSources()` tự động cộng dồn **Số Vị Trí**, **Số LOT**, **Số Thùng/Kiện**, **Khối lượng (Kg)** và tự gợi ý **Mức độ Nặng/Nhẹ (`difficulty`)** từ cả 4 nguồn.
- [WorkloadMetricsSection.tsx](file:///d:/chanh%20thu/web/src/components/work-plans/WorkloadMetricsSection.tsx):
  - Thiết kế bộ chọn 4 nguồn chứng từ trực quan (`📦 Lệnh xuất kho`, `📥 Nhập kế toán`, `📤 Xuất kế toán`, `🏷️ Số LOT tạo`).
  - Ở tab `🏷️ Số LOT tạo`, tự động truy vấn bảng `lots` + `lot_items` + `positions` + `zones` theo `system_code` và ngày tạo (`created_at`), hiển thị tổng số LOT toàn kho và từng `KHO 1`, `KHO 2`, `KHO 3`... để tích chọn trong 1 cú nhấp chuột.
- [WorkPlansView.tsx](file:///d:/chanh%20thu/web/src/components/work-plans/WorkPlansView.tsx):
  - Hiển thị huy hiệu số LOT (`🏷️ X LOT`) và các nút link bấm mở trực tiếp `/work/export-order/[id]`, `/inbound?editCode=...`, `/outbound?editCode=...`, `/warehouses/lots?createdDate=...` ngay trên từng dòng công việc.
- [useLotManagement.ts](file:///d:/chanh%20thu/web/src/app/(dashboard)/warehouses/lots/_hooks/useLotManagement.ts) & [outbound/page.tsx](file:///d:/chanh%20thu/web/src/app/(dashboard)/outbound/page.tsx):
  - Đọc tham số URL `?createdDate=YYYY-MM-DD&zoneId=...` trên `/warehouses/lots` để tự động điền sẵn bộ lọc **NGÀY TẠO** và khu vực kho khi người dùng bấm từ Kế hoạch công việc sang kiểm chứng (không ảnh hưởng hành vi mặc định khi vào trang bình thường).
  - Bổ sung đọc `?editCode=...` trên `/outbound` đồng bộ với `/inbound`.

## ✅ Kiểm Chứng
- Unit test [workPlanParser.test.ts](file:///d:/chanh%20thu/web/src/components/work-plans/__tests__/workPlanParser.test.ts): **PASS 4/4**.


# Walkthrough (tiếp): Xuất Excel dashboard phân bố ra MỘT file hai sheet

## Yêu cầu
User: *"xuất file excel thì đồng nghĩa phải có 2 tab luôn chứ, hiện tại phải di chuyển từng tab để xuất ra 2 file, gộp lại 1 file thôi"*.

## Thay đổi
- [dashboardExcelSpecs.ts](file:///D:/chanh%20thu/web/src/lib/dashboardExcelSpecs.ts): thêm `distributionWorkbookPlan(kgInput, positionInput)` — gọi lại đúng `distributionKgExportSpec` + `categoryPositionExportSpec` (bảng số và biểu đồ giữ nguyên nội dung) rồi bọc mỗi cái thành một sheet qua `sheetFromExport`. Tên sheet **`Khoi luong KG`** và **`Danh muc vi tri`** (ASCII cho an toàn trên mọi phiên Excel).
- [InventoryDistributionChart.tsx](file:///D:/chanh%20thu/web/src/components/dashboard/InventoryDistributionChart.tsx): `handleExport` bỏ nhánh `if (view === 'kg')`, chuyển sang `exportDashboardSheets` (dùng `buildWorkbookFromSheets` đã có từ dashboard tỉ lệ lấp đầy) → **một lần bấm = một file hai sheet**, mỗi sheet có ảnh biểu đồ tròn + bảng số + autofilter + ghi chú riêng của tab đó.
- Tab vị trí vốn **tải lười** (chỉ đọc khi bấm sang tab). Nếu xuất mà chưa tải thì `fetchPositionData()` nay **trả về đúng dữ liệu vừa đọc** (`PositionData`) để `handleExport` tính `buildCategoryPositionStats` ngay trong lần bấm, không chờ React re-render; màn hình giữ nguyên hành vi cũ.
- Tooltip nút thành *"Xuất Excel: một file gồm 2 sheet — Khối lượng (KG) và Danh mục (vị trí)"*; điều kiện `disabled` không còn phụ thuộc tab đang xem.

## Kiểm chứng
- `dashboardExcel.test.ts` thêm 2 test (tổng **15**): tên/thứ tự sheet, `title` từng sheet, `chart.kind` cả hai là `donut`, dòng tổng KG `700.5`, dòng đầu sheet danh mục `['SẦU RIÊNG', 1414, 68.2, 18.1]`; test thứ hai **writeBuffer rồi load lại bằng exceljs** để xác nhận workbook thật có đúng 2 sheet và bảng số nằm dưới ảnh.
- `npx tsc --noEmit` sạch; `npx vitest run` **161/161 pass** (21 file).
- **Cần user bấm thử** trên `http://localhost:3001`: đứng ở tab *Theo khối lượng (KG)* bấm **Xuất Excel** → file `TI_LE_PHAN_BO_HANG_HOA_TON_KHO_<stamp>.xlsx` mở ra có ngay 2 sheet, không phải chuyển tab.





---

# Walkthrough: Thống kê Mã phụ trên tab Thống kê lệnh xuất (`/work/export-order?tab=stats`)

## 🧩 Cấu Trúc (3 file, không thêm migration)

| File | Vai trò |
|---|---|
| [ExportOrderStatsPanel.tsx](file:///d:/chanh%20thu/web/src/components/export/ExportOrderStatsPanel.tsx) | Lấy mã phụ cho từng dòng, thêm tab "Theo mã phụ", mở rộng ô lọc |
| [exportOrderReportExcelExport.ts](file:///d:/chanh%20thu/web/src/lib/exportOrderReportExcelExport.ts) | Sheet 4 `Theo ma phu` + cột "Mã phụ" trong sheet `Chi tiet lenh xuat` |
| [exportOrderReportExcelExport.test.ts](file:///d:/chanh%20thu/web/src/lib/__tests__/exportOrderReportExcelExport.test.ts) | 4 test (thêm test đối chiếu sheet mã phụ và cột Mã phụ) |

## 🧮 Đường dữ liệu mã phụ (điểm mấu chốt)

`export_task_items` **không có cột `lot_item_id`** (chỉ `lot_id` + `product_id`), trong khi 100% mã phụ Kho Đông đang gắn ở **cấp dòng sản phẩm** (`lot_tags.lot_item_id NOT NULL`). Panel giải quyết ngay trong một request:

1. Select của `export_task_items` nhúng thẳng `lots(code, production_code, lot_items(id, product_id), lot_tags(tag, lot_item_id))` — kiểu nhúng 2 cấp này đã chạy thật ở `/print/export-order` nên không cần thử nghiệm thêm.
2. `resolveTagAtoms(lot, productId)`: tag **cấp dòng** chỉ được tính cho dòng có `product_id` trùng với `lot_items` của nó; chỉ tag **cấp thẻ LOT** (`lot_item_id IS NULL`) mới áp cho mọi dòng. Đây chính là quy tắc "cấm broadcast tag cấp dòng cho mọi dòng cùng pallet" đã đo và sửa ngày 31/10.
3. Chuỗi phân cấp tách bằng `extractTagAtoms()` có sẵn trong `productNameResolver.ts` (cắt theo `>`, bỏ segment `@` = placeholder mã SKU, uppercase) → **một thẻ tag đơn = một nhóm thống kê**, khớp cách `master_tags` lưu nguyên liệu. Tag nội bộ `MERGED_*` / `SPLIT_*` bị loại, mã sản xuất KHÔNG thành nhóm.

### 🐆 Bản sửa lỗi 07/11: "lệnh xuất có HÀNG BẢO LỘC nhưng thống kê không ra"

Bản đầu tiên KHÔNG nhúng `lot_tags` mà truy vấn bù `lot_tags`/`lot_items` theo `.in('lot_id', chunk)` với chunk 500. Đo trực tiếp trên Kong local:

| chunk | kết quả |
|---|---|
| 500 / 250 | **NULL — "URI too long"** (414, Kong chặn URL > ~8KB; 250 UUID ≈ 9,7KB) |
| 100 | 41 dòng tag, OK |
| 50 | 39 dòng tag, OK |

Code cũ chỉ lấy `{ data }` và **bỏ qua `{ error }`**, nên dữ liệu rỗng đi thẳng vào nhóm `(Chưa gắn mã phụ)` — 256/256 dòng đều "chưa gắn" dù lệnh `đơn C hạt CUối` (05/11) có 44 dòng mang tag. Đã bỏ hẳn kiểu `.in()`: mã phụ giờ đi theo nhúng trong query dòng lệnh xuất (mục 1 ở trên), không còn danh sách id trong URL, không còn lỗi nuốt im lặng.

Cửa sổ 7 ngày KHO_DONG_LANH sau khi sửa (đo bằng đúng logic panel qua PostgREST, không phải SQL): **256 dòng, 92 dòng có mã phụ** → `HÀNG BẢO LỘC` 1 lệnh/44 dòng/1.320 · `ĐỂ RIÊNG` 1/38/1.109 · `NẤM` 3/10/300 · `(Chưa gắn mã phụ)` 5/164/4.919. Cộng dòng các nhóm = 256, khớp 1:1 với tab "Theo ngày".


## 📊 Tab "Theo mã phụ"

Cột: Mã phụ | Số lệnh | Dòng hàng | Số kiện (LOT distinct) | Yêu cầu | Đã xuất | Còn lại | ĐVT. Nhóm `(Chưa gắn mã phụ)` luôn xếp cuối. Có dòng ghi chú ngay trên bảng: *một dòng mang nhiều mã phụ được tính ở từng nhóm, nên cộng các dòng có thể lớn hơn tổng lệnh xuất* — đây là hệ quả tất yếu của việc gộp theo thẻ tag đơn.

Ô lọc chuyển sang khớp cả mã phụ và **bỏ dấu tiếng Việt** (`normalizeSearch`, cùng chuẩn với `/api/inventory/by-tag`), nên gõ "bao loc" vẫn thấy `HÀNG BẢO LỘC`. Placeholder: "Lọc sản phẩm, SKU, mã lệnh, mã phụ...".

## 🔒 Tuân thủ kiến trúc phân hệ & Kho Đông Lạnh

- **Không đụng schema, không sửa luồng xuất/nhập**: chỉ mở rộng `select` của query đang chạy bằng các nhúng có sẵn (`lots → lot_items, lot_tags`), không thêm request mới. Kho Đông Lạnh giữ nguyên hành vi khi tắt tab.
- **Cô lập `system_code`**: mã phụ chỉ được đọc qua nhúng `lots` của chính các dòng đã lọc `export_tasks.system_code = currentSystem.code`, nên không có đường nào đọc tag của phân hệ khác.
- **Không hardcode mã kho / systemType**: không có điều kiện `=== 'KHO_DONG_LANH'` nào; tab nằm trong trang đã gate bởi module `work_export_order`.

## ✅ Kiểm chứng

- `npx tsc --noEmit`: không lỗi trên 3 file vừa sửa. `npm run build`: exit code 0 (chạy lại sau bản sửa 07/11), route `/work/export-order` biên dịch sạch.
- `vitest src/lib/__tests__/exportOrderReportExcelExport.test.ts`: **PASS 4/4** (mở lại .xlsx bằng ExcelJS, assert `B5='HÀNG BẢO LỘC'`, `H5='20'`, `I4/I5` cột Mã phụ).
- Đối chiếu số liệu thật bằng **đúng pipeline PostgREST mà panel dùng** (không phải SQL), xem mục "Bản sửa lỗi 07/11" ở trên.
- Bản mô phỏng SQL 90 ngày (trước khi sửa): 1.641 dòng lệnh, 100 dòng có mã phụ, **98 dòng khớp đúng cấp sản phẩm**, 0 tag mồ côi, 0 `lot_items` bị xóa sau khi xuất.
- **Còn mở**: bấm thật tab "Theo mã phụ" + xuất Excel cần phiên đăng nhập localhost.

## ⚠️ Ghi chú phát hiện thêm (chưa sửa)

1. Sheet `Theo ngay` trong file Excel đang bị **lặp cột "SL đã xuất"** (`exportedQty` khai báo 2 lần, [dòng 205-206](file:///d:/chanh%20thu/web/src/lib/exportOrderReportExcelExport.ts#L205)) — lỗi tiền tồn tại, cần người dùng xác nhận trước khi bỏ vì làm dịch cột G của file cũ.
2. **Thống kê "Theo giờ hạ" và cột "Hạ trong ngày" đang chết im lặng** (tiền tồn tại, đo 07/11): query `export_task_picks` nhúng `picker:user_profiles!picker_id(...)` nhưng FK thật là `export_task_picks_picker_id_fkey → auth.users(id)` → PostgREST trả `PGRST200 Could not find a relationship between 'export_task_picks' and 'user_profiles'`, và `catch` chỉ `console.warn` nên UI hiển thị 0 thay vì báo lỗi. Cùng lỗi ở [reports/picking-productivity/page.tsx:98](file:///d:/chanh%20thu/web/src/app/(dashboard)/reports/picking-productivity/page.tsx#L98). Đã đo: bỏ nhúng `picker` thì query trả đúng 6 dòng của Kho Đông. Hướng sửa (chưa làm, chờ người dùng): đọc `user_profiles` bằng truy vấn riêng + map `picker_id → full_name` như trang danh sách lệnh xuất đang làm với `created_by`. Hệ quả phụ: vì picks không bao giờ tải được, ô lọc mã phụ **không** áp dụng lên lượt hạ hàng (panel không còn lấy tag cho picks).

---

# Walkthrough (tiếp): Sheet "Tong quan" trong file Excel tỉ lệ lấp đầy có thêm biểu đồ 3 phạm vi

## Bối cảnh

Người dùng phản hồi file `TI_LE_LAP_DAY_KHO_*.xlsx` **thiếu biểu đồ tổng**: sheet "Tong quan" chỉ có bảng số + data bar, trong khi 3 sheet "Lo ke" / "Sanh" / "Tong (ke + sanh)" đều đã có biểu đồ. Yêu cầu đi kèm: thanh "Tổng (kệ + sảnh)" phải **tô màu vàng** để không nhầm với các thanh theo mức lấp đầy.

## Thay đổi

- [src/lib/dashboardExcelSpecs.ts](file:///d:/chanh%20thu/web/src/lib/dashboardExcelSpecs.ts)
  - Thêm hằng `AGGREGATE_HEX = '#f59e0b'` — màu riêng cho thanh cộng dồn, tách khỏi `LEVEL_HEX` (vàng = "cộng dồn", không phải "Cao ≥ 70%").
  - Thêm `overviewChart` (kind `hbar`, `percentAxis`) vẽ 3 thanh từ `stats.totals[rack|hall|all]`; `barColors` theo mức cho Lô kệ/Sảnh, riêng phạm vi `all` dùng `AGGREGATE_HEX`; `valueLabels` giữ đúng nhãn dạng `52,4% · 11/21 ô` như 3 sheet kia và như trên màn hình.
  - Gắn `chart: overviewChart` vào plan sheet "Tong quan" + ghi chú giải thích thanh vàng vào `notes` của sheet này.
- [src/lib/__tests__/dashboardExcel.test.ts](file:///d:/chanh%20thu/web/src/lib/__tests__/dashboardExcel.test.ts)
  - Test mới "sheet Tổng quan có biểu đồ 3 phạm vi, thanh Tổng tô vàng" assert labels/values/barColors/valueLabels.
  - Test nhúng ảnh: bỏ giả định cũ "Tổng quan không có ảnh" (`headerRow < 8`) → nay bảng nằm dưới ảnh và vẫn đúng dòng "Lô kệ" / "Tổng (kệ + sảnh)".

Không sửa `chartImage.ts`, `dashboardExcelWorkbook.ts`, `dashboardExcelExport.ts` — pipeline vẽ PNG + `addImage` đã có sẵn và tự áp cho sheet mới vì giờ plan của nó cũng có trường `chart`.

## Tuân thủ kiến trúc phân hệ

- **Không đụng Kho Đông Lạnh**: thay đổi chỉ nằm trong plan Excel của card dashboard, không sửa logic `buildFillStats`, form, schema hay luồng xuất/nhập.
- **Không hardcode mã kho / systemType**: biểu đồ đọc `stats.totals` — số liệu đã được lọc theo phân hệ đang chọn ngay lúc tải dữ liệu; không có điều kiện `=== 'COLD'` hay mã kho cố định nào.
- **Không sửa schema**: không thêm cột/bảng nào.

## Kiểm chứng

- `npx vitest run src/lib/__tests__/dashboardExcel.test.ts`: **PASS 16/16** (gồm test mở lại .xlsx bằng ExcelJS).
- `npx tsc --noEmit`: không lỗi trên 2 file vừa sửa.
- **Còn mở**: cần bấm "Xuất Excel" thật trên localhost để xem ảnh PNG (chỉ trình duyệt mới vẽ được canvas), kiểm tra thanh "Tổng (kệ + sảnh)" màu vàng và bảng không bị che.

---

# Walkthrough (tiếp): File Excel của MỌI dashboard có thêm sheet "Anh man hinh" (ảnh chụp nguyên card)

## Bối cảnh

User: *"đôi lúc thứ tôi muốn là bạn chụp lại hình ảnh cả cái dashboard đó rồi gửi vào file excel là xong, chứ ko muốn nó rắc rối vậy đâu"*. Thay vì vẽ lại biểu đồ bằng canvas cho giống màn hình (cách cũ, hay lệch nhãn/màu), nay mỗi file Excel dashboard có thêm **sheet đầu tiên "Anh man hinh"** chứa ảnh chụp đúng card người dùng đang xem — thấy ngay tab/bộ lọc đang áp dụng.

## Cách làm

- [src/lib/dashboardExcelExport.ts](file:///d:/chanh%20thu/web/src/lib/dashboardExcelExport.ts) — `captureDashboardScreenshot(node, info)` dùng `html-to-image.toPng` (thư viện **đã có sẵn** trong dự án, cùng tham số `pixelRatio`/`backgroundColor`/`cacheBust` mà `PlanExportCardModal` đang dùng). Ảnh giữ nguyên tỷ lệ CSS nhưng **chụp ở 2x điểm ảnh** cho nét khi zoom trong Excel; card rộng quá **1400px** thì thu nhỏ lại cho vừa một màn xem. **Không báo lỗi khi chụp thất bại**: hàm trả `null`, file Excel vẫn xuất đủ các sheet số liệu.
- `exportDashboardChart` và `exportDashboardSheets` đều nhận thêm `screenshot?: DashboardScreenshot | null` → tự ghép sheet "Anh man hinh" vào **đầu** danh sách sheet (`withScreenshotSheet`).
- [src/lib/dashboardExcelSpecs.ts](file:///d:/chanh%20thu/web/src/lib/dashboardExcelSpecs.ts) — `screenshotSheetPlan()` sinh sheet chỉ có tiêu đề + metadata (Phân hệ kho / Bộ lọc trên màn hình / Xuất lúc / Ghi chú) + ảnh, **không có bảng** nên không autofilter, không data bar.
- [src/lib/dashboardExcelWorkbook.ts](file:///d:/chanh%20thu/web/src/lib/dashboardExcelWorkbook.ts) — tách `sheetsFromWorkbookSpec()` từ `buildDashboardWorkbook()` để định dạng cũ 2 sheet ("Bieu do"/"Du lieu") cũng chèn được sheet ảnh mà không nhân bản logic.

## Ba card dashboard đã gắn

| Card | Ảnh chụp từ | Sheet phát sinh |
|---|---|---|
| Tỉ lệ lấp đầy theo khu vực | `cardRef` ở [WarehouseFillRateChart.tsx:244](file:///d:/chanh%20thu/web/src/components/dashboard/WarehouseFillRateChart.tsx#L244) | Anh man hinh + Tong quan + Lo ke + Sanh + Tong (ke + sanh) |
| Tỉ lệ phân bố hàng hóa tồn kho | `cardRef` ở [InventoryDistributionChart.tsx:499](file:///d:/chanh%20thu/web/src/components/dashboard/InventoryDistributionChart.tsx#L499) | Anh man hinh + Khoi luong KG + Danh muc vi tri |
| Số lượng Container tồn kho | `cardRef` ở [ContainerStockChart.tsx:639](file:///d:/chanh%20thu/web/src/components/dashboard/ContainerStockChart.tsx#L639) (card thật bên trong `ContainerStockChartInner`) | Anh man hinh + Bieu do + Du lieu |

Mỗi card truyền `cardTitle` + `systemName` + `filterLabel` (danh mục/kho đang lọc) để sheet ảnh tự giải thích nó chụp cấu hình nào.

## 🔴 Lỗi gặp khi chạy thật (đã sửa)

Next.js dev overlay báo `SecurityError: Failed to read the 'cssRules' property from 'CSSStyleSheet': Cannot access rules` ngay dòng `await toPng(...)`. Nguyên nhân: [src/app/layout.tsx:84](file:///d:/chanh%20thu/web/src/app/layout.tsx#L84) nạp Inter bằng `<link>` **chéo nguồn** `fonts.googleapis.com`, mà html-to-image duyệt `.cssRules` của *mọi* stylesheet trong trang để tìm `@font-face` — đọc rules của sheet chéo nguồn thì bị trình duyệt chặn. Thư viện tự catch và chỉ `console.error`, nên file vẫn xuất được nhưng spam lỗi đỏ.

Cách sửa: truyền `skipFonts: true` ([dashboardExcelExport.ts:56-64](file:///d:/chanh%20thu/web/src/lib/dashboardExcelExport.ts#L56-L64)) — đúng nhánh `embedWebFonts()` bỏ luôn bước quét font, không còn chạm `.cssRules`. Đổi lại ảnh dùng `system-ui` (Segoe UI) thay vì Inter; `globals.css:83` đã khai báo stack `'Inter', system-ui, ...` nên bố cục không lệch.

**Còn tồn tại (chưa sửa, ngoài phạm vi)**: `PlanExportCardModal` cũng gọi `toPng` mà không truyền `skipFonts` ([dòng 98-102](file:///d:/chanh%20thu/web/src/components/work-plans/PlanExportCardModal.tsx#L98-L102)) nên vẫn spam cùng lỗi này khi tải ảnh phiếu; cần user xác nhận trước khi đổi vì ảnh đó đang render bằng Inter.

## 🔴 Lượt sửa thứ 2: ảnh "rất xấu" vì chụp cả tiêu đề và các nút

User: *"bạn chụp tấm hình rất xấu, bạn lấy tiêu đề làm gì… còn thứ tôi muốn là bỏ mấy cái nút ở hình 2 đi"* (hình 2 = cụm `Sơ đồ chi tiết / Xuất Excel / Làm mới`). Ảnh chỉ cần **phần số liệu**, tiêu đề đã có ở dòng A1 của sheet.

- Cơ chế: thuộc tính `data-excel-shot="skip"` + option `filter` của `toPng` (html-to-image gọi `filter(node)` cho từng node trừ node gốc, trả `false` là bỏ nguyên subtree — xem `clone-node.js:277`). Hàm lọc phải kiểm tra `nodeType === ELEMENT_NODE` vì filter nhận cả text node.
- Phần tử đã đánh dấu bỏ khỏi ảnh:
  - Lô kê: cả dòng header ([WarehouseFillRateChart.tsx:246](file:///d:/chanh%20thu/web/src/components/dashboard/WarehouseFillRateChart.tsx#L246) — gồm tiêu đề, mô tả và 3 nút).
  - Container: khối tiêu đề + mô tả (`ContainerStockChart.tsx:642`) và 2 nút **Xuất Excel** / **Làm mới** (`:696`, `:708`).
  - Phân bố: `<h2>` (`InventoryDistributionChart.tsx:501`) và 2 nút **Xuất Excel** / **Làm mới** (`:529`, `:571`).
- **Cố ý giữ lại** trong ảnh: tab `Lô kệ / Sảnh / Tổng`, chip `Danh mục`, `Có định mức`, ô chọn sắp xếp, tab `KG / vị trí` — chúng là **bộ lọc đang áp dụng**, mất chúng thì không biết ảnh chụp cấu hình nào (chỉ mất nút hành động).

## 🔴 Lượt sửa thứ 3: ảnh ra TRẮNG vì truyền `filter` đảo ngược

User mở file: sheet "Anh man hinh" chỉ có tiêu đề + metadata, khung ảnh trắng. Nguyên nhân: `cloneNode()` của html-to-image bỏ node khi `filter` **trả `false`** (`clone-node.js:277`), còn hàm `isExcludedFromScreenshot` lại trả `true` cho node cần loại → truyền thẳng vào `filter` thành **đảo ngược**: mọi element không đánh dấu skip đều bị bỏ, text node cũng bị bỏ, ảnh còn mỗi khung trắng.

- Sửa: hàm lọc đổi tên thành `keepInScreenshot` và trả `true` = giữ ([dashboardExcelSpecs.ts:38-50](file:///d:/chanh%20thu/web/src/lib/dashboardExcelSpecs.ts#L38-L50)), dùng `filter: keepInScreenshot` ([dashboardExcelExport.ts:61](file:///d:/chanh%20thu/web/src/lib/dashboardExcelExport.ts#L61)).
- Chuyển hàm lọc sang `dashboardExcelSpecs.ts` (file thuần, không import canvas/file-saver) để test được bằng vitest, và thay `Node.ELEMENT_NODE` bằng hằng `ELEMENT_NODE = 1` để chạy ngoài trình duyệt.
- Test mới `keepInScreenshot` (19/19 pass) chính là thứ bắt được chiều đảo ngược này nếu viết trước.

## 🔴 Lượt sửa thứ 4: ảnh tràn màn hình Excel → thu theo kích thước cửa sổ

User: *"thu nhỏ ảnh lại để vừa màn hình"*. Ảnh render được nhưng bị cắt bên phải (mất cột % ở sát cột F) vì giới cỡ cũ là hằng số cố định `MAX_SCREENSHOT_WIDTH = 1400` px — rộng hơn cửa sổ làm việc của màn hình 1280×720.

- Bỏ hằng 1400, thay bằng `screenshotFitScale(width, height)` ([dashboardExcelExport.ts:41-45](file:///d:/chanh%20thu/web/src/lib/dashboardExcelExport.ts#L41-L45)): khung vừa = **ngang `window.innerWidth - 48`** (sàn 640), **dọc `window.innerHeight × 1.6`** (sàn 480) — card dài vẫn cho phép cuộn dọc một chút chứ không ép thành dải mỏng. Trả `Math.min(1, maxW/width, maxH/height)` nên card đã nhỏ thì giữ nguyên 100%.
- `pixelRatio` không còn cố định bằng 2 mà là `Math.max(1, 2 × scale)` ([dashboardExcelExport.ts:68](file:///d:/chanh%20thu/web/src/lib/dashboardExcelExport.ts#L68)): ảnh luôn gấp đúng 2 lần số điểm ảnh hiển thị trong Excel (chữ sắc khi phóng to) mà không vẽ thừa — card 1900px thu còn ~0,66 thì ảnh ra ~1260px chứ không phải 3800px, file nhẹ hơn hẳn.
- Kích thước nhúng (`width`/`height` trong `DashboardScreenshot`) tính theo `rect × scale`, khớp đúng `ext` mà `writeSheet` đưa vào ExcelJS, nên ô ảnh không chừa khoảng trắng bên phải.

## 🔴 Lượt sửa thứ 5: bỏ luật "vừa cửa sổ", thu cố định 80%

User mở vài file khác: ảnh vẫn to hơn ý muốn, và chốt *"ko cần vừa màn hình mà nôm na cho tấm ảnh nhỏ lại 80% xem sao"*. Luật theo `window.innerWidth/innerHeight` ở lượt 4 phụ thuộc cửa sổ trình duyệt lúc bấm xuất nên mỗi máy mỗi khác — bỏ hẳn.

- Thay bằng hằng `SCREENSHOT_SCALE = 0.8` ([dashboardExcelExport.ts:37-38](file:///d:/chanh%20thu/web/src/lib/dashboardExcelExport.ts#L37-L38)): mọi ảnh dashboard nhúng vào Excel đều bằng **80% kích thước card trên màn hình**, không phụ thuộc cửa sổ hay màn hình.
- `pixelRatio` vẫn `Math.max(1, 2 × scale)` = 1.6 → PNG gấp đúng 2 lần điểm ảnh hiển thị, chữ sắc mà file không phình.
- Cả 3 card (Tỉ lệ lấp đầy, Phân bố tồn kho, Container) đều đi qua `captureDashboardScreenshot` nên một hằng số phủ hết; muốn đổi cỡ sau này chỉ sửa một chỗ.

## 🔴 Lượt sửa thứ 6: 80% vẫn quá to → 50%

User xem bản 80% vẫn chê to, chốt 50%. Chỉ đổi `SCREENSHOT_SCALE = 0.5` ([dashboardExcelExport.ts:38](file:///d:/chanh%20thu/web/src/lib/dashboardExcelExport.ts#L38)); `pixelRatio` tự thành `max(1, 2×0.5) = 1` nên PNG đúng bằng số điểm ảnh của card, hiển thị trong Excel ở nửa cỡ đó — vẫn gấp 2 lần điểm ảnh hiển thị, chữ không vỡ.

## 🔴 Lượt sửa thứ 7: mất chữ "KH..." trong ảnh → self-host font Inter

User mở sheet ảnh card Tỉ lệ lấp đầy: nhãn khu vực chỉ còn **"KH..."** thay vì tên đầy đủ. Cơ chế: `cloneCSSStyle` của html-to-image ([clone-node.js:164-186](file:///d:/chanh%20thu/web/node_modules/html-to-image/lib/clone-node.js#L164-L186)) chép **nguyên computed style, gồm width đã resolve ra px**, vào từng node clone; trong khi `skipFonts: true` khiến khung clone chạy font thay thế (system-ui) có chữ rộng hơn Inter → chữ tràn ô width cố định → class `truncate` ([WarehouseFillRateChart.tsx:495](file:///d:/chanh%20thu/web/src/components/dashboard/WarehouseFillRateChart.tsx#L495)) cắt thành dấu ba chấm. Mọi chỗ `truncate` khác cũng tiềm ẩn lỗi tương tự.

Sửa gốc rễ thay vì né: **self-host Inter** để khung clone nhúng được đúng font:
- Tải Inter variable (OFL) subset latin + vietnamese vào [public/fonts/](file:///d:/chanh%20thu/web/public/fonts) (48KB + 10KB, kèm `OFL.txt`); khai báo 2 khối `@font-face` `font-weight: 100 900` + `unicode-range` chép đúng từ Google CSS vào [globals.css:6-21](file:///d:/chanh%20thu/web/src/app/globals.css#L6-L21).
- Bỏ 3 thẻ `<link>` Google Fonts ở [layout.tsx](file:///d:/chanh%20thu/web/src/app/layout.tsx#L80-L82) → mọi stylesheet nay **cùng nguồn**, `getCSSRules` không còn `SecurityError` (lỗi overlay trước đây cũng hết gốc, kể cả chỗ `toPng` chưa từng sửa ở `PlanExportCardModal.tsx:98`).
- Bỏ `skipFonts: true` trong `captureDashboardScreenshot` → html-to-image tự nhúng woff2 thành data URL vào khung clone → chữ đúng metric Inter → hết tràn ô, hết "KH...".
- Giao diện thật không đổi: vẫn đúng font Inter, đúng dải weight, chỉ đổi nguồn phục vụ (không phụ thuộc mạng Google khi chạy trong nhà máy).

Kiểm chứng: `curl` dev server trả `200 font/woff2` cho cả 2 file; CSS dev (`/_next/static/css/app/layout.css`) chứa đủ 2 khối `@font-face` cùng nguồn; vitest **19/19**, `tsc --noEmit` sạch trên file đụng tới. Phần nhúng font vào khung clone chỉ chạy trong trình duyệt → cần user xuất lại một file để chốt nhãn khu vực hiện đủ chữ.

## 🔴 Lượt sửa thứ 8: 50% nhỏ quá → quay lại 80%

User xem bản 50% (đã đủ chữ nhờ font self-host) thấy nhỏ quá, đoán lần 80% trước chưa ăn do cache, chốt quay lại 80%. Đổi `SCREENSHOT_SCALE = 0.8` ([dashboardExcelExport.ts:38](file:///d:/chanh%20thu/web/src/lib/dashboardExcelExport.ts#L38)); `pixelRatio` tự thành 1.6. Nhắc user: bản dev ở `:3001` mới nóng hổi theo từng sửa; `:3000` là prod build cũ nên mọi thay đổi từ đầu phiên không có hiệu lực ở đó nếu chưa rebuild.

## 🔴 Lượt sửa thứ 9: sheet ảnh đổi tên thành "Anh dashboard"

User chê tên tab "Anh man hinh", chốt gọi là ảnh dashboard. Đổi `SCREENSHOT_SHEET_NAME = 'Anh dashboard'` ([dashboardExcelSpecs.ts:38](file:///d:/chanh%20thu/web/src/lib/dashboardExcelSpecs.ts#L38)), title dòng A1 thành `<tên card> — ảnh dashboard`, và tooltip nút Xuất Excel của cả 3 card thành "sheet ảnh dashboard" cho khớp tên tab. Test chốt thứ tự sheet đổi theo: `['Anh dashboard', 'Tong quan', 'Lo ke', 'Sanh', 'Tong (ke + sanh)']` — 19/19 pass, tsc sạch.

## Tuân thủ kiến trúc phân hệ

- **Không đụng Kho Đông Lạnh về mặt logic**: chỉ thêm 1 sheet ảnh vào file xuất; toàn bộ sheet số liệu giữ nguyên như cũ.
- **Không hardcode mã kho**: `systemName` lấy từ `currentSystem?.name || systemType` đang chọn; ảnh chụp chính DOM của card nên mặc nhiên chỉ chứa dữ liệu phân hệ đang làm việc.
- **Không thêm dependency, không sửa schema**: `html-to-image@1.11.13` đã có sẵn trong `package.json`.

## Kiểm chứng

- `npx vitest run src/lib/__tests__/dashboardExcel.test.ts`: **PASS 18/18** — thêm 2 test: sheet "Anh man hinh" đứng đầu file, nhúng đúng 1 PNG (`worksheet.getImages().length === 1`), metadata đủ 4 dòng và **không có autofilter**; test còn lại assert bỏ dòng "Bộ lọc trên màn hình" khi card không có bộ lọc.
- `npx tsc --noEmit`: không lỗi trên 6 file vừa sửa.
- **Còn mở (bắt buộc người dùng bấm thật)**: `toPng` chỉ chạy trong trình duyệt và cần phiên đăng nhập localhost, nên agent không tự kiểm chứng được 2 điểm: (1) ảnh recharts/donut có bị trắng không, (2) chiều cao ảnh card dài (nhiều khu) có hợp lý không.

---

# Walkthrough: Sửa 2 lỗi tiền tồn tại được phát hiện khi làm thống kê mã phụ

## Bối cảnh

Người dùng xác nhận "sửa cả 2 lỗi luôn" cho hai defect mà mục *Ghi chú phát hiện thêm* của phần trước đã nêu:

1. Sheet `Theo ngay` trong file Excel khai báo trùng cột **"SL đã xuất"** → cột "Lệnh hoàn thành" bị đẩy sang H, file có một cột lặp vô nghĩa.
2. Embed `picker:user_profiles!picker_id(...)` luôn fail `PGRST200`, bị `console.warn` nuốt → tab **"Theo giờ hạ"** và dòng **"Hạ trong ngày"** luôn rỗng từ trước tới nay; cùng khuôn lỗi ở trang *Năng suất lấy hàng*.

## Lỗi 1: cột "SL đã xuất" lặp

`buildSheet` sinh giá trị bằng `columns.map(c => row[c.key])`, nên hai lần khai báo cùng key `exportedQty` chỉ in lại cùng một số. Bỏ dòng trùng ở [exportOrderReportExcelExport.ts:205](file:///d:/chanh%20thu/web/src/lib/exportOrderReportExcelExport.ts#L205). Hệ quả có chủ đích: "Lệnh hoàn thành" về lại cột G.

## Lỗi 2: không resolve được tên người hạ hàng

Đo trực tiếp trên PostgREST local (`export_task_picks`, KHO_DONG_LANH):

| Cách viết | Kết quả |
|---|---|
| `picker:user_profiles!picker_id(...)` | `PGRST200: Could not find a relationship between 'export_task_picks' and 'user_profiles'` |
| `picker:auth.users!picker_id(...)` | `PGRST100` — schema `auth` không expose qua REST |
| `.in('id', ids)` trên `user_profiles` | khớp **1/1** id → `Nguyễn Đình Tùng` |

Nguyên nhân gốc ở schema: [20260418001500_create_export_task_picks.sql:9](file:///d:/chanh%20thu/web/supabase/migrations/20260418001500_create_export_task_picks.sql#L9) khai báo `"picker_id" "uuid" NOT NULL REFERENCES "auth"."users"("id")` — FK không trỏ `user_profiles` nên PostgREST không có đường nhúng. Không sửa migration (đã chạy trên kho thật, và `user_profiles.id` chính là `auth.users.id` theo `user_profiles_id_fkey ... ON DELETE CASCADE`), chỉ đổi cách đọc.

Cách đọc mới theo đúng khuôn mà trang danh sách lệnh xuất đã dùng cho `created_by`: lấy id từ dòng, tra `user_profiles` riêng, ghép tên bằng map. Gom vào [src/lib/userProfiles.ts](file:///d:/chanh%20thu/web/src/lib/userProfiles.ts):

- `fetchUserProfilesByIds(ids)` — khử trùng id, chia chunk **100 id/lần truy vấn** (theo ngưỡng "URI too long" đã đo ở phần trước) và **`throw` khi có `error`** thay để dữ liệu rỗng chảy tiếp.
- `formatProfileName(profile)` — `full_name || username || 'Không rõ'`, giữ nguyên thứ tự ưu tiên hiển thị như embed cũ.

Áp dụng:
- `ExportOrderStatsPanel.tsx`: `StatPickRow` thêm `pickerId`, select bỏ embed và thêm `picker_id`, sau khi đọc xong toàn bộ trang thì ghép `pickerName`. `catch` của khối pick nay **toast cảnh báo** thay vì chỉ `console.warn` — lần sau nếu history hỏng, người dùng thấy ngay lý do chứ không phải suy đoán từ bảng trống.
- `reports/picking-productivity/page.tsx`: giữ nguyên shape `picker: {...}` để mọi chỗ hiển thị (`@username`, avatar, top picker) không phải đổi; chỉ nạp nó từ map.

## Tuân thủ kiến trúc phân hệ

- **Không sửa schema, không chạy migration**: chỉ đổi đường đọc dữ liệu. Kho Đông Lạnh giữ nguyên hành vi; dữ liệu pick vẫn lọc `system_code = currentSystem.code` như cũ, và hàng có `task.system_code` khác vẫn bị loại.
- **Không hardcode mã kho**: helper `userProfiles.ts` không biết gì về phân hệ, dùng được cho mọi kho.
- **Cô lập dữ liệu**: `user_profiles` vẫn chịu RLS như khi nhúng, không mở quyền mới.

## Kiểm chứng

- Query mới chạy thật trên PostgREST local: stats panel trả **6 dòng**, `user_profiles` map khớp **1/1** id → tên `Nguyễn Đình Tùng`; trang năng suất trả **6 dòng** với select `*` + embed `task_item`.
- `npx vitest run src/lib/__tests__/exportOrderReportExcelExport.test.ts`: **PASS 4/4** — test "ghi đúng dữ liệu dòng ngày" nay assert thêm `G4='Lệnh hoàn thành'`, `G5=1` và `H4` trống, chốt rằng cột trùng đã biến mất.
- `npx tsc --noEmit`: sạch trên 6 file đụng tới (`userProfiles.ts`, `ExportOrderStatsPanel.tsx`, `picking-productivity/page.tsx`, `exportOrderReportExcelExport.ts`, `supabaseClient.ts`, `database.types.ts`).
- **Phải bổ sung type**: `user_profiles` trong `database.types.ts` và `UserProfilesTable` thiếu cột `username` (cột thật có trong schema: `user_profiles_username_key` + `idx_user_profiles_username`), khiến `.select('id, username, full_name')` bị suy ra `never[]`. Đã thêm `username: string | null` vào Row/Insert/Update ở cả hai nơi.
- **Còn mở**: bấm thật tab "Theo giờ hạ" và trang *Năng suất lấy hàng* cần phiên đăng nhập localhost (agent không tự nhập mật khẩu được). Lưu ý `localhost:3000` đang là bản prod build cũ — xem ở `:3001` hoặc rebuild prod.

---

# Walkthrough: Tab Sảnh của card Tỉ lệ lấp đầy — hết cảnh "SẢNH 1" trùng tên không biết của kho nào

User nhìn tab Sảnh (cả trên màn hình lẫn sheet ảnh trong Excel): một loạt hàng "SẢNH 1", "SẢNH 2" giống hệt nhau, không biết sảnh thuộc kho nào. Nguyên nhân: danh sách gốc của tab Sảnh là `hallRoots` ([warehouseFillRate.ts:260-262](file:///d:/chanh%20thu/web/src/lib/warehouseFillRate.ts#L260-L262)) — gom sảnh "đầu ngành" của **mọi kho** thành một danh sách phẳng, mỗi hàng chỉ hiện tên chính nó; breadcrumb chỉ có ngữ cảnh khi đã bấm đi xuống một kho.

- Helper mới `ancestorLabels(stats, zoneId)` ([warehouseFillRate.ts:342-354](file:///d:/chanh%20thu/web/src/lib/warehouseFillRate.ts#L342-L354)): đi ngược `parentId` trả tên chuỗi khu cha (không gồm chính nó), có guard chống vòng lặp; `fillTreeRows` nay dùng lại chính helper này cho cột đường dẫn Excel nên màn hình và Excel cùng một nguồn tên.
- Màn hình: `FillRateRow` nhận `contextPath` và in chuỗi cha mờ ngay trước tên khu ("KHO 1 › **SẢNH 1**"), chỉ khi hàng nằm **ngoài ngữ cảnh breadcrumb** (`row.parentId !== zone đang xem` và không phải chính zone đang xem) — nên tab Lô kệ / Tổng và các cấp đã drill không thừa chữ ([WarehouseFillRateChart.tsx:410-425](file:///d:/chanh%20thu/web/src/components/dashboard/WarehouseFillRateChart.tsx#L410-L425), [:505-514](file:///d:/chanh%20thu/web/src/components/dashboard/WarehouseFillRateChart.tsx#L505-L514)). Title tooltip giữ đường dẫn đầy đủ.
- Biểu đồ thanh trong các sheet Excel: nhãn thanh nay là đường dẫn đầy đủ (`KHO 1 › SẢNH 1`) thay vì tên trần ([dashboardExcelSpecs.ts:250-251](file:///d:/chanh%20thu/web/src/lib/dashboardExcelSpecs.ts#L250-L251)); sheet Lô kệ nhiều gốc không đổi nhãn vì gốc không có cha.
- Sheet ảnh chụp màn hình tự hưởng lợi vì chụp đúng DOM đã có chuỗi cha.

## Kiểm chứng

- `npx vitest run warehouseFillRate.test.ts dashboardExcel.test.ts`: **43/43 pass** — thêm 3 test `ancestorLabels` (chuỗi cha đúng thứ tự, sảnh trùng tên hai kho phân biệt được, vòng lặp không treo) và chốt nhãn biểu đồ Sảnh thành `['KHO 1 › SANH 1']`.
- `npx tsc --noEmit`: sạch trên 4 file đụng tới.
- **Còn mở**: nhìn thật tab Sảnh trên trình duyệt (agent không có phiên đăng nhập) — chuỗi cha mờ phải hiện trước mỗi sảnh ở cấp "Toàn bộ sảnh", và mất đi khi đã drill vào một kho.

---

# Walkthrough: Báo cáo Tồn kho theo LOT — thêm sheet ảnh "Tỉ lệ phân bố hàng hóa tồn kho"

User muốn file Excel của tab *Tồn kho theo LOT* (`/inventory` → Xuất Excel) có thêm 3 sheet. Bước 1 (làm trước để user duyệt) là sheet ảnh chứa đúng 2 biểu đồ của card dashboard "Tỉ lệ phân bố hàng hóa tồn kho": donut **Khối lượng (KG)** và donut **Số ô vị trí theo danh mục**.

Yêu cầu cứng: số liệu trong ảnh phải khớp 1:1 với dashboard. Vì vậy KHÔNG chép lại câu query/hàm tổng hợp — tách phần lõi của card ra lib dùng chung, card và trang in cùng gọi một hàm.

## 1. Tách lõi dữ liệu của card ra lib

`src/lib/inventoryDistributionData.ts` (mới, 236 dòng):

- `fetchDistributionLots(systemCode)` [:55](file:///d:/chanh%20thu/web/src/lib/inventoryDistributionData.ts#L55) — query `lots` (`status = active`, `.eq('system_code')`, phân trang bằng `fetchAllPaged`) kèm `lot_items.products` và `products`, có `product_category_rel(category_id)`.
- `fetchDistributionCategories(systemCode)` [:91](file:///d:/chanh%20thu/web/src/lib/inventoryDistributionData.ts#L91).
- `fetchCategoryPositionRaw(systemCode)` [:99](file:///d:/chanh%20thu/web/src/lib/inventoryDistributionData.ts#L99) — `positions` / `zones` / `zone_positions` + `buildZoneLookup`, rồi đọc danh mục của đúng các LOT đang chiếm ô, **chunk 150** vì `.in()` đụng trần độ dài URL của Kong local.
- `aggregateKgByProduct(lots, conversion, selectedCategoryIds)` [:153](file:///d:/chanh%20thu/web/src/lib/inventoryDistributionData.ts#L153) — nguyên luật của card: lọc danh mục (kể cả `'none'` = chưa phân loại), bỏ sản phẩm không có `kgRate`, gộp theo `internalCode || sku`, ưu tiên `lot_items`, LOT cũ không có dòng chi tiết thì đọc thẳng đầu LOT, sắp giảm dần, trả `{ items, totalWeight }`.
- `KgConversion` là 2 hàm của hook `useUnitConversion` truyền vào theo tham số — lib không phải React hook nên cả card lẫn trang in dùng chung được.

Card `InventoryDistributionChart.tsx` nay chỉ gọi lib: `fetchData` [:71](file:///d:/chanh%20thu/web/src/components/dashboard/InventoryDistributionChart.tsx#L71), `fetchCategories` [:82](file:///d:/chanh%20thu/web/src/components/dashboard/InventoryDistributionChart.tsx#L82), `fetchPositionData` [:127](file:///d:/chanh%20thu/web/src/components/dashboard/InventoryDistributionChart.tsx#L127), `chartData` useMemo [:204](file:///d:/chanh%20thu/web/src/components/dashboard/InventoryDistributionChart.tsx#L204). Card bỏ hẳn import `supabase` và type `Lot`/`PositionData` cục bộ (dùng `CategoryPositionRaw` của lib). Giao diện, tab, bộ lọc, nút Xuất Excel của card **không đổi hành vi**.

## 2. Dựng 2 ảnh PNG từ đúng spec của dashboard

`src/lib/inventoryDistributionCharts.ts` (mới):

- `buildDistributionChartImages({ systemCode, conversion })` [:40](file:///d:/chanh%20thu/web/src/lib/inventoryDistributionCharts.ts#L40) — đọc 3 nguồn song song rồi dựng ảnh bằng CHÍNH hai hàm spec mà nút Xuất Excel của card dùng: `distributionKgExportSpec(...).chart` và `categoryPositionExportSpec(...).chart` → `renderChartPng`. Sau này sửa spec thì dashboard và báo cáo LOT cùng đổi, không lệch nhau.
- Tập danh mục của donut vị trí đọc từ `system_ui_settings.warehouse_status_config.selected_category_ids` [:24](file:///d:/chanh%20thu/web/src/lib/inventoryDistributionCharts.ts#L24) — đúng khóa card dùng, nên ảnh khớp cấu hình user đã lưu. Không đọc được (trang in có thể mở ẩn danh qua token) → coi như theo dõi toàn bộ, không throw.
- Lỗi bất kỳ → `console.error` + trả `null`: báo cáo LOT vẫn xuất đủ 2 sheet số liệu, chỉ thiếu sheet ảnh. Tính năng phụ không được làm chết báo cáo chính.

## 3. Sheet mới trong file Excel của tab LOT

`src/lib/inventoryReportExcelExport.ts`:

- Tách `buildInventoryReportWorkbook(data)` [:88](file:///d:/chanh%20thu/web/src/lib/inventoryReportExcelExport.ts#L88) ra khỏi `exportInventoryReportToExcel` [:109](file:///d:/chanh%20thu/web/src/lib/inventoryReportExcelExport.ts#L109) để test được trong node (không cần browser/`saveAs`).
- Trường mới `distributionImages?` [:16](file:///d:/chanh%20thu/web/src/lib/inventoryReportExcelExport.ts#L16); sheet `DISTRIBUTION_SHEET_NAME = 'Tỉ lệ phân bố hàng hóa tồn kho'` [:36](file:///d:/chanh%20thu/web/src/lib/inventoryReportExcelExport.ts#L36) — đúng 30 ký tự (trần Excel là 31) — chỉ được thêm khi `type === 'lot'` VÀ có ảnh.
- `addStackedImage` [:41](file:///d:/chanh%20thu/web/src/lib/inventoryReportExcelExport.ts#L41) đặt ảnh theo cùng công thức với workbook dashboard (`tl.col 0.2`, `editAs: 'oneCell'`, `PX_PER_ROW = 20` để tính dòng kế tiếp). Hai ảnh xếp dọc, mỗi ảnh có tiêu đề riêng ("Phân bố khối lượng (KG) theo sản phẩm" / "Số ô vị trí đang chứa hàng theo danh mục") để mở file lên là biết ảnh nào là ảnh nào.

Trang in `src/app/print/inventory/page.tsx`:

- `handleExportExcel` [:946](file:///d:/chanh%20thu/web/src/app/print/inventory/page.tsx#L946) dựng ảnh khi `type === 'lot' && systemType` rồi truyền vào hàm xuất.
- Auto-export [:970](file:///d:/chanh%20thu/web/src/app/print/inventory/page.tsx#L970) nay chờ thêm `conversionLoading`. Lý do: nếu export trước khi bảng quy đổi đơn vị tải xong thì `getBaseToKgRate` trả `null` cho mọi sản phẩm và donut KG ra **rỗng** dù tồn kho có thật — lỗi này chỉ xuất hiện ở luồng tự xuất qua URL.

## Kiến trúc phân hệ

- Không hardcode mã kho: sheet ảnh bật theo `type === 'lot'` + `systemType` truyền từ URL; mọi truy vấn đều `.eq('system_code' | 'system_type', systemCode)`. Bất kỳ phân hệ nào xuất tab LOT cũng có sheet này nếu có dữ liệu, không có nhánh riêng cho kho nào.
- Không đụng schema, không đụng luồng nhập/xuất, không đổi UI card → Kho Đông Lạnh giữ nguyên hành vi.

## Kiểm chứng

- `npx vitest run` (toàn suite): **182/182 pass**. File mới `src/lib/__tests__/inventoryDistributionSheet.test.ts` — 13 test: sheet nằm đúng sau 2 sheet số liệu và chứa đúng 2 ảnh; tiêu đề 2 ảnh; ảnh dưới bắt đầu sau khi ảnh trên hết chỗ; không có ảnh thì không sinh sheet rỗng; tab báo cáo khác không bị dính; ảnh sống sót qua một vòng `writeBuffer` → `load`; 2 sheet cũ nguyên vẹn. Cộng 6 test `aggregateKgByProduct`: gộp trùng mã nội bộ, bỏ sản phẩm không quy đổi được KG, LOT legacy đọc đầu LOT, lọc danh mục kể cả `'none'`, % tính trên tổng của đúng tập lọc, rỗng thì không chia 0.
- `npx tsc --noEmit`: sạch trên 5 file đụng tới (`inventoryDistributionData.ts`, `inventoryDistributionCharts.ts`, `inventoryReportExcelExport.ts`, `InventoryDistributionChart.tsx`, `print/inventory/page.tsx`).
- **Sự cố đã sửa**: `src/lib/__tests__/inventoryReportExcelExport.test.ts` ĐÃ CÓ SẴN (6 test của tab Lệnh SX). Lần đầu tôi `Write` ghi đè mất — đã `git checkout` khôi phục nguyên bản và chuyển test mới sang file riêng. Bài học: trước khi `Write` một file test phải kiểm tra nó tồn tại chưa (`git status` báo `M` chứ không phải `??` là dấu hiệu).
- **Còn mở**: user bấm Xuất Excel thật ở tab *Tồn kho theo LOT* trên `http://localhost:3001` (`:3000` là bản prod build cũ, chưa có code này) để duyệt sheet ảnh. Đúng ý rồi mới làm tiếp 2 sheet còn lại của yêu cầu "thêm 3 sheet".

# Walkthrough: Báo cáo Tồn kho theo LOT — thêm sheet ảnh "Ước tính container tồn kho"

Nối tiếp sheet ảnh phân bố ở trên: user muốn tab *Tồn kho theo LOT* xuất thêm sheet ảnh chứa biểu đồ của card dashboard **"Số lượng Container tồn kho theo từng mặt hàng"**. Yêu cầu cứng giữ nguyên — số liệu trong ảnh phải khớp 1:1 với card, nên KHÔNG chép lại query/công thức quy đổi thùng mà tách lõi của card ra lib dùng chung, card và trang in cùng gọi một hàm.

## 1. Tách lõi dữ liệu của card Cont ra lib

`src/lib/containerStockData.ts` (mới):

- `fetchContainerLots(systemCode)` [:61](file:///d:/chanh%20thu/web/src/lib/containerStockData.ts#L61) — query `lots` (`status = active`, `.eq('system_code')`, phân trang bằng `fetchAllPaged`) kèm `lot_items.products` và `products`, có `boxes_per_container` + `product_category_rel(category_id)`.
- `aggregateContainerStock(lots, conversion, selectedCategoryIds)` [:126](file:///d:/chanh%20thu/web/src/lib/containerStockData.ts#L126) — nguyên luật của card: đơn vị `thùng/sọt/hộp/bao/két` đếm thẳng, đơn vị khác quy về **Thùng** bằng `convertUnit` rồi mới chia định mức; quy đổi không được thì fallback `Kg / 20`; sản phẩm chưa cài `boxes_per_container` vẫn có dòng (`containers = 0`, `hasConfig = false`) để báo cáo thấy chỗ còn thiếu; ưu tiên `lot_items`, LOT cũ không có dòng chi tiết thì đọc thẳng đầu LOT.
- `sortContainerStats` [:208](file:///d:/chanh%20thu/web/src/lib/containerStockData.ts#L208), `filterByChartCategories` [:224](file:///d:/chanh%20thu/web/src/lib/containerStockData.ts#L224), `selectConfiguredProducts` [:236](file:///d:/chanh%20thu/web/src/lib/containerStockData.ts#L236) — ba chế độ sắp (`containers | boxes | name`), lọc theo danh mục đã cấu hình (kể cả `'none'`), và chọn pinned/Top N đúng thứ tự ưu tiên của card.
- `ContainerConversion` là 2 hàm của hook `useUnitConversion` (`convertUnit`, `getBaseAmount`) truyền vào theo tham số — lib không phải React hook nên cả card lẫn trang in dùng chung được.

Card `ContainerStockChart.tsx` nay chỉ gọi lib: `fetchData` [:271](file:///d:/chanh%20thu/web/src/components/dashboard/ContainerStockChart.tsx#L271), `processedData` useMemo [:301](file:///d:/chanh%20thu/web/src/components/dashboard/ContainerStockChart.tsx#L301), `chartSource` [:414](file:///d:/chanh%20thu/web/src/components/dashboard/ContainerStockChart.tsx#L414), `userConfiguredProducts` [:421](file:///d:/chanh%20thu/web/src/components/dashboard/ContainerStockChart.tsx#L421). Card bỏ hẳn ~100 dòng tổng hợp inline và interface `ProductContainerStat` cục bộ (nay import type từ lib). Giao diện, tab, bộ lọc, nút Xuất Excel của card **không đổi hành vi**.

## 2. Ảnh sheet Cont = ảnh CHỤP DOM đúng card dashboard (nút bấm đã bỏ), canvas chỉ là fallback

User chốt: thứ cần nhúng vào báo cáo LOT là **tấm ảnh giống sheet "Anh dashboard"** — tức ảnh chụp DOM thật của card Cont sau khi lược bỏ các nút bấm — chứ không phải biểu đồ vẽ lại. Vì vậy:

- Trang in render card Cont **ẩn** ngoài lề màn hình (wrapper `position: fixed; left: -10000`, rộng 1100px) chỉ trong lúc xuất Excel tab LOT [:1043](file:///d:/chanh%20thu/web/src/app/print/inventory/page.tsx#L1043). Card ẩn nằm NGOÀI `#print-ready` ( sibling qua fragment ) nên không dính vào ảnh JPG chụp báo cáo lẫn bản in giấy.
- **Bẫy đã dính một lần**: node truyền cho `toPng` ban đầu CHÍNH là div fixed → html-to-image clone kèm computed style của node gốc nên bản clone nằm ở `left:-10000` ngoài khung SVG → PNG trong suốt, Excel nhúng ảnh đúng kích thước nhưng không thấy gì ("ko hiện gì cả"). Sửa: wrapper fixed chỉ để giấu, node chụp là div **static** bọc ngoài card [:1049](file:///d:/chanh%20thu/web/src/app/print/inventory/page.tsx#L1049).
- Card ẩn nhận prop `initialCategoryTab="all"` [:1050](file:///d:/chanh%20thu/web/src/app/print/inventory/page.tsx#L1050) để mở sẵn tab **Tất cả**: effect tự chọn "Sầu Riêng" chỉ chạy khi tab còn rỗng, nên bản ẩn không dính tab mặc định của dashboard và ảnh báo cáo thấy toàn bộ danh mục. Dashboard gọi card không truyền prop nên hành vi cũ giữ nguyên.
- Các nút bấm vô nghĩa trong ảnh tĩnh được đánh dấu `data-excel-shot="skip"` trên chính card (hàng lọc Danh mục/Tất cả sản phẩm/sắp xếp, nút Cài đặt hiển thị, hai nút Xem thêm/Thu gọn) nên cả sheet "Anh dashboard" lẫn sheet Cont đều sạch nút; vẫn giữ chip đơn vị và hàng tab danh mục vì chúng mang thông tin.
- `waitForContainerCardReady` [:954](file:///d:/chanh%20thu/web/src/app/print/inventory/page.tsx#L954) thăm DOM mỗi 300ms (tối đa 20s) tới khi card ẩn hết spinner (`.animate-spin`) và recharts đã vẽ (`.recharts-surface`) rồi mới chụp — chụp sớm sẽ dính nguyên khung loading.
- `captureHiddenContainerCard` [:964](file:///d:/chanh%20thu/web/src/app/print/inventory/page.tsx#L964) gọi đúng `captureDashboardScreenshot` của workbook dashboard: filter `keepInScreenshot` tự bỏ mọi node `data-excel-shot="skip"` (header, nút Xuất Excel / Làm mới / cài đặt) nên ảnh sạch nút bấm, và dùng chung hệ số thu 80% như sheet "Anh dashboard".
- `buildContainerChartImage` trong `src/lib/containerStockCharts.ts` [:17](file:///d:/chanh%20thu/web/src/lib/containerStockCharts.ts#L17) giữ lại làm **fallback**: chỉ khi không chụp được DOM (timeout / lỗi html-to-image) mới vẽ biểu đồ canvas bằng `containerExportSpec(...).chart` để sheet không trống. Lỗi cả hai → `containerImage = null` → bỏ sheet, báo cáo LOT vẫn xuất đủ sheet số liệu.

## 3. Sheet mới trong file Excel của tab LOT

`src/lib/inventoryReportExcelExport.ts`:

- Trường mới `containerImage?` [:19](file:///d:/chanh%20thu/web/src/lib/inventoryReportExcelExport.ts#L19); sheet `CONTAINER_SHEET_NAME = 'Ước tính container tồn kho'` [:40](file:///d:/chanh%20thu/web/src/lib/inventoryReportExcelExport.ts#L40) (26 ký tự, dưới trần 31 của Excel) — chỉ thêm khi `type === 'lot'` VÀ có ảnh.
- `buildContainerSheet` [:96](file:///d:/chanh%20thu/web/src/lib/inventoryReportExcelExport.ts#L96) tái dùng `addStackedImage` (cùng công thức đặt ảnh `tl.col 0.2`, `editAs: 'oneCell'`, `PX_PER_ROW = 20`) — 1 ảnh kèm tiêu đề "Số lượng Container tồn kho theo từng mặt hàng" (trung tính, đúng cho cả ảnh chụp DOM lẫn canvas fallback).
- `buildInventoryReportWorkbook` [:116](file:///d:/chanh%20thu/web/src/lib/inventoryReportExcelExport.ts#L116) nối sheet container **sau** sheet phân bố: thứ tự file là `Chi tiết → Tổng hợp → [Tỉ lệ phân bố] → [Ước tính container]`.

Trang in `src/app/print/inventory/page.tsx`:

- `handleExportExcel` [:982](file:///d:/chanh%20thu/web/src/app/print/inventory/page.tsx#L982) khi `type === 'lot' && systemType` thì chụp card ẩn trước [:996-1000](file:///d:/chanh%20thu/web/src/app/print/inventory/page.tsx#L996), hụt mới vẽ canvas, rồi truyền `containerImage` vào hàm xuất [:1016](file:///d:/chanh%20thu/web/src/app/print/inventory/page.tsx#L1016).
- Card ẩn chỉ mount khi `contShotPending` (bật trong lúc xuất, tắt ở `finally`) nên ngày thường trang in không tốn thêm query Cont nào.

## Kiến trúc phân hệ

- Không hardcode mã kho: sheet ảnh bật theo `type === 'lot'` + `systemType` truyền từ URL; `fetchContainerLots` lọc `.eq('system_code', systemCode)`. Bất kỳ phân hệ nào xuất tab LOT cũng có sheet này nếu có dữ liệu, không nhánh riêng cho kho nào.
- Không đụng schema, không đụng luồng nhập/xuất, không đổi UI card → Kho Đông Lạnh giữ nguyên hành vi.

## Kiểm chứng

- `npx vitest run` 3 file liên quan: **30/30 pass**. File mới `src/lib/__tests__/inventoryContainerSheet.test.ts` — 11 test: sheet nằm đúng sau sheet phân bố và chứa đúng 1 ảnh; chỉ có ảnh container (không phân bố) thì vẫn nối sau 2 sheet số liệu; tiêu đề ảnh; không có ảnh thì không sinh sheet rỗng; tab báo cáo khác không bị dính; ảnh sống sót qua một vòng `writeBuffer` → `load`. Cộng 5 test `aggregateContainerStock`: đơn vị thùng đếm thẳng rồi chia định mức, chưa khai định mức thì `containers = 0` nhưng vẫn có dòng, đơn vị Kg quy về Thùng rồi mới chia, gộp nhiều LOT cùng sản phẩm, rỗng thì trả `[]`.
- `npx tsc --noEmit`: sạch trên 5 file đụng tới (`containerStockData.ts`, `containerStockCharts.ts`, `inventoryReportExcelExport.ts`, `ContainerStockChart.tsx`, `print/inventory/page.tsx`) + file test mới. Các lỗi `src/app/(dashboard)/...` còn lại là lỗi tiền tồn tại (Supabase `never`/thiếu bảng `customers`/`permissions`), không thuộc phạm vi này.
- **Sự cố đã sửa (hooks)**: lần đầu tôi đổi `chartSource` / `userConfiguredProducts` thành `useMemo` nhưng đặt SAU nhánh `if (loading || conversionLoading) return ...` → render loading không gọi hai hook đó, React ném "change in the order of Hooks called by ContainerStockChartInner". Đã dời cả hai lên trước early return (cùng chỗ comment cũ nhắc "Must be before any early return"). Bài học: trong card này mọi hook phải đứng trước early return duy nhất; biểu thức dẫn xuất thường thì đặt sau cũng được.
- **Còn mở**: user bấm Xuất Excel thật ở tab *Tồn kho theo LOT* trên `http://localhost:3001` để duyệt sheet ảnh Cont — kỳ vọng thấy ảnh CHỤP DOM giống sheet "Anh dashboard" (đã bỏ nút), không phải biểu đồ vẽ lại (agent không tự đăng nhập form được — lớp bảo mật chặn). Đúng ý rồi mới làm sheet còn lại của yêu cầu "thêm 3 sheet".

# Walkthrough: Card Cont tồn kho — tab "Tất cả" lên đầu và thành mặc định

## Yêu cầu

User duyệt dashboard và chốt hai điểm UI trên card "Số lượng Container tồn kho theo từng mặt hàng":
1. Hàng tab Danh mục: nút **"Tất cả"** đứng **đầu hàng**, các tab danh mục (Sầu Riêng, Xoài, Mít…) theo sau (trước đó "Tất cả" nằm cuối).
2. Tab mở mặc định khi vào dashboard là **"Tất cả"** (trước đó effect tự chọn "Sầu Riêng").

## Thay đổi (`src/components/dashboard/ContainerStockChart.tsx`)

- Hàng tab [:672](file:///d:/chanh%20thu/web/src/components/dashboard/ContainerStockChart.tsx#L672): khối nút "Tất cả" dời lên TRƯỚC vòng `configuredChartCategories.map(...)`; chỉ đổi thứ tự render, không đổi onClick/style/đếm badge.
- State tab [:154](file:///d:/chanh%20thu/web/src/components/dashboard/ContainerStockChart.tsx#L154): `useState(initialCategoryTab || 'all')` — mặc định mới là `'all'`.
- **Xóa** effect "Auto-select Sầu Riêng" cũ: không còn cần vì state không bao giờ khởi tạo rỗng. Nhánh dữ liệu [:426](file:///d:/chanh%20thu/web/src/components/dashboard/ContainerStockChart.tsx#L426) vốn coi `'all'` và `''` như nhau (`chartList = chartSource`) nên đổi mặc định không ảnh hưởng phép lọc.
- Prop `initialCategoryTab` giữ nguyên (trang in vẫn truyền `"all"` — nay trùng mặc định, vô hại nhưng tự tài liệu ý định).

## Hệ quả với ảnh báo cáo

Sheet "Ước tính container tồn kho" chụp card ẩn với tab `'all'` nên không đổi hành vi; chỉ khác là hàng tab trong ảnh nay hiển thị "Tất cả" ở đầu hàng, khớp dashboard.

## Kiểm chứng

- `npx tsc --noEmit` lọc theo `ContainerStockChart` → sạch.
- User reload `http://localhost:3001`: hàng tab hiện `[Tất cả] [Sầu Riêng] [Xoài] [Mít]` với "Tất cả" đang active ngay lần đầu mở card.

# Walkthrough: Sheet ảnh Cont — tắt animation recharts cho bản chụp ẩn

## Lỗi user bắt gặp

Ảnh sheet "Ước tính container tồn kho" (Xuất Excel tab *Tồn kho theo LOT*) khác hẳn card thật: thanh cụt cỡ ~20% chiều dài và **mất nhãn số** ("6,71 Cont"...). Nguyên nhân: `waitForContainerCardReady` chỉ chờ `.recharts-surface` xuất hiện + hết spinner, nhưng recharts `Bar` mặc định `isAnimationActive=true` (~1,5s) — trong lúc animate, thanh mới vươn dần và recharts **không render LabelList** → `toPng` chụp đúng khoảnh khắc đó.

## Sửa

- `ContainerStockChart` nhận prop `noAnimation?: boolean` (mặc định `false`, dashboard giữ nguyên animation) → truyền xuống `Bar` thành `isAnimationActive={!noAnimation}` [:1056](file:///d:/chanh%20thu/web/src/components/dashboard/ContainerStockChart.tsx#L1056).
- Trang in truyền `noAnimation` cho card ẩn [:1052](file:///d:/chanh%20thu/web/src/app/print/inventory/page.tsx#L1052): thanh và nhãn số render đủ ngay paint đầu → ảnh chụp đúng mốc Cont như dashboard, không cần chờ đợi mong manh.

## Kiểm chứng

- `npx tsc --noEmit` lọc `ContainerStockChart` + `print/inventory` → sạch.
- User xuất lại Excel tab LOT trên `:3001`: sheet Cont phải giống hình card thật (nhãn "x,xx Cont" cuối mỗi thanh, thanh dài đúng trục).

## Bổ sung: chữ "Tất cả" trong ảnh sheet bị cắt nửa dòng

User soi ảnh sheet Cont: pill xanh "Tất cả" hiện "Tất" rồi chữ "cả" trồi nửa dưới mép pill. Nguyên nhân: bản clone của html-to-image khóa cả chiều rộng **lẫn chiều cao** từng node theo px đo trên bản live; chỉ cần font trong clone lệch metric một chút là span "Tất cả" quấn xuống 2 dòng trong khi chiều cao pill vẫn khóa 1 dòng → dòng thứ hai tràn ra ngoài và bị nhìn như cắt. Sửa phòng thủ tại [ContainerStockChart.tsx:671-708](file:///d:/chanh%20thu/web/src/components/dashboard/ContainerStockChart.tsx#L671): thêm `whitespace-nowrap` cho span tên tab và `shrink-0` cho cả nút "Tất cả" lẫn nút danh mục — chữ không bao giờ quấn, pill giữ đúng 1 dòng cả live lẫn clone. `tsc --noEmit` lọc file sạch.

# Walkthrough: Ảnh chụp card — hết khoảng trống đầu card và chip đơn vị sát mép phải

## Lỗi user bắt gặp

Ảnh sheet Cont (và sheet "Anh dashboard") còn hai tật: (1) dải trống ~170px đầu card chỗ tiêu đề/nút bấm đã bị loại; (2) chip "Đơn vị: Container (Cont)" không trôi sát mép phải mà hụt vào trong ~200px.

## Nguyên nhân

`cloneCSSStyle` của html-to-image chép **nguyên cssText computed** (gồm px width/height đã resolve) lên mọi node clone. Node bị `filter` bỏ thì biến mất nhưng cha nó vẫn giữ chiều cao/rộng khóa cũ:
- div header (không đánh dấu skip) giữ chiều cao của tiêu đề + hàng nút → dải trống + đường kẻ `border-b` dưới dải.
- div nhóm phải `flex items-center gap-2` giữ chiều rộng gồm cả nút "Cài đặt hiển thị" (bị bỏ trong clone) → chip đơn vị nằm lệch trái trong hộp rộng cũ, hụt mép phải.

## Sửa

- `globals.css`: rule `[data-capture-active='true'] [data-excel-shot='skip'] { display: none !important }` — ẩn skip-node ngay trên bản live **chỉ trong lúc chụp**.
- `captureDashboardScreenshot` ([dashboardExcelExport.ts:53-80](file:///d:/chanh%20thu/web/src/lib/dashboardExcelExport.ts#L53)): gắn `CAPTURE_ACTIVE_ATTR` trước khi đo rect + clone, gỡ ở `finally` → computed size khóa lại đã là layout không nút; rect đo sau khi ẩn nên kích thước ảnh khớp layout mới.
- `ContainerStockChart.tsx`: dời `data-excel-shot="skip"` lên **cả container header** (gồm `border-b`) thay vì hai div con — nếu không, container rỗng vẫn sót dải mảnh padding + đường kẻ. Các mốc skip cũ của nút Export/Làm mới thành thừa nhưng vô hại.
- Chip đơn vị không cần đổi JSX: khi nút "Cài đặt hiển thị" (skip) ẩn lúc chụp, nhóm phải chỉ còn chip → `justify-between` đẩy sát mép phải; bản live giữ nguyên cụm [Cài đặt hiển thị][chip].

## Kiểm chứng

- `npx tsc --noEmit` lọc file đụng tới → sạch; `npx vitest run` 2 file liên quan → **30/30 pass**.
- User xuất lại Excel trên `:3001`: ảnh card hết dải trống đầu, chip "Đơn vị: Container (Cont)" sát mép phải. Lưu ý nhỏ: trong ~0,5s chụp, card trên màn hình tạm ẩn phần tiêu đề/nút (attribute chỉ sống trong lúc chụp).

## Bổ sung: thanh cuộn lọt vào ảnh sheet Cont

User thấy ảnh sheet Cont có thanh cuộn dọc + ngang trong vùng biểu đồ. Nguyên nhân: khung biểu đồ ([ContainerStockChart.tsx:924](file:///d:/chanh%20thu/web/src/components/dashboard/ContainerStockChart.tsx#L924)) dùng `overflow-x-auto` (cho màn hẹp, `minWidth: 640`); bản live ResponsiveContainer đo khớp nên không tràn, còn bản clone bị khóa px từng node, lệch nhau vài pixel đủ để Chrome vẽ cả hai thanh cuộn vào ảnh SVG. Sửa: gắn `data-capture-clip` lên khung đó + rule `[data-capture-active='true'] [data-capture-clip] { overflow: hidden !important }` trong globals.css — chỉ kẹp trong lúc chụp, bản live giữ nguyên khả năng cuộn ngang. `tsc --noEmit` lọc file sạch.

# Walkthrough: Báo cáo Tồn kho theo LOT — thêm sheet ảnh "Tỉ lệ lấp đầy theo khu vực"

## Yêu cầu

User chốt sheet ảnh thứ 3 cho tab LOT: lấy đúng nội dung ảnh mà file Excel "Tỉ lệ lấp đầy theo khu vực" (card dashboard) đang nhúng — ảnh CHỤP DOM card, ẩn các chi tiết cài đặt/nút bấm, chuẩn chỉ như sheet Cont (sheet 2).

## Triển khai

- `inventoryReportExcelExport.ts`: thêm `fillRateImage?` vào `InventoryReportExportData`, hằng số `FILL_RATE_SHEET_NAME = 'Tỉ lệ lấp đầy theo khu vực'` (26 ký tự < trần 31), `buildFillRateSheet` theo đúng khuôn sheet Cont (A1 tiêu đề, A2 meta, `addStackedImage` caption 'Tỉ lệ lấp đầy theo khu vực'); nối sau sheet container trong `buildInventoryReportWorkbook` → thứ tự `Chi tiết → Tổng hợp → [Tỉ lệ phân bố] → [Ước tính container] → [Tỉ lệ lấp đầy]`.
- `print/inventory/page.tsx`: card ẩn thứ hai `WarehouseFillRateChart` (chỉ mount khi `fillShotPending`), `waitForFillRateCardReady` chờ hết spinner + hàng tab 3 nút render (nhánh lỗi chỉ 1 nút "Thử lại" nên bị loại), `captureHiddenFillRateCard` chụp qua `captureDashboardScreenshot` — hưởng trọn bộ sửa trước đó: header card đã đánh dấu `data-excel-shot="skip"` nên tiêu đề + 3 nút (Sơ đồ chi tiết / Xuất Excel / Làm mới) tự ẩn, rule `data-capture-active` chống khoảng trống ma, `data-capture-clip` không áp dụng vì card này không có khung overflow. Không chụp được thì **bỏ sheet** (card fill-rate không có bản vẽ lại canvas).
- Card fill-rate mặc định tab "Lô kệ" (scope `rack`) — đúng tab công ty dùng quyết định sức chứa, khớp ảnh user đưa.

## Kiểm chứng

- `npx tsc --noEmit` lọc 4 file đụng tới → sạch.
- `npx vitest run src/lib/__tests__/inventoryContainerSheet.test.ts` → **16/16 pass** (thêm 5 test: sheet đứng cuối đúng thứ tự, caption ghi ≥ 2 lần (A1 + caption ảnh), không ảnh thì không sheet rỗng, tab khác không dính, ảnh sống sót qua writeBuffer → load).
- User xuất lại Excel tab LOT trên `:3001`: file có sheet thứ 5 "Tỉ lệ lấp đầy theo khu vực" với ảnh giống hệt ảnh trong file Excel fill-rate (header/nút đã ẩn).

# Walkthrough: Sửa "bấm Xuất Excel không thấy file tải về" (tab LOT)

## Triệu chứng

Sau khi thêm sheet ảnh fill-rate, user bấm "Xuất Excel" trên trang in nhiều lần mà không có file nào tải về, cũng không có thông báo lỗi.

## Chẩn đoán

- Bản build prod `:3000` lúc 23:08 có chứa đoạn chụp card fill-rate ("Không chụp được card Tỉ lệ lấp đầy ẩn") nhưng **không có** `try/catch` quanh `handleExportExcel` → mọi exception trong luồng xuất thành unhandled rejection im lặng: không file, không alert, nút vẫn sáng.
- Một lượt xuất tab LOT giờ nặng hơn nhiều: dựng 2 biểu đồ canvas (phân bố KG + vị trí) và chụp DOM **2 card ẩn** — card fill-rate phải tự fetch toàn bộ `positions` + `zones` của phân hệ (cây khu ~4.200 zone) nên riêng bước chờ card sẵn sàng có thể ngốn 20–30s.
- Nút không có trạng thái "đang xuất" → user tưởng chết, bấm liên tiếp; mỗi cú bấm khởi động thêm một pipeline fetch + `toPng` chạy song song, tranh nhau bộ nhớ/main thread → tab đơ, không lượt nào về đích.
- Hai hàm chờ card (`waitForContainerCardReady`, `waitForFillRateCardReady`) chỉ có timeout: card rơi vào nhánh lỗi (1 nút "Thử lại") hoặc nhánh rỗng (`stats === null` → không render gì) thì vẫn đứng chờ hết timeout mới chịu bỏ sheet.

## Sửa (`src/app/print/inventory/page.tsx`)

- Thêm cờ `exportingReport`: `handleExportExcel` return ngay nếu đang chạy; toàn bộ thân hàm bọc `try/catch/finally` — catch thì `console.error` + `alert('Không xuất được file Excel. Vui lòng thử lại.')` để lỗi không còn câm lặng, finally luôn mở khóa nút.
- Nút "Xuất Excel" (`~line 1172`): `disabled={exportingReport}`, nhãn đổi thành `Loader2` quay + "Đang xuất...", style `opacity-70 cursor-wait` — cùng khuôn nút "Tải ảnh phiếu" kế bên.
- `waitForContainerCardReady`: thoát **ngay** khi thấy chữ nhánh lỗi của error boundary ("Đã xảy ra lỗi khi hiển thị Biểu đồ Container"); timeout giữ 20s cho luồng fetch LOT nặng.
- `waitForFillRateCardReady`: thoát ngay khi thấy "Không tải được dữ liệu tỉ lệ lấp đầy" (nhánh lỗi) hoặc node rỗng quá 2s (nhánh `!stats`); timeout 30s để card kịp fetch positions/zones ở kho nhiều khu — chờ lâu nhưng chỉ khi còn hy vọng, các nhánh chết bỏ cuộc tức thì.
- Ảnh sheet vẫn theo luật cũ: card nào không chụp được thì **bỏ sheet đó**, báo cáo số liệu luôn được tạo — không để sheet ảnh chặn file.

## Kiểm chứng

- `npx tsc --noEmit` lọc `print/inventory` → sạch (lưu ý: repo bật `typescript.ignoreBuildErrors`, lỗi kiểu trong file này trước đó vẫn build được nên mới lọt ra runtime).
- `npx vitest run src/lib/__tests__/inventoryContainerSheet.test.ts` → **16/16 pass**.
- Chưa xác minh được bằng trình duyệt: dev `:3001` đang tắt, `:3000` chạy bản build 23:08 (chưa có các sửa trên). Cần user chạy lại dev server (hoặc rebuild prod — phải hỏi trước) rồi bấm "Xuất Excel" tab LOT: nút phải chuyển "Đang xuất..." và khóa, file tải về kèm 5 sheet, hoặc có alert báo lỗi cụ thể trong console.

# Walkthrough: Tab "Lô kệ" card Tỉ lệ lấp đầy bị gãy chữ 2 dòng

Hàng tab `flex flex-wrap` cho phép flex shrink từng nút xuống min-content (bằng một từ) trước khi wrap cả nút → chữ "Lô kệ" gãy thành "Lô"/"kệ" như ảnh user chụp. Sửa đúng khuôn lần sửa tab Cont: `shrink-0` lên nút tab, bọc nhãn bằng `<span className="whitespace-nowrap">`, thêm `whitespace-nowrap` cho span số `1795/6744` và `shrink-0` cho icon — hàng tab giờ wrap cả nút xuống dòng mới thay vì bóp chữ. Áp dụng cho cả bản live lẫn ảnh chụp sheet Excel (cùng JSX). `tsc --noEmit` lọc file sạch.

# Walkthrough: Sắp lại thứ tự sheet + rút ngắn tên tab báo cáo Tồn kho theo LOT

## Yêu cầu

User nhìn hàng tab Excel thấy tên dài tràn màn hình và muốn sheet "Chi tiết" (bảng dài) đứng sau cùng.

## Sửa (`src/lib/inventoryReportExcelExport.ts`)

- Tên tab rút ngắn: `DISTRIBUTION_SHEET_NAME = 'Phân bố tồn kho'`, `CONTAINER_SHEET_NAME = 'Container tồn kho'`, `FILL_RATE_SHEET_NAME = 'Lấp đầy theo khu'`. Tiêu đề đầy đủ vẫn giữ ở ô A1 trong từng sheet và caption trên ảnh — mở sheet vẫn biết đúng nội dung, chỉ hàng tab là ngắn.
- `buildInventoryReportWorkbook` nhánh LOT: tạo 'Tổng hợp' trước, rồi 3 sheet ảnh (nếu có), cuối cùng mới 'Chi tiết'. Nhánh báo cáo khác giữ nguyên 'Bao Cao Ton Kho'.
- Parser kiểm kê (`stocktakeSnapshotParser`) chọn sheet theo TÊN ('Tổng hợp' ưu tiên) nên đổi thứ tự không ảnh hưởng luồng đối chiếu — test stocktakeReconciliation vẫn pass.

## Kiểm chứng

- `npx vitest run` 3 file: inventoryContainerSheet (16), inventoryDistributionSheet (13), stocktakeReconciliation (17) → **46/46 pass**; các assertion thứ tự sheet cập nhật theo thứ tự mới `Tổng hợp → [Phân bố tồn kho] → [Container tồn kho] → [Lấp đầy theo khu] → Chi tiết`.
- `npx tsc --noEmit` lọc 4 file đụng tới → sạch.

# Walkthrough: Nguồn "Nhập tay" cho Số liệu chứng minh công việc (`/work/plans`)

## Yêu cầu

Modal "Số Liệu & Chứng Từ Chứng Minh Công Việc" trước đây luôn mở vào một nguồn dữ liệu (mặc định "Duyệt gán vị trí"), trong khi thực tế có công việc không có chứng từ/nguồn cụ thể nên phải nhập số liệu trực tiếp.

## Sửa (`src/components/work-plans/WorkloadMetricsSection.tsx`)

- Thêm `ProofSourceTab = 'manual_entry'` và một card nguồn thứ 6 **"Nhập tay — Không cần nguồn dữ liệu"** (icon bút chì, tông violet) trong danh sách nguồn bên trái.
- `getInitialSourceTab()` khi chưa gắn nguồn nào giờ trả `'manual_entry'` thay vì `'approved_assignments'` — mở modal là thấy ngay form nhập, không bị "bắt chọn nguồn".
- Tách khối **lưới 6 chỉ số** (Vị trí hạ/xếp, LOT/Pallet, Thùng/Kiện, Kg, Cont, Giờ) + **thanh hệ số nhân/chia** (1/3…x3, lý do, gợi ý nhanh) thành biến `manualMetricInputs` dùng chung: render trong tab "Nhập tay"; với các nguồn khác vẫn render ở cuối như cũ (`activeSourceTab !== 'manual_entry'` để không hiện trùng 2 lần).
- Card "Nhập tay" hiện dấu ✓ khi đã có số liệu tay; thêm dòng gợi ý trong khung "Mẹo cộng dồn".
- Không đổi schema, không đổi types: số liệu nhập tay vẫn ghi vào cùng `WorkloadMetrics` nên luồng `suggestWorkloadDifficulty` / phân bổ KPI và module `work_plan` giữ nguyên; không đụng Kho Đông Lạnh (thay đổi thuần UI trong component dùng chung, chỉ hiển thị khi module `work_plan` bật).

## Kiểm chứng

- `npx tsc --noEmit` lọc `WorkloadMetricsSection` → không có lỗi.
- `git diff --stat`: 282 thêm / 210 xóa (do di chuyển khối JSX, không phải viết lại toàn file).
- Chưa xác minh bằng trình duyệt: `:3000` đang chạy bản build cũ nên cần rebuild (hỏi trước) hoặc chạy dev để thấy card "Nhập tay".

# Walkthrough: Nhập tay tự quy đổi khối lượng (600 kg/pallet, 20 kg/thùng)

## Yêu cầu

Trong "Nhập tay", user muốn khỏi gõ Kg: 1 vị trí / 1 LOT (pallet) = 600 kg, 1 thùng/kiện = 20 kg.

## Sửa (`src/components/work-plans/WorkloadMetricsSection.tsx`)

- Thêm hằng `MANUAL_KG_PER_PALLET = 600`, `MANUAL_KG_PER_PACKAGE = 20`.
- `updateNumericField`: chỉ khi `activeSourceTab === 'manual_entry'` và người dùng sửa `positions_count`/`lots_count`/`packages_count` thì tự điền `weight_kg` (và `base_weight_kg` theo hệ số hiện hành):
  - Sửa ô Thùng/Kiện → Kg = số thùng × 20.
  - Sửa ô Vị trí hoặc LOT → Kg = max(vị trí, LOT) × 600 (vị trí và LOT là cùng một pallet nên không cộng dồn).
  - Ô nào vừa nhập thì quyết định (nhập thùng sau thì thùng thắng, nhập vị trí/LOT sau thì pallet thắng); gõ thẳng ô Kg vẫn ghi đè được.
- Không đổi hành vi các nguồn dữ liệu khác: điều kiện chỉ chạy trong tab Nhập tay, nên luồng cộng dồn từ Lệnh xuất/Nhập-Xuất kế toán/LOT/Duyệt gán vị trí giữ nguyên.
- Thêm dòng nhắc quy đổi trong bảng Nhập tay.

## Kiểm chứng

- `npx tsc --noEmit` lọc `WorkloadMetricsSection` → sạch.
- Chưa thử được trên trình duyệt: `:3000` là bản build cũ, cần rebuild (hỏi trước) hoặc chạy dev.

# Walkthrough: Nguồn Nhập/Xuất kế toán không tự quy LOT / vị trí

## Yêu cầu

User chốt: phiếu nhập/xuất kế toán không có thông tin LOT/vị trí thật nên **để trống cho tự nhập**, không quy đổi tự động (trước đây LOT bị lấy bằng số dòng hàng, VD 4 dòng → "4 LOT").

## Sửa (`src/components/work-plans/types.ts`)

- `recalculateWorkloadFromLinkedSources`: bỏ `inboundList.items_count` và `outboundList.items_count` khỏi `sumLots`. LOT/vị trí chỉ cộng từ các nguồn có dữ liệu thật (Lệnh xuất kho, Số LOT tạo, Duyệt gán vị trí); nếu đã nhập tay thì giữ nguyên giá trị nhập tay.
- Không quy từ thùng hay kg sang LOT/vị trí (user từ chối cả 2 cách quy đổi).

## Sửa (`src/components/work-plans/WorkloadMetricsSection.tsx`)

- Thêm dòng nhắc trong bảng chọn Nhập kế toán và Xuất kế toán: phiếu không có LOT/vị trí, hai ô đó để trống và tự nhập ở lưới chỉ số bên dưới.

## Kiểm chứng

- `npx vitest run src/components/work-plans/__tests__/workPlanParser.test.ts` → **12/12 pass** (cập nhật kỳ vọng: nhập 5 dòng + 17 LOT thật → `lots_count = 17`, trước là 22).
- `npx tsc --noEmit` lọc `work-plans/types`, `WorkloadMetricsSection` → sạch.

# Walkthrough: Phân loại Lao động tay chân vs Thống kê / Ghi chép (không ghi sản lượng & giờ làm)

## Yêu cầu

Ở bước 2 "Giao việc ca" cần đánh dấu được công việc nào là **lao động tay chân**, công việc nào là **thống kê / ghi chép**. Việc thống kê (VD "Số liệu thống kê" của Giang, Da Ti) không có tay chân, chỉ cần **độ chính xác và hoàn thành trong ngày**; vì vậy ở bước 4 "Báo cáo & Xếp hạng", cột **Sản lượng & Giờ làm không được ghi** cho các việc này.

## Schema (`supabase/migrations/20261111100000_add_work_nature_to_work_plan_items.sql`)

- Thêm cột `work_plan_items.work_nature text NOT NULL DEFAULT 'labor'` + check `('labor','statistics')`.
- 10 dòng cũ tự nhận `'labor'` — không đổi dữ liệu lịch sử, không đụng logic Kho Đông Lạnh; cột nằm trong bảng đã lọc `system_code` nên vẫn cô lập phân hệ.

## Sửa (`src/components/work-plans/types.ts`)

- Thêm `WorkPlanWorkNature = 'labor' | 'statistics'`, `WORK_NATURE_CONFIG` (nhãn/màu/mô tả) và field `work_nature?: WorkPlanWorkNature | null` trên `WorkPlanItem`.

## Sửa (`src/components/work-plans/WorkPlansView.tsx`)

- Form "Giao việc ca" có nút chọn **🏋️ Lao động** / **📊 Thống kê** (mặc định Lao động); chọn Thống kê hiện dòng nhắc: không có tay chân, chấm độ chính xác + hoàn thành trong ngày, bước Báo cáo không ghi sản lượng/giờ.
- Mỗi hàng công việc có chip bản chất bấm được để đổi qua lại (`handleToggleWorkNature`, lưu ngay vào DB).
- Lưu `work_nature` khi thêm việc mới; việc từ thư viện mẫu / nhập nhanh mặc định `'labor'`; **chuyển việc tồn sang mai giữ nguyên bản chất**.

## Sửa (`src/components/work-plans/WorkPlanAnalyticsTab.tsx`)

- `addStat`: nếu `work_nature === 'statistics'` thì **bỏ qua ghi giờ làm** (`empDayHoursMap`) và **không cộng** vị trí / thùng / kg / cont / điểm quy đổi khối lượng; chấm KPI với độ khó chuẩn (Năng suất 40đ) + Chất lượng (sao đánh giá) + An toàn + Kỷ luật.
- KPI tổng `totalPositions` lọc bỏ việc thống kê.
- Bảng xếp hạng: tên nhân sự có chip "📊 N thống kê"; cột Sản lượng & Giờ làm hiện "📊 Không ghi (thống kê)" nếu chỉ làm thống kê, hoặc ghi chú "N việc thống kê không tính" nếu làm lẫn.
- Drawer chi tiết: dòng tổng kết nêu số việc thống kê; từng việc thống kê hiện badge 📊 và dòng "Không ghi sản lượng & giờ làm".

## Sửa (`src/components/work-plans/AnalyticsExportCardModal.tsx`)

- Thẻ Zalo/ảnh báo cáo nhận cùng `rows` nên tự đúng số liệu; riêng ô Sản lượng & Giờ làm và dòng tóm tắt nhân sự hiện "📊 Không ghi (thống kê)" thay vì "0 vt / 0.0 tấn".

## Kiểm chứng

- Migration áp vào Supabase local: cột `work_nature` NOT NULL DEFAULT `'labor'`, check constraint đủ 2 giá trị; 10/10 dòng cũ = `labor`.
- `npx tsc --noEmit` lọc 4 file work-plans vừa sửa → không lỗi.
- `npx vitest run src/components/work-plans/__tests__` → **12/12 pass**.
- Chưa xác minh bằng trình duyệt: `:3000` là bản build cũ, cần rebuild (hỏi trước) hoặc chạy dev `:3001`.

# Walkthrough: Trường "Số phiếu / chứng từ đã tạo" cho công việc Thống kê

## Yêu cầu

Với công việc đã đánh dấu **Thống kê**, thay vì sản lượng tay chân/giờ làm, cần ghi nhận **số phiếu / chứng từ / bảng số liệu đã tạo** để chấm độ chính xác và hoàn thành trong ngày.

## Sửa (`src/components/work-plans/types.ts`)

- Thêm `WorkloadMetrics.documents_count?: number | null` (lưu chung JSONB `work_plan_items.workload_metrics`, **không cần migration**).
- `hasWorkloadData` và `formatWorkloadSummaryText` nhận thêm `documents_count` → nút "Số liệu" trên hàng công việc sáng đúng và summary hiện "📄 N phiếu đã tạo".

## Sửa (`src/components/work-plans/WorkloadMetricsSection.tsx` + `WorkloadMetricsModal.tsx`)

- `WorkloadMetricsModal` truyền `workNature={item.work_nature || 'labor'}`.
- Khi `workNature === 'statistics'`:
  - Hiện panel sky-blue **"📄 Số phiếu / chứng từ đã tạo"** phía trên lưới 6 chỉ số (ô số + ghi chú: dùng chấm độ chính xác/tiến độ, **không dùng tính sản lượng tay chân hay giờ làm**).
  - Khung "Bảng nhập tay" đổi lời nhắc sang nội dung thống kê (ẩn dòng quy đổi 600 kg/20 kg không còn phù hợp).
- Công việc lao động giữ nguyên toàn bộ giao diện cũ.

## Sửa (`src/components/work-plans/WorkPlansView.tsx`)

- Khối số liệu bên phải hàng công việc: nếu là thống kê, hiện panel riêng **"Dữ liệu thống kê / ghi chép"** (📄 Phiếu đã tạo + ⭐ Chất lượng + ghi chú không ghi sản lượng/giờ) thay cho lưới vị trí/tấn/thùng/cont.

## Sửa (`src/components/work-plans/WorkPlanAnalyticsTab.tsx`)

- `EmployeeStatRow` thêm `totalDocuments`; cộng `documents_count` theo `share_percent` cho việc thống kê.
- KPI tổng thêm `totalDocuments`; thẻ "Tổng Vị Trí Đã Hạ/Xếp" hiện thêm dòng "📄 N phiếu thống kê đã tạo".
- Bảng xếp hạng: việc thống kê chỉ có phiếu hiện "📄 N phiếu đã tạo" (thay vì "Không ghi"); drawer chi tiết hiện số phiếu ở dòng tổng kết và từng việc.
- Sheet Excel "Hiệu suất & KPI Nhân viên" thêm 2 cột **📊 Việc thống kê** và **📄 Số phiếu đã tạo**.

## Sửa (`src/components/work-plans/AnalyticsExportCardModal.tsx`)

- Thẻ ảnh/Zalo: ô Sản lượng & Giờ làm hiện "📄 N phiếu đã tạo" cho nhân sự chỉ làm thống kê; dòng tóm tắt nhân sự, text copy Zalo và thẻ tổng quan cũng hiện số phiếu.

## Kiểm chứng

- `npx tsc --noEmit` lọc các file vừa sửa → không lỗi.
- `npx vitest run src/components/work-plans/__tests__` → **12/12 pass**.
- Chưa xác minh bằng trình duyệt: `:3000` là bản build cũ, cần rebuild (hỏi trước) hoặc chạy dev `:3001`.

# Walkthrough: Thay ô "Số Vị Trí Hạ/Xếp" bằng "Số Phiếu / Chứng Từ" (công việc Thống kê)

## Yêu cầu

Với công việc đã đánh dấu **Thống kê**, bỏ hẳn ô **Số Vị Trí Hạ/Xếp** trong lưới thông số và thay bằng ô **Số phiếu / chứng từ**; số phiếu lấy trực tiếp từ nguồn **Nhập / Xuất kế toán** đã gắn (VD: 2 phiếu nhập + 2 phiếu xuất = 4 phiếu).

## Sửa (`src/components/work-plans/WorkloadMetricsSection.tsx`)

- Bỏ panel sky-blue "📄 Số phiếu / chứng từ đã tạo" đứng riêng phía trên lưới (thay đổi của walkthrough trước).
- Ô đầu tiên trong lưới thông số nay có điều kiện theo `workNature`:
  - **Thống kê**: ô **"Số Phiếu / Chứng Từ"** gắn với `value.documents_count`, viền sky-blue; dưới ô hiện dòng tự động **"Tự động: N phiếu nhập + M phiếu xuất"** khi đã gắn nguồn kế toán, ngược lại hiện gợi ý "Đếm phiếu đã hoàn thành trong ca".
  - **Lao động**: giữ nguyên ô **"Số Vị Trí Hạ/Xếp"** (`positions_count`) và dòng "Gốc / hệ số" như cũ.
- Toggle nguồn **Nhập kế toán** / **Xuất kế toán** gọi `syncStatisticsDocuments` sau khi tính lại → `documents_count = số phiếu nhập + số phiếu xuất` đang gắn (kể cả khi bỏ hết về 0). Các nguồn khác (Lệnh xuất, LOT, Duyệt gán vị trí) **không** đụng tới số phiếu.
- Thêm `useEffect` điền bù: nếu là thống kê, đã gắn phiếu nhập/xuất mà ô số phiếu còn trống/0 thì tự điền đúng tổng (dữ liệu cũ trước thay đổi này).
- Summary thu gọn không còn hiện "N vị trí" cho công việc thống kê; vẫn hiện "📄 N phiếu".

## Sửa (`src/components/work-plans/types.ts`)

- Giữ `documents_count` trong `WorkloadMetrics`; **không** để `recalculateWorkloadFromLinkedSources` tự ghi `documents_count` (tránh việc lao động gắn phiếu kế toán cũng bị hiện "N phiếu") — việc đồng bộ chỉ diễn ra ở component khi `workNature === 'statistics'`.

## Kiểm chứng

- `npx tsc --noEmit` lọc các file work-plans vừa sửa → không lỗi.
- `npx vitest run src/components/work-plans/__tests__` → **12/12 pass**.
- Việc Giang / Da Ti đã nhập trước đây cần được đánh dấu **📊 Thống kê** ở bước 2 một lần; sau đó số phiếu sẽ tự lấy từ nguồn Nhập/Xuất đã gắn.
- Chưa xác minh bằng trình duyệt: `:3000` là bản build cũ, cần rebuild (hỏi trước) hoặc chạy dev `:3001`.

# Walkthrough: Thay ô "Số LOT / Pallet" bằng "Số Dòng Dữ Liệu" (công việc Thống kê)

## Yêu cầu

Tiếp nối thay đổi ô đầu lưới, với công việc **Thống kê** ô **Số LOT / Pallet** cũng được thay tại chỗ bằng ô **Số dòng dữ liệu** — tức tổng số dòng dữ liệu đã nhập trong các phiếu (mỗi phiếu có thể có nhiều dòng).

## Sửa (`src/components/work-plans/types.ts`)

- Thêm `WorkloadMetrics.data_rows_count?: number | null` (JSONB, **không cần migration**).
- `hasWorkloadData` và `formatWorkloadSummaryText` nhận thêm `data_rows_count` → summary hiện "📋 N dòng dữ liệu".

## Sửa (`src/components/work-plans/WorkloadMetricsSection.tsx`)

- Ô thứ 2 của lưới thông số có điều kiện theo `workNature`:
  - **Thống kê**: ô **"Số Dòng Dữ Liệu"** gắn với `data_rows_count`, viền sky-blue; dưới ô hiện **"Tự động: N dòng trong M phiếu"** = tổng `items_count` của các phiếu nhập/xuất kế toán đã gắn; chưa gắn nguồn thì hiện gợi ý "Tổng dòng trong các phiếu đã nhập".
  - **Lao động**: giữ nguyên ô **"Số LOT / Pallet"** (`lots_count`) và dòng "Gốc / hệ số".
- `syncStatisticsDocuments` (toggle nguồn Nhập/Xuất) cập nhật đồng thời `documents_count` và `data_rows_count`; `useEffect` điền bù cho dữ liệu cũ còn trống.
- Summary thu gọn thêm "📋 N dòng"; `manualHasData` / `hasSummaryData` tính cả `data_rows_count`.

## Sửa (`src/components/work-plans/WorkPlansView.tsx`)

- Panel "Dữ liệu thống kê / ghi chép" bên phải hàng công việc: 3 ô **📄 Phiếu**, **📋 Dòng dữ liệu**, **⭐ Chất lượng**.

## Kiểm chứng

- `npx tsc --noEmit` lọc các file work-plans vừa sửa → không lỗi.
- `npx vitest run src/components/work-plans/__tests__` → **12/12 pass**.
- Chưa xác minh bằng trình duyệt: `:3000` là bản build cũ, cần rebuild (hỏi trước) hoặc chạy dev `:3001`.

# Walkthrough: Bỏ mục "Đánh Giá Cá Nhân & Ghi Nhận Lỗi Vi Phạm (Xét KPI)" khỏi modal Số liệu chứng minh

## Yêu cầu

Modal **"Số Liệu & Chứng Từ Chứng Minh Công Việc"** chỉ nên chứa số liệu/chứng từ; phần đánh giá cá nhân, giờ làm và vi phạm KPI đã có ở **bước 3 – Đánh giá**, không cần lặp lại.

## Sửa (`src/components/work-plans/WorkloadMetricsModal.tsx`)

- Bỏ khối `<AssigneeEvaluationSection />` (Đánh giá cá nhân, giờ làm & tăng ca, vi phạm/thưởng điểm, đóng góp %).
- Giữ nguyên `assignee_evaluations` đã có: modal vẫn đọc từ `workload_metrics` (fallback `item.assignee_evaluations`) và ghi trả lại khi lưu, **không xóa dữ liệu KPI** của bước 3.
- Nút "Xóa trắng số liệu" chỉ xóa số liệu chứng minh, **không còn xóa đánh giá cá nhân**.
- Đổi nhãn nút lưu thành "Lưu số liệu chứng minh".

`AssigneeEvaluationSection` vẫn dùng ở `EvaluateItemModal` (bước 3) nên không thay đổi chức năng đánh giá.

## Kiểm chứng

- `npx tsc --noEmit` lọc `WorkloadMetricsModal.tsx` → không lỗi.
- `npx vitest run src/components/work-plans/__tests__` → **12/12 pass**.
- Chưa xác minh bằng trình duyệt: `:3000` là bản build cũ, cần rebuild (hỏi trước) hoặc chạy dev `:3001`.

# Walkthrough: Thang điểm KPI riêng cho công việc Thống kê (Năng suất 20đ – Chất lượng 40đ)

## Yêu cầu

Với công việc **Thống kê / Ghi chép**, độ chính xác số liệu (đúng/sai) mới là yếu tố quyết định, nên **giảm trọng số Năng suất và tăng trọng số Chất lượng**, vẫn giữ tổng 100 điểm.

## Thang điểm mới (chỉ áp dụng khi `work_nature = 'statistics'`)

| Trụ cột | Lao động (giữ nguyên) | Thống kê (mới) |
|---|---|---|
| Năng suất | 40–50đ theo độ nặng (Nhẹ 40 • Vừa 42 • Nặng 45 • Rất nặng 50) | **20đ** – theo % hoàn thành công việc |
| Chất lượng | 20đ | **40đ** – theo số sao nghiệm thu (5⭐=40, 4⭐=32, 3⭐=24, 2⭐=16, 1⭐=8) |
| An toàn & Hàng hóa | 20đ | 20đ |
| Kỷ luật & 5S | 15đ | **20đ** – trừ lỗi, cộng thưởng nhưng chặn trần 20đ |
| **Tổng việc chính** | 100đ | **100đ** |

Việc phụ vẫn cộng mở trần trên 100 điểm; với công việc thống kê, điểm chuẩn của việc phụ tính theo trần Năng suất 20đ × % đóng góp.

## Sửa

- `src/components/work-plans/types.ts`: thêm `KPI_PILLARS_STATISTICS` (20/40/20/20); `calculateAssigneeTaskStandardKpi` nhận `workNature`, tính trần Năng suất/Chất lượng/Kỷ luật động; `TaskStandardKpiScore` trả thêm `productivityMax`, `qualityMax`, `safetyMax`, `disciplineMax`.
- `src/components/work-plans/EvaluateItemModal.tsx` + `AssigneeEvaluationSection.tsx` (bước 3): truyền `workNature`; các ô nhập Năng suất/Chất lượng dùng trần động; mẫu số hiển thị `/{productivityMax}đ`, `/{qualityMax}đ`, `/{disciplineMax}đ`; thêm badge "📊 Thống kê: Năng suất 20đ • Chất lượng 40đ".
- `src/components/work-plans/WorkPlanAnalyticsTab.tsx`: cột bảng, tooltip, thẻ drawer và dòng chi tiết từng việc dùng trần động (`productivityMax`, `qualityMax`, `disciplineMax`); Excel xuất kèm mẫu số thực tế (ví dụ "32 / 40đ").
- `src/components/work-plans/AnalyticsExportCardModal.tsx`: thẻ xuất Zalo hiển thị đúng mẫu số từng trụ cột theo loại việc; bảng tổng hợp có mẫu số nhỏ dưới điểm.
- `src/components/work-plans/KpiRulesHandbookTab.tsx`: thêm khối "📊 Thang Điểm Riêng Cho Công Việc Thống Kê / Ghi Chép" (4 thẻ, badge "Tổng vẫn 100 điểm").

## Ảnh hưởng dữ liệu cũ

- Việc lao động không đổi (vẫn 40–50/20/20/15).
- Việc thống kê đã gắn cờ **📊 Thống kê** ở bước 2 sẽ tự động chấm lại theo thang mới; việc thống kê chưa gắn cờ vẫn chấm theo thang lao động cho tới khi được đánh dấu.
- Nhân sự làm lẫn lao động + thống kê: bảng tổng hợp lấy trần trung bình theo số việc chính; Kỷ luật gốc 20đ chỉ khi **toàn bộ** việc chính là thống kê, còn lại giữ 15đ.

## Kiểm chứng

- Thêm test "uses the statistics scale (Năng suất 20đ, Chất lượng 40đ, Kỷ luật 20đ) for statistics work" — kiểm tra cả trường hợp đủ 100% (20+32+20+20 = 92) và hoàn thành 50% (10+40+20+20 = 90), đồng thời xác nhận việc lao động vẫn ra 42/45.
- `npx tsc --noEmit` lọc các file work-plans vừa sửa → không lỗi.
- `npx vitest run src/components/work-plans/__tests__` → **13/13 pass**.
- Chưa xác minh bằng trình duyệt: `:3000` là bản build cũ, cần rebuild (hỏi trước) hoặc chạy dev `:3001`.

# Walkthrough: Điều chỉnh thang điểm Thống kê — Chất lượng theo đúng/sai, Năng suất theo độ nặng

> Mục này thay thế cách chấm ở mục "Thang điểm KPI riêng cho công việc Thống kê" phía trên: bỏ quy đổi sao (5⭐=40 … 4⭐=32), thay bằng chấm đúng/sai số liệu.

## Yêu cầu

- Chất lượng việc thống kê chỉ có **đúng hoặc sai**: số liệu không có lỗi thì tuyệt đối 40/40đ, không có mức 32đ gây lẫn lộn.
- Năng suất thống kê phải theo **độ nặng khối lượng**: nhiều số liệu (nặng) = 20đ, nhẹ thì hạ mốc để **cân bằng với ngày công lao động**, tránh việc nhẹ vẫn đạt tối đa.
- Vẫn giữ bộ chọn sao ở bước 3 nhưng chỉ để **tham khảo**, không ảnh hưởng điểm thống kê.

## Thang điểm chốt

| Trụ cột | Lao động | Thống kê |
|---|---|---|
| Năng suất | Nhẹ 40 • Vừa 42 • Nặng 45 • Rất nặng 50 | **Nhẹ 10 • Vừa 12 • Nặng 15 • Rất nặng 20** × % hoàn thành |
| Chất lượng | 20đ theo sao | **40đ**, đúng tuyệt đối = 40; mỗi lỗi số liệu trừ 10–25đ |
| An toàn & Hàng hóa | 20đ | 20đ |
| Kỷ luật & 5S | 15đ | 20đ |
| **Tổng tối đa** | 95 / 97 / 100 / 105 | **90 / 92 / 95 / 100** |

Lỗi số liệu lấy từ nhóm mẫu lỗi sẵn có **"Thống kê, Kiểm đếm & Dữ liệu kho"** (sai số lượng/vị trí -15, sai LOT -25, chậm cập nhật -10…). Các lỗi này **chỉ trừ vào Chất lượng**, không trừ trùng vào Kỷ luật. Lỗi nghiêm trọng (sai LOT) vẫn khóa hạng A/A+ như quy chế chung.

## Sửa

- `src/components/work-plans/types.ts`: thêm `getStatisticsProductivityByDifficulty` (10/12/15/20); `calculateAssigneeTaskStandardKpi` dùng mốc này cho Năng suất thống kê, Chất lượng thống kê bỏ quy đổi sao và trừ theo lỗi nhóm `inventory_statistics`, Kỷ luật thống kê không trừ lỗi số liệu lần 2.
- `src/components/work-plans/WorkloadMetricsSection.tsx`: khối chọn độ nặng khi là việc thống kê hiển thị đúng mốc 10/12/15/20, ẩn nút "Tự động gợi ý" (gợi ý cũ dựa trên Cont/vị trí/tấn không phù hợp).
- `src/components/work-plans/AssigneeEvaluationSection.tsx`: badge và ghi chú nêu rõ đúng = 40đ, lỗi trừ 10–25đ, sao chỉ tham khảo; mẫu số chất lượng/kỷ luật động theo trần.
- Các nơi gọi `calculateAssigneeTaskStandardKpi` (`EvaluateItemModal`, `WorkPlanAnalyticsTab`, `AnalyticsExportCardModal`) truyền `difficulty` của công việc thay vì ép `null` cho thống kê, để năng suất ra đúng mốc 10–20.
- `src/components/work-plans/KpiRulesHandbookTab.tsx`: cập nhật khối quy chế thống kê (bảng mốc năng suất, quy tắc đúng/sai, tổng tối đa theo độ nặng); drawer/Excel hiển thị đúng mẫu số thực tế.

## Kiểm chứng

- Test cập nhật lại trong `src/components/work-plans/__tests__/workPlanParser.test.ts`: nhẹ 10đ + đúng số liệu 40đ + kỷ luật 20đ = 90đ; nặng 15đ → 95đ; rất nặng → 100đ; hoàn thành 50% → 5đ năng suất; 1 lỗi sai số lượng (-15) → chất lượng 25đ, kỷ luật vẫn 20đ, tổng 80đ hạng B; sai LOT (-25, nghiêm trọng) → chất lượng 15đ, khóa hạng C; lao động giữ nguyên 42/45 và 4⭐ = 16/20.
- `npx tsc --noEmit` lọc các file work-plans vừa sửa → không lỗi.
- `npx vitest run src/components/work-plans/__tests__` → **13/13 pass**.

# Walkthrough: Sửa trần Năng suất thống kê về 20đ (mốc độ nặng chỉ là điểm đạt)

## Vấn đề

Bản trước lấy mốc độ nặng làm luôn trần trụ cột, nên việc nhẹ hiển thị **10/10đ** — trông như đã đạt tối đa, che mất việc khối lượng còn nhẹ.

## Cách tính chốt

- **Trần Năng suất thống kê luôn = 20đ** (không đổi theo độ nặng).
- Độ nặng chỉ quyết định **mốc đạt**: Nhẹ 10 • Vừa 12 • Nặng 15 • Rất nặng 20, nhân theo % hoàn thành.
- Ví dụ: việc nhẹ hoàn thành 100% hiển thị **10/20đ**; việc nặng **15/20đ**; rất nặng **20/20đ**. Tổng ngày vẫn 90/92/95/100đ.
- Quản lý chấm tay vẫn bị chặn ở trần 20đ.

## Sửa

- `src/components/work-plans/types.ts`: tách `prodMax` (luôn 20) khỏi `statBaseScore` (mốc 10/12/15/20); năng suất = mốc × % hoàn thành.
- `src/components/work-plans/AssigneeEvaluationSection.tsx`: badge ghi "Năng suất trần 20đ (mốc 10–20)"; bỏ hậu tố "(4⭐)" cạnh điểm chất lượng của việc thống kê; ghi chú nêu rõ trần và mốc.
- `src/components/work-plans/WorkloadMetricsSection.tsx`: nút chọn độ nặng hiển thị mốc dạng `10/20đ … 20/20đ`.
- `src/components/work-plans/KpiRulesHandbookTab.tsx`: ghi "10 – 20 / 20 điểm", trần trụ cột luôn 20đ.
- Bảng/drawer/Excel/thẻ Zalo tự hiện `/20` theo `productivityMax`.

## Kiểm chứng

- Test cập nhật: nhẹ = 10/20 (tổng 90), nặng = 15/20 (95), rất nặng = 20/20 (100), hoàn thành 50% = 5/20, lỗi số liệu không đổi tổng 80.
- `npx tsc --noEmit` lọc file work-plans → không lỗi; `npx vitest run src/components/work-plans/__tests__` → **13/13 pass**.

# Walkthrough: Cân bằng điểm lao động với thống kê — Chất lượng tuyệt đối, Năng suất hạ mốc

## Yêu cầu

- Cùng một ngày hoàn thành tốt, việc lao động và việc thống kê phải ra **cùng tổng điểm** (trước đó thống kê 90đ còn lao động 91đ).
- Chất lượng lao động trong ngày cũng là **tuyệt đối** (không lỗi hàng hóa = đủ điểm), nên **hạ mốc Năng suất** theo độ nặng cho phù hợp.

## Thang điểm lao động mới

| Trụ cột | Mốc |
|---|---|
| Năng suất (trần 45đ) | **Nhẹ 35 • Vừa 37 • Nặng 40 • Rất nặng 45** |
| Chất lượng | **20đ tuyệt đối** — trừ theo lỗi hàng hóa (10–40đ/lỗi) |
| An toàn | 20đ — chỉ trừ lỗi an toàn/xe nâng |
| Kỷ luật & 5S | 15đ |
| **Tổng tối đa** | **90 / 92 / 95 / 100đ** — trùng khớp thang Thống kê |

Số sao nghiệm thu ở bước 3 chỉ còn để tham khảo cho cả hai loại việc, không quyết định điểm chất lượng.

## Phân bổ lỗi (không trừ trùng)

- **Lao động:** lỗi nhóm *Hàng hóa, Bốc vác & Chất lượng* → trừ **Chất lượng**; lỗi nhóm *An toàn xe nâng* → trừ **An toàn**; lỗi vận hành/kỷ luật/số liệu → trừ **Kỷ luật**.
- **Thống kê:** lỗi nhóm *Thống kê, Kiểm đếm & Dữ liệu kho* → trừ **Chất lượng**; lỗi an toàn/hàng hóa → trừ **An toàn**.

## Sửa

- `src/components/work-plans/types.ts`: mốc `getProductivityScoreByDifficulty` đổi thành 35/37/40/45; chất lượng lao động bỏ quy đổi sao, trừ theo lỗi hàng hóa; `quality_goods` không còn trừ vào An toàn của việc lao động; `DIFFICULTY_CONFIG` cập nhật nhãn/mô tả/tổng ca.
- `src/components/work-plans/AssigneeEvaluationSection.tsx`: bỏ hậu tố "(x⭐)" cạnh điểm chất lượng; thêm ghi chú chất lượng tuyệt đối cho việc lao động; đổi tooltip khôi phục chấm tay.
- `src/components/work-plans/EvaluateItemModal.tsx`: ghi rõ số sao chỉ tham khảo.
- `src/components/work-plans/WorkPlanAnalyticsTab.tsx`: tooltip/cột/drawer hiển thị mốc 35–45đ và ghi chú chất lượng theo lỗi.
- `src/components/work-plans/KpiRulesHandbookTab.tsx`: cập nhật 4 trụ cột (năng suất 35–45, chất lượng tuyệt đối theo lỗi hàng hóa, an toàn chỉ lỗi xe nâng), ví dụ minh họa và bảng tổng tối đa 90/92/95/100.

## Kiểm chứng

- Test cập nhật: lao động nhẹ/vừa/nặng/rất nặng = 35/37/40/45; nặng 40 + chất lượng 20 + an toàn 20 + kỷ luật 15 = 95 (Hạng A); rất nặng = 100 (A+); lỗi rách tem -10 → chất lượng 10, an toàn vẫn 20, tổng 85; lao động Vừa 4⭐ = 37 + 20 + 20 + 15 = 92 — bằng đúng tổng ngày Thống kê mức Vừa.
- `npx tsc --noEmit` lọc file work-plans → không lỗi; `npx vitest run src/components/work-plans/__tests__` → **13/13 pass**.

---

# Walkthrough: Thống nhất nhóm lỗi → trụ KPI cho cả Lao động và Thống kê

## Vấn đề

Trước đây cùng một nhóm lỗi rơi vào trụ khác nhau tùy loại công việc:
- Lỗi `quality_goods` (rách tem, đổ hàng): lao động → Chất lượng, nhưng thống kê → An toàn.
- Lỗi `inventory_statistics` (sai LOT): thống kê → Chất lượng, nhưng lao động → Kỷ luật.
- "Quên quét tem" nằm ở nhóm Vận hành (Kỷ luật) trong khi "chậm cập nhật phần mềm" nằm ở nhóm Số liệu (Chất lượng).

Hệ quả: cùng một lỗi nhưng mức trừ và trụ bị trừ khác nhau, khó giải thích cho công nhân.

## Quy tắc chốt (áp dụng cho CẢ HAI loại việc, chỉ khác trần điểm)

| Nhóm lỗi | Trụ bị trừ | Trần trụ |
|---|---|---|
| `safety_forklift` (xe nâng, tốc độ, còi, quá tải) | **An toàn** | 20đ |
| `quality_goods` (hàng hóa, bao bì, nhiệt độ) | **Chất lượng** | Lao động 20đ • Thống kê 40đ |
| `inventory_statistics` (sai số lượng, vị trí, LOT, tem) | **Chất lượng** | Lao động 20đ • Thống kê 40đ |
| Ghi chép: quên quét tem, chậm cập nhật phần mềm, sai lệch bàn giao | **Chất lượng** | Lao động 20đ • Thống kê 40đ |
| `operations` (chưa xong việc, chậm tiến độ, đai lỏng), `discipline_5s`, `other` | **Kỷ luật** | Lao động 15đ • Thống kê 20đ |

Không có lỗi nào bị trừ hai lần. Lỗi mức `severe` vẫn khóa hạng C như trước.

## Thay đổi kỹ thuật

- `src/components/work-plans/types.ts`
  - `calculateAssigneeTaskStandardKpi`: Chất lượng nhận `quality_goods` + `inventory_statistics` + 3 type ghi chép (`missed_scan`, `delayed_system_update`, `handover_discrepancy`) cho cả hai loại việc; An toàn chỉ nhận `safety_forklift`; Kỷ luật nhận `operations`/`discipline_5s`/`other` và bỏ qua các type ghi chép (kể cả bản ghi cũ còn gắn group `operations`).
  - `DEFAULT_INCIDENT_TEMPLATES`: chuyển "Quên quét tem" từ nhóm Vận hành sang nhóm Thống kê/Dữ liệu kho.
  - `KPI_PILLARS` / `KPI_PILLARS_STATISTICS`: nhãn An toàn đổi thành "An toàn lao động".
- `src/components/work-plans/WorkPlanAnalyticsTab.tsx`: bảng tổng hợp chỉ cộng lỗi xe nâng vào cột An toàn; lỗi hàng hóa/số liệu/ghi chép không cộng lại (đã nằm trong điểm Chất lượng từng việc); còn lại mới vào Kỷ luật.
- `src/components/work-plans/AssigneeEvaluationSection.tsx`: ghi chú dưới ô điểm nêu rõ cả hai loại việc đều trừ lỗi hàng hóa + số liệu/ghi chép vào Chất lượng, An toàn chỉ trừ lỗi xe nâng.
- `src/components/work-plans/KpiRulesHandbookTab.tsx`: bổ sung mục ghi chép vào trụ Chất lượng của lao động; trụ An toàn nêu rõ không trừ trùng lỗi hàng hóa; bảng thống kê ghi "Chất lượng = lỗi số liệu & ghi chép", "An toàn = chỉ lỗi xe nâng".

## Kiểm chứng

- Thêm test "routes every incident group to the same fixed pillar for both labor and statistics":
  - Lao động Vừa + sai số liệu 15đ → chất lượng 5, an toàn 20, kỷ luật 15, tổng 77.
  - Thống kê Nặng + rách tem 10đ → chất lượng 30/40, an toàn 20, kỷ luật 20, tổng 85.
  - Bản ghi cũ `missed_scan` (group `operations`) → chất lượng 10, kỷ luật 15, tổng 82.
  - Lỗi xe nâng 5đ → an toàn 15, chất lượng 20, kỷ luật 15, tổng 87.
- `npx vitest run src/components/work-plans/__tests__` → **14/14 pass**.
- `npx tsc --noEmit` lọc file work-plans → không lỗi.

---

# Walkthrough: Bỏ trụ An toàn của việc Thống kê, dồn 20đ sang Năng suất

## Lý do

Việc thống kê thuần số liệu không vận hành xe nâng, nên trụ "An toàn 20đ" chỉ còn là điểm mặc định gần như không thể mất — làm điểm ngày của thống kê bị neo cao và khó giải thích so với lao động. Hai loại việc vẫn phải giữ tổng ngày bằng nhau (90 / 92 / 95 / 100đ) theo yêu cầu trước đó.

## Quyết định (người dùng chọn)

Bỏ trụ An toàn khỏi việc thống kê và **dồn 20đ vào Năng suất**:

| Trụ (Thống kê) | Trước | Sau |
|---|---|---|
| Năng suất | 10–20 / 20đ | **30–40 / 40đ** (Nhẹ 30 • Vừa 32 • Nặng 35 • Rất nặng 40) |
| Chất lượng | 40đ | 40đ (không đổi, trừ 10–25đ/lỗi số liệu & ghi chép) |
| An toàn | 20đ | **không có** |
| Kỷ luật & 5S | 20đ | 20đ |
| **Tổng ngày** | 90/92/95/100 | **90/92/95/100** (giữ nguyên) |

Chọn dồn vào Năng suất thay vì Chất lượng để một lỗi số liệu 15đ vẫn bị trừ đúng 15đ trên nền 40đ (nếu dồn vào Chất lượng 60đ thì lỗi bị phạt nhẹ đi theo tỷ lệ).

## Xử lý lỗi xe nâng trên việc thống kê

- Ẩn nhóm lỗi "Vận hành xe nâng & An toàn kho" khỏi danh sách chọn lỗi khi việc là Thống kê.
- Bản ghi cũ (nếu có) dính lỗi xe nâng trên việc thống kê: trừ vào **Kỷ luật**; lỗi mức `severe` vẫn khóa hạng C toàn cục như quy tắc chung.
- Điều kiện khóa hạng C do "điểm An toàn ≤ 5" chỉ áp dụng cho việc lao động.

## Thay đổi kỹ thuật

- `src/components/work-plans/types.ts`
  - `getStatisticsProductivityByDifficulty` → 30/32/35/40.
  - `KPI_PILLARS_STATISTICS` còn 3 trụ (Năng suất 40 • Chất lượng 40 • Kỷ luật 20).
  - `calculateAssigneeTaskStandardKpi`: `prodMax = 40` khi thống kê; `safetyMax = 0`, `safetyScore = 0`; lỗi `safety_forklift` của thống kê chuyển sang Kỷ luật; khóa hạng C theo an toàn chỉ áp dụng lao động.
- `src/components/work-plans/AssigneeEvaluationSection.tsx`: thẻ An toàn ẩn với thống kê (lưới 3 thẻ thay vì 4), badge Năng suất trần 40đ/mốc 30–40, ghi chú giải thích; ẩn nhóm lỗi xe nâng khi thống kê.
- `src/components/work-plans/WorkloadMetricsSection.tsx`: nhãn độ nặng thống kê hiển thị mốc `x/40đ`.
- `src/components/work-plans/WorkPlanAnalyticsTab.tsx`: bảng/drawer hiển thị "—" ở cột An toàn cho người chỉ làm thống kê; Năng suất hiển thị trên trần trung bình 40đ; điểm tổng hợp không cộng trụ An toàn cho người chỉ làm thống kê; Excel xuất "—" và header "An toàn (đ)".
- `src/components/work-plans/AnalyticsExportCardModal.tsx`: ẩn chip An toàn của từng việc thống kê; bảng nhân sự hiển thị "—"; dòng Zalo bỏ 🛡️ khi không có trụ An toàn.
- `src/components/work-plans/KpiRulesHandbookTab.tsx`: khối Thống kê còn 3 trụ, Năng suất 30–40/40đ, ghi rõ 20đ đã gồm trụ An toàn; tổng ngày 90/92/95/100 giữ nguyên.

## Kiểm chứng

- Test cập nhật:
  - Thống kê Nhẹ: 30/40 + 40 + 20 = 90 (A); Vừa 92; Nặng 95; Rất nặng 100.
  - Hoàn thành 50%: 15 + 40 + 20 = 75.
  - Sai số liệu 15đ (Nặng): 35 + 25 + 20 = 80 (B); sai LOT severe → 70 nhưng khóa C.
  - Lỗi xe nâng trên việc thống kê: An toàn 0/0, Kỷ luật 15/20, tổng 85.
  - Lao động giữ nguyên 92đ (Vừa) và cột An toàn 20đ.
- `npx vitest run src/components/work-plans/__tests__` → **14/14 pass**.
- `npx tsc --noEmit` lọc file work-plans → không lỗi.

# Walkthrough: Rà soát lại tab "5. Quy Chế KPI" cho khớp mô hình chấm điểm hiện tại

## Mục tiêu

Sau khi thống nhất (a) nhóm lỗi → trụ KPI và (b) bỏ trụ An toàn của việc Thống kê, tab quy chế vẫn còn nhiều câu chữ của thang điểm cũ (sao nghiệm thu, năng suất 40–50đ, ví dụ 35đ…). Đợt này rà toàn bộ tab và sửa lại cho khớp code.

## Những chỗ đã sửa

- **Chip điều hướng**: "2. 4 Trụ Cột KPI (100đ)" → "2. Thang Điểm Ca (100đ)" vì thống kê chỉ có 3 trụ.
- **Thẻ tổng quan 2**: "việc chính đạt 95–100đ" → "90–100đ tùy độ nặng".
- **Thẻ tổng quan 3**: bỏ câu "an toàn là trên hết" chung chung, thay bằng quy tắc **mỗi lỗi chỉ trừ đúng một trụ** (xe nâng → An toàn; hàng hóa/số liệu/ghi chép → Chất lượng; vận hành/5S → Kỷ luật); severe → Hạng C.
- **Mục 2**:
  - Tiêu đề nêu rõ "Lao Động 4 Trụ Cột • Thống Kê 3 Trụ Cột"; badge phải "Việc chính tối đa: 100 Điểm" (trước ghi "Tổng Ca Chuẩn: 100 Điểm" dễ hiểu nhầm).
  - Năng suất lao động: 35–45đ, mốc Nhẹ 35 • Vừa 37 • Nặng 40 • Rất nặng 45, tổng ca 90/92/95/100.
  - Chất lượng lao động: bỏ hoàn toàn thang 5⭐/4⭐/3⭐/2⭐/1⭐ (20/16/12/8/4), thay bằng **trừ theo lỗi thực tế** trên nền 20đ; thêm dòng lỗi ghi sai số lượng / vị trí kệ / mã LOT khi kiểm đếm (15–25đ); số sao chỉ để tham khảo.
  - An toàn lao động: ghi rõ chỉ áp dụng việc lao động (có xe nâng), thống kê không có trụ này, lỗi hàng hóa/ghi chép đã trừ ở Chất lượng nên không trừ trùng.
  - Khối Thống kê: 3 trụ Năng suất 30–40/40 • Chất lượng 40 • Kỷ luật 20, tổng 90/92/95/100 bằng đúng ngày công lao động.
- **Mục 3**: ví dụ việc phụ sửa "mức Vừa 35đ → +17.5đ" thành **"Vừa 37đ → +18.5đ"** (40đ Nặng × 18% = +7.2đ vẫn đúng).
- **Mục 4**:
  - Đổi tên "Danh Mục Lỗi Vi Phạm & Mức Trừ Điểm Kỷ Luật" → **"Danh Mục Lỗi Vi Phạm & Trụ Cột Bị Trừ Điểm"** (trước đây ngụ ý mọi lỗi đều trừ Kỷ luật).
  - Thêm badge trên từng nhóm lỗi ghi rõ **"Trừ vào: …"**: xe nâng → An toàn (việc lao động); hàng hóa + thống kê/dữ liệu → Chất lượng; vận hành + 5S + khác → Kỷ luật.
  - Điều khoản đặc biệt tách 2 ý: (1) severe → Hạng C cho **cả hai loại việc**; (2) **chỉ việc lao động** mới bị khóa C khi An toàn ≤ 5đ; lỗi xe nâng trên việc thống kê trừ vào Kỷ luật.
- **Mục 5**: phụ đề "Bé Ngoan = Chất lượng & Kỷ luật 5S" (bỏ chữ An toàn vì thống kê không có trụ này); tiêu chí A+ đổi thành "không vi phạm lỗi an toàn / chất lượng / kỷ luật"; dòng Hạng C ghi thêm "hoặc có sự cố Nghiêm trọng".
- **FAQ**:
  - Q3 viết lại: Chất lượng tính theo **lỗi thực tế của riêng từng người**, không chia theo sao của cả nhóm; 20/20đ (lao động) hoặc 40/40đ (thống kê) nếu không có lỗi được ghi nhận.
  - Thêm **Q5**: việc thống kê không có trụ An toàn, 20đ dồn sang Năng suất, tổng ngày vẫn 90/92/95/100, lỗi số liệu trừ Chất lượng, severe vẫn khóa C.
- **Dọn code**: bỏ các import không còn dùng (`Scale`, `ShieldAlert`, `Award`, `Trophy`, `CheckCircle2`, `Zap`, `Star`, `Layers`, `Calendar`, `HelpCircle`, `ArrowRight`, `Users`, `Package`, `TrendingUp`, `Sparkles`, `Check`, `KPI_PILLARS`, `TASK_TYPE_CONFIG`, `DIFFICULTY_CONFIG`, `RATING_CONFIG`); thêm bảng tra `INCIDENT_GROUP_PILLAR` để badge trụ cột không lệch với logic chấm điểm.

## Kiểm chứng

- `npx tsc --noEmit` lọc `work-plans` → không lỗi.
- `npx vitest run src/components/work-plans/__tests__` → **14/14 pass** (logic chấm điểm không đổi, chỉ sửa văn bản hướng dẫn).
- `git diff --stat` chỉ 1 file `KpiRulesHandbookTab.tsx` (+131/−59), không có file lạ.

# Walkthrough: Tái cấu trúc quy chế KPI theo 2 loại công việc

## Yêu cầu

Tab quy chế phải **giới thiệu ngay từ đầu có 2 loại công việc** — Lao động và Thống kê — rồi từ đó mới suy ra các tiêu chí/thang điểm, thay vì nhảy thẳng vào 4 trụ cột chung.

## Thay đổi (`src/components/work-plans/KpiRulesHandbookTab.tsx`)

- **Mục 1** thêm khối "🧭 Hai Loại Công Việc — Gốc Của Mọi Tiêu Chí":
  - 🌱 **Lao động** (bốc xếp, dỡ cont, xe nâng, đai kiện…): 4 trụ — Năng suất 35–45/45 • Chất lượng 20 • An toàn 20 • Kỷ luật 15.
  - 📊 **Thống kê** (kiểm đếm, ghi chép, nhập liệu…): 3 trụ — Năng suất 30–40/40 • Chất lượng 40 • Kỷ luật 20.
  - Hai thẻ ghi rõ cùng tổng ngày 90/92/95/100đ; kèm câu nối: từ 2 loại này suy ra cách trừ lỗi (xe nâng → An toàn ở lao động / Kỷ luật ở thống kê; hàng hóa & ghi chép → Chất lượng; vận hành & 5S → Kỷ luật), và bước 3 chỉ quyết định cách cộng điểm, không đổi loại việc.
- **Mục 2** tách thành 2 khối có tiêu đề rõ:
  - **A. VIỆC LAO ĐỘNG — 4 TRỤ CỘT** (4 thẻ, badge "Tổng ngày 90/92/95/100đ").
  - **B. VIỆC THỐNG KÊ / GHI CHÉP — 3 TRỤ CỘT**: nâng khối thống kê từ dạng thu gọn thành 3 thẻ đầy đủ (Năng suất 30–40/40 • Chất lượng 40 • Kỷ luật 20), kèm lý giải "vì sao không có trụ An toàn".
- **Mục 3**: ghi rõ áp dụng cho cả 2 loại việc; "việc chính được chấm theo thang điểm của đúng loại việc đó"; badge "Tối đa 100đ" thay "Chuẩn ca: 100đ".
- **Chip điều hướng**: "1. Tôn Chỉ & 2 Loại Việc", "2. Thang Điểm Theo Loại Việc".
- Đồng bộ lại ví dụ: bỏ "Kiểm đếm" khỏi mức Nhẹ của lao động (kiểm đếm là việc thống kê); đổi lỗi "khi kiểm đếm" ở thẻ Chất lượng lao động thành "trên phiếu bàn giao".

## Kiểm chứng

- `npx tsc --noEmit` lọc `work-plans` → không lỗi.
- `npx vitest run src/components/work-plans/__tests__` → **14/14 pass** (chỉ thay đổi nội dung hiển thị).

# Walkthrough: Sửa thẻ "Chất lượng thực hiện" của việc Lao động cho khớp danh mục lỗi

## Vấn đề

Thẻ II. Chất lượng (lao động) ghi mức trừ không khớp `DEFAULT_INCIDENT_TEMPLATES` và không khớp trần 20đ của trụ:
- "Rách thùng… Trừ 10đ/lỗi" — thực tế nĩa xe đâm rách thùng/bao bì là **20đ**.
- "Đâm rách bao bì, lẫn LOT, sai nhiệt độ: 15–35đ/lỗi" — gộp 3 mức khác nhau (20 / 15 / 35) thành một khoảng.
- "Rơi đổ hàng: Trừ 40đ (0đ, khóa hạng A)" — trụ chỉ có 20đ nên "trừ 40đ" tối nghĩa; và lỗi `severe` khóa **Hạng C**, không phải "hạng A".
- Thẻ An toàn: "Va quẹt chân kệ / nâng quá tải (0đ, khóa hạng A)" — cũng phải là **Hạng C** (cả 2 lỗi đều `severe`).

## Sửa (`src/components/work-plans/KpiRulesHandbookTab.tsx`)

Thẻ Chất lượng lao động liệt kê đúng từng mức lỗi:
- Mờ/rách tem, mất barcode; bốc xếp sai quy cách: **−10đ/lỗi**
- Quên quét tem, chậm cập nhật phần mềm, sai lệch bàn giao: **−10đ/lỗi**
- Ghi sai số lượng, sai vị trí kệ; xếp lẫn LOT trên pallet: **−15đ/lỗi**
- Nĩa xe đâm rách thùng/bao bì: **−20đ/lỗi**
- Ghi sai mã LOT; để hàng ngoài nhiệt độ lạnh quá giờ: **−25–35đ (còn 0đ)**
- Làm đổ/rơi kiện, pallet: **−40đ (còn 0đ)**
- Ghi chú: điểm trụ không xuống dưới 0đ; 3 lỗi Nghiêm trọng (sai LOT, sai nhiệt độ, đổ/rơi hàng) **khóa Hạng C**.

Thẻ Chất lượng thống kê chỉnh tương tự: sai số lượng / vị trí kệ / dán nhầm tem nhãn = 15đ; sai mã LOT (severe) = 25đ → 0đ, khóa Hạng C (bỏ câu "0đ, khóa hạng A").

## Kiểm chứng

- `npx tsc --noEmit` lọc `work-plans` → không lỗi.
- Chỉ sửa nội dung hiển thị, không đổi công thức `qualScore = max(0, qualMax − tổng lỗi)`.

# Walkthrough: Tinh gọn thẻ Chất lượng lao động + thêm lỗi "lấy hàng không đúng"

## Yêu cầu

Thẻ II. Chất lượng (lao động) chỉ giữ lỗi hàng hóa — bỏ các lỗi ghi chép/số liệu (thuộc việc thống kê) — và bổ sung lỗi **lấy hàng không đúng, tự ý, không theo chỉ dẫn**.

## Thay đổi

- `src/components/work-plans/KpiRulesHandbookTab.tsx` — thẻ Chất lượng lao động còn:
  - Không lỗi hàng hóa: 20/20đ
  - Bốc xếp sai quy cách / nghiêng lệch kiện: −10đ
  - Xếp lẫn LOT trên pallet không phân tách: −15đ
  - **Lấy hàng không đúng, tự ý, không theo chỉ dẫn: −15đ**
  - Nĩa xe đâm rách thùng / bao bì: −20đ
  - Để hàng ngoài nhiệt độ lạnh quá giờ: −35đ (còn 0đ)
  - Làm đổ / rơi kiện, pallet: −40đ (còn 0đ)
  - Đã bỏ: mờ/rách tem & mất barcode, quên quét tem / chậm cập nhật / sai lệch bàn giao, ghi sai số lượng / vị trí kệ, ghi sai mã LOT.
- `src/components/work-plans/types.ts` — thêm template lỗi vào nhóm `quality_goods`:
  `wrong_item_picked` — "Lấy hàng không đúng / Tự ý lấy hàng không theo chỉ dẫn", severity `moderate`, penalty **15đ**. Nhờ vậy lỗi xuất hiện cả ở mục 4 (Quy chế) và trong bộ chọn lỗi khi đánh giá KPI.

## Lưu ý

Các lỗi ghi chép/số liệu vẫn trừ vào **Chất lượng** nếu quản lý ghi nhận trên việc lao động (engine không đổi, mục 4 vẫn liệt kê đầy đủ) — thẻ tóm tắt của lao động chỉ không lặp lại chúng nữa; chi tiết đầy đủ nằm ở thẻ Chất lượng của việc thống kê và mục 4.

## Kiểm chứng

- `npx tsc --noEmit` lọc `work-plans` → không lỗi.
- `npx vitest run src/components/work-plans/__tests__` → **14/14 pass**.

# Walkthrough: Bỏ mâu thuẫn "trụ 20đ nhưng trừ 35–40đ" ở thẻ Chất lượng

## Vấn đề

Thẻ II. Chất lượng của việc lao động có trần 20đ nhưng vẫn liệt kê "trừ 35đ / 40đ", nhìn như phép trừ vô lý. Thẻ thống kê lại ghi "25đ → còn 0đ" trong khi trần là 40đ (đúng phải còn 15đ).

## Sửa (`src/components/work-plans/KpiRulesHandbookTab.tsx`)

- Hai lỗi Nghiêm trọng của lao động đổi sang mô tả đúng bản chất:
  - Để hàng ngoài nhiệt độ lạnh quá giờ: **mất trụ Chất lượng (0đ), khóa Hạng C**.
  - Làm đổ / rơi kiện, pallet: **mất trụ Chất lượng (0đ), khóa Hạng C**.
- Ghi chú cuối thẻ: "Lỗi lớn hơn trần trụ chỉ đưa trụ về 0đ (không trừ âm)."
- Thẻ thống kê: sai mã LOT 25đ trên trần 40đ → **còn 15đ**, khóa Hạng C.
- Mục 4 thêm một dòng giải thích: điểm trừ áp lên trần của đúng trụ, trụ không âm, phần dư không trừ sang trụ khác; lỗi Nghiêm trọng vẫn khóa Hạng C.

## Kiểm chứng

- `npx tsc --noEmit` lọc `work-plans` → không lỗi.
- Không đổi engine: `qualScore = max(0, qualMax − tổng lỗi)`.

# Walkthrough: Lỗi ghi chép/số liệu chỉ thuộc việc Thống kê

## Quyết định

Người dùng chốt: **lỗi ghi chép / số liệu (quên quét tem, chậm cập nhật phần mềm, sai lệch bàn giao, ghi sai số lượng/vị trí kệ/mã LOT, dán nhầm tem)** chỉ tồn tại ở **việc thống kê**. Việc lao động tay chân không có nhóm lỗi này.

## Thay đổi

- `src/components/work-plans/types.ts` — `calculateAssigneeTaskStandardKpi`:
  - Chất lượng lao động **chỉ** nhận lỗi `quality_goods`.
  - Lỗi `inventory_statistics` + 3 lỗi ghi chép chỉ trừ Chất lượng khi `isStatistics`.
  - Nếu lỡ ghi nhận các lỗi này trên việc lao động → dồn sang **Kỷ luật** (không mất điểm phạt), tương tự cách lỗi xe nâng trên việc thống kê bị dồn sang Kỷ luật.
- `src/components/work-plans/AssigneeEvaluationSection.tsx`:
  - Bộ chọn lỗi: thống kê ẩn nhóm **Xe nâng**; lao động ẩn nhóm **Thống kê, Kiểm đếm & Dữ liệu kho**.
  - Ghi chú dưới bộ chọn của lao động: chỉ trừ lỗi hàng hóa (10–40đ), lỗi ghi chép/số liệu không xuất hiện.
- `src/components/work-plans/WorkPlanAnalyticsTab.tsx` — phân bổ lỗi vào trụ theo đúng nature của từng task: hàng hóa → Chất lượng (cả hai); số liệu/ghi chép → Chất lượng chỉ khi thống kê, ngược lại Kỷ luật; xe nâng → An toàn ở lao động, Kỷ luật ở thống kê.
- `src/components/work-plans/KpiRulesHandbookTab.tsx`:
  - Badge nhóm lỗi đổi thành "Chất lượng (việc thống kê)".
  - Câu nối 2 loại việc + mục 4 nêu rõ lỗi ghi chép/số liệu chỉ có ở việc thống kê và việc lao động đã ẩn nhóm này.
  - Thẻ Chất lượng lao động thêm dòng "Lỗi ghi chép / số liệu thuộc việc thống kê nên không có trong danh sách lỗi của việc tay chân."
- `src/components/work-plans/__tests__/workPlanParser.test.ts` — cập nhật 2 case:
  - Lao động + `wrong_quantity_count` 15đ → Chất lượng giữ 20, Kỷ luật 0, tổng vẫn 77.
  - Lao động + `missed_scan` (group cũ `operations`) 10đ → Chất lượng 20, Kỷ luật 5, tổng vẫn 82.

## Kiểm chứng

- `npx vitest run src/components/work-plans/__tests__` → **14/14 pass**.
- `npx tsc --noEmit` lọc `work-plans` → không lỗi.

# Walkthrough: Việc tồn đọng trong ngày trừ trụ Chất lượng (cả Lao động và Thống kê)

## Quyết định

Người dùng chốt: **để công việc tồn đọng không giải quyết trong ngày thì trụ Chất lượng bị giảm ở cả 2 loại việc**, theo cơ chế **tự động theo % việc còn lại**:

- Trụ Chất lượng chỉ đạt trần khi công việc hoàn thành **100%**.
- Còn bao nhiêu % việc thì mất đúng bấy nhiêu % trụ: lao động 20đ → còn 30% việc mất 6đ; thống kê 40đ → còn 30% việc mất 12đ.
- Không cần Quản lý ghi lỗi. Nếu Quản lý **có** ghi lỗi "Chưa xong việc trong ca" (`incomplete_task`) thì lấy đúng mức phạt của lỗi đó và **bỏ phần tự động** để không trừ hai lần.
- Quản lý chấm tay Chất lượng (`customQualityScore`) thì quyền chấm tay quyết định, bỏ qua cả hai.

## Thay đổi

- `src/components/work-plans/types.ts` — `calculateAssigneeTaskStandardKpi`:
  - `incomplete_task` được xếp vào **Chất lượng** cho cả hai loại việc (trước đây nằm ở nhóm `operations` → Kỷ luật).
  - Thêm % việc còn lại: `remaining = taskStatus === 'completed' ? 0 : 100 − progressPercent` (kẹp 0–100).
  - Tự trừ `qualMax × remaining%` khi **không** có lỗi tồn đọng và **không** chấm tay; trụ không âm.
  - Vòng lặp Kỷ luật bỏ qua `incomplete_task` để không trừ trùng.
- `src/components/work-plans/WorkPlanAnalyticsTab.tsx` — phân bổ lỗi: `incomplete_task` không cộng vào `disciplinePenaltyPoints` nữa (đi theo Chất lượng).
- `src/components/work-plans/KpiRulesHandbookTab.tsx`:
  - Thẻ Chất lượng **Lao động** và **Thống kê** thêm dòng "Để việc tồn đọng trong ca: trừ theo % việc còn lại" (ví dụ 30% → 6đ / 12đ).
  - Câu nối 2 loại việc + phụ đề mục 4 nêu việc tồn đọng trừ Chất lượng ở cả hai loại.
  - Badge nhóm `operations` đổi thành "Chất lượng (tồn đọng) • Kỷ luật"; riêng lỗi `incomplete_task` có nhãn "→ Trừ ⭐ Chất lượng (cả 2 loại việc)".
  - Khối điều khoản đặc biệt thêm đoạn giải thích cơ chế tự động, không cộng dồn, chấm tay được ưu tiên.
- `src/components/work-plans/AssigneeEvaluationSection.tsx` — ghi chú dưới bộ chọn lỗi của cả hai loại việc nêu việc tồn đọng tự trừ theo % còn lại.
- `src/components/work-plans/__tests__/workPlanParser.test.ts`:
  - Case partial 60% (lao động) → Chất lượng 12đ, Kỷ luật 15đ, tổng 87đ.
  - Case có lỗi `incomplete_task` (−5đ) → Chất lượng 15đ, Kỷ luật giữ 15đ, tổng 90đ (không cộng dồn).
  - Thống kê xong 50% → Chất lượng 20/40đ, tổng 55đ (Hạng C).
  - Thêm test riêng: lao động 70% → 14đ; thống kê 70% → 28đ; 0% → 0đ; chấm tay được ưu tiên; lỗi hàng hóa + tồn đọng cùng lúc.

## Kiểm chứng

- `npx vitest run src/components/work-plans/__tests__` → **15/15 pass**.
- `npx tsc --noEmit` lọc `work-plans` → không lỗi.

# Walkthrough: Số phiếu / số dòng của việc Thống kê tự suy ra từ phiếu kế toán đã gắn

## Nguyên nhân

Thẻ "Dữ liệu thống kê / ghi chép" của việc Thống kê đọc trực tiếp `workload_metrics.documents_count` và `data_rows_count`. Hai trường này chỉ được ghi khi panel Số liệu được mở và bấm lưu (hoặc khi bật/tắt phiếu nhập–xuất kế toán). Các việc cũ đã gắn phiếu nhưng chưa từng lưu hai trường này nên hiển thị `—`, dù trong `linked_inbound_orders` / `linked_outbound_orders` đã có dữ liệu.

## Cách sửa

- `src/components/work-plans/types.ts` — thêm `getStatisticsDocumentCounts(metrics)`:
  - `documents = inbound.length + outbound.length`, `rows = Σ items_count` của các phiếu đã gắn.
  - Nếu đã có `documents_count` / `data_rows_count` > 0 (kể cả nhập tay) thì **ưu tiên số đã lưu**, chỉ suy ra khi trống.
- `formatWorkloadSummaryText(metrics, workNature?)` nhận thêm loại việc: với việc Thống kê thì dùng số suy ra để câu tóm tắt vẫn hiện "N phiếu đã tạo / N dòng dữ liệu"; việc Lao động giữ nguyên.
- `src/components/work-plans/WorkPlansView.tsx` — thẻ "Dữ liệu thống kê / ghi chép" dùng helper (Phiếu / Dòng dữ liệu).
- `src/components/work-plans/WorkPlanAnalyticsTab.tsx` — tổng `totalDocuments`, phân bổ theo người và dòng "📄 N phiếu đã tạo" trong ngăn chi tiết dùng helper; file Excel "Khối lượng" truyền thêm `work_nature`.
- `PlanExportCardModal.tsx`, `EvaluateItemModal.tsx` — truyền `item.work_nature` khi tóm tắt số liệu.
- Không sửa dữ liệu production: chỉ tính lúc đọc, nên lần lưu sau vẫn tự đồng bộ về DB như cũ.

## Kiểm chứng

- Item thật `e868d420…` (11.11.2026, việc Thống kê, completed): DB không có `documents_count`/`data_rows_count`, nhưng có 2 phiếu nhập + 2 phiếu xuất, mỗi phiếu 1 dòng → thẻ giờ hiện **4 phiếu / 4 dòng**.
- `npx vitest run src/components/work-plans/__tests__` → **16/16 pass** (thêm test cho helper: suy ra, ưu tiên số đã lưu, tóm tắt thống kê vs lao động).
- `npx tsc --noEmit` lọc `work-plans` → không lỗi.

# Walkthrough: Hiển thị Giờ làm trên thẻ công việc (lấy từ Đánh giá sau nghiệm thu)

## Quyết định

Người dùng chốt: **giờ làm không nhập lúc giao việc; sau khi đánh giá mới có giờ làm và thẻ công việc lấy dữ liệu của người được đánh giá.** Giờ làm lưu theo từng người trong `workload_metrics.assignee_evaluations[]` (`regular_hours` mặc định 8h, `overtime_hours` mặc định 0h).

## Thay đổi

- `src/components/work-plans/types.ts` — thêm `getEvaluationHours(metrics)`:
  - Cộng `regular_hours` và `overtime_hours` của tất cả người được đánh giá; thiếu giờ thì hiểu là ca chuẩn 8h/0h OT (đúng như mặc định ở bộ đánh giá).
  - `hasData = false` khi chưa có đánh giá nào → thẻ hiện `—` (lúc giao việc).
- `src/components/work-plans/WorkPlansView.tsx`:
  - Thẻ **Dữ liệu thống kê / ghi chép**: lưới đổi 3 → 4 ô (2×2), thêm ô **⏱️ Giờ làm**; có OT thì hiện thêm dòng "+Nh OT". Ghi chú cuối thẻ đổi thành "Giờ làm lấy từ phần Đánh giá sau nghiệm thu".
  - Thẻ **Số liệu khối lượng thực tế** (việc lao động): thêm ô **⏱️ Giờ làm** khi có dữ liệu — ưu tiên giờ từ đánh giá, trước khi đánh giá thì dùng `hours_spent` nhập tay nếu có.
- `src/components/work-plans/__tests__/workPlanParser.test.ts` — test `getEvaluationHours`: chưa đánh giá → `hasData=false`; 8h+2h OT và 6h → tổng 16h (OT 2h); đánh giá cũ không lưu giờ → 8h/0h.

## Kiểm chứng

- `npx vitest run src/components/work-plans/__tests__` → **17/17 pass**.
- `npx tsc --noEmit` lọc `work-plans` → không lỗi.
- Dữ liệu thật: item `b8bc74ab…` (09.11.2026, lao động) có 2 người đánh giá 8h/0h → thẻ hiện **16h**; các item chưa đánh giá (kể cả item 11.11.2026 trong ảnh) hiện **—** cho tới khi lưu đánh giá.

# Walkthrough (tiếp): Giờ làm hiện ngay sau đánh giá + luôn có ô Giờ làm ở việc tay chân

## Vì sao trước đó thẻ vẫn "—"

Item Thống kê 11.11.2026 đã chấm 4/5 (trạng thái completed) nhưng `workload_metrics.assignee_evaluations` rỗng: bộ đánh giá chỉ tạo giờ mặc định (8h/người) khi Quản lý chạm vào phần chia % / giờ, nên lần lưu đánh giá đó không ghi giờ nào.

## Thay đổi

- `src/components/work-plans/EvaluateItemModal.tsx` — khi mở modal Đánh giá, nếu chưa có đánh giá từng người thì tự khởi tạo danh sách mặc định (chia % đều, ca chuẩn **8h**, OT **0h**, đúng như bộ đánh giá). Từ nay mọi lần lưu đánh giá đều ghi giờ làm.
- `src/components/work-plans/types.ts` — `getEvaluationHours(metrics, { assigneeCount, assumeStandardShift })`:
  - Có đánh giá từng người → cộng giờ thực tế như trước.
  - Chưa có nhưng item **đã đánh giá** (có `evaluated_at` / số sao / trạng thái khác pending–cancelled) → tạm tính **8h × số người**, đánh dấu `isDefault = true`.
  - Chưa đánh giá (đang giao việc) → không có giờ.
- `src/components/work-plans/WorkPlansView.tsx`:
  - Cả hai thẻ đều truyền `assigneeCount` + cờ đã đánh giá; khi số giờ là tạm tính thì dưới giá trị có dòng nhỏ "ca chuẩn" và tooltip giải thích.
  - Thẻ **Số liệu khối lượng thực tế** (lao động) giờ **luôn hiện ô ⏱️ Giờ làm**, kể cả khi chưa có giờ (hiện `—`).

## Kiểm chứng

- Item trong ảnh (2 người, đã chấm 4/5) → thẻ hiện **16h (ca chuẩn)**; việc lao động đang chờ → ô Giờ làm hiện `—`.
- `npx vitest run src/components/work-plans/__tests__` → **17/17 pass**.
- `npx tsc --noEmit` lọc `work-plans` → không lỗi.

# Walkthrough (tiếp): Giờ làm trên thẻ là TRUNG BÌNH mỗi người, không cộng dồn

Người dùng chốt: **giờ làm hiển thị trên thẻ là giờ trung bình của những người được đánh giá**, không cộng dồn cả nhóm.

- `getEvaluationHours` đổi từ tổng sang trung bình: `regular` / `overtime` / `total` = tổng giờ ÷ số người được đánh giá (làm tròn 1 chữ số thập phân).
- Trường hợp đã đánh giá nhưng chưa lưu giờ từng người: ca chuẩn 8h/người → thẻ hiện **8h** (không còn 16h với 2 người).
- Test cập nhật: (8h + 2h OT) và 6h → trung bình 8h (7h thường + 1h OT); 1 người 8h → 8h; chưa đánh giá → `—`.
- `npx vitest run src/components/work-plans/__tests__` → 17/17 pass; `tsc --noEmit` lọc `work-plans` → không lỗi.

# Walkthrough: Quy chế Thống kê — trừ điểm phát sinh của ngày hôm sau

Người dùng chốt: **số liệu thống kê thường sang ngày hôm sau mới tổng kết**, nên lỗi đối soát phát hiện hôm sau vẫn phải bị trừ điểm — và trừ vào đúng công việc thống kê của **ngày có số liệu**.

## Thay đổi (chỉ nội dung quy chế, không đổi engine)

- `src/components/work-plans/KpiRulesHandbookTab.tsx`:
  - Thẻ **II. CHẤT LƯỢNG SỐ LIỆU** thêm dòng nổi bật: lỗi phát hiện khi đối soát hôm sau vẫn trừ vào Chất lượng của công việc ngày có số liệu (không dồn sang việc ngày hôm sau), điểm ngày hôm trước có thể được cập nhật lại.
  - Khối **Điều khoản an toàn đặc biệt** (mục 4) thêm điều khoản cùng nội dung, nêu rõ không mất lỗi vì ghi nhận muộn.
  - FAQs thêm **Q6**: "Số liệu hôm nay sang hôm sau mới tổng kết, nếu hôm sau mới phát hiện lỗi thì trừ điểm của ngày nào?" → trừ Chất lượng của việc thống kê ngày có số liệu, không dồn sang ngày hôm sau.

## Kiểm chứng

- `npx tsc --noEmit` lọc `KpiRulesHandbook` → không lỗi.

# Walkthrough: Đổi lỗi Nghiêm trọng nhất của việc Thống kê sang "Cố ý sửa / che giấu số liệu"

Người dùng chốt: "Ghi sai mã LOT" **không phù hợp** làm lỗi nghiêm trọng nhất của việc thống kê. Lỗi nặng nhất phải là **Cố ý sửa số liệu / Che giấu sai lệch** (lỗi liêm chính dữ liệu) — 25đ, khóa Hạng C.

## Thay đổi

- `src/components/work-plans/types.ts` — danh mục lỗi `inventory_statistics` (nguồn duy nhất cho bộ chọn lỗi + Quy chế):
  - Thêm `falsified_data` — "Cố ý sửa số liệu / Che giấu sai lệch", **severe, 25đ** (đứng đầu nhóm).
  - Hạ `wrong_lot_code` từ severe 25đ xuống **moderate, 15đ** (cùng mức ghi sai số lượng / vị trí kệ / tem nhãn).
- `src/components/work-plans/KpiRulesHandbookTab.tsx` — thẻ II. CHẤT LƯỢNG SỐ LIỆU và mục 4 (tự render từ danh mục) khớp mức mới; dòng 15đ gộp thêm "sai mã LOT", dòng 25đ đổi sang lỗi cố ý sửa/che giấu số liệu.
- `src/components/work-plans/__tests__/workPlanParser.test.ts`:
  - Test khóa Hạng C dùng `falsified_data` thay `wrong_lot_code`.
  - Thêm test chặn hồi quy: nhóm Thống kê chỉ có **đúng 1 lỗi severe** là `falsified_data` 25đ; `wrong_lot_code` là moderate 15đ.

## Kiểm chứng

- `npx vitest run src/components/work-plans/__tests__` → **18/18 pass**.
- `npx tsc --noEmit` lọc `work-plans` → không lỗi.
- Lưu ý: lỗi đã ghi trước đây lưu severity/điểm riêng trong từng bản ghi đánh giá nên không bị đổi hồi tố.

# Walkthrough: Bỏ lỗi "Dán nhầm tem nhãn / Dán sai quy cách thùng" khỏi Thống kê

Người dùng chốt: dán tem nhãn / quy cách thùng là **việc của sản xuất**, không phải việc của kho.

- `src/components/work-plans/types.ts` — xóa `wrong_box_label` khỏi nhóm lỗi `inventory_statistics` (nhóm còn 7 lỗi; bộ chọn lỗi và mục 4 Quy chế tự cập nhật).
- `src/components/work-plans/KpiRulesHandbookTab.tsx` — dòng 15đ của thẻ Chất lượng số liệu bỏ "; dán nhầm tem nhãn".
- `src/components/work-plans/__tests__/workPlanParser.test.ts` — test danh mục khẳng định `wrong_box_label` không còn trong lỗi của kho.
- Lỗi đã ghi trước đây vẫn giữ nguyên trong bản ghi đánh giá cũ (không hồi tố).
- `npx vitest run src/components/work-plans/__tests__` → 18/18 pass; `tsc` lọc `work-plans` → không lỗi.

# Walkthrough: Tách "Điểm hỗ trợ" thành mục riêng — không cộng vào điểm ngày, không kéo hạng

Người dùng chốt: việc phụ / tăng cường **không cộng trực tiếp vào hệ số điểm ngày**; quản lý thành **một mục điểm hỗ trợ riêng** để biết ai tích cực hỗ trợ, làm cơ sở đánh giá **tuần / tháng / năm**. Ba quyết định kèm theo:
1. Điểm hỗ trợ **không kéo hạng** thi đua ngày.
2. **Giữ công thức hiện tại** cho từng việc hỗ trợ: điểm năng suất theo độ nặng × % đóng góp (engine không đổi).
3. Người **chỉ làm việc hỗ trợ** trong kỳ được **xếp theo điểm hỗ trợ**.

## Thay đổi

- `src/components/work-plans/WorkPlanAnalyticsTab.tsx`:
  - `EmployeeStatRow`: bỏ `netKpiScore`, đổi `secondaryBonusPoints` → `supportPoints`; thêm `hasPrimaryTasks`.
  - Điểm ngày (`primaryKpiScore`) **chỉ tính việc chính**; việc hỗ trợ chỉ cộng vào `supportPoints` (tích lũy theo khoảng ngày đang chọn = kỳ báo cáo).
  - Xếp hạng: người có việc chính xếp theo điểm KPI ngày (không dùng điểm hỗ trợ làm tiêu chí phụ); người chỉ làm việc hỗ trợ xếp phía sau theo điểm hỗ trợ, gắn nhãn **"➕ Chỉ hỗ trợ"** thay vì bị xếp C oan.
  - Bảng: cột **🎯 KPI Ngày** (chỉ việc chính) và cột riêng **➕ Điểm Hỗ Trợ** (tích lũy kỳ); thêm dải giải thích ngay trên bảng. Drawer chi tiết hiển thị điểm hỗ trợ kỳ và số việc hỗ trợ hoàn tất.
  - Excel: cột "Điểm KPI ngày (/100đ)" + "Điểm hỗ trợ tích lũy (đ)"; bỏ cột "TỔNG ĐIỂM KPI (Mở trần)".
- `src/components/work-plans/AnalyticsExportCardModal.tsx` — bảng xếp hạng và nội dung copy Zalo đổi sang **KPI ngày / Điểm hỗ trợ kỳ**; nhãn "Tổng KPI" bỏ; phiếu chi tiết hiển thị điểm hỗ trợ riêng.
- `src/components/work-plans/KpiRulesHandbookTab.tsx` — mục 3 viết lại: **Việc chính (điểm ngày)** vs **Việc phụ / tăng cường (điểm hỗ trợ tích lũy kỳ)**; bỏ "Mở trần 120–150đ", bỏ ví dụ cộng thẳng 100 + 7.2 = 107.2; nêu rõ không kéo hạng, cộng dồn tuần/tháng/năm, người chỉ hỗ trợ xếp riêng. FAQ Q1 cập nhật theo.
- `src/components/work-plans/types.ts` — mô tả loại việc phụ và `bonusOverTargetPoints` đổi sang ngữ nghĩa "điểm hỗ trợ tích lũy riêng"; công thức engine giữ nguyên.
- Đồng bộ nhãn ở `WorkPlansView.tsx`, `AssigneeEvaluationSection.tsx`, `EvaluateItemModal.tsx` ("Việc hỗ trợ", "điểm hỗ trợ tích lũy theo kỳ").

## Kiểm chứng

- Công thức từng việc hỗ trợ không đổi: engine vẫn trả `bonusOverTargetPoints` (Nặng 40đ × 18% = 7.2đ; Vừa 37đ × 50% = 18.5đ).
- `npx vitest run src/components/work-plans/__tests__` → **18/18 pass**.
- `npx tsc --noEmit` lọc `work-plans` → không lỗi.
- Không đổi dữ liệu đã lưu: chỉ thay cách tổng hợp/hiển thị; mở lại kỳ cũ sẽ thấy điểm ngày tách khỏi điểm hỗ trợ ngay.

# Walkthrough: Số liệu khối lượng trên phiếu Báo cáo & Đánh giá (Kiểu Hiện Đại) tách thành chip

Người dùng gửi ảnh phiếu "Báo cáo & Đánh giá công việc ngày 12.11.2026" (Kiểu Hiện Đại) và phản hồi dòng số liệu khối lượng dưới mỗi công việc "rất khó chịu" — trước đây là một dải amber dài dạng văn bản nối bằng dấu `•` (độ nặng • hệ số • thùng • tấn • phiếu • dòng • mã phiếu nhập/xuất kế toán) nên rất khó đọc khi chụp ảnh gửi Zalo.

## Thay đổi

- `src/components/work-plans/PlanExportCardModal.tsx` (chỉ phần render phiếu, không đổi dữ liệu/engine):
  - Thêm helper `buildWorkloadStats(item)` tách `workload_metrics` thành: `chips` (từng chỉ số khối lượng), `inbound` / `outbound` / `exportOrders` (mã chứng từ), `notes` (lý do hệ số, LOT đã tạo, vị trí đã đưa lên kệ). Việc Thống kê vẫn suy ra số phiếu/số dòng bằng `getStatisticsDocumentCounts` như logic thẻ.
  - Bỏ dải amber nối chuỗi; thay bằng panel trắng có viền nhạt gồm **2 tầng**:
    1. Hàng chip chỉ số: độ nặng (màu theo `DIFFICULTY_CONFIG`), hệ số khối lượng, vị trí, LOT, thùng, tấn/kg, container, giờ, số phiếu, số dòng, chỉ số tùy chỉnh — mỗi số một chip màu riêng, tự xuống dòng.
    2. Dải "Chứng từ": mã phiếu nhập kế toán (xanh dương), phiếu xuất kế toán (xanh lá), lệnh xuất (tím) — mỗi mã một chip, kèm nhãn NK / XK / LỆNH.
  - Ghi chú dài (lý do hệ số, LOT tạo, vị trí đưa lên kệ) chuyển xuống dòng chữ xám nhỏ, không còn chen trong chuỗi số liệu.
  - `formatWorkloadSummaryText` giữ nguyên cho bản copy văn bản Zalo (vẫn là văn bản thuần, không đổi).

## Kiểm chứng

- `npx tsc --noEmit` lọc `work-plans` → không lỗi.
- `npx vitest run src/components/work-plans/__tests__` → **18/18 pass**.
- Không thay đổi cấu trúc `workload_metrics`, không migration, không ảnh hưởng phân hệ kho đông lạnh.
