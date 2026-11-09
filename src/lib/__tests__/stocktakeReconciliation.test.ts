import { describe, it, expect, vi } from 'vitest'
import ExcelJS from 'exceljs'
import { exportWarehouseToExcel, exportWarehouseGridToExcel } from '../warehouseExcelExport'
import { exportInventoryReportToExcel } from '../inventoryReportExcelExport'
import { parseStocktakeFile } from '../stocktakeSnapshotParser'
import { reconcileStocktake, describeLocation } from '../stocktakeReconciliation'
import { exportStocktakeDiffToExcel } from '../stocktakeDiffExcelExport'

const { savedBlobs } = vi.hoisted(() => ({ savedBlobs: [] as Blob[] }))

vi.mock('file-saver', () => ({
    saveAs: (blob: any) => savedBlobs.push(blob),
}))

/** Xuất file BẰNG HÀM THẬT, rồi đọc lại bằng parser — kiểm chứng 2 đầu khớp nhau. */
async function exportThenParse(exporter: () => Promise<void>, fileName: string) {
    savedBlobs.length = 0
    await exporter()
    const blob = savedBlobs[0]
    return parseStocktakeFile({ name: fileName, arrayBuffer: () => blob.arrayBuffer() })
}

const pos = (code: string, lotCode: string | undefined, sku: string, name: string, qty: number, unit: string) => ({
    code,
    warehouse: 'KHO 1',
    row: 'Dãy 1',
    bin: 'Ô 1',
    level: 'Tầng 1',
    subPosition: code.slice(-2),
    inboundDate: '2026-05-01',
    lotCode,
    productName: name,
    sku,
    unit,
    quantity: qty,
    kgQuantity: null,
    tags: '',
    notes: '',
})

/** Một mục GroupedLot đúng như trang /print/inventory truyền cho hàm xuất thật. */
const lotGroup = (sku: string, name: string, unit: string, qty: number, categoryName: string) => {
    const half = Math.ceil(qty / 2)
    return {
        key: `${categoryName}__${sku}__${unit}`,
        productSku: sku,
        productName: name,
        productUnit: unit,
        totalQuantity: qty,
        totalKg: qty * 2,
        categoryName,
        variants: new Map<string, any>([
            ['LSX: A; @M1', { totalQuantity: half, totalKg: half * 2, items: [] }],
            ['Không có mã phụ', { totalQuantity: qty - half, totalKg: (qty - half) * 2, items: [] }],
        ]),
        items: [],
    }
}

const lotExport = (items: any[]) => exportInventoryReportToExcel({
    type: 'lot',
    dateTitle: 'Tính đến ngày: 02/11/2026',
    warehouse: 'Chi nhánh 1',
    items,
    companyInfo: null,
} as any)

describe('parseStocktakeFile - file Excel (Bảng)', () => {
    it('đọc đúng từng dòng (mã vị trí, mã lot, SP, ĐVT, SL) và bỏ qua dòng TỔNG CỘNG', async () => {
        const snapshot = await exportThenParse(
            () => exportWarehouseToExcel({
                systemName: 'KHO_DONG_LANH',
                positions: [
                    pos('K1-D1-O1-T1-01', 'DL-LOT-001', 'TP01', 'Sầu riêng múi', 10, 'Kg'),
                    pos('K1-D1-O1-T1-02', 'DL-LOT-002', 'TP02', 'Mít thái', 5, 'Thùng (20 Kg)'),
                    pos('K1-D1-O1-T1-03', undefined, '', '', 0, ''),
                ],
            }),
            'So_do_kho_truoc.xlsx'
        )

        expect(snapshot.format).toBe('table')
        expect(snapshot.systemName).toBe('KHO_DONG_LANH')
        expect(snapshot.rows.length).toBe(3)
        expect(snapshot.parsedTotal).toBe(15)
        expect(snapshot.declaredTotal).toBe(15)

        const kgRow = snapshot.rows.find(r => r.positionCode === 'K1-D1-O1-T1-01')
        expect(kgRow?.lotCode).toBe('DL-LOT-001')
        expect(kgRow?.sku).toBe('TP01')
        expect(kgRow?.quantity).toBe(10)

        // Vị trí trống không được tính là hàng hoá
        const emptyRow = snapshot.rows.find(r => r.positionCode === 'K1-D1-O1-T1-03')
        expect(emptyRow?.lotCode).toBe('')
        expect(emptyRow?.quantity).toBe(0)

        // ĐVT được chuẩn hoá như lúc xuất file
        expect(snapshot.rows.find(r => r.positionCode === 'K1-D1-O1-T1-02')?.unit).toBe('Thùng (20kg)')
    })

    it('đọc được cả khi có dòng "Lọc theo" làm lệch vị trí header', async () => {
        const snapshot = await exportThenParse(
            () => exportWarehouseToExcel({
                systemName: 'KHO_DONG_LANH',
                searchTerm: 'Sầu riêng',
                positions: [pos('K1-D1-O1-T1-01', 'DL-LOT-001', 'TP01', 'Sầu riêng múi', 7, 'Kg')],
            }),
            'So_do_kho_loc.xlsx'
        )
        expect(snapshot.rows.length).toBe(1)
        expect(snapshot.rows[0].quantity).toBe(7)
        expect(snapshot.declaredTotal).toBe(7)
    })
})

