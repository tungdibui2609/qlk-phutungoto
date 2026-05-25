import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

// Helper: Convert column letter to number (A=1, B=2, ..., Z=26, AA=27, etc.)
function colLetterToNumber(col: string): number {
    let num = 0
    for (let i = 0; i < col.length; i++) {
        num = num * 26 + (col.charCodeAt(i) - 64)
    }
    return num
}

// Normalize string for comparison
function normalizeStr(s: string | undefined | null): string {
    return s ? s.normalize('NFC').toLowerCase().trim() : ''
}

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const token = request.headers.get('Authorization')?.replace('Bearer ', '')

        const body = await request.json()
        const { orderIds, system_code, printType = 'official' } = body

        if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
            return NextResponse.json({ error: 'Danh sách phiếu trống' }, { status: 400 })
        }

        if (!system_code) {
            return NextResponse.json({ error: 'Thiếu system_code' }, { status: 400 })
        }

        // Create authenticated Supabase client
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        cookieStore.set({ name, value, ...options })
                    },
                    remove(name: string, options: CookieOptions) {
                        cookieStore.set({ name, value: '', ...options })
                    },
                },
                global: {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                }
            }
        )

        // Fetch all inbound orders
        const { data: orders, error: ordersError } = await supabase
            .from('inbound_orders')
            .select('*')
            .eq('system_code', system_code)
            .in('id', orderIds)

        if (ordersError) {
            return NextResponse.json({ error: 'Lỗi tải dữ liệu phiếu: ' + ordersError.message }, { status: 500 })
        }

        if (!orders || orders.length === 0) {
            return NextResponse.json({ error: 'Không tìm thấy phiếu nào' }, { status: 404 })
        }

        // Fetch items for all orders in one query
        const { data: allItems, error: itemsError } = await supabase
            .from('inbound_order_items')
            .select(`
                *,
                products (
                    id,
                    sku,
                    internal_code,
                    internal_name,
                    name,
                    unit,
                    product_units (
                        unit_id,
                        conversion_rate
                    )
                )
            `)
            .in('order_id', orderIds)

        if (itemsError) {
            return NextResponse.json({ error: 'Lỗi tải dữ liệu hàng hóa: ' + itemsError.message }, { status: 500 })
        }

        // Fetch units for conversion mapping
        const { data: unitsData } = await supabase
            .from('units')
            .select('id, name')

        const unitsMap: Record<string, string> = {}
        if (unitsData) {
            unitsData.forEach((u: any) => { unitsMap[u.id] = u.name })
        }

        // Fetch systems config for modules info + company_id
        const { data: systemConfig } = await supabase
            .from('systems')
            .select('*')
            .eq('code', system_code)
            .single()

        const hasInboundFinancials = (() => {
            if (!systemConfig) return false
            const modules = typeof systemConfig.inbound_modules === 'string'
                ? JSON.parse(systemConfig.inbound_modules)
                : systemConfig.inbound_modules
            return Array.isArray(modules) && modules.includes('inbound_financials')
        })()

        const hasInboundConversion = (() => {
            if (!systemConfig) return false
            const modules = typeof systemConfig.inbound_modules === 'string'
                ? JSON.parse(systemConfig.inbound_modules)
                : systemConfig.inbound_modules
            return Array.isArray(modules) && modules.includes('inbound_conversion')
        })()

        // Fetch company info if available
        let companyInfo: { name?: string; address?: string; phone?: string; email?: string; short_name?: string; tax_code?: string } | null = null
        if (systemConfig?.company_id) {
            const { data: company } = await supabase
                .from('companies')
                .select('*')
                .eq('id', systemConfig.company_id)
                .single()
            if (company) {
                companyInfo = company
            }
        }

        const isOfficial = printType !== 'internal'

        // Group items by order_id
        const itemsByOrder: Record<string, any[]> = {}
        if (allItems) {
            allItems.forEach((item: any) => {
                if (!itemsByOrder[item.order_id]) {
                    itemsByOrder[item.order_id] = []
                }
                itemsByOrder[item.order_id].push(item)
            })
        }

        // Read template file from public folder (maunhap.xlsx for inbound)
        const templatePath = path.join(process.cwd(), 'public', 'maunhap.xlsx')
        const templateBuffer = fs.readFileSync(templatePath)

        const zip = new JSZip()
        const generatedFiles: string[] = []

        for (const order of orders) {
            const items = itemsByOrder[order.id] || []
            const targetUnit = order.metadata?.targetUnit || null
            const d = new Date(order.created_at)
            const day = d.getDate().toString()
            const month = (d.getMonth() + 1).toString()
            const year = d.getFullYear().toString()
            const dateFormatted = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`

            // Prepare items with quy cách and converted Qty
            const exportItems = items.map((item: any) => {
                const productSource = item.products as any || {}

                // Calculate quy cách
                let quyCach = ''
                if (productSource.product_units && productSource.product_units.length > 0) {
                    const itemUnitStr = normalizeStr(item.unit)
                    const uConfig = productSource.product_units.find((pu: any) => {
                        if (!pu.unit_id) return false
                        return normalizeStr(unitsMap[pu.unit_id]) === itemUnitStr
                    })
                    if (uConfig) {
                        quyCach = `${item.unit}/${uConfig.conversion_rate}${productSource.unit || ''}`
                    } else {
                        const firstConfig = productSource.product_units[0]
                        const mappedUnitName = firstConfig.unit_id ? unitsMap[firstConfig.unit_id] : ''
                        quyCach = `${mappedUnitName}/${firstConfig.conversion_rate}${productSource.unit || ''}`
                    }
                } else if (item.unit && productSource.unit && normalizeStr(item.unit) !== normalizeStr(productSource.unit)) {
                    quyCach = `${item.unit}/1${productSource.unit}`
                }

                // Calculate converted Qty
                let convertedQty: any = item.quantity || 0
                if (productSource.id) {
                    const itemUnitStr = normalizeStr(item.unit)
                    const baseUnitStr = normalizeStr(productSource.unit)
                    
                    if (itemUnitStr && baseUnitStr && itemUnitStr === baseUnitStr) {
                        convertedQty = item.quantity || 0
                    } else if (productSource.product_units && productSource.product_units.length > 0) {
                        const uConfig = productSource.product_units.find((pu: any) => {
                            const unitName = pu.unit_id ? unitsMap[pu.unit_id] : ''
                            return unitName && normalizeStr(unitName) === itemUnitStr
                        })
                        if (uConfig) {
                            convertedQty = (item.quantity || 0) * (uConfig.conversion_rate || 1)
                        } else {
                            const firstConfig = productSource.product_units[0]
                            convertedQty = (item.quantity || 0) * (firstConfig.conversion_rate || 1)
                        }
                    } else if (item.unit && productSource.unit && itemUnitStr !== baseUnitStr) {
                        convertedQty = (item.quantity || 0) * 1
                    }
                }

                return {
                    ...item,
                    product_name: productSource.internal_name || productSource.name || item.product_name || 'N/A',
                    quyCach,
                    unit: item.unit || productSource.unit || '',
                    convertedQty,
                    document_quantity: item.document_quantity || item.quantity,
                    price: item.price || 0
                }
            })

            // Load workbook from template (fresh copy each time)
            const workbook = new ExcelJS.Workbook()
            await workbook.xlsx.load(templateBuffer.buffer.slice(templateBuffer.byteOffset, templateBuffer.byteOffset + templateBuffer.byteLength))
            const worksheet = workbook.getWorksheet(1)
            if (!worksheet) continue

            // ---- Replace placeholders in all cells ----
            worksheet.eachRow((row) => {
                row.eachCell({ includeEmpty: false }, (cell) => {
                    if (cell.value && cell === cell.master) {
                        const replacePlaceholders = (text: string): string => {
                            let val = text
                            val = val.replace(/{{\s*DOC_DATE_VN\s*}}/gi, `Ngày ${day} tháng ${month} năm ${year}`)
                            val = val.replace(/{{\s*DOC_CODE\s*}}/gi, order.code || '')
                            val = val.replace(/{{\s*NHACUNGCAP\s*}}/gi, order.customer_name || order.supplier_name || '')
                            val = val.replace(/{{\s*KHACHHANG\s*}}/gi, order.customer_name || order.supplier_name || '')
                            val = val.replace(/{{\s*SUPPLIER\s*}}/gi, order.customer_name || order.supplier_name || '')
                            val = val.replace(/{{\s*diachikhachhang\s*}}/gi, order.customer_address || order.supplier_address || '')
                            val = val.replace(/{{\s*diachinhacungcap\s*}}/gi, order.customer_address || order.supplier_address || '')
                            val = val.replace(/{{\s*DESCRIPTION\s*}}/gi, order.description || '')
                            val = val.replace(/{{\s*chinhanh\s*}}/gi, order.warehouse_name || 'Kho mặc định')
                            val = val.replace(/{{\s*LOCATION\s*}}/gi, order.metadata?.location || '')
                            val = val.replace(/{{\s*BSXE\s*}}/gi, order.metadata?.vehicleNumber || '')
                            val = val.replace(/{{\s*socont\s*}}/gi, order.metadata?.containerNumber || '')
                            val = val.replace(/{{\s*soseal\s*}}/gi, order.metadata?.sealNumber || '')
                            val = val.replace(/{{\s*note\s*}}/gi, order.metadata?.note || '')

                            // Financial accounts
                            val = val.replace(/{{\s*DEBIT_ACCOUNT\s*}}/gi, order.metadata?.debitAccount || '')
                            val = val.replace(/{{\s*CREDIT_ACCOUNT\s*}}/gi, order.metadata?.creditAccount || '')

                            // Company info placeholders (if template uses them)
                            if (companyInfo) {
                                val = val.replace(/{{\s*COMPANY_NAME\s*}}/gi, companyInfo.name || '')
                                val = val.replace(/{{\s*COMPANY_ADDRESS\s*}}/gi, companyInfo.address || '')
                                val = val.replace(/{{\s*COMPANY_PHONE\s*}}/gi, companyInfo.phone || '')
                                val = val.replace(/{{\s*COMPANY_EMAIL\s*}}/gi, companyInfo.email || '')
                                val = val.replace(/{{\s*COMPANY_TAX\s*}}/gi, companyInfo.tax_code || '')
                            }

                            return val
                        }

                        if (typeof cell.value === 'string') {
                            cell.value = replacePlaceholders(cell.value)
                        } else if (cell.value && typeof cell.value === 'object' && 'richText' in (cell.value as any)) {
                            const rtValue = cell.value as any
                            rtValue.richText = rtValue.richText.map((rt: any) => ({
                                ...rt,
                                text: replacePlaceholders(rt.text || '')
                            }))
                            cell.value = rtValue
                        }
                    }
                })
            })

            // ---- Find data area (STT '1' to 'Cộng' row) ----
            let itemStartRow = -1
            let congRow = -1

            for (let r = 1; r <= Math.min(worksheet.rowCount, 100); r++) {
                const row = worksheet.getRow(r)

                // Find STT 1
                const firstCellVal = row.getCell(1).value?.toString().trim()
                if (itemStartRow === -1 && firstCellVal === '1') {
                    itemStartRow = r
                }

                // Find "Cộng" row by checking ALL cells in row
                if (congRow === -1) {
                    row.eachCell((cell) => {
                        if (congRow !== -1) return
                        const val = cell.value?.toString().trim().toLowerCase() || ''
                        if (val === 'cộng' || val.includes('tổng cộng')) {
                            congRow = r
                        }
                    })
                }
                if (itemStartRow !== -1 && congRow !== -1) break
            }

            // Fallbacks
            if (itemStartRow === -1) itemStartRow = congRow - 1
            if (congRow === -1) congRow = itemStartRow + 1

            // ---- Save merged ranges below data area before splicing ----
            const mergesBelow: { top: number; left: number; bottom: number; right: number; masterValue: any; masterFont: any; masterAlignment: any }[] = []
            const allMerges = (worksheet.model as any).merges || []

            for (const mergeRef of allMerges) {
                const match = mergeRef.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/)
                if (!match) continue
                const topRow = parseInt(match[2])
                const bottomRow = parseInt(match[4])

                if (topRow >= congRow) {
                    const leftCol = colLetterToNumber(match[1])
                    const rightCol = colLetterToNumber(match[3])

                    const masterCell = worksheet.getRow(topRow).getCell(leftCol)
                    mergesBelow.push({
                        top: topRow,
                        left: leftCol,
                        bottom: bottomRow,
                        right: rightCol,
                        masterValue: masterCell.value,
                        masterFont: masterCell.font ? { ...masterCell.font } : undefined,
                        masterAlignment: masterCell.alignment ? { ...masterCell.alignment } : undefined,
                    })
                }
            }

            // ---- Delete rows in data area ----
            const rowsToDelete = congRow - itemStartRow
            if (rowsToDelete > 0) {
                worksheet.spliceRows(itemStartRow, rowsToDelete)
            }

            // ---- Insert item rows ----
            let totalQty = 0
            let totalConvertedQty = 0
            const totalAmount = exportItems.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0)

            exportItems.forEach((item: any, index: number) => {
                const itemRowIndex = itemStartRow + index
                worksheet.spliceRows(itemRowIndex, 0, [])
                const row = worksheet.getRow(itemRowIndex)

                row.getCell(1).value = index + 1
                row.getCell(2).value = item.product_name || ''
                row.getCell(3).value = item.quyCach || ''
                row.getCell(4).value = item.unit || ''

                const qtyValue = Number(item.quantity) || 0
                const qtyCell = row.getCell(5)
                qtyCell.value = qtyValue
                if (Number.isInteger(qtyValue)) {
                    qtyCell.numFmt = '#,##0'
                } else {
                    qtyCell.numFmt = '#,##0.###'
                }
                totalQty += qtyValue

                // Converted Qty in column 6
                if (item.convertedQty !== undefined && item.convertedQty !== '-') {
                    const cQty = typeof item.convertedQty === 'string' ? parseFloat(item.convertedQty.replace(/,/g, '')) : Number(item.convertedQty)
                    const convCell = row.getCell(6)
                    convCell.value = cQty || 0
                    if (Number.isInteger(cQty)) {
                        convCell.numFmt = '#,##0'
                    } else {
                        convCell.numFmt = '#,##0.###'
                    }
                    totalConvertedQty += (cQty || 0)
                }

                // Financials: Đơn giá (col 7) + Thành tiền (col 8)
                if (hasInboundFinancials && isOfficial) {
                    const priceCell = row.getCell(7)
                    priceCell.value = Number(item.price) || 0
                    priceCell.numFmt = '#,##0'
                    const amountCell = row.getCell(8)
                    amountCell.value = (Number(item.price) || 0) * qtyValue
                    amountCell.numFmt = '#,##0'
                }

                // Style: bold, Times New Roman, borders
                row.eachCell((cell) => {
                    cell.font = { bold: true, size: 14, name: 'Times New Roman' }
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    }
                })
                // Center align: Quy cách (C=3), ĐVT (D=4), Số lượng (E=5), Quy đổi (F=6)
                for (let c = 3; c <= 6; c++) {
                    row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }
                }
                // Left align: STT (A=1), Tên hàng (B=2)
                row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
                row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
                // Right align: Đơn giá, Thành tiền
                if (hasInboundFinancials && isOfficial) {
                    row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' }
                    row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' }
                }
            })

            // ---- Update totals ----
            const rowShift = exportItems.length - rowsToDelete
            const newCongRowIndex = congRow + rowShift
            const newCongRow = worksheet.getRow(newCongRowIndex)

            // Total Qty (col 5)
            const qCellTotal = newCongRow.getCell(5)
            if (qCellTotal) {
                qCellTotal.value = totalQty
                if (Number.isInteger(totalQty)) {
                    qCellTotal.numFmt = '#,##0'
                } else {
                    qCellTotal.numFmt = '#,##0.###'
                }
            }

            // Total Converted Qty (col 6)
            if (totalConvertedQty > 0) {
                const cCellTotal = newCongRow.getCell(6)
                if (cCellTotal) {
                    cCellTotal.value = totalConvertedQty
                    if (Number.isInteger(totalConvertedQty)) {
                        cCellTotal.numFmt = '#,##0'
                    } else {
                        cCellTotal.numFmt = '#,##0.###'
                    }
                }
            }

            // Total Amount (col 8) if financials
            if (hasInboundFinancials && isOfficial && totalAmount > 0) {
                const aCellTotal = newCongRow.getCell(8)
                if (aCellTotal) {
                    aCellTotal.value = totalAmount
                    if (Number.isInteger(totalAmount)) {
                        aCellTotal.numFmt = '#,##0'
                    } else {
                        aCellTotal.numFmt = '#,##0.###'
                    }
                }
            }

            // ---- Restore merged ranges after all splicing ----
            for (const savedMerge of mergesBelow) {
                const newTop = savedMerge.top + rowShift
                const newBottom = savedMerge.bottom + rowShift

                try {
                    worksheet.unMergeCells(newTop, savedMerge.left, newBottom, savedMerge.right)
                } catch (e) { /* ignore */ }

                // Clear all slave cells
                for (let r = newTop; r <= newBottom; r++) {
                    for (let c = savedMerge.left; c <= savedMerge.right; c++) {
                        if (r === newTop && c === savedMerge.left) continue
                        const slaveCell = worksheet.getRow(r).getCell(c)
                        slaveCell.value = null
                    }
                }

                // Restore master cell value
                const masterCell = worksheet.getRow(newTop).getCell(savedMerge.left)
                masterCell.value = savedMerge.masterValue
                if (savedMerge.masterFont) masterCell.font = savedMerge.masterFont
                if (savedMerge.masterAlignment) masterCell.alignment = savedMerge.masterAlignment

                try {
                    worksheet.mergeCells(newTop, savedMerge.left, newBottom, savedMerge.right)
                } catch (e) { /* ignore if already merged */ }
            }

            // ---- Generate buffer and add to zip ----
            const buffer = await workbook.xlsx.writeBuffer()
            const sanitizedCode = (order.code || '').replace(/[\/\\:*?"<>|]/g, '-')
            const folderName = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            const fileName = `Phieu_Nhap_${sanitizedCode}_${dateFormatted}.xlsx`
            let uniquePath = `${folderName}/${fileName}`
            let counter = 1
            while (generatedFiles.includes(uniquePath)) {
                uniquePath = `${folderName}/Phieu_Nhap_${sanitizedCode}_${dateFormatted}_(${counter}).xlsx`
                counter++
            }
            generatedFiles.push(uniquePath)
            zip.file(uniquePath, buffer as ArrayBuffer)
        }

        // Generate ZIP
        const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' })

        return new NextResponse(zipBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="Phieu_Nhap_${orders.length}_phieu.zip"`,
                'Content-Length': zipBuffer.byteLength.toString()
            }
        })
    } catch (error: any) {
        console.error('Batch export error:', error)
        return NextResponse.json({ error: 'Lỗi máy chủ: ' + error.message }, { status: 500 })
    }
}