import { X, Printer } from 'lucide-react'
import QRCode from "react-qr-code"
import { Lot } from '../_hooks/useLotManagement'

// Define a simplified interface for the LOT object expected by this modal
// This avoids strict dependency on the full Lot type if we just need the code
interface QrCodeModalProps {
    lot: Lot
    onClose: () => void
}

export function QrCodeModal({ lot, onClose }: QrCodeModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl scale-100 animate-in zoom-in-95 duration-200 border border-zinc-200 dark:border-zinc-800 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="flex flex-col items-center text-center space-y-6">
                    <div className="space-y-1">
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                            Mã QR LOT
                        </h3>
                        <p className="text-sm text-zinc-500 font-mono">
                            {lot.code}
                        </p>
                    </div>

                    <div className="p-4 bg-white rounded-2xl shadow-inner border border-zinc-100">
                        <QRCode
                            value={lot.code}
                            size={200}
                            className="h-auto w-full max-w-[200px]"
                        />
                    </div>

                    <button
                        onClick={() => window.print()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-medium hover:opacity-90 transition-opacity"
                    >
                        <Printer size={18} />
                        In tem mã vạch
                    </button>
                </div>
            </div>
        </div>
    )
}
