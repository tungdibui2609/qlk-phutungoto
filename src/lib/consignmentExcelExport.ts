import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { format } from 'date-fns'
import { CompanyInfo } from '@/hooks/usePrintCompanyInfo'

export interface ConsignmentExcelItem {
    warehouseName: string
    categoryName?: string | null
    productName: string
    productCode: string
    unit: string
    opening: number
    qtyIn: number
    qtyOut: number
    balance: number
    kg: number
}

export interface ConsignmentReportExportData {
    dateTitle: string
    warehouseLabel: string
    groupByWarehouse: boolean
    items: ConsignmentExcelItem[]
    companyInfo: CompanyInfo | null
}

function cleanNum(val: any): number {
    const n = Number(val) || 0
    return Math.round(n * 100) / 100
}

function applyNumFormat(cell: ExcelJS.Cell) {
    cell.alignment = { horizontal: 'right', vertical: 'middle' }
    const val = cell.value
    if (typeof val === 'number' && Number.isInteger(val)) {
        cell.numFmt = '#,##0'
    } else {
        cell.numFmt = '#,##0.###'
    }
}

const THIN_BORDER: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
}

export async function exportConsignmentReportToExcel(data: ConsignmentReportExportData) {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Bao Cao Ton Kho Ky Gui')

    const cols = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Tên Sản Phẩm', key: 'productName', width: 42 },
        { header: 'Mã SP', key: 'productCode', width: 22 },
        { header: 'ĐVT', key: 'unit', width: 14 },
        { header: 'Tồn Đầu', key: 'opening', width: 15 },
        { header: 'Nhập', key: 'qtyIn', width: 15 },
        { header: 'Xuất', key: 'qtyOut', width: 15 },
        { header: 'Tồn Cuối', key: 'balance', width: 15 },
        { header: 'Quy đổi (Kg)', key: 'kg', width: 15 }
    ]

    worksheet.columns = cols.map(c => ({ key: c.key, width: c.width }))

    // 1. Header thông tin công ty (giống hệt inventoryReportExcelExport.ts)
    let currentRow = 1
    if (data.companyInfo) {
        if (data.companyInfo.name) {
            worksheet.mergeCells(`A${currentRow}:E${currentRow}`)
            const nameCell = worksheet.getCell(`A${currentRow}`)
            nameCell.value = data.companyInfo.name.toUpperCase()
            nameCell.font = { bold: true, size: 10 }
            currentRow++
        }
        if (data.companyInfo.address) {
            worksheet.mergeCells(`A${currentRow}:E${currentRow}`)
            const addrCell = worksheet.getCell(`A${currentRow}`)
            addrCell.value = `Địa chỉ: ${data.companyInfo.address}`
            addrCell.font = { size: 9 }
            currentRow++
        }
        if (data.companyInfo.email || data.companyInfo.phone) {
            worksheet.mergeCells(`A${currentRow}:E${currentRow}`)
            const contactCell = worksheet.getCell(`A${currentRow}`)
            contactCell.value = `${data.companyInfo.email ? `Email: ${data.companyInfo.email} | ` : ''}ĐT: ${data.companyInfo.phone || ''}`
            contactCell.font = { size: 9 }
            currentRow++
        }
    }

    currentRow++ // Spacer

    // 2. Tiêu đề báo cáo
    const lastCol = String.fromCharCode(65 + cols.length - 1) // I
    worksheet.mergeCells(`A${currentRow}:${lastCol}${currentRow}`)
    const titleCell = worksheet.getCell(`A${currentRow}`)
    titleCell.value = 'BÁO CÁO TỔNG HỢP NHẬP XUẤT TỒN HÀNG KÝ GỬI'
    titleCell.font = { bold: true, size: 16 }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    worksheet.getRow(currentRow).height = 26
    currentRow++

    worksheet.mergeCells(`A${currentRow}:${lastCol}${currentRow}`)
    const dateCell = worksheet.getCell(`A${currentRow}`)
    dateCell.value = data.dateTitle
    dateCell.alignment = { horizontal: 'center' }
    dateCell.font = { italic: true, size: 10 }
    currentRow++

    if (data.warehouseLabel) {
        worksheet.mergeCells(`A${currentRow}:${lastCol}${currentRow}`)
        const whCell = worksheet.getCell(`A${currentRow}`)
        whCell.value = `Kho ký gửi: ${data.warehouseLabel}`
        whCell.font = { bold: true, size: 10 }
        currentRow++
    }

    currentRow++ // Spacer before table header

    // 3. Header bảng
    const headerRow = worksheet.getRow(currentRow)
    headerRow.height = 24
    headerRow.values = cols.map(c => c.header)
    headerRow.eachCell(cell => {
        cell.font = { bold: true, size: 10 }
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        cell.border = THIN_BORDER
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF2F2F2' }
        }
    })
    currentRow++

    // 4. Gom nhóm giống Tab Kế toán (theo Kho ký gửi khi xem tất cả kho, hoặc theo Danh mục khi lọc 1 kho)
    const groups = new Map<string, ConsignmentExcelItem[]>()
    data.items.forEach(item => {
        const groupKey = data.groupByWarehouse
            ? `KHO KÝ GỬI: ${(item.warehouseName || 'Chưa phân kho').toUpperCase()}`
            : `DANH MỤC: ${(item.categoryName || 'Chưa phân loại').toUpperCase()}`
        if (!groups.has(groupKey)) groups.set(groupKey, [])
        groups.get(groupKey)!.push(item)
    })

    const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
        if (a[0].includes('CHƯA PHÂN LOẠI')) return 1
        if (b[0].includes('CHƯA PHÂN LOẠI')) return -1
        return a[0].localeCompare(b[0])
    })

    let stt = 1
    const grandTotals = { opening: 0, qtyIn: 0, qtyOut: 0, balance: 0, kg: 0 }

    sortedGroups.forEach(([groupLabel, groupItems]) => {
        const groupTotals = groupItems.reduce(
            (acc, item) => ({
                opening: acc.opening + (item.opening || 0),
                qtyIn: acc.qtyIn + (item.qtyIn || 0),
                qtyOut: acc.qtyOut + (item.qtyOut || 0),
                balance: acc.balance + (item.balance || 0),
                kg: acc.kg + (item.kg || 0)
            }),
            { opening: 0, qtyIn: 0, qtyOut: 0, balance: 0, kg: 0 }
        )

        grandTotals.opening += groupTotals.opening
        grandTotals.qtyIn += groupTotals.qtyIn
        grandTotals.qtyOut += groupTotals.qtyOut
        grandTotals.balance += groupTotals.balance
        grandTotals.kg += groupTotals.kg

        // Dòng tiêu đề nhóm (màu vàng nhạt FFF2CC giống hệt Tab Kế toán)
        const groupRow = worksheet.addRow([
            groupLabel,
            '',
            '',
            '',
            cleanNum(groupTotals.opening),
            cleanNum(groupTotals.qtyIn),
            cleanNum(groupTotals.qtyOut),
            cleanNum(groupTotals.balance),
            cleanNum(groupTotals.kg)
        ])
        worksheet.mergeCells(`A${groupRow.number}:D${groupRow.number}`)
        groupRow.height = 21
        groupRow.font = { bold: true, italic: true, size: 10, color: { argb: 'FF7F6000' } }
        groupRow.eachCell((cell, colNumber) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFF2CC' }
            }
            cell.border = THIN_BORDER
            if (colNumber >= 5) {
                applyNumFormat(cell)
            } else {
                cell.alignment = { horizontal: 'left', vertical: 'middle' }
            }
        })

        // Các dòng sản phẩm trong nhóm
        groupItems.forEach(item => {
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
            ])
            row.height = 20
            row.eachCell((cell, colNumber) => {
                cell.border = THIN_BORDER
                cell.font = { size: 10 }
                if (colNumber === 1 || colNumber === 4) {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' }
                } else if (colNumber === 2 || colNumber === 3) {
                    cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
                } else if (colNumber >= 5) {
                    applyNumFormat(cell)
                }
            })
        })
    })

    // 5. Dòng TỔNG CỘNG cuối bảng
    const totalRow = worksheet.addRow([
        'TỔNG CỘNG',
        '',
        '',
        '',
        cleanNum(grandTotals.opening),
        cleanNum(grandTotals.qtyIn),
        cleanNum(grandTotals.qtyOut),
        cleanNum(grandTotals.balance),
        cleanNum(grandTotals.kg)
    ])
    worksheet.mergeCells(`A${totalRow.number}:D${totalRow.number}`)
    totalRow.height = 22
    totalRow.font = { bold: true, size: 10 }
    totalRow.eachCell((cell, colNumber) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF2F2F2' }
        }
        cell.border = THIN_BORDER
        if (colNumber >= 5) {
            applyNumFormat(cell)
        } else {
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
        }
    })

    // 6. Phần chữ ký (giống hệt inventoryReportExcelExport.ts)
    let signRowIdx = worksheet.lastRow!.number + 3
    const lastColIdx = worksheet.columns.length

    const dateSignRow = worksheet.getRow(signRowIdx)
    dateSignRow.getCell(lastColIdx - 1).value = 'Ngày ...... tháng ...... năm ......'
    dateSignRow.getCell(lastColIdx - 1).font = { italic: true, size: 10 }
    dateSignRow.getCell(lastColIdx - 1).alignment = { horizontal: 'center' }
    signRowIdx++

    const signTitleRow = worksheet.getRow(signRowIdx)
    signTitleRow.getCell(2).value = 'Người Lập Biểu'
    signTitleRow.getCell(Math.floor(lastColIdx / 2) + 1).value = 'Thủ Kho'
    signTitleRow.getCell(lastColIdx - 1).value = 'Giám Đốc'
    signTitleRow.eachCell(cell => {
        cell.font = { bold: true, size: 10 }
        cell.alignment = { horizontal: 'center' }
    })

    // 7. Page setup in ngang A4 gọn gàng
    worksheet.pageSetup = {
        paperSize: 9,
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const fileName = `Ton_kho_ky_gui_${format(new Date(), 'yyyy-MM-dd')}.xlsx`
    saveAs(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        fileName
    )
}
