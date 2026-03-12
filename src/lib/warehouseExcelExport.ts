import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface ExcelPosition {
    code: string;
    warehouse?: string;
    row?: string;
    bin?: string;
    level?: string;
    lotCode?: string;
    productName?: string;
    sku?: string;
    unit?: string;
    quantity?: number;
    tags?: string;
}

interface ExportWarehouseData {
    systemName: string;
    zoneName?: string;
    searchTerm?: string;
    positions: ExcelPosition[];
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
        { header: 'Vị trí', key: 'code', width: 15 },
        { header: 'Số lô (Lot)', key: 'lotCode', width: 20 },
        { header: 'Sản phẩm', key: 'productName', width: 40 },
        { header: 'Mã SP (SKU)', key: 'sku', width: 20 },
        { header: 'ĐVT', key: 'unit', width: 10 },
        { header: 'Số lượng', key: 'quantity', width: 12 },
        { header: 'Mã phụ / Tags', key: 'tags', width: 30 },
    ];

    // 2. Header công ty / Tiêu đề báo cáo
    worksheet.mergeCells('A1:L1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'BÁO CÁO CHI TIẾT SƠ ĐỒ KHO';
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.mergeCells('A2:L2');
    const infoCell = worksheet.getCell('A2');
    infoCell.value = `Kho: ${data.systemName}${data.zoneName ? ` | Khu vực: ${data.zoneName}` : ''} | Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`;
    infoCell.alignment = { horizontal: 'center' };

    if (data.searchTerm) {
        worksheet.mergeCells('A3:L3');
        const filterCell = worksheet.getCell('A3');
        filterCell.value = `Lọc theo: "${data.searchTerm}"`;
        filterCell.alignment = { horizontal: 'center' };
        filterCell.font = { italic: true };
    }

    // 3. Định dạng Header bảng (Row 5)
    const headerRowIdx = data.searchTerm ? 5 : 4;
    const headerRow = worksheet.getRow(headerRowIdx);
    
    // Copy headers to the specific row
    ['STT', 'Kho', 'Dãy', 'Ô / Khu vực', 'Tầng', 'Vị trí', 'Số lô (Lot)', 'Sản phẩm', 'Mã SP (SKU)', 'ĐVT', 'Số lượng', 'Mã phụ / Tags'].forEach((h, i) => {
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

    // Kích hoạt AutoFilter cho các cột từ A đến L tại dòng header
    worksheet.autoFilter = {
        from: { row: headerRowIdx, column: 1 },
        to: { row: headerRowIdx, column: 12 }
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
        row.getCell(6).value = pos.code;
        row.getCell(7).value = pos.lotCode || '(Trống)';
        row.getCell(8).value = pos.productName || '';
        row.getCell(9).value = pos.sku || '';
        row.getCell(10).value = pos.unit || '';
        row.getCell(11).value = pos.quantity || 0;
        row.getCell(12).value = pos.tags || '';

        // Định dạng style cho row dữ liệu
        for (let i = 1; i <= 12; i++) {
            const cell = row.getCell(i);
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            if (i === 1 || [2, 3, 4, 5, 6].includes(i) || i === 10) {
                cell.alignment = { horizontal: 'center' };
            }
            if (i === 11) {
                cell.alignment = { horizontal: 'right' };
                cell.numFmt = '#,##0.##';
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
    worksheet.mergeCells(`A${currentRowIdx}:J${currentRowIdx}`);
    totalRow.getCell(1).font = { bold: true };
    totalRow.getCell(1).alignment = { horizontal: 'center' };

    const totalQty = data.positions.reduce((sum, p) => sum + (p.quantity || 0), 0);
    totalRow.getCell(11).value = totalQty;
    totalRow.getCell(11).font = { bold: true };
    totalRow.getCell(11).numFmt = '#,##0.##';
    totalRow.getCell(11).alignment = { horizontal: 'right' };



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
        titleCell.value = `SƠ ĐỒ KHO: ${data.systemName} - ${grid.name}`;
        titleCell.font = { bold: true, size: 14 };
        titleCell.alignment = { horizontal: 'center' };

        // Date Info
        worksheet.mergeCells(2, 1, 2, grid.bins.length + 1);
        const dateCell = worksheet.getCell(2, 1);
        dateCell.value = `Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`;
        dateCell.alignment = { horizontal: 'center' };

        // Column headers (Bins)
        // Start from row 4
        const headerRowIdx = 4;
        grid.bins.forEach((binName, colIdx) => {
            const cell = worksheet.getCell(headerRowIdx, colIdx + 2);
            cell.value = binName;
            cell.font = { bold: true, color: { argb: 'FFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4F46E5' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            worksheet.getColumn(colIdx + 2).width = 25;
        });

        // Row headers (Levels)
        grid.levels.forEach((levelName, rowIdx) => {
            const cell = worksheet.getCell(headerRowIdx + rowIdx + 1, 1);
            cell.value = levelName;
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F3F4F6' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            worksheet.getRow(headerRowIdx + rowIdx + 1).height = 60; // Default height to show initial content
        });

        // Fill cells
        grid.cells.forEach(cellData => {
            const excelRowIdx = headerRowIdx + cellData.levelIndex + 1;
            const excelColIdx = cellData.binIndex + 2;
            const cell = worksheet.getCell(excelRowIdx, excelColIdx);

            if (cellData.items.length > 0) {
                const text = cellData.items.map(item => 
                    `${item.productName} (${item.sku})\nSL: ${item.quantity} ${item.unit}${item.lotCode ? `\nLô: ${item.lotCode}` : ''}`
                ).join('\n---\n');
                
                cell.value = text;
                cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
                cell.font = { size: 9 };
            } else {
                cell.value = 'Trống';
                cell.font = { italic: true, color: { argb: '9CA3AF' }, size: 9 };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }

            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

            // Handle Vertical Merging (Gộp tầng)
            if (cellData.isMerged && cellData.rowSpan && cellData.rowSpan > 1) {
                try {
                    worksheet.mergeCells(excelRowIdx, excelColIdx, excelRowIdx + cellData.rowSpan - 1, excelColIdx);
                } catch (e) {
                    // Ignore overlapping merge errors
                }
            }
        });

        // Auto height adjustment might not be perfect in ExcelJS, but we can try to estimate
        grid.levels.forEach((_, rowIdx) => {
            const row = worksheet.getRow(headerRowIdx + rowIdx + 1);
            let maxItems = 1;
            grid.cells.filter(c => c.levelIndex === rowIdx).forEach(c => {
                if (c.items.length > maxItems) maxItems = c.items.length;
            });
            row.height = Math.max(40, maxItems * 35);
        });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `So_do_kho_Grid_${data.systemName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    saveAs(new Blob([buffer]), fileName);
}
