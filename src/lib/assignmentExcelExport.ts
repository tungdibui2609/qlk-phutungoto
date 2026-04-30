import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';

interface AssignmentHistoryExportData {
    systemName: string;
    dateRange: string;
    items: any[];
}

export async function exportAssignmentHistoryToExcel(data: AssignmentHistoryExportData) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Lich Su Gan Vi Tri');

    // 1. Set Columns
    worksheet.columns = [
        { header: 'STT', key: 'stt', width: 8 },
        { header: 'Lệnh SX', key: 'prodOrder', width: 15 },
        { header: 'Mã Lot SX', key: 'prodCode', width: 15 },
        { header: 'Mã Sản Phẩm', key: 'productSkus', width: 20 },
        { header: 'Mã LOT KHO', key: 'lotCode', width: 20 },
        { header: 'Sản Phẩm', key: 'productNames', width: 45 },
        { header: 'Số Lượng', key: 'quantity', width: 15 },
        { header: 'Quy đổi (Kg)', key: 'weightKg', width: 15 },
        { header: 'Vị Trí Mới', key: 'targetPos', width: 15 },
        { header: 'Loại', key: 'type', width: 15 },
        { header: 'Vị Trí Cũ', key: 'oldPos', width: 15 },
        { header: 'Ngày Sản Xuất', key: 'prodDate', width: 15 },
        { header: 'Ngày Duyệt', key: 'approveDate', width: 20 },
        { header: 'Trạng Thái', key: 'status', width: 15 },
    ];

    let currentRow = 1;

    // 2. Report Title
    const lastCol = String.fromCharCode(65 + worksheet.columns.length - 1);
    
    worksheet.mergeCells(`A${currentRow}:${lastCol}${currentRow}`);
    const titleCell = worksheet.getCell(`A${currentRow}`);
    titleCell.value = 'BÁO CÁO LỊCH SỬ DUYỆT GÁN VỊ TRÍ';
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center' };
    currentRow++;

    worksheet.mergeCells(`A${currentRow}:${lastCol}${currentRow}`);
    const systemCell = worksheet.getCell(`A${currentRow}`);
    systemCell.value = `Hệ thống: ${data.systemName}`;
    systemCell.alignment = { horizontal: 'center' };
    systemCell.font = { bold: true };
    currentRow++;

    worksheet.mergeCells(`A${currentRow}:${lastCol}${currentRow}`);
    const dateCell = worksheet.getCell(`A${currentRow}`);
    dateCell.value = `Thời gian: ${data.dateRange}`;
    dateCell.alignment = { horizontal: 'center' };
    dateCell.font = { italic: true };
    currentRow++;

    currentRow++; // Spacer

    // 3. Table Header
    const headerRow = worksheet.getRow(currentRow);
    headerRow.values = worksheet.columns.map(c => String(c.header || ''));
    headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '4472C4' }
        };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });
    currentRow++;

    // 4. Body Data
    data.items.forEach((item) => {
        const row = worksheet.addRow({
            stt: `#${item.lot_stt}`,
            prodOrder: item.lot?.production_order_code || '---',
            prodCode: item.lot?.production_lot_code || '---',
            productSkus: item.lot?.product_skus?.join(', ') || '---',
            lotCode: item.lot?.code || '---',
            productNames: item.lot?.product_names?.join(', ') || '---',
            quantity: item.lot?.quantity_display || '---',
            weightKg: item.lot?.total_weight_kg ? Number(item.lot.total_weight_kg).toLocaleString('vi-VN') : '---',
            targetPos: item.position?.code || '---',
            type: item.assignment_type === 'move' ? 'Di chuyển' : (item.assignment_type === 'new' ? 'Gán mới' : '---'),
            oldPos: item.old_position_code || (item.assignment_type === 'new' ? 'Sảnh' : '---'),
            prodDate: format(new Date(item.production_date), 'dd/MM/yyyy'),
            approveDate: format(new Date(item.created_at), 'dd/MM/yyyy HH:mm'),
            status: item.status === 'approved' || item.status.startsWith('approved') ? 'Đã duyệt' : 'Đã hủy'
        });

        row.eachCell((cell, colIdx) => {
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            // STT, Lệnh SX, Mã Lot SX, Mã SP, Mã LOT KHO, Số lượng, Quy đổi KG, TargetPos, Type, OldPos, ProdDate, ApproveDate, Status (Center align)
            // Column 6 (Product Names) is Left align
            if ([1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14].includes(colIdx)) {
                cell.alignment = { horizontal: 'center' };
            }
            
            // Color coding for Type (now at col 10)
            if (colIdx === 10) {
                if (item.assignment_type === 'move') {
                    cell.font = { color: { argb: '0070C0' }, bold: true };
                } else if (item.assignment_type === 'new') {
                    cell.font = { color: { argb: '00B050' }, bold: true };
                }
            }
        });
    });

    // 5. Save
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `Lich_su_gan_vi_tri_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    saveAs(new Blob([buffer]), fileName);
}
