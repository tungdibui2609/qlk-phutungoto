import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { format } from 'date-fns'
import { decodeSTT } from './numberUtils'

export interface OddLotExportItem {
    id: string
    code: string
    daily_seq: number | null
    quantity: number
    lot: any
    location: string
    unit: string
    lotItemId: string
}

export interface OddLotGroupExport {
    productId: string
    productName: string
    productSku: string
    quantityPerPallet: number
    productUnit: string
    suggestedLots: OddLotExportItem[]
}

// Helper để trích xuất tags của một lot đối với sản phẩm cụ thể
export function getLotTagsString(lot: any, productId: string): string {
    const productItemIds = lot.lot_items
        ?.filter((i: any) => i.product_id === productId)
        ?.map((i: any) => i.id) || []

    const itemTags = lot.lot_tags
        ?.filter((t: any) => t.lot_item_id && productItemIds.includes(t.lot_item_id))
        ?.map((t: any) => t.tag) || []

    return itemTags.length > 0 ? itemTags.join(', ') : 'Không có mã phụ'
}

/**
 * Xuất Excel TOÀN BỘ các mặt hàng có gợi ý ghép lot lẻ
 */
export async function exportAllOddLotsToExcel({
    suggestions,
    systemName = 'Kho'
}: {
    suggestions: OddLotGroupExport[]
    systemName?: string
}) {
    if (!suggestions || suggestions.length === 0) return

    const workbook = new ExcelJS.Workbook()
    const nowStr = format(new Date(), 'dd/MM/yyyy HH:mm')
    const fileDateStr = format(new Date(), 'yyyyMMdd_HHmm')

    // ==========================================
    // SHEET 1: TỔNG HỢP CÁC NHÓM SẢN PHẨM CẦN GHÉP
    // ==========================================
    const wsSummary = workbook.addWorksheet('Tổng hợp gợi ý ghép', {
        views: [{ showGridLines: true }]
    })

    wsSummary.columns = [
        { key: 'stt', width: 8 },
        { key: 'sku', width: 22 },
        { key: 'name', width: 42 },
        { key: 'spec', width: 20 },
        { key: 'oddCount', width: 14 },
        { key: 'totalQty', width: 16 },
        { key: 'unit', width: 12 },
        { key: 'mergePallets', width: 18 },
        { key: 'remainder', width: 14 },
        { key: 'note', width: 25 },
    ]

    // Title Section
    let rowIdx = 1
    wsSummary.mergeCells(`A${rowIdx}:J${rowIdx}`)
    const titleCell = wsSummary.getCell(`A${rowIdx}`)
    titleCell.value = 'BÁO CÁO TỔNG HỢP GỢI Ý GHÉP LOT LẺ'
    titleCell.font = { bold: true, size: 16, color: { argb: '1E3A8A' } }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    wsSummary.getRow(rowIdx).height = 32
    rowIdx++

    wsSummary.mergeCells(`A${rowIdx}:J${rowIdx}`)
    const subCell = wsSummary.getCell(`A${rowIdx}`)
    subCell.value = `Kho: ${systemName} | Thời gian xuất: ${nowStr} | Tổng cộng: ${suggestions.length} mặt hàng có lot lẻ`
    subCell.font = { italic: true, size: 11, color: { argb: '475569' } }
    subCell.alignment = { horizontal: 'center', vertical: 'middle' }
    rowIdx++

    rowIdx++ // Trống 1 dòng

    // Table Header
    const headerRow = wsSummary.getRow(rowIdx)
    headerRow.values = [
        'STT',
        'Mã SKU',
        'Tên Sản Phẩm',
        'Quy Cách (ĐVT/Pallet)',
        'Số Lot Lẻ',
        'Tổng SL Lẻ',
        'ĐVT',
        'Số Pallet Gộp Đầy',
        'SL Còn Dư',
        'Đánh Giá Gộp'
    ]
    headerRow.height = 28
    headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFF' } }
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '4338CA' } // Indigo 700
        }
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        }
    })
    rowIdx++

    let grandTotalLots = 0
    let grandTotalPallets = 0

    suggestions.forEach((item, index) => {
        const totalQty = item.suggestedLots.reduce((sum, l) => sum + l.quantity, 0)
        const fullPallets = Math.floor(totalQty / item.quantityPerPallet)
        const remainder = totalQty % item.quantityPerPallet
        
        grandTotalLots += item.suggestedLots.length
        grandTotalPallets += fullPallets

        const row = wsSummary.addRow({
            stt: index + 1,
            sku: item.productSku,
            name: item.productName,
            spec: `${item.quantityPerPallet} ${item.productUnit}/Pallet`,
            oddCount: item.suggestedLots.length,
            totalQty: totalQty,
            unit: item.productUnit,
            mergePallets: fullPallets,
            remainder: remainder,
            note: fullPallets > 0 
                ? `Đủ ${fullPallets} pallet (dư ${remainder})`
                : `Chưa đủ 1 pallet (${totalQty}/${item.quantityPerPallet})`
        })

        row.height = 24
        row.eachCell((cell, colNumber) => {
            cell.border = {
                top: { style: 'thin', color: { argb: 'E2E8F0' } },
                left: { style: 'thin', color: { argb: 'E2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
                right: { style: 'thin', color: { argb: 'E2E8F0' } }
            }
            if (colNumber === 1 || colNumber === 5 || colNumber === 7 || colNumber === 8 || colNumber === 9) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' }
            } else if (colNumber === 6) {
                cell.alignment = { horizontal: 'right', vertical: 'middle' }
                cell.numFmt = '#,##0'
                cell.font = { bold: true }
            } else if (colNumber === 2) {
                cell.alignment = { horizontal: 'left', vertical: 'middle' }
                cell.font = { bold: true, color: { argb: '3730A3' } }
            } else {
                cell.alignment = { horizontal: 'left', vertical: 'middle' }
            }
        })
    })

    // Dòng tổng kết
    const sumRow = wsSummary.addRow({
        stt: '',
        sku: 'TỔNG CỘNG',
        name: `${suggestions.length} mặt hàng`,
        spec: '',
        oddCount: grandTotalLots,
        totalQty: '',
        unit: '',
        mergePallets: grandTotalPallets,
        remainder: '',
        note: `Ước tính gộp được ${grandTotalPallets} Pallet`
    })
    sumRow.height = 26
    sumRow.eachCell((cell, colNumber) => {
        cell.font = { bold: true, color: { argb: '1E1B4B' } }
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'EEF2FF' } // Indigo 50
        }
        cell.border = {
            top: { style: 'medium', color: { argb: '4338CA' } },
            bottom: { style: 'medium', color: { argb: '4338CA' } },
            left: { style: 'thin', color: { argb: 'E2E8F0' } },
            right: { style: 'thin', color: { argb: 'E2E8F0' } }
        }
        if (colNumber === 5 || colNumber === 8) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
        }
    })

    // ==========================================
    // SHEET 2: CHI TIẾT TẤT CẢ LOT LẺ
    // ==========================================
    const wsDetail = workbook.addWorksheet('Chi tiết tất cả Lot lẻ', {
        views: [{ showGridLines: true }]
    })

    wsDetail.columns = [
        { key: 'stt', width: 8 },
        { key: 'sku', width: 20 },
        { key: 'productName', width: 38 },
        { key: 'dailySeq', width: 12 },
        { key: 'lotCode', width: 22 },
        { key: 'location', width: 22 },
        { key: 'tags', width: 26 },
        { key: 'quantity', width: 14 },
        { key: 'unit', width: 12 },
        { key: 'palletRatio', width: 16 }
    ]

    let dRowIdx = 1
    wsDetail.mergeCells(`A${dRowIdx}:J${dRowIdx}`)
    const dTitleCell = wsDetail.getCell(`A${dRowIdx}`)
    dTitleCell.value = 'DANH SÁCH CHI TIẾT TẤT CẢ CÁC LÔ HÀNG LẺ CÓ THỂ GHÉP'
    dTitleCell.font = { bold: true, size: 15, color: { argb: '1E3A8A' } }
    dTitleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    wsDetail.getRow(dRowIdx).height = 30
    dRowIdx++

    wsDetail.mergeCells(`A${dRowIdx}:J${dRowIdx}`)
    const dSubCell = wsDetail.getCell(`A${dRowIdx}`)
    dSubCell.value = `Kho: ${systemName} | Ngày xuất: ${nowStr}`
    dSubCell.font = { italic: true, size: 10, color: { argb: '64748B' } }
    dSubCell.alignment = { horizontal: 'center', vertical: 'middle' }
    dRowIdx++

    dRowIdx++ // Khoảng trống

    // Header bảng chi tiết
    const dHeaderRow = wsDetail.getRow(dRowIdx)
    dHeaderRow.values = [
        'STT',
        'Mã SKU',
        'Tên Sản Phẩm',
        'STT Lô',
        'Mã LOT',
        'Vị Trí Hiện Tại',
        'Mã Phụ (Tag)',
        'Số Lượng',
        'ĐVT',
        '% Chiếm Pallet'
    ]
    dHeaderRow.height = 28
    dHeaderRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFF' } }
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '2563EB' } // Blue 600
        }
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        }
    })
    dRowIdx++

    let rowCount = 1
    suggestions.forEach(item => {
        item.suggestedLots.forEach(lotItem => {
            const tags = getLotTagsString(lotItem.lot, item.productId)
            const ratioPercent = Math.round((lotItem.quantity / item.quantityPerPallet) * 100)

            const row = wsDetail.addRow({
                stt: rowCount++,
                sku: item.productSku,
                productName: item.productName,
                dailySeq: decodeSTT(lotItem.daily_seq) || '--',
                lotCode: lotItem.code,
                location: lotItem.location,
                tags: tags,
                quantity: lotItem.quantity,
                unit: lotItem.unit,
                palletRatio: `${lotItem.quantity}/${item.quantityPerPallet} (${ratioPercent}%)`
            })

            row.height = 22
            row.eachCell((cell, colNumber) => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'E2E8F0' } },
                    left: { style: 'thin', color: { argb: 'E2E8F0' } },
                    bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
                    right: { style: 'thin', color: { argb: 'E2E8F0' } }
                }

                // Căn giữa cho STT, STT Lô, Mã Lot, Vị trí, ĐVT, Tỷ lệ
                if ([1, 4, 5, 6, 9, 10].includes(colNumber)) {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' }
                } else if (colNumber === 8) {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' }
                    cell.numFmt = '#,##0'
                    cell.font = { bold: true }
                } else {
                    cell.alignment = { horizontal: 'left', vertical: 'middle' }
                }

                if (colNumber === 4) {
                    cell.font = { bold: true }
                }
            })
        })
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const fileName = `Goi_Y_Ghep_Lot_Le_Toan_Bo_${fileDateStr}.xlsx`
    saveAs(new Blob([buffer]), fileName)
}

