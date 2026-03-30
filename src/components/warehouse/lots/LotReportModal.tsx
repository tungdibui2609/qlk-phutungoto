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
    const [reportData, setReportData] = useState<any[]>([])
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
    const [productionLotsMap, setProductionLotsMap] = useState<Record<string, string>>({})

    useEffect(() => {
        if (currentSystem?.code) {
            fetchReportData()
        }
    }, [startDate, endDate, currentSystem])

    async function fetchReportData() {
        if (!currentSystem?.code) return
        setLoading(true)

        try {
            const start = new Date(startDate)
            start.setHours(0, 0, 0, 0)
            const end = new Date(endDate)
            end.setHours(23, 59, 59, 999)

            const { data, error } = await supabase
                .from('lots')
                .select(`
                    id,
                    code,
                    created_at,
                    production_code,
                    production_id,
                    batch_code,
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
                .eq('system_code', currentSystem.code)
                .gte('created_at', start.toISOString())
                .lte('created_at', end.toISOString())
                .order('created_at', { ascending: false })

            if (error) throw error
            const reportRows = (data || []) as any[]
            setReportData(reportRows)

            // Step 2: Fetch Production Lot Codes if there are productions
            const productionIds = Array.from(new Set(reportRows.map(r => r.production_id).filter(id => !!id)))
            if (productionIds.length > 0) {
                const { data: prodLots, error: prodLotsError } = await supabase
                    .from('production_lots')
                    .select('production_id, product_id, lot_code')
                    .in('production_id', productionIds) as { data: any[] | null, error: any }

                if (!prodLotsError && prodLots) {
                    const map: Record<string, string> = {}
                    prodLots.forEach((pl: any) => {
                        map[`${pl.production_id}_${pl.product_id}`] = pl.lot_code
                    })
                    setProductionLotsMap(map)
                }
            } else {
                setProductionLotsMap({})
            }
        } catch (err: any) {
            console.error('Error fetching report data:', err)
            showToast('Lỗi tải dữ liệu báo cáo: ' + err.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    const groupedData = useMemo(() => {
        if (!reportData.length) return []
        
        const groups: Record<string, { production_code: string, production_name?: string, lots: any[] }> = {}
        
        reportData.forEach(lot => {
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
    }, [reportData])

    const handleExportExcel = async () => {
        if (reportData.length === 0) {
            showToast('Không có dữ liệu để xuất Excel', 'warning')
            return
        }

        try {
            const workbook = new ExcelJS.Workbook()
            const worksheet = workbook.addWorksheet('Báo cáo LOT')

            // Header
            worksheet.columns = [
                { header: 'STT', key: 'stt', width: 5 },
                { header: 'NGÀY TẠO', key: 'date', width: 15 },
                { header: 'MÃ LOT SX', key: 'prod_code', width: 25 },
                { header: 'SẢN PHẨM', key: 'product', width: 40 },
                { header: 'SỐ LƯỢNG', key: 'qty', width: 12 },
                { header: 'ĐƠN VỊ', key: 'unit', width: 10 },
                { header: 'VỊ TRÍ', key: 'position', width: 15 }
            ]

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

            // Add rows by group
            groupedData.forEach((group: any) => {
                // Add Group Header Row
                const productionLabel = group.production_name || group.production_code || 'Không xác định'
                const groupHeaderRow = worksheet.addRow([`LỆNH SẢN XUẤT: ${productionLabel}`])
                worksheet.mergeCells(`A${groupHeaderRow.number}:G${groupHeaderRow.number}`)
                groupHeaderRow.eachCell((cell) => {
                    cell.font = { bold: true, size: 11 }
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF2CC' } // Light orange for group headers
                    }
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    }
                })

                group.lots.forEach((lot: any, index: number) => {
                    const dateStr = format(new Date(lot.created_at), 'dd/MM/yyyy')
                    const posStr = lot.positions?.map((p: any) => p.code).join(', ') || '-'
                    
                    // If lot has items, create one row per item
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
                            
                            // Apply borders and alignment to each cell
                            row.eachCell((cell, colNumber) => {
                                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
                                if (colNumber === 6) { // Qty column
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
                            if (colNumber === 6) { // Qty column
                                cell.alignment = { horizontal: 'right' }
                                cell.numFmt = '#,##0'
                            }
                        })
                    } else {
                        const sxLotCode = lot.batch_code || lot.production_code || lot.productions?.code || '-'
                        const row = worksheet.addRow({
                            stt: index + 1,
                            date: dateStr,
                            prod_code: sxLotCode,
                            product: '-',
                            qty: '-',
                            unit: '-',
                            position: posStr
                        })
                        row.eachCell((cell) => {
                            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
                        })
                    }
                })
            })

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
            const fileName = `Bao_cao_LOT_${startDate}_to_${endDate}.xlsx`
            saveAs(new Blob([buffer]), fileName)
            showToast('Đã xuất file Excel thành công', 'success')
        } catch (err: any) {
            console.error('Excel export error:', err)
            showToast('Lỗi xuất Excel: ' + err.message, 'error')
        }
    }

    const handlePrint = (orientation: 'portrait' | 'landscape' = 'portrait') => {
        if (reportData.length === 0) {
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
                        // Chờ tài nguyên tải xong rồi mới gọi hàm in tự động
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
                                Kết xuất danh sách LOT tạo trong khoảng ngày đã chọn
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors no-print">
                        <X size={24} className="text-slate-500" />
                    </button>
                </div>

                {/* Filters */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex flex-wrap items-center justify-between gap-4 no-print">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <Calendar size={16} className="text-orange-500" />
                            <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="bg-transparent border-none p-0 focus:ring-0 outline-none w-32"
                                />
                                <span>→</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="bg-transparent border-none p-0 focus:ring-0 outline-none w-32"
                                />
                            </div>
                        </div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            Tìm thấy: <span className="text-orange-600 dark:text-orange-400">{reportData.length}</span> LOT
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExportExcel}
                            disabled={loading || reportData.length === 0}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-all disabled:opacity-50"
                        >
                            <Download size={18} />
                            Xuất Excel
                        </button>
                        <div className="flex items-center bg-slate-800 dark:bg-slate-700 rounded-xl overflow-hidden p-0.5 shadow-sm">
                            <button
                                onClick={() => handlePrint('portrait')}
                                disabled={loading || reportData.length === 0}
                                className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-black text-white text-sm font-bold transition-all disabled:opacity-50"
                            >
                                <Printer size={16} />
                                In dọc
                            </button>
                            <div className="w-px h-5 bg-slate-600"></div>
                            <button
                                onClick={() => handlePrint('landscape')}
                                disabled={loading || reportData.length === 0}
                                className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-black text-white text-sm font-bold transition-all disabled:opacity-50"
                            >
                                <Printer size={16} className="rotate-90" />
                                In ngang
                            </button>
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
                    ) : reportData.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-4 text-slate-400 no-print">
                            <LayoutList size={48} strokeWidth={1} />
                            <p className="font-medium">Không tìm thấy LOT nào trong khoảng ngày này</p>
                        </div>
                    ) : (
                        <div className="report-root">
                            {/* Print Version Header */}
                            <div className="print-header hidden print:block" style={{ marginBottom: '30px' }}>
                                {/* Header top: Logo & Company info */}
                                <div style={{ display: 'flex', alignItems: 'flex-start', borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px' }}>
                                    {/* Left side: Logo + Info */}
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
                                
                                {/* Report Title */}
                                <div style={{ textAlign: 'center', marginBottom: '25px' }}>
                                    <h2 style={{ fontSize: '20pt', fontWeight: '900', margin: '0 0 8px 0', textTransform: 'uppercase', color: '#0f172a', letterSpacing: '1px' }}>
                                        BÁO CÁO TỔNG HỢP LOT
                                    </h2>
                                    <p style={{ fontSize: '11pt', fontStyle: 'italic', color: '#475569', margin: '0' }}>
                                        Từ ngày: {format(new Date(startDate), 'dd/MM/yyyy')} đến ngày: {format(new Date(endDate), 'dd/MM/yyyy')}
                                    </p>
                                </div>
                            </div>
                            
                            {/* Content per Group */}
                            {groupedData.map((group: any, groupIdx: number) => (
                                <div key={groupIdx} style={{ marginBottom: '30px' }}>
                                    {/* Group Title: Lệnh Sản Xuất */}
                                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', pageBreakAfter: 'avoid' }}>
                                        <span style={{ fontSize: '12pt', fontWeight: 'bold', textTransform: 'uppercase', marginRight: '8px' }}>
                                            LỆNH SẢN XUẤT:
                                        </span>
                                        <span style={{ fontSize: '13pt', fontWeight: '900', textTransform: 'uppercase', color: '#ea580c' }}>
                                            {group.production_name || group.production_code || 'Không xác định'}
                                        </span>
                                        <span className="no-print" style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#f1f5f9', color: '#64748b' }}>
                                            {group.lots.length} LOT
                                        </span>
                                    </div>

                                    {/* Data Table for this specific group */}
                                    <table className="w-full text-left border-collapse min-w-[900px] xl:min-w-full">
                                        <thead className="bg-slate-50 dark:bg-slate-900 border-b-2 border-slate-200 dark:border-slate-800 print:static">
                                            <tr>
                                                <th className="py-3 px-2 text-xs font-black text-slate-500 uppercase tracking-widest" style={{ width: '4%' }}>STT</th>
                                                <th className="py-3 px-2 text-xs font-black text-slate-500 uppercase tracking-widest" style={{ width: '11%' }}>Ngày tạo</th>
                                                <th className="py-3 px-2 text-xs font-black text-slate-500 uppercase tracking-widest" style={{ width: '22%' }}>Mã LOT SX</th>
                                                <th className="py-3 px-2 text-xs font-black text-slate-500 uppercase tracking-widest" style={{ width: '33%' }}>Sản phẩm</th>
                                                <th className="py-3 px-2 text-xs font-black text-slate-500 uppercase tracking-widest text-right" style={{ width: '12%' }}>Số lượng</th>
                                                <th className="py-3 px-2 text-xs font-black text-slate-500 uppercase tracking-widest" style={{ width: '8%' }}>Đơn vị</th>
                                                <th className="py-3 px-2 text-xs font-black text-slate-500 uppercase tracking-widest" style={{ width: '10%' }}>Vị trí</th>
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
                                                                            <td className="py-4 px-2 font-mono text-slate-500 font-bold" rowSpan={rowSpan} style={{ width: '4%' }}>{idx + 1}</td>
                                                                            <td className="py-4 px-2 font-medium text-slate-600 dark:text-slate-400" rowSpan={rowSpan} style={{ width: '11%' }}>
                                                                                {format(new Date(lot.created_at), 'dd/MM/yyyy')}
                                                                            </td>
                                                                            <td className="py-4 px-2" rowSpan={rowSpan} style={{ width: '22%' }}>
                                                                                <span className="px-2 py-1 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 font-bold text-[11px] border border-orange-100 dark:border-orange-800/30">
                                                                                    {productionLotsMap[`${lot.production_id}_${item.product_id}`] || lot.batch_code || lot.production_code || lot.productions?.code || '-'}
                                                                                </span>
                                                                            </td>
                                                                        </>
                                                                    )}
                                                                    <td className="py-2 px-2" style={{ width: '33%' }}>
                                                                        <div className="font-bold text-slate-800 dark:text-slate-200">{item.products?.name}</div>
                                                                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.products?.sku}</div>
                                                                    </td>
                                                                    <td className="py-2 px-2 text-right font-black text-orange-600 dark:text-orange-400" style={{ width: '12%' }}>
                                                                        {formatQuantityFull(item.quantity)}
                                                                    </td>
                                                                    <td className="py-2 px-2 font-medium text-slate-500" style={{ width: '8%' }}>
                                                                        {item.unit || item.products?.unit}
                                                                    </td>
                                                                    {itemIdx === 0 && (
                                                                        <td className="py-2 px-2" rowSpan={rowSpan} style={{ width: '10%' }}>
                                                                            {lot.positions?.length > 0 ? (
                                                                                <div className="flex flex-wrap gap-1">
                                                                                    {lot.positions.map((p: any) => (
                                                                                        <span key={p.id} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md text-[10px] font-black border border-slate-200 dark:border-slate-700">
                                                                                            {p.code}
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            ) : '-'}
                                                                        </td>
                                                                    )}
                                                                </tr>
                                                            ))
                                                        ) : lot.products ? (
                                                            <tr key={lot.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 text-sm">
                                                                <td className="py-4 px-2 font-mono text-slate-500 font-bold" style={{ width: '4%' }}>{idx + 1}</td>
                                                                <td className="py-4 px-2 font-medium text-slate-600 dark:text-slate-400" style={{ width: '11%' }}>
                                                                    {format(new Date(lot.created_at), 'dd/MM/yyyy')}
                                                                </td>
                                                                <td className="py-4 px-2" style={{ width: '22%' }}>
                                                                    <span className="px-2 py-1 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 font-bold text-[11px] border border-orange-100 dark:border-orange-800/30">
                                                                        {productionLotsMap[`${lot.production_id}_${lot.product_id}`] || lot.batch_code || lot.production_code || lot.productions?.code || '-'}
                                                                    </span>
                                                                </td>
                                                                <td className="py-2 px-2" style={{ width: '33%' }}>
                                                                    <div className="font-bold text-slate-800 dark:text-slate-200">{lot.products.name}</div>
                                                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{lot.products.sku}</div>
                                                                </td>
                                                                <td className="py-2 px-2 text-right font-black text-orange-600 dark:text-orange-400" style={{ width: '12%' }}>
                                                                    {formatQuantityFull((lot as any).quantity || 0)}
                                                                </td>
                                                                <td className="py-2 px-2 font-medium text-slate-500" style={{ width: '8%' }}>
                                                                    {(lot as any).unit || lot.products.unit}
                                                                </td>
                                                                <td className="py-2 px-2" style={{ width: '10%' }}>
                                                                    {lot.positions?.length > 0 ? (
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {lot.positions.map((p: any) => (
                                                                                <span key={p.id} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md text-[10px] font-black border border-slate-200 dark:border-slate-700">
                                                                                    {p.code}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    ) : '-'}
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            <tr key={lot.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 text-sm">
                                                                <td className="py-4 px-2 font-mono text-slate-500 font-bold" style={{ width: '4%' }}>{idx + 1}</td>
                                                                <td className="py-4 px-2 font-medium text-slate-600 dark:text-slate-400" style={{ width: '11%' }}>
                                                                    {format(new Date(lot.created_at), 'dd/MM/yyyy')}
                                                                </td>
                                                                <td className="py-4 px-2" style={{ width: '22%' }}>
                                                                    <span className="px-2 py-1 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 font-bold text-[11px] border border-orange-100 dark:border-orange-800/30">
                                                                        {lot.production_code || lot.productions?.code || '-'}
                                                                    </span>
                                                                </td>
                                                                <td className="py-2 px-2 text-slate-400 italic" style={{ width: '33%' }}>Không có dữ liệu hàng hóa</td>
                                                                <td className="py-2 px-2 text-right font-black" style={{ width: '12%' }}>-</td>
                                                                <td className="py-2 px-2" style={{ width: '8%' }}>-</td>
                                                                <td className="py-2 px-2" style={{ width: '10%' }}>
                                                                    {lot.positions?.length > 0 ? (
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {lot.positions.map((p: any) => (
                                                                                <span key={p.id} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md text-[10px] font-black border border-slate-200 dark:border-slate-700">
                                                                                    {p.code}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    ) : '-'}
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
    
                            {/* Signature Footer */}
                            <div className="print-footer hidden print:block" style={{ marginTop: '50px', paddingBottom: '60px', pageBreakInside: 'avoid' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', textAlign: 'center', padding: '0 40px' }}>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: '12pt', fontWeight: 'bold', textTransform: 'uppercase', margin: 0, color: '#0f172a' }}>Người lập biểu</p>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: '12pt', fontWeight: 'bold', textTransform: 'uppercase', margin: 0, color: '#0f172a' }}>Thủ kho</p>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: '12pt', fontWeight: 'bold', textTransform: 'uppercase', margin: 0, color: '#0f172a' }}>Sản xuất</p>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: '12pt', fontWeight: 'bold', textTransform: 'uppercase', margin: 0, color: '#0f172a' }}>QC</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
