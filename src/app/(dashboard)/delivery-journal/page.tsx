'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Factory, Search, Plus, X, Check, RotateCcw, Trash2, AlertTriangle, Send, PackageOpen, ClipboardCheck, Truck, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { supabase } from '@/lib/supabaseClient'

interface DeliveryRecord {
    id: string
    system_code: string
    company_id: string | null
    delivery_code: string | null
    item_name: string
    quantity_sent: number
    unit: string
    from_department: string
    to_department: string
    status: 'sent' | 'received_by_production' | 'completed_by_production' | 'received_by_warehouse' | 'cancelled'
    result_item_name: string | null
    result_quantity: number | null
    result_unit: string | null
    notes: string | null
    sent_by: string | null
    sent_by_name: string | null
    received_by_production: string | null
    received_by_production_name: string | null
    completed_by: string | null
    completed_by_name: string | null
    received_by_warehouse: string | null
    received_by_warehouse_name: string | null
    sent_at: string
    received_by_production_at: string | null
    completed_by_production_at: string | null
    received_by_warehouse_at: string | null
    created_by: string | null
    created_by_name: string | null
    created_at: string
    updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: any; step: number }> = {
    sent: { label: 'Đã gửi SX', className: 'bg-blue-100 text-blue-800 border-blue-200', icon: Send, step: 1 },
    received_by_production: { label: 'SX đã nhận', className: 'bg-cyan-100 text-cyan-800 border-cyan-200', icon: PackageOpen, step: 2 },
    completed_by_production: { label: 'SX hoàn thành', className: 'bg-amber-100 text-amber-800 border-amber-200', icon: ClipboardCheck, step: 3 },
    received_by_warehouse: { label: 'Kho đã nhận lại', className: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: Truck, step: 4 },
    cancelled: { label: 'Đã hủy', className: 'bg-red-100 text-red-800 border-red-200', icon: X, step: -1 },
}

const STATUS_ORDER = ['sent', 'received_by_production', 'completed_by_production', 'received_by_warehouse']

