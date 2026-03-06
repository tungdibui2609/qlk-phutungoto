'use client'

import { useState, useEffect } from 'react'
import { X, Save, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { useToast } from '@/components/ui/ToastProvider'
import { WorkArea, WorkAreaInsert } from '../../app/(dashboard)/work-areas/types'

type WorkAreaModalProps = {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    initialData?: WorkArea | null
}

export default function WorkAreaModal({ isOpen, onClose, onSuccess, initialData }: WorkAreaModalProps) {
    const { currentSystem } = useSystem()
    const { profile } = useUser()
    const { showToast } = useToast()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [formData, setFormData] = useState<Partial<WorkAreaInsert>>({
        name: '',
        code: '',
        description: '',
        is_active: true
    })

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name,
                code: initialData.code || '',
                description: initialData.description || '',
                is_active: initialData.is_active
            })
        } else {
            setFormData({
                name: '',
                code: '',
                description: '',
                is_active: true
            })
        }
    }, [initialData, isOpen])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!currentSystem?.code) return

        setLoading(true)
        setError(null)

        try {
            if (initialData) {
                const { error: updateError } = await (supabase
                    .from('work_areas' as any) as any)
                    .update({
                        ...formData,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', initialData.id)

                if (updateError) throw updateError
                showToast('Cập nhật khu vực thành công', 'success')
            } else {
                const { error: insertError } = await (supabase
                    .from('work_areas' as any) as any)
                    .insert({
                        ...formData,
                        system_code: currentSystem.code,
                        company_id: profile?.company_id
                    } as any)

                if (insertError) throw insertError
                showToast('Thêm khu vực mới thành công', 'success')
            }
            onSuccess()
        } catch (err: any) {
            console.error('WorkArea error:', err)
            setError(err.message || 'Có lỗi xảy ra, vui lòng thử lại')
            showToast('Lỗi: ' + (err.message || 'Không thể lưu'), 'error')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-stone-900 w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden border border-stone-200 dark:border-stone-800 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center bg-stone-50/50 dark:bg-stone-800/50">
                    <h2 className="text-lg font-black text-stone-800 dark:text-stone-100 uppercase tracking-tight">
                        {initialData ? 'Sửa Khu vực' : 'Thêm Khu vực'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full hover:bg-white dark:hover:bg-stone-700 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-all border border-transparent hover:border-stone-200 dark:hover:border-stone-600"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl flex items-center gap-2 text-red-600 dark:text-red-400 text-xs font-bold animate-in slide-in-from-top-2">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-1.5 ml-1">
                                Tên khu vực <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="VD: Khu vực A, Sân chung..."
                                className="w-full px-4 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 text-stone-800 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-blue-500 transition-all font-bold text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-1.5 ml-1">
                                Mã khu vực
                            </label>
                            <input
                                type="text"
                                value={formData.code || ''}
                                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                placeholder="VD: KV-A"
                                className="w-full px-4 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 text-stone-800 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-blue-500 transition-all font-bold text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-1.5 ml-1">
                                Mô tả
                            </label>
                            <textarea
                                value={formData.description || ''}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Thông tin chi tiết về khu vực..."
                                rows={2}
                                className="w-full px-4 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 text-stone-800 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-blue-500 transition-all font-bold text-sm resize-none"
                            />
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-stone-50 dark:bg-stone-800 rounded-xl border border-stone-100 dark:border-stone-700">
                            <input
                                type="checkbox"
                                id="is_active"
                                checked={formData.is_active}
                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                className="w-4 h-4 rounded border-2 border-stone-300 dark:border-stone-600 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="is_active" className="text-xs font-bold text-stone-700 dark:text-stone-300 cursor-pointer">
                                Đang hoạt động
                            </label>
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 rounded-xl border-2 border-stone-100 dark:border-stone-800 text-stone-500 dark:text-stone-400 font-black uppercase tracking-widest text-[10px] hover:bg-stone-100 dark:hover:bg-stone-800 transition-all"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Save size={14} />
                            )}
                            Lưu thay đổi
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
