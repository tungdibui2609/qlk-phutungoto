'use client'

import React, { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { X, Calendar, FileDown, Loader2 } from 'lucide-react'
import { format, startOfDay, endOfDay } from 'date-fns'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import { exportDailyItemsToExcel } from '@/lib/dailyItemsExcelExport'
import { useUnitConversion } from '@/hooks/useUnitConversion'

interface DailyExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'inbound' | 'outbound';
}

export default function DailyExportModal({ isOpen, onClose, type }: DailyExportModalProps) {
    const { showToast } = useToast()
    const { systemType, currentSystem } = useSystem()
    const { convertUnit } = useUnitConversion()
    const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
    const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
    const [loading, setLoading] = useState(false)

    const handleExport = async () => {
        if (!systemType) {
            showToast('Không xác định được phân hệ kho hiện tại', 'error')
            return
        }

        setLoading(true)
        try {
            const start = startOfDay(new Date(startDate)).toISOString()
            const end = endOfDay(new Date(endDate)).toISOString()

            let items: any[] = []

            if (type === 'inbound') {
                const { data, error } = await supabase
                    .from('inbound_order_items')
                    .select(`
                        quantity,
                        note,
                        unit,
                        product_name,
                        product_id,
                        order:inbound_orders!inner(
                            code,
                            created_at,
                            system_code,
                            supplier:suppliers(name)
                        ),
                        products(sku, unit, internal_code, internal_name)
                    `)
                    .eq('order.system_code', systemType)
                    .gte('order.created_at', start)
                    .lte('order.created_at', end)

                if (error) throw error
                
                items = ((data as any[]) || []).map(item => {
                    const convertedQty = convertUnit(
                        item.product_id,
                        item.unit,
                        'kg',
                        item.quantity,
                        item.products?.unit || null
                    )

                    return {
                        order_code: item.order.code,
                        order_date: item.order.created_at,
                        product_name: item.product_name || item.products?.internal_name || item.products?.sku || 'N/A',
                        sku: item.products?.internal_code || item.products?.sku || '',
                        unit: item.unit,
                        quantity: item.quantity,
                        convertedQty: convertedQty,
                        partner_name: item.order.supplier?.name || 'Hệ thống',
                        note: item.note
                    }
                })
            } else {
                const { data, error } = await supabase
                    .from('outbound_order_items')
                    .select(`
                        quantity,
                        note,
                        unit,
                        product_name,
                        product_id,
                        order:outbound_orders!inner(
                            code,
                            customer_name,
                            created_at,
                            system_code
                        ),
                        products(sku, unit, internal_code, internal_name)
                    `)
                    .eq('order.system_code', systemType)
                    .gte('order.created_at', start)
                    .lte('order.created_at', end)

                if (error) throw error

                items = ((data as any[]) || []).map(item => {
                    const convertedQty = convertUnit(
                        item.product_id,
                        item.unit,
                        'kg',
                        item.quantity,
                        item.products?.unit || null
                    )

                    return {
                        order_code: item.order.code,
                        order_date: item.order.created_at,
                        product_name: item.product_name || item.products?.internal_name || item.products?.sku || 'N/A',
                        sku: item.products?.internal_code || item.products?.sku || '',
                        unit: item.unit,
                        quantity: item.quantity,
                        convertedQty: convertedQty,
                        partner_name: item.order.customer_name || 'Khách lẻ',
                        note: item.note
                    }
                })
            }

            if (items.length === 0) {
                const dateText = startDate === endDate 
                    ? format(new Date(startDate), 'dd/MM/yyyy')
                    : `từ ${format(new Date(startDate), 'dd/MM/yyyy')} đến ${format(new Date(endDate), 'dd/MM/yyyy')}`
                showToast(`Không có dữ liệu ${type === 'inbound' ? 'nhập' : 'xuất'} ${dateText}`, 'warning')
            } else {
                const systemName = (currentSystem as any)?.name || systemType
                await exportDailyItemsToExcel({
                    type,
                    startDate: new Date(startDate),
                    endDate: new Date(endDate),
                    systemName,
                    items
                })
                showToast('Tải báo cáo thành công!', 'success')
                onClose()
            }
        } catch (error: any) {
            console.error('Export error:', error)
            showToast('Lỗi khi xuất báo cáo: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileDown className="w-5 h-5 text-indigo-600" />
                        Tải báo cáo hàng hóa ngày
                    </DialogTitle>
                    <DialogDescription>
                        Chọn ngày muốn lấy danh sách chi tiết hàng hóa đã {type === 'inbound' ? 'nhập' : 'xuất'} kho.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-indigo-500" />
                                Từ ngày
                            </label>
                            <input
                                type="date"
                                className="w-full h-10 px-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-orange-500" />
                                Đến ngày
                            </label>
                            <input
                                type="date"
                                className="w-full h-10 px-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        disabled={loading}
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Đang xử lý...
                            </>
                        ) : (
                            <>
                                <FileDown className="w-4 h-4" />
                                Tải báo cáo
                            </>
                        )}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
