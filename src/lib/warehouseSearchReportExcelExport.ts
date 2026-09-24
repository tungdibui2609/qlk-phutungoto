import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';

export interface SearchReportExcelItem {
    stt?: number;
    productName: string;
    sku: string;
    positionCode: string;
    zonePath?: string;
    warehouse?: string;
    date: string | null;
    dateFormatted: string;
    dateType?: string;
    packagingDateFormatted?: string;
    peelingDateFormatted?: string;
    inboundDateFormatted?: string;
    quantity: number;
    unit: string;
    lotCode: string;
    productionName?: string;
    tags?: string;
    notes?: string;
}

export interface ExportWarehouseSearchReportOptions {
    items: SearchReportExcelItem[];
    searchTerm?: string;
    categoryName?: string;
    systemName: string;
    sortDescription: string;
    dateFieldDescription: string;
    totalPositions: number;
    totalQuantity: number;
    oldestDate?: string | null;
    newestDate?: string | null;
    companyInfo?: any;
}

export async function exportWarehouseSearchReportToExcel(options: ExportWarehouseSearchReportOptions) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Chanh Thu Smart WMS';
    workbook.created = new Date();

    const {
        items,
        searchTerm,
        categoryName,
        systemName,
        sortDescription,
        dateFieldDescription,
        totalPositions,
        totalQuantity,
        companyInfo
    } = options;

    const exportTimeStr = format(new Date(), 'dd/MM/yyyy HH:mm');
    const companyName = companyInfo?.name || 'CÔNG TY TNHH XNK TRÁI CÂY CHÁNH THU';
    const filterLabel = searchTerm || categoryName || 'Tất cả vị trí';

    // ==========================================
    // SHEET 1: BÁO CÁO CHI TIẾT THEO NGÀY
    // ==========================================
    const wsDetail = workbook.addWorksheet('Chi tiết theo ngày');

    // Cấu hình cột
    wsDetail.columns = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Tên sản phẩm', key: 'productName', width: 38 },
        { header: 'Mã SP (SKU)', key: 'sku', width: 18 },
        { header: 'Mã vị trí', key: 'positionCode', width: 16 },
        { header: 'Khu vực / Dãy - Ô - Tầng', key: 'zonePath', width: 28 },
        { header: 'Ngày nhập kho', key: 'dateFormatted', width: 16 },
        { header: 'Ngày đóng gói', key: 'packagingDateFormatted', width: 14 },
        { header: 'Ngày bóc múi', key: 'peelingDateFormatted', width: 14 },
        { header: 'Số lượng', key: 'quantity', width: 14 },
        { header: 'ĐVT', key: 'unit', width: 10 },
        { header: 'Mã LOT', key: 'lotCode', width: 18 },
        { header: 'Lệnh sản xuất', key: 'productionName', width: 22 },
        { header: 'Mã phụ / Tags', key: 'tags', width: 20 },
        { header: 'Ghi chú', key: 'notes', width: 25 },
    ];

    // Banner & Metadata Header
    wsDetail.mergeCells('A1:N1');
    const titleCell = wsDetail.getCell('A1');
    titleCell.value = 'BÁO CÁO VỊ TRÍ HÀNG HÓA THEO NGÀY';
    titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFF' } };
    titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '059669' } // Emerald 600
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    wsDetail.getRow(1).height = 36;

    // Company & Warehouse
    wsDetail.mergeCells('A2:N2');
    const compCell = wsDetail.getCell('A2');
    compCell.value = `${companyName} | Kho: ${systemName || 'Tất cả kho'}`;
    compCell.font = { bold: true, size: 11, color: { argb: '065F46' } };
    compCell.alignment = { horizontal: 'center', vertical: 'middle' };
    wsDetail.getRow(2).height = 20;

    // Filter & Export Time
    wsDetail.mergeCells('A3:N3');
    const infoCell = wsDetail.getCell('A3');
    infoCell.value = `Tìm kiếm: "${filterLabel}" | Tiêu chuẩn ngày: ${dateFieldDescription} | Thời gian xuất: ${exportTimeStr}`;
    infoCell.font = { italic: true, size: 10, color: { argb: '334155' } };
    infoCell.alignment = { horizontal: 'center', vertical: 'middle' };
    wsDetail.getRow(3).height = 18;

    // Sort & Summary stats
    wsDetail.mergeCells('A4:N4');
    const sortCell = wsDetail.getCell('A4');
    sortCell.value = `Sắp xếp: ${sortDescription} | Tổng vị trí: ${totalPositions.toLocaleString()} vị trí | Tổng số lượng: ${totalQuantity.toLocaleString()}`;
    sortCell.font = { bold: true, size: 10, color: { argb: '047857' } };
    sortCell.alignment = { horizontal: 'center', vertical: 'middle' };
    wsDetail.getRow(4).height = 20;

    // Empty row
    wsDetail.getRow(5).height = 8;

    // Table Header Row (Row 6)
    const headerRowIdx = 6;
    const headerRow = wsDetail.getRow(headerRowIdx);
    headerRow.height = 28;

    const columnHeaders = [
        'STT',
        'Tên sản phẩm',
        'Mã SP (SKU)',
        'Mã vị trí',
        'Khu vực / Dãy - Ô - Tầng',
        'Ngày nhập kho',
        'Ngày đóng gói',
        'Ngày bóc múi',
        'Số lượng',
        'ĐVT',
        'Mã LOT',
        'Lệnh sản xuất',
        'Mã phụ / Tags',
        'Ghi chú'
    ];

    columnHeaders.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 10 };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '047857' } // Emerald 700
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
            top: { style: 'thin', color: { argb: 'A7F3D0' } },
            left: { style: 'thin', color: { argb: 'A7F3D0' } },
            bottom: { style: 'medium', color: { argb: '064E3B' } },
            right: { style: 'thin', color: { argb: 'A7F3D0' } }
        };
    });

    // AutoFilter
    wsDetail.autoFilter = {
        from: { row: headerRowIdx, column: 1 },
        to: { row: headerRowIdx, column: columnHeaders.length }
    };

    // Data rows
    let currentIdx = headerRowIdx + 1;
    items.forEach((item, index) => {
        const row = wsDetail.getRow(currentIdx);
        row.height = 22;

        const isEven = index % 2 === 1;
        const bgArgb = isEven ? 'F8FAFC' : 'FFFFFF';

        // 1. STT
        row.getCell(1).value = index + 1;
        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

        // 2. Tên sản phẩm
        row.getCell(2).value = item.productName || '';
        row.getCell(2).font = { bold: true, color: { argb: '0F172A' } };
        row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };

        // 3. Mã SP
        row.getCell(3).value = item.sku || '';
        row.getCell(3).font = { bold: true, color: { argb: '047857' } };
        row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };

        // 4. Mã vị trí
        row.getCell(4).value = item.positionCode || '';
        row.getCell(4).font = { bold: true, color: { argb: '1E293B' } };
        row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };

        // 5. Khu vực
        row.getCell(5).value = item.zonePath || item.warehouse || '';
        row.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };

        // 6. Ngày nhập kho
        row.getCell(6).value = item.dateFormatted || '';
        row.getCell(6).font = { bold: true, color: { argb: 'B45309' } }; // Amber 700
        row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };

        // 7. Ngày đóng gói
        row.getCell(7).value = item.packagingDateFormatted || '-';
        row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };

        // 8. Ngày bóc múi
        row.getCell(8).value = item.peelingDateFormatted || '-';
        row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };

        // 9. Số lượng
        const qtyNum = Number(item.quantity) || 0;
        row.getCell(9).value = Math.round(qtyNum * 1000) / 1000;
        row.getCell(9).font = { bold: true, color: { argb: '1D4ED8' } }; // Blue 700
        row.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(9).numFmt = Math.floor(qtyNum) === qtyNum ? '#,##0' : '#,##0.###';

        // 10. ĐVT
        row.getCell(10).value = item.unit || '';
        row.getCell(10).alignment = { horizontal: 'center', vertical: 'middle' };

        // 11. Mã LOT
        row.getCell(11).value = item.lotCode || '';
        row.getCell(11).alignment = { horizontal: 'center', vertical: 'middle' };

        // 12. Lệnh sản xuất
        row.getCell(12).value = item.productionName || '';
        row.getCell(12).alignment = { horizontal: 'left', vertical: 'middle' };

        // 13. Mã phụ / Tags
        row.getCell(13).value = item.tags || '';
        row.getCell(13).font = { color: { argb: '7E22CE' } }; // Purple 700
        row.getCell(13).alignment = { horizontal: 'left', vertical: 'middle' };

        // 14. Ghi chú
        row.getCell(14).value = item.notes || '';
        row.getCell(14).alignment = { horizontal: 'left', vertical: 'middle' };

        // Borders & Background
        for (let c = 1; c <= columnHeaders.length; c++) {
            const cell = row.getCell(c);
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: bgArgb }
            };
            cell.border = {
                top: { style: 'thin', color: { argb: 'E2E8F0' } },
                left: { style: 'thin', color: { argb: 'E2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
                right: { style: 'thin', color: { argb: 'E2E8F0' } }
            };
        }

        currentIdx++;
    });

    // Dòng TỔNG CỘNG
    const totalRow = wsDetail.getRow(currentIdx);
    totalRow.height = 28;

    // Merge A..H (1..8)
    wsDetail.mergeCells(`A${currentIdx}:H${currentIdx}`);
    const tCell = totalRow.getCell(1);
    tCell.value = 'TỔNG CỘNG';
    tCell.font = { bold: true, size: 11, color: { argb: '065F46' } };
    tCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Total quantity (column 9)
    const totalQtyCell = totalRow.getCell(9);
    const sumQty = items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
    const roundedSum = Math.round(sumQty * 1000) / 1000;
    totalQtyCell.value = roundedSum;
    totalQtyCell.font = { bold: true, size: 11, color: { argb: '1D4ED8' } };
    totalQtyCell.alignment = { horizontal: 'right', vertical: 'middle' };
    totalQtyCell.numFmt = Math.floor(roundedSum) === roundedSum ? '#,##0' : '#,##0.###';

    // ĐVT (column 10, nếu tất cả cùng 1 ĐVT)
    const uniqueUnits = Array.from(new Set(items.map(it => it.unit).filter(Boolean)));
    if (uniqueUnits.length === 1) {
        totalRow.getCell(10).value = uniqueUnits[0];
        totalRow.getCell(10).font = { bold: true };
        totalRow.getCell(10).alignment = { horizontal: 'center', vertical: 'middle' };
    }

    for (let c = 1; c <= columnHeaders.length; c++) {
        const cell = totalRow.getCell(c);
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'D1FAE5' } // Emerald 100
        };
        cell.border = {
            top: { style: 'medium', color: { argb: '059669' } },
            left: { style: 'thin', color: { argb: 'A7F3D0' } },
            bottom: { style: 'medium', color: { argb: '059669' } },
            right: { style: 'thin', color: { argb: 'A7F3D0' } }
        };
    }

    // ==========================================
    // SHEET 2: TỔNG HỢP THEO NGÀY
    // ==========================================
    const wsByDate = workbook.addWorksheet('Tổng hợp theo ngày');
    wsByDate.columns = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Ngày nhập kho', key: 'dateFormatted', width: 16 },
        { header: 'Số lượng vị trí', key: 'positionCount', width: 18 },
        { header: 'Tổng số lượng', key: 'totalQuantity', width: 16 },
        { header: 'Đơn vị tính', key: 'unit', width: 12 },
        { header: 'Mã SP / Sản phẩm', key: 'productSummary', width: 50 },
    ];

    wsByDate.mergeCells('A1:F1');
    const dTitle = wsByDate.getCell('A1');
    dTitle.value = 'BÁO CÁO TỔNG HỢP THEO NGÀY';
    dTitle.font = { bold: true, size: 14, color: { argb: 'FFFFFF' } };
    dTitle.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '059669' }
    };
    dTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    wsByDate.getRow(1).height = 32;

    wsByDate.mergeCells('A2:F2');
    const dSub = wsByDate.getCell('A2');
    dSub.value = `Kho: ${systemName || 'Tất cả'} | Lọc: "${filterLabel}" | Xuất lúc: ${exportTimeStr}`;
    dSub.alignment = { horizontal: 'center', vertical: 'middle' };
    wsByDate.getRow(2).height = 18;

    // Header row
    const dHeaderRow = wsByDate.getRow(4);
    dHeaderRow.height = 26;
    ['STT', 'Ngày nhập kho', 'Số lượng vị trí', 'Tổng số lượng', 'Đơn vị tính', 'Mã SP / Sản phẩm'].forEach((h, i) => {
        const cell = dHeaderRow.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true, color: { argb: 'FFFFFF' } };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '047857' }
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
            top: { style: 'thin', color: { argb: 'A7F3D0' } },
            left: { style: 'thin', color: { argb: 'A7F3D0' } },
            bottom: { style: 'medium', color: { argb: '064E3B' } },
            right: { style: 'thin', color: { argb: 'A7F3D0' } }
        };
    });

    // Group items by dateFormatted
    const dateMap = new Map<string, {
        rawDate: string | null;
        dateFormatted: string;
        positions: Set<string>;
        totalQty: number;
        units: Set<string>;
        products: Map<string, number>;
    }>();

    items.forEach(it => {
        const dKey = it.dateFormatted || '(Không có ngày)';
        if (!dateMap.has(dKey)) {
            dateMap.set(dKey, {
                rawDate: it.date,
                dateFormatted: dKey,
                positions: new Set(),
                totalQty: 0,
                units: new Set(),
                products: new Map()
            });
        }
        const g = dateMap.get(dKey)!;
        if (it.positionCode) g.positions.add(it.positionCode);
        g.totalQty += (Number(it.quantity) || 0);
        if (it.unit) g.units.add(it.unit);
        const pLabel = `${it.sku ? it.sku + ' - ' : ''}${it.productName}`;
        g.products.set(pLabel, (g.products.get(pLabel) || 0) + (Number(it.quantity) || 0));
    });

    const dateGroups = Array.from(dateMap.values());

    let dCurrentIdx = 5;
    dateGroups.forEach((g, idx) => {
        const row = wsByDate.getRow(dCurrentIdx);
        row.height = 22;

        row.getCell(1).value = idx + 1;
        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

        row.getCell(2).value = g.dateFormatted;
        row.getCell(2).font = { bold: true };
        row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };

        row.getCell(3).value = g.positions.size;
        row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };

        const roundedQ = Math.round(g.totalQty * 1000) / 1000;
        row.getCell(4).value = roundedQ;
        row.getCell(4).font = { bold: true, color: { argb: '1D4ED8' } };
        row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(4).numFmt = Math.floor(roundedQ) === roundedQ ? '#,##0' : '#,##0.###';

        row.getCell(5).value = Array.from(g.units).join(', ');
        row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };

        const pSummary = Array.from(g.products.entries())
            .map(([pName, pQty]) => `${pName} (${pQty.toLocaleString()})`)
            .join('; ');
        row.getCell(6).value = pSummary;
        row.getCell(6).alignment = { horizontal: 'left', vertical: 'middle' };

        for (let c = 1; c <= 6; c++) {
            const cell = row.getCell(c);
            cell.border = {
                top: { style: 'thin', color: { argb: 'E2E8F0' } },
                left: { style: 'thin', color: { argb: 'E2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
                right: { style: 'thin', color: { argb: 'E2E8F0' } }
            };
        }

        dCurrentIdx++;
    });

    // ==========================================
    // SHEET 3: TỔNG HỢP THEO SẢN PHẨM
    // ==========================================
    const wsByProduct = workbook.addWorksheet('Tổng hợp theo sản phẩm');
    wsByProduct.columns = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Mã SP (SKU)', key: 'sku', width: 18 },
        { header: 'Tên sản phẩm', key: 'productName', width: 40 },
        { header: 'Số lượng vị trí', key: 'positionCount', width: 16 },
        { header: 'Tổng số lượng', key: 'totalQuantity', width: 16 },
        { header: 'Đơn vị tính', key: 'unit', width: 12 },
        { header: 'Ngày cũ nhất', key: 'oldestDate', width: 14 },
        { header: 'Ngày mới nhất', key: 'newestDate', width: 14 },
    ];

    wsByProduct.mergeCells('A1:H1');
    const pTitle = wsByProduct.getCell('A1');
    pTitle.value = 'BÁO CÁO TỔNG HỢP THEO SẢN PHẨM';
    pTitle.font = { bold: true, size: 14, color: { argb: 'FFFFFF' } };
    pTitle.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '059669' }
    };
    pTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    wsByProduct.getRow(1).height = 32;

    wsByProduct.mergeCells('A2:H2');
    const pSub = wsByProduct.getCell('A2');
    pSub.value = `Kho: ${systemName || 'Tất cả'} | Lọc: "${filterLabel}" | Xuất lúc: ${exportTimeStr}`;
    pSub.alignment = { horizontal: 'center', vertical: 'middle' };
    wsByProduct.getRow(2).height = 18;

    const pHeaderRow = wsByProduct.getRow(4);
    pHeaderRow.height = 26;
    ['STT', 'Mã SP (SKU)', 'Tên sản phẩm', 'Số lượng vị trí', 'Tổng số lượng', 'Đơn vị tính', 'Ngày cũ nhất', 'Ngày mới nhất'].forEach((h, i) => {
        const cell = pHeaderRow.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true, color: { argb: 'FFFFFF' } };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '047857' }
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
            top: { style: 'thin', color: { argb: 'A7F3D0' } },
            left: { style: 'thin', color: { argb: 'A7F3D0' } },
            bottom: { style: 'medium', color: { argb: '064E3B' } },
            right: { style: 'thin', color: { argb: 'A7F3D0' } }
        };
    });

    const prodMap = new Map<string, {
        sku: string;
        name: string;
        positions: Set<string>;
        totalQty: number;
        unit: string;
        oldestDate: string | null;
        newestDate: string | null;
    }>();

    items.forEach(it => {
        const pKey = `${it.sku || ''}_${it.productName}`;
        if (!prodMap.has(pKey)) {
            prodMap.set(pKey, {
                sku: it.sku || '',
                name: it.productName,
                positions: new Set(),
                totalQty: 0,
                unit: it.unit || '',
                oldestDate: null,
                newestDate: null
            });
        }
        const g = prodMap.get(pKey)!;
        if (it.positionCode) g.positions.add(it.positionCode);
        g.totalQty += (Number(it.quantity) || 0);

        if (it.date) {
            if (!g.oldestDate || it.date < g.oldestDate) g.oldestDate = it.date;
            if (!g.newestDate || it.date > g.newestDate) g.newestDate = it.date;
        }
    });

    let pCurrentIdx = 5;
    Array.from(prodMap.values()).forEach((g, idx) => {
        const row = wsByProduct.getRow(pCurrentIdx);
        row.height = 22;

        row.getCell(1).value = idx + 1;
        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

        row.getCell(2).value = g.sku;
        row.getCell(2).font = { bold: true, color: { argb: '047857' } };
        row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };

        row.getCell(3).value = g.name;
        row.getCell(3).font = { bold: true };
        row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };

        row.getCell(4).value = g.positions.size;
        row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };

        const roundedQ = Math.round(g.totalQty * 1000) / 1000;
        row.getCell(5).value = roundedQ;
        row.getCell(5).font = { bold: true, color: { argb: '1D4ED8' } };
        row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(5).numFmt = Math.floor(roundedQ) === roundedQ ? '#,##0' : '#,##0.###';

        row.getCell(6).value = g.unit;
        row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };

        row.getCell(7).value = g.oldestDate ? format(new Date(g.oldestDate), 'dd/MM/yyyy') : '-';
        row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };

        row.getCell(8).value = g.newestDate ? format(new Date(g.newestDate), 'dd/MM/yyyy') : '-';
        row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };

        for (let c = 1; c <= 8; c++) {
            const cell = row.getCell(c);
            cell.border = {
                top: { style: 'thin', color: { argb: 'E2E8F0' } },
                left: { style: 'thin', color: { argb: 'E2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
                right: { style: 'thin', color: { argb: 'E2E8F0' } }
            };
        }

        pCurrentIdx++;
    });

    // Write file & Download
    const buffer = await workbook.xlsx.writeBuffer();
    const cleanSearchStr = (searchTerm || categoryName || 'Ket_qua_kho')
        .replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, '_')
        .slice(0, 30);
    const fileName = `Bao_cao_ngay_${cleanSearchStr}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    saveAs(new Blob([buffer]), fileName);
    return fileName;
}
