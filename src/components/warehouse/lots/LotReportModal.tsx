'use client'

import React, { useState, useEffect } from 'react'
import { X, FileText, Download, Printer, Loader2, Calendar, LayoutList } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { formatQuantityFull } from '@/lib/numberUtils'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

interface LotReportModalProps {
    onClose: () => void
}

export function LotReportModal({ onClose }: LotReportModalProps) {
    const { currentSystem } = useSystem()
    const { showToast } = useToast()

    const [loading, setLoading] = useState(false)
    const [reportData, setReportData] = useState<any[]>([])
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])

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
                    productions(code, name),
                    lot_items(
                        quantity,
                        unit,
                        products(name, sku, unit)
                    ),
                    positions!positions_lot_id_fkey(code)
                `)
                .eq('system_code', currentSystem.code)
                .gte('created_at', start.toISOString())
                .lte('created_at', end.toISOString())
                .order('created_at', { ascending: false })

            if (error) throw error
            setReportData(data || [])
        } catch (err: any) {
            console.error('Error fetching report data:', err)
            showToast('Lỗi tải dữ liệu báo cáo: ' + err.message, 'error')
        } finally {
            setLoading(false)
        }
    }

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
                { header: 'MÃ LOT (KHO)', key: 'lot_code', width: 20 },
                { header: 'MÃ LOT SX / LỆNH SX', key: 'prod_code', width: 25 },
                { header: 'SẢN PHẨM', key: 'product', width: 40 },
                { header: 'SỐ LƯỢNG', key: 'qty', width: 12 },
                { header: 'ĐƠN VỊ', key: 'unit', width: 10 },
                { header: 'VỊ TRÍ', key: 'position', width: 15 }
            ]

            // Styling header
            worksheet.getRow(1).font = { bold: true }
            worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }

            // Add rows
            reportData.forEach((lot, index) => {
                const dateStr = format(new Date(lot.created_at), 'dd/MM/yyyy HH:mm')
                const prodCode = lot.production_code || lot.productions?.code || '-'
                const posStr = lot.positions?.map((p: any) => p.code).join(', ') || '-'
                
                // If lot has items, create one row per item
                if (lot.lot_items && lot.lot_items.length > 0) {
                    lot.lot_items.forEach((item: any, itemIdx: number) => {
                        worksheet.addRow({
                            stt: itemIdx === 0 ? index + 1 : '',
                            date: itemIdx === 0 ? dateStr : '',
                            lot_code: itemIdx === 0 ? lot.code : '',
                            prod_code: itemIdx === 0 ? prodCode : '',
                            product: item.products?.name || '-',
                            qty: item.quantity,
                            unit: item.unit || item.products?.unit || '-',
                            position: itemIdx === 0 ? posStr : ''
                        })
                    })
                } else {
                    worksheet.addRow({
                        stt: index + 1,
                        date: dateStr,
                        lot_code: lot.code,
                        prod_code: prodCode,
                        product: '-',
                        qty: '-',
                        unit: '-',
                        position: posStr
                    })
                }
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

    const handlePrint = () => {
        if (reportData.length === 0) {
            showToast('Không có dữ liệu để in', 'warning')
            return
        }
        window.print()
    }

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-[32px] max-w-5xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 pb-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
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
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <X size={24} className="text-slate-500" />
                    </button>
                </div>

                {/* Filters */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex flex-wrap items-center justify-between gap-4">
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
                        <button
                            onClick={handlePrint}
                            disabled={loading || reportData.length === 0}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 dark:bg-slate-700 hover:bg-black text-white text-sm font-bold transition-all disabled:opacity-50"
                        >
                            <Printer size={18} />
                            In báo cáo
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide printable-content">
                    {loading ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-3">
                            <Loader2 size={40} className="animate-spin text-orange-500" />
                            <p className="text-sm font-bold text-slate-500 animate-pulse">Đang nạp dữ liệu...</p>
                        </div>
                    ) : reportData.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-4 text-slate-400">
                            <LayoutList size={48} strokeWidth={1} />
                            <p className="font-medium">Không tìm thấy LOT nào trong khoảng ngày này</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10">
                                <tr className="border-b-2 border-slate-100 dark:border-slate-800">
                                    <th className="py-3 px-2 text-xs font-black text-slate-400 uppercase tracking-widest">STT</th>
                                    <th className="py-3 px-2 text-xs font-black text-slate-400 uppercase tracking-widest">Ngày tạo</th>
                                    <th className="py-3 px-2 text-xs font-black text-slate-400 uppercase tracking-widest">Mã LOT (Kho)</th>
                                    <th className="py-3 px-2 text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Mã LOT SX / Lệnh SX</th>
                                    <th className="py-3 px-2 text-xs font-black text-slate-400 uppercase tracking-widest">Sản phẩm</th>
                                    <th className="py-3 px-2 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Số lượng</th>
                                    <th className="py-3 px-2 text-xs font-black text-slate-400 uppercase tracking-widest">Đơn vị</th>
                                    <th className="py-3 px-2 text-xs font-black text-slate-400 uppercase tracking-widest">Vị trí</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.map((lot, idx) => {
                                    const items = lot.lot_items || []
                                    const rowSpan = Math.max(items.length, 1)

                                    return (
                                        <React.Fragment key={lot.id}>
                                            {rowSpan > 1 ? (
                                                items.map((item: any, itemIdx: number) => (
                                                    <tr key={item.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 text-sm">
                                                        {itemIdx === 0 && (
                                                            <>
                                                                <td className="py-4 px-2 font-mono text-slate-500" rowSpan={rowSpan}>{idx + 1}</td>
                                                                <td className="py-4 px-2 font-medium text-slate-600 dark:text-slate-400" rowSpan={rowSpan}>
                                                                    {format(new Date(lot.created_at), 'dd/MM/yyyy HH:mm')}
                                                                </td>
                                                                <td className="py-4 px-2 font-black text-slate-900 dark:text-slate-100" rowSpan={rowSpan}>
                                                                    {lot.code}
                                                                </td>
                                                                <td className="py-4 px-2" rowSpan={rowSpan}>
                                                                    <span className="px-2 py-1 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 font-bold text-[10px] border border-orange-100 dark:border-orange-800/30">
                                                                        {lot.production_code || lot.productions?.code || '-'}
                                                                    </span>
                                                                </td>
                                                            </>
                                                        )}
                                                        <td className="py-4 px-2">
                                                            <div className="font-bold text-slate-800 dark:text-slate-200">{item.products?.name}</div>
                                                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.products?.sku}</div>
                                                        </td>
                                                        <td className="py-4 px-2 text-right font-black text-orange-600 dark:text-orange-400">
                                                            {formatQuantityFull(item.quantity)}
                                                        </td>
                                                        <td className="py-4 px-2 font-medium text-slate-500">
                                                            {item.unit || item.products?.unit}
                                                        </td>
                                                        {itemIdx === 0 && (
                                                            <td className="py-4 px-2" rowSpan={rowSpan}>
                                                                {lot.positions?.length > 0 ? (
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {lot.positions.map((p: any) => (
                                                                            <span key={p.code} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md text-[10px] font-black border border-slate-200 dark:border-slate-700">
                                                                                {p.code}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                ) : '-'}
                                                            </td>
                                                        )}
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 text-sm">
                                                    <td className="py-4 px-2 font-mono text-slate-500">{idx + 1}</td>
                                                    <td className="py-4 px-2 font-medium text-slate-600 dark:text-slate-400">
                                                        {format(new Date(lot.created_at), 'dd/MM/yyyy HH:mm')}
                                                    </td>
                                                    <td className="py-4 px-2 font-black text-slate-900 dark:text-slate-100">
                                                        {lot.code}
                                                    </td>
                                                    <td className="py-4 px-2">
                                                        <span className="px-2 py-1 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 font-bold text-[10px] border border-orange-100 dark:border-orange-800/30">
                                                            {lot.production_code || lot.productions?.code || '-'}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-2 text-slate-400 italic">Không có dữ liệu hàng hóa</td>
                                                    <td className="py-4 px-2 text-right font-black">-</td>
                                                    <td className="py-4 px-2">-</td>
                                                    <td className="py-4 px-2">
                                                        {lot.positions?.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1">
                                                                {lot.positions.map((p: any) => (
                                                                    <span key={p.code} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md text-[10px] font-black border border-slate-200 dark:border-slate-700">
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
                    )}
                </div>

                {/* Print Styles */}
                <style jsx global>{`
                    @media print {
                        body * {
                            visibility: hidden;
                        }
                        .printable-content, .printable-content * {
                            visibility: visible;
                        }
                        .printable-content {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100%;
                            padding: 20px;
                            background: white !important;
                            color: black !important;
                        }
                        .printable-content table {
                            width: 100%;
                            border-collapse: collapse;
                            font-size: 10px;
                        }
                        .printable-content th, .printable-content td {
                            border: 1px solid #ddd;
                            padding: 8px;
                            text-align: left;
                        }
                        .printable-content th {
                            background-color: #f2f2f2 !important;
                            color: black !important;
                        }
                        .scrollbar-hide::-webkit-scrollbar {
                            display: none;
                        }
                        /* Hide everything else */
                        .bg-black\\/60, .bg-slate-50, .border-b, .p-6.pb-4, .px-6.py-2 {
                            display: none !important;
                        }
                    }
                `}</style>
            </div>
        </div>
    )
}
