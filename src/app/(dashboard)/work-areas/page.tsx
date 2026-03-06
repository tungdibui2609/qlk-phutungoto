'use client'

import { useState } from 'react'
import { MapPin, Search, Edit2, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import StatusBadge from '@/components/ui/StatusBadge'
import { useListingData } from '@/hooks/useListingData'
import WorkAreaModal from '@/components/work-areas/WorkAreaModal'
import { WorkArea } from './types'

export default function WorkAreasPage() {
    const { showToast, showConfirm } = useToast()
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingArea, setEditingArea] = useState<WorkArea | null>(null)

    const {
        filteredData: workAreas,
        loading,
        searchTerm,
        setSearchTerm,
        statusFilter,
        setStatusFilter,
        refresh
    } = useListingData<WorkArea>('work_areas', {
        orderBy: { column: 'name' }
    })

    const handleCreate = () => {
        setEditingArea(null)
        setIsModalOpen(true)
    }

    const handleEdit = (area: WorkArea) => {
        setEditingArea(area)
        setIsModalOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (!await showConfirm('Bạn có chắc muốn xóa khu vực này?')) return

        const { error } = await (supabase.from('work_areas' as any) as any).delete().eq('id', id)
        if (error) {
            showToast('Lỗi: ' + error.message, 'error')
        } else {
            showToast('Đã xóa khu vực thành công', 'success')
            refresh()
        }
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Khu vực làm việc"
                subtitle="Work Areas"
                description="Danh sách các khu vực thi công, vận hành"
                icon={MapPin}
                actionText="Thêm mới"
                onActionClick={handleCreate}
            />

            {/* Filters */}
            <div className="bg-white dark:bg-stone-900 rounded-[24px] p-5 border border-stone-200 dark:border-stone-800 flex flex-col md:flex-row flex-wrap gap-4 md:items-center shadow-sm">
                <div className="relative flex-1 w-full md:min-w-[300px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                    <input
                        type="text"
                        placeholder="Tìm theo tên, mã, mô tả..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-2xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-blue-400 transition-all font-medium"
                    />
                </div>
                <div className="flex gap-2 p-1 bg-stone-100 dark:bg-stone-800 rounded-2xl">
                    {(['all', 'active', 'inactive'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setStatusFilter(f)}
                            className={`px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${statusFilter === f
                                ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
                                }`}
                        >
                            {f === 'all' ? 'Tất cả' : f === 'active' ? 'Hoạt động' : 'Ngừng'}
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div className="bg-white dark:bg-stone-900 rounded-[32px] border border-stone-200 dark:border-stone-800 p-20 text-center shadow-sm">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-stone-500 font-bold uppercase tracking-widest text-xs">Đang tải dữ liệu...</p>
                </div>
            ) : workAreas.length === 0 ? (
                <EmptyState
                    icon={MapPin}
                    title="Chưa có khu vực nào"
                    description={searchTerm ? `Không tìm thấy kết quả nào khớp với "${searchTerm}"` : "Hãy bắt đầu bằng cách thêm khu vực làm việc đầu tiên của bạn."}
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {workAreas.map((area) => (
                        <div key={area.id} className="group bg-white dark:bg-stone-900 rounded-[32px] border border-stone-200 dark:border-stone-800 p-6 hover:shadow-xl hover:shadow-blue-500/5 transition-all relative overflow-hidden">
                            {/* Decorative gradient blur */}
                            <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />

                            <div className="flex justify-between items-start mb-6">
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                    <MapPin size={24} />
                                </div>
                                <StatusBadge isActive={area.is_active} />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-black text-stone-800 dark:text-stone-100 line-clamp-1">{area.name}</h3>
                                    {area.code && (
                                        <span className="text-[10px] font-black uppercase tracking-widest bg-stone-100 dark:bg-stone-800 text-stone-500 px-2 py-0.5 rounded-lg border border-stone-200 dark:border-stone-700">
                                            {area.code}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-stone-500 dark:text-stone-400 font-medium line-clamp-2 min-h-[40px]">
                                    {area.description || 'Chưa có mô tả chi tiết cho khu vực này.'}
                                </p>
                            </div>

                            <div className="mt-8 pt-6 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                                    Cập nhật: {new Date(area.updated_at).toLocaleDateString('vi-VN')}
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEdit(area)}
                                        className="p-2.5 rounded-xl text-stone-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/40 border border-transparent hover:border-blue-100 dark:hover:border-blue-900/50 transition-all"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(area.id)}
                                        className="p-2.5 rounded-xl text-stone-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/40 border border-transparent hover:border-red-100 dark:hover:border-red-900/50 transition-all"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <WorkAreaModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => {
                    setIsModalOpen(false)
                    refresh()
                }}
                initialData={editingArea}
            />
        </div>
    )
}
