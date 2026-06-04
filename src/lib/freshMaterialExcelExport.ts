import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format, parseISO } from 'date-fns';
import { CompanyInfo } from '@/hooks/usePrintCompanyInfo';

export interface FreshBatchExportData {
    id: string;
    batch_code: string;
    system_code: string;
    received_date: string;
    total_initial_quantity: number;
    initial_unit: string;
    status: string;
    notes: string | null;
    created_at: string;
    products?: { name: string; sku: string; unit: string } | null;
    suppliers?: { name: string } | null;
    fresh_material_receivings?: any[];
    fresh_material_stages?: any[];
}

const STATUS_TEXT_MAP: Record<string, string> = {
    RECEIVING: 'Đang nhận',
    PROCESSING: 'Đang xử lý',
    COMPLETED: 'Hoàn thành',
    CANCELLED: 'Đã hủy',
};

function cleanNum(val: any): number {
    const n = Number(val) || 0;
    return Math.round(n * 1000) / 1000;
}

export async function exportFreshBatchesToExcel(
    batches: FreshBatchExportData[],
    companyInfo: CompanyInfo | null,
    systemType: string
) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Danh sach lo NLT');

    let currentRow = 1;

    // 1. Thêm thông tin công ty (Company Info Header)
    if (companyInfo) {
        worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
        const nameCell = worksheet.getCell(`A${currentRow}`);
        nameCell.value = companyInfo.name?.toUpperCase();
        nameCell.font = { bold: true, size: 10, name: 'Times New Roman' };
        currentRow++;

        worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
        const addrCell = worksheet.getCell(`A${currentRow}`);
        addrCell.value = `Địa chỉ: ${companyInfo.address || ''}`;
        addrCell.font = { size: 9, name: 'Times New Roman' };
        currentRow++;

        worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
        const contactCell = worksheet.getCell(`A${currentRow}`);
        contactCell.value = `${companyInfo.email ? `Email: ${companyInfo.email} | ` : ''}ĐT: ${companyInfo.phone || ''}`;
        contactCell.font = { size: 9, name: 'Times New Roman' };
        currentRow++;
    }

    currentRow++; // Spacer

    // 2. Tiêu đề báo cáo
    const totalCols = 12; // STT, Mã lô, Ngày nhận, Tên nguyên liệu, SKU, Nhà cung cấp, SL ban đầu, ĐVT, Lần nhập xe, Giai đoạn, Trạng thái, Ghi chú
    const lastColLetter = String.fromCharCode(65 + totalCols - 1);

    worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
    const titleCell = worksheet.getCell(`A${currentRow}`);
    titleCell.value = 'BÁO CÁO DANH SÁCH LÔ NGUYÊN LIỆU TƯƠI';
    titleCell.font = { bold: true, size: 16, name: 'Times New Roman' };
    titleCell.alignment = { horizontal: 'center' };
    currentRow++;

    worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
    const dateCell = worksheet.getCell(`A${currentRow}`);
    dateCell.value = `Ngày xuất báo cáo: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`;
    dateCell.alignment = { horizontal: 'center' };
    dateCell.font = { italic: true, name: 'Times New Roman', size: 10 };
    currentRow++;

    worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
    const sysCell = worksheet.getCell(`A${currentRow}`);
    sysCell.value = `Phân hệ: ${systemType ? systemType.toUpperCase() : ''}`;
    sysCell.alignment = { horizontal: 'center' };
    sysCell.font = { size: 10, name: 'Times New Roman', bold: true };
    currentRow++;

    currentRow += 2; // Spacer trước khi vào bảng chính

    // 3. Xây dựng Header cho bảng dữ liệu
    const headerRow = worksheet.getRow(currentRow);
    const headers = [
        'STT',
        'MÃ LÔ',
        'NGÀY NHẬN',
        'TÊN NGUYÊN LIỆU',
        'SKU',
        'NHÀ CUNG CẤP',
        'SL BAN ĐẦU',
        'ĐVT',
        'LẦN NHẬP XE',
        'GIAI ĐOẠN',
        'TRẠNG THÁI',
        'GHI CHÚ'
    ];

    headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true, size: 10, name: 'Times New Roman', color: { argb: 'FFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
        // Sử dụng màu nền xanh lá (Emerald) cho phù hợp với lô nguyên liệu tươi
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '059669' } // emerald-600
        };
    });

    // Cài đặt độ rộng cột
    worksheet.getColumn(1).width = 6;   // STT
    worksheet.getColumn(2).width = 20;  // Mã lô
    worksheet.getColumn(3).width = 15;  // Ngày nhận
    worksheet.getColumn(4).width = 30;  // Tên nguyên liệu
    worksheet.getColumn(5).width = 15;  // SKU
    worksheet.getColumn(6).width = 25;  // Nhà cung cấp
    worksheet.getColumn(7).width = 18;  // SL ban đầu
    worksheet.getColumn(8).width = 10;  // ĐVT
    worksheet.getColumn(9).width = 15;  // Lần nhập xe
    worksheet.getColumn(10).width = 18; // Giai đoạn
    worksheet.getColumn(11).width = 15; // Trạng thái
    worksheet.getColumn(12).width = 30; // Ghi chú

    currentRow++;

    // 4. Điền dữ liệu vào bảng
    let totalInitialQuantity = 0;

    batches.forEach((batch, idx) => {
        const receivedDateStr = batch.received_date 
            ? format(parseISO(batch.received_date), 'dd/MM/yyyy') 
            : '---';

        const receivingCount = batch.fresh_material_receivings?.length || 0;
        const stageCount = batch.fresh_material_stages?.length || 0;
        const completedStages = batch.fresh_material_stages?.filter((s: any) => s.status === 'DONE').length || 0;
        const stageStr = stageCount > 0 ? `${completedStages}/${stageCount}` : '---';

        const statusLabel = STATUS_TEXT_MAP[batch.status] || batch.status || '---';

        const rowData = [
            idx + 1,
            batch.batch_code,
            receivedDateStr,
            batch.products?.name || '---',
            batch.products?.sku || '---',
            batch.suppliers?.name || '---',
            cleanNum(batch.total_initial_quantity),
            batch.initial_unit || '---',
            receivingCount,
            stageStr,
            statusLabel,
            batch.notes || ''
        ];

        totalInitialQuantity += cleanNum(batch.total_initial_quantity);

        const row = worksheet.addRow(rowData);
        row.eachCell((cell, colNumber) => {
            cell.font = { size: 10, name: 'Times New Roman' };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };

            // Căn lề và định dạng dữ liệu
            if (colNumber === 1 || colNumber === 3 || colNumber === 8 || colNumber === 10 || colNumber === 11) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else if (colNumber === 7 || colNumber === 9) {
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
                if (colNumber === 7) {
                    cell.numFmt = Number.isInteger(cell.value) ? '#,##0' : '#,##0.###';
                } else {
                    cell.numFmt = '#,##0';
                }
            } else {
                cell.alignment = { horizontal: 'left', vertical: 'middle' };
            }
        });
    });

    // 5. Hàng tổng cộng
    const summaryRowData = [
        'TỔNG CỘNG',
        '', '', '', '', '',
        cleanNum(totalInitialQuantity),
        '', '', '', '', ''
    ];

    const summaryRow = worksheet.addRow(summaryRowData);
    worksheet.mergeCells(summaryRow.number, 1, summaryRow.number, 6);

    summaryRow.eachCell((cell, colNumber) => {
        cell.font = { bold: true, size: 10, name: 'Times New Roman' };
        cell.border = {
            top: { style: 'medium' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'F2F2F2' }
        };

        if (colNumber === 7) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = Number.isInteger(cell.value) ? '#,##0' : '#,##0.###';
        } else if (colNumber === 1) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
    });

    currentRow = summaryRow.number;

    // 6. Chữ ký (Footer - Signatures)
    currentRow += 3;
    const signRow = worksheet.getRow(currentRow);
    // Đặt chữ ký căn lề ở cột 10 (Giai đoạn)
    signRow.getCell(10).value = `Ngày ...... tháng ...... năm ......`;
    signRow.getCell(10).font = { italic: true, name: 'Times New Roman', size: 10 };
    signRow.getCell(10).alignment = { horizontal: 'center' };
    worksheet.mergeCells(currentRow, 10, currentRow, 12);
    currentRow++;

    const signTitleRow = worksheet.getRow(currentRow);
    signTitleRow.getCell(2).value = 'NGƯỜI LẬP BIỂU';
    signTitleRow.getCell(6).value = 'THỦ KHO';
    signTitleRow.getCell(10).value = 'GIÁM ĐỐC';

    signTitleRow.eachCell(cell => {
        cell.font = { bold: true, name: 'Times New Roman', size: 10 };
        cell.alignment = { horizontal: 'center' };
    });

    // 7. Tạo file buffer và kích hoạt tải về
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `Lo_Nguyen_Lieu_Tuoi_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    saveAs(new Blob([buffer]), fileName);
}