describe('parseStocktakeFile - file Excel (Lưới)', () => {
    const gridData = (sầuQty: number) => ({
        systemName: 'KHO_DONG_LANH',
        grids: [
            {
                name: 'Dãy 1',
                parentName: 'KHO 1',
                bins: ['Ô 1', 'Ô 2'],
                levels: ['Tầng 1', 'Tầng 2'],
                cells: [
                    { binIndex: 0, levelIndex: 0, items: [{ productName: 'Sầu riêng múi', sku: 'TP01', unit: 'Thùng (20kg)', quantity: sầuQty, lotCode: 'DL-LOT-001', lotCodes: ['DL-LOT-001', 'DL-LOT-002'], batchCode: 'BATCH-01' }] },
                    { binIndex: 0, levelIndex: 1, items: [{ productName: 'Mít thái', sku: 'TP02', unit: 'Kg', quantity: 5, lotCode: 'DL-LOT-002', lotCodes: ['DL-LOT-002'] }] },
                    { binIndex: 1, levelIndex: 0, items: [
                        { productName: 'Sầu riêng múi', sku: 'TP01', unit: 'Kg', quantity: 3, lotCode: 'DL-LOT-003', lotCodes: ['DL-LOT-003'] },
                        { productName: 'Mít thái', sku: 'TP02', unit: 'Kg', quantity: 4, lotCode: 'DL-LOT-004', lotCodes: ['DL-LOT-004'] },
                    ] },
                ],
            },
            { name: 'Sảnh 1', parentName: 'KHO 1', bins: [], levels: [], cells: [{ binIndex: 0, levelIndex: 0, items: [{ productName: 'Sầu riêng múi', sku: 'TP01', unit: 'Thùng (20kg)', quantity: 12, lotCode: 'DL-LOT-005', lotCodes: ['DL-LOT-005', 'DL-LOT-006', 'DL-LOT-007'] }] }] },
        ],
    })

    it('suy ra toạ độ Khu vực / Dãy / Ô / Tầng từ vị trí ô trong lưới', async () => {
        const snapshot = await exportThenParse(() => exportWarehouseGridToExcel(gridData(10) as any), 'So_do_kho_Custom.xlsx')

        expect(snapshot.format).toBe('grid')
        expect(snapshot.systemName).toBe('KHO_DONG_LANH')

        const inO1T1 = snapshot.rows.find(r => r.binName === 'Ô 1' && r.levelName === 'TẦNG 1')
        expect(inO1T1?.rowName).toBe('DÃY 1')
        expect(inO1T1?.warehouse).toBe('KHO 1')
        expect(inO1T1?.productName).toBe('Sầu riêng múi')
        expect(inO1T1?.quantity).toBe(10)
        expect(inO1T1?.pallets).toBe(2)

        // 1 ô chứa nhiều sản phẩm (ngăn bằng dòng "-----") phải tách thành nhiều dòng
        const o2Rows = snapshot.rows.filter(r => r.binName === 'Ô 2' && r.levelName === 'TẦNG 1')
        expect(o2Rows.length).toBe(2)

        // Hàng Sảnh gộp nhiều SP trong 1 ô merge, ngăn bằng " | "
        const lobbyRow = snapshot.rows.find(r => r.rowName === 'SẢNH 1')
        expect(lobbyRow?.quantity).toBe(12)
        expect(lobbyRow?.pallets).toBe(3)
        expect(lobbyRow?.binName).toBe('')

        // Không có mã vị trí / mã lot trong lưới
        expect(snapshot.rows.every(r => r.positionCode === '' && r.lotCode === '')).toBe(true)

        // Tổng đọc từ ô phải khớp sheet "Thống kê Tổng hợp"
        expect(snapshot.parsedTotal).toBe(snapshot.declaredTotal)
        expect(snapshot.parsedTotal).toBe(10 + 5 + 3 + 4 + 12)
    })

    it('cảnh báo khi sơ đồ lưới không hiển thị hết hàng (khu không có Ô/Tầng)', async () => {
        const snapshot = await exportThenParse(
            () => exportWarehouseGridToExcel({
                systemName: 'KHO_DONG_LANH',
                grids: [{
                    name: 'Khu A', parentName: 'KHO 2', bins: [], levels: [],
                    cells: [{ binIndex: 0, levelIndex: 0, items: [{ productName: 'A', sku: 'TP01', unit: 'Kg', quantity: 6, lotCode: 'L1', lotCodes: ['L1'] }] }],
                }],
            } as any),
            'khu-khong-co-o.xlsx'
        )
        expect(snapshot.rows.length).toBe(0)
        expect(snapshot.declaredTotal).toBe(6)
        expect(snapshot.warnings.some(w => w.includes('Thống kê Tổng hợp'))).toBe(true)
    })
})

