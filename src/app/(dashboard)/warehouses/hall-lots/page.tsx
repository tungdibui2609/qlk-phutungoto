'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
    Truck,
    RotateCw,
    Search,
    Calendar,
    Clock,
    User,
    CheckCircle2,
    Clock3,
    Trash2,
    Layers,
    Eye,
    X,
    Package,
    Tag,
    AlertCircle,
    ChevronRight,
    ArrowUpDown,
    Download
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { format } from 'date-fns'

interface HallLotRecord {
    id: string
    system_code: string
    company_id: string | null
    hall_id: string | null
    hall_name: string
    lot_seqs: number[]
    total_lots: number
    created_by: string | null
    created_by_name: string | null
    notes: string | null
    status: 'PENDING' | 'PROCESSED' | 'CANCELLED'
    created_at: string
    updated_at: string
}

interface MatchedLotInfo {
    id: string
    daily_seq: number | null
    code: string
    production_code: string | null
    quantity: number | null
    product_name?: string
    sku?: string
    status?: string
}

export default function HallLotsPage() {
    const { systemType, currentSystem, hasModule } = useSystem()

    const [records, setRecords] = useState<HallLotRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    // Filters
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedHall, setSelectedHall] = useState<string>('ALL')
    const [selectedStatus, setSelectedStatus] = useState<string>('ALL')
    const [selectedDate, setSelectedDate] = useState<string>('')

    // Detail Modal
    const [selectedRecord, setSelectedRecord] = useState<HallLotRecord | null>(null)
    const [matchedLots, setMatchedLots] = useState<Record<number, MatchedLotInfo | null>>({})
    const [loadingLotMatch, setLoadingLotMatch] = useState(false)

    const isModuleEnabled = !currentSystem || hasModule('hall_lot_management')

    // Fetch records from database
    const loadRecords = useCallback(async () => {
        if (!systemType) return
        setLoading(true)
        try {
            let q = supabase
                .from('hall_lot_updates' as any)
                .select('*')
                .eq('system_code', systemType)
                .order('created_at', { ascending: false })

            const { data, error } = await q
            if (error) throw error
            setRecords((data || []) as HallLotRecord[])
        } catch (err: any) {
            console.error('Lỗi tải danh sách LOT sảnh:', err)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [systemType])

    useEffect(() => {
        loadRecords()
    }, [loadRecords])

    // List of unique halls in current records
    const availableHalls = useMemo(() => {
        const set = new Set<string>()
        records.forEach(r => {
            if (r.hall_name) set.add(r.hall_name)
        })
        return Array.from(set).sort()
    }, [records])

    // Filtered records
    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            if (selectedHall !== 'ALL' && r.hall_name !== selectedHall) return false
            if (selectedStatus !== 'ALL' && r.status !== selectedStatus) return false

            if (selectedDate) {
                const recDate = r.created_at ? format(new Date(r.created_at), 'yyyy-MM-dd') : ''
                if (recDate !== selectedDate) return false
            }

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim()
                const inHall = (r.hall_name || '').toLowerCase().includes(q)
                const inUser = (r.created_by_name || '').toLowerCase().includes(q)
                const inNotes = (r.notes || '').toLowerCase().includes(q)
                const inSeqs = (r.lot_seqs || []).some(seq => String(seq).includes(q))
                if (!inHall && !inUser && !inNotes && !inSeqs) return false
            }

            return true
        })
    }, [records, selectedHall, selectedStatus, selectedDate, searchQuery])

    // Handle delete record
    const handleDeleteRecord = async (id: string) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa bản ghi cập nhật sảnh này không?')) return
        try {
            const { error } = await supabase
                .from('hall_lot_updates' as any)
                .delete()
                .eq('id', id)
            if (error) throw error
            setRecords(prev => prev.filter(r => r.id !== id))
            if (selectedRecord?.id === id) setSelectedRecord(null)
        } catch (err: any) {
            alert('Lỗi xóa bản ghi: ' + err.message)
        }
    }

    // Handle update status
    const handleUpdateStatus = async (id: string, newStatus: 'PENDING' | 'PROCESSED' | 'CANCELLED') => {
        try {
            const { error } = await supabase
                .from('hall_lot_updates' as any)
                .update({ status: newStatus, updated_at: new Date().toISOString() } as any)
                .eq('id', id)
            if (error) throw error

            setRecords(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r))
            if (selectedRecord?.id === id) {
                setSelectedRecord(prev => prev ? { ...prev, status: newStatus } : null)
            }
        } catch (err: any) {
            alert('Lỗi cập nhật trạng thái: ' + err.message)
        }
    }

    // Load matching lot details when modal opens
    const openDetailModal = async (record: HallLotRecord) => {
        setSelectedRecord(record)
        setLoadingLotMatch(true)
        setMatchedLots({})

        try {
            const seqs = record.lot_seqs || []
            if (seqs.length === 0) {
                setLoadingLotMatch(false)
                return
            }

            // Find lots in database with matching daily_seq in this system_code
            const { data: lotsData, error } = await supabase
                .from('lots' as any)
                .select(`
                    id,
                    daily_seq,
                    code,
                    production_code,
                    quantity,
                    status,
                    lot_items (
                        product_id,
                        quantity,
                        products (
                            name,
                            sku
                        )
                    )
                `)
                .eq('system_code', systemType)
                .in('daily_seq', seqs)

            if (error) throw error

            const matchMap: Record<number, MatchedLotInfo | null> = {}
            seqs.forEach(seq => {
                matchMap[seq] = null
            });

            const items = (lotsData || []) as any[]
            items.forEach((lot: any) => {
                const s = lot.daily_seq
                if (s !== null && s !== undefined) {
                    const firstItem = lot.lot_items?.[0]
                    const prodName = firstItem?.products?.name || 'N/A'
                    const prodSku = firstItem?.products?.sku || ''

                    matchMap[s] = {
                        id: lot.id,
                        daily_seq: lot.daily_seq,
                        code: lot.code,
                        production_code: lot.production_code,
                        quantity: lot.quantity,
                        product_name: prodName,
                        sku: prodSku,
                        status: lot.status
                    }
                }
            })

            setMatchedLots(matchMap)
        } catch (e: any) {
            console.error('Lỗi tra cứu thông tin LOT:', e)
        } finally {
            setLoadingLotMatch(false)
        }
    }

    if (!isModuleEnabled) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="w-20 h-20 bg-stone-100 dark:bg-stone-800 rounded-3xl flex items-center justify-center mb-6">
                    <Truck size={40} className="text-stone-400" />
                </div>
                <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-2">Quản lý LOT ở Sảnh</h2>
                <p className="text-stone-500 max-w-md">
                    Tính năng chưa được kích hoạt cho kho này. Vui lòng vào Cài đặt → Cấu hình Phân hệ để bật module &quot;Quản lý LOT ở Sảnh&quot;.
                </p>
            </div>
        )
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                        <Truck size={28} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black text-stone-900 dark:text-stone-100 tracking-tight">
                                Quản Lý LOT Ở Sảnh
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                {currentSystem?.name || systemType}
                            </span>
                        </div>
                        <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
                            Tiếp nhận danh sách các LOT đang tập kết ở Sảnh được cập nhật từ App kiểm kê
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            setRefreshing(true)
                            loadRecords()
                        }}
                        disabled={refreshing || loading}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 font-bold text-sm transition-colors disabled:opacity-50"
                    >
                        <RotateCw size={16} className={refreshing ? 'animate-spin' : ''} />
                        Làm mới
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-stone-900 p-5 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-sm">
                    <div className="flex items-center justify-between text-stone-500 text-xs font-bold uppercase tracking-wider mb-2">
                        <span>Tổng đợt gửi</span>
                        <Layers size={16} className="text-blue-500" />
                    </div>
                    <div className="text-3xl font-black text-stone-900 dark:text-stone-100">
                        {records.length}
                    </div>
                    <div className="text-xs text-stone-400 mt-1">Từ các thiết bị di động</div>
                </div>

                <div className="bg-white dark:bg-stone-900 p-5 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-sm">
                    <div className="flex items-center justify-between text-stone-500 text-xs font-bold uppercase tracking-wider mb-2">
                        <span>Tổng số LOT ở Sảnh</span>
                        <Package size={16} className="text-amber-500" />
                    </div>
                    <div className="text-3xl font-black text-amber-600 dark:text-amber-400">
                        {records.reduce((sum, r) => sum + (r.total_lots || 0), 0)}
                    </div>
                    <div className="text-xs text-stone-400 mt-1">Ghi nhận qua STT pallet</div>
                </div>

                <div className="bg-white dark:bg-stone-900 p-5 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-sm">
                    <div className="flex items-center justify-between text-stone-500 text-xs font-bold uppercase tracking-wider mb-2">
                        <span>Chờ xử lý</span>
                        <Clock3 size={16} className="text-orange-500" />
                    </div>
                    <div className="text-3xl font-black text-orange-600 dark:text-orange-400">
                        {records.filter(r => r.status === 'PENDING').length}
                    </div>
                    <div className="text-xs text-stone-400 mt-1">Cần đối soát kho</div>
                </div>

                <div className="bg-white dark:bg-stone-900 p-5 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-sm">
                    <div className="flex items-center justify-between text-stone-500 text-xs font-bold uppercase tracking-wider mb-2">
                        <span>Đã tiếp nhận</span>
                        <CheckCircle2 size={16} className="text-emerald-500" />
                    </div>
                    <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                        {records.filter(r => r.status === 'PROCESSED').length}
                    </div>
                    <div className="text-xs text-stone-400 mt-1">Đã xác nhận kiểm tra</div>
                </div>
            </div>

            {/* Filters Toolbar */}
            <div className="bg-white dark:bg-stone-900 p-4 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                    <div className="relative flex-1 max-w-md">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input
                            type="text"
                            placeholder="Tìm theo sảnh, người gửi, số STT..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-stone-100 dark:bg-stone-800 border-none rounded-2xl text-sm font-medium text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:ring-2 focus:ring-amber-500 outline-none"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Filter Hall */}
                    <select
                        value={selectedHall}
                        onChange={e => setSelectedHall(e.target.value)}
                        className="px-3.5 py-2 bg-stone-100 dark:bg-stone-800 border-none rounded-2xl text-sm font-bold text-stone-700 dark:text-stone-200 outline-none cursor-pointer"
                    >
                        <option value="ALL">Tất cả Sảnh ({availableHalls.length})</option>
                        {availableHalls.map(h => (
                            <option key={h} value={h}>{h}</option>
                        ))}
                    </select>

                    {/* Filter Status */}
                    <select
                        value={selectedStatus}
                        onChange={e => setSelectedStatus(e.target.value)}
                        className="px-3.5 py-2 bg-stone-100 dark:bg-stone-800 border-none rounded-2xl text-sm font-bold text-stone-700 dark:text-stone-200 outline-none cursor-pointer"
                    >
                        <option value="ALL">Tất cả trạng thái</option>
                        <option value="PENDING">Chờ xử lý</option>
                        <option value="PROCESSED">Đã tiếp nhận</option>
                        <option value="CANCELLED">Đã hủy</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-stone-100 dark:bg-stone-800 px-3 py-1.5 rounded-2xl text-stone-600 dark:text-stone-300">
                        <Calendar size={14} className="text-stone-400" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            className="bg-transparent text-xs font-bold outline-none cursor-pointer"
                        />
                        {selectedDate && (
                            <button onClick={() => setSelectedDate('')} className="text-stone-400 hover:text-stone-600">
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* List Table / Cards */}
            <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200/80 dark:border-stone-800 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-16 flex flex-col items-center justify-center text-stone-400">
                        <RotateCw size={32} className="animate-spin mb-3 text-amber-500" />
                        <span className="text-sm font-bold">Đang tải danh sách LOT ở sảnh...</span>
                    </div>
                ) : filteredRecords.length === 0 ? (
                    <div className="p-16 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-400 mb-4">
                            <Truck size={28} />
                        </div>
                        <h3 className="text-base font-bold text-stone-700 dark:text-stone-200 mb-1">
                            Chưa có dữ liệu LOT ở Sảnh
                        </h3>
                        <p className="text-sm text-stone-400 max-w-sm">
                            Khi nhân viên sử dụng ứng dụng di động để nhập STT và gửi lên, danh sách sẽ hiển thị tự động tại đây.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-stone-100 dark:border-stone-800 text-[11px] font-black text-stone-400 uppercase tracking-wider bg-stone-50/60 dark:bg-stone-800/40">
                                    <th className="py-3.5 px-5">Thời gian</th>
                                    <th className="py-3.5 px-5">Sảnh</th>
                                    <th className="py-3.5 px-5">Người gửi</th>
                                    <th className="py-3.5 px-5 text-center">Số lượng</th>
                                    <th className="py-3.5 px-5">Danh sách STT LOT</th>
                                    <th className="py-3.5 px-5">Trạng thái</th>
                                    <th className="py-3.5 px-5 text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 dark:divide-stone-800 text-sm">
                                {filteredRecords.map(rec => (
                                    <tr
                                        key={rec.id}
                                        className="hover:bg-stone-50/80 dark:hover:bg-stone-800/50 transition-colors cursor-pointer group"
                                        onClick={() => openDetailModal(rec)}
                                    >
                                        <td className="py-4 px-5 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <Clock size={14} className="text-stone-400" />
                                                <span className="font-bold text-stone-800 dark:text-stone-200">
                                                    {rec.created_at ? format(new Date(rec.created_at), 'dd/MM/yyyy HH:mm') : '—'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-5 whitespace-nowrap">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50">
                                                <Truck size={12} />
                                                {rec.hall_name}
                                            </span>
                                        </td>
                                        <td className="py-4 px-5 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5 text-stone-600 dark:text-stone-300 font-medium text-xs">
                                                <User size={13} className="text-stone-400" />
                                                <span>{rec.created_by_name || 'Nhân viên'}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-5 text-center whitespace-nowrap">
                                            <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-xl text-xs font-black bg-amber-500 text-white shadow-sm shadow-amber-500/20">
                                                {rec.total_lots} LOT
                                            </span>
                                        </td>
                                        <td className="py-4 px-5 max-w-md">
                                            <div className="flex flex-wrap gap-1.5 max-h-14 overflow-hidden">
                                                {(rec.lot_seqs || []).slice(0, 15).map(seq => (
                                                    <span
                                                        key={seq}
                                                        className="px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-stone-200/60 dark:border-stone-700"
                                                    >
                                                        #{seq}
                                                    </span>
                                                ))}
                                                {(rec.lot_seqs || []).length > 15 && (
                                                    <span className="px-2 py-0.5 rounded-lg text-xs font-bold text-stone-400">
                                                        +{rec.lot_seqs.length - 15} nữa...
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4 px-5 whitespace-nowrap">
                                            {rec.status === 'PROCESSED' ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60">
                                                    <CheckCircle2 size={12} />
                                                    Đã tiếp nhận
                                                </span>
                                            ) : rec.status === 'CANCELLED' ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/60">
                                                    Đã hủy
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/60">
                                                    <Clock3 size={12} />
                                                    Chờ xử lý
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-4 px-5 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openDetailModal(rec)}
                                                    className="p-2 rounded-xl text-stone-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                                                    title="Xem chi tiết"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteRecord(rec.id)}
                                                    className="p-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                                    title="Xóa"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal Chi tiết & Đối soát */}
            {selectedRecord && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-stone-900 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                                    <Truck size={24} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-xl font-black text-stone-900 dark:text-stone-100">
                                            Chi Tiết LOT Tại {selectedRecord.hall_name}
                                        </h2>
                                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                            {selectedRecord.total_lots} LOT
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-stone-400 mt-1">
                                        <span>Gửi lúc: {format(new Date(selectedRecord.created_at), 'dd/MM/yyyy HH:mm:ss')}</span>
                                        <span>•</span>
                                        <span>Bởi: {selectedRecord.created_by_name || 'Nhân viên'}</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setSelectedRecord(null)}
                                className="w-10 h-10 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 flex items-center justify-center transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body: Danh sách LOT & Đối soát hệ thống */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            {selectedRecord.notes && (
                                <div className="p-4 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-2xl text-xs text-amber-900 dark:text-amber-200">
                                    <span className="font-bold">Ghi chú từ app:</span> {selectedRecord.notes}
                                </div>
                            )}

                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-black text-stone-800 dark:text-stone-200 uppercase tracking-wider">
                                        Đối soát Danh Sách STT Với Kho Dữ Liệu
                                    </h3>
                                    {loadingLotMatch && (
                                        <div className="flex items-center gap-1.5 text-xs text-amber-600 font-bold">
                                            <RotateCw size={12} className="animate-spin" />
                                            Đang tra cứu hệ thống...
                                        </div>
                                    )}
                                </div>

                                <div className="border border-stone-200/80 dark:border-stone-800 rounded-2xl overflow-hidden">
                                    <table className="w-full text-left text-sm">
                                        <thead>
                                            <tr className="bg-stone-50 dark:bg-stone-800/60 text-[11px] font-black text-stone-400 uppercase tracking-wider border-b border-stone-100 dark:border-stone-800">
                                                <th className="py-2.5 px-4">STT Nhập</th>
                                                <th className="py-2.5 px-4">Mã Pallet / Mã LOT</th>
                                                <th className="py-2.5 px-4">Mã Sản Xuất</th>
                                                <th className="py-2.5 px-4">Sản Phẩm</th>
                                                <th className="py-2.5 px-4 text-center">Số lượng</th>
                                                <th className="py-2.5 px-4 text-center">Tình trạng đối soát</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                                            {(selectedRecord.lot_seqs || []).map(seq => {
                                                const match = matchedLots[seq]
                                                return (
                                                    <tr key={seq} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/30">
                                                        <td className="py-3 px-4 font-mono font-black text-amber-600 dark:text-amber-400">
                                                            #{seq}
                                                        </td>
                                                        <td className="py-3 px-4 font-mono font-bold text-stone-800 dark:text-stone-200">
                                                            {match ? match.code : '—'}
                                                        </td>
                                                        <td className="py-3 px-4 font-mono text-xs text-stone-600 dark:text-stone-300">
                                                            {match?.production_code || '—'}
                                                        </td>
                                                        <td className="py-3 px-4 text-xs font-medium text-stone-700 dark:text-stone-300">
                                                            {match?.product_name ? (
                                                                <div>
                                                                    <div className="font-bold">{match.product_name}</div>
                                                                    {match.sku && <div className="text-[10px] text-stone-400">{match.sku}</div>}
                                                                </div>
                                                            ) : (
                                                                <span className="text-stone-400 italic">Chưa khớp với LOT trên web</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4 text-center font-mono font-bold text-xs">
                                                            {match?.quantity ? `${match.quantity} kg` : '—'}
                                                        </td>
                                                        <td className="py-3 px-4 text-center">
                                                            {match ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                                                    <CheckCircle2 size={11} />
                                                                    Đã tìm thấy LOT
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                                                    <AlertCircle size={11} />
                                                                    Chỉ có STT
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-stone-50 dark:bg-stone-800/40 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-stone-500">Chuyển trạng thái:</span>
                                <button
                                    onClick={() => handleUpdateStatus(selectedRecord.id, 'PROCESSED')}
                                    disabled={selectedRecord.status === 'PROCESSED'}
                                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 transition-colors"
                                >
                                    Đánh dấu Đã tiếp nhận
                                </button>
                                <button
                                    onClick={() => handleUpdateStatus(selectedRecord.id, 'PENDING')}
                                    disabled={selectedRecord.status === 'PENDING'}
                                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200 disabled:opacity-40 transition-colors"
                                >
                                    Để Chờ xử lý
                                </button>
                            </div>

                            <button
                                onClick={() => setSelectedRecord(null)}
                                className="px-5 py-2 rounded-2xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-bold text-xs"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
