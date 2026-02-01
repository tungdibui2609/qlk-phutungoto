import { X, Printer, Copy, Check } from 'lucide-react'
import QRCode from "react-qr-code"
import { useState } from 'react'
import { Lot } from '../_hooks/useLotManagement'
import { useToast } from '@/components/ui/ToastProvider'

interface QrCodeModalProps {
    lot: Lot
    onClose: () => void
}

export function QrCodeModal({ lot, onClose }: QrCodeModalProps) {
    const { showToast } = useToast()
    const [copied, setCopied] = useState(false)

    // Generate structured content for QR
    const qrLines = [
        `Mã LOT: ${lot.code}`,
        `NCC: ${lot.suppliers?.name || 'N/A'}`
    ]

    // Products
    if (lot.lot_items && lot.lot_items.length > 0) {
        const productInfo = lot.lot_items.map(item =>
            `${item.products?.name || 'SP'} (${item.quantity} ${item.unit || item.products?.unit || ''})`
        ).join(', ')
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

    const handleCopy = () => {
        navigator.clipboard.writeText(qrValue)
        setCopied(true)
        showToast("Đã sao chép nội dung QR", 'success')
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full shadow-2xl scale-100 animate-in zoom-in-95 duration-200 border border-zinc-200 dark:border-zinc-800 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="flex flex-col items-center space-y-6">
                    <div className="text-center space-y-1">
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                            Mã QR LOT
                        </h3>
                        <p className="text-sm text-zinc-500 font-mono">
                            {lot.code}
                        </p>
                    </div>

                    <div className="p-4 bg-white rounded-2xl shadow-inner border border-zinc-100">
                        <QRCode
                            value={qrValue}
                            size={200}
                            className="h-auto w-full max-w-[200px]"
                        />
                    </div>

                    {/* Content Preview */}
                    <div className="w-full bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-4 border border-zinc-100 dark:border-zinc-800 group relative">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Nội dung mã quét</span>
                            <button
                                onClick={handleCopy}
                                className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 transition-colors"
                                title="Sao chép nội dung"
                            >
                                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            </button>
                        </div>
                        <pre className="text-xs font-mono text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed">
                            {qrValue}
                        </pre>
                    </div>

                    <button
                        onClick={() => window.print()}
                        className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-zinc-200 dark:shadow-none"
                    >
                        <Printer size={18} />
                        In tem mã QR
                    </button>
                </div>
            </div>
        </div>
    )
}
