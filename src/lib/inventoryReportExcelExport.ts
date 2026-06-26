import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { CompanyInfo } from '@/hooks/usePrintCompanyInfo';

interface InventoryReportExportData {
    type: 'accounting' | 'lot' | 'reconciliation' | 'category' | 'tags' | 'labels';
    viewMode?: 'lot' | 'month';
    dateTitle: string;
    warehouse: string;
    items: any[];
    companyInfo: CompanyInfo | null;
}

// Helper: clean number values to avoid trailing dots in Excel
function cleanNum(val: any): number {
    const n = Number(val) || 0;
    return Math.round(n * 100) / 100; // Round to 2 decimal places
}

export async function exportInventoryReportToExcel(data: InventoryReportExportData) {
    const workbook = new ExcelJS.Workbook();
    
    if (data.type === 'lot') {
        const ws1 = workbook.addWorksheet('Chi tiết');
        buildWorksheet(ws1, data, false);

        const ws2 = workbook.addWorksheet('Tổng hợp');
        buildWorksheet(ws2, data, true);
    } else {
        const ws = workbook.addWorksheet('Bao Cao Ton Kho');
        buildWorksheet(ws, data, false);
    }

    // Save
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `Ton_kho_${new Date().toISOString().split('T')[0]}.xlsx`;
    saveAs(new Blob([buffer]), fileName);
}

