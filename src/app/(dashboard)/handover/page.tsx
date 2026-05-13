'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { ArrowRightLeft, Download, Plus, Search, X, Check, RotateCcw, Trash2, AlertTriangle } from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'
import { supabase } from '@/lib/supabaseClient'

interface HandoverRecord {
    id: string
    system_code: string
    company_id: string | null
    item_name: string
    quantity: number
    unit: string
    from_department: string | null
    to_department: string | null
    direction: 'inbound' | 'outbound'
    status: 'pending' | 'received' | 'delivered' | 'cancelled'
    notes: string | null
    received_by: string | null
    handed_by: string | null
    related_record_id: string | null
    created_by: string | null
    created_by_name: string | null
    created_at: string
    updated_at: string
}

export default function HandoverPage() {
    const { currentSystem } = useSystem()
    const [activeTab, setActiveTab] = useState<'receive' | 'deliver' | 'history'>('receive')
    const [records, setRecords] = useState<HandoverRecord[]>([])
    const [loading, setLoading] = useState(false)
    const [totalCount, setTotalCount] = useState(0)
    const [page, setPage] = useState(1)
    const [searchTerm, setSearchTerm] = useState('')
    const limit = 50

    // Modal form
    const [showModal, setShowModal] = useState(false)
    const [modalMode, setModalMode] = useState<'receive' | 'deliver'>('receive')
    const [editingId, setEditingId] = useState<string | null>(null)

    // Form fields
    const [form, setForm] = useState({
        item_name: '',
        quantity: 1,
        unit: 'Cái',
        from_department: '',
        to_department: '',
        notes: '',
        received_by: '',
        handed_by: '',
    })

    // Confirmation modal
    const [confirmAction, setConfirmAction] = useState<{
        type: 'receive' | 'deliver' | 'cancel' | 'delete'
        record: HandoverRecord | null
    }>({ type: 'receive', record: null })

    const { hasModule } = useSystem()

    const fetchRecords = useCallback(async () => {
        if (!currentSystem) return
        setLoading(true)

        try {
            const direction = activeTab === 'receive' ? 'inbound' : activeTab === 'deliver' ? 'outbound' : undefined
            const params = new URLSearchParams({
                system_code: currentSystem.code,
                page: String(page),
                limit: String(limit),
            })
            if (direction) params.set('direction', direction)
            if (searchTerm) params.set('q', searchTerm)

            const res = await fetch(`/api/handover?${params}`)
            const json = await res.json()

            if (json.data) {
                let filtered = json.data as HandoverRecord[]
                if (searchTerm) {
                    const q = searchTerm.toLowerCase()
                    filtered = filtered.filter(r =>
                        r.item_name.toLowerCase().includes(q) ||
                        (r.from_department || '').toLowerCase().includes(q) ||
                        (r.to_department || '').toLowerCase().includes(q) ||
                        (r.notes || '').toLowerCase().includes(q)
                    )
                }
                setRecords(filtered)
                setTotalCount(json.count || filtered.length)
            }
        } catch (err) {
            console.error('Fetch handover records error:', err)
        } finally {
            setLoading(false)
        }
    }, [currentSystem, activeTab, page, searchTerm])

    useEffect(() => {
        fetchRecords()
    }, [fetchRecords])

    const openModal = (mode: 'receive' | 'deliver', record?: HandoverRecord) => {
        setModalMode(mode)
        if (record) {
            setEditingId(record.id)
            setForm({
                item_name: record.item_name,
                quantity: record.quantity,
                unit: record.unit,
                from_department: record.from_department || '',
                to_department: record.to_department || '',
                notes: record.notes || '',
                received_by: record.received_by || '',
                handed_by: record.handed_by || '',
            })
        } else {
            setEditingId(null)
            setForm({
                item_name: '',
                quantity: 1,
                unit: 'Cái',
                from_department: mode === 'receive' ? 'Thu mua' : (currentSystem?.name || 'Kho'),
                to_department: mode === 'receive' ? (currentSystem?.name || 'Kho') : '',
                notes: '',
                received_by: '',
                handed_by: '',
            })
        }
        setShowModal(true)
    }

    const handleSave = async () => {
        if (!form.item_name.trim()) return

        const payload: any = {
            system_code: currentSystem?.code,
            company_id: currentSystem?.company_id || null,
            item_name: form.item_name.trim(),
            quantity: form.quantity,
            unit: form.unit,
            from_department: form.from_department || null,
            to_department: form.to_department || null,
            direction: modalMode === 'receive' ? 'inbound' : 'outbound',
            status: 'pending',
            notes: form.notes || null,
            received_by: form.received_by || null,
            handed_by: form.handed_by || null,
            created_by: (currentSystem as any)?.user_id || null,
            created_by_name: (currentSystem as any)?.user_name || null,
        }

        if (editingId) {
            payload.id = editingId
            await fetch('/api/handover', {
                method: 'PATCH',
                body: JSON.stringify(payload),
            })
        } else {
            await fetch('/api/handover', {
                method: 'POST',
                body: JSON.stringify(payload),
            })
        }

        setShowModal(false)
        fetchRecords()
    }

    const handleStatusChange = async (record: HandoverRecord, newStatus: 'received' | 'delivered' | 'cancelled') => {
        await fetch('/api/handover', {
            method: 'PATCH',
            body: JSON.stringify({
                id: record.id,
                status: newStatus,
                ...(newStatus === 'received' ? { received_by: (currentSystem as any)?.user_name || 'Người dùng' } : {}),
                ...(newStatus === 'delivered' ? { handed_by: (currentSystem as any)?.user_name || 'Người dùng' } : {}),
            }),
        })
        setConfirmAction({ type: 'receive', record: null })
        fetchRecords()
    }

    const handleDelete = async (id: string) => {
        await fetch(`/api/handover?id=${id}`, { method: 'DELETE' })
        setConfirmAction({ type: 'delete', record: null })
        fetchRecords()
    }

    const getStatusBadge = (status: string) => {
        const config: Record<string, { label: string; className: string }> = {
            pending: { label: 'Chờ xử lý', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
            received: { label: 'Đã nhận', className: 'bg-blue-100 text-blue-800 border-blue-200' },
            delivered: { label: 'Đã giao', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
            cancelled: { label: 'Đã hủy', className: 'bg-red-100 text-red-800 border-red-200' },
        }
        const c = config[status] || { label: status, className: 'bg-gray-100 text-gray-800 border-gray-200' }
        return (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${c.className}`}>
                {c.label}
            </span>
        )
    }

    if (!currentSystem) return null

    if (!hasModule('handover')) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-6">
                    <ArrowRightLeft size={40} className="text-slate-400" />
                </div>
                <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-2">
                    Bàn giao hàng hóa
                </h2>
                <p className="text-stone-500 max-w-md">
                    Tính năng "Bàn giao hàng hóa" chưa được bật cho kho này.
                    Vui lòng vào Cài đặt {'>'} Tiện ích hệ thống để kích hoạt.
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
                        <ArrowRightLeft className="text-indigo-600" size={32} />
                        Bàn giao hàng hóa
                    </h1>
                    <p className="text-stone-500 dark:text-gray-400 mt-1">
                        Quản lý nhận và giao hàng hóa trực tiếp giữa các bộ phận.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => openModal('receive')}
                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                    >
                        <Download size={20} />
                        Nhận hàng
                    </button>
                    <button
                        onClick={() => openModal('deliver')}
                        className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                    >
                        <ArrowRightLeft size={20} />
                        Giao hàng
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 mb-6 border-b border-stone-200 dark:border-zinc-800">
                <button
                    onClick={() => { setActiveTab('receive'); setPage(1); }}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'receive'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-500'
                        : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
                        }`}
                >
                    <Download size={18} />
                    Kho nhận hàng
                </button>
                <button
                    onClick={() => { setActiveTab('deliver'); setPage(1); }}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'deliver'
                        ? 'border-emerald-500 text-emerald-600 dark:text-emerald-500'
                        : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
                        }`}
                >
                    <ArrowRightLeft size={18} />
                    Kho giao hàng
                </button>
                <button
                    onClick={() => { setActiveTab('history'); setPage(1); }}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'history'
                        ? 'border-purple-500 text-purple-600 dark:text-purple-500'
                        : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
                        }`}
                >
                    <Search size={18} />
                    Lịch sử tất cả
                </button>
            </div>

            {/* Search */}
            <div className="relative mb-4 max-w-md">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                    type="text"
                    placeholder="Tìm kiếm theo tên hàng, bộ phận, ghi chú..."
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-stone-200 dark:border-zinc-700 overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900/50">
                                <th className="text-left px-4 py-3 font-bold text-stone-600 dark:text-stone-400">Tên hàng</th>
                                <th className="text-left px-4 py-3 font-bold text-stone-600 dark:text-stone-400">SL</th>
                                <th className="text-left px-4 py-3 font-bold text-stone-600 dark:text-stone-400">Đơn vị</th>
                                <th className="text-left px-4 py-3 font-bold text-stone-600 dark:text-stone-400">Từ bộ phận</th>
                                <th className="text-left px-4 py-3 font-bold text-stone-600 dark:text-stone-400">Đến bộ phận</th>
                                <th className="text-left px-4 py-3 font-bold text-stone-600 dark:text-stone-400">Trạng thái</th>
                                <th className="text-left px-4 py-3 font-bold text-stone-600 dark:text-stone-400">Người nhận/Giao</th>
                                <th className="text-left px-4 py-3 font-bold text-stone-600 dark:text-stone-400">Ghi chú</th>
                                <th className="text-left px-4 py-3 font-bold text-stone-600 dark:text-stone-400">Ngày</th>
                                <th className="text-right px-4 py-3 font-bold text-stone-600 dark:text-stone-400">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={10} className="text-center py-12 text-stone-400">
                                        Đang tải dữ liệu...
                                    </td>
                                </tr>
                            ) : records.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="text-center py-12 text-stone-400">
                                        Chưa có dữ liệu bàn giao nào.
                                    </td>
                                </tr>
                            ) : (
                                records.map((record) => (
                                    <tr key={record.id} className="hover:bg-stone-50 dark:hover:bg-zinc-700/50 transition-colors">
                                        <td className="px-4 py-3 font-bold text-stone-800 dark:text-stone-200 max-w-[200px] truncate" title={record.item_name}>
                                            {record.item_name}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-stone-700 dark:text-stone-300">{record.quantity}</td>
                                        <td className="px-4 py-3 text-stone-600 dark:text-stone-400">{record.unit}</td>
                                        <td className="px-4 py-3 text-stone-600 dark:text-stone-400 max-w-[150px] truncate" title={record.from_department || ''}>
                                            {record.from_department || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-stone-600 dark:text-stone-400 max-w-[150px] truncate" title={record.to_department || ''}>
                                            {record.to_department || '-'}
                                        </td>
                                        <td className="px-4 py-3">{getStatusBadge(record.status)}</td>
                                        <td className="px-4 py-3 text-stone-600 dark:text-stone-400 text-xs">
                                            {record.direction === 'inbound' ? (
                                                record.received_by ? <span className="text-blue-600">📥 {record.received_by}</span> : '-'
                                            ) : (
                                                record.handed_by ? <span className="text-emerald-600">📤 {record.handed_by}</span> : '-'
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-stone-500 dark:text-stone-400 text-xs max-w-[150px] truncate" title={record.notes || ''}>
                                            {record.notes || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-stone-500 dark:text-stone-400 text-xs whitespace-nowrap">
                                            {new Date(record.created_at).toLocaleDateString('vi-VN')}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                {record.status === 'pending' && record.direction === 'inbound' && (
                                                    <button
                                                        onClick={() => setConfirmAction({ type: 'receive', record })}
                                                        className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                                        title="Xác nhận đã nhận"
                                                    >
                                                        <Check size={16} />
                                                    </button>
                                                )}
                                                {record.status === 'pending' && record.direction === 'outbound' && (
                                                    <button
                                                        onClick={() => setConfirmAction({ type: 'deliver', record })}
                                                        className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                                                        title="Xác nhận đã giao"
                                                    >
                                                        <Check size={16} />
                                                    </button>
                                                )}
                                                {record.status === 'pending' && (
                                                    <button
                                                        onClick={() => setConfirmAction({ type: 'cancel', record })}
                                                        className="p-1.5 rounded-lg text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                                                        title="Hủy"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                )}
                                                {record.status === 'pending' && (
                                                    <button
                                                        onClick={() => openModal(record.direction === 'inbound' ? 'receive' : 'deliver', record)}
                                                        className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:hover:bg-zinc-700 transition-colors"
                                                        title="Sửa"
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                                                    </button>
                                                )}
                                                {(record.status === 'cancelled' || record.status === 'received' || record.status === 'delivered') && (
                                                    <button
                                                        onClick={() => setConfirmAction({ type: 'delete', record })}
                                                        className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                        title="Xóa"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
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
                                className="px-3 py-1 text-sm rounded-lg border border-stone-200 dark:border-zinc-700 disabled:opacity-30 hover:bg-stone-100 dark:hover:bg-zinc-700"
                            >
                                Trước
                            </button>
                            <span className="text-sm font-bold">{page}</span>
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={page * limit >= totalCount}
                                className="px-3 py-1 text-sm rounded-lg border border-stone-200 dark:border-zinc-700 disabled:opacity-30 hover:bg-stone-100 dark:hover:bg-zinc-700"
                            >
                                Sau
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal: Thêm/Sửa */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-800 rounded-3xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
                                    {modalMode === 'receive' ? (
                                        <Download size={24} className="text-blue-600" />
                                    ) : (
                                        <ArrowRightLeft size={24} className="text-emerald-600" />
                                    )}
                                    {editingId ? 'Sửa bàn giao' : modalMode === 'receive' ? 'Nhận hàng vào kho' : 'Giao hàng đi'}
                                </h3>
                                <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-zinc-700">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Tên hàng hóa *</label>
                                    <input
                                        type="text"
                                        value={form.item_name}
                                        onChange={(e) => setForm({ ...form, item_name: e.target.value })}
                                        placeholder="Ví dụ: Bóng đèn LED 20W"
                                        className="w-full px-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Số lượng</label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={form.quantity}
                                            onChange={(e) => setForm({ ...form, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                                            className="w-full px-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Đơn vị</label>
                                        <input
                                            type="text"
                                            value={form.unit}
                                            onChange={(e) => setForm({ ...form, unit: e.target.value })}
                                            placeholder="Cái, Kg, Thùng..."
                                            className="w-full px-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">
                                            {modalMode === 'receive' ? 'Từ bộ phận' : 'Từ bộ phận'}
                                        </label>
                                        <input
                                            type="text"
                                            value={form.from_department}
                                            onChange={(e) => setForm({ ...form, from_department: e.target.value })}
                                            placeholder="VD: Thu mua, Kho A..."
                                            className="w-full px-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">
                                            {modalMode === 'receive' ? 'Đến bộ phận' : 'Đến bộ phận'}
                                        </label>
                                        <input
                                            type="text"
                                            value={form.to_department}
                                            onChange={(e) => setForm({ ...form, to_department: e.target.value })}
                                            placeholder="VD: Kho chính, Đội thi công..."
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
                                    className={`px-6 py-2 text-sm font-bold text-white rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${modalMode === 'receive'
                                        ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                                        }`}
                                >
                                    {editingId ? 'Cập nhật' : modalMode === 'receive' ? 'Xác nhận nhận' : 'Xác nhận giao'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Dialog */}
            {confirmAction.record && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-800 rounded-3xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-in zoom-in-95 duration-200 p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                <AlertTriangle size={20} className="text-orange-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-stone-900 dark:text-white">
                                    {confirmAction.type === 'receive' && 'Xác nhận đã nhận hàng?'}
                                    {confirmAction.type === 'deliver' && 'Xác nhận đã giao hàng?'}
                                    {confirmAction.type === 'cancel' && 'Hủy bàn giao này?'}
                                    {confirmAction.type === 'delete' && 'Xóa bàn giao này?'}
                                </h3>
                            </div>
                        </div>
                        <p className="text-sm text-stone-500 mb-2">
                            <strong>{confirmAction.record.item_name}</strong> - SL: {confirmAction.record.quantity} {confirmAction.record.unit}
                        </p>
                        {confirmAction.type === 'delete' && (
                            <p className="text-xs text-red-500 mb-4">Hành động này không thể hoàn tác.</p>
                        )}
                        <div className="flex items-center justify-end gap-3 mt-4">
                            <button
                                onClick={() => setConfirmAction({ type: 'receive', record: null })}
                                className="px-4 py-2 text-sm font-bold text-stone-600 hover:bg-stone-100 dark:hover:bg-zinc-700 rounded-2xl transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={() => {
                                    if (confirmAction.type === 'receive') handleStatusChange(confirmAction.record!, 'received')
                                    else if (confirmAction.type === 'deliver') handleStatusChange(confirmAction.record!, 'delivered')
                                    else if (confirmAction.type === 'cancel') handleStatusChange(confirmAction.record!, 'cancelled')
                                    else if (confirmAction.type === 'delete') handleDelete(confirmAction.record!.id)
                                }}
                                className={`px-4 py-2 text-sm font-bold text-white rounded-2xl transition-colors ${confirmAction.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
                                    }`}
                            >
                                {confirmAction.type === 'receive' && 'Đã nhận'}
                                {confirmAction.type === 'deliver' && 'Đã giao'}
                                {confirmAction.type === 'cancel' && 'Hủy bàn giao'}
                                {confirmAction.type === 'delete' && 'Xóa vĩnh viễn'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}