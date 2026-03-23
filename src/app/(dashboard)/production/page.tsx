'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Factory, Search } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import { useListingData } from '@/hooks/useListingData'
import ProductionTable from './_components/ProductionTable'
import ProductionModal from './_components/ProductionModal'

export default function ProductionPage() {
    const { showToast, showConfirm } = useToast()
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<any>(null)
    const [isReadOnly, setIsReadOnly] = useState(false)
    const [actualStats, setActualStats] = useState<Record<string, { actual: number, by_unit: any[] }>>({}) // production_lot_id -> stats

    const {
        filteredData: productions,
        loading,
        searchTerm,
        setSearchTerm,
        refresh,
        data: allData
    } = useListingData<any>('productions', {
        orderBy: { column: 'code', ascending: false },
        includeSystemCode: false,
        select: '*, customers(name), production_lots(*, products(name, sku, unit))'
    })

    const enhancedRefresh = () => {
        refresh()
    }

    // Fetch actual quantities from view whenever productions or refresh changes
    useEffect(() => {
        const fetchStats = async () => {
            if (productions.length === 0) return
            
            const lotIds = productions.flatMap(p => (p as any).production_lots?.map((l: any) => l.id) || [])
            if (lotIds.length === 0) {
                setActualStats({})
                return
            }

            const { data, error } = await supabase
                .from('production_item_statistics' as any)
                .select('production_lot_id, actual_quantity, quantity_by_unit')
                .in('production_lot_id', lotIds)
            
            if (data) {
                const map: Record<string, { actual: number, by_unit: any[] }> = {}
                data.forEach((item: any) => {
                    map[item.production_lot_id] = {
                        actual: item.actual_quantity,
                        by_unit: item.quantity_by_unit || []
                    }
                })
                setActualStats(map)
            }
        }
        fetchStats()
    }, [productions])

    // Map stats into productions for display
    const productionsWithStats = productions.map(p => ({
        ...p,
        production_lots: (p as any).production_lots?.map((l: any) => ({
            ...l,
            actual_quantity: actualStats[l.id]?.actual || 0,
            quantity_by_unit: actualStats[l.id]?.by_unit || []
        }))
    }))

    const handleAdd = () => {
        setEditingItem(null)
        setIsReadOnly(false)
        setIsModalOpen(true)
    }

    const handleEdit = (item: any) => {
        setEditingItem(item)
        setIsReadOnly(false)
        setIsModalOpen(true)
    }

    const handleView = (item: any) => {
        setEditingItem(item)
        setIsReadOnly(true)
        setIsModalOpen(true)
    }

    async function handleDelete(id: string) {
        if (!await showConfirm('Bạn có chắc muốn xóa lệnh sản xuất này?')) return

        const { error } = await (supabase as any).from('productions').delete().eq('id', id)
        if (error) {
            showToast('Lỗi: ' + error.message, 'error')
        } else {
            showToast('Đã xóa thành công', 'success')
            enhancedRefresh()
        }
    }

    async function handleStatusToggle(id: string, currentStatus: string) {
        const nextStatus = currentStatus === 'DONE' ? 'IN_PROGRESS' : 'DONE'
        const { error } = await (supabase as any)
            .from('productions')
            .update({ status: nextStatus, updated_at: new Date().toISOString() })
            .eq('id', id)
        
        if (error) {
            showToast('Lỗi: ' + error.message, 'error')
        } else {
            showToast(`Đã chuyển sang ${nextStatus === 'DONE' ? 'Hoàn thành' : 'Đang làm'}`, 'success')
            enhancedRefresh()
        }
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Sản xuất"
                subtitle="Production Management"
                description="Quản lý thông tin và đợt sản xuất dùng chung cho hệ thống"
                icon={Factory}
                actionText="Tạo lệnh mới"
                onActionClick={handleAdd}
                permission="warehouse.manage"
            />

            {/* FILTERS */}
            <div className="bg-white dark:bg-zinc-900 rounded-[24px] p-5 border border-stone-200 dark:border-zinc-800 flex flex-col md:flex-row flex-wrap gap-4 md:items-center shadow-sm">
                <div className="relative flex-1 w-full md:min-w-[300px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                    <input
                        type="text"
                        placeholder="Tìm theo mã, tên, mô tả..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-800 dark:text-gray-200 placeholder:text-stone-400 focus:outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100 transition-all font-medium"
                    />
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-stone-100 dark:bg-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-stone-400">
                    {productions.length} / {allData.length} Lệnh sản xuất
                </div>
            </div>

            {/* CONTENT */}
            {loading ? (
                <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-stone-200 dark:border-zinc-800 p-20 text-center shadow-sm">
                    <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-stone-500 font-bold uppercase tracking-widest text-xs">Đang tải dữ liệu...</p>
                </div>
            ) : productions.length === 0 ? (
                <EmptyState
                    icon={Factory}
                    title="Chưa có lệnh sản xuất nào"
                    description={searchTerm ? `Không tìm thấy kết quả nào khớp với "${searchTerm}"` : "Hãy bắt đầu bằng cách tạo lệnh sản xuất đầu tiên để gắn vào công việc."}
                />
            ) : (
                <ProductionTable 
                    data={productionsWithStats} 
                    onEdit={handleEdit} 
                    onDelete={handleDelete} 
                    onStatusToggle={handleStatusToggle}
                    onView={handleView}
                />
            )}

            <ProductionModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSuccess={enhancedRefresh} 
                editItem={editingItem}
                readOnly={isReadOnly}
            />
        </div>
    )
}
