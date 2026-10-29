import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format, parseISO } from 'date-fns';
import type { AgingBucket, AgingLotRow, AgingProductRow, AgingStats } from './inventoryAging';

interface AgingExportData {
    systemName: string;
    dateTypeLabel: string;
    asOfDate: string;
    thresholdsLabel: string;
    buckets: AgingBucket[];
    stats: AgingStats;
    lotRows: AgingLotRow[];
    productRows: AgingProductRow[];
}

function cleanNum(val: any): number {
    const n = Number(val) || 0;
    return Math.round(n * 1000) / 1000;
}

function fmtDateVN(iso?: string | null): string {
    if (!iso) return '---';
    try {
        return format(parseISO(iso), 'dd/MM/yyyy');
    } catch {
        return iso;
    }
}

function bucketTone(index: number | null, bucketCount: number) {
    if (index === null) return 'F5F5F5';
    const ratio = bucketCount > 1 ? index / (bucketCount - 1) : 1;
    if (ratio >= 0.999) return 'FECACA';   // đỏ: nhóm lâu nhất
    if (ratio >= 0.66) return 'FEF3C7';    // vàng cam
    if (ratio >= 0.33) return 'FEF9C3';    // vàng nhạt
    return 'DCFCE7';                        // xanh: còn mới
}

