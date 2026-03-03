'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Save, MapPin } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { Lot } from '@/app/(dashboard)/warehouses/lots/_hooks/useLotManagement'
import { useSystem } from '@/contexts/SystemContext'

interface LotAssignPositionModalProps {
    lot: Lot
    onClose: () => void
    onSuccess: () => void
}

export function LotAssignPositionModal({ lot, onClose, onSuccess }: LotAssignPositionModalProps) {
    const { showToast } = useToast()
    const { currentSystem } = useSystem()
    const [loading, setLoading] = useState(false)
    const [code, setCode] = useState('')

    // Auto-focus input
    const inputRef = useRef<HTMLInputElement>(null)
    useEffect(() => {
        if (inputRef.current) inputRef.current.focus()
    }, [])

    const handleAssign = async (e: React.FormEvent) => {
        e.preventDefault()
        const targetCode = code.trim().toUpperCase()
        if (!targetCode) {
            showToast('Chưa nhập mã vị trí', 'error')
            return
        }

        setLoading(true)

        try {
            // Check if position exists
            const { data: posData, error: posError } = await supabase
                .from('positions')
                .select('id, lot_id, code')
                .eq('code', targetCode)
                .single()

            if (posError || !posData) {
                showToast(`Không tìm thấy ô vị trí: ${targetCode}`, 'error')
                return
            }

            if (posData.lot_id && posData.lot_id !== lot.id) {
                showToast(`Ô vị trí ${targetCode} đã được gán cho một LOT khác`, 'error')
                return
            }

            // Unassign current positions
            await supabase
                .from('positions')
                .update({ lot_id: null })
                .eq('lot_id', lot.id)

            // Assign new position
            const { error: assignError } = await supabase
                .from('positions')
                .update({ lot_id: lot.id })
                .eq('id', posData.id)

            if (assignError) {
                throw assignError
            }

            // Log history
            // Log history
            const historyObj = {
                system_code: currentSystem?.code ?? null,
                action_type: 'assign_position',
                entity_type: 'lot',
                entity_id: lot.id,
                details: {
                    position_code: targetCode,
                    position_id: posData.id
                }
            } as any;

            await (supabase as any).from('operation_history').insert(historyObj);

            showToast(`Gán thành công vào ô ${targetCode}!`, 'success')
            onSuccess()
        } catch (err: any) {
            console.error(err)
            showToast('Lỗi khi gán vị trí: ' + err.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <MapPin size={20} className="text-orange-500" />
                        Gán mã vị trí
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleAssign} className="p-4 space-y-4">
                    <div>
                        <div className="text-xs text-slate-500 font-medium mb-1 uppercase tracking-wider">Lot đang chọn</div>
                        <div className="font-mono text-sm font-bold bg-slate-100 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                            {lot.code}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-slate-500 font-medium mb-1 uppercase tracking-wider block">Mã vị trí (Ô/Kệ)</label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="Nhập mã vị trí (VD: A-1-1)"
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 font-mono"
                            required
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2 ${loading ? 'opacity-75 cursor-wait' : ''}`}
                        >
                            <Save size={16} />
                            {loading ? 'Đang lưu...' : 'Lưu vị trí'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
