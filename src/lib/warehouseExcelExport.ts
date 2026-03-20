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
                        cell.numFmt = '#,##0.###';
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
    const worksheet = workbook.addWorksheet('Sơ đồ mặt bằng');

    // 1. Header Tiêu đề chung
    worksheet.mergeCells('A1:Z1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'MẪU XUẤT FILE EXCEL SƠ ĐỒ';
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 30;

    worksheet.mergeCells('A2:Z2');
    const subTitle1 = worksheet.getCell('A2');
    subTitle1.value = 'DÃY : XẾP DỌC';
    subTitle1.alignment = { horizontal: 'center' };

    worksheet.mergeCells('A3:Z3');
    const subTitle2 = worksheet.getCell('A3');
    subTitle2.value = 'Ô : XẾP NGANG';
    subTitle2.alignment = { horizontal: 'center' };

    worksheet.mergeCells('A4:Z4');
    const subTitle3 = worksheet.getCell('A4');
    subTitle3.value = `Hệ thống: ${data.systemName} | Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`;
    subTitle3.alignment = { horizontal: 'center' };
    subTitle3.font = { italic: true };

    let currentRowIdx = 6;

    // 2. Phân loại và sắp xếp Grids theo Parent (KHO 1, KHO 2...)
    const extractNumber = (name: string) => {
        const match = name.match(/\d+/);
        return match ? parseInt(match[0], 10) : 999;
    };

    const dayRegex = /Dãy|D\d|D\s\d|Kệ|Khu|Rack|Row/i;
    const sanhRegex = /Sảnh|S\d|S\s\d|Lobby|Aisle/i;

    const gridsByParent: Record<string, any[]> = {};
    data.grids.forEach((g: any) => {
        const pName = g.parentName || 'KHU VỰC CHUNG';
        if (!gridsByParent[pName]) gridsByParent[pName] = [];
        gridsByParent[pName].push(g);
    });

    const parents = Object.keys(gridsByParent).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    parents.forEach(pName => {
        // Render Group Header (KHO 1, KHO 2...)
        worksheet.mergeCells(`A${currentRowIdx}:Z${currentRowIdx}`);
        const groupCell = worksheet.getCell(`A${currentRowIdx}`);
        groupCell.value = `KHU VỰC: ${pName.toUpperCase()}`;
        groupCell.font = { bold: true, size: 12 };
        groupCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD700' } }; // Gold/Darker Yellow
        groupCell.alignment = { horizontal: 'left' };
        groupCell.border = { bottom: { style: 'medium' } };
        currentRowIdx += 2; // Spacer

        const groupGrids = gridsByParent[pName];
        let dayGrids = groupGrids.filter(g => dayRegex.test(g.name))
            .sort((a, b) => extractNumber(a.name) - extractNumber(b.name));
        
        let sanhGrids = groupGrids.filter(g => sanhRegex.test(g.name))
            .sort((a, b) => extractNumber(a.name) - extractNumber(b.name));

        if (dayGrids.length === 0 && groupGrids.length > 0) {
            dayGrids = [...groupGrids].sort((a, b) => extractNumber(a.name) - extractNumber(b.name));
            sanhGrids = [];
        }

        const orderedGrids: Array<{ type: 'day' | 'sanh', grid: any }> = [];
        if (dayGrids.length > 0) {
            for (let i = 0; i < dayGrids.length; i += 2) {
                orderedGrids.push({ type: 'day', grid: dayGrids[i] });
                const sanhIdx = Math.floor(i / 2);
                if (sanhGrids[sanhIdx]) orderedGrids.push({ type: 'sanh', grid: sanhGrids[sanhIdx] });
                if (dayGrids[i + 1]) orderedGrids.push({ type: 'day', grid: dayGrids[i + 1] });
            }
        } else {
            groupGrids.forEach(g => {
                orderedGrids.push({ type: sanhRegex.test(g.name) ? 'sanh' : 'day', grid: g });
            });
        }

        // Render Grids for this group
        orderedGrids.forEach((item) => {
            const { type, grid } = item;
            
            if (type === 'day') {
                // --- RENDER DÃY ---
                const headerRow = worksheet.getRow(currentRowIdx);
                headerRow.getCell(1).value = grid.name.toUpperCase();
                headerRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } }; // Yellow
                headerRow.getCell(1).font = { bold: true };
                headerRow.getCell(1).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

                grid.bins.forEach((binName: string, bIdx: number) => {
                    const cell = headerRow.getCell(bIdx + 2);
                    cell.value = binName;
                    cell.font = { bold: true };
                    cell.alignment = { horizontal: 'center' };
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    worksheet.getColumn(bIdx + 2).width = 25;
                });
                const dãyStartRowIdx = currentRowIdx;
                currentRowIdx++;

                // Levels: [TẦNG X] [Chi tiết] [Chi tiết] ...
                const sortedLevels = [...grid.levels].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

                sortedLevels.forEach((lvlName, lIdx) => {
                    const row = worksheet.getRow(currentRowIdx);
                    row.getCell(1).value = lvlName === 'DỮ LIỆU' ? '' : lvlName.toUpperCase();
                    row.getCell(1).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    
                    grid.bins.forEach((binName: string, bIdx: number) => {
                        const excelColIdx = bIdx + 2;
                        const cell = row.getCell(excelColIdx);
                        
                        const levelIdxInOriginal = grid.levels.indexOf(lvlName);
                        const cellData = grid.cells.find((c: any) => c.binIndex === bIdx && c.levelIndex === levelIdxInOriginal);
                        
                        if (cellData && cellData.items.length > 0) {
                            const richText: any[] = [];
                            cellData.items.forEach((it: any, itIdx: number) => {
                                const roundedQty = Math.round((Number(it.quantity) || 0) * 1000) / 1000;
                                richText.push({ text: `• ${it.productName}`, font: { bold: true, size: 9 } });
                                richText.push({ text: ` : ${roundedQty} ${it.unit}`, font: { size: 9, bold: true, color: { argb: '0000FF' } } }); // Blue for qty
                                
                                if (itIdx < cellData.items.length - 1) {
                                    richText.push({ text: '\n', font: { size: 6 } });
                                }
                            });
                            cell.value = { richText };
                            cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };

                            // Handle Vertical Merging for "Gộp ô"
                            if (cellData.isMerged && cellData.rowSpan && cellData.rowSpan > 1) {
                                try {
                                    worksheet.mergeCells(dãyStartRowIdx + 1, excelColIdx, dãyStartRowIdx + cellData.rowSpan, excelColIdx);
                                } catch (e) {
                                    // Overlap catch
                                }
                            }
                        }
                        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    });
                    
                    // Tự động chỉnh độ cao cho dòng Tầng
                    let maxItems = 1;
                    grid.bins.forEach((_: string, bIdx: number) => {
                        const levelIdxInOriginal = grid.levels.indexOf(lvlName);
                        const cellData = grid.cells.find((c: any) => c.binIndex === bIdx && c.levelIndex === levelIdxInOriginal);
                        if (cellData && cellData.items.length > maxItems) maxItems = cellData.items.length;
                    });
                    row.height = Math.max(30, maxItems * 25);
                    
                    currentRowIdx++;
                });

            } else if (type === 'sanh') {
                // --- RENDER SẢNH ---
                const row = worksheet.getRow(currentRowIdx);
                row.getCell(1).value = grid.name.toUpperCase();
                row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } }; // Yellow
                row.getCell(1).font = { bold: true };
                row.getCell(1).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

                const allSanhItems: any[] = [];
                grid.cells.forEach((c: any) => allSanhItems.push(...c.items));

                if (allSanhItems.length > 0) {
                    const richText: any[] = [];
                    const summary: Record<string, { name: string, qty: number, unit: string }> = {};
                    allSanhItems.forEach(it => {
                        const key = `${it.sku || it.productName}_${it.unit}`;
                        if (!summary[key]) summary[key] = { name: it.productName, qty: 0, unit: it.unit };
                        summary[key].qty += (Number(it.quantity) || 0);
                    });

                    Object.values(summary).forEach((v: any, idx) => {
                        const roundedQty = Math.round(v.qty * 1000) / 1000;
                        richText.push({ text: `• ${v.name} : `, font: { size: 10, bold: true } });
                        richText.push({ text: `${roundedQty} ${v.unit}`, font: { size: 10, bold: true, color: { argb: '0000FF' } } });
                        if (idx < Object.values(summary).length - 1) richText.push({ text: '\n' });
                    });

                    row.getCell(2).value = { richText };
                    row.getCell(2).alignment = { wrapText: true, vertical: 'middle' };
                } else {
                    row.getCell(2).value = 'TRỐNG';
                    row.getCell(2).alignment = { horizontal: 'left' };
                }
                row.height = Math.max(30, (Object.keys(allSanhItems).length || 1) * 20);
                currentRowIdx++;
            }
            currentRowIdx++; // Spacer between blocks
        });
        
        currentRowIdx += 2; // Extra spacer between groups (KHOs)
    });

    worksheet.getColumn(1).width = 15;

    // --- SHEET 2: THỐNG KÊ KHU VỰC ---
    const sheet2 = workbook.addWorksheet('Thống kê Khu vực');
    sheet2.columns = [
        { header: 'Khu vực (KHO)', key: 'parent', width: 20 },
        { header: 'Dãy / Sảnh', key: 'group', width: 15 },
        { header: 'Mã SP', key: 'sku', width: 15 },
        { header: 'Tên sản phẩm', key: 'name', width: 35 },
        { header: 'ĐVT', key: 'unit', width: 10 },
        { header: 'Số lượng', key: 'qty', width: 12 },
    ];
    sheet2.getRow(1).font = { bold: true };
    sheet2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EEEEEE' } };

    let s2RowIdx = 2;
    parents.forEach(pName => {
        const groupGrids = gridsByParent[pName];
        groupGrids.forEach(grid => {
            // Aggregate items in this Dãy/Sảnh
            const gridSummary: Record<string, { sku: string, name: string, unit: string, qty: number }> = {};
            grid.cells.forEach((c: any) => {
                c.items.forEach((it: any) => {
                    const key = `${it.sku || it.productName}_${it.unit}`;
                    if (!gridSummary[key]) {
                        gridSummary[key] = { sku: it.sku, name: it.productName, unit: it.unit, qty: 0 };
                    }
                    gridSummary[key].qty += (Number(it.quantity) || 0);
                });
            });

            Object.values(gridSummary).forEach(v => {
                const qtyVal = Number(v.qty) || 0;
                const row = sheet2.addRow({
                    parent: pName,
                    group: grid.name,
                    sku: v.sku,
                    name: v.name,
                    unit: v.unit,
                    qty: Math.round(qtyVal * 1000) / 1000
                });
                const qtyCell = row.getCell(6);
                qtyCell.numFmt = (Math.floor(qtyVal) === qtyVal) ? '#,##0' : '#,##0.###';
                s2RowIdx++;
            });
        });
    });

    // --- SHEET 3: THỐNG KÊ TỔNG HỢP ---
    const sheet3 = workbook.addWorksheet('Thống kê Tổng hợp');
    sheet3.columns = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Mã sản phẩm', key: 'sku', width: 15 },
        { header: 'Tên sản phẩm', key: 'name', width: 40 },
        { header: 'Đơn vị tính', key: 'unit', width: 12 },
        { header: 'Tổng số lượng', key: 'qty', width: 15 },
    ];
    sheet3.getRow(1).font = { bold: true };
    sheet3.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EEEEEE' } };

    const globalSummary: Record<string, { sku: string, name: string, unit: string, qty: number }> = {};
    data.grids.forEach((grid: any) => {
        grid.cells.forEach((c: any) => {
            c.items.forEach((it: any) => {
                const key = `${it.sku || it.productName}_${it.unit}`;
                if (!globalSummary[key]) {
                    globalSummary[key] = { sku: it.sku, name: it.productName, unit: it.unit, qty: 0 };
                }
                globalSummary[key].qty += (Number(it.quantity) || 0);
            });
        });
    });

    Object.values(globalSummary)
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((v, idx) => {
            const qtyVal = Number(v.qty) || 0;
            const row = sheet3.addRow({
                stt: idx + 1,
                sku: v.sku,
                name: v.name,
                unit: v.unit,
                qty: Math.round(qtyVal * 1000) / 1000
            });
            const qtyCell = row.getCell(5);
            qtyCell.numFmt = (Math.floor(qtyVal) === qtyVal) ? '#,##0' : '#,##0.###';
            qtyCell.font = { bold: true };
        });

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `So_do_kho_Custom_${data.systemName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
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
                const val = Number(cell.value) || 0;
                cell.numFmt = (Math.floor(val) === val) ? '#,##0' : '#,##0.###';
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
    totalRow.getCell(6).numFmt = (Math.floor(totalQty) === totalQty) ? '#,##0' : '#,##0.###';
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
