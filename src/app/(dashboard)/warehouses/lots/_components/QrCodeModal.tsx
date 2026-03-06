import { X, Printer, Copy, Check, Cloud } from 'lucide-react'
import QRCode from "react-qr-code"
import { useState } from 'react'
import { Lot } from '../_hooks/useLotManagement'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { supabase } from '@/lib/supabaseClient'

interface QrCodeModalProps {
    lot: Lot
    onClose: () => void
}

export function QrCodeModal({ lot, onClose }: QrCodeModalProps) {
    const { showToast } = useToast()
    const [copied, setCopied] = useState(false)
    const [isPrinting, setIsPrinting] = useState(false)
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

            // Check if there is already a pending job for this lot in this system
            const { data: existingJobs } = await (supabase as any).from('print_queue')
                .select('id')
                .eq('lot_id', lot.id)
                .eq('system_id', currentSystem?.id)
                .eq('status', 'pending')
                .limit(1)

            if (existingJobs && existingJobs.length > 0) {
                showToast("Mã LOT này đã có trong hàng đợi in rồi ạ!", 'info')
                return
            }

            const printData = {
                lot_code: lot.code,
                scan_url: scanUrl,
                company_prefix: companyPrefix,
                supplier: lot.suppliers?.name || 'N/A',
                products: lot.lot_items?.map(item => ({
                    name: item.products?.name || 'SP',
                    internal_name: item.products?.internal_name || '',
                    sku: item.products?.sku || '',
                    internal_code: item.products?.internal_code || '',
                    quantity: item.quantity,
                    unit: item.unit || item.products?.unit || ''
                })) || [],
                packaging_date: lot.packaging_date,
                positions: lot.positions?.map(p => p.code) || []
            }

            const { error } = await (supabase as any).from('print_queue')
                .insert({
                    lot_id: lot.id,
                    lot_code: lot.code,
                    print_data: printData,
                    company_id: lot.company_id,
                    system_id: currentSystem?.id,
                    status: 'pending'
                })

            if (error) throw error

            showToast("Đã gửi lệnh in đến trạm in từ xa", 'success')
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
