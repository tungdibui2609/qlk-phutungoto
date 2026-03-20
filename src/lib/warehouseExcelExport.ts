import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface ExcelPosition {
    code: string;
    warehouse?: string;
    row?: string;
    bin?: string;
    level?: string;
    subPosition?: string;
    lotCode?: string;
    productName?: string;
    sku?: string;
    unit?: string;
    quantity?: number;
    kgQuantity?: number | null;
    tags?: string;
    notes?: string;
}

interface ExportWarehouseData {
    systemName: string;
    zoneName?: string;
    searchTerm?: string;
    positions: ExcelPosition[];
}

export interface ExportOrderExcelData {
    order: {
        code: string;
        created_at: string;
        notes?: string | null;
    };
    items: Array<{
        id: string;
        quantity: number;
        unit: string | null;
        product_name: string;
        sku: string;
        lot_code?: string;
        position_code?: string;
        inbound_date?: string;
        notes?: string;
        quyCach?: string;
        convertedQty?: number | string;
    }>;
    companyInfo: any;
    editableFields: {
        customerSupplierName: string;
        customerSupplierAddress: string;
        reasonDescription: string;
        warehouse: string;
        location: string;
        note: string;
        day: string;
        month: string;
        year: string;
        vehicleNumber?: string;
        containerNumber?: string;
        sealNumber?: string;
        signatures: Array<{ title: string; name: string }>;
    };
}

