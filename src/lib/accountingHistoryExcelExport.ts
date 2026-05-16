import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format, parseISO } from 'date-fns';
import { CompanyInfo } from '@/hooks/usePrintCompanyInfo';
import { formatQuantityFull } from './numberUtils';

export interface AccountingHistoryExportData {
    viewMode: 'summary' | 'daily';
    startDate: string;
    endDate: string;
    systemType: string;
    inboundTypes: any[];
    outboundTypes: any[];
    movements: any[];
    dailyMovements?: any[];
    summary: any;
    targetUnitName?: string | null;
    companyInfo: CompanyInfo | null;
}

/**
 * Clean number values to avoid issues in Excel
 */
function cleanNum(val: any): number {
    const n = Number(val) || 0;
    return Math.round(n * 1000) / 1000; // Round to 3 decimal places for accuracy
}

export async function exportAccountingHistoryToExcel(data: AccountingHistoryExportData) {
    const { 
        viewMode,
        inboundTypes, 
        outboundTypes, 
        movements, 
        dailyMovements = [],
        summary, 
        startDate, 
        endDate, 
        targetUnitName,
        companyInfo,
        systemType
    } = data;

    const workbook = new ExcelJS.Workbook();
    const sheetName = viewMode === 'summary' ? 'Báo cáo NXT Hạch toán' : 'Nhật ký biến động';
    const worksheet = workbook.addWorksheet(sheetName);

    let currentRow = 1;

    // 2. Add Company Info Header
    if (companyInfo) {
        worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
        const nameCell = worksheet.getCell(`A${currentRow}`);
        nameCell.value = companyInfo.name?.toUpperCase();
        nameCell.font = { bold: true, size: 10 };
        currentRow++;

        worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
        const addrCell = worksheet.getCell(`A${currentRow}`);
        addrCell.value = `Địa chỉ: ${companyInfo.address || ''}`;
        addrCell.font = { size: 9 };
        currentRow++;

        worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
        const contactCell = worksheet.getCell(`A${currentRow}`);
        contactCell.value = `${companyInfo.email ? `Email: ${companyInfo.email} | ` : ''}ĐT: ${companyInfo.phone || ''}`;
        contactCell.font = { size: 9 };
        currentRow++;
    }

    currentRow++; // Spacer

    // 3. Report Title
    const reportTitle = viewMode === 'summary' 
        ? `BÁO CÁO TỔNG HỢP NHẬP XUẤT TỒN (HẠCH TOÁN)`
        : `NHẬT KÝ BIẾN ĐỘNG KHO (HẠCH TOÁN)`;
    
    const totalCols = viewMode === 'summary'
        ? 5 + inboundTypes.length + 1 + outboundTypes.length + 1 + 2 // STT, SKU, Name, Unit, Opening, InTypes, TotalIn, OutTypes, TotalOut, Closing, Vouchers
        : 7; // STT, Ngày, SKU, Tên SP, ĐVT, Nhập, Xuất
        
    const lastColLetter = String.fromCharCode(65 + totalCols - 1);

    worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
    const titleCell = worksheet.getCell(`A${currentRow}`);
    titleCell.value = reportTitle;
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center' };
    currentRow++;

    worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
    const dateCell = worksheet.getCell(`A${currentRow}`);
    dateCell.value = `Từ ngày: ${startDate} đến ngày: ${endDate}`;
    dateCell.alignment = { horizontal: 'center' };
    dateCell.font = { italic: true };
    currentRow++;

    if (systemType) {
        worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
        const sysCell = worksheet.getCell(`A${currentRow}`);
        sysCell.value = `Hệ thống: ${systemType.toUpperCase()}${targetUnitName ? ` | Đơn vị quy đổi: ${targetUnitName}` : ' | Đơn vị gốc'}`;
        sysCell.alignment = { horizontal: 'center' };
        sysCell.font = { size: 10 };
        currentRow++;
    }

    currentRow++; // Spacer before table

    if (viewMode === 'summary') {
        // --- SUMMARY VIEW EXPORT LOGIC ---
        // 4. Build Table Headers (2 Levels)
        const headerRow1Idx = currentRow;
        const headerRow2Idx = currentRow + 1;
        const headerRow1 = worksheet.getRow(headerRow1Idx);
        const headerRow2 = worksheet.getRow(headerRow2Idx);

        // Initial Static Headers
        headerRow1.getCell(1).value = 'STT';
        headerRow1.getCell(2).value = 'MÃ SP';
        headerRow1.getCell(3).value = 'TÊN SẢN PHẨM';
        headerRow1.getCell(4).value = 'ĐVT';
        headerRow1.getCell(5).value = 'TỒN ĐẦU KỲ';

        // Merge Level 1 for static columns
        [1, 2, 3, 4, 5].forEach(col => worksheet.mergeCells(headerRow1Idx, col, headerRow2Idx, col));

        // INBOUND SECTION
        const inboundStartCol = 6;
        const inboundCount = inboundTypes.length;
        const inboundTotalCol = inboundStartCol + inboundCount;
        
        worksheet.mergeCells(headerRow1Idx, inboundStartCol, headerRow1Idx, inboundTotalCol);
        headerRow1.getCell(inboundStartCol).value = 'NHẬP KHO';
        
        inboundTypes.forEach((t, i) => {
            headerRow2.getCell(inboundStartCol + i).value = t.name;
        });
        headerRow2.getCell(inboundTotalCol).value = 'TỔNG NHẬP';

        // OUTBOUND SECTION
        const outboundStartCol = inboundTotalCol + 1;
        const outboundCount = outboundTypes.length;
        const outboundTotalCol = outboundStartCol + outboundCount;

        worksheet.mergeCells(headerRow1Idx, outboundStartCol, headerRow1Idx, outboundTotalCol);
        headerRow1.getCell(outboundStartCol).value = 'XUẤT KHO';

        outboundTypes.forEach((t, i) => {
            headerRow2.getCell(outboundStartCol + i).value = t.name;
        });
        headerRow2.getCell(outboundTotalCol).value = 'TỔNG XUẤT';

        // END SECTION
        const closingCol = outboundTotalCol + 1;
        const voucherCol = closingCol + 1;

        headerRow1.getCell(closingCol).value = 'TỒN CUỐI KỲ';
        headerRow1.getCell(voucherCol).value = 'CHỨNG TỪ';

        worksheet.mergeCells(headerRow1Idx, closingCol, headerRow2Idx, closingCol);
        worksheet.mergeCells(headerRow1Idx, voucherCol, headerRow2Idx, voucherCol);

        // Style Headers
        [headerRow1, headerRow2].forEach(row => {
            row.eachCell(cell => {
                cell.font = { bold: true, size: 9 };
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
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
        });

        // Color sections
        headerRow1.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EBF1DE' } };
        headerRow1.getCell(inboundStartCol).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2EFDA' } };
        headerRow1.getCell(outboundStartCol).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2CC' } };
        headerRow1.getCell(closingCol).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E1E1E1' } };

        // Column widths
        worksheet.getColumn(1).width = 5;
        worksheet.getColumn(2).width = 15;
        worksheet.getColumn(3).width = 35;
        worksheet.getColumn(4).width = 10;
        worksheet.getColumn(5).width = 15;
        for (let i = inboundStartCol; i <= outboundTotalCol; i++) worksheet.getColumn(i).width = 12;
        worksheet.getColumn(closingCol).width = 15;
        worksheet.getColumn(voucherCol).width = 10;

        currentRow = headerRow2Idx + 1;

        // 5. Add Body Data
        movements.forEach((mov, idx) => {
            const rowData = [
                idx + 1,
                mov.sku,
                mov.name,
                mov.unit,
                cleanNum(mov.opening)
            ];

            inboundTypes.forEach(t => {
                rowData.push(mov.inboundItems[t.id] ? cleanNum(mov.inboundItems[t.id]) : 0);
            });
            rowData.push(cleanNum(mov.totalIn));

            outboundTypes.forEach(t => {
                rowData.push(mov.outboundItems[t.id] ? cleanNum(mov.outboundItems[t.id]) : 0);
            });
            rowData.push(cleanNum(mov.totalOut));

            rowData.push(cleanNum(mov.closing));
            rowData.push(mov.vouchers.size);

            const row = worksheet.addRow(rowData);
            row.eachCell((cell, colNumber) => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                if (colNumber >= 5 && colNumber <= closingCol) {
                    const val = Number(cell.value);
                    cell.numFmt = Number.isInteger(val) ? '#,##0' : '#,##0.###';
                    cell.alignment = { horizontal: 'right' };
                } else if (colNumber === voucherCol) {
                    cell.alignment = { horizontal: 'center' };
                }
            });

            row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F9FBF2' } };
            row.getCell(inboundTotalCol).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EBF1DE' } };
            row.getCell(outboundTotalCol).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9E5' } };
            row.getCell(closingCol).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F2F2F2' } };
        });

        // 6. Summary Row
        const summaryRowData = [
            'TỔNG CỘNG',
            '', '', '',
            cleanNum(summary.opening)
        ];
        inboundTypes.forEach(() => summaryRowData.push(''));
        summaryRowData.push(cleanNum(summary.inbound));
        outboundTypes.forEach(() => summaryRowData.push(''));
        summaryRowData.push(cleanNum(summary.outbound));
        summaryRowData.push(cleanNum(summary.closing));
        summaryRowData.push('');

        const summaryRow = worksheet.addRow(summaryRowData);
        worksheet.mergeCells(summaryRow.number, 1, summaryRow.number, 4);
        
        summaryRow.eachCell((cell, colNumber) => {
            cell.font = { bold: true };
            cell.border = { top: { style: 'medium' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            if (colNumber >= 5 && colNumber <= closingCol) {
                const val = Number(cell.value);
                cell.numFmt = Number.isInteger(val) ? '#,##0' : '#,##0.###';
                cell.alignment = { horizontal: 'right' };
            }
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D9D9D9' } };
        });

        currentRow = summaryRow.number;
    } else {
        // --- DAILY VIEW EXPORT LOGIC ---
        const headerRow = worksheet.getRow(currentRow);
        const headers = ['STT', 'NGÀY', 'MÃ SP', 'TÊN SẢN PHẨM', 'ĐVT', 'NHẬP KHO', 'XUẤT KHO'];
        headers.forEach((h, i) => {
            const cell = headerRow.getCell(i + 1);
            cell.value = h;
            cell.font = { bold: true, size: 10 };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F2F2F2' } };
        });

        // Column widths
        worksheet.getColumn(1).width = 5;
        worksheet.getColumn(2).width = 12;
        worksheet.getColumn(3).width = 15;
        worksheet.getColumn(4).width = 40;
        worksheet.getColumn(5).width = 10;
        worksheet.getColumn(6).width = 15;
        worksheet.getColumn(7).width = 15;

        currentRow++;

        dailyMovements.forEach((mov, idx) => {
            const rowData = [
                idx + 1,
                format(parseISO(mov.date), 'dd/MM/yyyy'),
                mov.sku,
                mov.name,
                mov.unit,
                mov.totalIn ? cleanNum(mov.totalIn) : 0,
                mov.totalOut ? cleanNum(mov.totalOut) : 0
            ];

            const row = worksheet.addRow(rowData);
            row.eachCell((cell, colNumber) => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                if (colNumber >= 6) {
                    const val = Number(cell.value);
                    cell.numFmt = Number.isInteger(val) ? '#,##0' : '#,##0.###';
                    cell.alignment = { horizontal: 'right' };
                }
                if (colNumber === 2) cell.alignment = { horizontal: 'center' };
            });
        });

        // Summary row for daily
        const totalIn = dailyMovements.reduce((sum, m) => sum + (m.totalIn || 0), 0);
        const totalOut = dailyMovements.reduce((sum, m) => sum + (m.totalOut || 0), 0);
        
        const summaryRow = worksheet.addRow(['TỔNG CỘNG', '', '', '', '', cleanNum(totalIn), cleanNum(totalOut)]);
        worksheet.mergeCells(summaryRow.number, 1, summaryRow.number, 5);
        summaryRow.eachCell((cell, colNumber) => {
            cell.font = { bold: true };
            cell.border = { top: { style: 'medium' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            if (colNumber >= 6) {
                const val = Number(cell.value);
                cell.numFmt = Number.isInteger(val) ? '#,##0' : '#,##0.###';
                cell.alignment = { horizontal: 'right' };
            }
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D9D9D9' } };
        });

        currentRow = summaryRow.number;
    }

    // 7. Footer - Signatures
    currentRow = currentRow + 3;
    const signRow = worksheet.getRow(currentRow);
    const signCol = viewMode === 'summary' ? 6 : 5;
    signRow.getCell(signCol).value = `Ngày ...... tháng ...... năm ......`;
    signRow.getCell(signCol).font = { italic: true };
    signRow.getCell(signCol).alignment = { horizontal: 'center' };
    currentRow++;

    const signTitleRow = worksheet.getRow(currentRow);
    if (viewMode === 'summary') {
        signTitleRow.getCell(3).value = 'NGƯỜI LẬP BIỂU';
        signTitleRow.getCell(7).value = 'THỦ KHO';
        signTitleRow.getCell(9).value = 'GIÁM ĐỐC';
    } else {
        signTitleRow.getCell(2).value = 'NGƯỜI LẬP BIỂU';
        signTitleRow.getCell(4).value = 'THỦ KHO';
        signTitleRow.getCell(6).value = 'GIÁM ĐỐC';
    }
    
    signTitleRow.eachCell(cell => {
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center' };
    });

    // 8. Generate and Download
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `NXT_HachToan_${viewMode}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    saveAs(new Blob([buffer]), fileName);
}

