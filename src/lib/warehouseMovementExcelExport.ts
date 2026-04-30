import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format, parseISO } from 'date-fns';

interface MovementExportData {
    systemName: string;
    dateRange: string;
    movements: any[];
}

export async function exportWarehouseMovementsToExcel(data: MovementExportData) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Nhat Ky So Do Kho');

    // 1. Set Columns
    worksheet.columns = [
        { header: 'Thời gian', key: 'time', width: 20 },
        { header: 'Hình thức', key: 'type', width: 15 },
        { header: 'Mã LOT', key: 'lotCode', width: 20 },
        { header: 'Vị trí', key: 'position', width: 15 },
        { header: 'Vị trí cũ (nếu có)', key: 'oldPosition', width: 20 },
        { header: 'Sản phẩm', key: 'productInfo', width: 45 },
        { header: 'Khối lượng (KG)', key: 'weightKg', width: 15 },
        { header: 'Người thực hiện', key: 'user', width: 20 },
    ];

    let currentRow = 1;

    // 2. Report Title
    const lastCol = String.fromCharCode(65 + worksheet.columns.length - 1);
    
    worksheet.mergeCells(`A${currentRow}:${lastCol}${currentRow}`);
    const titleCell = worksheet.getCell(`A${currentRow}`);
    titleCell.value = 'BÁO CÁO NHẬT KÝ SƠ ĐỒ KHO';
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
            fgColor: { argb: '2D3E50' }
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
    data.movements.forEach((m) => {
        const typeLabel = m.type === 'assigned' ? 'Nhập vị trí' : 
                          m.type === 'moved' ? 'Di chuyển' : 
                          m.type === 'exported' ? 'Xuất / Dọn ô' : 
                          m.type === 'replaced' ? 'Thay thế' : 'Khác';
        
        const productsInfo = m.lot?.products?.map((p: any) => `${p.sku}: ${p.name} (${p.quantity} ${p.unit})`).join('\n') || 
                            m.oldLot?.code || '---';

        const row = worksheet.addRow({
            time: format(parseISO(m.createdAt), 'dd/MM/yyyy HH:mm'),
            type: typeLabel,
            lotCode: m.lot?.code || m.oldLot?.code || '---',
            position: m.position?.code || '---',
            oldPosition: m.sourcePositionCode || '---',
            productInfo: productsInfo,
            weightKg: m.lot?.totalWeightKg || 0,
            user: m.performedBy?.fullName || 'Hệ thống'
        });

        row.alignment = { wrapText: true, vertical: 'middle' };

        row.eachCell((cell, colIdx) => {
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            if ([1, 2, 4, 5, 7, 8].includes(colIdx)) {
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            }
            
            // Color coding for Type
            if (colIdx === 2) {
                if (m.type === 'assigned') cell.font = { color: { argb: '10B981' }, bold: true };
                else if (m.type === 'moved') cell.font = { color: { argb: '3B82F6' }, bold: true };
                else if (m.type === 'exported') cell.font = { color: { argb: 'F43F5E' }, bold: true };
                else if (m.type === 'replaced') cell.font = { color: { argb: 'F59E0B' }, bold: true };
            }
        });
    });

    // 5. Save
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `Nhat_ky_so_do_kho_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    saveAs(new Blob([buffer]), fileName);
}