describe('reconcileStocktake - đối chiếu trước/sau kiểm kê', () => {
    const buildTable = async (positions: ReturnType<typeof pos>[], name: string) =>
        exportThenParse(() => exportWarehouseToExcel({ systemName: 'KHO_DONG_LANH', positions } as any), name)

    it('phân loại lệch số lượng / mất ở mốc sau / phát sinh ở mốc sau', async () => {
        const before = await buildTable([
            pos('K1-D1-O1-T1-01', 'DL-LOT-001', 'TP01', 'Sầu riêng múi', 10, 'Kg'),
            pos('K1-D1-O1-T1-02', 'DL-LOT-002', 'TP02', 'Mít thái', 5, 'Thùng (20kg)'),
            pos('K1-D1-O1-T1-03', 'DL-LOT-003', 'TP03', 'Bơ', 8, 'Kg'),
        ], 'truoc.xlsx')
        const after = await buildTable([
            pos('K1-D1-O1-T1-01', 'DL-LOT-001', 'TP01', 'Sầu riêng múi', 9, 'Kg'),
            pos('K1-D1-O1-T1-02', 'DL-LOT-002', 'TP02', 'Mít thái', 5, 'Thùng (20kg)'),
            pos('K1-D1-O1-T1-04', 'DL-LOT-004', 'TP04', 'Chuối', 4, 'Kg'),
        ], 'sau.xlsx')

        const result = reconcileStocktake(before, after)

        expect(result.changedCount).toBe(1)
        expect(result.onlyBeforeCount).toBe(1)
        expect(result.onlyAfterCount).toBe(1)
        expect(result.sameCount).toBe(1)
        expect(result.diffRows.length).toBe(3)

        const changed = result.diffRows.find(r => r.kind === 'changed')
        expect(changed?.positionCode).toBe('K1-D1-O1-T1-01')
        expect(changed?.beforeQty).toBe(10)
        expect(changed?.afterQty).toBe(9)
        expect(changed?.diff).toBe(-1)
        expect(describeLocation(changed!)).toBe('K1-D1-O1-T1-01')

        const lost = result.diffRows.find(r => r.kind === 'only_before')
        expect(lost?.lotCode).toBe('DL-LOT-003')
        expect(lost?.diff).toBe(-8)

        const added = result.diffRows.find(r => r.kind === 'only_after')
        expect(added?.positionCode).toBe('K1-D1-O1-T1-04')
        expect(added?.diff).toBe(4)
    })

    it('tổng hợp theo từng đơn vị, không cộng xuyên đơn vị', async () => {
        const before = await buildTable([
            pos('K1-D1-O1-T1-01', 'L1', 'TP01', 'A', 10, 'Kg'),
            pos('K1-D1-O1-T1-02', 'L2', 'TP02', 'B', 5, 'Thùng (20kg)'),
        ], 'truoc.xlsx')
        const after = await buildTable([
            pos('K1-D1-O1-T1-01', 'L1', 'TP01', 'A', 8, 'Kg'),
            pos('K1-D1-O1-T1-02', 'L2', 'TP02', 'B', 5, 'Thùng (20kg)'),
        ], 'sau.xlsx')

        const result = reconcileStocktake(before, after)
        expect(result.byUnit.length).toBe(2)
        const kg = result.byUnit.find(u => u.unit === 'Kg')
        expect(kg?.beforeQty).toBe(10)
        expect(kg?.afterQty).toBe(8)
        expect(kg?.diff).toBe(-2)
        expect(result.byUnit.find(u => u.unit === 'Thùng (20kg)')?.diff).toBe(0)
    })

    it('từ chối đối chiếu 2 file khác định dạng', async () => {
        const table = await buildTable([pos('K1-D1-O1-T1-01', 'L1', 'TP01', 'A', 10, 'Kg')], 'bang.xlsx')
        const grid = await exportThenParse(
            () => exportWarehouseGridToExcel({
                systemName: 'KHO_DONG_LANH',
                grids: [{ name: 'Dãy 1', parentName: 'KHO 1', bins: ['Ô 1'], levels: ['Tầng 1'], cells: [{ binIndex: 0, levelIndex: 0, items: [{ productName: 'A', sku: 'TP01', unit: 'Kg', quantity: 10, lotCode: 'L1', lotCodes: ['L1'] }] }] }],
            } as any),
            'luoi.xlsx'
        )
        expect(() => reconcileStocktake(table, grid)).toThrow(/khác định dạng/i)
    })

    it('cảnh báo khi 2 file thuộc 2 phân hệ khác nhau', async () => {
        const a = await exportThenParse(() => exportWarehouseToExcel({ systemName: 'KHO_DONG_LANH', positions: [pos('P1', 'L1', 'TP01', 'A', 1, 'Kg')] } as any), 'a.xlsx')
        const b = await exportThenParse(() => exportWarehouseToExcel({ systemName: 'KHO_THUNG', positions: [pos('P1', 'L1', 'TP01', 'A', 2, 'Kg')] } as any), 'b.xlsx')
        const result = reconcileStocktake(a, b)
        expect(result.warnings.some(w => w.includes('2 phân hệ'))).toBe(true)
    })
})

