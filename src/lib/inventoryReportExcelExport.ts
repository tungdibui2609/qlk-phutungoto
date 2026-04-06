import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { CompanyInfo } from '@/hooks/usePrintCompanyInfo';

interface InventoryReportExportData {
    type: 'accounting' | 'lot' | 'reconciliation' | 'category' | 'tags';
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
    const worksheet = workbook.addWorksheet('Bao Cao Ton Kho');

    // 1. Set Columns based on report type
    if (data.type === 'accounting') {
        worksheet.columns = [
            { header: 'STT', key: 'stt', width: 6 },
            { header: 'Tên Sản Phẩm', key: 'productName', width: 40 },
            { header: 'Mã SP', key: 'productCode', width: 20 },
            { header: 'ĐVT', key: 'unit', width: 10 },
            { header: 'Tồn Đầu', key: 'opening', width: 15 },
            { header: 'Nhập', key: 'qtyIn', width: 15 },
            { header: 'Xuất', key: 'qtyOut', width: 15 },
            { header: 'Tồn Cuối', key: 'balance', width: 15 },
        ];
    } else if (data.type === 'lot' || data.type === 'category' || data.type === 'tags') {
        worksheet.columns = [
            { header: 'STT', key: 'stt', width: 6 },
            { header: 'Mã SP', key: 'productCode', width: 20 },
            { header: 'Tên sản phẩm', key: 'productName', width: 40 },
            ...(data.type !== 'category' ? [{ header: 'Mã phụ / Phân loại', key: 'tags', width: 30 }] : []),
            { header: 'ĐVT', key: 'unit', width: 10 },
            { header: 'Số lượng', key: 'quantity', width: 15 },
            { header: 'Quy đổi (Kg)', key: 'kg', width: 15 },
        ];
    } else {
        worksheet.columns = [
            { header: 'Mã SP', key: 'productCode', width: 20 },
            { header: 'Tên Sản Phẩm', key: 'productName', width: 40 },
            { header: 'ĐVT', key: 'unit', width: 10 },
            { header: 'Tồn Kế Toán', key: 'accountingBalance', width: 15 },
            { header: 'Tổng LOT', key: 'lotBalance', width: 15 },
            { header: 'Chênh Lệch', key: 'diff', width: 15 },
        ];
    }

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
            ? 'BÁO CÁO TỒN KHO THEO LOT' 
            : data.type === 'category'
                ? 'BÁO CÁO TỒN KHO THEO DANH MỤC'
                : 'BẢNG ĐỐI CHIẾU TỒN KHO VS KẾ TOÁN';
    
    const lastCol = String.fromCharCode(65 + worksheet.columns.length - 1);
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
    headerRow.values = worksheet.columns.map(c => String(c.header || ''));
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
                cleanNum(catTotals.balance)
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
                    cell.numFmt = '#,##0';
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
                    cleanNum(item.balance)
                ]);
                row.eachCell(cell => {
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                });
                // Align quantity columns
                [5, 6, 7, 8].forEach(col => {
                    row.getCell(col).alignment = { horizontal: 'right' };
                    row.getCell(col).numFmt = '#,##0';
                });
            });
        });
    } else if (data.type === 'lot' || data.type === 'category' || data.type === 'tags') {
        // Here item is GroupedLot or variant logic
        // We'll follow the visual structure: Main row then variant rows
        let stt = 1;
        let lastCategory: string | null = null;
        
        data.items.forEach((group: any) => {
            // Category Header Logic
            if (data.type === 'category' && group.categoryName && group.categoryName !== lastCategory) {
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
            if (data.type !== 'category') {
                rowValues.splice(3, 0, ''); // Insert empty tag at index 3
            }

            const mainRow = worksheet.addRow(rowValues);
            mainRow.font = { bold: true };
            mainRow.eachCell(cell => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });
            const qtyCol = data.type === 'category' ? 5 : 6;
            const kgCol = data.type === 'category' ? 6 : 7;
            [qtyCol, kgCol].forEach(col => {
                mainRow.getCell(col).alignment = { horizontal: 'right' };
                mainRow.getCell(col).numFmt = '#,##0';
            });

            // Variants
            let variantEntries = Array.from(group.variants.entries() as any[]);
            const hasRealVariants = variantEntries.length > 1 || (variantEntries.length === 1 && variantEntries[0][0] !== 'Không có mã phụ');
            
            if (hasRealVariants && data.type !== 'category') {
                // Sort to put 'Không có mã phụ' at the end
                variantEntries.sort((a, b) => {
                    if (a[0] === 'Không có mã phụ') return 1;
                    if (b[0] === 'Không có mã phụ') return -1;
                    return a[0].localeCompare(b[0]);
                });

                variantEntries.forEach(([tag, vData]: any) => {
                    const vRow = worksheet.addRow([
                        '',
                        '',
                        '',
                        tag === 'Không có mã phụ' ? 'Gốc ( còn lại )' : tag,
                        group.productUnit,
                        cleanNum(vData.totalQuantity),
                        cleanNum(vData.totalKg)
                    ]);
                    vRow.eachCell(cell => {
                        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    });
                    [6, 7].forEach(col => {
                        vRow.getCell(col).alignment = { horizontal: 'right' };
                        vRow.getCell(col).numFmt = '#,##0';
                    });
                    vRow.getCell(4).font = { italic: true };
                });
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
                row.getCell(col).alignment = { horizontal: 'right' };
                row.getCell(col).numFmt = '#,##0';
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

    // Save
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `Ton_kho_${new Date().toISOString().split('T')[0]}.xlsx`;
    saveAs(new Blob([buffer]), fileName);
}