/**
 * Xuất Excel RIÊNG CHO 1 MẶT HÀNG có lot lẻ
 */
export async function exportSingleProductOddLotsToExcel({
    suggestion,
    systemName = 'Kho',
    checkedLotItemIds
}: {
    suggestion: OddLotGroupExport
    systemName?: string
    checkedLotItemIds?: string[]
}) {
    if (!suggestion || !suggestion.suggestedLots || suggestion.suggestedLots.length === 0) return

    const workbook = new ExcelJS.Workbook()
    const nowStr = format(new Date(), 'dd/MM/yyyy HH:mm')
    const fileDateStr = format(new Date(), 'yyyyMMdd_HHmm')

    // Tên sheet an toàn (tối đa 31 ký tự, loại bỏ ký tự cấm)
    const safeSheetName = (suggestion.productSku || 'Chi tiết lot lẻ')
        .replace(/[:\\/?*\[\]]/g, '')
        .substring(0, 30)

    const ws = workbook.addWorksheet(safeSheetName, {
        views: [{ showGridLines: true }]
    })

    ws.columns = [
        { key: 'stt', width: 8 },
        { key: 'dailySeq', width: 14 },
        { key: 'lotCode', width: 24 },
        { key: 'location', width: 24 },
        { key: 'tags', width: 28 },
        { key: 'quantity', width: 16 },
        { key: 'unit', width: 12 },
        { key: 'palletRatio', width: 20 },
        { key: 'status', width: 18 }
    ]

    let rowIdx = 1

    // Header Title
    ws.mergeCells(`A${rowIdx}:I${rowIdx}`)
    const titleCell = ws.getCell(`A${rowIdx}`)
    titleCell.value = 'DANH SÁCH GỢI Ý GHÉP LOT LẺ THEO MẶT HÀNG'
    titleCell.font = { bold: true, size: 16, color: { argb: '1E3A8A' } }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(rowIdx).height = 32
    rowIdx++

    // Thông tin sản phẩm
    ws.mergeCells(`A${rowIdx}:I${rowIdx}`)
    const prodCell = ws.getCell(`A${rowIdx}`)
    prodCell.value = `Sản phẩm: ${suggestion.productName} [${suggestion.productSku}]`
    prodCell.font = { bold: true, size: 12, color: { argb: '0F172A' } }
    prodCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(rowIdx).height = 22
    rowIdx++

    // Tính toán số liệu tổng quan
    const totalQty = suggestion.suggestedLots.reduce((sum, l) => sum + l.quantity, 0)
    const fullPallets = Math.floor(totalQty / suggestion.quantityPerPallet)
    const remainder = totalQty % suggestion.quantityPerPallet

    ws.mergeCells(`A${rowIdx}:I${rowIdx}`)
    const infoCell = ws.getCell(`A${rowIdx}`)
    infoCell.value = `Kho: ${systemName} | Quy cách: ${suggestion.quantityPerPallet} ${suggestion.productUnit}/Pallet | Tổng số lô lẻ: ${suggestion.suggestedLots.length} lot | Tổng SL: ${totalQty} ${suggestion.productUnit} (Ghép được: ${fullPallets} Pallet đầy${remainder > 0 ? `, dư ${remainder} ${suggestion.productUnit}` : ''})`
    infoCell.font = { italic: true, size: 10.5, color: { argb: '475569' } }
    infoCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(rowIdx).height = 20
    rowIdx++

    ws.mergeCells(`A${rowIdx}:I${rowIdx}`)
    const timeCell = ws.getCell(`A${rowIdx}`)
    timeCell.value = `Ngày xuất báo cáo: ${nowStr}`
    timeCell.font = { italic: true, size: 9.5, color: { argb: '64748B' } }
    timeCell.alignment = { horizontal: 'center', vertical: 'middle' }
    rowIdx++

    rowIdx++ // Trống 1 dòng

    // Header bảng
    const headerRow = ws.getRow(rowIdx)
    headerRow.values = [
        'STT',
        'STT Lô',
        'Mã LOT',
        'Vị Trí Hiện Tại',
        'Mã Phụ (Tag)',
        'Số Lượng',
        'ĐVT',
        '% Chiếm Pallet',
        'Chọn Ghép'
    ]
    headerRow.height = 28
    headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFF' } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '4F46E5' } // Indigo 600
        }
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        }
    })
    rowIdx++

    let checkedSum = 0
    let checkedCount = 0

    suggestion.suggestedLots.forEach((lotItem, index) => {
        const isChecked = checkedLotItemIds ? checkedLotItemIds.includes(lotItem.lotItemId) : true
        const tags = getLotTagsString(lotItem.lot, suggestion.productId)
        const ratioPercent = Math.round((lotItem.quantity / suggestion.quantityPerPallet) * 100)

        if (isChecked) {
            checkedSum += lotItem.quantity
            checkedCount++
        }

        const row = ws.addRow({
            stt: index + 1,
            dailySeq: decodeSTT(lotItem.daily_seq) || '--',
            lotCode: lotItem.code,
            location: lotItem.location,
            tags: tags,
            quantity: lotItem.quantity,
            unit: lotItem.unit,
            palletRatio: `${lotItem.quantity}/${suggestion.quantityPerPallet} (${ratioPercent}%)`,
            status: isChecked ? '✓ Đã chọn' : 'Chưa chọn'
        })

        row.height = 24
        row.eachCell((cell, colNumber) => {
            cell.border = {
                top: { style: 'thin', color: { argb: 'E2E8F0' } },
                left: { style: 'thin', color: { argb: 'E2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
                right: { style: 'thin', color: { argb: 'E2E8F0' } }
            }

            if ([1, 2, 3, 4, 7, 8, 9].includes(colNumber)) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' }
            } else if (colNumber === 6) {
                cell.alignment = { horizontal: 'right', vertical: 'middle' }
                cell.numFmt = '#,##0'
                cell.font = { bold: true }
            } else {
                cell.alignment = { horizontal: 'left', vertical: 'middle' }
            }

            if (colNumber === 2) {
                cell.font = { bold: true }
            }

            // Màu trạng thái chọn
            if (colNumber === 9) {
                if (isChecked) {
                    cell.font = { bold: true, color: { argb: '16A34A' } } // Green
                } else {
                    cell.font = { color: { argb: '94A3B8' } } // Gray
                }
            }
        })
    })

    // Dòng tổng cộng
    const sumRow = ws.addRow({
        stt: '',
        dailySeq: 'TỔNG CỘNG',
        lotCode: `${suggestion.suggestedLots.length} lô lẻ`,
        location: '',
        tags: '',
        quantity: totalQty,
        unit: suggestion.productUnit,
        palletRatio: `${fullPallets} Pallet đầy + dư ${remainder}`,
        status: checkedLotItemIds ? `Đã chọn ${checkedCount} lô (${checkedSum})` : ''
    })
    sumRow.height = 26
    sumRow.eachCell((cell, colNumber) => {
        cell.font = { bold: true, color: { argb: '1E1B4B' } }
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'EEF2FF' }
        }
        cell.border = {
            top: { style: 'medium', color: { argb: '4F46E5' } },
            bottom: { style: 'medium', color: { argb: '4F46E5' } },
            left: { style: 'thin', color: { argb: 'E2E8F0' } },
            right: { style: 'thin', color: { argb: 'E2E8F0' } }
        }
        if (colNumber === 6) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' }
            cell.numFmt = '#,##0'
        } else if ([1, 2, 3, 7, 8, 9].includes(colNumber)) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
        }
    })

    const cleanSku = (suggestion.productSku || 'SanPham').replace(/[^a-zA-Z0-9_-]/g, '_')
    const fileName = `Goi_Y_Ghep_Lot_${cleanSku}_${fileDateStr}.xlsx`

    const buffer = await workbook.xlsx.writeBuffer()
    saveAs(new Blob([buffer]), fileName)
}