describe('exportStocktakeDiffToExcel - file báo cáo sai lệch', () => {
    it('xuất file đọc lại được, có 6 sheet và đủ 3 nhóm sai lệch', async () => {
        const before = await exportThenParse(() => exportWarehouseToExcel({
            systemName: 'KHO_DONG_LANH',
            positions: [
                pos('K1-D1-O1-T1-01', 'L1', 'TP01', 'Sầu riêng múi', 10, 'Kg'),
                pos('K1-D1-O1-T1-02', 'L2', 'TP02', 'Mít thái', 5, 'Thùng (20kg)'),
            ],
        } as any), 'truoc.xlsx')
        const after = await exportThenParse(() => exportWarehouseToExcel({
            systemName: 'KHO_DONG_LANH',
            positions: [
                pos('K1-D1-O1-T1-01', 'L1', 'TP01', 'Sầu riêng múi', 7, 'Kg'),
                pos('K1-D1-O1-T1-03', 'L3', 'TP03', 'Bơ', 4, 'Kg'),
            ],
        } as any), 'sau.xlsx')

        const result = reconcileStocktake(before, after)

        savedBlobs.length = 0
        await exportStocktakeDiffToExcel(result)
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(await savedBlobs[0].arrayBuffer())

        expect(workbook.worksheets.map(ws => ws.name)).toEqual([
            'Sơ đồ TRƯỚC', 'Sơ đồ SAU', 'Chi tiết sai lệch', 'Tổng hợp theo SP', 'Tổng hợp theo vị trí', 'Thông tin đối chiếu',
        ])

        const detail = workbook.getWorksheet('Chi tiết sai lệch')
        if (!detail) throw new Error('File báo cáo không có sheet "Chi tiết sai lệch".')
        const header = detail.getRow(4).values as string[]
        expect(header).toEqual(expect.arrayContaining(['Mã vị trí', 'Số lô (Lot)', 'SL trước', 'SL sau', 'Chênh lệch', 'Loại sai lệch']))

        const body = (detail.getRows(5, detail.rowCount - 4) || []).map(r => r.values as any[])
        expect(body.slice(0, 3).length).toBe(3)
        expect(body.flat()).toEqual(expect.arrayContaining(['Lệch số lượng', 'Mất ở mốc sau', 'Phát sinh ở mốc sau']))

        const lostRow = body.find(r => r[14] === 'Mất ở mốc sau')
        expect(lostRow?.[11]).toBe(5)   // SL trước
        expect(lostRow?.[12]).toBe(0)   // SL sau
        expect(lostRow?.[13]).toBe(-5)  // Chênh

        // Không có dòng tổng cộng xuyên đơn vị: chỉ tổng trong từng ĐVT
        const unitTotals = body.filter(r => typeof r?.[1] === 'string' && (r[1] as string).startsWith('TỔNG (trong đơn vị'))
        expect(unitTotals.length).toBe(2)
        expect(unitTotals.map(r => r[1])).toEqual(
            expect.arrayContaining(['TỔNG (trong đơn vị Kg)', 'TỔNG (trong đơn vị Thùng (20kg))'])
        )
        expect(unitTotals.find(r => r[1] === 'TỔNG (trong đơn vị Kg)')?.[13]).toBe(1)      // -3 (L1) + 4 (L3 mới)
        expect(unitTotals.find(r => r[1] === 'TỔNG (trong đơn vị Thùng (20kg))')?.[13]).toBe(-5)
    })

    const isDiffPainted = (sheet: ExcelJS.Worksheet, rowNumber: number, column: number) => {
        const fill = sheet.getRow(rowNumber).getCell(column).fill as any
        return fill?.fgColor?.argb === 'FFFFC7CE'
    }

    /** Tìm cột theo tiêu đề để test không phụ thuộc thứ tự cột của file nguồn. */
    const findColumn = (sheet: ExcelJS.Worksheet, header: string) => {
        for (let r = 1; r <= 10; r++) {
            const row = sheet.getRow(r)
            for (let c = 1; c <= row.cellCount; c++) {
                if (String(row.getCell(c).value ?? '') === header) return c
            }
        }
        throw new Error(`Sheet "${sheet.name}" không có cột "${header}"`)
    }

    it('chép đủ 2 sheet sơ đồ gốc và tô đỏ đúng dòng lệch (dạng Bảng)', async () => {
        const before = await exportThenParse(() => exportWarehouseToExcel({
            systemName: 'KHO_DONG_LANH',
            positions: [
                pos('K1-D1-O1-T1-01', 'L1', 'TP01', 'Sầu riêng múi', 10, 'Kg'),
                pos('K1-D1-O1-T1-02', 'L2', 'TP02', 'Mít thái', 5, 'Thùng (20kg)'),
                pos('K1-D1-O1-T1-04', 'L4', 'TP04', 'Xoài', 8, 'Kg'),
            ],
        } as any), 'truoc.xlsx')
        const after = await exportThenParse(() => exportWarehouseToExcel({
            systemName: 'KHO_DONG_LANH',
            positions: [
                pos('K1-D1-O1-T1-01', 'L1', 'TP01', 'Sầu riêng múi', 7, 'Kg'),
                pos('K1-D1-O1-T1-03', 'L3', 'TP03', 'Bơ', 4, 'Kg'),
                pos('K1-D1-O1-T1-04', 'L4', 'TP04', 'Xoài', 8, 'Kg'),
            ],
        } as any), 'sau.xlsx')

        savedBlobs.length = 0
        await exportStocktakeDiffToExcel(reconcileStocktake(before, after))
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(await savedBlobs[0].arrayBuffer())

        const mapBefore = workbook.getWorksheet('Sơ đồ TRƯỚC')!
        const mapAfter = workbook.getWorksheet('Sơ đồ SAU')!

        // Đầy đủ: chép nguyên số dòng của sheet gốc, không cắt còn mỗi dòng lệch
        expect(mapBefore.rowCount).toBe(before.sourceSheet.rowCount)
        expect(mapAfter.rowCount).toBe(after.sourceSheet.rowCount)

        const rowOf = (snapshot: typeof before, code: string) => snapshot.rows.find(r => r.positionCode === code)!.srcRow
        const positionCol = findColumn(before.sourceSheet, 'Mã vị trí')

        // Dạng Bảng: tô cả dòng của vị trí lệch, không tô dòng không đổi
        expect(isDiffPainted(mapBefore, rowOf(before, 'K1-D1-O1-T1-01'), positionCol)).toBe(true)   // lệch 10 → 7
        expect(isDiffPainted(mapBefore, rowOf(before, 'K1-D1-O1-T1-02'), positionCol)).toBe(true)   // mất ở mốc sau
        expect(isDiffPainted(mapBefore, rowOf(before, 'K1-D1-O1-T1-04'), positionCol)).toBe(false)  // không đổi
        expect(isDiffPainted(mapAfter, rowOf(after, 'K1-D1-O1-T1-03'), positionCol)).toBe(true)     // phát sinh ở mốc sau
        expect(isDiffPainted(mapAfter, rowOf(after, 'K1-D1-O1-T1-04'), positionCol)).toBe(false)

        // Dòng không lệch vẫn được chép đủ nội dung gốc
        expect(mapBefore.getRow(rowOf(before, 'K1-D1-O1-T1-04')).getCell(positionCol).value).toBe('K1-D1-O1-T1-04')
        expect(mapBefore.getCell(rowOf(before, 'K1-D1-O1-T1-01'), positionCol).value).toBe('K1-D1-O1-T1-01')
    })

    it('dạng Lưới tô nguyên ô của tầng có hàng lệch, không lan sang ô khác', async () => {
        const gridDataTwo = (sầuQty: number) => ({
            systemName: 'KHO_DONG_LANH',
            grids: [{
                name: 'Dãy 1',
                parentName: 'KHO 1',
                bins: ['Ô 1', 'Ô 2'],
                levels: ['Tầng 1', 'Tầng 2'],
                cells: [
                    { binIndex: 0, levelIndex: 0, items: [{ productName: 'Sầu riêng múi', sku: 'TP01', unit: 'Kg', quantity: sầuQty, lotCode: 'L1', lotCodes: ['L1'] }] },
                    { binIndex: 1, levelIndex: 0, items: [{ productName: 'Mít thái', sku: 'TP02', unit: 'Kg', quantity: 5, lotCode: 'L2', lotCodes: ['L2'] }] },
                    { binIndex: 0, levelIndex: 1, items: [{ productName: 'Xoài', sku: 'TP04', unit: 'Kg', quantity: 8, lotCode: 'L4', lotCodes: ['L4'] }] },
                ],
            }],
        })

        const before = await exportThenParse(() => exportWarehouseGridToExcel(gridDataTwo(10) as any), 'truoc.xlsx')
        const after = await exportThenParse(() => exportWarehouseGridToExcel(gridDataTwo(7) as any), 'sau.xlsx')

        savedBlobs.length = 0
        await exportStocktakeDiffToExcel(reconcileStocktake(before, after))
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(await savedBlobs[0].arrayBuffer())

        const mapBefore = workbook.getWorksheet('Sơ đồ TRƯỚC')!
        const painted = (snapshot: typeof before, name: string) => {
            const row = snapshot.rows.find(r => r.productName === name)!
            return { row: row.srcRow, col: row.srcCol, painted: isDiffPainted(mapBefore, row.srcRow, row.srcCol!) }
        }

        const dau = painted(before, 'Sầu riêng múi')
        const mit = painted(before, 'Mít thái')
        const xoai = painted(before, 'Xoài')

        expect(dau.painted).toBe(true)
        expect(mit.painted).toBe(false)
        expect(xoai.painted).toBe(false)
        // Tô đúng ô × tầng, không tô cả hàng tầng
        expect(dau.col).not.toBe(mit.col)
    })
})

