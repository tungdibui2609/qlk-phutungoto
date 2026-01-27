'use client'

import { useState } from 'react'
import { X, CheckCircle, Scale, FileText, AlertTriangle } from 'lucide-react'

interface ApproveAuditModalProps {
    isOpen: boolean
    onClose: () => void
    onApprove: (method: 'DIRECT_ADJUSTMENT' | 'ACCOUNTING_TICKET') => Promise<void>
}

export function ApproveAuditModal({ isOpen, onClose, onApprove }: ApproveAuditModalProps) {
    const [method, setMethod] = useState<'DIRECT_ADJUSTMENT' | 'ACCOUNTING_TICKET'>('ACCOUNTING_TICKET')
    const [loading, setLoading] = useState(false)

    const handleConfirm = async () => {
        setLoading(true)
        await onApprove(method)
        setLoading(false)
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-emerald-50/50 dark:bg-emerald-900/20">
                    <h3 className="font-bold text-lg text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
                        <CheckCircle size={20} />
                        Duyệt phiếu kiểm kê
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Vui lòng chọn phương thức xử lý chênh lệch tồn kho:
                    </p>

                    <div className="space-y-3">
                        {/* Option 2: Accounting Ticket (Default and Only Option for now due to Accounting Snapshot) */}
                        <label className={`
                            flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                            ${method === 'ACCOUNTING_TICKET'
                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                : 'border-slate-200 dark:border-slate-700 hover:border-emerald-200'}
                        `}>
                            <input
                                type="radio"
                                name="method"
                                className="mt-1"
                                checked={method === 'ACCOUNTING_TICKET'}
                                onChange={() => setMethod('ACCOUNTING_TICKET')}
                            />
                            <div>
                                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <FileText size={16} />
                                    Tạo phiếu Nhập/Xuất (Kế toán)
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    Hệ thống sẽ tự động tạo Phiếu Nhập (cho hàng thừa) và Phiếu Xuất (cho hàng thiếu) để cân bằng sổ sách kế toán.
                                </p>
                            </div>
                        </label>
                    </div>

                    <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded-lg border border-amber-100 flex gap-2">
                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                        Hành động này không thể hoàn tác. Số liệu tồn kho sẽ được cập nhật ngay lập tức.
                    </div>

                    <div className="pt-2 flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={loading}
                            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
                        >
                            {loading ? 'Đang xử lý...' : 'Xác nhận duyệt'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
