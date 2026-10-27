import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';

export interface ExportReportDayRow {
    date: string;
    taskCount: number;
    lineCount: number;
    requestedQty: number;
    exportedQty: number;
    completedTasks: number;
}

export interface ExportReportProductRow {
    productName: string;
    sku: string;
    unit: string;
    lineCount: number;
    requestedQty: number;
    exportedQty: number;
}

export interface ExportReportPickRow {
    date: string;
    hour: string;
    pickerName: string;
    productName: string;
    sku: string;
    taskCode: string;
    quantity: number;
    unit: string;
    note: string;
}

export interface ExportReportDetailRow {
    taskCode: string;
    taskCreatedAt: string;
    taskStatus: string;
    productName: string;
    sku: string;
    productionCode: string;
    lotCode: string;
    positionCode: string;
    requestedQty: number;
    exportedQty: number;
    unit: string;
    lineStatus: string;
    taskNotes: string;
}

export interface ExportReportSummaryRow {
    label: string;
    value: string | number;
}

export interface ExportOrderReportExcelOptions {
    systemName: string;
    dateFrom: string;
    dateTo: string;
    summary: ExportReportSummaryRow[];
    dayRows: ExportReportDayRow[];
    productRows: ExportReportProductRow[];
    pickRows: ExportReportPickRow[];
    detailRows: ExportReportDetailRow[];
    companyInfo?: any;
}

const HEADER_FILL: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2563EB' },
};

function buildSheet(
    workbook: ExcelJS.Workbook,
    sheetName: string,
    title: string,
    columns: Array<{ header: string; key: string; width: number }>,
    rows: Array<Record<string, any>>,
    rangeLabel: string,
    companyName: string,
    systemName: string
) {
    const ws = workbook.addWorksheet(sheetName);
    const span = columns.length;
    const lastColumn = ws.getColumn(span).letter;

    // Chỉ định nghĩa độ rộng cột, KHÔNG dùng `header` để tránh ExcelJS tự ghi tiêu đề vào row 1
    ws.columns = columns.map(c => ({ width: c.width }));

    ws.mergeCells(`A1:${lastColumn}1`);
    const titleCell = ws.getCell('A1');
    titleCell.value = title;
    titleCell.font = { bold: true, size: 15, color: { argb: 'FFFFFF' } };
    titleCell.fill = HEADER_FILL;
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 32;

    ws.mergeCells(`A2:${lastColumn}2`);
    const compCell = ws.getCell('A2');
    compCell.value = `${companyName} | Kho: ${systemName || 'Tất cả kho'}`;
    compCell.font = { bold: true, size: 11, color: { argb: 'FF1E3A8A' } };
    compCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 20;

    ws.mergeCells(`A3:${lastColumn}3`);
    const infoCell = ws.getCell('A3');
    infoCell.value = rangeLabel;
    infoCell.font = { italic: true, size: 10, color: { argb: 'FF334155' } };
    infoCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(3).height = 18;

    const headerRow = ws.getRow(4);
    columns.forEach((c, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = c.header;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = HEADER_FILL;
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    headerRow.height = 20;

    rows.forEach((row, idx) => {
        const values = columns.map(c => row[c.key]);
        const r = ws.addRow(values);
        if (idx % 2 === 1) {
            r.eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            });
        }
    });

    ws.views = [{ state: 'frozen', ySplit: 4 }];
    return ws;
}