export async function exportInventoryAgingToExcel(data: AgingExportData) {
    const workbook = new ExcelJS.Workbook();
    const asOfVN = fmtDateVN(data.asOfDate);

    const addMeta = (worksheet: ExcelJS.Worksheet, lastCol: string) => {
        worksheet.mergeCells(`A1:${lastCol}1`);
        const title = worksheet.getCell('A1');
        title.value = 'BÁO CÁO TỔNG HỢP HÀNG TỒN KHO LÂU NGÀY';
        title.font = { bold: true, size: 16, color: { argb: 'B45309' } };
        title.alignment = { horizontal: 'center' };

        worksheet.mergeCells(`A2:${lastCol}2`);
        const meta = worksheet.getCell('A2');
        meta.value = `Kho: ${data.systemName} | Tính đến ngày: ${asOfVN} | Mốc ngày: ${data.dateTypeLabel} | Ngưỡng: ${data.thresholdsLabel}`;
        meta.font = { italic: true, size: 11 };
        meta.alignment = { horizontal: 'center' };
    };

    const styleHeader = (row: ExcelJS.Row) => {
        row.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFF' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'B45309' } };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
    };

    const styleBody = (row: ExcelJS.Row, numericFrom: number) => {
        row.eachCell((cell, colIdx) => {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.alignment = { vertical: 'middle', wrapText: true, horizontal: colIdx >= numericFrom ? 'right' : 'left' };
            if (colIdx >= numericFrom && typeof cell.value === 'number') {
                cell.numFmt = Number.isInteger(cell.value) ? '#,##0' : '#,##0.###';
            }
        });
    };

    // ===== Sheet 1: Tổng hợp theo sản phẩm (ma trận nhóm tuổi) =====
    const wsProduct = workbook.addWorksheet('Tổng hợp theo sản phẩm');
    const productCols = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Mã SP', key: 'sku', width: 18 },
        { header: 'Tên sản phẩm', key: 'name', width: 38 },
        { header: 'Danh mục', key: 'category', width: 20 },
        { header: 'ĐVT', key: 'unit', width: 12 },
        { header: 'Tổng tồn', key: 'quantity', width: 12 },
        { header: 'Quy đổi (Kg)', key: 'kg', width: 13 },
        { header: 'Số LOT', key: 'lotCount', width: 9 },
        { header: `Ngày cũ nhất (${data.dateTypeLabel})`, key: 'oldestDate', width: 18 },
        { header: 'Số ngày lớn nhất', key: 'maxDays', width: 12 },
        ...data.buckets.map((b, i) => ({ header: b.label, key: `b${i}`, width: 14 }))
    ];
    wsProduct.columns = productCols.map(c => ({ key: c.key as string, width: c.width }));
    const prodLastCol = String.fromCharCode(64 + Math.min(productCols.length, 26));
    addMeta(wsProduct, prodLastCol);

    const prodHeaderRow = wsProduct.getRow(4);
    prodHeaderRow.values = productCols.map(c => String(c.header));
    styleHeader(prodHeaderRow);
    data.buckets.forEach((b, i) => {
        prodHeaderRow.getCell(11 + i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '78350F' } };
    });

    let prodRowIdx = 5;
    data.productRows.forEach((row, i) => {
        const values: any[] = [
            i + 1, row.sku, row.name, row.categoryName, row.unit,
            cleanNum(row.quantity), cleanNum(row.kg), row.lotCount,
            fmtDateVN(row.oldestDate), row.maxDays ?? '---',
            ...row.qtyByBucket.map(q => (q > 0 ? cleanNum(q) : ''))
        ];
        const r = wsProduct.getRow(prodRowIdx++);
        r.values = values;
        styleBody(r, 6);
        data.buckets.forEach((_, bi) => {
            const cell = r.getCell(11 + bi);
            if (cell.value !== '') {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bucketTone(bi, data.buckets.length) } };
            }
        });
    });

    // ===== Sheet 2: Chi tiết theo LOT =====
    const wsLot = workbook.addWorksheet('Chi tiết theo LOT');
    const lotCols = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Mã LOT (Pallet)', key: 'lotCode', width: 22 },
        { header: 'Mã Lot sản xuất', key: 'productionCode', width: 20 },
        { header: 'Sản phẩm', key: 'products', width: 45 },
        { header: 'ĐVT', key: 'unit', width: 14 },
        { header: 'Số lượng tồn', key: 'quantity', width: 12 },
        { header: 'Quy đổi (Kg)', key: 'kg', width: 13 },
        { header: 'Vị trí', key: 'positions', width: 18 },
        { header: 'Kho', key: 'warehouse', width: 16 },
        { header: data.dateTypeLabel, key: 'date', width: 16 },
        { header: 'Số ngày tồn', key: 'days', width: 12 },
        { header: 'Nhóm tuổi', key: 'bucket', width: 18 },
        { header: 'Trạng thái', key: 'lock', width: 12 },
    ];
    wsLot.columns = lotCols.map(c => ({ key: c.key as string, width: c.width }));
    addMeta(wsLot, 'M');

    const lotHeaderRow = wsLot.getRow(4);
    lotHeaderRow.values = lotCols.map(c => String(c.header));
    styleHeader(lotHeaderRow);

    let lotRowIdx = 5;
    data.lotRows.forEach((row, i) => {
        const bucketLabel = row.bucketIndex === null
            ? 'Chưa có ngày'
            : (data.buckets.find(b => b.index === row.bucketIndex)?.label || '---');
        const r = wsLot.getRow(lotRowIdx++);
        r.values = [
            i + 1,
            row.lotCode,
            row.productionCode || '---',
            row.items.map(it => `${it.name} (${cleanNum(it.quantity)} ${it.unit})`).join('\n'),
            row.unitSet.join(', '),
            cleanNum(row.quantity),
            cleanNum(row.kg),
            row.positionCodes.join(', ') || 'CHƯA GÁN',
            row.warehouseName || '---',
            fmtDateVN(row.dateValue),
            row.days ?? '---',
            bucketLabel,
            row.isLocked ? 'Đang khoá' : 'Tự do'
        ];
        styleBody(r, 6);
        r.getCell(12).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bucketTone(row.bucketIndex, data.buckets.length) } };
    });

    // ===== Sheet 3: Tóm tắt theo nhóm tuổi =====
    const wsSummary = workbook.addWorksheet('Tóm tắt nhóm tuổi');
    wsSummary.columns = [
        { key: 'bucket', width: 22 },
        { key: 'lotCount', width: 12 },
        { key: 'quantity', width: 14 },
        { key: 'kg', width: 14 },
        { key: 'percent', width: 12 },
    ];
    addMeta(wsSummary, 'E');
    const sumHeader = wsSummary.getRow(4);
    sumHeader.values = ['Nhóm tuổi', 'Số LOT', 'Số lượng tồn', 'Quy đổi (Kg)', '% số LOT'];
    styleHeader(sumHeader);

    const totalLots = data.stats.lotCount || 1;
    let sumRowIdx = 5;
    data.stats.bucketTotals.forEach(t => {
        const r = wsSummary.getRow(sumRowIdx++);
        r.values = [
            data.buckets.find(b => b.index === t.index)?.label || '---',
            t.lotCount,
            cleanNum(t.quantity),
            cleanNum(t.kg),
            `${Math.round((t.lotCount / totalLots) * 100)}%`
        ];
        styleBody(r, 2);
        r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bucketTone(t.index, data.buckets.length) } };
    });
    if (data.stats.undatedLotCount > 0) {
        const r = wsSummary.getRow(sumRowIdx++);
        r.values = ['Chưa có ngày (' + data.dateTypeLabel + ')', data.stats.undatedLotCount, '', '', `${Math.round((data.stats.undatedLotCount / totalLots) * 100)}%`];
        styleBody(r, 2);
        r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F5F5F5' } };
    }

    data.stats.overThresholds.forEach(o => {
        const r = wsSummary.getRow(sumRowIdx++);
        r.values = [`Vượt mốc ${o.threshold} ngày`, o.lotCount, cleanNum(o.quantity), cleanNum(o.kg), `${Math.round((o.lotCount / totalLots) * 100)}%`];
        r.font = { bold: true, color: { argb: 'B91C1C' } };
        styleBody(r, 2);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Ton_kho_lau_ngay_${asOfVN.replace(/\//g, '-')}.xlsx`);
}
