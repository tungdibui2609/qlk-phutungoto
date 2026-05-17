'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Factory, Calendar, Clock, User, CheckCircle2, XCircle, AlertTriangle, FileText, ArrowLeft, RefreshCw, BarChart3, TrendingUp, Package, Shield, Layers } from 'lucide-react'
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

    // Tự động load settings map để phân rã mo_code ở Sản xuất
    useEffect(() => {
        const loadSettingsMap = async () => {
            const companyId = profile?.company_id
            if (!companyId) return
            try {
                const { data, error } = await (supabase as any)
                    .from('delivery_settings')
                    .select('id, mo_code, mo_name')
                    .eq('company_id', companyId)
                if (error) throw error
                const m: Record<string, { mo_code: string; mo_name: string }> = {}
                for (const s of (data || [])) {
                    m[s.id] = { mo_code: s.mo_code || 'Không xác định', mo_name: s.mo_name || '' }
                }
                setSettingsMap(m)
            } catch (err) {
                console.error('Error loading settings map:', err)
            }
        }
        loadSettingsMap()
    }, [profile?.company_id])

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

            if (!mo_summary[moCode]) {
                mo_summary[moCode] = {
                    mo_code: moCode,
                    mo_name: moName,
                    products: {}
                }
            }

            const prodKey = `${prodName}_${unit}`
            if (!mo_summary[moCode].products[prodKey]) {
                mo_summary[moCode].products[prodKey] = {
                    product_name: prodName,
                    unit: unit,
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

    const loadShifts = useCallback(async () => {
        const companyId = profile?.company_id
        if (!companyId) return
        setLoading(true)
        try {
            let query = (supabase as any)
                .from('delivery_shifts')
                .select('*')
                .eq('company_id', companyId)
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
                    <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Ca đang chạy</div>
                    <div className="text-2xl font-black mt-1 text-emerald-600">
                        {shifts.filter(s => s.status === 'open').length}
                    </div>
                </div>
                <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl border border-stone-200 dark:border-zinc-700 shadow-sm">
                    <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Lượt giao nhận</div>
                    <div className="text-2xl font-black mt-1 text-blue-600">
                        {shifts.reduce((acc, s) => acc + (s.summary_data?.total_sent || 0), 0)}
                    </div>
                </div>
                <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl border border-stone-200 dark:border-zinc-700 shadow-sm">
                    <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Tỷ lệ hoàn thành</div>
                    <div className="text-2xl font-black mt-1 text-emerald-600">
                        {(() => {
                            const total = shifts.reduce((acc, s) => acc + (s.summary_data?.total_sent || 0), 0)
                            const ok = shifts.reduce((acc, s) => acc + (s.summary_data?.total_received || 0), 0)
                            return total > 0 ? `${Math.round((ok / total) * 100)}%` : '100%'
                        })()}
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
                                    <span className={`px-2.5 py-1 rounded-xl text-xs font-extrabold ${
                                        selectedShift.status === 'open' 
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 animate-pulse' 
                                            : 'bg-stone-100 text-stone-600 dark:bg-zinc-700 dark:text-zinc-300'
                                    }`}>
                                        {selectedShift.status === 'open' ? '🔴 Ca đang hoạt động' : '✓ Đã chốt ca hoàn tất'}
                                    </span>
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
                                <h3 className="font-bold text-sm mb-3 flex items-center gap-1.5"><BarChart3 size={16} className="text-emerald-500" /> Tổng hợp số liệu giao nhận</h3>
                                <div className="grid grid-cols-3 gap-3 mb-6">
                                    <div className="bg-stone-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-stone-100 dark:border-zinc-700 text-center">
                                        <div className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Tổng đợt giao</div>
                                        <div className="text-xl font-black mt-1 text-stone-800 dark:text-white">
                                            {selectedShift.summary_data?.total_sent || 0} đợt
                                        </div>
                                    </div>
                                    <div className="bg-emerald-50/50 dark:bg-emerald-950/10 p-4 rounded-xl border border-emerald-100/50 dark:border-emerald-900/30 text-center">
                                        <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Thành công</div>
                                        <div className="text-xl font-black mt-1 text-emerald-600">
                                            {selectedShift.summary_data?.total_received || 0} đợt
                                        </div>
                                    </div>
                                    <div className="bg-rose-50/50 dark:bg-rose-950/10 p-4 rounded-xl border border-rose-100/50 dark:border-rose-900/30 text-center">
                                        <div className="text-[10px] text-rose-600 font-bold uppercase tracking-wider">Bị từ chối</div>
                                        <div className="text-xl font-black mt-1 text-rose-600">
                                            {selectedShift.summary_data?.total_cancelled || 0} đợt
                                        </div>
                                    </div>
                                </div>

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
                                                                                    {p.product_name} <span className="text-[9px] text-stone-400 font-bold">({p.unit})</span>
                                                                                </td>
                                                                                <td className="p-2 text-right font-bold text-stone-850 dark:text-stone-250">{p.sent}</td>
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