export async function exportWarehouseToExcel(data: ExportWarehouseData) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sơ đồ kho');

    // 1. Cấu hình cột
    worksheet.columns = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Kho', key: 'warehouse', width: 15 },
        { header: 'Dãy', key: 'row', width: 15 },
        { header: 'Ô / Khu vực', key: 'bin', width: 15 },
        { header: 'Tầng', key: 'level', width: 12 },
        { header: 'Vị trí', key: 'subPosition', width: 10 },
        { header: 'Mã vị trí', key: 'code', width: 20 },
        { header: 'Số lô (Lot)', key: 'lotCode', width: 20 },
        { header: 'Sản phẩm', key: 'productName', width: 40 },
        { header: 'Mã SP (SKU)', key: 'sku', width: 20 },
        { header: 'ĐVT', key: 'unit', width: 10 },
        { header: 'Số lượng', key: 'quantity', width: 12 },
        { header: 'Quy đổi (Kg)', key: 'kgQuantity', width: 15 },
        { header: 'Mã phụ / Tags', key: 'tags', width: 30 },
        { header: 'Ghi chú', key: 'notes', width: 30 },
    ];

    // 2. Header công ty / Tiêu đề báo cáo
    worksheet.mergeCells('A1:O1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'BÁO CÁO CHI TIẾT SƠ ĐỒ KHO';
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.mergeCells('A2:O2');
    const infoCell = worksheet.getCell('A2');
    infoCell.value = `Kho: ${data.systemName}${data.zoneName ? ` | Khu vực: ${data.zoneName}` : ''} | Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`;
    infoCell.alignment = { horizontal: 'center' };

    if (data.searchTerm) {
        worksheet.mergeCells('A3:O3');
        const filterCell = worksheet.getCell('A3');
        filterCell.value = `Lọc theo: "${data.searchTerm}"`;
        filterCell.alignment = { horizontal: 'center' };
        filterCell.font = { italic: true };
    }

    // 3. Định dạng Header bảng (Row 5)
    const headerRowIdx = data.searchTerm ? 5 : 4;
    const headerRow = worksheet.getRow(headerRowIdx);
    
    // Copy headers to the specific row
    ['STT', 'Kho', 'Dãy', 'Ô / Khu vực', 'Tầng', 'Vị trí', 'Mã vị trí', 'Số lô (Lot)', 'Sản phẩm', 'Mã SP (SKU)', 'ĐVT', 'Số lượng', 'Quy đổi (Kg)', 'Mã phụ / Tags', 'Ghi chú'].forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true, color: { argb: 'FFFFFF' } };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '4F46E5' } // Indigo-600 appearance
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });

    // Kích hoạt AutoFilter cho các cột từ A đến O tại dòng header
    worksheet.autoFilter = {
        from: { row: headerRowIdx, column: 1 },
        to: { row: headerRowIdx, column: 15 }
    };

    // 4. Đổ dữ liệu
    let currentRowIdx = headerRowIdx + 1;
    data.positions.forEach((pos, index) => {
        const row = worksheet.getRow(currentRowIdx);
        
        row.getCell(1).value = index + 1;
        row.getCell(2).value = pos.warehouse || '';
        row.getCell(3).value = pos.row || '';
        row.getCell(4).value = pos.bin || '';
        row.getCell(5).value = pos.level || '';
        row.getCell(6).value = pos.subPosition || '';
        row.getCell(7).value = pos.code;
        row.getCell(8).value = pos.lotCode || '(Trống)';
        row.getCell(9).value = pos.productName || '';
        row.getCell(10).value = pos.sku || '';
        row.getCell(11).value = pos.unit || '';
        const q = Number(pos.quantity) || 0;
        row.getCell(12).value = Math.round(q * 1000) / 1000;
        const kgQ = pos.kgQuantity !== null && pos.kgQuantity !== undefined ? Number(pos.kgQuantity) : null;
        row.getCell(13).value = kgQ !== null ? Math.round(kgQ * 1000) / 1000 : '-';
        row.getCell(14).value = pos.tags || '';
        row.getCell(15).value = pos.notes || '';

        // Định dạng style cho row dữ liệu
        for (let i = 1; i <= 15; i++) {
            const cell = row.getCell(i);
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            if (i === 1 || [2, 3, 4, 5, 6, 7].includes(i) || i === 11) {
                cell.alignment = { horizontal: 'center' };
            }
            if (i === 12 || i === 13) {
                cell.alignment = { horizontal: 'right' };
                // Conditional format: No decimals for integers, up to 2 for others
                const val = typeof cell.value === 'number' ? cell.value : null;
                if (val !== null) {
                    if (Math.floor(val) === val) {
                        cell.numFmt = '#,##0';
                    } else {
                        cell.numFmt = '#,##0.##';
                    }
                }
            }
            if (!pos.lotCode) {
                cell.font = { italic: true, color: { argb: '9CA3AF' } }; // Gray-400
            }
        }

        currentRowIdx++;
    });

    // 5. Dòng tổng kết
    const totalRow = worksheet.getRow(currentRowIdx);
    totalRow.getCell(1).value = 'TỔNG CỘNG';
    worksheet.mergeCells(`A${currentRowIdx}:K${currentRowIdx}`);
    totalRow.getCell(1).font = { bold: true };
    totalRow.getCell(1).alignment = { horizontal: 'center' };

    // Total Quantity
    const totalQty = data.positions.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
    const roundedTotal = Math.round(totalQty * 1000) / 1000;
    totalRow.getCell(12).value = roundedTotal;
    totalRow.getCell(12).font = { bold: true };
    if (Math.floor(roundedTotal) === roundedTotal) {
        totalRow.getCell(12).numFmt = '#,##0';
    } else {
        totalRow.getCell(12).numFmt = '#,##0.##';
    }
    totalRow.getCell(12).alignment = { horizontal: 'right' };

    // Total Kg
    const totalKg = data.positions.reduce((sum, p) => sum + (Number(p.kgQuantity) || 0), 0);
    const roundedTotalKg = Math.round(totalKg * 1000) / 1000;
    totalRow.getCell(13).value = totalKg > 0 ? roundedTotalKg : '-';
    totalRow.getCell(13).font = { bold: true };
    if (totalKg > 0) {
        if (Math.floor(roundedTotalKg) === roundedTotalKg) {
            totalRow.getCell(13).numFmt = '#,##0';
        } else {
            totalRow.getCell(13).numFmt = '#,##0.##';
        }
    }
    totalRow.getCell(13).alignment = { horizontal: 'right' };

    // ==========================================
    // 6. Sheet 2: Báo cáo tổng hợp số lượng (Aggregation)
    // ==========================================
    const summarySheet = workbook.addWorksheet('Báo cáo tổng hợp');
    
    summarySheet.columns = [
        { header: 'STT', key: 'stt', width: 8 },
        { header: 'Mã sản phẩm', key: 'sku', width: 20 },
        { header: 'Tên sản phẩm', key: 'productName', width: 50 },
        { header: 'Đơn vị', key: 'unit', width: 15 },
        { header: 'Số lượng', key: 'totalQuantity', width: 15 },
        { header: 'Quy đổi (Kg)', key: 'totalKg', width: 15 },
    ];

    // Header Title for Summary Sheet
    summarySheet.mergeCells('A1:F1');
    const sTitle = summarySheet.getCell('A1');
    sTitle.value = 'BÁO CÁO TỔNG HỢP SỐ LƯỢNG HÀNG HÓA';
    sTitle.font = { bold: true, size: 16 };
    sTitle.alignment = { horizontal: 'center' };

    summarySheet.mergeCells('A2:F2');
    const sInfo = summarySheet.getCell('A2');
    sInfo.value = `Kho: ${data.systemName} | Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`;
    sInfo.alignment = { horizontal: 'center' };

    // Grouping logic
    const summaryMap = new Map<string, { sku: string, name: string, unit: string, qty: number, kg: number }>();
    data.positions.forEach(p => {
        if (!p.sku || !p.productName) return;
        const key = `${p.sku}_${p.unit}`;
        const existing = summaryMap.get(key);
        if (existing) {
            existing.qty += (Number(p.quantity) || 0);
            existing.kg += (Number(p.kgQuantity) || 0);
        } else {
            summaryMap.set(key, {
                sku: p.sku,
                name: p.productName,
                unit: p.unit || '',
                qty: (Number(p.quantity) || 0),
                kg: (Number(p.kgQuantity) || 0)
            });
        }
    });

    // Header Row (Row 4)
    const sHeaderRow = summarySheet.getRow(4);
    ['STT', 'Mã sản phẩm', 'Tên sản phẩm', 'Đơn vị', 'Số lượng', 'Quy đổi (Kg)'].forEach((h, i) => {
        const cell = sHeaderRow.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true, color: { argb: 'FFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4F46E5' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    let sRowIdx = 5;
    let sStt = 1;
    summaryMap.forEach((val) => {
        const row = summarySheet.getRow(sRowIdx);
        row.getCell(1).value = sStt++;
        row.getCell(2).value = val.sku;
        row.getCell(3).value = val.name;
        row.getCell(4).value = val.unit;
        
        const q = Math.round(val.qty * 1000) / 1000;
        row.getCell(5).value = q;
        row.getCell(5).numFmt = Math.floor(q) === q ? '#,##0' : '#,##0.##';
        
        const k = Math.round(val.kg * 1000) / 1000;
        row.getCell(6).value = k > 0 ? k : '-';
        if (k > 0) row.getCell(6).numFmt = Math.floor(k) === k ? '#,##0' : '#,##0.##';

        // Styling
        for (let i = 1; i <= 6; i++) {
            const cell = row.getCell(i);
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            if ([1, 2, 4].includes(i)) cell.alignment = { horizontal: 'center' };
            if ([5, 6].includes(i)) cell.alignment = { horizontal: 'right' };
        }
        sRowIdx++;
    });

    // Total Row for Summary Sheet
    const sTotalRow = summarySheet.getRow(sRowIdx);
    sTotalRow.getCell(1).value = 'TỔNG CỘNG';
    summarySheet.mergeCells(`A${sRowIdx}:D${sRowIdx}`);
    sTotalRow.getCell(1).font = { bold: true };
    sTotalRow.getCell(1).alignment = { horizontal: 'center' };
    
    const sSumQty = Array.from(summaryMap.values()).reduce((sum, v) => sum + v.qty, 0);
    const sSumKg = Array.from(summaryMap.values()).reduce((sum, v) => sum + v.kg, 0);

    const rSumQty = Math.round(sSumQty * 1000) / 1000;
    const rSumKg = Math.round(sSumKg * 1000) / 1000;

    sTotalRow.getCell(5).value = rSumQty;
    sTotalRow.getCell(5).font = { bold: true };
    sTotalRow.getCell(5).numFmt = Math.floor(rSumQty) === rSumQty ? '#,##0' : '#,##0.##';
    sTotalRow.getCell(5).alignment = { horizontal: 'right' };

    sTotalRow.getCell(6).value = rSumKg > 0 ? rSumKg : '-';
    sTotalRow.getCell(6).font = { bold: true };
    if (rSumKg > 0) sTotalRow.getCell(6).numFmt = Math.floor(rSumKg) === rSumKg ? '#,##0' : '#,##0.##';
    sTotalRow.getCell(6).alignment = { horizontal: 'right' };

    for (let i = 1; i <= 6; i++) {
        const cell = sTotalRow.getCell(i);
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `So_do_kho_${data.systemName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    saveAs(new Blob([buffer]), fileName);
}

interface GridCellData {
    binIndex: number;
    levelIndex: number;
    items: Array<{
        productName: string;
        sku: string;
        unit: string;
        quantity: number;
        kgQuantity?: number | null;
        lotCode?: string;
    }>;
    isMerged?: boolean;
    rowSpan?: number;
}

interface ExportWarehouseGridData {
    systemName: string;
    zoneName?: string;
    grids: Array<{
        name: string;
        bins: string[];
        levels: string[];
        cells: GridCellData[];
    }>;
}

export async function exportWarehouseGridToExcel(data: ExportWarehouseGridData) {
    const workbook = new ExcelJS.Workbook();
    
    data.grids.forEach((grid, gridIdx) => {
        const sheetName = grid.name.replace(/[:\\/?*[\]]/g, '_').slice(0, 31) || `Sheet ${gridIdx + 1}`;
        const worksheet = workbook.addWorksheet(sheetName);

        // Header Title
        worksheet.mergeCells(1, 1, 1, grid.bins.length + 1);
        const titleCell = worksheet.getCell(1, 1);
        titleCell.value = 'SƠ ĐỒ BỐ TRÍ MẶT BẰNG KHO';
        titleCell.font = { bold: true, size: 20, color: { argb: '1E293B' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getRow(1).height = 40;

        // Sub-title Info
        worksheet.mergeCells(2, 1, 2, grid.bins.length + 1);
        const subTitleCell = worksheet.getCell(2, 1);
        subTitleCell.value = `Hệ thống: ${data.systemName} | Dãy: ${grid.name} | Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`;
        subTitleCell.font = { size: 12, color: { argb: '475569' } };
        subTitleCell.alignment = { horizontal: 'center' };
        worksheet.getRow(2).height = 20;

        // Column headers (Bins)
        const headerRowIdx = 4;
        grid.bins.forEach((binName, colIdx) => {
            const cell = worksheet.getCell(headerRowIdx, colIdx + 2);
            cell.value = binName;
            cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F172A' } }; // Slate-900
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                top: { style: 'medium' },
                left: { style: 'thin' },
                bottom: { style: 'medium' },
                right: { style: 'thin' }
            };
            worksheet.getColumn(colIdx + 2).width = 30;
        });

        // Row headers (Levels)
        grid.levels.forEach((levelName, rowIdx) => {
            const cell = worksheet.getCell(headerRowIdx + rowIdx + 1, 1);
            cell.value = levelName;
            cell.font = { bold: true, size: 10 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } }; // Slate-100
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'medium' },
                bottom: { style: 'thin' },
                right: { style: 'medium' }
            };
            worksheet.getRow(headerRowIdx + rowIdx + 1).height = 60;
        });
        worksheet.getColumn(1).width = 15;

        // Fill cells
        grid.cells.forEach(cellData => {
            const excelRowIdx = headerRowIdx + cellData.levelIndex + 1;
            const excelColIdx = cellData.binIndex + 2;
            const cell = worksheet.getCell(excelRowIdx, excelColIdx);

            if (cellData.items.length > 0) {
                const richText: any[] = [];
                cellData.items.forEach((item: any, idx: number) => {
                    const roundedQty = Math.round((Number(item.quantity) || 0) * 1000) / 1000;
                    const kgQ = item.kgQuantity !== null && item.kgQuantity !== undefined ? Number(item.kgQuantity) : null;
                    const roundedKg = kgQ !== null ? Math.round(kgQ * 1000) / 1000 : null;
                    
                    richText.push({ text: `● ${item.productName}`, font: { bold: true, size: 9, color: { argb: '1E293B' } } });
                    richText.push({ text: ` (${item.sku})\n`, font: { size: 8, color: { argb: '64748B' } } }); 
                    richText.push({ text: `   SL: ${roundedQty} ${item.unit}`, font: { size: 9, color: { argb: '334155' } } });
                    
                    if (roundedKg !== null) {
                        richText.push({ text: ` ~ ${roundedKg} Kg`, font: { size: 9, italic: true, color: { argb: '2563EB' } } }); // Blue-600
                    }
                    
                    if (item.lotCode) {
                        richText.push({ text: `\n   Lô: ${item.lotCode}`, font: { size: 8, color: { argb: '94A3B8' } } });
                    }

                    if (idx < cellData.items.length - 1) {
                        richText.push({ text: '\n────────────────\n', font: { size: 6, color: { argb: 'E2E8F0' } } });
                    }
                });

                cell.value = { richText };
                cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left', indent: 1 };
            } else {
                cell.value = 'Trống';
                cell.font = { italic: true, color: { argb: 'CBD5E1' }, size: 9 };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }

            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };

            // Handle Vertical Merging (Gộp tầng)
            if (cellData.isMerged && cellData.rowSpan && cellData.rowSpan > 1) {
                try {
                    worksheet.mergeCells(excelRowIdx, excelColIdx, excelRowIdx + cellData.rowSpan - 1, excelColIdx);
                } catch (e) {
                    // Ignore overlapping merge errors
                }
            }
        });

        // Dynamic row height adjustment
        grid.levels.forEach((_, rowIdx) => {
            const row = worksheet.getRow(headerRowIdx + rowIdx + 1);
            let maxItemsInRow = 1;
            grid.cells.filter(c => c.levelIndex === rowIdx).forEach(c => {
                if (c.items.length > maxItemsInRow) maxItemsInRow = c.items.length;
            });
            // Estimate height: base 40 + ~35 per item block
            row.height = Math.max(45, maxItemsInRow * 38);
        });

        // Add Legend or Footer info if needed
        const footerRowIdx = headerRowIdx + grid.levels.length + 2;
        const footerCell = worksheet.getCell(footerRowIdx, 1);
        footerCell.value = '* Chú thích: ● Tên hàng (SKU) | SL: Số lượng | ~ Kg: Quy đổi khối lượng | Lô: Mã lô hàng';
        footerCell.font = { italic: true, size: 9, color: { argb: '64748B' } };
        worksheet.mergeCells(footerRowIdx, 1, footerRowIdx, 5);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `So_do_kho_Grid_${data.systemName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    saveAs(new Blob([buffer]), fileName);
}

export async function exportExportOrderToExcel(data: ExportOrderExcelData) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Lệnh xuất kho');

    // 1. Cấu hình cột
    worksheet.columns = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Mã LOT', key: 'lotCode', width: 22 },
        { header: 'Vị trí', key: 'position', width: 18 },
        { header: 'Mã SP (SKU)', key: 'sku', width: 18 },
        { header: 'Sản phẩm', key: 'productName', width: 40 },
        { header: 'Số lượng', key: 'quantity', width: 12 },
        { header: 'ĐVT', key: 'unit', width: 10 },
        { header: 'Quy cách', key: 'quyCach', width: 15 },
        { header: 'Ghi chú', key: 'notes', width: 25 },
    ];

    // 2. Header công ty
    if (data.companyInfo) {
        worksheet.mergeCells('A1:E1');
        const nameCell = worksheet.getCell('A1');
        nameCell.value = data.companyInfo.name?.toUpperCase();
        nameCell.font = { bold: true, size: 11 };

        worksheet.mergeCells('A2:E2');
        const addrCell = worksheet.getCell('A2');
        addrCell.value = `Địa chỉ: ${data.companyInfo.address || ''}`;
        addrCell.font = { size: 10 };

        worksheet.mergeCells('A3:E3');
        const contactCell = worksheet.getCell('A3');
        contactCell.value = `ĐT: ${data.companyInfo.phone || ''} | Email: ${data.companyInfo.email || ''}`;
        contactCell.font = { size: 10 };
    }

    // 3. Tiêu đề Lệnh xuất kho
    worksheet.mergeCells('A5:I5');
    const titleCell = worksheet.getCell('A5');
    titleCell.value = 'LỆNH XUẤT KHO';
    titleCell.font = { bold: true, size: 18 };
    titleCell.alignment = { horizontal: 'center' };

    worksheet.mergeCells('A6:I6');
    const dateCell = worksheet.getCell('A6');
    dateCell.value = `Ngày ${data.editableFields.day} tháng ${data.editableFields.month} năm ${data.editableFields.year}`;
    dateCell.alignment = { horizontal: 'center' };
    dateCell.font = { italic: true };

    worksheet.mergeCells('A7:I7');
    const codeCell = worksheet.getCell('A7');
    codeCell.value = `Số: ${data.order.code}`;
    codeCell.alignment = { horizontal: 'center' };
    codeCell.font = { bold: true, color: { argb: 'FF0000' } };

    // 4. Thông tin chung
    let currRow = 9;
    const addInfo = (label: string, value: string, mergeCols = 8) => {
        const row = worksheet.getRow(currRow);
        row.getCell(1).value = label;
        row.getCell(2).value = value;
        row.getCell(2).font = { bold: true };
        worksheet.mergeCells(currRow, 2, currRow, mergeCols + 1);
        currRow++;
    };

    addInfo('- Người nhận:', data.editableFields.customerSupplierName);
    addInfo('- Địa chỉ (bộ phận):', data.editableFields.customerSupplierAddress);
    addInfo('- Lý do xuất:', data.editableFields.reasonDescription);
    
    // Row cho Kho và Biển số xe
    const whRow = worksheet.getRow(currRow);
    whRow.getCell(1).value = '- Xuất tại kho:';
    whRow.getCell(2).value = data.editableFields.warehouse;
    whRow.getCell(2).font = { bold: true };
    whRow.getCell(5).value = '- Biển số xe:';
    whRow.getCell(6).value = data.editableFields.vehicleNumber || '';
    whRow.getCell(6).font = { bold: true };
    currRow++;

    // Row cho Cont và Seal
    const shipRow = worksheet.getRow(currRow);
    shipRow.getCell(1).value = '- Số Cont:';
    shipRow.getCell(2).value = data.editableFields.containerNumber || '';
    shipRow.getCell(2).font = { bold: true };
    shipRow.getCell(5).value = '- Số Seal:';
    shipRow.getCell(6).value = data.editableFields.sealNumber || '';
    shipRow.getCell(6).font = { bold: true };
    currRow++;

    addInfo('- Ghi chú:', data.editableFields.note || '');
    currRow++;

    // 5. Header bảng
    const tableHeaderRow = worksheet.getRow(currRow);
    const headers = ['STT', 'Mã LOT', 'Vị trí', 'Mã SP (SKU)', 'Sản phẩm', 'Số lượng', 'ĐVT', 'Quy cách', 'Ghi chú'];
    headers.forEach((h, i) => {
        const cell = tableHeaderRow.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true, color: { argb: 'FFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '000000' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });
    currRow++;

    // 6. Đổ dữ liệu
    let totalQty = 0;
    data.items.forEach((item, index) => {
        const row = worksheet.getRow(currRow);
        row.getCell(1).value = index + 1;
        row.getCell(2).value = item.lot_code || '';
        row.getCell(3).value = item.position_code || '';
        row.getCell(4).value = item.sku || '';
        row.getCell(5).value = item.product_name;
        row.getCell(6).value = Number(item.quantity) || 0;
        row.getCell(7).value = item.unit || '';
        row.getCell(8).value = item.quyCach || '';
        row.getCell(9).value = item.notes || '';

        totalQty += (Number(item.quantity) || 0);

        // Styling cells
        for (let i = 1; i <= 9; i++) {
            const cell = row.getCell(i);
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            if ([1, 2, 3, 4, 7, 8].includes(i)) {
                cell.alignment = { horizontal: 'center' };
            }
            if (i === 6) {
                cell.alignment = { horizontal: 'right' };
                cell.numFmt = '#,##0.##';
            }
        }
        currRow++;
    });

    // 7. Dòng tổng cộng
    const totalRow = worksheet.getRow(currRow);
    totalRow.getCell(1).value = 'TỔNG CỘNG';
    worksheet.mergeCells(currRow, 1, currRow, 5);
    totalRow.getCell(1).font = { bold: true };
    totalRow.getCell(1).alignment = { horizontal: 'center' };
    
    totalRow.getCell(6).value = totalQty;
    totalRow.getCell(6).font = { bold: true };
    totalRow.getCell(6).numFmt = '#,##0.##';
    totalRow.getCell(6).alignment = { horizontal: 'right' };

    for (let i = 1; i <= 9; i++) {
        totalRow.getCell(i).border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    }
    currRow += 2;

    // 8. Chữ ký
    const signDateRow = worksheet.getRow(currRow);
    signDateRow.getCell(7).value = `Ngày ${data.editableFields.day} tháng ${data.editableFields.month} năm ${data.editableFields.year}`;
    signDateRow.getCell(7).font = { italic: true };
    signDateRow.getCell(7).alignment = { horizontal: 'center' };
    worksheet.mergeCells(currRow, 7, currRow, 9);
    currRow++;

    const signTitleRow = worksheet.getRow(currRow);
    data.editableFields.signatures.forEach((sig, i) => {
        const colIdx = Math.floor(i * (9 / data.editableFields.signatures.length)) + 1;
        const cell = signTitleRow.getCell(colIdx);
        cell.value = sig.title;
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center' };
    });
    currRow++;

    const signNoteRow = worksheet.getRow(currRow);
    data.editableFields.signatures.forEach((sig, i) => {
        const colIdx = Math.floor(i * (9 / data.editableFields.signatures.length)) + 1;
        const cell = signNoteRow.getCell(colIdx);
        cell.value = '(Ký, họ tên)';
        cell.font = { italic: true, size: 9 };
        cell.alignment = { horizontal: 'center' };
    });
    currRow += 4;

    const signNameRow = worksheet.getRow(currRow);
    data.editableFields.signatures.forEach((sig, i) => {
        const colIdx = Math.floor(i * (9 / data.editableFields.signatures.length)) + 1;
        const cell = signNameRow.getCell(colIdx);
        cell.value = sig.name;
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center' };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `Lenh_Xuat_Kho_${data.order.code.replace(/\//g, '-')}.xlsx`;
    saveAs(new Blob([buffer]), fileName);
}
