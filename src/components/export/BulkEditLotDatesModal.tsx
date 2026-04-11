'use client'

import React, { useState } from 'react'
import { X, Calendar, Loader2, Save, AlertCircle, Info } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { logActivity } from '@/lib/audit'
import { format } from 'date-fns'
import { Database } from '@/lib/database.types'

type LotRow = Database['public']['Tables']['lots']['Row']

interface BulkEditLotDatesModalProps {
    lotIds: string[]
    lotCodes: string[]
    onClose: () => void
    onSuccess: () => void
}

export const BulkEditLotDatesModal: React.FC<BulkEditLotDatesModalProps> = ({
    lotIds,
    lotCodes,
    onClose,
    onSuccess
}) => {
    const { currentSystem } = useSystem()
    const { showToast } = useToast()
    const [loading, setLoading] = useState(false)
    const [inboundDate, setInboundDate] = useState<string>('')
    const [peelingDate, setPeelingDate] = useState<string>('')

    const handleSave = async () => {
        if (!inboundDate && !peelingDate) {
            showToast('Vui lòng chọn ít nhất một ngày để cập nhật', 'warning')
            return
        }

        setLoading(true)
        try {
            const updatePayload: Record<string, any> = {}
            if (inboundDate) updatePayload.inbound_date = inboundDate
            if (peelingDate) updatePayload.peeling_date = peelingDate

            // Lấy dữ liệu cũ để log hoạt động
            const { data: oldLots, error: fetchError } = await (supabase
                .from('lots')
                .select('id, inbound_date, peeling_date, code, system_code')
                .in('id', lotIds) as any)

            if (fetchError) throw fetchError

            const lotsList = (oldLots as any[]) || []

            // Cập nhật từng lô hàng để đảm bảo log activity chính xác và tuân thủ system_code
            const updatePromises = lotIds.map(async (id) => {
                const oldLot = lotsList.find(l => l.id === id)
                
                const { error: updateError } = await (supabase
                    .from('lots' as any)
                    .update(updatePayload as any)
                    .eq('id', id)
                    .eq('system_code', currentSystem?.code || '') as any)

                if (updateError) throw updateError

                // Log activity
                await logActivity({
                    supabase: supabase as any,
                    tableName: 'lots',
                    recordId: id,
                    action: 'UPDATE',
                    oldData: {
                        inbound_date: oldLot?.inbound_date,
                        peeling_date: oldLot?.peeling_date
                    },
                    newData: updatePayload,
                    systemCode: currentSystem?.code
                })
            })

            await Promise.all(updatePromises)

            showToast(`Đã cập nhật ngày cho ${lotIds.length} lô hàng thành công`, 'success')
            onSuccess()
        } catch (error: any) {
            console.error('Error updating lot dates:', error)
            showToast('Lỗi khi cập nhật ngày: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] max-w-md w-full shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 pb-4 flex items-start justify-between border-b border-stone-100 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                            <Calendar size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-stone-900 dark:text-white">
                                Chỉnh sửa ngày LOT
                            </h3>
                            <p className="text-xs text-stone-500 mt-1">
                                Cập nhật ngày cho <span className="font-bold text-blue-600">{lotIds.length}</span> lô hàng đã chọn
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X size={20} className="text-stone-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 p-4 rounded-2xl flex gap-3">
                        <Info className="text-amber-600 shrink-0" size={20} />
                        <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                            Lưu ý: Thay đổi này sẽ ảnh hưởng trực tiếp đến dữ liệu gốc của LOT và xuất hiện trên tất cả các phiếu in liên quan.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">
                                Ngày nhập kho (Inbound Date)
                            </label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={inboundDate}
                                    onChange={(e) => setInboundDate(e.target.value)}
                                    className="w-full p-3.5 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-sm"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">
                                Ngày sản xuất/xử lý (Production/Peeling Date)
                            </label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={peelingDate}
                                    onChange={(e) => setPeelingDate(e.target.value)}
                                    className="w-full p-3.5 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Quick list of lot codes */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">
                            Các lô hàng bị ảnh hưởng
                        </label>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
                            {lotCodes.map((code, idx) => (
                                <span key={idx} className="px-2 py-1 bg-stone-100 dark:bg-zinc-800 text-[10px] font-bold text-stone-600 dark:text-zinc-400 rounded-lg border border-stone-200 dark:border-zinc-700 font-mono">
                                    {code}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-stone-50 dark:bg-zinc-800/50 border-t border-stone-100 dark:border-zinc-800 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all active:scale-95 flex items-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Đang cập nhật...
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                Lưu thay đổi
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
