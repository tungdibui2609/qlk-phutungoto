'use client'
import React, { useState, useEffect } from 'react'
import { Package, Search, RefreshCw, Check, Loader2, Eye, ChevronDown, ChevronUp, ArrowRight, XCircle, Filter } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'

const STATUS_COLORS: Record<string, string> = {
    'PENDING': 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
    'APPROVED': 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
    'PICKING': 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800',
    'DONE': 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
    'CANCELED': 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800',
}
const STATUS_LABELS: Record<string, string> = {
    'PENDING': 'Chờ duyệt', 'APPROVED': 'Đã duyệt', 'PICKING': 'Đang nhặt hàng', 'DONE': 'Đã xuất xong', 'CANCELED': 'Đã hủy',
}

const STATUS_FLOW: Record<string, { next: string; label: string; color: string }> = {
    'PENDING': { next: 'APPROVED', label: 'Duyệt phiếu', color: 'from-blue-500 to-indigo-600' },
    'APPROVED': { next: 'PICKING', label: 'Bắt đầu nhặt hàng', color: 'from-purple-500 to-violet-600' },
    'PICKING': { next: 'DONE', label: 'Hoàn thành xuất kho', color: 'from-emerald-500 to-teal-600' },
}

export default function WarehouseRequisitionsPage() {
    const { showToast } = useToast()
    const { systemType } = useSystem()
    const [requisitions, setRequisitions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('ALL')
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [updatingId, setUpdatingId] = useState<string | null>(null)

    const fetchData = async () => {
        setLoading(true)
        let query = supabase
            .from('material_requisitions' as any)
            .select(`
                *,
                material_requisition_lines(
                    *,
                    products!material_requisition_lines_material_id_fkey(id, name, unit, sku, category_id, system_code, categories(name))
                ),
                manufacturing_orders!material_requisitions_mo_id_fkey(code, products!manufacturing_orders_product_id_fkey(name))
            `)
            .order('created_at', { ascending: false })

        const { data, error } = await query
        if (error) console.error(error)
        setRequisitions(data || [])
        setLoading(false)
    }

    useEffect(() => { fetchData() }, [])

    const handleStatusChange = async (reqId: string, newStatus: string) => {
        setUpdatingId(reqId)
        try {
            const { error } = await supabase
                .from('material_requisitions' as any)
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', reqId)
            if (error) throw error
            showToast(`Đã chuyển trạng thái sang "${STATUS_LABELS[newStatus]}"`, 'success')
            fetchData()
        } catch (err: any) {
            showToast('Lỗi: ' + err.message, 'error')
        } finally {
            setUpdatingId(null)
        }
    }

    const handleCancel = async (reqId: string) => {
        setUpdatingId(reqId)
        try {
            const { error } = await supabase
                .from('material_requisitions' as any)
                .update({ status: 'CANCELED', updated_at: new Date().toISOString() })
                .eq('id', reqId)
            if (error) throw error
            showToast('Đã hủy phiếu yêu cầu', 'success')
            fetchData()
        } catch (err: any) {
            showToast('Lỗi: ' + err.message, 'error')
        } finally {
            setUpdatingId(null)
        }
    }

    // Filter logic
    const filtered = requisitions.map(req => {
        // Only keep lines that belong to this system
        const localLines = (req.material_requisition_lines || []).filter(
            (line: any) => line.products?.system_code === systemType
        )
        return { ...req, localLines }
    }).filter(req => {
        // Only show requisition if it has lines for this system
        if (req.localLines.length === 0) return false

        const matchSearch = !searchTerm ||
            req.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.manufacturing_orders?.code?.toLowerCase().includes(searchTerm.toLowerCase())
        const matchStatus = statusFilter === 'ALL' || req.status === statusFilter
        return matchSearch && matchStatus
    })

    // Group materials by potential warehouse/category for display
    const getMaterialsByCategory = (lines: any[]) => {
        const groups: Record<string, any[]> = {}
        lines.forEach(line => {
            const catName = line.products?.categories?.name || 'Chưa phân loại'
            if (!groups[catName]) groups[catName] = []
            groups[catName].push(line)
        })
        return groups
    }

    const pendingCount = filtered.filter(r => r.status === 'PENDING').length
    const pickingCount = filtered.filter(r => r.status === 'PICKING' || r.status === 'APPROVED').length

    return (
        <div className="space-y-6 animate-fade-in px-4 pt-4">
            <PageHeader
                title="Phiếu Xuất NL Sản Xuất"
                subtitle="Material Requisitions"
                description="Tiếp nhận và xử lý yêu cầu xuất nguyên liệu từ bộ phận Sản Xuất."
                icon={Package}
            />

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Chờ duyệt', count: pendingCount, color: 'amber' },
                    { label: 'Đang xử lý', count: pickingCount, color: 'purple' },
                    { label: 'Đã hoàn thành', count: filtered.filter(r => r.status === 'DONE').length, color: 'emerald' },
                    { label: 'Tổng phiếu', count: filtered.length, color: 'blue' },
                ].map(stat => (
                    <div key={stat.label} className={`bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-${stat.color}-100 dark:border-${stat.color}-900/30`}>
                        <p className="text-xs font-bold text-zinc-400 uppercase">{stat.label}</p>
                        <p className={`text-2xl font-black text-${stat.color}-600 dark:text-${stat.color}-400`}>{stat.count}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-[20px] flex flex-col sm:flex-row gap-3 border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm theo Mã phiếu, Mã MO..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 transition-all font-medium text-sm"
                    />
                </div>
                <div className="flex gap-2 flex-wrap">
                    {['ALL', 'PENDING', 'APPROVED', 'PICKING', 'DONE', 'CANCELED'].map(s => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold transition border ${statusFilter === s
                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 border-blue-200 dark:border-blue-800'
                                : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                                }`}
                        >
                            {s === 'ALL' ? 'Tất cả' : STATUS_LABELS[s]}
                        </button>
                    ))}
                </div>
                <button onClick={fetchData} className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-transparent transition" title="Làm mới">
                    <RefreshCw size={18} className={loading ? "animate-spin text-blue-600" : "text-blue-600"} />
                </button>
            </div>

            {/* Requisition Cards */}
            <div className="space-y-4">
                {loading ? (
                    <div className="bg-white dark:bg-zinc-900 rounded-[24px] p-16 text-center border border-zinc-200 dark:border-zinc-800">
                        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-zinc-400 text-sm font-bold">Đang tải phiếu...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="bg-white dark:bg-zinc-900 rounded-[24px] p-10 border border-zinc-200 dark:border-zinc-800">
                        <EmptyState
                            icon={Package}
                            title="Chưa có phiếu yêu cầu nào"
                            description="Khi bộ phận Sản Xuất tạo phiếu xuất nguyên liệu, phiếu sẽ hiện ở đây."
                        />
                    </div>
                ) : (
                    filtered.map(req => {
                        const isExpanded = expandedId === req.id
                        const flow = STATUS_FLOW[req.status]
                        const lines = req.localLines || []
                        const materialGroups = getMaterialsByCategory(lines)

                        return (
                            <div key={req.id} className="bg-white dark:bg-zinc-900 rounded-[24px] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                                {/* Header */}
                                <div
                                    className="p-5 flex items-center justify-between cursor-pointer hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition"
                                    onClick={() => setExpandedId(isExpanded ? null : req.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-2 h-12 rounded-full ${req.status === 'PENDING' ? 'bg-amber-400' :
                                            req.status === 'APPROVED' ? 'bg-blue-400' :
                                                req.status === 'PICKING' ? 'bg-purple-400' :
                                                    req.status === 'DONE' ? 'bg-emerald-400' : 'bg-zinc-300'
                                            }`} />
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <h3 className="font-black text-zinc-900 dark:text-zinc-100">{req.code}</h3>
                                                <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${STATUS_COLORS[req.status]}`}>
                                                    {STATUS_LABELS[req.status]}
                                                </span>
                                            </div>
                                            <p className="text-xs text-zinc-500 mt-1">
                                                Lệnh SX: <strong>{req.manufacturing_orders?.code || '---'}</strong>
                                                <span className="mx-2">•</span>
                                                SP: {req.manufacturing_orders?.products?.name || '---'}
                                                <span className="mx-2">•</span>
                                                {new Date(req.created_at).toLocaleString('vi-VN')}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-bold text-zinc-500">{lines.length} NVL</span>
                                        {isExpanded ? <ChevronUp size={20} className="text-zinc-400" /> : <ChevronDown size={20} className="text-zinc-400" />}
                                    </div>
                                </div>

                                {/* Expanded Detail */}
                                {isExpanded && (
                                    <div className="border-t border-zinc-100 dark:border-zinc-800">
                                        {/* Material groups by category (= warehouse hint) */}
                                        <div className="p-5 space-y-4">
                                            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                                <Filter size={12} /> Nguyên liệu theo Danh mục (gợi ý kho xuất)
                                            </p>

                                            {Object.entries(materialGroups).map(([catName, catLines]) => (
                                                <div key={catName} className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-4">
                                                    <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                                                        <Package size={14} className="text-blue-500" />
                                                        {catName}
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-black">{catLines.length} vật tư</span>
                                                    </h4>
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="text-[10px] text-zinc-400 font-bold uppercase border-b border-zinc-200 dark:border-zinc-700">
                                                                <th className="py-2 text-left">Nguyên liệu</th>
                                                                <th className="py-2 text-left">SKU</th>
                                                                <th className="py-2 text-right">Yêu cầu</th>
                                                                <th className="py-2 text-right">Đã xuất</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
                                                            {catLines.map((line: any) => (
                                                                <tr key={line.id} className="hover:bg-white dark:hover:bg-zinc-800 transition">
                                                                    <td className="py-2 font-medium text-zinc-700 dark:text-zinc-200">{line.products?.name || '---'}</td>
                                                                    <td className="py-2 text-zinc-500 text-xs">{line.products?.sku || '---'}</td>
                                                                    <td className="py-2 text-right font-mono font-bold text-blue-600 dark:text-blue-400">{line.required_quantity} {line.unit}</td>
                                                                    <td className="py-2 text-right font-mono text-zinc-500">{line.issued_quantity || 0} {line.unit}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Actions */}
                                        {req.status !== 'DONE' && req.status !== 'CANCELED' && (
                                            <div className="p-5 pt-0 flex justify-end gap-3">
                                                <button
                                                    onClick={() => handleCancel(req.id)}
                                                    disabled={updatingId === req.id}
                                                    className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 border border-rose-200 dark:border-rose-800 transition disabled:opacity-50"
                                                >
                                                    <XCircle size={16} /> Hủy phiếu
                                                </button>
                                                {flow && (
                                                    <button
                                                        onClick={() => handleStatusChange(req.id, flow.next)}
                                                        disabled={updatingId === req.id}
                                                        className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm text-white bg-gradient-to-r ${flow.color} shadow-sm hover:shadow-md transition disabled:opacity-50`}
                                                    >
                                                        {updatingId === req.id ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                                                        {flow.label}
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {req.status === 'DONE' && (
                                            <div className="p-5 pt-0">
                                                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 rounded-xl">
                                                    <Check size={18} />
                                                    <span className="font-bold text-sm">Phiếu đã hoàn thành xuất kho</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