describe('parseStocktakeFile - file Excel tồn kho theo LOT', () => {
    it('đọc sheet "Tổng hợp": mỗi sản phẩm × ĐVT một dòng, bỏ banner DANH MỤC', async () => {
        const snapshot = await exportThenParse(
            () => lotExport([
                lotGroup('TP01', 'Sầu riêng múi', 'Kg', 10, 'Trái cây'),
                lotGroup('TP02', 'Mít thái', 'Thùng (20kg)', 5, 'Rau'),
            ]),
            'Ton_kho_truoc.xlsx'
        )

        expect(snapshot.format).toBe('lot')
        // Sheet nguồn là 'Tổng hợp' (đã gom sẵn), không phải 'Chi tiết' đầy dòng con
        expect(snapshot.sourceSheet.name).toBe('Tổng hợp')
        // File tồn theo LOT không ghi phân hệ, chỉ ghi chi nhánh/kho đã lọc
        expect(snapshot.systemName).toBe('')
        expect(snapshot.zoneName).toBe('Chi nhánh 1')
        expect(snapshot.exportDate).toBe('Tính đến ngày: 02/11/2026')

        expect(snapshot.rows.length).toBe(2)
        const dau = snapshot.rows[0]
        expect(dau.sku).toBe('TP01')
        expect(dau.productName).toBe('Sầu riêng múi')
        expect(dau.quantity).toBe(10)
        expect(dau.category).toBe('Trái cây')
        expect(dau.unit).toBe('Kg')
        expect(snapshot.rows[1].category).toBe('Rau')

        // Không có vị trí lẫn mã lot → srcCol null nghĩa là tô cả dòng
        expect(snapshot.rows.every(r => r.positionCode === '' && r.lotCode === '' && r.srcCol === null)).toBe(true)
    })

    it('bỏ qua sheet "Chi tiết" đầy dòng con, chỉ đọc sheet "Tổng hợp" của cùng file LOT', async () => {
        savedBlobs.length = 0
        await lotExport([lotGroup('TP01', 'Sầu riêng múi', 'Kg', 10, 'Trái cây')])
        const blob = savedBlobs[0]

        // Chính file đó có 2 sheet: 'Tổng hợp' (mỗi SP một dòng, đứng đầu) và 'Chi tiết' (nhiều dòng con, đứng cuối)
        const rawWorkbook = new ExcelJS.Workbook()
        await rawWorkbook.xlsx.load(await blob.arrayBuffer())
        expect(rawWorkbook.worksheets.map(ws => ws.name)).toEqual(['Tổng hợp', 'Chi tiết'])
        expect(rawWorkbook.getWorksheet('Chi tiết')!.rowCount)
            .toBeGreaterThan(rawWorkbook.getWorksheet('Tổng hợp')!.rowCount)

        const snapshot = await parseStocktakeFile({ name: 'Ton_kho.xlsx', arrayBuffer: () => blob.arrayBuffer() })
        expect(snapshot.sourceSheet.name).toBe('Tổng hợp')
        expect(snapshot.rows.length).toBe(1)
    })

    it('không nhận nhầm báo cáo "theo mã phụ" thành file LOT', async () => {
        savedBlobs.length = 0
        await exportInventoryReportToExcel({
            type: 'tags',
            dateTitle: 'Tính đến ngày: 02/11/2026',
            warehouse: 'Chi nhánh 1',
            items: [lotGroup('TP01', 'Sầu riêng múi', 'Kg', 10, 'Trái cây')],
            companyInfo: null,
        } as any)
        const blob = savedBlobs[0]
        await expect(parseStocktakeFile({ name: 'theo_ma_phu.xlsx', arrayBuffer: () => blob.arrayBuffer() }))
            .rejects.toThrow(/không phải sơ đồ kho/i)
    })
})

