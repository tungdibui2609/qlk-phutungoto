'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Factory, Calendar, Clock, User, CheckCircle2, XCircle, AlertTriangle, FileText, ArrowLeft, RefreshCw, BarChart3, TrendingUp, Package, Shield, Layers, Trash2 } from 'lucide-react'
import { useUser } from '@/contexts/UserContext'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

interface ShiftRecord {
    id: string
    system_code: string
    company_id: string | null
    status: 'open' | 'closed'
    opened_by_name: string | null
    opened_at: string
    closed_by_name: string | null
    closed_at: string | null
    summary_data: {
        total_sent?: number
        total_received?: number
        total_cancelled?: number
        units_summary?: Record<string, { sent: number; received: number; cancelled: number }>
        mo_summary?: any
    } | null
    notes: string | null
    created_at: string
}

export default function SanxuatDeliveryShiftsPage() {
    const { profile } = useUser()
    const [shifts, setShifts] = useState<ShiftRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedShift, setSelectedShift] = useState<ShiftRecord | null>(null)
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [shiftJournals, setShiftJournals] = useState<any[]>([])
    const [loadingJournals, setLoadingJournals] = useState(false)
    const [settingsMap, setSettingsMap] = useState<Record<string, { mo_code: string; mo_name: string }>>({})
    const [deleting, setDeleting] = useState(false)
    const [subShifts, setSubShifts] = useState<any[]>([])
    const [loadingSubShifts, setLoadingSubShifts] = useState(false)
    const canDelete = true

    // Tự động load settings map để phân rã mo_code ở Sản xuất
    useEffect(() => {
        const loadSettingsMap = async () => {
            const companyId = profile?.company_id
            if (!companyId) return
            try {
                // 1. Load delivery_settings
                const { data: settingsData, error: settingsError } = await (supabase as any)
                    .from('delivery_settings')
                    .select('id, mo_code, mo_id')
                    .eq('company_id', companyId)
                if (settingsError) throw settingsError

                // 2. Load productions
                const { data: prodsData, error: prodsError } = await (supabase as any)
                    .from('productions')
                    .select('id, name')
                    .eq('company_id', companyId)
                if (prodsError) throw prodsError

                const prodsMap = (prodsData || []).reduce((acc: Record<string, string>, p: any) => {
                    acc[p.id] = p.name
                    return acc
                }, {})

                const m: Record<string, { mo_code: string; mo_name: string }> = {}
                for (const s of (settingsData || [])) {
                    m[s.id] = { 
                        mo_code: s.mo_code || 'Không xác định', 
                        mo_name: s.mo_id ? (prodsMap[s.mo_id] || '') : '' 
                    }
                }
                setSettingsMap(m)
            } catch (err) {
                console.error('Error loading settings map:', err)
            }
        }
        loadSettingsMap()
    }, [profile?.company_id])

    // Load các sub-shifts (chốt tạm) của ca đang chọn ở Sản xuất
    useEffect(() => {
        const loadSubShifts = async () => {
            if (!selectedShift) {
                setSubShifts([])
                return
            }
            setLoadingSubShifts(true)
            try {
                const { data, error } = await (supabase as any)
                    .from('delivery_sub_shifts')
                    .select('*')
                    .eq('shift_id', selectedShift.id)
                    .eq('system_code', 'sanxuat')
                    .order('sub_shift_number', { ascending: true })
                if (error) throw error
                setSubShifts(data || [])
            } catch (err) {
                console.error('Error loading sub-shifts:', err)
            } finally {
                setLoadingSubShifts(false)
            }
        }
        loadSubShifts()
    }, [selectedShift])

    // Load các đợt giao nhận thuộc ca làm việc đang chọn ở Sản xuất
    useEffect(() => {
        const loadShiftJournals = async () => {
            if (!selectedShift) {
                setShiftJournals([])
                return
            }
            setLoadingJournals(true)
            try {
                const companyId = profile?.company_id
                if (!companyId) return

                let query = (supabase as any)
                    .from('delivery_journal')
                    .select('*')
                    .eq('company_id', companyId)
                    .gte('sent_at', selectedShift.opened_at)

                if (selectedShift.closed_at) {
                    query = query.lte('sent_at', selectedShift.closed_at)
                }

                const { data, error } = await query
                if (error) throw error
                setShiftJournals(data || [])
            } catch (err) {
                console.error('Error loading shift journals:', err)
            } finally {
                setLoadingJournals(false)
            }
        }

        loadShiftJournals()
    }, [selectedShift, profile?.company_id])

    // Tự động gom nhóm Lệnh sản xuất từ danh sách journal ở Sản xuất
    const getMoSummary = () => {
        const mo_summary: Record<string, {
            mo_code: string
            mo_name: string
            products: Record<string, {
                product_name: string
                unit: string
                from_department: 'Kho' | 'Sản xuất'
                sent: number
                received: number
                cancelled: number
            }>
        }> = {}

        for (const j of shiftJournals) {
            const sInfo = j.setting_id ? settingsMap[j.setting_id] : null
            const moCode = sInfo?.mo_code || 'Không xác định'
            const moName = sInfo?.mo_name || ''
            const unit = j.unit || 'Thùng'
            const prodName = j.item_name || 'Hàng hóa'
            const fromDept = j.from_department || 'Kho'

            if (!mo_summary[moCode]) {
                mo_summary[moCode] = {
                    mo_code: moCode,
                    mo_name: moName,
                    products: {}
                }
            }

            const prodKey = `${prodName}_${unit}_${fromDept}`
            if (!mo_summary[moCode].products[prodKey]) {
                mo_summary[moCode].products[prodKey] = {
                    product_name: prodName,
                    unit: unit,
                    from_department: fromDept,
                    sent: 0,
                    received: 0,
                    cancelled: 0
                }
            }

            mo_summary[moCode].products[prodKey].sent += j.quantity_sent || 0
            if (j.status === 'received_by_warehouse' || j.status === 'received_by_production') {
                mo_summary[moCode].products[prodKey].received += j.quantity_sent || 0
            } else if (j.status === 'cancelled') {
                mo_summary[moCode].products[prodKey].cancelled += j.quantity_sent || 0
            }
        }

        return mo_summary
    }

    // Tính toán tổng số lượng gửi và nhận động, bóc tách theo hướng giao nhận
    const getShiftTotals = () => {
        const initGroup = () => ({
            sentUnits: {} as Record<string, number>,
            receivedUnits: {} as Record<string, number>,
            cancelledUnits: {} as Record<string, number>,
            sentCount: 0,
            receivedCount: 0,
            cancelledCount: 0
        })

        const w2p = initGroup() // Kho -> Sản xuất (Cấp vật tư)
        const p2w = initGroup() // Sản xuất -> Kho (Nhập thành phẩm)

        const processJournal = (j: any, group: ReturnType<typeof initGroup>) => {
            const unit = j.unit || 'Thùng'
            const qtySent = Number(j.quantity_sent) || 0

            group.sentCount++
            group.sentUnits[unit] = (group.sentUnits[unit] || 0) + qtySent

            if (j.status !== 'sent' && j.status !== 'cancelled') {
                group.receivedCount++
                group.receivedUnits[unit] = (group.receivedUnits[unit] || 0) + qtySent
            } else if (j.status === 'cancelled') {
                group.cancelledCount++
                group.cancelledUnits[unit] = (group.cancelledUnits[unit] || 0) + qtySent
            }
        }

        if (shiftJournals && shiftJournals.length > 0) {
            for (const j of shiftJournals) {
                if (j.from_department === 'Kho') {
                    processJournal(j, w2p)
                } else if (j.from_department === 'Sản xuất') {
                    processJournal(j, p2w)
                }
            }
        } else {
            const summary = selectedShift?.summary_data
            if (summary?.units_summary) {
                for (const [unit, data] of Object.entries(summary.units_summary) as any) {
                    w2p.sentUnits[unit] = data.sent || 0
                    w2p.receivedUnits[unit] = data.received || 0
                    w2p.cancelledUnits[unit] = data.cancelled || 0
                }
                w2p.sentCount = summary?.total_sent || 0
                w2p.receivedCount = summary?.total_received || 0
                w2p.cancelledCount = summary?.total_cancelled || 0
            }
        }

        const formatUnitQty = (unitsMap: Record<string, number>) => {
            const entries = Object.entries(unitsMap)
            if (entries.length === 0) return '0 hàng hóa'
            return entries.map(([unit, qty]) => `${qty} ${unit}`).join(', ')
        }

        return {
            w2p: {
                sentCount: w2p.sentCount,
                receivedCount: w2p.receivedCount,
                cancelledCount: w2p.cancelledCount,
                sentQuantityText: formatUnitQty(w2p.sentUnits),
                receivedQuantityText: formatUnitQty(w2p.receivedUnits),
                cancelledQuantityText: formatUnitQty(w2p.cancelledUnits),
            },
            p2w: {
                sentCount: p2w.sentCount,
                receivedCount: p2w.receivedCount,
                cancelledCount: p2w.cancelledCount,
                sentQuantityText: formatUnitQty(p2w.sentUnits),
                receivedQuantityText: formatUnitQty(p2w.receivedUnits),
                cancelledQuantityText: formatUnitQty(p2w.cancelledUnits),
            }
        }
    }

    const loadShifts = useCallback(async () => {
        const companyId = profile?.company_id
        if (!companyId) return
        setLoading(true)
        try {
            let query = (supabase as any)
                .from('delivery_shifts')
                .select('*')
                .eq('company_id', companyId)
                .eq('system_code', 'sanxuat')
                .order('created_at', { ascending: false })

            const { data, error } = await query
            if (error) throw error
            setShifts(data || [])
            
            // Auto-select first shift if none selected
            if (data && data.length > 0 && !selectedShift) {
                setSelectedShift(data[0])
            }
        } catch (err) {
            console.error('Error loading shifts:', err)
        } finally {
            setLoading(false)
        }
    }, [profile, selectedShift])

    useEffect(() => {
        loadShifts()
    }, [profile?.company_id])

    const formatDateTime = (dateStr: string | null) => {
        if (!dateStr) return '--'
        try {
            const d = new Date(dateStr)
            return d.toLocaleString('vi-VN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            })
        } catch {
            return dateStr
        }
    }

    const getDuration = (start: string, end: string | null) => {
        if (!end) return 'Đang chạy...'
        try {
            const diffMs = new Date(end).getTime() - new Date(start).getTime()
            const diffMins = Math.floor(diffMs / 60000)
            const hours = Math.floor(diffMins / 600)
            const mins = diffMins % 60
            if (hours > 0) {
                return `${hours} giờ ${mins} phút`
            }
            return `${mins} phút`
        } catch {
            return '--'
        }
    }

    const handleDeleteShift = async (shiftId: string) => {
        const password = prompt('Nhập mật khẩu xác nhận xóa báo cáo chốt ca:')
        if (password === null) return // Hủy bỏ
        if (password !== 'Chanhthu@123') {
            alert('Mật khẩu không chính xác!')
            return
        }

        if (!confirm('Bạn có chắc chắn muốn xóa báo cáo chốt ca này? Hành động này không thể hoàn tác.')) {
            return
        }

        setDeleting(true)
        try {
            const { error } = await supabase
                .from('delivery_shifts')
                .delete()
                .eq('id', shiftId)

            if (error) throw error

            alert('Đã xóa báo cáo chốt ca thành công.')
            setSelectedShift(null)
            loadShifts()
        } catch (err: any) {
            console.error('Error deleting shift:', err)
            alert('Lỗi khi xóa ca: ' + (err.message || err))
        } finally {
            setDeleting(false)
        }
    }

    const filteredShifts = shifts.filter(s => {
        if (filterStatus === 'all') return true
        return s.status === filterStatus
    })

    return (
        <div className="min-h-screen bg-stone-50 dark:bg-zinc-900 text-stone-800 dark:text-stone-100 p-4 md:p-6 pb-20 animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400 text-xs font-semibold uppercase tracking-wider mb-1">
                        <Factory size={14} className="text-emerald-500" />
                        <span>Sản xuất</span>
                        <span>•</span>
                        <span>Ca làm việc</span>
                    </div>
                    <h1 className="text-2xl font-black text-stone-900 dark:text-white flex items-center gap-2">
                        <Clock className="text-emerald-500" /> Lịch Sử Ca & Đối Soát SX
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <Link 
                        href="/sanxuat/delivery-journal"
                        className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-zinc-800 hover:bg-stone-100 border border-stone-200 dark:border-zinc-700 rounded-xl text-xs font-bold transition-all shadow-sm"
                    >
                        <ArrowLeft size={14} /> Nhật ký giao nhận
                    </Link>
                    <button 
                        onClick={loadShifts}
                        className="p-2 bg-white dark:bg-zinc-800 hover:bg-stone-100 border border-stone-200 dark:border-zinc-700 rounded-xl text-stone-600 dark:text-stone-300 transition-all shadow-sm"
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            {/* Quick Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl border border-stone-200 dark:border-zinc-700 shadow-sm">
                    <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Tổng số ca</div>
                    <div className="text-2xl font-black mt-1 text-stone-800 dark:text-white">{shifts.length}</div>
                </div>
                <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl border border-stone-200 dark:border-zinc-700 shadow-sm">
                    <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Ca đang mở</div>
                    <div className="text-2xl font-black mt-1 text-emerald-600 animate-pulse">
                        {shifts.filter(s => s.status === 'open').length}
                    </div>
                </div>
                <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl border border-stone-200 dark:border-zinc-700 shadow-sm">
                    <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Tổng gửi (Đợt)</div>
                    <div className="text-2xl font-black mt-1 text-blue-600">
                        {shifts.reduce((acc, s) => acc + (s.summary_data?.total_sent || 0), 0)}
                    </div>
                </div>
                <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl border border-stone-200 dark:border-zinc-700 shadow-sm">
                    <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Tổng nhận (Đợt)</div>
                    <div className="text-2xl font-black mt-1 text-emerald-600">
                        {shifts.reduce((acc, s) => acc + (s.summary_data?.total_received || 0), 0)}
                    </div>
                </div>
            </div>

            {/* Bố cục Master-Detail */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* Column Left: Danh sách ca (Master) */}
                <div className="lg:col-span-1 bg-white dark:bg-zinc-800 rounded-2xl border border-stone-200 dark:border-zinc-700 shadow-sm overflow-hidden flex flex-col max-h-[600px]">
                    <div className="p-4 border-b border-stone-100 dark:border-zinc-700 flex items-center justify-between gap-3">
                        <span className="font-bold text-sm">Danh sách ca làm việc</span>
                        <select 
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="px-2 py-1 bg-stone-50 dark:bg-zinc-700 border border-stone-200 dark:border-zinc-600 rounded-lg text-xs font-semibold"
                        >
                            <option value="all">Tất cả ca</option>
                            <option value="open">Đang mở</option>
                            <option value="closed">Đã chốt</option>
                        </select>
                    </div>

                    <div className="divide-y divide-stone-100 dark:divide-zinc-700 overflow-y-auto flex-1">
                        {loading ? (
                            <div className="p-8 text-center text-stone-400 flex flex-col items-center gap-2">
                                <RefreshCw className="animate-spin text-emerald-500" size={24} />
                                <span className="text-xs">Đang tải ca làm việc...</span>
                            </div>
                        ) : filteredShifts.length === 0 ? (
                            <div className="p-8 text-center text-stone-400 text-xs">
                                Chưa ghi nhận ca làm việc nào.
                            </div>
                        ) : (
                            filteredShifts.map((s) => {
                                const isSelected = selectedShift?.id === s.id
                                return (
                                    <div 
                                        key={s.id}
                                        onClick={() => setSelectedShift(s)}
                                        className={`p-4 cursor-pointer hover:bg-stone-50/50 dark:hover:bg-zinc-700/30 transition-all border-l-4 ${
                                            isSelected 
                                                ? 'bg-emerald-50/30 dark:bg-emerald-950/10 border-l-emerald-500' 
                                                : s.status === 'open' 
                                                    ? 'border-l-emerald-500' 
                                                    : 'border-l-transparent'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2 mb-1.5">
                                            <span className="text-xs font-mono font-bold text-stone-600 dark:text-stone-300">
                                                {formatDateTime(s.opened_at).split(' ')[1] || ''} - {s.status === 'open' ? 'Đang chạy' : formatDateTime(s.closed_at).split(' ')[1] || ''}
                                            </span>
                                            {s.status === 'open' ? (
                                                <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[9px] font-black uppercase animate-pulse">
                                                    Đang chạy
                                                </span>
                                            ) : (
                                                <span className="px-1.5 py-0.5 rounded-md bg-stone-100 dark:bg-zinc-700 text-stone-500 text-[9px] font-bold">
                                                    Đã chốt
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs font-bold text-stone-800 dark:text-white flex items-center gap-1">
                                            <User size={12} className="text-stone-400" /> {s.opened_by_name || 'Nhân viên'}
                                        </div>
                                        <div className="text-[10px] text-stone-400 mt-1 flex items-center justify-between gap-2">
                                            <span>Ngày: {formatDateTime(s.opened_at).split(' ')[0] || ''}</span>
                                            <span>Duration: {getDuration(s.opened_at, s.closed_at)}</span>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* Column Right: Chi tiết đối soát ca (Detail) */}
                <div className="lg:col-span-2 bg-white dark:bg-zinc-800 rounded-2xl border border-stone-200 dark:border-zinc-700 shadow-sm overflow-hidden min-h-[400px]">
                    {selectedShift ? (
                        <div>
                            {/* Shift Detail Header */}
                            <div className="p-4 md:p-6 bg-stone-50/50 dark:bg-zinc-800/50 border-b border-stone-100 dark:border-zinc-700">
                                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="text-emerald-500" size={16} />
                                        <h2 className="font-black text-stone-900 dark:text-white text-base">
                                            Báo Cáo Đối Soát Ca Làm Việc
                                        </h2>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2.5 py-1 rounded-xl text-xs font-extrabold ${
                                            selectedShift.status === 'open' 
                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 animate-pulse' 
                                                : 'bg-stone-100 text-stone-600 dark:bg-zinc-700 dark:text-zinc-300'
                                        }`}>
                                            {selectedShift.status === 'open' ? '🔴 Ca đang hoạt động' : '✓ Đã chốt ca hoàn tất'}
                                        </span>
                                        {canDelete && (
                                            <button
                                                onClick={() => handleDeleteShift(selectedShift.id)}
                                                disabled={deleting}
                                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/30 rounded-xl transition-all border border-red-200/50 dark:border-red-900/30 disabled:opacity-50"
                                            >
                                                <Trash2 size={13} /> {deleting ? 'Đang xóa...' : 'Xóa ca'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-stone-500 dark:text-stone-400 mt-4">
                                    <div className="space-y-1.5">
                                        <div>🟢 Giờ mở ca: <strong className="text-stone-700 dark:text-stone-200">{formatDateTime(selectedShift.opened_at)}</strong></div>
                                        <div>👤 Người mở: <strong className="text-stone-700 dark:text-stone-200">{selectedShift.opened_by_name || '--'}</strong></div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div>🔴 Giờ chốt ca: <strong className="text-stone-700 dark:text-stone-200">{formatDateTime(selectedShift.closed_at)}</strong></div>
                                        <div>👤 Người chốt: <strong className="text-stone-700 dark:text-stone-200">{selectedShift.closed_by_name || '--'}</strong></div>
                                    </div>
                                </div>
                            </div>

                            {/* Summary Cards */}
                            <div className="p-4 md:p-6">
                                <h3 className="font-bold text-sm mb-4 flex items-center gap-1.5"><BarChart3 size={16} className="text-emerald-500" /> Tổng hợp số liệu giao nhận</h3>
                                {(() => {
                                    const totals = getShiftTotals()
                                    return (
                                        <div className="space-y-6">
                                            {/* Hướng 1: Kho -> Sản xuất (Cấp vật tư) */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1">
                                                        📦 1. Cấp Vật Tư (Xuất Kho: Kho → Sản Xuất)
                                                    </h4>
                                                    <span className="text-[10px] text-stone-400 font-semibold">Xuất nguyên vật liệu</span>
                                                </div>
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div className="bg-blue-50/30 dark:bg-blue-950/10 p-3.5 rounded-xl border border-blue-100/50 dark:border-blue-900/30 text-center flex flex-col justify-between min-h-[90px] shadow-sm transition-all hover:shadow-md">
                                                        <div className="text-[10px] text-blue-650 dark:text-blue-400 font-bold uppercase tracking-wider">Tổng xuất</div>
                                                        <div className="text-lg font-black mt-1 text-blue-700 dark:text-blue-450">
                                                            {totals.w2p.sentCount} đợt
                                                        </div>
                                                        <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-1 truncate font-medium px-1" title={totals.w2p.sentQuantityText}>
                                                            {totals.w2p.sentQuantityText}
                                                        </div>
                                                    </div>
                                                    <div className="bg-emerald-50/50 dark:bg-emerald-950/10 p-3.5 rounded-xl border border-emerald-100/50 dark:border-emerald-900/30 text-center flex flex-col justify-between min-h-[90px] shadow-sm transition-all hover:shadow-md">
                                                        <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">SX đã nhận</div>
                                                        <div className="text-lg font-black mt-1 text-emerald-600">
                                                            {totals.w2p.receivedCount} đợt
                                                        </div>
                                                        <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-1 truncate font-medium px-1" title={totals.w2p.receivedQuantityText}>
                                                            {totals.w2p.receivedQuantityText}
                                                        </div>
                                                    </div>
                                                    <div className="bg-rose-50/50 dark:bg-rose-950/10 p-3.5 rounded-xl border border-rose-100/50 dark:border-rose-900/30 text-center flex flex-col justify-between min-h-[90px] shadow-sm transition-all hover:shadow-md">
                                                        <div className="text-[10px] text-rose-600 font-bold uppercase tracking-wider">SX từ chối</div>
                                                        <div className="text-lg font-black mt-1 text-rose-600">
                                                            {totals.w2p.cancelledCount} đợt
                                                        </div>
                                                        <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-1 truncate font-medium px-1" title={totals.w2p.cancelledQuantityText}>
                                                            {totals.w2p.cancelledQuantityText}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Hướng 2: Sản xuất -> Kho (Nhập thành phẩm) */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1">
                                                        📥 2. Nhập Thành Phẩm (Nhập Kho: Sản Xuất → Kho)
                                                    </h4>
                                                    <span className="text-[10px] text-stone-400 font-semibold">Thu hồi & nhập kho thành phẩm</span>
                                                </div>
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div className="bg-purple-50/30 dark:bg-purple-950/10 p-3.5 rounded-xl border border-purple-100/50 dark:border-purple-900/30 text-center flex flex-col justify-between min-h-[90px] shadow-sm transition-all hover:shadow-md">
                                                        <div className="text-[10px] text-purple-650 dark:text-purple-400 font-bold uppercase tracking-wider">Tổng nhập về</div>
                                                        <div className="text-lg font-black mt-1 text-purple-700 dark:text-purple-450">
                                                            {totals.p2w.sentCount} đợt
                                                        </div>
                                                        <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-1 truncate font-medium px-1" title={totals.p2w.sentQuantityText}>
                                                            {totals.p2w.sentQuantityText}
                                                        </div>
                                                    </div>
                                                    <div className="bg-emerald-50/50 dark:bg-emerald-950/10 p-3.5 rounded-xl border border-emerald-100/50 dark:border-emerald-900/30 text-center flex flex-col justify-between min-h-[90px] shadow-sm transition-all hover:shadow-md">
                                                        <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Kho đã nhận</div>
                                                        <div className="text-lg font-black mt-1 text-emerald-600">
                                                            {totals.p2w.receivedCount} đợt
                                                        </div>
                                                        <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-1 truncate font-medium px-1" title={totals.p2w.receivedQuantityText}>
                                                            {totals.p2w.receivedQuantityText}
                                                        </div>
                                                    </div>
                                                    <div className="bg-rose-50/50 dark:bg-rose-950/10 p-3.5 rounded-xl border border-rose-100/50 dark:border-rose-900/30 text-center flex flex-col justify-between min-h-[90px] shadow-sm transition-all hover:shadow-md">
                                                        <div className="text-[10px] text-rose-600 font-bold uppercase tracking-wider">Kho từ chối</div>
                                                        <div className="text-lg font-black mt-1 text-rose-600">
                                                            {totals.p2w.cancelledCount} đợt
                                                        </div>
                                                        <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-1 truncate font-medium px-1" title={totals.p2w.cancelledQuantityText}>
                                                            {totals.p2w.cancelledQuantityText}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })()}

                                {/* Units Breakdown */}
                                {selectedShift.summary_data?.units_summary && Object.keys(selectedShift.summary_data.units_summary).length > 0 && (
                                    <div className="mb-6">
                                        <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2.5">Chi tiết theo đơn vị hàng hóa</h4>
                                        <div className="border border-stone-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="bg-stone-50 dark:bg-zinc-800/60 border-b border-stone-200 dark:border-zinc-700 text-left font-bold text-stone-500">
                                                        <th className="p-3">Đơn vị</th>
                                                        <th className="p-3 text-right">Tổng gửi</th>
                                                        <th className="p-3 text-right text-emerald-600">Thành công</th>
                                                        <th className="p-3 text-right text-rose-600">Từ chối</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-stone-100 dark:divide-zinc-700">
                                                    {Object.entries(selectedShift.summary_data.units_summary).map(([unit, data]) => (
                                                        <tr key={unit} className="hover:bg-stone-50/30 dark:hover:bg-zinc-700/10">
                                                            <td className="p-3 font-semibold text-stone-700 dark:text-stone-300">{unit}</td>
                                                            <td className="p-3 text-right font-bold text-stone-800 dark:text-white">{data.sent}</td>
                                                            <td className="p-3 text-right font-bold text-emerald-600">{data.received}</td>
                                                            <td className="p-3 text-right font-bold text-rose-600">{data.cancelled}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* MO Breakdown */}
                                {loadingJournals ? (
                                    <div className="mb-6 p-6 bg-stone-50 dark:bg-zinc-800/40 border border-stone-200/50 dark:border-zinc-700/50 rounded-xl text-center flex flex-col items-center gap-2">
                                        <RefreshCw className="animate-spin text-emerald-500" size={20} />
                                        <span className="text-xs text-stone-400">Đang tải đối soát Lệnh sản xuất...</span>
                                    </div>
                                ) : (
                                    (() => {
                                        const moSummaryData = getMoSummary()
                                        if (Object.keys(moSummaryData).length === 0) {
                                            return (
                                                <div className="mb-6 p-4 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100/50 dark:border-amber-900/20 rounded-xl text-xs text-amber-600 flex items-center gap-1.5 font-medium">
                                                    <AlertTriangle size={14} /> Không tìm thấy đợt giao nhận nào phát sinh trong ca làm việc này.
                                                </div>
                                            )
                                        }
                                        return (
                                            <div className="mb-6">
                                                <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                                    <Layers size={13} className="text-emerald-500" /> Đối soát chi tiết theo Lệnh sản xuất (MO)
                                                </h4>
                                                <div className="space-y-4">
                                                    {Object.entries(moSummaryData).map(([moCode, moData]: any) => (
                                                        <div key={moCode} className="bg-stone-50/50 dark:bg-zinc-900/50 border border-stone-200/50 dark:border-zinc-700/50 rounded-xl p-3 shadow-sm">
                                                            <div className="text-xs font-black text-emerald-650 dark:text-emerald-400 mb-2 flex items-center justify-between">
                                                                <span className="flex items-center gap-1">🛠 Lệnh SX: <strong className="text-stone-850 dark:text-stone-100">{moCode} {moData.mo_name ? `(${moData.mo_name})` : ''}</strong></span>
                                                                <span className="text-[10px] text-stone-400 font-bold bg-stone-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded">
                                                                    {Object.keys(moData.products).length} sản phẩm
                                                                </span>
                                                            </div>
                                                            <div className="border border-stone-200/40 dark:border-zinc-700/40 rounded-lg overflow-hidden bg-white dark:bg-zinc-800">
                                                                <table className="w-full text-[11px] text-left">
                                                                    <thead>
                                                                        <tr className="bg-stone-100/50 dark:bg-zinc-700/30 font-bold text-stone-500 border-b border-stone-200/40">
                                                                            <th className="p-2">Tên sản phẩm</th>
                                                                            <th className="p-2 text-right">Tổng gửi</th>
                                                                            <th className="p-2 text-right text-emerald-600">Thành công</th>
                                                                            <th className="p-2 text-right text-rose-600">Từ chối</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {Object.entries(moData.products).map(([prodKey, p]: any) => (
                                                                            <tr key={prodKey} className="border-b border-stone-100 dark:border-zinc-700/30 hover:bg-stone-50/30 dark:hover:bg-zinc-700/10">
                                                                                <td className="p-2 font-semibold text-stone-700 dark:text-stone-300">
                                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                                        <span>{p.product_name}</span>
                                                                                        <span className="text-[9px] text-stone-400 font-bold">({p.unit})</span>
                                                                                        {p.from_department === 'Kho' ? (
                                                                                            <span className="text-[9px] px-1.5 py-0.5 rounded font-black bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-100/50 dark:border-blue-900/30 flex items-center gap-0.5">
                                                                                                📦 Kho → SX (Xuất)
                                                                                            </span>
                                                                                        ) : (
                                                                                            <span className="text-[9px] px-1.5 py-0.5 rounded font-black bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-100/50 dark:border-purple-900/30 flex items-center gap-0.5">
                                                                                                📥 SX → Kho (Nhập)
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </td>
                                                                                <td className="p-2 text-right font-bold text-stone-855 dark:text-stone-250">{p.sent}</td>
                                                                                <td className="p-2 text-right text-emerald-600 font-bold">{p.received}</td>
                                                                                <td className="p-2 text-right text-rose-600 font-bold">{p.cancelled}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    })()
                                )}

                                {/* Lịch sử Chốt Ca Tạm (Sub-shifts Timeline) */}
                                {subShifts.length > 0 && (
                                    <div className="mb-6 border-t border-stone-100 dark:border-zinc-700/50 pt-6">
                                        <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                                            <Layers size={13} className="text-amber-500" /> Chi tiết các lần chốt ca tạm (đổi ca)
                                        </h4>
                                        <div className="relative border-l border-amber-200 dark:border-amber-900/40 ml-2.5 pl-5 space-y-6">
                                            {subShifts.map((ss: any) => {
                                                const summary = ss.summary_data || {}
                                                return (
                                                    <div key={ss.id} className="relative group">
                                                        {/* Timeline node */}
                                                        <span className="absolute -left-[26px] top-1 flex items-center justify-center w-3 h-3 bg-amber-500 rounded-full ring-4 ring-white dark:ring-zinc-800 transition-all group-hover:scale-125" />
                                                        
                                                        <div className="bg-stone-50/50 dark:bg-zinc-900/50 hover:bg-stone-50 dark:hover:bg-zinc-900 border border-stone-200/50 dark:border-zinc-700/50 rounded-2xl p-4 shadow-sm transition-all duration-200">
                                                            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                                                 <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                                                                    Lần chốt ca tạm #{ss.sub_shift_number}
                                                                </span>
                                                                <span className="text-[10px] font-bold text-stone-450 dark:text-stone-400">
                                                                    ⏱ {formatDateTime(ss.from_time).split(' ')[1] || ''} → {formatDateTime(ss.to_time).split(' ')[1] || ''} ({formatDateTime(ss.to_time).split(' ')[0] || ''})
                                                                </span>
                                                            </div>

                                                            {/* Mini Summary Grid */}
                                                            <div className="grid grid-cols-3 gap-2 text-center mb-3">
                                                                <div className="p-1.5 bg-white dark:bg-zinc-800 rounded-xl border border-stone-200/40 text-[11px]">
                                                                    <div className="text-[9px] text-stone-400 font-bold uppercase">Gửi</div>
                                                                    <div className="font-extrabold mt-0.5 text-stone-700 dark:text-stone-300">{summary.total_sent || 0} đợt</div>
                                                                </div>
                                                                <div className="p-1.5 bg-emerald-50/30 dark:bg-emerald-950/10 rounded-xl border border-emerald-100/30 text-[11px] text-emerald-600">
                                                                    <div className="text-[9px] font-bold uppercase">Thành công</div>
                                                                    <div className="font-extrabold mt-0.5">{summary.total_received || 0} đợt</div>
                                                                </div>
                                                                <div className="p-1.5 bg-rose-50/30 dark:bg-rose-950/10 rounded-xl border border-rose-100/30 text-[11px] text-rose-600">
                                                                    <div className="text-[9px] font-bold uppercase">Từ chối</div>
                                                                    <div className="font-extrabold mt-0.5">{summary.total_cancelled || 0} đợt</div>
                                                                </div>
                                                            </div>

                                                            {/* Units breakdown in sub-shift */}
                                                            {summary.units_summary && Object.keys(summary.units_summary).length > 0 && (
                                                                <div className="text-[10px] bg-white dark:bg-zinc-800 border border-stone-200/30 dark:border-zinc-700/30 rounded-xl p-2 mb-3">
                                                                    <div className="font-bold text-stone-400 mb-1">Chi tiết hàng hóa bàn giao:</div>
                                                                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                                                                        {Object.entries(summary.units_summary).map(([unit, data]: any) => (
                                                                            <div key={unit} className="text-stone-600 dark:text-stone-300">
                                                                                • <strong className="text-stone-800 dark:text-white">{unit}</strong>: Gửi {data.sent} | Nhận <span className="text-emerald-600 font-bold">{data.received}</span> | Hủy <span className="text-rose-600 font-bold">{data.cancelled}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Notes and Closer */}
                                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-t border-stone-200/30 dark:border-zinc-700/30 pt-2 text-[10px] text-stone-500">
                                                                <div className="flex items-center gap-1.5">
                                                                    <User size={10} />
                                                                    <span>Người bàn giao: <strong className="text-stone-700 dark:text-stone-300 font-semibold">{ss.closed_by_name || 'Nhân viên'}</strong></span>
                                                                </div>
                                                                {ss.notes && (
                                                                    <div className="italic bg-amber-500/5 dark:bg-amber-500/10 text-amber-850 dark:text-amber-400 px-2 py-0.5 rounded-lg max-w-full md:max-w-[60%] truncate" title={ss.notes}>
                                                                        💬 Ghi chú: {ss.notes}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Notes and Handover Details */}
                                <div>
                                    <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                        <FileText size={13} /> Ghi chú bàn giao cuối ca
                                    </h4>
                                    <div className="p-4 bg-stone-50 dark:bg-zinc-800/40 border border-stone-100 dark:border-zinc-700 rounded-xl text-xs leading-relaxed text-stone-600 dark:text-stone-300">
                                        {selectedShift.notes ? (
                                            <p className="whitespace-pre-line font-medium">{selectedShift.notes}</p>
                                        ) : (
                                            <p className="italic text-stone-400">Không có ghi chú bàn giao nào.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-32 text-center px-4">
                            <Clock size={48} className="text-stone-300 mb-4 animate-pulse" />
                            <h3 className="font-bold text-stone-700 dark:text-stone-300">Chưa chọn ca làm việc</h3>
                            <p className="text-stone-500 text-xs mt-1 max-w-xs">Chọn một ca làm việc từ danh sách bên trái để xem báo cáo đối soát chi tiết.</p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    )
}
