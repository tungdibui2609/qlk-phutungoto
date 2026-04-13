'use client'

import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Printer, Loader2, AlertTriangle } from 'lucide-react'
import { usePrintCompanyInfo } from '@/hooks/usePrintCompanyInfo'
import { PrintHeader } from '@/components/print/PrintHeader'

export default function ExportLotPrintContent() {
    const searchParams = useSearchParams()
    const itemIdsStr = searchParams.get('item_ids')
    const exportOrderId = searchParams.get('export_order_id') || ''
    
    const [loading, setLoading] = useState(true)
    const [itemsData, setItemsData] = useState<any[]>([])
    const [printConfig, setPrintConfig] = useState({
        label_count: 0, 
        start_index: 1,
        net_weight: '',
        notes: '',
        customer: '',
        nsx: '',
        lot_override: ''
    })
    const [error, setError] = useState<string | null>(null)
    const { companyInfo } = usePrintCompanyInfo()

    useEffect(() => {
        if (itemIdsStr) fetchItemsData()
        else {
            setLoading(false)
            setError('Không tìm thấy tham số item_ids trên URL')
        }
    }, [itemIdsStr])

    async function fetchItemsData() {
        if (!itemIdsStr) return
        setLoading(true)
        try {
            const itemIds = itemIdsStr.split(',')
            const { data, error: fetchError } = await supabase
                .from('export_task_items')
                .select(`
                    id,
                    quantity,
                    unit,
                    lot_id,
                    products (
                        id,
                        name,
                        sku,
                        unit
                    ),
                    lots (
                        id,
                        code,
                        daily_seq,
                        peeling_date,
                        inbound_date,
                        production_id,
                        productions (
                            code,
                            customers:customer_id(name)
                        )
                    )
                `)
                .in('id', itemIds)

            if (fetchError) throw fetchError

            if (data && data.length > 0) {
                const processedItems = await Promise.all(data.map(async (item: any) => {
                    const lot = item.lots || {}
                    
                    // Transtive lookup for production lot code
                    let prodLotCode = lot.code
                    if (lot.production_id) {
                        try {
                            const { data: prodLots } = await supabase
                                .from('production_lots')
                                .select('lot_code')
                                .eq('production_id', lot.production_id)
                                .eq('product_id', item.products?.id || lot.product_id)
                                .maybeSingle()
                            if (prodLots) prodLotCode = (prodLots as any).lot_code
                        } catch (e) {
                            console.error('Error fetching production lot code:', e)
                        }
                    }

                    return {
                        ...item,
                        final_lot_code: prodLotCode,
                        final_inbound_date: lot.inbound_date,
                        daily_seq: lot.daily_seq
                    }
                }))

                setItemsData(processedItems)
                
                // Initial config from first item
                const first = processedItems[0]
                const unitName = first.unit || ''
                const weightMatch = unitName.match(/\(\s*.*?\s*(\d+(\.\d+)?\s*[kK]?[gG])\s*\)/i)
                const suggestionWeight = weightMatch ? weightMatch[1] : (first.lots?.weight_per_unit ? first.lots.weight_per_unit + 'kg' : '')

                setPrintConfig(prev => ({
                    ...prev,
                    label_count: processedItems.reduce((sum, i) => sum + (i.quantity || 0), 0),
                    customer: first.lots?.productions?.customers?.name || '',
                    net_weight: suggestionWeight,
                    nsx: first.lots?.peeling_date || ''
                }))
            } else {
                setError('Không tìm thấy dữ liệu hàng hóa tương ứng với các ID đã chọn.')
            }
        } catch (err: any) {
            console.error('Fetch items error:', err)
            setError(`Lỗi hệ thống: ${err.message || 'Không thể kết nối cơ sở dữ liệu'}`)
        } finally {
            setLoading(false)
        }
    }

    const handlePrint = () => {
        window.print()
    }

    if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" /></div>
    
    if (error) return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <AlertTriangle className="w-12 h-12 text-red-500" />
            <div className="text-xl font-bold text-red-600">{error}</div>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Thử lại</button>
        </div>
    )

    if (itemsData.length === 0) return <div className="flex items-center justify-center min-h-screen text-red-500">Không tìm thấy dữ liệu hàng hóa cần in</div>

    // Generate label list
    const labels = itemsData.flatMap(item => 
        Array.from({ length: item.quantity }, () => ({
            ...item
        }))
    )

    return (
        <div className="min-h-screen bg-zinc-100 print:bg-white">
            {/* Config Form - Screen only */}
            <div className="print:hidden p-8 max-w-2xl mx-auto space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Printer className="w-8 h-8 text-blue-500" />
                        <h1 className="text-2xl font-bold">In tem xuất kho ({itemsData.length} Lô - {printConfig.label_count} Thùng)</h1>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-stone-500 font-bold uppercase">Lần chọn này</p>
                        <p className="text-sm font-black text-blue-600">{printConfig.label_count} Tem</p>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 p-6 bg-white rounded-2xl shadow-lg border border-stone-200">
                    <div className="space-y-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-stone-500 uppercase">Ghi đè Mã Lot (Nếu có):</label>
                            <input value={printConfig.lot_override} onChange={(e) => setPrintConfig({ ...printConfig, lot_override: e.target.value })} className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-600" placeholder="Để trống nếu lấy theo Lô" />
                            <p className="text-[10px] text-stone-400 italic">* Ưu tiên Mã Lot của từng thùng nếu để trống</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-stone-500 uppercase">Khách hàng:</label>
                            <input value={printConfig.customer} onChange={(e) => setPrintConfig({ ...printConfig, customer: e.target.value })} className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="VD: Nafoods" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-stone-500 uppercase">Trọng lượng (KLT):</label>
                            <input value={printConfig.net_weight} onChange={(e) => setPrintConfig({ ...printConfig, net_weight: e.target.value })} className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="VD: 10kg" />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-stone-500 uppercase">Ngày SX (NSX):</label>
                            <input type="date" value={printConfig.nsx ? printConfig.nsx.split('T')[0] : ''} onChange={(e) => setPrintConfig({ ...printConfig, nsx: e.target.value })} className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-stone-500 uppercase">Ngày Đóng Gói (NĐG):</label>
                            <div className="px-3 py-2 bg-stone-50 border rounded-lg text-stone-400 text-sm italic">Tự động theo Lô (Ngày nhập kho)</div>
                            <p className="text-[10px] text-stone-400 italic">* Lấy đúng giá trị từ mỗi Lô hàng cụ thể</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-stone-500 uppercase">Ghi chú:</label>
                            <input value={printConfig.notes} onChange={(e) => setPrintConfig({ ...printConfig, notes: e.target.value })} className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                    </div>
                </div>
                
                <button onClick={handlePrint} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-[0.98] flex items-center justify-center gap-3">
                    <Printer size={20} />
                    <span>In {labels.length} tem dán thùng</span>
                </button>
            </div>

            {/* Print Area */}
            <div id="print-labels" className="flex flex-wrap gap-4 justify-center p-8 print:gap-0 print:p-0 print:flex-col print:items-center">
                <style jsx global>{`
                    @media print {
                        body * { visibility: hidden; }
                        #print-labels, #print-labels * { visibility: visible; }
                        #print-labels { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
                        @page { size: 90mm 60mm; margin: 0; }
                    }
                `}</style>
                {labels.map((label: any, idx) => (
                    <div key={idx} className="relative w-[90mm] h-[60mm] bg-white border border-black p-8 flex flex-col justify-center shadow-lg print:shadow-none print:mb-0 print:break-inside-avoid print:page-break-after-always" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
                        <div className="space-y-1 text-[18px] leading-tight text-black">
                            {/* Product Name - BOLD, Wrapping to the left */}
                            <div className="mb-1 overflow-hidden min-h-[2.4em] leading-tight">
                                <span className="font-bold">Tên: </span>
                                <span className="font-bold uppercase tracking-tight">{label.products?.name}</span>
                            </div>
                            
                            {/* SKU / Product Code */}
                            <div className="flex gap-2">
                                <span className="font-bold whitespace-nowrap">Mã:</span>
                                <span>{label.products?.sku}</span>
                            </div>

                            {/* Lot Code + STT */}
                            <div className="flex gap-2">
                                <span className="font-bold whitespace-nowrap">Lot:</span>
                                <span className="font-bold">
                                    {printConfig.lot_override || label.final_lot_code}
                                    {label.daily_seq ? `-${label.daily_seq}` : ''}
                                </span>
                            </div>

                            {/* Customer */}
                            <div className="flex gap-2">
                                <span className="font-bold whitespace-nowrap">KH:</span>
                                <span>{printConfig.customer || '---'}</span>
                            </div>

                            {/* Net Weight */}
                            <div className="flex gap-2">
                                <span className="font-bold whitespace-nowrap">KLT:</span>
                                <span>{printConfig.net_weight || (label.quantity + ' ' + label.unit)}</span>
                            </div>

                            {/* Production Date (NSX) */}
                            <div className="flex gap-2">
                                <span className="font-bold whitespace-nowrap">NSX:</span>
                                <span>{printConfig.nsx ? new Date(printConfig.nsx).toLocaleDateString('vi-VN') : '---'}</span>
                            </div>

                            {/* Packing Date (NĐG) - MUST BE EXACT FROM LOT */}
                            <div className="flex gap-2">
                                <span className="font-bold whitespace-nowrap">NĐG:</span>
                                <span>{label.final_inbound_date ? new Date(label.final_inbound_date).toLocaleDateString('vi-VN') : '---'}</span>
                            </div>

                            {/* Notes if any */}
                            {printConfig.notes && (
                                <div className="absolute bottom-2 left-8 text-[12px] italic text-stone-500">
                                    {printConfig.notes}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

