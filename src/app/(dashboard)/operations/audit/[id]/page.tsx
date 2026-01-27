<<<<<<< HEAD
/* eslint-disable @typescript-eslint/no-explicit-any */
=======
>>>>>>> origin/main
'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useAudit } from '../_hooks/useAudit'
import { AuditSessionHeader } from '../_components/AuditSessionHeader'
import { AuditItemCard } from '../_components/AuditItemCard'
import { ApproveAuditModal } from '../_components/ApproveAuditModal'
import { Search, Filter, Layers, Users, Eye } from 'lucide-react'

export default function AuditDetailPage() {
    const params = useParams()
    const id = params.id as string
<<<<<<< HEAD
    const {
        currentSession,
        sessionItems,
        loading,
        liveMismatches,
        fetchSessionDetail,
        updateItem,
        submitForApproval,
        approveSession,
        rejectSession,
        quickFill,
        checkLiveInventory,
        syncSystemQuantity
=======
    const {
        currentSession,
        sessionItems,
        loading,
        fetchSessionDetail,
        updateItem,
        submitForApproval,
        approveSession,
        rejectSession,
        quickFill
>>>>>>> origin/main
    } = useAudit()

    const [searchTerm, setSearchTerm] = useState('')
    const [showApproveModal, setShowApproveModal] = useState(false)
    const [filterMode, setFilterMode] = useState<'ALL' | 'MISMATCH' | 'UNCOUNTED'>('ALL')

    useEffect(() => {
        if (id) {
            fetchSessionDetail(id)
        }
    }, [id, fetchSessionDetail])

    // Filtering
    const filteredItems = useMemo(() => {
        return sessionItems.filter(item => {
<<<<<<< HEAD
            const matchesSearch =
=======
            const matchesSearch =
>>>>>>> origin/main
                item.products?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.products?.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.lots?.code.toLowerCase().includes(searchTerm.toLowerCase())

            if (!matchesSearch) return false

            if (filterMode === 'MISMATCH') return item.actual_quantity !== null && item.difference !== 0
            if (filterMode === 'UNCOUNTED') return item.actual_quantity === null

            return true
        })
    }, [sessionItems, searchTerm, filterMode])

    // Grouping by Lot
    const groupedItems = useMemo(() => {
        const groups: Record<string, typeof sessionItems> = {}
        filteredItems.forEach(item => {
            const key = item.lots?.code || 'NO_LOT'
            if (!groups[key]) groups[key] = []
            groups[key].push(item)
        })
        return groups
    }, [filteredItems])

    if (loading && !currentSession) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
            </div>
        )
    }

    if (!currentSession) return null

    return (
        <div className="pb-20 min-h-screen bg-slate-50 dark:bg-black">
<<<<<<< HEAD
            <AuditSessionHeader
                session={currentSession}
                liveMismatches={liveMismatches}
=======
            <AuditSessionHeader
                session={currentSession}
>>>>>>> origin/main
                onSubmit={() => submitForApproval(id)}
                onApprove={() => setShowApproveModal(true)}
                onReject={() => rejectSession(id, 'Từ chối bởi quản lý')}
                onQuickFill={quickFill}
<<<<<<< HEAD
                onCheckLive={checkLiveInventory}
                onSyncLive={syncSystemQuantity}
            />

=======
            />

>>>>>>> origin/main
            {/* Session Metadata (Participants & Scope) */}
            {currentSession && (
                <div className="max-w-3xl mx-auto px-4 pt-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 text-sm">
                        <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 text-slate-500 font-medium uppercase text-xs tracking-wider">
                                <Eye size={14} /> Phạm vi kiểm kê
                            </div>
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                                {currentSession.scope === 'ALL' ? 'Toàn bộ kho' : 'Tùy chọn sản phẩm'}
                            </div>
                        </div>
                        <div className="flex-[2] space-y-2">
                            <div className="flex items-center gap-2 text-slate-500 font-medium uppercase text-xs tracking-wider">
                                <Users size={14} /> Tổ kiểm kê
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(currentSession.participants as any[])?.length > 0 ? (
                                    (currentSession.participants as any[]).map((p, i) => (
                                        <div key={i} className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                                            <span className="font-bold text-slate-700 dark:text-slate-300">{p.name}</span>
                                            <span className="text-slate-400 text-xs border-l border-slate-300 dark:border-slate-600 pl-1.5">{p.role}</span>
                                        </div>
                                    ))
                                ) : (
                                    <span className="text-slate-400 italic">Chưa cập nhật danh sách</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

<<<<<<< HEAD
            <ApproveAuditModal
=======
            <ApproveAuditModal
>>>>>>> origin/main
                isOpen={showApproveModal}
                onClose={() => setShowApproveModal(false)}
                onApprove={(method) => approveSession(id, method)}
            />

            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                {/* Search & Filter */}
                <div className="flex flex-col gap-3 sticky top-[73px] z-20 bg-slate-50 dark:bg-black pb-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
<<<<<<< HEAD
                        <input
=======
                        <input
>>>>>>> origin/main
                            type="text"
                            placeholder="Tìm sản phẩm, SKU, hoặc mã Lot..."
                            className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none shadow-sm transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
<<<<<<< HEAD

                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        <FilterButton
                            active={filterMode === 'ALL'}
                            onClick={() => setFilterMode('ALL')}
                            label="Tất cả"
                            count={sessionItems.length}
                        />
                        <FilterButton
                            active={filterMode === 'UNCOUNTED'}
                            onClick={() => setFilterMode('UNCOUNTED')}
                            label="Chưa kiểm"
                            count={sessionItems.filter(i => i.actual_quantity === null).length}
                        />
                        <FilterButton
                            active={filterMode === 'MISMATCH'}
                            onClick={() => setFilterMode('MISMATCH')}
=======

                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        <FilterButton
                            active={filterMode === 'ALL'}
                            onClick={() => setFilterMode('ALL')}
                            label="Tất cả"
                            count={sessionItems.length}
                        />
                        <FilterButton
                            active={filterMode === 'UNCOUNTED'}
                            onClick={() => setFilterMode('UNCOUNTED')}
                            label="Chưa kiểm"
                            count={sessionItems.filter(i => i.actual_quantity === null).length}
                        />
                        <FilterButton
                            active={filterMode === 'MISMATCH'}
                            onClick={() => setFilterMode('MISMATCH')}
>>>>>>> origin/main
                            label="Lệch kho"
                            count={sessionItems.filter(i => i.actual_quantity !== null && i.difference !== 0).length}
                            alert
                        />
                    </div>
                </div>

                {/* Content Grouped by Lot */}
                <div className="space-y-6">
                    {Object.entries(groupedItems).map(([lotCode, items]) => (
                        <div key={lotCode} className="space-y-3">
                            <div className="flex items-center gap-2 px-1">
                                <Layers size={16} className="text-slate-400" />
                                <h3 className="font-bold text-slate-700 dark:text-slate-300">
                                    Lot: {lotCode === 'NO_LOT' ? 'Không xác định' : lotCode}
                                </h3>
                                <span className="text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                                    {items.length} mục
                                </span>
                            </div>
                            <div className="space-y-3">
                                {items.map(item => (
<<<<<<< HEAD
                                    <AuditItemCard
                                        key={item.id}
                                        item={item}
                                        liveMismatchValue={liveMismatches[item.id]}
                                        onUpdate={updateItem}
=======
                                    <AuditItemCard
                                        key={item.id}
                                        item={item}
                                        onUpdate={updateItem}
>>>>>>> origin/main
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
<<<<<<< HEAD

=======

>>>>>>> origin/main
                    {filteredItems.length === 0 && (
                        <div className="text-center py-12 text-slate-400">
                            Không tìm thấy sản phẩm nào phù hợp.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function FilterButton({ active, onClick, label, count, alert }: { active: boolean, onClick: () => void, label: string, count: number, alert?: boolean }) {
    return (
        <button
            onClick={onClick}
            className={`
                flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all border
<<<<<<< HEAD
                ${active
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900'
=======
                ${active
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900'
>>>>>>> origin/main
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800'
                }
            `}
        >
            {label}
            <span className={`
                px-1.5 py-0.5 rounded-md text-[10px]
<<<<<<< HEAD
                ${active
                    ? 'bg-white/20 text-white'
=======
                ${active
                    ? 'bg-white/20 text-white'
>>>>>>> origin/main
                    : (alert && count > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500')
                }
            `}>
                {count}
            </span>
        </button>
    )
}
