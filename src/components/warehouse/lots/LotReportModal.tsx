'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { X, FileText, Download, Printer, Loader2, Calendar, LayoutList } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { formatQuantityFull } from '@/lib/numberUtils'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { usePrintCompanyInfo } from '@/hooks/usePrintCompanyInfo'

interface LotReportModalProps {
    onClose: () => void
}

export function LotReportModal({ onClose }: LotReportModalProps) {
    const { currentSystem } = useSystem()
    const { showToast } = useToast()
    const { companyInfo } = usePrintCompanyInfo()

    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState<'inward' | 'outward'>('inward')
    const [reportDataInward, setReportDataInward] = useState<any[]>([])
    const [reportDataOutward, setReportDataOutward] = useState<any[]>([])
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
    const [productionLotsMap, setProductionLotsMap] = useState<Record<string, string>>({})

    useEffect(() => {
        if (currentSystem?.code) {
            fetchReportData()
        }
    }, [startDate, endDate, currentSystem?.code])

    async function fetchReportData() {
        if (!currentSystem?.code) return
        setLoading(true)

        try {
            const start = new Date(startDate)
            start.setHours(0, 0, 0, 0)
            const end = new Date(endDate)
            end.setHours(23, 59, 59, 999)

            const startStr = format(start, "yyyy-MM-dd'T'00:00:00")
            const endStr = format(end, "yyyy-MM-dd'T'23:59:59")

            const { data: allLots, error } = await supabase
                .from('lots')
                .select(`
                    *,
                    productions(code, name),
                    lot_items(
                        id,
                        product_id,
                        quantity,
                        unit,
                        products(name, sku, unit)
                    ),
                    positions!positions_lot_id_fkey(id, code),
                    products(name, sku, unit)
                `)
                .eq('system_code', currentSystem?.code)
                .or(`created_at.gte.${startStr},status.eq.exported`)
                .order('created_at', { ascending: false })

            if (error) {
                console.error('Supabase query error:', error)
                throw new Error(error.message || 'Lỗi không xác định từ cơ sở dữ liệu')
            }
            const rawLots = (allLots || []) as any[]

            // Step 2: Separate Inward and Outward
            const inward: any[] = []
            const outwardTransactions: any[] = []

            rawLots.forEach(lot => {
                // 2a. Check if inward (created in range)
                const createdAt = new Date(lot.created_at)
                if (createdAt >= start && createdAt <= end) {
                    inward.push(lot)
                }

                // 2b. Check if has exports in range (metadata path - from QuickBulkExport)
                const exports = lot.metadata?.system_history?.exports || []
                if (Array.isArray(exports)) {
                    exports.forEach((exp: any) => {
                        const exportDate = new Date(exp.date)
                        if (exportDate >= start && exportDate <= end) {
                            const items = exp.items || {}
                            Object.entries(items).forEach(([itemId, itemData]: [string, any]) => {
                                outwardTransactions.push({
                                    id: exp.id + '_' + itemId,
                                    source: 'metadata',
                                    lot_id: lot.id,
                                    lot_code: lot.code,
                                    date: exp.date,
                                    customer: exp.customer || 'Khách lẻ',
                                    description: exp.description || '',
                                    product_id: itemData.product_id,
                                    product_name: itemData.product_name || 'Sản phẩm không tên',
                                    product_sku: itemData.product_sku || '-',
                                    quantity: itemData.exported_quantity || 0,
                                    unit: itemData.unit || '-',
                                    production_id: itemData.production_id || lot.production_id,
                                    production_code: lot.productions?.code || lot.production_code || '-',
                                    production_name: lot.productions?.name || '-',
                                    location_code: exp.location_code,
                                    export_order_code: null
                                })
                            })
                        }
                    })
                }
            })

            // Step 2c: Fetch export data from export_tasks / export_task_items (export-order page path)
            const { data: exportTasksData } = await (supabase as any)
                .from('export_tasks')
                .select(`
                    id,
                    code,
                    status,
                    created_at,
                    system_code,
                    export_task_items(
                        id,
                        product_id,
                        quantity,
                        unit,
                        status,
                        lots(
                            id,
                            code,
                            production_id,
                            productions(code, name)
                        ),
                        products(name, sku)
                    )
                `)
                .eq('system_code', currentSystem?.code)
                .gte('created_at', startStr)
                .lte('created_at', endStr)
                .order('created_at', { ascending: false })

            console.log('[LOT Report] Export Tasks query result:', exportTasksData?.length, 'tasks found', exportTasksData)

            if (exportTasksData && exportTasksData.length > 0) {
                // Track lot IDs already captured via metadata to avoid duplicates
                const metadataLotIds = new Set(outwardTransactions.filter((t: any) => t.source === 'metadata').map((t: any) => t.lot_id))

                exportTasksData.forEach((task: any) => {
                    const items = task.export_task_items || []
                    items.forEach((item: any) => {
                        if (!item.lots) return
                        const lotId = item.lots?.id
                        // Skip if this lot already recorded via metadata (avoid duplicates)
                        if (metadataLotIds.has(lotId)) return

                        // Chỉ lấy những item đã thực sự được xuất
                        if (item.status !== 'Exported' && item.status !== 'Completed') return

                        outwardTransactions.push({
                            id: `task_${task.id}_item_${item.id}`,
                            source: 'export_task',
                            lot_id: lotId,
                            lot_code: item.lots?.code || '-',
                            date: task.created_at,
                            customer: '-',
                            description: `Lệnh xuất: ${task.code}`,
                            product_id: item.product_id,
                            product_name: item.products?.name || 'Sản phẩm không tên',
                            product_sku: item.products?.sku || '-',
                            quantity: item.quantity || 0,
                            unit: item.unit || '-',
                            production_id: item.lots?.production_id,
                            production_code: item.lots?.productions?.code || '-',
                            production_name: item.lots?.productions?.name || '-',
                            location_code: null,
                            export_order_code: task.code
                        })
                    })
                })
            }

            // Step 3: Fetch Production info (Tên và Mã) cho TẤT CẢ các ID liên quan
            const allProdIds = Array.from(new Set([
                ...inward.map(r => r.production_id),
                ...outwardTransactions.map(r => r.production_id),
                ...rawLots.flatMap(lot => (lot.metadata?.system_history?.exports || []).flatMap((e: any) => Object.values(e.items || {}).map((i: any) => i.production_id)))
            ].filter(id => !!id)))

            const productionsDataMap: Record<string, { code: string, name: string }> = {}
            if (allProdIds.length > 0) {
                const { data: prodData } = await supabase
                    .from('productions')
                    .select('id, code, name')
                    .in('id', allProdIds) as { data: { id: string, code: string, name: string }[] | null }
                
                if (prodData) {
                    prodData.forEach(p => {
                        productionsDataMap[p.id] = { code: p.code, name: p.name }
                    })
                }
            }

            // Step 4: Map production info back to transactions
            const mappedOutward = outwardTransactions.map(tx => {
                const info = productionsDataMap[tx.production_id]
                return {
                    ...tx,
                    production_code: info?.code || tx.production_code,
                    production_name: info?.name || tx.production_name
                }
            })

            // Step 5: Fetch Production LOT codes (Số lô) if any
            if (allProdIds.length > 0) {
                const { data: prodLots } = await supabase
                    .from('production_lots')
                    .select('production_id, product_id, lot_code')
                    .in('production_id', allProdIds)

                if (prodLots) {
                    const map: Record<string, string> = {}
                    prodLots.forEach((pl: any) => {
                        map[`${pl.production_id}_${pl.product_id}`] = pl.lot_code
                    })
                    setProductionLotsMap(map)
                }
            } else {
                setProductionLotsMap({})
            }

            setReportDataInward(inward)
            setReportDataOutward(mappedOutward)
        } catch (err: any) {
            console.error('Error fetching report data:', err)
            const errMsg = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err))
            showToast('Lỗi tải dữ liệu báo cáo: ' + errMsg, 'error')
        } finally {
            setLoading(false)
        }
    }

    const groupedInwardData = useMemo(() => {
        if (!reportDataInward.length) return []
        
        const groups: Record<string, { production_code: string, production_name?: string, lots: any[] }> = {}
        
        reportDataInward.forEach(lot => {
            const prodCode = lot.production_code || lot.productions?.code || 'NO_PROD'
            const prodName = lot.productions?.name || ''
            
            if (!groups[prodCode]) {
                groups[prodCode] = {
                    production_code: prodCode === 'NO_PROD' ? 'Không xác định' : prodCode,
                    production_name: prodName,
                    lots: []
                }
            }
            groups[prodCode].lots.push(lot)
        })
        
        return Object.values(groups)
    }, [reportDataInward])

    const summaryInward = useMemo(() => {
        const stats: Record<string, { productName: string, sku: string, totalQty: number, unit: string, lotCount: number }> = {}
        
        reportDataInward.forEach(lot => {
            const items = lot.lot_items || []
            if (items.length > 0) {
                items.forEach((item: any) => {
                    const unit = item.unit || item.products?.unit || '-'
                    const key = `${item.product_id}_${unit}`
                    if (!stats[key]) {
                        stats[key] = {
                            productName: item.products?.name || 'Sản phẩm không tên',
                            sku: item.products?.sku || '-',
                            totalQty: 0,
                            unit: unit,
                            lotCount: 0
                        }
                    }
                    stats[key].totalQty += (Number(item.quantity) || 0)
                    stats[key].lotCount += 1
                })
            } else if (lot.products) {
                const unit = (lot as any).unit || lot.products.unit || '-'
                const key = `${lot.product_id}_${unit}`
                if (!stats[key]) {
                    stats[key] = {
                        productName: lot.products.name || 'Sản phẩm không tên',
                        sku: lot.products.sku || '-',
                        totalQty: 0,
                        unit: unit,
                        lotCount: 0
                    }
                }
                stats[key].totalQty += (Number((lot as any).quantity) || 0)
                stats[key].lotCount += 1
            }
        })
        
        return Object.values(stats).sort((a, b) => b.totalQty - a.totalQty)
    }, [reportDataInward])

    const summaryOutward = useMemo(() => {
        const stats: Record<string, { productName: string, sku: string, totalQty: number, unit: string, lotCount: number }> = {}
        
        reportDataOutward.forEach(row => {
            const unit = row.unit || '-'
            const key = `${row.product_id}_${unit}`
            if (!stats[key]) {
                stats[key] = {
                    productName: row.product_name,
                    sku: row.product_sku,
                    totalQty: 0,
                    unit: unit,
                    lotCount: 0
                }
            }
            stats[key].totalQty += (Number(row.quantity) || 0)
            stats[key].lotCount += 1
        })
        
        return Object.values(stats).sort((a, b) => b.totalQty - a.totalQty)
    }, [reportDataOutward])

    const handleExportExcel = async () => {
        const currentData = activeTab === 'inward' ? reportDataInward : reportDataOutward
        if (currentData.length === 0) {
            showToast('Không có dữ liệu để xuất Excel', 'warning')
            return
        }

        try {
            const workbook = new ExcelJS.Workbook()
            const worksheet = workbook.addWorksheet(activeTab === 'inward' ? 'Báo cáo Nhập LOT' : 'Báo cáo Xuất LOT')

            // Header definition based on tab
            if (activeTab === 'inward') {
                worksheet.columns = [
                    { header: 'STT', key: 'stt', width: 5 },
                    { header: 'NGÀY TẠO', key: 'date', width: 15 },
                    { header: 'MÃ LOT SX', key: 'prod_code', width: 25 },
                    { header: 'SẢN PHẨM', key: 'product', width: 40 },
                    { header: 'SỐ LƯỢNG', key: 'qty', width: 12 },
                    { header: 'ĐƠN VỊ', key: 'unit', width: 10 },
                    { header: 'VỊ TRÍ', key: 'position', width: 15 }
                ]
            } else {
                worksheet.columns = [
                    { header: 'STT', key: 'stt', width: 5 },
                    { header: 'NGÀY XUẤT', key: 'date', width: 15 },
                    { header: 'MÃ LOT SX', key: 'prod_code', width: 25 },
                    { header: 'SẢN PHẨM', key: 'product', width: 40 },
                    { header: 'SỐ LƯỢNG', key: 'qty', width: 12 },
                    { header: 'ĐƠN VỊ', key: 'unit', width: 10 },
                    { header: 'MÃ LỆNH SX', key: 'customer', width: 25 },
                    { header: 'GHI CHÚ', key: 'description', width: 25 }
                ]
            }

            // Xóa hàng header mặc định tự động tạo bởi ExcelJS
            worksheet.getRow(1).values = []

            // Header Styling
            let currentRow = 1

            // 1. Company Info
            if (companyInfo) {
                const lastCellChar = String.fromCharCode(65 + worksheet.columns.length - 1)
                
                worksheet.mergeCells(`A${currentRow}:${lastCellChar}${currentRow}`)
                const nameCell = worksheet.getCell(`A${currentRow}`)
                nameCell.value = companyInfo.name?.toUpperCase()
                nameCell.font = { bold: true, size: 10 }
                currentRow++

                worksheet.mergeCells(`A${currentRow}:${lastCellChar}${currentRow}`)
                const addrCell = worksheet.getCell(`A${currentRow}`)
                addrCell.value = `Địa chỉ: ${companyInfo.address || ''}`
                addrCell.font = { size: 9 }
                currentRow++

                worksheet.mergeCells(`A${currentRow}:${lastCellChar}${currentRow}`)
                const contactCell = worksheet.getCell(`A${currentRow}`)
                contactCell.value = `ĐT: ${companyInfo.phone || ''} ${companyInfo.email ? `| Email: ${companyInfo.email}` : ''}`
                contactCell.font = { size: 9 }
                currentRow++
            }

            currentRow++ // Spacer

            // 2. Report Title
            const lastColChar = String.fromCharCode(65 + worksheet.columns.length - 1)
            worksheet.mergeCells(`A${currentRow}:${lastColChar}${currentRow}`)
            const titleCell = worksheet.getCell(`A${currentRow}`)
            titleCell.value = 'BÁO CÁO TỔNG HỢP LOT'
            titleCell.font = { bold: true, size: 16 }
            titleCell.alignment = { horizontal: 'center' }
            currentRow++

            // 3. Date Range Info
            worksheet.mergeCells(`A${currentRow}:${lastColChar}${currentRow}`)
            const dateRangeCell = worksheet.getCell(`A${currentRow}`)
            dateRangeCell.value = `Từ ngày: ${format(new Date(startDate), 'dd/MM/yyyy')} đến ngày: ${format(new Date(endDate), 'dd/MM/yyyy')}`
            dateRangeCell.alignment = { horizontal: 'center' }
            dateRangeCell.font = { italic: true }
            currentRow++

            // 4. Warehouse system info
            if (currentSystem) {
                const whCell = worksheet.getCell(`A${currentRow}`)
                whCell.value = `Hệ thống/Kho: ${currentSystem.name || currentSystem.code}`
                whCell.font = { bold: true }
                currentRow++
            }

            currentRow++ // Spacer before table header

            // 5. Build Table Header manually at currentRow
            const headerRow = worksheet.getRow(currentRow)
            headerRow.values = worksheet.columns.map(c => String(c.header || ''))
            headerRow.eachCell((cell) => {
                cell.font = { bold: true }
                cell.alignment = { vertical: 'middle', horizontal: 'center' }
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                }
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'F2F2F2' }
                }
            })
            currentRow++

            // Add rows based on tab
            if (activeTab === 'inward') {
                groupedInwardData.forEach((group: any) => {
                    // Add Group Header Row
                    const productionLabel = group.production_name || group.production_code || 'Không xác định'
                    const groupHeaderRow = worksheet.addRow([`LỆNH SẢN XUẤT: ${productionLabel}`])
                    worksheet.mergeCells(`A${groupHeaderRow.number}:G${groupHeaderRow.number}`)
                    groupHeaderRow.eachCell((cell) => {
                        cell.font = { bold: true, size: 11 }
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFF2CC' }
                        }
                        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
                    })

                    group.lots.forEach((lot: any, index: number) => {
                        const dateStr = format(new Date(lot.created_at), 'dd/MM/yyyy')
                        const posStr = lot.positions?.map((p: any) => p.code).join(', ') || '-'
                        
                        if (lot.lot_items && lot.lot_items.length > 0) {
                            lot.lot_items.forEach((item: any, itemIdx: number) => {
                                const sxLotCode = productionLotsMap[`${lot.production_id}_${item.product_id}`] || lot.batch_code || lot.production_code || lot.productions?.code || '-'
                                const row = worksheet.addRow({
                                    stt: itemIdx === 0 ? index + 1 : '',
                                    date: itemIdx === 0 ? dateStr : '',
                                    prod_code: itemIdx === 0 ? sxLotCode : '',
                                    product: item.products?.name || '-',
                                    qty: item.quantity,
                                    unit: item.unit || item.products?.unit || '-',
                                    position: itemIdx === 0 ? posStr : ''
                                })
                                row.eachCell((cell, colNumber) => {
                                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
                                    if (colNumber === 5) {
                                        cell.alignment = { horizontal: 'right' }
                                        cell.numFmt = '#,##0'
                                    }
                                })
                            })
                        } else if (lot.products) {
                            const sxLotCode = productionLotsMap[`${lot.production_id}_${lot.product_id}`] || lot.batch_code || lot.production_code || lot.productions?.code || '-'
                            const row = worksheet.addRow({
                                stt: index + 1,
                                date: dateStr,
                                prod_code: sxLotCode,
                                product: lot.products.name || '-',
                                qty: (lot as any).quantity || 0,
                                unit: (lot as any).unit || lot.products.unit || '-',
                                position: posStr
                            })
                            row.eachCell((cell, colNumber) => {
                                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
                                if (colNumber === 5) {
                                    cell.alignment = { horizontal: 'right' }
                                    cell.numFmt = '#,##0'
                                }
                            })
                        }
                    })
                })
            } else {
                // Outward export
                reportDataOutward.forEach((row, index) => {
                    const sxLotCode = productionLotsMap[`${row.production_id}_${row.product_id}`] || row.lot_code || '-'
                    const excelRow = worksheet.addRow({
                        stt: index + 1,
                        date: format(new Date(row.date), 'dd/MM/yyyy'),
                        prod_code: sxLotCode,
                        product: row.product_name,
                        qty: row.quantity,
                        unit: row.unit,
                        customer: `${row.production_code || ''} - ${row.production_name || ''}`.trim().replace(/^ - | - $/, '') || '-',
                        description: row.description
                    })
                    excelRow.eachCell((cell, colNumber) => {
                        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
                        if (colNumber === 5) {
                            cell.alignment = { horizontal: 'right' }
                            cell.numFmt = '#,##0'
                        }
                    })
                })
            }

            // 6. Signature section
            let lastRowNumber = worksheet.lastRow ? worksheet.lastRow.number : currentRow
            currentRow = lastRowNumber + 3
            
            const signDateRow = worksheet.getRow(currentRow)
            const lastColIdx = worksheet.columns.length
            signDateRow.getCell(lastColIdx - 1).value = `Ngày ...... tháng ...... năm ......`
            signDateRow.getCell(lastColIdx - 1).font = { italic: true }
            currentRow++

            const signTitleRow = worksheet.getRow(currentRow)
            signTitleRow.getCell(2).value = 'Người Lập Biểu'
            signTitleRow.getCell(Math.floor(lastColIdx / 2) + 1).value = 'Thủ Kho'
            signTitleRow.getCell(lastColIdx - 1).value = 'Giám Đốc'
            signTitleRow.eachCell(cell => { 
                cell.font = { bold: true }
                cell.alignment = { horizontal: 'center' }
            })

            const buffer = await workbook.xlsx.writeBuffer()
            const fileName = `Bao_cao_${activeTab === 'inward' ? 'Nhap' : 'Xuat'}_LOT_${startDate}_to_${endDate}.xlsx`
            saveAs(new Blob([buffer]), fileName)
            showToast('Đã xuất file Excel thành công', 'success')
        } catch (err: any) {
            console.error('Excel export error:', err)
            showToast('Lỗi xuất Excel: ' + err.message, 'error')
        }
    }

    const handlePrint = (orientation: 'portrait' | 'landscape' = 'portrait') => {
        const currentData = activeTab === 'inward' ? reportDataInward : reportDataOutward
        if (currentData.length === 0) {
            showToast('Không có dữ liệu để in', 'warning')
            return
        }
        
        const printContent = document.getElementById('printable-report-area');
        if (!printContent) return;

        // Trích xuất toàn bộ CSS hiện hành của Tailwind để bảo toàn định dạng
        const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
            .map(node => node.outerHTML)
            .join('\n');

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            showToast('Trình duyệt đã chặn cửa sổ Popup. Vui lòng cho phép hiện Popup để tiến hành in.', 'warning');
            return;
        }

        const htmlData = `
            <!DOCTYPE html>
            <html lang="vi">
                <head>
                    <meta charset="utf-8">
                    <title>In Báo Cáo Tổng Hợp LOT</title>
                    ${styles}
                    <style>
                        @media print {
                            @page { size: A4 ${orientation}; margin: 15mm; }
                            body { font-family: "Times New Roman", Times, serif !important; background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; padding: 0 !important; margin: 0 !important; }
                            .no-print { display: none !important; }
                            
                            /* Force table styles for absolute safety */
                            table { width: 100% !important; border-collapse: collapse !important; table-layout: auto !important; margin-bottom: 2rem !important; }
                            th, td { border: 1px solid #000 !important; padding: 8px 6px !important; font-size: 11pt !important; color: black !important; font-family: "Times New Roman", Times, serif !important; }
                            th { background-color: #f2f2f2 !important; font-weight: bold !important; }
                            tr { page-break-inside: avoid !important; }
                            thead { display: table-header-group !important; }
                            
                            .print-only { display: block !important; visibility: visible !important; }
                        }
                        /* Base screen styles for the popup window before printing starts */
                        body { background: white; padding: 40px; color: black; font-family: "Times New Roman", Times, serif !important; }
                        .print-only { display: block !important; }
                        .no-print { display: none !important; }
                        table { width: 100%; border-collapse: collapse; font-family: "Times New Roman", Times, serif; }
                        th, td { border: 1px solid #000; padding: 8px; font-size: 14pt; }
                        th { background: #f8fafc; font-weight: bold; }
                    </style>
                </head>
                <body class="bg-white text-black h-auto overflow-visible" style="font-family: 'Times New Roman', Times, serif;">
                    ${printContent.innerHTML}
                    <script>
                        setTimeout(() => {
                            window.focus();
                            window.print();
                        }, 500);
                    </script>
                </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(htmlData);
        printWindow.document.close();
    }

    return (
        <div id="lot-report-modal-wrapper" className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-[32px] max-w-6xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 pb-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 no-print">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                            <FileText size={24} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                Báo cáo tổng hợp LOT
                            </h3>
                            <p className="text-sm font-medium mt-1 text-slate-500">
                                Kết xuất danh sách biến động LOT trong khoảng ngày đã chọn
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors no-print">
                        <X size={24} className="text-slate-500" />
                    </button>
                </div>

                {/* Tabs & Date Filters */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 space-y-4 no-print border-b border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center p-1 bg-slate-200 dark:bg-slate-800 rounded-2xl w-fit shadow-inner">
                            <button
                                onClick={() => setActiveTab('inward')}
                                className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'inward' 
                                    ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-md scale-100' 
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 scale-95 opacity-70'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${activeTab === 'inward' ? 'bg-orange-500' : 'bg-slate-400'}`}></div>
                                    DANH SÁCH NHẬP
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab('outward')}
                                className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'outward' 
                                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-md scale-100' 
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 scale-95 opacity-70'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${activeTab === 'outward' ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                                    DANH SÁCH XUẤT
                                </div>
                            </button>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                <Calendar size={16} className="text-orange-500 shrink-0" />
                                <div className="flex items-center gap-1 sm:gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="bg-transparent border-none p-0 focus:ring-0 outline-none w-[130px] sm:w-[145px] text-center"
                                    />
                                    <span className="text-slate-400">→</span>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="bg-transparent border-none p-0 focus:ring-0 outline-none w-[130px] sm:w-[145px] text-center"
                                    />
                                </div>
                            </div>
                            <div className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/50 w-fit">
                                {activeTab === 'inward' ? 'Nhập kho: ' : 'Xuất kho: '}
                                <span className={`${activeTab === 'inward' ? 'text-orange-600' : 'text-emerald-600'} text-sm sm:text-base ml-1`}>
                                    {activeTab === 'inward' ? reportDataInward.length : reportDataOutward.length}
                                </span> 
                                <span className="ml-0.5">{activeTab === 'inward' ? 'LOT' : 'Dòng'}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-2 w-full md:w-auto">
                            <button
                                onClick={handleExportExcel}
                                disabled={loading || (activeTab === 'inward' ? reportDataInward.length === 0 : reportDataOutward.length === 0)}
                                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-black shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:grayscale ${activeTab === 'inward' ? 'bg-orange-600 shadow-orange-600/20' : 'bg-emerald-600 shadow-emerald-600/20'}`}
                            >
                                <Download size={18} />
                                <span className="sm:inline">Excel</span>
                            </button>
                            <div className="flex-1 sm:flex-none flex items-center bg-slate-800 dark:bg-slate-700 rounded-xl overflow-hidden p-0.5 shadow-lg shadow-slate-900/20">
                                <button
                                    onClick={() => handlePrint('portrait')}
                                    disabled={loading || (activeTab === 'inward' ? reportDataInward.length === 0 : reportDataOutward.length === 0)}
                                    title="In dọc (Portrait)"
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-transparent hover:bg-black text-white text-sm font-bold transition-all disabled:opacity-50"
                                >
                                    <Printer size={16} />
                                    <span className="hidden sm:inline">In dọc</span>
                                </button>
                                <div className="w-px h-5 bg-slate-600 mx-0.5 opacity-50"></div>
                                <button
                                    onClick={() => handlePrint('landscape')}
                                    disabled={loading || (activeTab === 'inward' ? reportDataInward.length === 0 : reportDataOutward.length === 0)}
                                    title="In ngang (Landscape)"
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-transparent hover:bg-black text-white text-sm font-bold transition-all disabled:opacity-50"
                                >
                                    <Printer size={16} className="rotate-90" />
                                    <span className="hidden sm:inline">In ngang</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div id="printable-report-area" className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    {loading ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-3 no-print">
                            <Loader2 size={40} className="animate-spin text-orange-500" />
                            <p className="text-sm font-bold text-slate-500 animate-pulse">Đang nạp dữ liệu...</p>
                        </div>
                    ) : (activeTab === 'inward' ? reportDataInward.length === 0 : reportDataOutward.length === 0) ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-4 text-slate-400 no-print">
                            <LayoutList size={48} strokeWidth={1} />
                            <p className="font-medium">Không tìm thấy dữ liệu {activeTab === 'inward' ? 'nhập' : 'xuất'} nào trong khoảng ngày này</p>
                        </div>
                    ) : (
                        <div className="report-root">
                            {/* Print Version Header */}
                            <div className="print-header hidden print:block" style={{ marginBottom: '30px' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px' }}>
                                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center', width: '100%' }}>
                                        {companyInfo?.logo_url && (
                                            <img src={companyInfo.logo_url} alt="Logo" style={{ height: '60px', width: 'auto', objectFit: 'contain' }} />
                                        )}
                                        <div style={{ flex: 1 }}>
                                            <h1 style={{ fontSize: '12pt', fontWeight: 'bold', margin: '0 0 4px 0', textTransform: 'uppercase', color: '#0f172a', lineHeight: '1.2' }}>
                                                {companyInfo?.name}
                                            </h1>
                                            <div style={{ fontSize: '9pt', color: '#475569', lineHeight: '1.4' }}>
                                                <p style={{ margin: '0', whiteSpace: 'nowrap' }}><strong>Địa chỉ:</strong> {companyInfo?.address}</p>
                                                <p style={{ margin: '0', whiteSpace: 'nowrap' }}><strong>ĐT:</strong> {companyInfo?.phone} {companyInfo?.email ? ` | Email: ${companyInfo?.email}` : ''}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'center', marginBottom: '25px' }}>
                                    <h2 style={{ fontSize: '20pt', fontWeight: '900', margin: '0 0 8px 0', textTransform: 'uppercase', color: '#0f172a', letterSpacing: '1px' }}>
                                        BÁO CÁO {activeTab === 'inward' ? 'DANH SÁCH LOT ĐÃ TẠO' : 'DANH SÁCH LOT ĐÃ XUẤT'}
                                    </h2>
                                    <p style={{ fontSize: '11pt', fontStyle: 'italic', color: '#475569', margin: '0' }}>
                                        Từ ngày: {format(new Date(startDate), 'dd/MM/yyyy')} đến ngày: {format(new Date(endDate), 'dd/MM/yyyy')}
                                    </p>
                                </div>
                            </div>
                            
                            {/* Summary Statistics */}
                            {(() => {
                                const stats = activeTab === 'inward' ? summaryInward : summaryOutward;
                                if (stats.length === 0) return null;
                                return (
                                    <div className="mb-8 print-avoid-break">
                                        <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <div className={`w-1.5 h-4 ${activeTab === 'inward' ? 'bg-orange-500' : 'bg-emerald-500'} rounded-full`}></div>
                                            Tổng hợp sản lượng ({activeTab === 'inward' ? 'Nhập' : 'Xuất'})
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {stats.map((stat, sIdx) => (
                                                <div key={sIdx} className={`p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between group transition-all shadow-sm ${activeTab === 'inward' ? 'hover:border-orange-200 dark:hover:border-orange-900/30' : 'hover:border-emerald-200 dark:hover:border-emerald-900/30'}`}>
                                                    <div className="flex-1 min-w-0 pr-3">
                                                        <div className="text-[10px] font-black text-slate-400 uppercase mb-1 truncate">{stat.productName}</div>
                                                        <div className="text-lg font-black text-slate-900 dark:text-slate-100 truncate flex items-baseline gap-1">
                                                            {formatQuantityFull(stat.totalQty)}
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase">{stat.unit}</span>
                                                        </div>
                                                    </div>
                                                    <div className="shrink-0 flex flex-col items-end">
                                                        <div className={`px-2 py-1 rounded text-[10px] font-black ${activeTab === 'inward' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'}`}>
                                                            {stat.lotCount} dòng
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-4 pb-4 border-b-2 border-dashed border-slate-100 dark:border-slate-800 no-print"></div>
                                    </div>
                                )
                            })()}

                            {activeTab === 'inward' ? (
                                <div className="inward-table-wrapper">
                                    {groupedInwardData.map((group: any, groupIdx: number) => (
                                        <div key={groupIdx} style={{ marginBottom: '30px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
                                                <div className="hidden md:block w-1 h-6 bg-orange-500 rounded-full mr-3"></div>
                                                <span className="text-slate-400 font-bold uppercase text-[10px] mr-2">LSX:</span>
                                                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase">
                                                    {group.production_name || group.production_code || 'Không xác định'}
                                                </h3>
                                            </div>

                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead className="bg-slate-50 dark:bg-slate-900 border-b-2 border-slate-200 dark:border-slate-800">
                                                        <tr>
                                                            <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[4%]">STT</th>
                                                            <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[11%]">Ngày tạo</th>
                                                            <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[20%]">Mã LOT SX</th>
                                                            <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[33%]">Sản phẩm</th>
                                                            <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right w-[12%]">SL Nhập</th>
                                                            <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[10%]">Đơn vị</th>
                                                            <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[10%]">Vị trí</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {group.lots.map((lot: any, idx: number) => {
                                                            const items = lot.lot_items || []
                                                            const rowSpan = Math.max(items.length, 1)
                                                            return (
                                                                <React.Fragment key={lot.id}>
                                                                    {items.length > 0 ? (
                                                                        items.map((item: any, itemIdx: number) => (
                                                                            <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 text-sm">
                                                                                {itemIdx === 0 && (
                                                                                    <>
                                                                                        <td className="py-4 px-2 font-mono text-slate-500 font-bold" rowSpan={rowSpan}>{idx + 1}</td>
                                                                                        <td className="py-4 px-2 font-medium text-slate-600 dark:text-slate-400" rowSpan={rowSpan}>
                                                                                            {format(new Date(lot.created_at), 'dd/MM/yyyy')}
                                                                                        </td>
                                                                                        <td className="py-4 px-2" rowSpan={rowSpan}>
                                                                                            <span className="px-2 py-1 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 font-bold text-[11px] border border-orange-100 dark:border-orange-800/30">
                                                                                                {productionLotsMap[`${lot.production_id}_${item.product_id}`] || lot.batch_code || lot.production_code || lot.productions?.code || '-'}
                                                                                            </span>
                                                                                        </td>
                                                                                    </>
                                                                                )}
                                                                                <td className="py-2 px-2">
                                                                                    <div className="font-bold text-slate-800 dark:text-slate-200">{item.products?.name}</div>
                                                                                    <div className="text-[10px] text-slate-400 font-mono">{item.products?.sku}</div>
                                                                                </td>
                                                                                <td className="py-2 px-2 text-right font-black text-orange-600">
                                                                                    {formatQuantityFull(item.quantity)}
                                                                                </td>
                                                                                <td className="py-2 px-2 font-bold text-[10px] text-slate-400 uppercase">
                                                                                    {item.unit || item.products?.unit}
                                                                                </td>
                                                                                {itemIdx === 0 && (
                                                                                    <td className="py-2 px-2" rowSpan={rowSpan}>
                                                                                        <div className="flex flex-wrap gap-1">
                                                                                            {lot.positions?.map((p: any) => (
                                                                                                <span key={p.id} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md text-[9px] font-black border border-slate-200 dark:border-slate-700">
                                                                                                    {p.code}
                                                                                                </span>
                                                                                            ))}
                                                                                        </div>
                                                                                    </td>
                                                                                )}
                                                                            </tr>
                                                                        ))
                                                                    ) : (
                                                                        <tr className="border-b border-slate-100 dark:border-slate-800/50">
                                                                            <td className="py-4 px-2 font-mono text-slate-500 font-bold">{idx + 1}</td>
                                                                            <td className="py-4 px-2 text-slate-600 dark:text-slate-400 font-medium">{format(new Date(lot.created_at), 'dd/MM/yyyy')}</td>
                                                                            <td className="py-4 px-2">
                                                                                <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-400 font-bold text-[11px]">
                                                                                    {lot.code}
                                                                                </span>
                                                                            </td>
                                                                            <td className="py-2 px-2 italic text-slate-400 text-xs">Không có dữ liệu hàng hóa</td>
                                                                            <td className="py-2 px-2 text-right">-</td>
                                                                            <td className="py-2 px-2 text-slate-400">-</td>
                                                                            <td className="py-2 px-2">-</td>
                                                                        </tr>
                                                                    )}
                                                                </React.Fragment>
                                                            )
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="outward-table-wrapper">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-slate-50 dark:bg-slate-900 border-b-2 border-slate-200 dark:border-slate-800">
                                                <tr>
                                                    <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[4%]">STT</th>
                                                    <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[11%]">Ngày xuất</th>
                                                    <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[18%]">Mã LOT SX</th>
                                                    <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[25%]">Sản phẩm</th>
                                                    <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right w-[10%]">SL Xuất</th>
                                                    <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[8%]">Đơn vị</th>
                                                    <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[14%]">Lệnh sản xuất</th>
                                                    <th className="py-3 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest w-[10%]">Ghi chú</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {reportDataOutward.map((row, idx) => (
                                                    <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 text-sm">
                                                        <td className="py-4 px-2 font-mono text-slate-500 font-bold">{idx + 1}</td>
                                                        <td className="py-4 px-2 font-medium text-slate-600 dark:text-slate-400">
                                                            {format(new Date(row.date), 'dd/MM/yyyy')}
                                                        </td>
                                                        <td className="py-4 px-2">
                                                            <span className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] border border-emerald-100 dark:border-emerald-800/30">
                                                                {productionLotsMap[`${row.production_id}_${row.product_id}`] || row.lot_code || '-'}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 px-2">
                                                            <div className="font-bold text-slate-800 dark:text-slate-200">{row.product_name}</div>
                                                            <div className="text-[10px] text-slate-400 font-mono">{row.product_sku}</div>
                                                        </td>
                                                        <td className="py-2 px-2 text-right font-black text-emerald-600">
                                                            {formatQuantityFull(row.quantity)}
                                                        </td>
                                                        <td className="py-2 px-2 font-bold text-[10px] text-slate-400 uppercase">
                                                            {row.unit}
                                                        </td>
                                                        <td className="py-2 px-2">
                                                            <div className="flex flex-col gap-1">
                                                                {row.export_order_code ? (
                                                                    // Data from export_task: show export order code prominently
                                                                    <div className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-bold text-[11px] border border-blue-100 dark:border-blue-800/30 w-fit">
                                                                        {row.export_order_code}
                                                                    </div>
                                                                ) : (() => {
                                                                    // 1. Ưu tiên Tên lệnh sản xuất (Tên đầy đủ)
                                                                    if (row.production_name && row.production_name !== '-') {
                                                                        return (
                                                                            <div className="text-[11px] font-black text-slate-800 dark:text-white uppercase leading-tight truncate max-w-[160px]">
                                                                                {row.production_name}
                                                                            </div>
                                                                        );
                                                                    }
                                                                    
                                                                    // 2. Nếu không có tên, tìm mã Lệnh xuất (LXK) trong mô tả
                                                                    const desc = row.description || '';
                                                                    const lxkMatch = desc.match(/LXK-[A-Z0-9-]+/i);
                                                                    if (lxkMatch) {
                                                                        return (
                                                                            <div className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase">
                                                                                {lxkMatch[0]}
                                                                            </div>
                                                                        );
                                                                    }

                                                                    // 3. Cuối cùng hiện mô tả ngắn hoặc "Xuất lẻ"
                                                                    return (
                                                                        <div className="text-[10px] text-slate-400 italic">
                                                                            {desc.length > 25 ? desc.substring(0, 25) + '...' : (desc || 'Xuất lẻ')}
                                                                        </div>
                                                                    );
                                                                })()}
                                                                
                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                    {row.location_code && (
                                                                        <div className="text-[9px] text-slate-400 font-bold italic">
                                                                            vị trí xuất: {row.location_code}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-2 px-2">
                                                            {(() => {
                                                                const desc = row.description || '-';
                                                                if (desc.toLowerCase().includes('lệnh')) {
                                                                    const parts = desc.split(/(LXK-[A-Z0-9]+|Lệnh xuất [A-Z0-9-]+)/i);
                                                                    return (
                                                                        <div className="text-[10px] text-slate-600 dark:text-slate-400 italic leading-tight">
                                                                            {parts.map((p: string, i: number) => (
                                                                                /LXK-[A-Z0-9]+|Lệnh xuất [A-Z0-9-]+/i.test(p) 
                                                                                ? <strong key={i} className="text-blue-600 dark:text-blue-400 not-italic font-black">{p}</strong>
                                                                                : p
                                                                            ))}
                                                                        </div>
                                                                    );
                                                                }
                                                                return <div className="text-[10px] text-slate-500 italic truncate max-w-[120px]">{desc}</div>;
                                                            })()}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Signatures */}
                            <div className="mt-12 grid grid-cols-3 gap-8 text-center print-avoid-break">
                                <div className="flex flex-col items-center">
                                    <span className="font-black text-slate-900 dark:text-white uppercase text-xs tracking-widest">Người lập biểu</span>
                                    <span className="text-[10px] text-slate-400 mt-1 italic font-medium">(Ký và ghi rõ họ tên)</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="font-black text-slate-900 dark:text-white uppercase text-xs tracking-widest">Thủ kho</span>
                                    <span className="text-[10px] text-slate-400 mt-1 italic font-medium">(Ký và ghi rõ họ tên)</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="font-black text-slate-900 dark:text-white uppercase text-xs tracking-widest">Giám đốc</span>
                                    <span className="text-[10px] text-slate-400 mt-1 italic font-medium">(Ký và đóng dấu)</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
