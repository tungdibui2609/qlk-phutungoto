'use client'

import React, { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/Dialog"
import { Search, Loader2, Package, MapPin, FileText, Calendar, Box, Download } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { format, startOfDay, endOfDay } from 'date-fns'
import { useToast } from '@/components/ui/ToastProvider'

interface ExportItemSearchModalProps {
    isOpen: boolean
    onClose: () => void
}

interface SearchResult {
    id: string
    quantity: number
    exported_quantity: number
    unit: string
    status: string
    task_code: string
    task_status: string
    task_created_at: string
    product_name: string
    sku: string
    production_code: string | null
    lot_code: string
    position_code: string
}

export function ExportItemSearchModal({ isOpen, onClose }: ExportItemSearchModalProps) {
    const { currentSystem } = useSystem()
    const { showToast } = useToast()
    const [searchQuery, setSearchQuery] = useState('')
    const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-01'))
    const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
    const [loading, setLoading] = useState(false)
    const [exporting, setExporting] = useState(false)
    const [results, setResults] = useState<SearchResult[]>([])
    const [hasSearched, setHasSearched] = useState(false)

    useEffect(() => {
        if (!isOpen) {
            setSearchQuery('')
            setResults([])
            setHasSearched(false)
        }
    }, [isOpen])

    const handleSearch = async () => {
        if (!currentSystem) return

        setLoading(true)
        setHasSearched(true)
        try {
            // First, find products matching the search query if it exists
            let productIds: string[] = []
            if (searchQuery.trim()) {
                const { data: products } = await supabase
                    .from('products')
                    .select('id')
                    .or(`name.ilike.%${searchQuery}%,sku.ilike.%${searchQuery}%`)
                    .eq('system_type', currentSystem.code)
                    .limit(50)
                productIds = products?.map((p: any) => p.id) || []
            }

            let query = supabase
                .from('export_task_items')
                .select(`
                    id,
                    quantity,
                    exported_quantity,
                    unit,
                    status,
                    export_tasks!inner(code, status, created_at, system_code),
                    products!inner(name, sku),
                    lots(production_code, code),
                    positions(code)
                `)
                .eq('export_tasks.system_code', currentSystem.code)

            if (startDate) {
                query = query.gte('export_tasks.created_at', startOfDay(new Date(startDate)).toISOString())
            }
            if (endDate) {
                query = query.lte('export_tasks.created_at', endOfDay(new Date(endDate)).toISOString())
            }

            if (searchQuery.trim()) {
                if (productIds.length > 0) {
                    query = query.in('product_id', productIds)
                } else {
                    // Tricky to filter joined tables dynamically without dropping results if empty
                    // In this case we do nothing and hope the second query handles it
                }
            }

            const { data, error } = await query.order('created_at', { ascending: false }).limit(500)

            if (error) throw error

            let formattedResults: SearchResult[] = (data || []).map((item: any) => ({
                id: item.id,
                quantity: item.quantity,
                exported_quantity: item.exported_quantity,
                unit: item.unit,
                status: item.status,
                task_code: item.export_tasks?.code || 'N/A',
                task_status: item.export_tasks?.status || 'N/A',
                task_created_at: item.export_tasks?.created_at,
                product_name: item.products?.name || 'N/A',
                sku: item.products?.sku || 'N/A',
                production_code: item.lots?.production_code || null,
                lot_code: item.lots?.code || 'N/A',
                position_code: item.positions?.code || 'N/A'
            }))

            if (searchQuery.trim() && productIds.length === 0) {
                let lotQuery = supabase
                    .from('export_task_items')
                    .select(`
                        id,
                        quantity,
                        exported_quantity,
                        unit,
                        status,
                        export_tasks!inner(code, status, created_at, system_code),
                        products!inner(name, sku),
                        lots!inner(production_code, code),
                        positions(code)
                    `)
                    .eq('export_tasks.system_code', currentSystem.code)
                    .ilike('lots.production_code', `%${searchQuery}%`)
                
                if (startDate) lotQuery = lotQuery.gte('export_tasks.created_at', startOfDay(new Date(startDate)).toISOString())
                if (endDate) lotQuery = lotQuery.lte('export_tasks.created_at', endOfDay(new Date(endDate)).toISOString())

                const { data: lotData } = await lotQuery.order('created_at', { ascending: false }).limit(500)

                if (lotData) {
                    formattedResults = lotData.map((item: any) => ({
                        id: item.id,
                        quantity: item.quantity,
                        exported_quantity: item.exported_quantity,
                        unit: item.unit,
                        status: item.status,
                        task_code: item.export_tasks?.code || 'N/A',
                        task_status: item.export_tasks?.status || 'N/A',
                        task_created_at: item.export_tasks?.created_at,
                        product_name: item.products?.name || 'N/A',
                        sku: item.products?.sku || 'N/A',
                        production_code: item.lots?.production_code || null,
                        lot_code: item.lots?.code || 'N/A',
                        position_code: item.positions?.code || 'N/A'
                    }))
                }
            }

            setResults(formattedResults)

        } catch (error) {
            console.error('Error searching:', error)
            showToast('Có lỗi xảy ra khi tìm kiếm', 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleExportExcel = async () => {
        if (results.length === 0) {
            showToast('Không có dữ liệu để xuất', 'warning')
            return
        }

        try {
            setExporting(true)
            const ExcelJS = await import('exceljs')
            const { saveAs } = await import('file-saver')

            const workbook = new ExcelJS.default.Workbook()
            const worksheet = workbook.addWorksheet('Lịch sử xuất hàng')

            // Headers
            worksheet.columns = [
                { header: 'Tên Sản Phẩm', key: 'product_name', width: 30 },
                { header: 'Mã SKU', key: 'sku', width: 20 },
                { header: 'Lệnh SX', key: 'production_code', width: 20 },
                { header: 'Vị Trí Xuất', key: 'position_code', width: 15 },
                { header: 'Lệnh Xuất', key: 'task_code', width: 20 },
                { header: 'Số Lượng Yêu Cầu', key: 'quantity', width: 20 },
                { header: 'Đã Xuất', key: 'exported_quantity', width: 15 },
                { header: 'ĐVT', key: 'unit', width: 10 },
                { header: 'Ngày Tạo Lệnh', key: 'task_created_at', width: 20 },
                { header: 'Trạng Thái', key: 'status', width: 15 },
            ]

            // Header Style
            worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
            worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
            worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }

            // Add rows
            results.forEach((item) => {
                worksheet.addRow({
                    product_name: item.product_name,
                    sku: item.sku,
                    production_code: item.production_code || '-',
                    position_code: item.position_code,
                    task_code: item.task_code,
                    quantity: item.quantity,
                    exported_quantity: item.exported_quantity || 0,
                    unit: item.unit,
                    task_created_at: item.task_created_at ? format(new Date(item.task_created_at), 'dd/MM/yyyy HH:mm') : '-',
                    status: item.status,
                })
            })

            const buffer = await workbook.xlsx.writeBuffer()
            const fileName = `Lich_su_xuat_hang_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`
            saveAs(new Blob([buffer]), fileName)

            showToast('Xuất Excel thành công', 'success')
        } catch (error) {
            console.error('Lỗi khi xuất excel:', error)
            showToast('Không thể xuất file Excel', 'error')
        } finally {
            setExporting(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b border-stone-100 dark:border-stone-800">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Search className="text-blue-500" />
                        Tra cứu lịch sử xuất hàng
                    </DialogTitle>
                </DialogHeader>

                <div className="p-6 flex-1 overflow-hidden flex flex-col bg-stone-50/50 dark:bg-stone-900/50">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
                        <div className="md:col-span-2 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                            <input
                                type="text"
                                placeholder="Tên hàng, SKU, hoặc Lệnh SX (bỏ trống để tìm tất cả)..."
                                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                        </div>
                        <div className="flex gap-2 items-center">
                            <span className="text-sm font-medium text-stone-500">Từ:</span>
                            <input
                                type="date"
                                className="flex-1 px-3 py-2.5 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2 items-center">
                            <span className="text-sm font-medium text-stone-500">Đến:</span>
                            <input
                                type="date"
                                className="flex-1 px-3 py-2.5 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex justify-between mb-4">
                        <div className="text-sm font-medium text-stone-500 flex items-center">
                            {hasSearched ? `Tìm thấy ${results.length} kết quả` : 'Nhập thông tin và bấm Tìm kiếm'}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleExportExcel}
                                disabled={exporting || results.length === 0}
                                className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2 text-sm"
                            >
                                {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                Xuất Excel
                            </button>
                            <button
                                onClick={handleSearch}
                                disabled={loading}
                                className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2 text-sm"
                            >
                                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Tìm kiếm'}
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl custom-scrollbar">
                        {loading ? (
                            <div className="flex items-center justify-center h-40">
                                <Loader2 className="animate-spin text-blue-500" size={32} />
                            </div>
                        ) : hasSearched && results.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-stone-500">
                                <Package size={48} className="mb-3 text-stone-300" strokeWidth={1} />
                                <p>Không tìm thấy dữ liệu xuất hàng phù hợp</p>
                            </div>
                        ) : results.length > 0 ? (
                            <div className="divide-y divide-stone-100 dark:divide-stone-800">
                                {results.map((item, idx) => (
                                    <div key={idx} className="p-4 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded text-blue-600 dark:text-blue-400">
                                                    <Box size={16} />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-stone-800 dark:text-stone-100">{item.product_name}</div>
                                                    <div className="text-xs text-stone-500">SKU: {item.sku}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
                                                    {item.quantity} <span className="text-xs font-normal">{item.unit}</span>
                                                </div>
                                                <div className="text-[10px] text-stone-400 uppercase font-bold">
                                                    Đã xuất: {item.exported_quantity || 0}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                                            <div className="bg-stone-50 dark:bg-stone-800 p-2.5 rounded-lg border border-stone-100 dark:border-stone-700">
                                                <div className="text-[10px] font-bold text-stone-400 uppercase mb-1 flex items-center gap-1"><MapPin size={12}/> Vị trí</div>
                                                <div className="font-mono font-bold text-sm text-stone-700 dark:text-stone-300">{item.position_code}</div>
                                            </div>
                                            <div className="bg-stone-50 dark:bg-stone-800 p-2.5 rounded-lg border border-stone-100 dark:border-stone-700">
                                                <div className="text-[10px] font-bold text-stone-400 uppercase mb-1 flex items-center gap-1"><Package size={12}/> Lệnh SX</div>
                                                <div className="font-bold text-sm text-stone-700 dark:text-stone-300 truncate" title={item.production_code || '-'}>{item.production_code || '-'}</div>
                                            </div>
                                            <div className="bg-stone-50 dark:bg-stone-800 p-2.5 rounded-lg border border-stone-100 dark:border-stone-700">
                                                <div className="text-[10px] font-bold text-stone-400 uppercase mb-1 flex items-center gap-1"><FileText size={12}/> Lệnh Xuất</div>
                                                <div className="font-mono font-bold text-sm text-blue-600 dark:text-blue-400">{item.task_code}</div>
                                            </div>
                                            <div className="bg-stone-50 dark:bg-stone-800 p-2.5 rounded-lg border border-stone-100 dark:border-stone-700">
                                                <div className="text-[10px] font-bold text-stone-400 uppercase mb-1 flex items-center gap-1"><Calendar size={12}/> Ngày tạo</div>
                                                <div className="text-sm text-stone-700 dark:text-stone-300">{item.task_created_at ? format(new Date(item.task_created_at), 'dd/MM/yyyy HH:mm') : '-'}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
