import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { CompanyInfo } from '@/hooks/usePrintCompanyInfo';

interface ExportData {
    type: 'inbound' | 'outbound';
    printType: 'internal' | 'official';
    order: any;
    items: any[];
    companyInfo: CompanyInfo | null;
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
        debitAccount?: string;
        creditAccount?: string;
        amountInWords?: string;
        attachedDocs?: string;
        vehicleNumber?: string;
        containerNumber?: string;
        sealNumber?: string;
        signatures: {
            title: string;
            name: string;
        }[];
        signDate: {
            day: string;
            month: string;
            year: string;
        };
        // Inbound template specific fields
        theoDoc?: string;
        theoSo?: string;
        theoDate?: string;
        theoCua?: string;
    };
    modules: {
        hasFinancials: boolean;
        hasConversion: boolean;
        targetUnit?: string;
    };
}

export async function exportToExcel(data: ExportData) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(data.type === 'inbound' ? 'Phieu Nhap Kho' : 'Phieu Xuat Kho');

    // Set columns width
    worksheet.columns = [
        { width: 5 },  // A: STT
        { width: 35 }, // B: Tên hàng
        { width: 15 }, // C: Quy cách
        { width: 10 }, // D: ĐVT
        { width: 12 }, // E: Số lượng (Yêu cầu/Theo CT)
        { width: 12 }, // F: Số lượng (Thực nhập/Thực xuất)
        { width: 12 }, // G: Quy đổi
        { width: 15 }, // H: Đơn giá
        { width: 18 }, // I: Thành tiền
        { width: 15 }, // J: Ghi chú
    ];

    // 1. Header: Company Info
    if (data.companyInfo) {
        const nameCell = worksheet.getCell('A1');
        nameCell.value = data.companyInfo.name?.toUpperCase();
        nameCell.font = { bold: true, size: 10 };
        worksheet.mergeCells('A1:D1');

        const addrCell = worksheet.getCell('A2');
        addrCell.value = `Địa chỉ: ${data.companyInfo.address}`;
        addrCell.font = { size: 9 };
        worksheet.mergeCells('A2:D2');

        const contactCell = worksheet.getCell('A3');
        contactCell.value = `${data.companyInfo.email ? `Email: ${data.companyInfo.email} | ` : ''}ĐT: ${data.companyInfo.phone || ''}`;
        contactCell.font = { size: 9 };
        worksheet.mergeCells('A3:D3');
    }

    // 2. Legal Header (Official only)
    if (data.printType === 'official') {
        const legalCell = worksheet.getCell('H1');
        legalCell.value = `Mẫu số ${data.type === 'inbound' ? '01' : '02'} - VT`;
        legalCell.font = { bold: true, size: 9 };
        legalCell.alignment = { horizontal: 'center' };
        worksheet.mergeCells('H1:J1');

        const legalSub = worksheet.getCell('H2');
        legalSub.value = '(Ban hành theo Thông tư số 200/2014/TT-BTC';
        legalSub.font = { italic: true, size: 8 };
        legalSub.alignment = { horizontal: 'center' };
        worksheet.mergeCells('H2:J2');

        const legalSub2 = worksheet.getCell('H3');
        legalSub2.value = 'Ngày 22/12/2014 của Bộ Tài chính)';
        legalSub2.font = { italic: true, size: 8 };
        legalSub2.alignment = { horizontal: 'center' };
        worksheet.mergeCells('H3:J3');
    }

    // 3. Title
    const titleRow = 5;
    const titleCell = worksheet.getCell(`A${titleRow}`);
    titleCell.value = data.type === 'inbound' ? 'PHIẾU NHẬP KHO' : 'PHIẾU XUẤT KHO';
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center' };
    worksheet.mergeCells(`A${titleRow}:J${titleRow}`);

    const dateCell = worksheet.getCell(`A${titleRow + 1}`);
    dateCell.value = `Ngày ${data.editableFields.day} tháng ${data.editableFields.month} năm ${data.editableFields.year}`;
    dateCell.alignment = { horizontal: 'center' };
    dateCell.font = { italic: true };
    worksheet.mergeCells(`A${titleRow + 1}:J${titleRow + 1}`);

    const codeCell = worksheet.getCell(`A${titleRow + 2}`);
    codeCell.value = `Số: ${data.order.code}`;
    codeCell.alignment = { horizontal: 'center' };
    codeCell.font = { bold: true };
    worksheet.mergeCells(`A${titleRow + 2}:J${titleRow + 2}`);

    // Accounts (Financials)
    if (data.modules.hasFinancials) {
        worksheet.getCell('I5').value = `Nợ: ${data.editableFields.debitAccount || ''}`;
        worksheet.getCell('I6').value = `Có: ${data.editableFields.creditAccount || ''}`;
    }

    // 4. Order Info
    let currentRow = titleRow + 4;
    const addInfoRow = (label: string, value: string) => {
        const row = worksheet.getRow(currentRow);
        row.getCell(1).value = label;
        row.getCell(2).value = value;
        row.getCell(2).font = { bold: true };
        worksheet.mergeCells(`B${currentRow}:J${currentRow}`);
        currentRow++;
    };

    addInfoRow(data.type === 'inbound' ? '- Họ tên người giao:' : '- Họ tên người nhận hàng:', data.editableFields.customerSupplierName);
    addInfoRow('- Địa chỉ (bộ phận):', data.editableFields.customerSupplierAddress);
    addInfoRow(data.type === 'inbound' ? '- Lý do nhập:' : '- Lý do xuất kho:', data.editableFields.reasonDescription);

    // Warehouse & Location
    const whRow = worksheet.getRow(currentRow);
    whRow.getCell(1).value = data.type === 'inbound' ? '- Nhập tại kho:' : '- Xuất tại kho:';
    whRow.getCell(2).value = data.editableFields.warehouse;
    whRow.getCell(2).font = { bold: true };
    whRow.getCell(4).value = 'Địa điểm:';
    whRow.getCell(5).value = data.editableFields.location;
    whRow.getCell(5).font = { bold: true };
    currentRow++;

    addInfoRow('- Ghi chú:', data.editableFields.note);

    if (data.type === 'outbound') {
        const transRow = worksheet.getRow(currentRow);
        transRow.getCell(1).value = '- Biển số xe:';
        transRow.getCell(2).value = data.editableFields.vehicleNumber || '';
        transRow.getCell(4).value = 'Số cont:';
        transRow.getCell(5).value = data.editableFields.containerNumber || '';
        transRow.getCell(7).value = 'Số seal:';
        transRow.getCell(8).value = data.editableFields.sealNumber || '';
        currentRow++;
    }

    currentRow++; // Spacer

    // 5. Items Table Header
    const tableHeaderRow = currentRow;
    const headers = [
        'STT',
        'Tên hàng hóa, quy cách, phẩm chất',
        'Quy cách',
        'ĐVT',
        data.type === 'inbound' ? 'Theo chứng từ' : 'Yêu cầu',
        data.type === 'inbound' ? 'Thực nhập' : 'Thực xuất'
    ];

    if (data.modules.hasConversion) headers.push(`Quy đổi (${data.modules.targetUnit || ''})`);
    if (data.modules.hasFinancials && data.printType === 'official') {
        headers.push('Đơn giá');
        headers.push('Thành tiền');
    }
    if (data.printType === 'internal') headers.push('Ghi chú');

    const headerRow = worksheet.getRow(tableHeaderRow);
    headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true };
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
    currentRow++;

    // 6. Table Body
    data.items.forEach((item, index) => {
        const row = worksheet.getRow(currentRow);
        const cells = [
            index + 1,
            item.product_name || '',
            item.quyCach || '',
            item.unit || '',
            item.document_quantity || item.quantity,
            item.quantity
        ];

        if (data.modules.hasConversion) cells.push(item.convertedQty || '-');
        if (data.modules.hasFinancials && data.printType === 'official') {
            cells.push(item.price || 0);
            cells.push((item.price || 0) * item.quantity);
        }
        if (data.printType === 'internal') cells.push(item.note || '');

        cells.forEach((val, i) => {
            const cell = row.getCell(i + 1);
            cell.value = val;
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            if (typeof val === 'number') {
                if (Math.floor(val) === val) {
                    cell.numFmt = '#,##0';
                } else {
                    cell.numFmt = '#,##0.##';
                }
            }
        });
        currentRow++;
    });

    // Total Row
    const totalRow = worksheet.getRow(currentRow);
    totalRow.getCell(2).value = 'Cộng';
    totalRow.getCell(2).font = { bold: true };
    totalRow.getCell(2).alignment = { horizontal: 'center' };

    // Sum quantity
    const qtyCol = 6;
    const totalQty = data.items.reduce((sum, item) => sum + item.quantity, 0);
    totalRow.getCell(qtyCol).value = totalQty;
    totalRow.getCell(qtyCol).font = { bold: true };
    if (Math.floor(totalQty) === totalQty) {
        totalRow.getCell(qtyCol).numFmt = '#,##0';
    } else {
        totalRow.getCell(qtyCol).numFmt = '#,##0.##';
    }

    if (data.modules.hasFinancials && data.printType === 'official') {
        const totalAmount = data.items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
        const amountCol = headers.indexOf('Thành tiền') + 1;
        totalRow.getCell(amountCol).value = totalAmount;
        totalRow.getCell(amountCol).font = { bold: true };
        if (Math.floor(totalAmount) === totalAmount) {
            totalRow.getCell(amountCol).numFmt = '#,##0';
        } else {
            totalRow.getCell(amountCol).numFmt = '#,##0.##';
        }
    }

    // Border for total row
    for (let i = 1; i <= headers.length; i++) {
        totalRow.getCell(i).border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    }
    currentRow += 2;

    // 7. Footer strings
    if (data.modules.hasFinancials && data.editableFields.amountInWords) {
        const wordRow = worksheet.getRow(currentRow);
        wordRow.getCell(1).value = `- Tổng số tiền (viết bằng chữ): ${data.editableFields.amountInWords}`;
        wordRow.getCell(1).font = { italic: true };
        worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
        currentRow++;
    }
    if (data.editableFields.attachedDocs) {
        const docRow = worksheet.getRow(currentRow);
        docRow.getCell(1).value = `- Số chứng từ gốc kèm theo: ${data.editableFields.attachedDocs}`;
        worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
        currentRow++;
    }

    currentRow += 2;

    // 8. Signatures
    const signDateRow = worksheet.getRow(currentRow);
    const signDateCol = data.editableFields.signatures.length > 3 ? 4 : 3;
    signDateRow.getCell(signDateCol).value = `Ngày ${data.editableFields.signDate.day || '...'} tháng ${data.editableFields.signDate.month || '...'} năm ${data.editableFields.signDate.year || '...'}`;
    signDateRow.getCell(signDateCol).font = { italic: true };
    signDateRow.getCell(signDateCol).alignment = { horizontal: 'center' };
    worksheet.mergeCells(currentRow, signDateCol, currentRow, signDateCol + 1);
    currentRow++;

    const signHeaderRow = worksheet.getRow(currentRow);
    data.editableFields.signatures.forEach((sig, i) => {
        const cell = signHeaderRow.getCell(i + 1);
        cell.value = sig.title;
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center' };
    });
    currentRow++;

    const signNoteRow = worksheet.getRow(currentRow);
    data.editableFields.signatures.forEach((sig, i) => {
        const cell = signNoteRow.getCell(i + 1);
        cell.value = '(Ký, họ tên)';
        cell.font = { italic: true, size: 8 };
        cell.alignment = { horizontal: 'center' };
    });

    currentRow += 5; // Space for signature

    const signNameRow = worksheet.getRow(currentRow);
    data.editableFields.signatures.forEach((sig, i) => {
        const cell = signNameRow.getCell(i + 1);
        cell.value = sig.name;
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center' };
    });

    // Write and save
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `${data.type === 'inbound' ? 'Phieu_Nhap' : 'Phieu_Xuat'}_${data.order.code}.xlsx`);
}

