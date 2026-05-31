'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { Plus, Trash2, Layers, Sparkles, Loader2, RefreshCw, ClipboardList } from 'lucide-react'

interface SemiFinishedLot {
    id: string
    code: string
    created_at: string
    status: string | null
}

export default function SemiFinishedLotsPage() {
    const { showToast } = useToast()
    const { currentSystem } = useSystem()
    const { profile } = useUser()

    // States
    const [newLotCode, setNewLotCode] = useState('')
    const [lots, setLots] = useState<SemiFinishedLot[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    // Load danh sách lô bán thành phẩm
    const fetchLots = async () => {
        if (!currentSystem?.code) return
        setIsLoading(true)
        try {
            const { data, error } = await supabase
                .from('production_custom_lots')
                .select('id, code, created_at, status')
                .eq('system_code', currentSystem.code)
                .eq('lot_type', 'semi_finished')
                .neq('status', 'hidden')
                .order('created_at', { ascending: false })

            if (error) {
                if (error.code === '42P01' || error.message?.includes('relation "production_custom_lots" does not exist')) {
                    throw new Error('TABLE_NOT_EXIST')
                }
                throw error
            }
            setLots(data || [])
        } catch (err: any) {
            if (err.message === 'TABLE_NOT_EXIST') {
                const localLots = localStorage.getItem(`local_custom_semi_finished_lots_${currentSystem.code}`)
                setLots(localLots ? JSON.parse(localLots) : [])
                showToast('Hệ thống đang chạy chế độ tạm thời. Hãy chạy script SQL Migration để lưu trữ trên Database vĩnh viễn!', 'warning')
            } else {
                console.error('Lỗi khi tải danh sách LOT:', err)
                showToast('Không thể tải danh sách lô: ' + err.message, 'error')
            }
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchLots()
    }, [currentSystem?.code])

    // Xử lý tạo mới lô bán thành phẩm
    const handleCreateLot = async (e: React.FormEvent) => {
        e.preventDefault()
        const cleanCode = newLotCode.trim().toUpperCase()

        if (!cleanCode) {
            showToast('Vui lòng điền mã lô bán thành phẩm!', 'warning')
            return
        }

        if (!currentSystem?.code) {
            showToast('Không tìm thấy thông tin phân hệ kho hiện tại!', 'error')
            return
        }

        // Kiểm tra xem mã lô đã tồn tại chưa
        const isDuplicate = lots.some(l => l.code === cleanCode)
        if (isDuplicate) {
            showToast(`Mã lô ${cleanCode} đã tồn tại trong danh sách!`, 'warning')
            return
        }

        setIsSaving(true)
        try {
            const { data, error } = await supabase
                .from('production_custom_lots')
                .insert({
                    code: cleanCode,
                    lot_type: 'semi_finished',
                    status: 'active',
                    system_code: currentSystem.code,
                    company_id: profile?.company_id || null
                })
                .select()

            if (error) {
                if (error.code === '42P01' || error.message?.includes('relation "production_custom_lots" does not exist')) {
                    throw new Error('TABLE_NOT_EXIST')
                }
                throw error
            }

            showToast(`Đã tạo thành công lô bán thành phẩm: ${cleanCode}`, 'success')
            setNewLotCode('')
            fetchLots() // Refresh list
        } catch (err: any) {
            if (err.message === 'TABLE_NOT_EXIST') {
                const localKey = `local_custom_semi_finished_lots_${currentSystem.code}`
                const localLots = localStorage.getItem(localKey)
                const currentLocal = localLots ? JSON.parse(localLots) : []
                const newLocalItem = {
                    id: 'local-' + Date.now(),
                    code: cleanCode,
                    created_at: new Date().toISOString(),
                    status: 'active'
                }
                localStorage.setItem(localKey, JSON.stringify([newLocalItem, ...currentLocal]))
                showToast(`Đã lưu tạm thời lô bán thành phẩm: ${cleanCode}`, 'success')
                setNewLotCode('')
                fetchLots()
            } else {
                console.error('Lỗi khi lưu LOT:', err)
                showToast('Lỗi khi tạo lô: ' + err.message, 'error')
            }
        } finally {
            setIsSaving(false)
        }
    }

    // Xử lý xóa lô bán thành phẩm
    const handleDeleteLot = async (id: string, code: string) => {
        if (!confirm(`Bạn có chắc chắn muốn xóa lô bán thành phẩm ${code}?`)) return

        try {
            if (id.startsWith('local-')) {
                const localKey = `local_custom_semi_finished_lots_${currentSystem?.code}`
                const localLots = localStorage.getItem(localKey)
                if (localLots) {
                    const parsed = JSON.parse(localLots) as any[]
                    const filtered = parsed.filter(l => l.id !== id)
                    localStorage.setItem(localKey, JSON.stringify(filtered))
                }
                showToast(`Đã xóa lô bán thành phẩm: ${code}`, 'success')
                fetchLots()
                return
            }

            const { error } = await supabase
                .from('production_custom_lots')
                .update({ status: 'hidden' })
                .eq('id', id)

            if (error) throw error

            showToast(`Đã xóa lô bán thành phẩm: ${code}`, 'success')
            fetchLots()
        } catch (err: any) {
            console.error('Lỗi khi xóa LOT:', err)
            showToast('Không thể xóa lô: ' + err.message, 'error')
        }
    }

    return (
        <section className="space-y-6 pb-12 font-sans text-stone-800 dark:text-stone-200">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-stone-900 dark:text-stone-100 tracking-tight flex items-center gap-2">
                        Lô bán thành phẩm
                    </h1>
                    <p className="text-stone-500 dark:text-stone-400 mt-1">
                        Khai báo nhanh các mã lô bán thành phẩm nguyên liệu để sử dụng trong in ấn và truy xuất nguồn gốc.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Cột trái: Form khai báo nhanh */}
                <form 
                    onSubmit={handleCreateLot}
                    className="lg:col-span-4 bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-stone-200 dark:border-zinc-800 shadow-sm space-y-5"
                >
                    <div className="flex items-center gap-2 border-b border-stone-100 dark:border-zinc-800 pb-3">
                        <Sparkles className="text-emerald-500 animate-pulse" size={18} />
                        <h3 className="font-bold text-stone-800 dark:text-white">Khai báo nhanh lô mới</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                                Mã lô bán thành phẩm <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={newLotCode}
                                onChange={(e) => setNewLotCode(e.target.value)}
                                placeholder="Ví dụ: LÔ-BTP-BUOI-01"
                                disabled={isSaving}
                                className="w-full px-4 py-3 rounded-2xl border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800/50 text-stone-800 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono uppercase"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSaving || !newLotCode.trim()}
                            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-emerald-600/10 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {isSaving ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <Plus size={18} />
                            )}
                            {isSaving ? 'Đang lưu...' : 'Tạo nhanh & Lưu lại'}
                        </button>
                    </div>
                </form>

                {/* Cột phải: Danh sách lô đã khai báo */}
                <div className="lg:col-span-8 bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-stone-200 dark:border-zinc-800 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-stone-100 dark:border-zinc-800 pb-3">
                        <div className="flex items-center gap-2">
                            <ClipboardList className="text-stone-500" size={18} />
                            <h3 className="font-bold text-stone-800 dark:text-white">Danh sách lô bán thành phẩm hiện tại</h3>
                        </div>
                        <button 
                            onClick={fetchLots}
                            className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-50 dark:hover:bg-zinc-800 rounded-full transition-colors"
                            title="Tải lại danh sách"
                        >
                            <RefreshCw size={14} />
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-2">
                            <Loader2 className="text-emerald-500 animate-spin" size={32} />
                            <span className="text-xs text-stone-400">Đang tải danh sách lô...</span>
                        </div>
                    ) : lots.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-stone-100 dark:border-zinc-800 text-[11px] font-black uppercase tracking-wider text-stone-400">
                                        <th className="py-3 text-left">Mã Lô Bán Thành Phẩm</th>
                                        <th className="py-3 text-left">Ngày tạo</th>
                                        <th className="py-3 text-right w-24">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                    {lots.map((lot) => (
                                        <tr key={lot.id} className="hover:bg-stone-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                                            <td className="py-3.5 font-mono font-bold text-stone-800 dark:text-stone-200 text-sm">
                                                {lot.code}
                                            </td>
                                            <td className="py-3.5 text-stone-500 text-xs">
                                                {new Date(lot.created_at).toLocaleDateString('vi-VN')} {new Date(lot.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="py-3.5 text-right">
                                                <button
                                                    onClick={() => handleDeleteLot(lot.id, lot.code)}
                                                    className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-colors cursor-pointer"
                                                    title="Xóa mã lô"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-stone-200 dark:border-zinc-800 rounded-2xl text-center space-y-3 bg-stone-50/30 dark:bg-zinc-900/30">
                            <Layers className="text-stone-300 dark:text-zinc-700" size={48} />
                            <div>
                                <h4 className="font-bold text-stone-700 dark:text-zinc-300">Chưa có lô bán thành phẩm</h4>
                                <p className="text-xs text-stone-400 dark:text-zinc-500 mt-1 max-w-sm">
                                    Sử dụng biểu mẫu bên trái để khai báo nhanh mã lô bán thành phẩm đầu tiên của bạn.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
}
