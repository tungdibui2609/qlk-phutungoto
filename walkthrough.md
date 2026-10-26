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

## ⏭ Hạng Mục Tạm Hoãn (theo yêu cầu)

4 điểm lệch ở phía sổ kế toán đã ghi nhận nhưng **chưa xử lý**, chờ quyết định: lỗi tìm kiếm theo danh mục ở `route.ts:376`, cảnh báo lệch danh mục nhập/xuất, `product_category_rel` chưa được tab kế toán dùng, và việc thiếu danh mục trên bảng `lots`.
