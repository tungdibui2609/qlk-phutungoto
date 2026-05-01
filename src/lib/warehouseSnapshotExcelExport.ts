import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format, parseISO } from 'date-fns';

interface SnapshotExportData {
    systemName: string;
    dateRange: string;
    movements: any[];
}

export async function exportWarehouseSnapshotToExcel(data: SnapshotExportData) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Dien Bien Kho Sach');

    // 1. Định nghĩa các cột phục vụ nhập liệu (Data Entry)
    worksheet.columns = [
        { header: 'STT', key: 'stt', width: 8 },
        { header: 'Mã LOT (Pallet)', key: 'lotCode', width: 25 },
        { header: 'Vị trí hiện tại', key: 'position', width: 20 },
        { header: 'Trạng thái cuối', key: 'status', width: 25 },
        { header: 'Lệnh sản xuất', key: 'prodOrder', width: 20 },
        { header: 'Mã sản phẩm', key: 'sku', width: 20 },
        { header: 'Tên sản phẩm', key: 'name', width: 40 },
        { header: 'Số lượng', key: 'quantity', width: 12 },
        { header: 'ĐVT', key: 'unit', width: 15 },
        { header: 'Tổng khối lượng (KG)', key: 'totalWeight', width: 20 },
        { header: 'Cập nhật cuối lúc', key: 'updatedAt', width: 25 },
        { header: 'Người thực hiện', key: 'user', width: 25 },
    ];

    let currentRow = 1;
    const lastCol = String.fromCharCode(65 + worksheet.columns.length - 1);

    // 2. Tiêu đề báo cáo
    worksheet.mergeCells(`A${currentRow}:${lastCol}${currentRow}`);
    const titleCell = worksheet.getCell(`A${currentRow}`);
    titleCell.value = 'BÁO CÁO DIỄN BIẾN KHO (DANH SÁCH LOT DUY NHẤT)';
    titleCell.font = { bold: true, size: 16, color: { argb: 'C2410C' } }; // Màu cam đậm
    titleCell.alignment = { horizontal: 'center' };
    currentRow++;

    worksheet.mergeCells(`A${currentRow}:${lastCol}${currentRow}`);
    const systemCell = worksheet.getCell(`A${currentRow}`);
    systemCell.value = `Hệ thống: ${data.systemName} | Dữ liệu tổng hợp từ: ${data.dateRange}`;
    systemCell.alignment = { horizontal: 'center' };
    systemCell.font = { italic: true, size: 11 };
    currentRow++;

    currentRow++; // Dòng trống

    // 3. Header Table
    const headerRow = worksheet.getRow(currentRow);
    headerRow.values = worksheet.columns.map(c => String(c.header || ''));
    headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'C2410C' } // Cam đồng bộ với UI
        };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });
    currentRow++;

    // 4. Đổ dữ liệu (Đã được lọc Unique LOT từ phía UI)
    data.movements.forEach((m, index) => {
        const lotObj = m.lot || m.oldLot;
        const products = m.lot?.products || m.oldLot?.products || [];
        
        // Tách dữ liệu ra các chuỗi xuống dòng
        const skus = products.map((p: any) => p.sku).join('\n') || '---';
        const names = products.map((p: any) => p.name).join('\n') || '---';
        const quantities = products.map((p: any) => p.quantity).join('\n') || '---';
        const units = products.map((p: any) => p.unit).join('\n') || '---';
        
        let statusText = '';
        if (m.type === 'exported') statusText = `Gỡ vị trí (Từ ${m.position.code})`;
        else if (m.type === 'assigned') statusText = `Đang ở ${m.position.code}`;
        else if (m.type === 'moved') statusText = `Đã dời tới ${m.position.code}`;
        else if (m.type === 'replaced') statusText = `Thay thế tại ${m.position.code}`;
        else statusText = 'Khác';

        const row = worksheet.addRow({
            stt: index + 1,
            lotCode: lotObj?.code || '---',
            position: m.type === 'exported' ? 'CHƯA GÁN' : m.position.code,
            status: statusText,
            prodOrder: lotObj?.productionOrderCode || '---',
            sku: skus,
            name: names,
            quantity: quantities,
            unit: units,
            totalWeight: lotObj?.totalWeightKg || 0,
            updatedAt: format(parseISO(m.createdAt), 'dd/MM/yyyy HH:mm'),
            user: m.performedBy?.fullName || 'Hệ thống'
        });

        // Định dạng dòng
        row.alignment = { vertical: 'middle', wrapText: true };
        row.eachCell((cell, colIdx) => {
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            
            // Căn giữa các cột mã và số (STT, Mã LOT, Vị trí, Mã SP, SL, ĐVT, Khối lượng)
            if ([1, 2, 3, 5, 6, 8, 9, 10].includes(colIdx)) {
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            }
        });
    });

    // 5. Xuất file
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `Dien_bien_kho_sach_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    saveAs(new Blob([buffer]), fileName);
}