export default function DeliveryJournalPage() {
    const { currentSystem, hasModule } = useSystem()
    const { profile } = useUser()
    const [records, setRecords] = useState<DeliveryRecord[]>([])
    const [loading, setLoading] = useState(false)
    const [totalCount, setTotalCount] = useState(0)
    const [page, setPage] = useState(1)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('')
    const limit = 50

    // Modal form
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState({
        item_name: '',
        quantity_sent: 1,
        unit: 'Cái',
        from_department: 'Kho',
        to_department: 'Sản xuất',
        notes: '',
    })

    // Confirmation dialog
    const [confirmAction, setConfirmAction] = useState<{
        type: string
        record: DeliveryRecord | null
    }>({ type: '', record: null })

    // Step action modal (SX nhận, SX hoàn thành, Kho nhận lại)
    const [stepModal, setStepModal] = useState<{
        action: string
        record: DeliveryRecord | null
    }>({ action: '', record: null })
    const [stepForm, setStepForm] = useState({
        name: '',
        result_item_name: '',
        result_quantity: 0,
        result_unit: 'Cái',
    })

    const realtimeChannelRef = useRef<any>(null)

    // Fetch records
    const fetchRecords = useCallback(async () => {
        if (!currentSystem) return
        setLoading(true)
        try {
            const params = new URLSearchParams({
                system_code: currentSystem.code,
                page: String(page),
                limit: String(limit),
            })
            if (statusFilter) params.set('status', statusFilter)
            if (searchTerm) params.set('search', searchTerm)

            const res = await fetch(`/api/delivery-journal?${params}`)
            const json = await res.json()

            if (json.data) {
                setRecords(json.data as DeliveryRecord[])
                setTotalCount(json.count || 0)
            }
        } catch (err) {
            console.error('Fetch delivery journal error:', err)
        } finally {
            setLoading(false)
        }
    }, [currentSystem, page, statusFilter, searchTerm])

    // Real-time subscription
    useEffect(() => {
        if (!currentSystem) return

        fetchRecords()

        // Subscribe to Supabase Realtime
        const channel = supabase
            .channel('delivery_journal_realtime')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'delivery_journal',
                    filter: `system_code=eq.${currentSystem.code}`,
                },
                () => {
                    // Refetch on any change
                    fetchRecords()
                }
            )
            .subscribe()

        realtimeChannelRef.current = channel

        return () => {
            supabase.removeChannel(channel)
        }
    }, [currentSystem, fetchRecords])

    // Open send modal (Kho gửi vật tư)
    const openSendModal = (record?: DeliveryRecord) => {
        if (record) {
            setEditingId(record.id)
            setForm({
                item_name: record.item_name,
                quantity_sent: record.quantity_sent,
                unit: record.unit,
                from_department: record.from_department,
                to_department: record.to_department,
                notes: record.notes || '',
            })
        } else {
            setEditingId(null)
            setForm({
                item_name: '',
                quantity_sent: 1,
                unit: 'Cái',
                from_department: 'Kho',
                to_department: 'Sản xuất',
                notes: '',
            })
        }
        setShowModal(true)
    }

    // Handle create/update
    const handleSave = async () => {
        if (!form.item_name.trim() || !currentSystem) return

        const payload: any = {
            system_code: currentSystem.code,
            company_id: currentSystem.company_id || profile?.company_id || null,
            item_name: form.item_name.trim(),
            quantity_sent: Math.max(0, parseFloat(String(form.quantity_sent)) || 1),
            unit: form.unit || 'Cái',
            from_department: form.from_department || 'Kho',
            to_department: form.to_department || 'Sản xuất',
            notes: form.notes || null,
            sent_by: profile?.id || null,
            sent_by_name: profile?.full_name || 'Nhân viên kho',
            created_by: profile?.id || null,
            created_by_name: profile?.full_name || null,
        }

        if (editingId) {
            await fetch('/api/delivery-journal', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editingId, ...payload }),
            })
        } else {
            await fetch('/api/delivery-journal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
        }

        setShowModal(false)
        fetchRecords()
    }

    // Workflow actions
    const executeAction = async (id: string, action: string, extraData: any = {}) => {
        await fetch('/api/delivery-journal', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, action, ...extraData }),
        })
        fetchRecords()
    }

    const openStepModal = (action: string, record: DeliveryRecord) => {
        setStepModal({ action, record })
        setStepForm({
            name: profile?.full_name || '',
            result_item_name: record.result_item_name || '',
            result_quantity: record.result_quantity || 0,
            result_unit: record.result_unit || 'Cái',
        })
    }

    const handleStepConfirm = async () => {
        const { action, record } = stepModal
        if (!record) return

        const extraData: any = {}

        switch (action) {
            case 'receive_by_production':
                extraData.received_by_production = profile?.id
                extraData.received_by_production_name = stepForm.name || profile?.full_name
                break
            case 'complete_by_production':
                extraData.completed_by = profile?.id
                extraData.completed_by_name = stepForm.name || profile?.full_name
                extraData.result_item_name = stepForm.result_item_name || record.item_name + ' (TP)'
                extraData.result_quantity = stepForm.result_quantity || record.quantity_sent
                extraData.result_unit = stepForm.result_unit || record.unit
                break
            case 'receive_by_warehouse':
                extraData.received_by_warehouse = profile?.id
                extraData.received_by_warehouse_name = stepForm.name || profile?.full_name
                break
        }

        await executeAction(record.id, action, extraData)
        setStepModal({ action: '', record: null })
    }

    // Delete
    const handleDelete = async (id: string) => {
        await fetch(`/api/delivery-journal?id=${id}`, { method: 'DELETE' })
        setConfirmAction({ type: '', record: null })
        fetchRecords()
    }

    const getStatusBadge = (status: string) => {
        const c = STATUS_CONFIG[status] || { label: status, className: 'bg-gray-100 text-gray-800 border-gray-200' }
        const Icon = c.icon
        return (
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${c.className}`}>
                <Icon size={12} />
                {c.label}
            </span>
        )
    }

    const getProgressSteps = (record: DeliveryRecord) => {
        const currentStep = STATUS_CONFIG[record.status]?.step || 0
        if (currentStep < 0) return null

        return (
            <div className="flex items-center gap-1">
                {STATUS_ORDER.map((s, idx) => {
                    const config = STATUS_CONFIG[s]
                    const isCompleted = config.step <= currentStep
                    const isCurrent = config.step === currentStep
                    return (
                        <React.Fragment key={s}>
                            <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${isCompleted
                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                    : 'bg-gray-100 border-gray-300 text-gray-400'
                                    } ${isCurrent ? 'ring-2 ring-emerald-300 ring-offset-1' : ''}`}
                                title={config.label}
                            >
                                {isCompleted ? <Check size={12} /> : idx + 1}
                            </div>
                            {idx < STATUS_ORDER.length - 1 && (
                                <div className={`w-4 h-0.5 ${config.step < currentStep ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                            )}
                        </React.Fragment>
                    )
                })}
            </div>
        )
    }

    const getAvailableActions = (record: DeliveryRecord) => {
        const actions: { type: string; label: string; icon: any; className: string }[] = []

        if (record.status === 'sent') {
            actions.push({
                type: 'receive_by_production',
                label: 'SX nhận hàng',
                icon: PackageOpen,
                className: 'bg-cyan-600 hover:bg-cyan-700 text-white'
            })
        }
        if (record.status === 'received_by_production') {
            actions.push({
                type: 'complete_by_production',
                label: 'SX hoàn thành',
                icon: ClipboardCheck,
                className: 'bg-amber-600 hover:bg-amber-700 text-white'
            })
        }
        if (record.status === 'completed_by_production') {
            actions.push({
                type: 'receive_by_warehouse',
                label: 'Kho nhận lại',
                icon: Truck,
                className: 'bg-emerald-600 hover:bg-emerald-700 text-white'
            })
        }
        if (!['received_by_warehouse', 'cancelled'].includes(record.status)) {
            actions.push({
                type: 'cancel',
                label: 'Hủy',
                icon: X,
                className: 'bg-red-100 hover:bg-red-200 text-red-700 border border-red-200'
            })
        }

        return actions
    }

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-'
        return new Date(dateStr).toLocaleString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        })
    }

    if (!currentSystem) return null

    if (!hasModule('delivery_journal')) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-6">
                    <Factory size={40} className="text-slate-400" />
                </div>
                <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-2">
                    Giao nhận Kho ↔ Sản xuất
                </h2>
                <p className="text-stone-500 max-w-md">
                    Tính năng "Giao nhận" chưa được bật cho kho này.
                    Vui lòng vào Cài đặt → Tiện ích hệ thống để kích hoạt.
                </p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-100 p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-white flex items-center gap-3">
                        <Factory className="text-indigo-600" size={32} />
                        Giao nhận Kho ↔ Sản xuất
                    </h1>
                    <p className="text-stone-500 dark:text-gray-400 mt-1">
                        Nhật ký giao nhận: Kho gửi vật tư → Sản xuất nhận → SX hoàn thành → Kho nhận lại. Đồng bộ live toàn bộ.
                    </p>
                </div>

                <button
                    onClick={() => openSendModal()}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                >
                    <Plus size={20} />
                    Kho gửi vật tư
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                    { label: 'Chờ SX nhận', value: records.filter(r => r.status === 'sent').length, color: 'blue' },
                    { label: 'SX đang xử lý', value: records.filter(r => r.status === 'received_by_production').length, color: 'cyan' },
                    { label: 'Chờ kho nhận', value: records.filter(r => r.status === 'completed_by_production').length, color: 'amber' },
                    { label: 'Hoàn tất', value: records.filter(r => r.status === 'received_by_warehouse').length, color: 'emerald' },
                ].map((stat, idx) => (
                    <div key={idx} className={`bg-white dark:bg-zinc-800 rounded-2xl border border-stone-200 dark:border-zinc-700 p-4 shadow-sm`}>
                        <div className={`text-3xl font-bold text-${stat.color}-600 dark:text-${stat.color}-500`}>{stat.value}</div>
                        <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1 max-w-md">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                        type="text"
                        placeholder="Tìm mã GN, tên hàng, thành phẩm..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setPage(1) }}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                    className="px-4 py-2.5 bg-white dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                    <option value="">Tất cả trạng thái</option>
                    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                        <option key={key} value={key}>{config.label}</option>
                    ))}
                </select>
                <button
                    onClick={fetchRecords}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded-2xl text-sm font-medium hover:bg-stone-100 dark:hover:bg-zinc-700 transition-colors"
                >
                    <RefreshCw size={16} />
                    Làm mới
                </button>
                <span className="flex items-center text-xs text-stone-500 gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                </span>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-stone-200 dark:border-zinc-700 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900/50">
                                <th className="text-left px-4 py-3 font-bold text-stone-600 dark:text-stone-400">Mã GN</th>
                                <th className="text-left px-4 py-3 font-bold text-stone-600 dark:text-stone-400">Vật tư gửi</th>
                                <th className="text-left px-4 py-3 font-bold text-stone-600 dark:text-stone-400">SL</th>
                                <th className="text-left px-4 py-3 font-bold text-stone-600 dark:text-stone-400">ĐV</th>
                                <th className="text-left px-4 py-3 font-bold text-stone-600 dark:text-stone-400">Kết quả SX</th>
                                <th className="text-left px-4 py-3 font-bold text-stone-600 dark:text-stone-400">Trạng thái</th>
                                <th className="text-left px-4 py-3 font-bold text-stone-600 dark:text-stone-400">Tiến độ</th>
                                <th className="text-left px-4 py-3 font-bold text-stone-600 dark:text-stone-400">Người gửi</th>
                                <th className="text-left px-4 py-3 font-bold text-stone-600 dark:text-stone-400">Ngày gửi</th>
                                <th className="text-right px-4 py-3 font-bold text-stone-600 dark:text-stone-400">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={10} className="text-center py-12 text-stone-400">
                                        <RefreshCw size={20} className="animate-spin inline-block mr-2" />
                                        Đang tải dữ liệu...
                                    </td>
                                </tr>
                            ) : records.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="text-center py-12 text-stone-400">
                                        Chưa có nhật ký giao nhận nào.
                                    </td>
                                </tr>
                            ) : (
                                records.map((record) => {
                                    const actions = getAvailableActions(record)
                                    return (
                                        <tr key={record.id} className="hover:bg-stone-50 dark:hover:bg-zinc-700/50 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                                {record.delivery_code || '-'}
                                            </td>
                                            <td className="px-4 py-3 font-bold text-stone-800 dark:text-stone-200 max-w-[180px] truncate" title={record.item_name}>
                                                {record.item_name}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-stone-700 dark:text-stone-300">{record.quantity_sent}</td>
                                            <td className="px-4 py-3 text-stone-600 dark:text-stone-400">{record.unit}</td>
                                            <td className="px-4 py-3 text-stone-600 dark:text-stone-400 max-w-[150px] truncate" title={record.result_item_name || ''}>
                                                {record.result_item_name ? (
                                                    <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                                                        {record.result_item_name} ({record.result_quantity} {record.result_unit})
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td className="px-4 py-3">{getStatusBadge(record.status)}</td>
                                            <td className="px-4 py-3">{getProgressSteps(record)}</td>
                                            <td className="px-4 py-3 text-xs text-stone-600 dark:text-stone-400">
                                                {record.sent_by_name || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-stone-500 dark:text-stone-400 whitespace-nowrap">
                                                {formatDate(record.sent_at)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1 flex-wrap">
                                                    {actions.map((action) => (
                                                        <button
                                                            key={action.type}
                                                            onClick={() => {
                                                                if (action.type === 'cancel') {
                                                                    setConfirmAction({ type: 'cancel', record })
                                                                } else {
                                                                    openStepModal(action.type, record)
                                                                }
                                                            }}
                                                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${action.className}`}
                                                            title={action.label}
                                                        >
                                                            <action.icon size={14} />
                                                            <span className="hidden md:inline">{action.label}</span>
                                                        </button>
                                                    ))}
                                                    {record.status === 'sent' && (
                                                        <button
                                                            onClick={() => openSendModal(record)}
                                                            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:hover:bg-zinc-700 transition-colors"
                                                            title="Sửa"
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                                                        </button>
                                                    )}
                                                    {(record.status === 'cancelled' || record.status === 'received_by_warehouse') && (
                                                        <button
                                                            onClick={() => setConfirmAction({ type: 'delete', record })}
                                                            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                            title="Xóa"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalCount > limit && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-stone-200 dark:border-zinc-700">
                        <span className="text-xs text-stone-500">
                            Hiển thị {Math.min((page - 1) * limit + 1, totalCount)}-{Math.min(page * limit, totalCount)} / {totalCount}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1 text-sm rounded-lg border border-stone-200 dark:border-zinc-700 disabled:opacity-30 hover:bg-stone-100 dark:hover:bg-zinc-700 flex items-center gap-1"
                            >
                                <ChevronLeft size={14} /> Trước
                            </button>
                            <span className="text-sm font-bold px-3">{page}</span>
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={page * limit >= totalCount}
                                className="px-3 py-1 text-sm rounded-lg border border-stone-200 dark:border-zinc-700 disabled:opacity-30 hover:bg-stone-100 dark:hover:bg-zinc-700 flex items-center gap-1"
                            >
                                Sau <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Send Modal (Kho gửi vật tư) */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-800 rounded-3xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
                                    <Send size={24} className="text-indigo-600" />
                                    {editingId ? 'Sửa phiếu gửi' : 'Kho gửi vật tư cho Sản xuất'}
                                </h3>
                                <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-zinc-700">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Tên vật tư *</label>
                                    <input
                                        type="text"
                                        value={form.item_name}
                                        onChange={(e) => setForm({ ...form, item_name: e.target.value })}
                                        placeholder="Ví dụ: Thép tấm 5mm, Bóng đèn LED..."
                                        className="w-full px-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Số lượng</label>
                                        <input
                                            type="number"
                                            min={0}
                                            step="any"
                                            value={form.quantity_sent}
                                            onChange={(e) => setForm({ ...form, quantity_sent: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Đơn vị</label>
                                        <input
                                            type="text"
                                            value={form.unit}
                                            onChange={(e) => setForm({ ...form, unit: e.target.value })}
                                            placeholder="Cái, Kg, Tấm..."
                                            className="w-full px-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Từ</label>
                                        <input
                                            type="text"
                                            value={form.from_department}
                                            onChange={(e) => setForm({ ...form, from_department: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Đến</label>
                                        <input
                                            type="text"
                                            value={form.to_department}
                                            onChange={(e) => setForm({ ...form, to_department: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Ghi chú</label>
                                    <input
                                        type="text"
                                        value={form.notes}
                                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                        placeholder="Ghi chú thêm nếu có..."
                                        className="w-full px-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-stone-200 dark:border-zinc-700">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-sm font-bold text-stone-600 hover:bg-stone-100 dark:hover:bg-zinc-700 rounded-2xl transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={!form.item_name.trim()}
                                    className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {editingId ? 'Cập nhật' : 'Gửi cho Sản xuất'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Step Action Modal */}
            {stepModal.record && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-800 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
                                    {stepModal.action === 'receive_by_production' && <><PackageOpen size={24} className="text-cyan-600" /> Sản xuất nhận hàng</>}
                                    {stepModal.action === 'complete_by_production' && <><ClipboardCheck size={24} className="text-amber-600" /> SX hoàn thành & gửi kết quả</>}
                                    {stepModal.action === 'receive_by_warehouse' && <><Truck size={24} className="text-emerald-600" /> Kho nhận lại thành phẩm</>}
                                </h3>
                                <button onClick={() => setStepModal({ action: '', record: null })} className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-zinc-700">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="bg-stone-50 dark:bg-zinc-900 rounded-2xl p-3 mb-4">
                                <p className="text-sm font-bold text-stone-800 dark:text-stone-200">{stepModal.record.item_name}</p>
                                <p className="text-xs text-stone-500">SL: {stepModal.record.quantity_sent} {stepModal.record.unit} | Mã: {stepModal.record.delivery_code}</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Tên người thực hiện</label>
                                    <input
                                        type="text"
                                        value={stepForm.name}
                                        onChange={(e) => setStepForm({ ...stepForm, name: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>

                                {stepModal.action === 'complete_by_production' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Tên thành phẩm làm ra</label>
                                            <input
                                                type="text"
                                                value={stepForm.result_item_name}
                                                onChange={(e) => setStepForm({ ...stepForm, result_item_name: e.target.value })}
                                                placeholder="VD: Chi tiết máy A-123"
                                                className="w-full px-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">SL thành phẩm</label>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    step="any"
                                                    value={stepForm.result_quantity}
                                                    onChange={(e) => setStepForm({ ...stepForm, result_quantity: parseFloat(e.target.value) || 0 })}
                                                    className="w-full px-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Đơn vị</label>
                                                <input
                                                    type="text"
                                                    value={stepForm.result_unit}
                                                    onChange={(e) => setStepForm({ ...stepForm, result_unit: e.target.value })}
                                                    className="w-full px-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-stone-200 dark:border-zinc-700">
                                <button
                                    onClick={() => setStepModal({ action: '', record: null })}
                                    className="px-4 py-2 text-sm font-bold text-stone-600 hover:bg-stone-100 dark:hover:bg-zinc-700 rounded-2xl transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleStepConfirm}
                                    className={`px-6 py-2 text-sm font-bold text-white rounded-2xl shadow-lg transition-all active:scale-95 ${stepModal.action === 'receive_by_production' ? 'bg-cyan-600 hover:bg-cyan-700 shadow-cyan-500/20' :
                                        stepModal.action === 'complete_by_production' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20' :
                                            'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                                        }`}
                                >
                                    Xác nhận
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Dialog */}
            {confirmAction.record && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-800 rounded-3xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                <AlertTriangle size={20} className="text-orange-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-stone-900 dark:text-white">
                                    {confirmAction.type === 'cancel' ? 'Hủy giao nhận này?' : 'Xóa giao nhận này?'}
                                </h3>
                            </div>
                        </div>
                        <p className="text-sm text-stone-500 mb-2">
                            <strong>{confirmAction.record.item_name}</strong> - Mã: {confirmAction.record.delivery_code}
                        </p>
                        {confirmAction.type === 'delete' && (
                            <p className="text-xs text-red-500 mb-4">Hành động này không thể hoàn tác.</p>
                        )}
                        <div className="flex items-center justify-end gap-3 mt-4">
                            <button
                                onClick={() => setConfirmAction({ type: '', record: null })}
                                className="px-4 py-2 text-sm font-bold text-stone-600 hover:bg-stone-100 dark:hover:bg-zinc-700 rounded-2xl transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={() => {
                                    if (confirmAction.type === 'cancel') executeAction(confirmAction.record!.id, 'cancel')
                                    else if (confirmAction.type === 'delete') handleDelete(confirmAction.record!.id)
                                }}
                                className={`px-4 py-2 text-sm font-bold text-white rounded-2xl transition-colors ${confirmAction.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'
                                    }`}
                            >
                                {confirmAction.type === 'cancel' ? 'Hủy giao nhận' : 'Xóa vĩnh viễn'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}