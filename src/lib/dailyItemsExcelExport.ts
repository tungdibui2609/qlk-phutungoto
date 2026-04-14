import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface DailyItemExportData {
    type: 'inbound' | 'outbound' | 'all';
    startDate: Date;
    endDate: Date;
    systemName: string;
    items: any[];
}

export async function exportDailyItemsToExcel(data: DailyItemExportData) {
    const workbook = new ExcelJS.Workbook();
    const sheetName = data.type === 'all' ? 'Tong_Hop_Nhap_Xuat' : (data.type === 'inbound' ? 'Hang_Hoa_Nhap' : 'Hang_Hoa_Xuat');
    const worksheet = workbook.addWorksheet(sheetName);

    // 1. Set Columns
    worksheet.columns = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Ngày', key: 'orderDate', width: 12 },
        { header: 'Mã Phiếu', key: 'orderCode', width: 20 },
        { header: 'Loại', key: 'typeLabel', width: 10 },
        { header: 'Tên Sản Phẩm', key: 'productName', width: 40 },
        { header: 'Mã SP (SKU)', key: 'sku', width: 15 },
        { header: 'ĐVT', key: 'unit', width: 10 },
        { header: 'Số lượng', key: 'quantity', width: 15 },
        { header: 'Quy đổi (Kg)', key: 'convertedQty', width: 15 },
        { header: data.type === 'inbound' ? 'Nhà cung cấp' : (data.type === 'outbound' ? 'Khách hàng' : 'Đối tác'), key: 'partner', width: 30 },
        { header: 'Ghi chú', key: 'note', width: 30 },
    ];

    // 2. Add Header Info
    let title = '';
    if (data.type === 'all') title = 'BÁO CÁO TỔNG HỢP NHẬP - XUẤT HÀNG HÓA';
    else if (data.type === 'inbound') title = 'BÁO CÁO CHI TIẾT HÀNG HÓA NHẬP KHO';
    else title = 'BÁO CÁO CHI TIẾT HÀNG HÓA XUẤT KHO';
    
    const dateRangeStr = data.startDate.getTime() === data.endDate.getTime()
        ? `Ngày báo cáo: ${format(data.startDate, 'dd/MM/yyyy')}`
        : `Từ ngày: ${format(data.startDate, 'dd/MM/yyyy')} đến ngày: ${format(data.endDate, 'dd/MM/yyyy')}`;

    // Insert rows at the top for header
    worksheet.insertRow(1, [title]);
    worksheet.insertRow(2, [dateRangeStr]);
    worksheet.insertRow(3, [`Phân hệ: ${data.systemName}`]);
    worksheet.insertRow(4, []); // Spacer

    // Merge cells for title
    worksheet.mergeCells('A1:K1');
    worksheet.mergeCells('A2:K2');
    worksheet.mergeCells('A3:K3');

    // Styling Header
    const titleCell = worksheet.getCell('A1');
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center' };

    const dateCell = worksheet.getCell('A2');
    dateCell.alignment = { horizontal: 'center' };
    dateCell.font = { italic: true };

    const systemCell = worksheet.getCell('A3');
    systemCell.alignment = { horizontal: 'center' };
    systemCell.font = { bold: true };

    // 3. Setup Table Header (Row 5 because we inserted 4 rows)
    const headerRow = worksheet.getRow(5);
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

    // 4. Add Body Data
    // Sort items by date then by order code to ensure grouping
    const sortedItems = [...data.items].sort((a, b) => {
        const dateA = new Date(a.order_date).getTime();
        const dateB = new Date(b.order_date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return a.order_code.localeCompare(b.order_code);
    });

    let currentOrderCode = '';
    let startRowIdx = 6;
    let sttCounter = 0;
    const mergeRanges: { start: number, end: number, orderCode: string }[] = [];

    sortedItems.forEach((item, index) => {
        // Check if this is a new order
        if (item.order_code !== currentOrderCode) {
            // If not the first order, record the previous range
            if (currentOrderCode !== '') {
                mergeRanges.push({
                    start: startRowIdx,
                    end: worksheet.lastRow!.number,
                    orderCode: currentOrderCode
                });
                startRowIdx = worksheet.lastRow!.number + 1;
            }
            currentOrderCode = item.order_code;
            sttCounter++;
        }

        const typeLabel = item.type === 'inbound' ? 'NHẬP' : 'XUẤT';
        const typeColor = item.type === 'inbound' ? '008000' : 'FF0000'; // Green for In, Red for Out

        const row = worksheet.addRow({
            stt: sttCounter,
            orderDate: format(new Date(item.order_date), 'dd/MM/yyyy'),
            orderCode: item.order_code,
            typeLabel: typeLabel,
            productName: item.product_name,
            sku: item.sku,
            unit: item.unit,
            quantity: item.quantity,
            convertedQty: item.convertedQty,
            partner: item.partner_name,
            note: item.note || ''
        });

        row.eachCell((cell, colNumber) => {
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            
            // Text color based on type
            cell.font = { color: { argb: typeColor } };

            // Vertical align middle for all cells
            cell.alignment = { vertical: 'middle' };

            // Format number columns (STT, Quantity, Converted Quantity)
            if (colNumber === 1 || colNumber === 8 || colNumber === 9) {
                const value = Number(cell.value);
                if (!isNaN(value)) {
                    cell.numFmt = Number.isInteger(value) ? '#,##0' : '#,##0.###';
                }
                if (colNumber !== 1) {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                } else {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                }
            }

            // Center align date, order code, type
            if (colNumber === 2 || colNumber === 3 || colNumber === 4) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
        });
    });

    // Record the last range
    if (currentOrderCode !== '') {
        mergeRanges.push({
            start: startRowIdx,
            end: worksheet.lastRow!.number,
            orderCode: currentOrderCode
        });
    }

    // Apply merges
    mergeRanges.forEach(range => {
        if (range.start < range.end) {
            // STT (Col 1)
            worksheet.mergeCells(range.start, 1, range.end, 1);
            // Ngày (Col 2)
            worksheet.mergeCells(range.start, 2, range.end, 2);
            // Mã Phiếu (Col 3)
            worksheet.mergeCells(range.start, 3, range.end, 3);
            // Loại (Col 4)
            worksheet.mergeCells(range.start, 4, range.end, 4);
            // Đối tác (Col 10)
            worksheet.mergeCells(range.start, 10, range.end, 10);
        }
    });

    // 5. Total Row
    const totalRow = worksheet.addRow({
        stt: '',
        orderDate: '',
        orderCode: '',
        typeLabel: '',
        productName: 'TỔNG CỘNG',
        sku: '',
        unit: '',
        quantity: sortedItems.reduce((sum, item) => {
            // In a combined report, maybe you want net quantity? 
            // But usually we sum absolute values for simple total movement.
            // Let's keep it as sum of all lines for now.
            return sum + (Number(item.quantity) || 0);
        }, 0),
        convertedQty: sortedItems.reduce((sum, item) => sum + (Number(item.convertedQty) || 0), 0),
        partner: '',
        note: ''
    });

    totalRow.eachCell((cell, colNumber) => {
        cell.font = { bold: true };
        cell.alignment = { vertical: 'middle' };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
        if (colNumber === 8 || colNumber === 9) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            const value = Number(cell.value);
            if (!isNaN(value)) {
                cell.numFmt = Number.isInteger(value) ? '#,##0' : '#,##0.###';
            }
        }
    });
    worksheet.mergeCells(`A${totalRow.number}:D${totalRow.number}`);

    // Save
    const buffer = await workbook.xlsx.writeBuffer();
    const dateSuffix = data.startDate.getTime() === data.endDate.getTime()
        ? format(data.startDate, 'yyyyMMdd')
        : `${format(data.startDate, 'yyyyMMdd')}_to_${format(data.endDate, 'yyyyMMdd')}`;
    
    let fileNamePrefix = '';
    if (data.type === 'all') fileNamePrefix = 'TongHop_NhapXuat';
    else fileNamePrefix = data.type === 'inbound' ? 'Nhap' : 'Xuat';

    const fileName = `${fileNamePrefix}_HangHoa_${dateSuffix}.xlsx`;
    saveAs(new Blob([buffer]), fileName);
}