export async function exportToExcelWithTemplate(data: ExportData, templateUrl: string) {
    const response = await fetch(templateUrl);
    const arrayBuffer = await response.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) return;

    // Replace placeholders in all cells - Merge-aware
    worksheet.eachRow((row) => {
        row.eachCell({ includeEmpty: false }, (cell) => {
            // Only process the master cell of a merged range to avoid duplication
            if (cell.value && cell === cell.master) {
                const replaceText = (text: string) => {
                    let val = text;
                    val = val.replace(/{{\s*DOC_DATE_VN\s*}}/gi, `Ngày ${data.editableFields.day} tháng ${data.editableFields.month} năm ${data.editableFields.year}`);
                    val = val.replace(/{{\s*DOC_CODE\s*}}/gi, data.order.code || '');
                    val = val.replace(/{{\s*KHACHHANG\s*}}/gi, data.editableFields.customerSupplierName || '');
                    val = val.replace(/{{\s*diachikhachhang\s*}}/gi, data.editableFields.customerSupplierAddress || '');
                    val = val.replace(/{{\s*DESCRIPTION\s*}}/gi, data.editableFields.reasonDescription || '');
                    val = val.replace(/{{\s*chinhanh\s*}}/gi, data.editableFields.warehouse || '');
                    val = val.replace(/{{\s*LOCATION\s*}}/gi, data.editableFields.location || '');
                    val = val.replace(/{{\s*BSXE\s*}}/gi, data.editableFields.vehicleNumber || '');
                    val = val.replace(/{{\s*socont\s*}}/gi, data.editableFields.containerNumber || '');
                    val = val.replace(/{{\s*soseal\s*}}/gi, data.editableFields.sealNumber || '');
                    
                    // Inbound-specific placeholders (nhà cung cấp, diễn giải, nhập tại kho)
                    val = val.replace(/{{\s*nhacungcap\s*}}/gi, data.editableFields.customerSupplierName || '');
                    val = val.replace(/{{\s*diachinacungcap\s*}}/gi, data.editableFields.customerSupplierAddress || '');
                    val = val.replace(/{{\s*diachinhacungcap\s*}}/gi, data.editableFields.customerSupplierAddress || '');
                    val = val.replace(/{{\s*nhaptaikho\s*}}/gi, data.editableFields.warehouse || '');
                    val = val.replace(/{{\s*diengiai\s*}}/gi, data.editableFields.reasonDescription || '');
                    val = val.replace(/{{\s*note\s*}}/gi, data.editableFields.note || '');

                    // Inbound: Theo chứng từ
                    val = val.replace(/{{\s*THEO_DOC\s*}}/gi, (data.editableFields as any).theoDoc || '');
                    val = val.replace(/{{\s*THEO_SO\s*}}/gi, (data.editableFields as any).theoSo || '');
                    val = val.replace(/{{\s*THEO_DATE\s*}}/gi, (data.editableFields as any).theoDate || '');
                    val = val.replace(/{{\s*THEO_CUA\s*}}/gi, (data.editableFields as any).theoCua || '');
                    
                    return val;
                };

                if (typeof cell.value === 'string') {
                    cell.value = replaceText(cell.value);
                } else if (cell.value && typeof cell.value === 'object' && 'richText' in (cell.value as any)) {
                    const rtValue = cell.value as any;
                    rtValue.richText = rtValue.richText.map((rt: any) => ({
                        ...rt,
                        text: replaceText(rt.text || '')
                    }));
                    cell.value = rtValue;
                }
            }
        });
    });

    // 4. FIND DATA AREA (STT '1' to 'Cộng' row)
    let itemStartRow = -1;
    let congRow = -1;

    for (let r = 1; r <= Math.min(worksheet.rowCount, 100); r++) {
        const row = worksheet.getRow(r);
        
        // Find STT 1
        const firstCellVal = row.getCell(1).value?.toString().trim();
        if (itemStartRow === -1 && firstCellVal === '1') {
            itemStartRow = r;
        }
        
        // Find "Cộng" row by checking ALL cells in row
        if (congRow === -1) {
            row.eachCell((cell) => {
                if (congRow !== -1) return;
                const val = cell.value?.toString().trim().toLowerCase() || '';
                if (val === 'cộng' || val.includes('tổng cộng')) {
                    congRow = r;
                }
            });
        }
        if (itemStartRow !== -1 && congRow !== -1) break;
    }

    // Fallbacks
    if (itemStartRow === -1) itemStartRow = congRow - 1; // Include the empty placeholder row above Cộng
    if (congRow === -1) congRow = itemStartRow + 1;

    // ===== SAVE MERGED RANGES BELOW DATA AREA BEFORE SPLICING =====
    // spliceRows in ExcelJS corrupts merged cells. We must save them and restore after.
    const mergesBelow: { top: number; left: number; bottom: number; right: number; masterValue: any; masterFont: any; masterAlignment: any }[] = [];
    const allMerges = (worksheet.model as any).merges || [];
    
    for (const mergeRef of allMerges) {
        // Parse merge like "A18:F18" or "B16:C16"
        const match = mergeRef.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
        if (!match) continue;
        const topRow = parseInt(match[2]);
        const bottomRow = parseInt(match[4]);
        
        // Only save merges AT or BELOW the data insertion point (congRow and below)
        if (topRow >= congRow) {
            const leftCol = colLetterToNumber(match[1]);
            const rightCol = colLetterToNumber(match[3]);
            
            // Save the master cell value
            const masterCell = worksheet.getRow(topRow).getCell(leftCol);
            mergesBelow.push({
                top: topRow,
                left: leftCol,
                bottom: bottomRow,
                right: rightCol,
                masterValue: masterCell.value,
                masterFont: masterCell.font ? { ...masterCell.font } : undefined,
                masterAlignment: masterCell.alignment ? { ...masterCell.alignment } : undefined,
            });
        }
    }

    // CLEAN PHASE: Delete rows in data area
    const rowsToDelete = congRow - itemStartRow;
    if (rowsToDelete > 0) {
        worksheet.spliceRows(itemStartRow, rowsToDelete);
    }

    // 5. INSERT DATA PHASE
    let totalQty = 0;
    let totalConvertedQty = 0;

    data.items.forEach((item, index) => {
        const itemRowIndex = itemStartRow + index;
        worksheet.spliceRows(itemRowIndex, 0, []);
        const row = worksheet.getRow(itemRowIndex);
        
        row.getCell(1).value = index + 1; 
        row.getCell(2).value = item.product_name || item.products?.internal_name || item.products?.name || item.products?.sku || '';
        row.getCell(3).value = item.quyCach || '';
        row.getCell(4).value = item.unit || '';
        
        const qtyValue = Number(item.quantity) || 0;
        const qtyCell = row.getCell(5);
        qtyCell.value = qtyValue;
        qtyCell.numFmt = '#,##0';
        totalQty += qtyValue;
        
        if (item.convertedQty !== undefined && item.convertedQty !== '-') {
            const cQty = typeof item.convertedQty === 'string' ? parseFloat(item.convertedQty.replace(/,/g, '')) : Number(item.convertedQty);
            const convCell = row.getCell(6);
            convCell.value = cQty || 0;
            convCell.numFmt = '#,##0';
            totalConvertedQty += (cQty || 0);
        }

        if (data.modules.hasFinancials) {
            row.getCell(7).value = Number(item.price) || 0;
            row.getCell(7).numFmt = '#,##0';
            row.getCell(8).value = (Number(item.price) || 0) * qtyValue;
            row.getCell(8).numFmt = '#,##0';
        }

        row.eachCell((cell) => {
            cell.font = { bold: true, size: 14, name: 'Times New Roman' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        // Center align: Quy cách (C), ĐVT (D), Số lượng (E), Quy đổi (F)
        for (let c = 3; c <= 6; c++) {
            row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
        }
    });

    // UPDATE TOTALS
    const rowShift = data.items.length - rowsToDelete;
    const newCongRowIndex = congRow + rowShift;
    const newCongRow = worksheet.getRow(newCongRowIndex);
    const qCellTotal = newCongRow.getCell(5);
    if (qCellTotal) {
        qCellTotal.value = totalQty;
        qCellTotal.numFmt = '#,##0';
    }
    if (totalConvertedQty > 0) {
        const cCellTotal = newCongRow.getCell(6);
        if (cCellTotal) {
            cCellTotal.value = totalConvertedQty;
            cCellTotal.numFmt = '#,##0';
        }
    }

    // ===== RESTORE MERGED RANGES AFTER ALL SPLICING =====
    // spliceRows corrupts merged cells. We now re-apply them at shifted positions.
    for (const savedMerge of mergesBelow) {
        const newTop = savedMerge.top + rowShift;
        const newBottom = savedMerge.bottom + rowShift;

        // Try to unmerge the corrupted range first (ignore errors)
        try {
            worksheet.unMergeCells(newTop, savedMerge.left, newBottom, savedMerge.right);
        } catch (e) { /* ignore */ }

        // Clear all slave cells (they have duplicated values from the corruption)
        for (let r = newTop; r <= newBottom; r++) {
            for (let c = savedMerge.left; c <= savedMerge.right; c++) {
                if (r === newTop && c === savedMerge.left) continue; // Skip master cell
                const slaveCell = worksheet.getRow(r).getCell(c);
                slaveCell.value = null;
            }
        }

        // Restore master cell value
        const masterCell = worksheet.getRow(newTop).getCell(savedMerge.left);
        masterCell.value = savedMerge.masterValue;
        if (savedMerge.masterFont) masterCell.font = savedMerge.masterFont;
        if (savedMerge.masterAlignment) masterCell.alignment = savedMerge.masterAlignment;

        // Re-apply merge
        try {
            worksheet.mergeCells(newTop, savedMerge.left, newBottom, savedMerge.right);
        } catch (e) { /* ignore if already merged */ }
    }

    // Write and save
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `${data.type === 'inbound' ? 'Phieu_Nhap' : 'Phieu_Xuat'}_${data.order.code}.xlsx`);
}

// Helper: Convert column letter to number (A=1, B=2, ..., Z=26, AA=27, etc.)
function colLetterToNumber(col: string): number {
    let num = 0;
    for (let i = 0; i < col.length; i++) {
        num = num * 26 + (col.charCodeAt(i) - 64);
    }
    return num;
}