describe('đối chiếu + báo cáo cho file tồn theo LOT', () => {
    const isRed = (sheet: ExcelJS.Worksheet, rowNumber: number, column: number) => {
        const fill = sheet.getRow(rowNumber).getCell(column).fill as any
        return fill?.fgColor?.argb === 'FFFFC7CE'
    }

    it('so khớp theo Sản phẩm × ĐVT trên sheet Tổng hợp và xuất báo cáo 5 sheet', async () => {
        const before = await exportThenParse(() => lotExport([
            lotGroup('TP01', 'Sầu riêng múi', 'Kg', 10, 'Trái cây'),
            lotGroup('TP02', 'Mít thái', 'Kg', 5, 'Rau'),
            lotGroup('TP05', 'Xoài', 'Kg', 8, 'Trái cây'),
        ]), 'truoc.xlsx')
        const after = await exportThenParse(() => lotExport([
            lotGroup('TP01', 'Sầu riêng múi', 'Kg', 7, 'Trái cây'),
            lotGroup('TP03', 'Bơ', 'Kg', 4, 'Rau'),
            lotGroup('TP05', 'Xoài', 'Kg', 8, 'Trái cây'),
        ]), 'sau.xlsx')

        const result = reconcileStocktake(before, after)
        expect(result.format).toBe('lot')
        expect(result.changedCount).toBe(1)
        expect(result.onlyBeforeCount).toBe(1)
        expect(result.onlyAfterCount).toBe(1)
        expect(result.sameCount).toBe(1)
        expect(result.positionCount).toBe(3)

        const lost = result.diffRows.find(r => r.kind === 'only_before')
        expect(lost?.sku).toBe('TP02')
        expect(lost?.category).toBe('Rau')
        expect(lost?.beforeQty).toBe(5)
        expect(lost?.afterQty).toBe(0)

        // Cảnh báo nêu rõ giới hạn truy vết và nguồn sheet của lượt LOT
        expect(result.warnings.some(w => w.includes('Sản phẩm × ĐVT'))).toBe(true)
        expect(result.warnings.some(w => w.includes('sheet "Tổng hợp"'))).toBe(true)
        // Không có cảnh báo "2 phân hệ" vì file LOT không ghi phân hệ
        expect(result.warnings.some(w => w.includes('2 phân hệ'))).toBe(false)

        savedBlobs.length = 0
        await exportStocktakeDiffToExcel(result)
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(await savedBlobs[0].arrayBuffer())

        expect(workbook.worksheets.map(ws => ws.name)).toEqual([
            'Biên bản kiểm kê', 'Tồn kho TRƯỚC', 'Tồn kho SAU', 'Chi tiết sai lệch', 'Tổng hợp theo SP', 'Thông tin đối chiếu',
        ])

        const detail = workbook.getWorksheet('Chi tiết sai lệch')!
        expect((detail.getRow(4).values as any[]).filter(Boolean)).toEqual([
            'STT', 'Danh mục', 'Mã SP (SKU)', 'Sản phẩm', 'ĐVT', 'SL trước', 'SL sau', 'Chênh lệch', 'Loại sai lệch',
        ])
        const body = (detail.getRows(5, detail.rowCount - 4) || []).map(r => r.values as any[])
        expect(body.filter(r => r[9])).toHaveLength(3)
        expect(body.flat()).toEqual(expect.arrayContaining(['Lệch số lượng', 'Mất ở mốc sau', 'Phát sinh ở mốc sau']))
        const lostRow = body.find(r => r[9] === 'Mất ở mốc sau')
        expect(lostRow?.[2]).toBe('Rau')
        expect(lostRow?.[6]).toBe(5)
        expect(lostRow?.[7]).toBe(0)
        expect(lostRow?.[8]).toBe(-5)
        // Chỉ một đơn vị tính nên chỉ một dòng tổng, không có tổng xuyên ĐVT
        expect(body.filter(r => typeof r?.[1] === 'string' && (r[1] as string).startsWith('TỔNG (trong đơn vị'))).toHaveLength(1)

        // Sheet chép nguyên bản: tô đỏ cả dòng của sản phẩm lệch, không tô dòng không đổi
        const sheetBefore = workbook.getWorksheet('Tồn kho TRƯỚC')!
        const sheetAfter = workbook.getWorksheet('Tồn kho SAU')!
        expect(sheetBefore.rowCount).toBe(before.sourceSheet.rowCount)
        const rowOf = (snapshot: typeof before, sku: string) => snapshot.rows.find(r => r.sku === sku)!.srcRow
        expect(isRed(sheetBefore, rowOf(before, 'TP01'), 4)).toBe(true)
        expect(isRed(sheetBefore, rowOf(before, 'TP02'), 4)).toBe(true)
        expect(isRed(sheetBefore, rowOf(before, 'TP05'), 4)).toBe(false)
        expect(isRed(sheetAfter, rowOf(after, 'TP03'), 4)).toBe(true)
        expect(isRed(sheetAfter, rowOf(after, 'TP05'), 4)).toBe(false)

        // Sheet được chép là sheet Tổng hợp: đúng 3 dòng sản phẩm, banner DANH MỤC không bị tô
        const productLines = sheetBefore.getRows(1, sheetBefore.rowCount)!
            .filter(r => typeof r.getCell(1).value === 'number').length
        expect(productLines).toBe(3)
        expect(isRed(sheetBefore, rowOf(before, 'TP01') + 1, 4)).toBe(false)
    })

    it('sheet Biên bản kiểm kê: liệt kê toàn bộ hàng theo danh mục, có Kg, tô đỏ dòng lệch, 4 ô chữ ký', async () => {
        const before = await exportThenParse(() => lotExport([
            lotGroup('TP01', 'Sầu riêng múi', 'Kg', 10, 'Trái cây'),
            lotGroup('TP02', 'Mít thái', 'Kg', 5, 'Rau'),
            lotGroup('TP05', 'Xoài', 'Kg', 8, 'Trái cây'),
        ]), 'truoc.xlsx')
        const after = await exportThenParse(() => lotExport([
            lotGroup('TP01', 'Sầu riêng múi', 'Kg', 7, 'Trái cây'),
            lotGroup('TP03', 'Bơ', 'Kg', 4, 'Rau'),
            lotGroup('TP05', 'Xoài', 'Kg', 8, 'Trái cây'),
        ]), 'sau.xlsx')

        savedBlobs.length = 0
        await exportStocktakeDiffToExcel(reconcileStocktake(before, after), undefined, {
            companyInfo: {
                name: 'Công ty TNHH AnyWarehouse', short_name: null, address: 'Lô 12, KCN Sóng Thần',
                phone: '02862788887', email: 'contact@anywarehouse.com', tax_code: null, logo_url: null,
            },
        })
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(await savedBlobs[0].arrayBuffer())
        const minutes = workbook.getWorksheet('Biên bản kiểm kê')!

        expect(minutes.pageSetup.paperSize).toBe(9)          // A4
        expect(minutes.pageSetup.orientation).toBe('landscape') // 9 cột: in đứng sẽ ép chữ quá nhỏ
        // Đầu trang theo đúng bố cục header của báo cáo gốc, chỉ đổi tên báo cáo
        expect(minutes.getCell('A1').value).toBe('CÔNG TY TNHH ANYWAREHOUSE')
        expect(minutes.getCell('A2').value).toBe('Địa chỉ: Lô 12, KCN Sóng Thần')
        expect(minutes.getCell('A3').value).toBe('Email: contact@anywarehouse.com | ĐT: 02862788887')
        expect(minutes.getCell('A5').value).toBe('BÁO CÁO KIỂM KÊ')
        expect(minutes.getCell('A6').value).toContain('Tính đến ngày')
        expect(minutes.getCell('A7').value).toBe("Kho: Chi nhánh 1")

        const findRow = (text: string) => {
            for (let r = 1; r <= minutes.rowCount; r++) {
                const has = (minutes.getRow(r).values as any[])
                    .some(v => typeof v === 'string' && v.includes(text))
                if (has) return r
            }
            return -1
        }
        const rowOfSku = (sku: string) => {
            for (let r = 1; r <= minutes.rowCount; r++) {
                if (minutes.getRow(r).getCell(2).value === sku) return r
            }
            throw new Error(`Biên bản không có dòng ${sku}`)
        }
        const cell = (r: number, c: number) => minutes.getRow(r).getCell(c).value

        // Không còn khối mở đầu/thống kê chữ — xuống thẳng bảng như báo cáo LOT
        expect(findRow('Hôm nay, chúng tôi')).toBe(-1)
        expect(findRow('Tổng số mục sản phẩm')).toBe(-1)

        const headerRow = findRow('SL trước kiểm kê')
        expect(headerRow).toBe(8)
        // Font/màu theo sheet Tổng hợp gốc: chữ đen đậm trên nền xám nhạt, không khối xanh
        expect((minutes.getRow(headerRow).getCell(1).fill as any).fgColor.argb).toBe('FFF2F2F2')
        expect(minutes.getRow(headerRow).getCell(1).font.bold).toBe(true)
        expect(minutes.getRow(headerRow).getCell(1).font.color).toBeUndefined()
        expect((minutes.getRow(headerRow).values as any[]).filter(Boolean)).toEqual([
            'STT', 'Mã SP', 'Tên sản phẩm', 'ĐVT', 'SL trước kiểm kê', 'SL sau kiểm kê', 'Chênh lệch',
            'Quy đổi (Kg) sau kiểm kê', 'Ghi chú / nguyên nhân chênh lệch',
        ])

        const dauRow = rowOfSku('TP01')
        expect(cell(dauRow, 5)).toBe(10)
        expect(cell(dauRow, 6)).toBe(7)
        expect(cell(dauRow, 7)).toBe(-3)
        expect(cell(dauRow, 8)).toBe(14)                      // cột Kg lấy theo mốc SAU
        expect(cell(dauRow, 9) || '').toBe('')                // dòng lệch số lượng: để trống cho kiểm kê viên ghi
        expect(isRed(minutes, dauRow, 3)).toBe(true)
        expect(minutes.getRow(dauRow).font.bold).toBe(true)     // dòng sản phẩm đậm như báo cáo gốc
        expect(minutes.getRow(dauRow).getCell(7).font.color).toBeUndefined() // không tô màu chữ ở cột chênh lệch

        // Hàng KHÔNG đổi vẫn nằm trong biên bản (bản liệt kê đầy đủ) và không bị tô đỏ
        const xoaiRow = rowOfSku('TP05')
        expect(cell(xoaiRow, 5)).toBe(8)
        expect(cell(xoaiRow, 7)).toBe(0)
        expect(cell(xoaiRow, 8)).toBe(16)
        expect(isRed(minutes, xoaiRow, 3)).toBe(false)

        expect(cell(rowOfSku('TP02'), 9)).toBe('Mất ở mốc sau')
        expect(cell(rowOfSku('TP03'), 9)).toBe('Phát sinh ở mốc sau')

        // Giữ đúng nhóm "DANH MỤC:" của file gốc + tổng quy đổi Kg của từng danh mục
        expect(findRow('DANH MỤC: RAU')).toBeGreaterThan(headerRow)
        const totalTraiCay = findRow('TỔNG QUY ĐỔI (Kg) — DANH MỤC: Trái cây')
        expect(totalTraiCay).toBeGreaterThan(findRow('DANH MỤC: TRÁI CÂY'))
        expect(cell(totalTraiCay, 5)).toBe(36)                // 20 + 16
        expect(cell(totalTraiCay, 6)).toBe(30)                // 14 + 16
        expect(cell(totalTraiCay, 7)).toBe(-6)

        // Biên bản dừng ở tổng Kg của từng danh mục: không có khối TỔNG THEO ĐVT, không Kết luận, không chứng từ kèm theo
        expect(findRow('TỔNG TRONG ĐƠN VỊ')).toBe(-1)
        expect(findRow('Kết luận:')).toBe(-1)
        expect(findRow('Chứng từ kèm theo')).toBe(-1)

        const kyKiemKe = findRow('NGƯỜI KIỂM KÊ')
        expect(findRow('THỦ KHO')).toBe(kyKiemKe)              // cùng hàng
        expect(findRow('KẾ TOÁN TRƯỞNG')).toBeGreaterThan(kyKiemKe)
        expect(findRow('GIÁM ĐỐC')).toBe(findRow('KẾ TOÁN TRƯỞNG'))
        expect(findRow('Họ và tên')).toBeGreaterThan(kyKiemKe)
    })

    it('từ chối ghép file LOT với file sơ đồ kho', async () => {
        const lot = await exportThenParse(() => lotExport([lotGroup('TP01', 'Sầu riêng múi', 'Kg', 10, 'Trái cây')]), 'lot.xlsx')
        const table = await exportThenParse(
            () => exportWarehouseToExcel({ systemName: 'KHO_DONG_LANH', positions: [pos('K1', 'L1', 'TP01', 'Sầu riêng múi', 10, 'Kg')] } as any),
            'bang.xlsx'
        )
        expect(() => reconcileStocktake(lot, table)).toThrow(/tồn theo LOT vs dạng Bảng/)
    })
})