export async function exportOrderReportToExcel(options: ExportOrderReportExcelOptions) {
    const { systemName, dateFrom, dateTo, summary, dayRows, productRows, pickRows, detailRows, companyInfo } = options;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Chanh Thu Smart WMS';
    workbook.created = new Date();

    const companyName = companyInfo?.name || 'CÔNG TY TNHH XNK TRÁI CÂY CHÁNH THU';
    const exportTimeStr = format(new Date(), 'dd/MM/yyyy HH:mm');
    const rangeLabel = `Kỳ báo cáo: ${format(new Date(`${dateFrom}T00:00:00`), 'dd/MM/yyyy')} - ${format(new Date(`${dateTo}T23:59:59`), 'dd/MM/yyyy')} | Thời gian xuất file: ${exportTimeStr}`;
    const contextLine = { systemName: systemName || 'Tất cả kho', text: rangeLabel };

    // ==========================================
    // SHEET 1: TỔNG HỢP
    // ==========================================
    buildSheet(
        workbook,
        'Tong hop',
        'BÁO CÁO THỐNG KÊ XUẤT KHO - TỔNG HỢP',
        [
            { header: 'Chỉ tiêu', key: 'label', width: 34 },
            { header: 'Giá trị', key: 'value', width: 26 },
        ],
        summary.map(s => ({ ...s })),
        rangeLabel,
        companyName,
        systemName
    );

    // ==========================================
    // SHEET 2: THEO NGÀY
    // ==========================================
    buildSheet(
        workbook,
        'Theo ngay',
        'SẢN LƯỢNG XUẤT THEO NGÀY',
        [
            { header: 'STT', key: 'stt', width: 6 },
            { header: 'Ngày', key: 'date', width: 14 },
            { header: 'Số lệnh xuất', key: 'taskCount', width: 14 },
            { header: 'Dòng hàng', key: 'lineCount', width: 12 },
            { header: 'SL yêu cầu', key: 'requestedQty', width: 14 },
            { header: 'SL đã xuất', key: 'exportedQty', width: 14 },
            { header: 'SL đã xuất', key: 'exportedQty', width: 14 },
            { header: 'Lệnh hoàn thành', key: 'completedTasks', width: 16 },
        ],
        dayRows.map((d, i) => ({ stt: i + 1, ...d })),
        rangeLabel,
        companyName,
        systemName
    );

    // ==========================================
    // SHEET 3: THEO SẢN PHẨM
    // ==========================================
    buildSheet(
        workbook,
        'Theo san pham',
        'SẢN LƯỢNG XUẤT THEO SẢN PHẨM',
        [
            { header: 'STT', key: 'stt', width: 6 },
            { header: 'Tên sản phẩm', key: 'productName', width: 38 },
            { header: 'Mã SP (SKU)', key: 'sku', width: 18 },
            { header: 'ĐVT', key: 'unit', width: 10 },
            { header: 'Số dòng', key: 'lineCount', width: 10 },
            { header: 'SL yêu cầu', key: 'requestedQty', width: 14 },
            { header: 'SL đã xuất', key: 'exportedQty', width: 14 },
            { header: 'Còn lại chưa xuất', key: 'remaining', width: 20 },
        ],
        productRows.map((p, i) => ({
            stt: i + 1,
            ...p,
            remaining: `${p.requestedQty > 0 ? Math.round((1 - p.exportedQty / p.requestedQty) * 100) : 0}% / ${(p.requestedQty - p.exportedQty).toLocaleString('vi-VN')}`,
        })),
        rangeLabel,
        companyName,
        systemName
    );

    // ==========================================
    // SHEET 4: CHI TIẾT DÒNG LỆNH
    // ==========================================
    buildSheet(
        workbook,
        'Chi tiet lenh xuat',
        'CHI TIẾT CÁC DÒNG HÀNG TRONG LỆNH XUẤT',
        [
            { header: 'STT', key: 'stt', width: 6 },
            { header: 'Mã lệnh xuất', key: 'taskCode', width: 18 },
            { header: 'Ngày tạo lệnh', key: 'taskCreatedAt', width: 18 },
            { header: 'Trạng thái lệnh', key: 'taskStatus', width: 14 },
            { header: 'Tên sản phẩm', key: 'productName', width: 34 },
            { header: 'Mã SP (SKU)', key: 'sku', width: 16 },
            { header: 'Lệnh SX (LOT LSX)', key: 'productionCode', width: 20 },
            { header: 'Mã kiện', key: 'lotCode', width: 20 },
            { header: 'Vị trí xuất', key: 'positionCode', width: 14 },
            { header: 'SL yêu cầu', key: 'requestedQty', width: 13 },
            { header: 'SL đã xuất', key: 'exportedQty', width: 13 },
            { header: 'ĐVT', key: 'unit', width: 9 },
            { header: 'Trạng thái dòng', key: 'lineStatus', width: 14 },
            { header: 'Ghi chú lệnh xuất', key: 'taskNotes', width: 24 },
        ],
        detailRows.map((d, i) => ({ stt: i + 1, ...d })),
        rangeLabel,
        companyName,
        systemName
    );

    // ==========================================
    // SHEET 5: LỊCH SỬ HẠ HÀNG (PICK EVENTS)
    // ==========================================
    if (pickRows.length > 0) {
        buildSheet(
            workbook,
            'Lịch sử hạ hàng',
            'LỊCH SỬ HẠ HÀNG THEO LƯỢT (GIỜ - NHÂN VIÊN)',
            [
                { header: 'STT', key: 'stt', width: 6 },
                { header: 'Ngày', key: 'date', width: 13 },
                { header: 'Giờ', key: 'hour', width: 8 },
                { header: 'Nhân viên', key: 'pickerName', width: 22 },
                { header: 'Tên sản phẩm', key: 'productName', width: 34 },
                { header: 'Mã SP (SKU)', key: 'sku', width: 16 },
                { header: 'Mã lệnh xuất', key: 'taskCode', width: 18 },
                { header: 'Số lượng', key: 'quantity', width: 12 },
                { header: 'ĐVT', key: 'unit', width: 9 },
                { header: 'Ghi chú', key: 'note', width: 24 },
            ],
            pickRows.map((p, i) => ({ stt: i + 1, ...p })),
            rangeLabel,
            companyName,
            systemName
        );
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `Thong_ke_xuat_kho_${dateFrom}_${dateTo}_${format(new Date(), 'HHmm')}.xlsx`;
    saveAs(new Blob([buffer]), fileName);
    return fileName;
}
