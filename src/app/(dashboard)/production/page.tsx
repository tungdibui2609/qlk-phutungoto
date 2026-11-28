'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Factory, Search, Plus } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import EmptyState from '@/components/ui/EmptyState'
import Protected from '@/components/auth/Protected'
import { useListingData } from '@/hooks/useListingData'
import ProductionTable from './_components/ProductionTable'
import ProductionModal from './_components/ProductionModal'

export default function ProductionPage() {
    const { showToast, showConfirm } = useToast()
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<any>(null)
    const [isReadOnly, setIsReadOnly] = useState(false)
    const [actualStats, setActualStats] = useState<Record<string, { actual: number, by_unit: any[] }>>({}) // production_lot_id -> stats
    const [statusFilter, setStatusFilter] = useState<string>('IN_PROGRESS')
    const [lotFilter, setLotFilter] = useState<string>('ACTIVE')

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
        select: '*, customers(name), input_products:input_product_id(name), production_lots(*, products(name, sku, unit))'
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
    const productionsWithStats = productions.map(p => {
        let mappedLots = (p as any).production_lots?.map((l: any) => ({
            ...l,
            actual_quantity: actualStats[l.id]?.actual || 0,
            quantity_by_unit: actualStats[l.id]?.by_unit || []
        })) || [];

        if (lotFilter === 'LOCKED') {
            mappedLots = mappedLots.filter((l: any) => l.is_locked);
        } else if (lotFilter === 'ACTIVE') {
            mappedLots = mappedLots.filter((l: any) => !l.is_locked);
        }

        return {
            ...p,
            production_lots: mappedLots
        }
    })

    const displayProductions = productionsWithStats.filter(p => {
        if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
        // Optional: Hide production if it has no lots matching the lot filter (except if ALL)
        // if (lotFilter !== 'ALL' && (!p.production_lots || p.production_lots.length === 0)) return false;
        return true
    })

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

    async function handleLotLockToggle(lotId: string, currentLocked: boolean) {
        const { error } = await (supabase as any)
            .from('production_lots')
            .update({ is_locked: !currentLocked })
            .eq('id', lotId)
        
        if (error) {
            showToast('Lỗi: ' + error.message, 'error')
        } else {
            showToast(`Đã ${!currentLocked ? 'khóa' : 'mở khóa'} mã lot thành công`, 'success')
            enhancedRefresh()
        }
    }

    return (
        <div className="space-y-3.5">
            {/* COMPACT HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-orange-200/70 dark:border-orange-900/50 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                        <Factory size={16} />
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-stone-800 dark:text-zinc-100 leading-tight">
                            Sản xuất
                        </h1>
                        <p className="text-[11px] text-stone-500 dark:text-zinc-400">
                            Quản lý lệnh và đợt sản xuất dùng chung cho hệ thống
                        </p>
                    </div>
                </div>

                <Protected permission="production.create">
                    <button
                        onClick={handleAdd}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer active:scale-[0.98]"
                    >
                        <Plus size={14} strokeWidth={2.5} />
                        Tạo lệnh mới
                    </button>
                </Protected>
            </div>

            {/* COMPACT FILTERS */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-2.5 border border-stone-200 dark:border-zinc-800 flex flex-col md:flex-row flex-wrap gap-2.5 md:items-center shadow-sm">
                <div className="relative flex-1 w-full md:min-w-[240px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" size={14} />
                    <input
                        type="text"
                        placeholder="Tìm theo mã lệnh, tên, mô tả..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-8 pl-8 pr-3 rounded-lg bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs text-stone-800 dark:text-gray-200 placeholder:text-stone-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900/30 transition-all"
                    />
                </div>

                <div className="flex gap-2.5 items-center flex-wrap">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-stone-400 hidden md:block">Lệnh:</span>
                        <div className="flex bg-stone-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-stone-200/60 dark:border-zinc-700/60">
                            <button
                                onClick={() => setStatusFilter('ALL')}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${statusFilter === 'ALL' ? 'bg-white dark:bg-zinc-700 text-stone-800 dark:text-zinc-100 shadow-xs' : 'text-stone-500 hover:text-stone-700 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
                            >
                                Tất cả
                            </button>
                            <button
                                onClick={() => setStatusFilter('IN_PROGRESS')}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${statusFilter === 'IN_PROGRESS' ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-stone-500 hover:text-blue-600 dark:text-zinc-400'}`}
                            >
                                Đang chạy
                            </button>
                            <button
                                onClick={() => setStatusFilter('DONE')}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${statusFilter === 'DONE' ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shadow-xs' : 'text-stone-500 hover:text-emerald-600 dark:text-zinc-400'}`}
                            >
                                Hoàn thành
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-stone-400 hidden md:block">Lot:</span>
                        <div className="flex bg-stone-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-stone-200/60 dark:border-zinc-700/60">
                            <button
                                onClick={() => setLotFilter('ALL')}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${lotFilter === 'ALL' ? 'bg-white dark:bg-zinc-700 text-stone-800 dark:text-zinc-100 shadow-xs' : 'text-stone-500 hover:text-stone-700 dark:text-zinc-400 dark:hover:text-zinc-200'}`}
                            >
                                Tất cả
                            </button>
                            <button
                                onClick={() => setLotFilter('ACTIVE')}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${lotFilter === 'ACTIVE' ? 'bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 shadow-xs' : 'text-stone-500 hover:text-orange-600 dark:text-zinc-400'}`}
                            >
                                Đang chạy
                            </button>
                            <button
                                onClick={() => setLotFilter('LOCKED')}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${lotFilter === 'LOCKED' ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 shadow-xs' : 'text-stone-500 hover:text-rose-600 dark:text-zinc-400'}`}
                            >
                                Đã khóa
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center px-2.5 py-1 bg-stone-100 dark:bg-zinc-800 rounded-lg text-[11px] font-semibold text-stone-500 dark:text-zinc-400 whitespace-nowrap">
                        {displayProductions.length} / {allData.length} lệnh
                    </div>
                </div>
            </div>

            {/* CONTENT */}
            {loading ? (
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-stone-200 dark:border-zinc-800 p-10 text-center shadow-sm">
                    <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2.5" />
                    <p className="text-stone-400 font-medium text-xs">Đang tải dữ liệu...</p>
                </div>
            ) : displayProductions.length === 0 ? (
                <EmptyState
                    icon={Factory}
                    title="Chưa có lệnh sản xuất nào"
                    description={searchTerm || statusFilter !== 'ALL' ? `Không tìm thấy kết quả nào phù hợp.` : "Hãy bắt đầu bằng cách tạo lệnh sản xuất đầu tiên để gắn vào công việc."}
                />
            ) : (
                <ProductionTable
                    data={displayProductions}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onStatusToggle={handleStatusToggle}
                    onLotLockToggle={handleLotLockToggle}
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
