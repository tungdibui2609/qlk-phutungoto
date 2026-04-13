# TODO: Thêm menu "In tem" cho Export Order

## ✅ Completed (0/8)

## ⏳ In Progress (0/8)

## 📋 Pending Steps (8/8)

### 1. ✅ Tạo print page mới `src/app/print/export-lot/page.tsx`
   - **Hoàn thành**: File created với full config form, 90x60mm template, data từ lots + lot_items + export_tasks
   - Test: `http://localhost:3000/print/export-lot?id={lotId}&export_order_id={taskId}`

   - Copy structure từ `src/app/print/production-lot/page.tsx`
   - Thay đổi data source: `lots` + `lot_items` + `export_tasks` (join via lot_id)
   - Template: LSX → Export Order Code, thêm customer_name
   - Size: 90x60mm label, config tương tự (start_index, label_count)

### 2. ✅ Thêm Context Menu vào `ExportMapList.tsx`
   - **Hoàn thành**: Added `onContextMenu` to item divs, logs lotIds on right-click
   - Next: Connect to full menu component in step 3
   - Position div: `onContextMenu={(e) => handleContextMenu(e, posItems.map(i=>i.lot_id))}`
   - Menu state: `[contextMenu, setContextMenu] = useState({visible: false, x, y, lotIds})`
   - Menu items: Hạ sảnh, Xuất kho, Sửa ngày, **In tem** (new)

### 3. ✅ Update `work/export-order/[id]/page.tsx`
   - **Hoàn thành**: Added emerald "In tem" button in floating bar
   - Logic: Prints first selected lot_id, passes export_order_id
   - Ready to test!
   - Floating bar: Thêm button "In tem" gọi `window.open(/print/export-lot?id=${firstLotId}&type=label)`
   - Pass export_order_code qua query params

### 4. [ ] Tạo `LotLabelExport.tsx` component (optional)
   - Shared label template giữa production/export
   - Props: lotData, printConfig, type='export'

### 5. [ ] DB Migration (if needed)
   ```sql
   ALTER TABLE lots ADD COLUMN IF NOT EXISTS total_printed_labels INTEGER DEFAULT 0;
   ALTER TABLE lots ADD COLUMN IF NOT EXISTS damaged_printed_labels INTEGER DEFAULT 0;
   ```

### 6. [ ] Test single lot print
   - Chọn 1 position → Right-click → In tem
   - Verify tem prints đúng size, data

### 7. [ ] Test với selection multiple
   - Print first lot_id, console.log others for batch

### 8. [ ] Polish & Completion
   - Update TODO.md ✅ all
   - Test full flow localhost:3000/work/export-order/{id}
   - `attempt_completion`

**Current step: 1/8 - Tạo export-lot print page**

