'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Leaf, Search, Plus, Wand2 } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import BatchTable from './_components/BatchTable'
import BatchModal from './_components/BatchModal'
import StageTimeline from './_components/StageTimeline'
import BatchAnalyticsModal from './_components/BatchAnalyticsModal'

export interface FreshBatch {
    id: string
    batch_code: string
    system_code: string
    company_id: string
    product_id: string | null
    supplier_id: string | null
    received_date: string
    total_initial_quantity: number
    initial_unit: string
    status: string
    notes: string | null
    created_by: string | null
    created_at: string
    updated_at: string
    // Joined
    products?: { name: string; sku: string; unit: string } | null
    suppliers?: { name: string } | null
    document_urls?: any[]
    fresh_material_receivings?: any[]
    fresh_material_stages?: any[]
}

export default function FreshMaterialsPage() {
    const { showToast, showConfirm } = useToast()
    const { systemType } = useSystem()
    const { profile } = useUser()

    const [batches, setBatches] = useState<FreshBatch[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingBatch, setEditingBatch] = useState<FreshBatch | null>(null)
    const [selectedBatch, setSelectedBatch] = useState<FreshBatch | null>(null)
    const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false)
    const [selectedAnalyticsBatch, setSelectedAnalyticsBatch] = useState<FreshBatch | null>(null)

    const fetchBatches = useCallback(async () => {
        setLoading(true)
        try {
            const { data, error } = await (supabase as any)
                .from('fresh_material_batches')
                .select(`
                    *,
                    products (name, sku, unit),
                    suppliers (name),
                    fresh_material_receivings (id, receiving_order, vehicle_plate, quantity, unit, received_at, document_urls),
                    fresh_material_stages (id, stage_order, stage_name, status, input_quantity, input_unit, started_at, completed_at, is_production_link, document_urls,
                        fresh_material_stage_outputs (id, product_id, output_type, quantity, unit, grade, notes,
                            products (name)
                        )
                    )
                `)
                .eq('system_code', systemType)
                .order('created_at', { ascending: false })

            if (error) throw error
            setBatches(data || [])
        } catch (err: any) {
            console.error('Error fetching batches:', err)
            showToast('Lỗi tải dữ liệu: ' + err.message, 'error')
        } finally {
            setLoading(false)
        }
    }, [systemType])

    useEffect(() => {
        fetchBatches()
    }, [fetchBatches])

    // Sync selectedBatch with new data from batches
    useEffect(() => {
        if (selectedBatch) {
            const updated = batches.find(b => b.id === selectedBatch.id)
            if (updated) {
                setSelectedBatch(updated)
            }
        }
    }, [batches])

    // Filtered batches
    const filteredBatches = batches.filter(b => {
        const searchLower = searchTerm.toLowerCase()
        const matchSearch = !searchTerm ||
            b.batch_code?.toLowerCase().includes(searchLower) ||
            b.products?.name?.toLowerCase().includes(searchLower) ||
            b.suppliers?.name?.toLowerCase().includes(searchLower)

        const matchStatus = statusFilter === 'all' || b.status === statusFilter

        return matchSearch && matchStatus
    })

    const handleAdd = () => {
        setEditingBatch(null)
        setIsModalOpen(true)
    }

    const handleEdit = (batch: FreshBatch) => {
        setEditingBatch(batch)
        setIsModalOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (!await showConfirm('Bạn có chắc muốn xóa lô nguyên liệu này? Tất cả dữ liệu giai đoạn sẽ bị xóa.')) return

        const { error } = await (supabase as any)
            .from('fresh_material_batches')
            .delete()
            .eq('id', id)

        if (error) {
            showToast('Lỗi: ' + error.message, 'error')
        } else {
            showToast('Đã xóa lô NLT thành công', 'success')
            fetchBatches()
            if (selectedBatch?.id === id) setSelectedBatch(null)
        }
    }

    const handleSelectBatch = (batch: FreshBatch) => {
        setSelectedBatch(prev => prev?.id === batch.id ? null : batch)
    }

    const statusOptions = [
        { value: 'all', label: 'Tất cả', color: 'stone' },
        { value: 'RECEIVING', label: 'Đang nhận', color: 'blue' },
        { value: 'PROCESSING', label: 'Đang xử lý', color: 'orange' },
        { value: 'COMPLETED', label: 'Hoàn thành', color: 'emerald' },
    ]

    return (
        <div className="space-y-6">
            <div className="hidden md:block">
                <PageHeader
                    title="Nguyên liệu tươi"
                    subtitle="Fresh Material Lifecycle"
                    description="Theo dõi vòng đời nguyên liệu từ bốc xe → phân loại → cấp đông → thành phẩm"
                    icon={Leaf}
                    actionText="Tạo lô mới"
                    onActionClick={handleAdd}
                    permission="warehouse.manage"
                />
            </div>

            <div className="md:hidden flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600">
                        <Leaf size={20} />
                    </div>
                    <h1 className="text-lg font-black text-stone-800 dark:text-white">Nguyên liệu tươi</h1>
                </div>
                <button
                    onClick={handleAdd}
                    className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                >
                    <Plus size={20} />
                </button>
            </div>

            {/* FILTERS */}
            <div className="bg-white dark:bg-zinc-900 rounded-[24px] p-4 md:p-5 border border-stone-200 dark:border-zinc-800 flex flex-col md:flex-row flex-wrap gap-3 md:items-center shadow-sm">
                <div className="relative flex-1 w-full md:min-w-[300px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 text-sm text-stone-800 dark:text-gray-200 focus:outline-none focus:border-emerald-400 transition-all"
                    />
                </div>

                {/* Status Filter Pills */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
                    {statusOptions.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setStatusFilter(opt.value)}
                            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                                statusFilter === opt.value
                                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10'
                                    : 'bg-stone-50 dark:bg-zinc-800 text-stone-400'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-stone-100 dark:bg-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-stone-400">
                    {filteredBatches.length} / {batches.length} Lô
                </div>
            </div>

            {/* CONTENT */}
            {loading ? (
                <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-stone-200 dark:border-zinc-800 p-20 text-center shadow-sm">
                    <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-stone-500 font-bold uppercase tracking-widest text-xs">Đang tải dữ liệu...</p>
                </div>
            ) : filteredBatches.length === 0 ? (
                <EmptyState
                    icon={Leaf}
                    title="Chưa có lô nguyên liệu nào"
                    description={searchTerm ? `Không tìm thấy kết quả nào khớp với "${searchTerm}"` : "Bắt đầu bằng cách tạo lô nguyên liệu tươi đầu tiên để theo dõi vòng đời chế biến."}
                />
            ) : (
                <BatchTable
                    data={filteredBatches}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onSelect={handleSelectBatch}
                    onViewAnalytics={(batch) => {
                        setSelectedAnalyticsBatch(batch)
                        setIsAnalyticsOpen(true)
                    }}
                    selectedId={selectedBatch?.id}
                />
            )}

            {/* STAGE TIMELINE (Expanded) */}
            {selectedBatch && (
                <StageTimeline
                    batch={selectedBatch}
                    onRefresh={fetchBatches}
                />
            )}

            {/* MODAL */}
            <BatchModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchBatches}
                editItem={editingBatch}
            />

            <BatchAnalyticsModal 
                isOpen={isAnalyticsOpen}
                onClose={() => {
                    setIsAnalyticsOpen(false)
                    setSelectedAnalyticsBatch(null)
                }}
                batch={selectedAnalyticsBatch}
            />
        </div>
    )
}