function buildWorksheet(worksheet: ExcelJS.Worksheet, data: InventoryReportExportData, isLotSummary: boolean) {
    // 1. Define Columns based on report type
    let cols: any[] = [];
    if (data.type === 'accounting') {
        cols = [
            { header: 'STT', key: 'stt', width: 6 },
            { header: 'Tên Sản Phẩm', key: 'productName', width: 40 },
            { header: 'Mã SP', key: 'productCode', width: 20 },
            { header: 'ĐVT', key: 'unit', width: 10 },
            { header: 'Tồn Đầu', key: 'opening', width: 15 },
            { header: 'Nhập', key: 'qtyIn', width: 15 },
            { header: 'Xuất', key: 'qtyOut', width: 15 },
            { header: 'Tồn Cuối', key: 'balance', width: 15 },
            { header: 'Quy đổi (Kg)', key: 'kg', width: 15 },
        ];
    } else if (data.type === 'lot' || data.type === 'category' || data.type === 'tags') {
        const showTags = data.type !== 'category' && !isLotSummary;
        cols = [
            { header: 'STT', key: 'stt', width: 6 },
            { header: 'Mã SP', key: 'productCode', width: 20 },
            { header: 'Tên sản phẩm', key: 'productName', width: 40 },
            ...(showTags ? [{ header: 'Mã phụ / Phân loại', key: 'tags', width: 30 }] : []),
            { header: 'ĐVT', key: 'unit', width: 10 },
            { header: 'Số lượng', key: 'quantity', width: 15 },
            { header: 'Quy đổi (Kg)', key: 'kg', width: 15 },
        ];
    } else if (data.type === 'labels') {
        cols = [
            { header: 'STT', key: 'stt', width: 6 },
            { header: 'Mã SP', key: 'productCode', width: 20 },
            { header: 'Tên sản phẩm', key: 'productName', width: 45 },
            { header: 'Lô bán thành phẩm', key: 'semi_finished_lot_code', width: 22 },
            { header: 'Lô thành phẩm', key: 'finished_lot_code', width: 22 },
            { header: 'Số lượng tem', key: 'labelCount', width: 15 },
            { header: 'Tồn kho tem', key: 'totalQuantity', width: 15 },
            { header: 'ĐVT', key: 'unit', width: 10 },
        ];
    } else {
        cols = [
            { header: 'Mã SP', key: 'productCode', width: 20 },
            { header: 'Tên Sản Phẩm', key: 'productName', width: 40 },
            { header: 'ĐVT', key: 'unit', width: 10 },
            { header: 'Tồn Kế Toán', key: 'accountingBalance', width: 15 },
            { header: 'Tổng LOT', key: 'lotBalance', width: 15 },
            { header: 'Chênh Lệch', key: 'diff', width: 15 },
        ];
    }

    // Set keys and widths without headers to prevent auto-writing on row 1
    worksheet.columns = cols.map(c => ({ key: c.key, width: c.width }));

    // 2. Add Company Info Header
    let currentRow = 1;
    if (data.companyInfo) {
        worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
        const nameCell = worksheet.getCell(`A${currentRow}`);
        nameCell.value = data.companyInfo.name?.toUpperCase();
        nameCell.font = { bold: true, size: 10 };
        currentRow++;

        worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
        const addrCell = worksheet.getCell(`A${currentRow}`);
        addrCell.value = `Địa chỉ: ${data.companyInfo.address}`;
        addrCell.font = { size: 9 };
        currentRow++;

        worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
        const contactCell = worksheet.getCell(`A${currentRow}`);
        contactCell.value = `${data.companyInfo.email ? `Email: ${data.companyInfo.email} | ` : ''}ĐT: ${data.companyInfo.phone || ''}`;
        contactCell.font = { size: 9 };
        currentRow++;
    }

    currentRow++; // Spacer

    // 3. Report Title
    const title = data.type === 'accounting' 
        ? 'BÁO CÁO TỔNG HỢP NHẬP XUẤT TỒN' 
        : (data.type === 'lot' || data.type === 'tags')
            ? (isLotSummary ? 'BÁO CÁO TỔNG HỢP TỒN KHO' : 'BÁO CÁO TỒN KHO THEO LOT') 
            : data.type === 'category'
                ? (isLotSummary ? 'BÁO CÁO TỔNG HỢP TỒN KHO' : 'BÁO CÁO TỒN KHO THEO DANH MỤC')
                : data.type === 'labels'
                    ? 'BÁO CÁO TỒN KHO THEO TEM NHÃN'
                    : 'BẢNG ĐỐI CHIẾU TỒN KHO VS KẾ TOÁN';
    
    const lastCol = String.fromCharCode(65 + cols.length - 1);
    worksheet.mergeCells(`A${currentRow}:${lastCol}${currentRow}`);
    const titleCell = worksheet.getCell(`A${currentRow}`);
    titleCell.value = title;
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center' };
    currentRow++;

    worksheet.mergeCells(`A${currentRow}:${lastCol}${currentRow}`);
    const dateCell = worksheet.getCell(`A${currentRow}`);
    dateCell.value = data.dateTitle;
    dateCell.alignment = { horizontal: 'center' };
    dateCell.font = { italic: true };
    currentRow++;

    if (data.warehouse) {
        const whCell = worksheet.getCell(`A${currentRow}`);
        whCell.value = `Kho: ${data.warehouse}`;
        whCell.font = { bold: true };
        currentRow++;
    }

    currentRow++; // Spacer before table header

    // 4. Table Header formatting
    const headerRow = worksheet.getRow(currentRow);
    headerRow.values = cols.map(c => String(c.header || ''));
    headerRow.eachCell(cell => {
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'F2F2F2' }
        };
    });
    const headerRowIdx = currentRow;
    currentRow++;

    // 5. Body Data
    if (data.type === 'accounting') {
        const groups = new Map<string, any[]>();
        data.items.forEach(item => {
            const cat = item.categoryName || 'Chưa phân loại';
            if (!groups.has(cat)) groups.set(cat, []);
            groups.get(cat)!.push(item);
        });

        const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
            if (a[0] === 'Chưa phân loại') return 1;
            if (b[0] === 'Chưa phân loại') return -1;
            return a[0].localeCompare(b[0]);
        });

        let stt = 1;
        sortedGroups.forEach(([categoryName, items]) => {
            const catTotals = items.reduce((acc, item) => ({
                opening: acc.opening + (item.opening || 0),
                qtyIn: acc.qtyIn + (item.qtyIn || 0),
                qtyOut: acc.qtyOut + (item.qtyOut || 0),
                balance: acc.balance + (item.balance || 0),
            }), { opening: 0, qtyIn: 0, qtyOut: 0, balance: 0 });

            // Add Category Header Row
            const catRow = worksheet.addRow([
                `DANH MỤC: ${categoryName.toUpperCase()}`,
                '', '', '', // B, C, D
                cleanNum(catTotals.opening),
                cleanNum(catTotals.qtyIn),
                cleanNum(catTotals.qtyOut),
                cleanNum(catTotals.balance),
                items.reduce((sum, item) => sum + (item.kg || 0), 0)
            ]);
            worksheet.mergeCells(`A${catRow.number}:D${catRow.number}`);
            catRow.font = { bold: true, italic: true, size: 10, color: { argb: '7F6000' } };
            
            catRow.eachCell((cell, colNumber) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF2CC' } // Light orange/yellow
                };
                cell.border = { 
                    top: { style: 'thin' }, 
                    left: { style: 'thin' }, 
                    bottom: { style: 'thin' }, 
                    right: { style: 'thin' } 
                };
                if (colNumber >= 5) {
                    cell.alignment = { horizontal: 'right' };
                    const val = cell.value;
                    if (typeof val === 'number' && Number.isInteger(val)) {
                        cell.numFmt = '#,##0';
                    } else {
                        cell.numFmt = '#,##0.###';
                    }
                }
            });

            items.forEach((item) => {
                const row = worksheet.addRow([
                    stt++,
                    item.productName,
                    item.productCode,
                    item.unit,
                    cleanNum(item.opening),
                    cleanNum(item.qtyIn),
                    cleanNum(item.qtyOut),
                    cleanNum(item.balance),
                    cleanNum(item.kg)
                ]);
                row.eachCell(cell => {
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                });
                // Align quantity columns
                [5, 6, 7, 8, 9].forEach(col => {
                    const cell = row.getCell(col);
                    cell.alignment = { horizontal: 'right' };
                    const val = cell.value;
                    if (typeof val === 'number' && Number.isInteger(val)) {
                        cell.numFmt = '#,##0';
                    } else {
                        cell.numFmt = '#,##0.###';
                    }
                });
            });
        });
    } else if (data.type === 'lot' || data.type === 'category' || data.type === 'tags') {
        const showTags = data.type !== 'category' && !isLotSummary;
        // Here item is GroupedLot or variant logic
        // We'll follow the visual structure: Main row then variant rows
        let stt = 1;
        let lastCategory: string | null = null;
        
        data.items.forEach((group: any) => {
            // Category Header Logic
            if (group.categoryName && group.categoryName !== lastCategory) {
                const catItems = data.items.filter((g: any) => g.categoryName === group.categoryName);
                const catTotalQty = catItems.reduce((sum: number, item: any) => sum + (item.totalQuantity || 0), 0);
                const catTotalKg = catItems.reduce((sum: number, item: any) => sum + (item.totalKg || 0), 0);

                const catRow = worksheet.addRow([
                    `DANH MỤC: ${group.categoryName}`,
                    '',
                    '',
                    '',
                    `Tổng SL: ${catTotalQty.toLocaleString('vi-VN')}`,
                    `Tổng KG: ${catTotalKg.toLocaleString('vi-VN')}`
                ]);
                
                worksheet.mergeCells(`A${catRow.number}:D${catRow.number}`);
                catRow.font = { bold: true };
                catRow.eachCell((cell, colNumber) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF2CC' } // Light orange/yellow
                    };
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    if (colNumber >= 5) {
                        cell.font = { bold: false, italic: true, size: 9 };
                        cell.alignment = { horizontal: 'right' };
                    }
                });
                
                lastCategory = group.categoryName;
            }

            const rowValues = [
                stt++,
                group.productSku,
                group.productName,
                group.productUnit,
                cleanNum(group.totalQuantity),
                cleanNum(group.totalKg)
            ];
            
            // Insert tags if not category
            if (showTags) {
                rowValues.splice(3, 0, ''); // Insert empty tag at index 3
            }

            const mainRow = worksheet.addRow(rowValues);
            mainRow.font = { bold: true };
            mainRow.eachCell(cell => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });
            const qtyCol = showTags ? 6 : 5;
            const kgCol = showTags ? 7 : 6;
            [qtyCol, kgCol].forEach(col => {
                const cell = mainRow.getCell(col);
                if (cell) {
                    cell.alignment = { horizontal: 'right' };
                    cell.numFmt = '#,##0';
                }
            });

            // Variants logic synced with Web (InventoryTable.tsx)
            // Note: variants is Map<string, { totalQuantity: number, totalKg: number, items: any[] }>
            if (!isLotSummary) {
                const variantEntries = Array.from(group.variants.entries() as [string, any][]);
                const hasRealVariants = variantEntries.length > 1 || (variantEntries.length === 1 && variantEntries[0][0] !== 'Không có mã phụ');
                
                if (hasRealVariants && data.type !== 'category') {
                    if (data.viewMode === 'month') {
                        // Gom nhóm theo Tháng sản xuất
                        const monthGroups = new Map<string, { totalQty: number, totalKg: number, items: { tag: string, qty: number, kg: number }[] }>();

                        variantEntries.forEach(([variantKey, vData]) => {
                            const qty = vData.totalQuantity || 0;
                            const kg = vData.totalKg || 0;
                            const parts = variantKey.split('__');
                            const monthName = parts[0] || 'Không xác định';
                            const compositeTag = parts[1] || 'Không có mã phụ';

                            if (!monthGroups.has(monthName)) {
                                monthGroups.set(monthName, { totalQty: 0, totalKg: 0, items: [] });
                            }
                            const mGrp = monthGroups.get(monthName)!;
                            mGrp.totalQty += qty;
                            mGrp.totalKg += kg;
                            mGrp.items.push({ tag: compositeTag, qty, kg });
                        });

                        // Sắp xếp các tháng: Tháng mới hơn hiển thị trước, "Không xác định" ở dưới cùng
                        const sortedMonths = Array.from(monthGroups.keys()).sort((a, b) => {
                            if (a === 'Không xác định') return 1;
                            if (b === 'Không xác định') return -1;
                            const getYearMonth = (s: string) => {
                                const m = s.match(/Tháng (\d+)\/(\d+)/);
                                if (m) return Number(m[2]) * 100 + Number(m[1]);
                                return 0;
                            };
                            return getYearMonth(b) - getYearMonth(a);
                        });

                        sortedMonths.forEach((monthName) => {
                            const mGrp = monthGroups.get(monthName)!;

                            // Add Month Header Row (green accent)
                            const monthRow = worksheet.addRow([
                                '',
                                '',
                                '',
                                `📅 ${monthName}`, // Tag column
                                group.productUnit,
                                cleanNum(mGrp.totalQty),
                                cleanNum(mGrp.totalKg)
                            ]);
                            monthRow.font = { bold: true, color: { argb: '0F5132' } }; // Dark green
                            monthRow.eachCell((cell, colIdx) => {
                                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                                if (colIdx === 4) {
                                    cell.alignment = { horizontal: 'left' };
                                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1E7DD' } }; // Light green fill
                                }
                                if (colIdx >= 6) {
                                    cell.alignment = { horizontal: 'right' };
                                    const val = cell.value;
                                    if (typeof val === 'number' && Number.isInteger(val)) {
                                        cell.numFmt = '#,##0';
                                    } else {
                                        cell.numFmt = '#,##0.###';
                                    }
                                }
                            });

                            // Process LSX Groups & Non-LSX under this month
                            const lsxGroups = new Map<string, { totalQty: number, totalKg: number, items: { tag: string, qty: number, kg: number }[] }>();
                            const nonLsxItems: { tag: string, qty: number, kg: number }[] = [];

                            mGrp.items.forEach((subItem) => {
                                const tagStr = subItem.tag;
                                const qty = subItem.qty;
                                const kg = subItem.kg;

                                if (tagStr.includes('LSX: ')) {
                                    const parts = tagStr.split('; ').map(p => p.trim());
                                    const lsxPart = parts.find(p => p.startsWith('LSX: '));
                                    if (lsxPart) {
                                        const otherParts = parts.filter(p => !p.startsWith('LSX: '));
                                        const subTags = otherParts.length > 0 ? otherParts.join('; ') : 'Không có mã phụ';
                                        if (!lsxGroups.has(lsxPart)) {
                                            lsxGroups.set(lsxPart, { totalQty: 0, totalKg: 0, items: [] });
                                        }
                                        const lsxGrp = lsxGroups.get(lsxPart)!;
                                        lsxGrp.totalQty += qty;
                                        lsxGrp.totalKg += kg;
                                        lsxGrp.items.push({ tag: subTags, qty, kg });
                                        return;
                                    }
                                }
                                nonLsxItems.push({ tag: tagStr, qty, kg });
                            });

                            // Render LSX groups
                            Array.from(lsxGroups.entries())
                                .sort((a, b) => b[1].totalQty - a[1].totalQty)
                                .forEach(([lsxName, lsxGrp]) => {
                                    const lsxRow = worksheet.addRow([
                                        '',
                                        '',
                                        '',
                                        `   ${lsxName}`, // Thụt lề 3 khoảng trắng
                                        group.productUnit,
                                        cleanNum(lsxGrp.totalQty),
                                        cleanNum(lsxGrp.totalKg)
                                    ]);
                                    lsxRow.font = { bold: true, color: { argb: 'C65911' } }; // Dark orange
                                    lsxRow.eachCell((cell, colIdx) => {
                                        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                                        if (colIdx === 4) {
                                            cell.alignment = { horizontal: 'left' };
                                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2CC' } }; // Light orange fill
                                        }
                                        if (colIdx >= 6) {
                                            cell.alignment = { horizontal: 'right' };
                                            const val = cell.value;
                                            if (typeof val === 'number' && Number.isInteger(val)) {
                                                cell.numFmt = '#,##0';
                                            } else {
                                                cell.numFmt = '#,##0.###';
                                            }
                                        }
                                    });

                                    // Render sub items under LSX
                                    lsxGrp.items
                                        .sort((a, b) => (a.tag === 'Không có mã phụ' ? 1 : b.tag === 'Không có mã phụ' ? -1 : b.qty - a.qty))
                                        .forEach((subItem) => {
                                            const isNoTag = subItem.tag === 'Không có mã phụ';
                                            const subRow = worksheet.addRow([
                                                '',
                                                '',
                                                '',
                                                isNoTag ? '      (Không có mã phụ)' : `      ${subItem.tag.replace(/@/g, group.productSku)}`, // Thụt lề 6 khoảng trắng
                                                group.productUnit,
                                                cleanNum(subItem.qty),
                                                cleanNum(subItem.kg)
                                            ]);
                                            subRow.eachCell((cell, colIdx) => {
                                                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                                                if (colIdx === 4) cell.font = { italic: true, color: { argb: isNoTag ? 'BFBFBF' : '404040' } };
                                                if (colIdx >= 6) {
                                                    cell.alignment = { horizontal: 'right' };
                                                    const val = cell.value;
                                                    if (typeof val === 'number' && Number.isInteger(val)) {
                                                        cell.numFmt = '#,##0';
                                                    } else {
                                                        cell.numFmt = '#,##0.###';
                                                    }
                                                }
                                            });
                                        });
                                });

                            // Render Non-LSX items under this month
                            nonLsxItems
                                .sort((a, b) => (a.tag === 'Không có mã phụ' ? 1 : b.tag === 'Không có mã phụ' ? -1 : b.qty - a.qty))
                                .forEach((subItem) => {
                                    const isNoTag = subItem.tag === 'Không có mã phụ';
                                    const vRow = worksheet.addRow([
                                        '',
                                        '',
                                        '',
                                        isNoTag ? '   Gốc ( còn lại )' : `   ${subItem.tag.replace(/@/g, group.productSku)}`, // Thụt lề 3 khoảng trắng
                                        group.productUnit,
                                        cleanNum(subItem.qty),
                                        cleanNum(subItem.kg)
                                    ]);

                                    if (isNoTag) {
                                        vRow.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9C4' } }; // Light yellow fill
                                        vRow.getCell(4).font = { italic: true, bold: true };
                                    }

                                    vRow.eachCell((cell, colIdx) => {
                                        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                                        if (colIdx === 4 && !isNoTag) cell.font = { italic: true };
                                        if (colIdx >= 6) {
                                            cell.alignment = { horizontal: 'right' };
                                            const val = cell.value;
                                            if (typeof val === 'number' && Number.isInteger(val)) {
                                                cell.numFmt = '#,##0';
                                            } else {
                                                cell.numFmt = '#,##0.###';
                                            }
                                        }
                                    });
                                });
                        });
                    } else {
                        // Logic mặc định cho lot/tags bình thường
                        const lsxGroups = new Map<string, { totalQty: number, totalKg: number, items: { tag: string, qty: number, kg: number }[] }>();
                        const nonLsxItems: { tag: string, qty: number, kg: number }[] = [];

                        variantEntries.forEach(([tagStr, vData]) => {
                            const qty = vData.totalQuantity || 0;
                            const kg = vData.totalKg || 0;

                            if (tagStr.includes('LSX: ')) {
                                const parts = tagStr.split('; ').map(p => p.trim());
                                const lsxPart = parts.find(p => p.startsWith('LSX: '));
                                if (lsxPart) {
                                    const otherParts = parts.filter(p => !p.startsWith('LSX: '));
                                    const subTags = otherParts.length > 0 ? otherParts.join('; ') : 'Không có mã phụ';
                                    if (!lsxGroups.has(lsxPart)) {
                                        lsxGroups.set(lsxPart, { totalQty: 0, totalKg: 0, items: [] });
                                    }
                                    const vGroup = lsxGroups.get(lsxPart)!;
                                    vGroup.totalQty += qty;
                                    vGroup.totalKg += kg;
                                    vGroup.items.push({ tag: subTags, qty, kg });
                                    return;
                                }
                            }
                            nonLsxItems.push({ tag: tagStr, qty, kg });
                        });

                        // 1. Render LSX Groups
                        Array.from(lsxGroups.entries())
                            .sort((a, b) => b[1].totalQty - a[1].totalQty)
                            .forEach(([lsxName, vGroup]) => {
                                // LSX Header Row
                                const lsxRow = worksheet.addRow([
                                    '',
                                    '',
                                    '',
                                    lsxName, // Tag column
                                    group.productUnit,
                                    cleanNum(vGroup.totalQty),
                                    cleanNum(vGroup.totalKg)
                                ]);
                                lsxRow.font = { bold: true, color: { argb: 'C65911' } }; // Dark orange
                                lsxRow.eachCell((cell, colIdx) => {
                                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                                    if (colIdx === 4) cell.alignment = { horizontal: 'left' };
                                    if (colIdx >= 6) {
                                        cell.alignment = { horizontal: 'right' };
                                        const val = cell.value;
                                        if (typeof val === 'number' && Number.isInteger(val)) {
                                            cell.numFmt = '#,##0';
                                        } else {
                                            cell.numFmt = '#,##0.###';
                                        }
                                    }
                                });
                                lsxRow.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2CC' } };

                                // LSX Sub-items
                                vGroup.items
                                    .sort((a, b) => (a.tag === 'Không có mã phụ' ? 1 : b.tag === 'Không có mã phụ' ? -1 : b.qty - a.qty))
                                    .forEach((subItem) => {
                                        const isNoTag = subItem.tag === 'Không có mã phụ';
                                        const subRow = worksheet.addRow([
                                            '',
                                            '',
                                            '',
                                            isNoTag ? '   (Không có mã phụ)' : `   ${subItem.tag.replace(/@/g, group.productSku)}`,
                                            group.productUnit,
                                            cleanNum(subItem.qty),
                                            cleanNum(subItem.kg)
                                        ]);
                                        subRow.eachCell((cell, colIdx) => {
                                            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                                            if (colIdx === 4) cell.font = { italic: true, color: { argb: isNoTag ? 'BFBFBF' : '404040' } };
                                            if (colIdx >= 6) {
                                                cell.alignment = { horizontal: 'right' };
                                                const val = cell.value;
                                                if (typeof val === 'number' && Number.isInteger(val)) {
                                                    cell.numFmt = '#,##0';
                                                } else {
                                                    cell.numFmt = '#,##0.###';
                                                }
                                            }
                                        });
                                    });
                            });

                        // 2. Render Non-LSX Items
                        nonLsxItems
                            .sort((a, b) => (a.tag === 'Không có mã phụ' ? 1 : b.tag === 'Không có mã phụ' ? -1 : b.qty - a.qty))
                            .forEach((subItem) => {
                                const isNoTag = subItem.tag === 'Không có mã phụ';
                                const vRow = worksheet.addRow([
                                    '',
                                    '',
                                    '',
                                    isNoTag ? 'Gốc ( còn lại )' : subItem.tag.replace(/@/g, group.productSku),
                                    group.productUnit,
                                    cleanNum(subItem.qty),
                                    cleanNum(subItem.kg)
                                ]);

                                if (isNoTag) {
                                    vRow.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9C4' } }; // Very light yellow
                                    vRow.getCell(4).font = { italic: true, bold: true };
                                }

                                vRow.eachCell((cell, colIdx) => {
                                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                                    if (colIdx === 4 && !isNoTag) cell.font = { italic: true };
                                    if (colIdx >= 6) {
                                        cell.alignment = { horizontal: 'right' };
                                        const val = cell.value;
                                        if (typeof val === 'number' && Number.isInteger(val)) {
                                            cell.numFmt = '#,##0';
                                        } else {
                                            cell.numFmt = '#,##0.###';
                                        }
                                    }
                                });
                            });
                    }
                }
            } else {
                if (data.viewMode === 'month') {
                    const variantEntries = Array.from(group.variants.entries() as [string, any][]);
                    const hasRealVariants = variantEntries.length > 1 || (variantEntries.length === 1 && variantEntries[0][0] !== 'Không có mã phụ');
                    
                    if (hasRealVariants) {
                        // Gom nhóm theo Tháng sản xuất
                        const monthGroups = new Map<string, { totalQty: number, totalKg: number }>();

                        variantEntries.forEach(([variantKey, vData]) => {
                            const qty = vData.totalQuantity || 0;
                            const kg = vData.totalKg || 0;
                            const parts = variantKey.split('__');
                            const monthName = parts[0] || 'Không xác định';

                            if (!monthGroups.has(monthName)) {
                                monthGroups.set(monthName, { totalQty: 0, totalKg: 0 });
                            }
                            const mGrp = monthGroups.get(monthName)!;
                            mGrp.totalQty += qty;
                            mGrp.totalKg += kg;
                        });

                        const sortedMonths = Array.from(monthGroups.keys()).sort((a, b) => {
                            if (a === 'Không xác định') return 1;
                            if (b === 'Không xác định') return -1;
                            const getYearMonth = (s: string) => {
                                const m = s.match(/Tháng (\d+)\/(\d+)/);
                                if (m) return Number(m[2]) * 100 + Number(m[1]);
                                return 0;
                            };
                            return getYearMonth(b) - getYearMonth(a);
                        });

                        sortedMonths.forEach((monthName) => {
                            const mGrp = monthGroups.get(monthName)!;
                            const monthRow = worksheet.addRow([
                                '', // STT
                                '', // Mã SP
                                `   📅 ${monthName}`, // Tên sản phẩm
                                group.productUnit, // ĐVT
                                cleanNum(mGrp.totalQty), // Số lượng
                                cleanNum(mGrp.totalKg) // Quy đổi
                            ]);
                            
                            monthRow.eachCell((cell, colIdx) => {
                                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                                if (colIdx === 3) {
                                    cell.font = { italic: true, color: { argb: '0F5132' } }; // Màu xanh lá italic
                                    cell.alignment = { horizontal: 'left' };
                                }
                                if (colIdx >= 5) {
                                    cell.alignment = { horizontal: 'right' };
                                    const val = cell.value;
                                    if (typeof val === 'number' && Number.isInteger(val)) {
                                        cell.numFmt = '#,##0';
                                    } else {
                                        cell.numFmt = '#,##0.###';
                                    }
                                }
                            });
                        });
                    }
                }
            }
        });
    } else if (data.type === 'labels') {
        let stt = 1;
        data.items.forEach((item) => {
            const row = worksheet.addRow([
                stt++,
                item.productCode,
                item.productName,
                item.semi_finished_lot_code,
                item.finished_lot_code,
                cleanNum(item.labelCount),
                cleanNum(item.totalQuantity),
                item.unit
            ]);
            row.eachCell(cell => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });
            const cellCount = row.getCell(6);
            cellCount.alignment = { horizontal: 'right' };
            cellCount.numFmt = '#,##0';
            
            const cellQty = row.getCell(7);
            cellQty.alignment = { horizontal: 'right' };
            cellQty.numFmt = '#,##0.###';
        });

        // Add summary row
        const summaryRow = worksheet.addRow([
            'Tổng cộng tồn tem nhãn:',
            '', '', '', '', // B, C, D, E
            data.items.reduce((acc, x) => acc + (x.labelCount || 0), 0),
            data.items.reduce((acc, x) => acc + (x.isUnconvertible ? 0 : (x.totalQuantity || 0)), 0),
            data.items[0]?.unit || 'Kg'
        ]);
        worksheet.mergeCells(`A${summaryRow.number}:E${summaryRow.number}`);
        summaryRow.font = { bold: true };
        summaryRow.eachCell((cell, colIdx) => {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            if (colIdx >= 6) {
                cell.alignment = { horizontal: 'right' };
                if (colIdx === 6) cell.numFmt = '#,##0';
                if (colIdx === 7) cell.numFmt = '#,##0.###';
            }
        });
    } else {
        data.items.forEach((item) => {
            const row = worksheet.addRow([
                item.productCode,
                item.productName,
                item.unit,
                cleanNum(item.accountingBalance),
                cleanNum(item.lotBalance),
                cleanNum(item.diff)
            ]);
            row.eachCell(cell => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });
            [4, 5, 6].forEach(col => {
                const cell = row.getCell(col);
                cell.alignment = { horizontal: 'right' };
                const val = cell.value;
                if (typeof val === 'number' && Number.isInteger(val)) {
                    cell.numFmt = '#,##0';
                } else {
                    cell.numFmt = '#,##0.###';
                }
            });
        });
    }

    // 6. Signature section
    currentRow = worksheet.lastRow!.number + 3;
    const signRow = worksheet.getRow(currentRow);
    const lastColIdx = worksheet.columns.length;
    
    signRow.getCell(lastColIdx - 1).value = `Ngày ...... tháng ...... năm ......`;
    signRow.getCell(lastColIdx - 1).font = { italic: true };
    currentRow++;

    const signTitleRow = worksheet.getRow(currentRow);
    signTitleRow.getCell(2).value = 'Người Lập Biểu';
    signTitleRow.getCell(Math.floor(lastColIdx / 2) + 1).value = 'Thủ Kho';
    signTitleRow.getCell(lastColIdx - 1).value = 'Giám Đốc';
    signTitleRow.eachCell(cell => { cell.font = { bold: true }; cell.alignment = { horizontal: 'center' }; });
}
