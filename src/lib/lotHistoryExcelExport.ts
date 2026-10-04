import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { decodeSTT } from './numberUtils';

interface LotHistoryExportData {
    systemName: string;
    dateRange: string;
    lots: any[];
}

export async function exportLotHistoryToExcel(data: LotHistoryExportData) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Nhat Ky LOT');

    // 1. Set Columns
    worksheet.columns = [
        { header: 'Thời gian', key: 'time', width: 18 },
        { header: 'Trạng thái', key: 'status', width: 16 },
        { header: 'Mã LOT', key: 'code', width: 18 },
        { header: 'STT', key: 'dailySeq', width: 10 },
        { header: 'Lệnh SX', key: 'prodOrder', width: 16 },
        { header: 'Lô SX', key: 'batchCode', width: 16 },
        { header: 'Chi tiết sản phẩm', key: 'products', width: 40 },
        { header: 'Số lượng', key: 'quantity', width: 14 },
        { header: 'Vị trí', key: 'position', width: 14 },
        { header: 'Hình thức', key: 'action', width: 22 },
        { header: 'Nhà cung cấp', key: 'supplier', width: 25 },
    ];

    let currentRow = 1;

    // 2. Report Title
    const lastCol = String.fromCharCode(65 + worksheet.columns.length - 1);

    worksheet.mergeCells(`A${currentRow}:${lastCol}${currentRow}`);
    const titleCell = worksheet.getCell(`A${currentRow}`);
    titleCell.value = 'BÁO CÁO NHẬT KÝ XUẤT NHẬP LOT';
    titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFF' } };
    titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'EA580C' } // Orange 600
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(currentRow).height = 36;
    currentRow++;

    worksheet.mergeCells(`A${currentRow}:${lastCol}${currentRow}`);
    const systemCell = worksheet.getCell(`A${currentRow}`);
    systemCell.value = `Hệ thống: ${data.systemName}`;
    systemCell.alignment = { horizontal: 'center', vertical: 'middle' };
    systemCell.font = { bold: true, size: 11 };
    currentRow++;

    worksheet.mergeCells(`A${currentRow}:${lastCol}${currentRow}`);
    const dateCell = worksheet.getCell(`A${currentRow}`);
    dateCell.value = `Khoảng thời gian: ${data.dateRange} | Tổng số bản ghi: ${data.lots.length}`;
    dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
    dateCell.font = { italic: true, size: 10 };
    currentRow++;

    currentRow++; // Spacer

    // 3. Table Header
    const headerRow = worksheet.getRow(currentRow);
    headerRow.values = worksheet.columns.map(c => String(c.header || ''));
    headerRow.height = 28;
    headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '1E293B' } // Slate 800
        };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });
    currentRow++;

    // 4. Data Rows
    data.lots.forEach(lot => {
        const actionData = lot._actionData || {};
        const displayDate = actionData.date || lot.created_at;
        const timeStr = displayDate ? format(new Date(displayDate), 'dd/MM/yyyy HH:mm') : '-';

        // Products info & quantity
        let productsStr = '';
        let qtyStr = '';

        if (actionData.type === 'export' && lot.metadata?.system_history?.exports) {
            const lastExport = lot.metadata.system_history.exports[lot.metadata.system_history.exports.length - 1];
            if (lastExport?.items) {
                const items = Object.values(lastExport.items) as any[];
                productsStr = items.map(it => `${it.product_sku ? `[${it.product_sku}] ` : ''}${it.product_name || 'SP'}`).join('\n');
                qtyStr = items.map(it => `${it.exported_quantity || 0} ${it.unit || ''}`).join('\n');
            }
        } else if (lot.lot_items && lot.lot_items.length > 0) {
            productsStr = lot.lot_items.map((it: any) => `${it.products?.sku ? `[${it.products.sku}] ` : ''}${it.products?.name || 'SP'}`).join('\n');
            qtyStr = lot.lot_items.map((it: any) => `${it.quantity || 0} ${it.unit || it.products?.unit || ''}`).join('\n');
        } else {
            productsStr = `${lot.products?.sku ? `[${lot.products.sku}] ` : ''}${lot.products?.name || '-'}`;
            qtyStr = `${lot.quantity || 0} ${lot.products?.unit || ''}`;
        }

        const positionsStr = lot.positions && lot.positions.length > 0
            ? lot.positions.map((p: any) => p.code).join(', ')
            : 'Chưa gán';

        const statusText = lot._isDeleted || lot.status === 'deleted' ? 'ĐÃ XÓA' :
                           lot.status === 'exported' ? 'Đã xuất bán' : 'Còn trong kho';

        const row = worksheet.addRow({
            time: timeStr,
            status: statusText,
            code: lot.code || '-',
            dailySeq: lot.daily_seq ? decodeSTT(lot.daily_seq) : '-',
            prodOrder: lot.productions?.code || lot.production_code || '-',
            batchCode: lot.batch_code || lot.metadata?.batch_code || '-',
            products: productsStr || '-',
            quantity: qtyStr || '-',
            position: positionsStr,
            action: actionData.label || 'Tạo mới',
            supplier: lot.suppliers?.name || '-'
        });

        row.alignment = { wrapText: true, vertical: 'middle' };

        row.eachCell((cell, colIdx) => {
            cell.border = {
                top: { style: 'thin', color: { argb: 'E2E8F0' } },
                left: { style: 'thin', color: { argb: 'E2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
                right: { style: 'thin', color: { argb: 'E2E8F0' } }
            };

            // Center align specific columns
            if ([1, 2, 3, 4, 5, 7, 8].includes(colIdx)) {
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            }
        });
    });

    // 5. Save file
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `Nhat_ky_xuat_nhap_LOT_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    saveAs(new Blob([buffer]), fileName);
}
