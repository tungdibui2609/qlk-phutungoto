'use client'
import { useState, useEffect } from 'react'
import { X, Printer, Minus, Plus, Loader2 } from 'lucide-react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { LotLabel } from '@/components/warehouse/lots/LotLabel'

interface BulkPrintItem {
    id: string
    code: string
    productName: string
    quantity: number
    unit: string
    printQuantity: number
    positions: string[]
    fullData: any // Full lot data for LotLabel
}

interface LotBulkPrintModalProps {
    lotIds: string[]
    onClose: () => void
}

export function LotBulkPrintModal({ lotIds, onClose }: LotBulkPrintModalProps) {
    const { showToast } = useToast()
    const [loading, setLoading] = useState(true)
    const [lots, setLots] = useState<BulkPrintItem[]>([])
    const [globalQuantity, setGlobalQuantity] = useState(1)

    useEffect(() => {
        if (lotIds.length > 0) {
            fetchLotDetails()
        }
    }, [lotIds])

    async function fetchLotDetails() {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('lots')
                .select(`
                    *,
                    suppliers(name),
                    lot_items(
                        id, 
                        quantity, 
                        unit, 
                        products(name, sku, unit)
                    ),
                    positions!positions_lot_id_fkey(code),
                    lot_tags(tag, lot_item_id)
                `)
                .in('id', lotIds)

            if (error) throw error

            const items: BulkPrintItem[] = ((data || []) as any[]).map(lot => ({
                id: lot.id,
                code: lot.code,
                productName: lot.lot_items?.[0]?.products?.name || 'SP',
                quantity: lot.lot_items?.[0]?.quantity || 0,
                unit: lot.lot_items?.[0]?.unit || lot.lot_items?.[0]?.products?.unit || '',
                printQuantity: 1,
                positions: lot.positions?.map((p: any) => p.code) || [],
                fullData: lot
            }))

            setLots(items)
        } catch (error: any) {
            console.error('Error fetching lot details for bulk print:', error)
            showToast('Không thể tải chi tiết LOT: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    const updatePrintQuantity = (id: string, delta: number) => {
        setLots(prev => prev.map(lot => {
            if (lot.id === id) {
                return { ...lot, printQuantity: Math.max(0, lot.printQuantity + delta) }
            }
            return lot
        }))
    }

    const applyGlobalQuantity = () => {
        setLots(prev => prev.map(lot => ({ ...lot, printQuantity: globalQuantity })))
        showToast(`Đã áp dụng số lượng ${globalQuantity} cho tất cả LOT`, 'success')
    }

    const handlePrint = () => {
        const totalToPrint = lots.reduce((sum, lot) => sum + lot.printQuantity, 0)
        if (totalToPrint === 0) {
            showToast('Vui lòng chọn ít nhất 1 tem để in', 'warning')
            return
        }
        
        // Use window.print() triggered by the component being visible in @media print
        setTimeout(() => {
            window.print()
        }, 100)
    }

    // Calculate total pages for preview
    const totalPages = lots.reduce((sum, lot) => sum + lot.printQuantity, 0)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            {/* Print Container content defined here but rendered via Portal if in browser */}
            {typeof document !== 'undefined' && createPortal(
                <div id="print-label-container" className="hidden print:block bg-white text-black">
                    {lots.map(lot => (
                        Array.from({ length: lot.printQuantity }).map((_, i) => (
                            <div key={`${lot.id}-${i}`} className="print-page bg-white overflow-hidden p-0 m-0">
                                <LotLabel
                                    data={{
                                        lot_code: lot.code,
                                        scan_url: `${window.location.origin}/public/trace/${lot.code}${lot.fullData.company_id ? `?c=${lot.fullData.company_id}` : ''}`,
                                        company_prefix: 'TOAN THANG',
                                        product_name: lot.productName,
                                        quantity: lot.quantity,
                                        unit: lot.unit,
                                        positions: lot.positions,
                                        products: lot.fullData.lot_items?.map((item: any) => ({
                                            name: item.products?.name || 'SP',
                                            sku: item.products?.sku || '',
                                            quantity: item.quantity,
                                            unit: item.unit || item.products?.unit || '',
                                            tags: lot.fullData.lot_tags?.filter((t: any) => t.lot_item_id === item.id).map((t: any) => t.tag) || []
                                        })) || [],
                                    }}
                                    showBorder={false}
                                    qrOnly={true}
                                />
                            </div>
                        ))
                    ))}
                </div>,
                document.body
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    /* Definitively hide everything that is a direct child of body except our container */
                    body > *:not(#print-label-container) { 
                        display: none !important; 
                    }
                    
                    /* Reset body/html for the printer */
                    html, body { 
                        margin: 0 !important; 
                        padding: 0 !important; 
                        height: auto !important;
                        background: white !important;
                        overflow: visible !important;
                    }
                    
                    #print-label-container { 
                        display: block !important;
                        position: absolute !important; 
                        left: 0 !important; 
                        top: 0 !important; 
                        width: 3.54in !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                    }
                    
                    #print-label-container * { 
                        visibility: visible !important; 
                    }
                    
                    .print-page { 
                        width: 3.54in !important; 
                        height: 2.36in !important; 
                        page-break-after: always !important; 
                        break-after: page !important;
                        display: block !important;
                        position: relative !important;
                        overflow: hidden !important;
                        background: white !important;
                    }
                    
                    .print-page:last-child {
                        page-break-after: avoid !important;
                        break-after: avoid !important;
                    }
                    @page { margin: 0; size: 3.54in 2.36in; }
                }
            ` }} />

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh]">
                <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <Printer size={20} className="text-emerald-500" />
                            In mã QR hàng loạt
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">Đã chọn {lotIds.length} LOT • Tổng cộng {totalPages} tem</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="animate-spin text-emerald-500" size={32} />
                        <p className="text-sm font-medium text-slate-500">Đang tải chi tiết LOT...</p>
                    </div>
                ) : (
                    <>
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-emerald-800 dark:text-emerald-400">Áp dụng cho tất cả:</span>
                                <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg border border-emerald-200 dark:border-emerald-800 p-1">
                                    <button
                                        onClick={() => setGlobalQuantity(Math.max(1, globalQuantity - 1))}
                                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
                                    >
                                        <Minus size={14} />
                                    </button>
                                    <input
                                        type="number"
                                        value={globalQuantity}
                                        onChange={(e) => setGlobalQuantity(parseInt(e.target.value) || 1)}
                                        className="w-10 text-center text-sm font-bold bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <button
                                        onClick={() => setGlobalQuantity(globalQuantity + 1)}
                                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={applyGlobalQuantity}
                                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-sm"
                            >
                                Áp dụng
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {lots.map(lot => (
                                <div key={lot.id} className="group flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/50 hover:border-emerald-200 dark:hover:border-emerald-800 transition-all shadow-sm">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-emerald-500 transition-colors">
                                            <Printer size={18} />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate uppercase tracking-tight">
                                                {lot.code}
                                            </h4>
                                            <p className="text-[10px] text-slate-500 truncate font-medium">
                                                {lot.productName} • {lot.quantity} {lot.unit}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {lot.positions.length > 0 && (
                                            <div className="hidden sm:flex flex-wrap gap-1 justify-end max-w-[120px]">
                                                {lot.positions.map(p => (
                                                    <span key={p} className="text-[9px] font-black bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-800">
                                                        {p}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        
                                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 min-w-[100px]">
                                            <button
                                                onClick={() => updatePrintQuantity(lot.id, -1)}
                                                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white dark:hover:bg-slate-700 text-slate-500 shadow-sm transition-all"
                                            >
                                                <Minus size={14} />
                                            </button>
                                            <input
                                                type="number"
                                                value={lot.printQuantity}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 0
                                                    setLots(prev => prev.map(l => l.id === lot.id ? { ...l, printQuantity: Math.max(0, val) } : l))
                                                }}
                                                className="w-10 text-center text-sm font-black bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                            <button
                                                onClick={() => updatePrintQuantity(lot.id, 1)}
                                                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white dark:hover:bg-slate-700 text-slate-500 shadow-sm transition-all"
                                            >
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                            <button
                                onClick={onClose}
                                className="px-6 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 font-bold transition-all active:scale-95"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                onClick={handlePrint}
                                disabled={totalPages === 0}
                                className="px-8 py-2.5 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-xl font-black shadow-lg shadow-slate-500/20 hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-50 disabled:scale-100 flex items-center gap-2"
                            >
                                <Printer size={18} />
                                Thực hiện in ({totalPages} tem)
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
