import { X, Printer, Copy, Check, Cloud, Minus, Plus } from 'lucide-react'
import QRCode from "react-qr-code"
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Lot } from '../_hooks/useLotManagement'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { supabase } from '@/lib/supabaseClient'
import { LotLabel } from '@/components/warehouse/lots/LotLabel'


interface QrCodeModalProps {
    lot: Lot
    onClose: () => void
    workArea?: { id: string; name: string } | null
}

export function QrCodeModal({ lot, onClose, workArea }: QrCodeModalProps) {
    const { showToast } = useToast()
    const [copied, setCopied] = useState(false)
    const [isPrinting, setIsPrinting] = useState(false)
    const [printQuantity, setPrintQuantity] = useState(1)
    const { profile } = useUser()
    const { hasModule, currentSystem } = useSystem()
    const showInternal = hasModule('internal_products')

    // Generate structured content for QR
    const qrLines = [
        `Mã LOT: ${lot.code}`,
        `NCC: ${lot.suppliers?.name || 'N/A'}`
    ]

    // Products
    if (lot.lot_items && lot.lot_items.length > 0) {
        const productInfo = lot.lot_items.map(item => {
            const name = showInternal && item.products?.internal_name ? item.products.internal_name : (item.products?.name || 'SP')
            return `${name} (${item.quantity} ${item.unit || item.products?.unit || ''})`
        }).join(', ')
        qrLines.push(`Sản phẩm: ${productInfo}`)
    }

    // Date
    if (lot.packaging_date) {
        qrLines.push(`Ngày: ${new Date(lot.packaging_date).toLocaleDateString('vi-VN')}`)
    }

    // Positions
    if (lot.positions && lot.positions.length > 0) {
        const posInfo = lot.positions.map(p => p.code).join(', ')
        qrLines.push(`Vị trí: ${posInfo}`)
    }

    const qrValue = qrLines.join('\n')
    const scanUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/public/trace/${lot.code}${lot.company_id ? `?c=${lot.company_id}` : ''}`

    const handleCopy = () => {
        navigator.clipboard.writeText(scanUrl)
        setCopied(true)
        showToast("Đã sao chép liên kết QR", 'success')
        setTimeout(() => setCopied(false), 2000)
    }

    const handleRemotePrint = async () => {
        if (isPrinting) return
        setIsPrinting(true)

        try {
            // Fetch company short name
            let companyPrefix = ''
            if (profile?.company_id) {
                const { data: settingsData } = await (supabase as any)
                    .from('company_settings')
                    .select('short_name')
                    .eq('id', profile.company_id)
                    .single()

                if (settingsData?.short_name) {
                    // Normalize to English (remove accents)
                    companyPrefix = settingsData.short_name
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .replace(/đ/g, 'd')
                        .replace(/Đ/g, 'D')
                        .toUpperCase()
                } else {
                    // Fallback to username_prefix or code
                    const { data: companyData } = await (supabase as any)
                        .from('companies')
                        .select('code, username_prefix')
                        .eq('id', profile.company_id)
                        .single()

                    if (companyData) {
                        companyPrefix = (companyData.username_prefix || companyData.code || '').toUpperCase()
                    }
                }
            }

            const printData = {
                lot_code: lot.code,
                production_code: (lot as any).production_code || '',
                scan_url: scanUrl,
                company_prefix: companyPrefix,
                supplier: lot.suppliers?.name || 'N/A',
                work_area_name: workArea?.name || '',
                label_quantity: printQuantity,
                products: lot.lot_items?.map(item => ({
                    name: (showInternal && item.products?.internal_name) || item.products?.name || 'SP',
                    internal_name: item.products?.internal_name || '',
                    sku: (showInternal && item.products?.internal_code) || item.products?.sku || '',
                    internal_code: item.products?.internal_code || '',
                    quantity: item.quantity,
                    unit: item.unit || item.products?.unit || '',
                    tags: lot.lot_tags?.filter(t => t.lot_item_id === item.id).map(t => t.tag) || []
                })) || [],
                packaging_date: lot.packaging_date,
                positions: lot.positions?.map(p => p.code) || []
            }

            console.log('Sending print data:', printData)

            const { error } = await (supabase as any).from('print_queue')
                .insert({
                    lot_id: lot.id,
                    lot_code: lot.code,
                    print_data: printData,
                    company_id: lot.company_id,
                    system_id: currentSystem?.id,
                    work_area_id: workArea?.id || null,
                    status: 'pending'
                })

            if (error) throw error

            showToast(`Đã gửi lệnh in (${printQuantity} tem) đến trạm in từ xa`, 'success')
        } catch (error: any) {
            console.error('Remote print error:', error)
            showToast(`Lỗi in từ xa: ${error.message || 'Không xác định'}`, 'error')
        } finally {
            setIsPrinting(false)
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
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

            {/* Print Container content defined here but rendered via Portal if in browser */}
            {typeof document !== 'undefined' && createPortal(
                <div id="print-label-container" className="hidden print:block bg-white text-black">
                    {Array.from({ length: printQuantity }).map((_, i) => (
                        <div key={i} className="print-page bg-white overflow-hidden p-0 m-0">
                            <LotLabel
                                data={{
                                    lot_code: lot.code,
                                    production_code: (lot as any).production_code || '',
                                    scan_url: scanUrl,
                                    company_prefix: 'TOAN THANG',
                                    company_full_name: 'CHANH THU GROUP',
                                    product_name: (showInternal && lot.lot_items?.[0]?.products?.internal_name) || lot.lot_items?.[0]?.products?.name || 'SP',
                                    quantity: lot.lot_items?.[0]?.quantity,
                                    unit: lot.lot_items?.[0]?.unit || lot.lot_items?.[0]?.products?.unit || '',
                                    positions: lot.positions?.map(p => p.code) || [],
                                    products: lot.lot_items?.map(item => ({
                                        name: (showInternal && item.products?.internal_name) || item.products?.name || 'SP',
                                        sku: (showInternal && item.products?.internal_code) || item.products?.sku || '',
                                        quantity: item.quantity,
                                        unit: item.unit || item.products?.unit || '',
                                        tags: lot.lot_tags?.filter(t => t.lot_item_id === item.id).map(t => t.tag) || []
                                    })) || [],
                                }}
                                showBorder={false}
                                qrOnly={true}
                            />
                        </div>
                    ))}
                </div>,
                document.body
            )}

            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full max-h-[90vh] flex flex-col shadow-2xl scale-100 animate-in zoom-in-95 duration-200 border border-zinc-200 dark:border-zinc-800 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-600 transition-colors shadow-sm"
                >
                    <X size={20} />
                </button>

                <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-6">
                    <div className="text-center space-y-1 pt-2">
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                            Mã QR LOT
                        </h3>
                        <p className="text-sm text-zinc-500 font-mono">
                            {lot.code}
                        </p>
                    </div>

                    <div className="flex justify-center">
                        <div className="p-4 bg-white rounded-2xl shadow-inner border border-zinc-100">
                            <QRCode
                                value={scanUrl}
                                size={180}
                                className="h-auto w-full max-w-[180px]"
                            />
                        </div>
                    </div>

                    {/* Quantity Selector */}
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800/50">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3 text-center">
                            Số lượng tem cần in
                        </p>
                        <div className="flex items-center justify-center gap-6">
                            <button
                                onClick={() => setPrintQuantity(prev => Math.max(1, prev - 1))}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 shadow-sm active:scale-90 transition-transform"
                                disabled={printQuantity <= 1}
                            >
                                <Minus size={18} />
                            </button>
                            <span className="text-3xl font-black text-zinc-900 dark:text-white tabular-nums min-w-[3rem] text-center">
                                {printQuantity}
                            </span>
                            <button
                                onClick={() => setPrintQuantity(prev => prev + 1)}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 shadow-sm active:scale-90 transition-transform"
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="w-full flex flex-col gap-3">
                        <button
                            onClick={handleRemotePrint}
                            disabled={isPrinting}
                            className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-2xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 dark:shadow-none disabled:opacity-50"
                        >
                            {isPrinting ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <Cloud size={18} />
                            )}
                            In từ xa (Remote Print)
                        </button>

                        <button
                            onClick={() => window.print()}
                            className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-opacity"
                        >
                            <Printer size={18} />
                            In trực tiếp (Local)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
