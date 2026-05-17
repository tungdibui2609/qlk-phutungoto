'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Factory, Search, Check, PackageOpen, ClipboardCheck, Truck, RefreshCw, X, ArrowLeftRight, Bell, Hash, Send } from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { supabase } from '@/lib/supabaseClient'

interface DeliverySetting {
    id: string
    system_code: string
    company_id: string | null
    mo_id: string
    mo_code: string
    product_id: string | null
    product_name: string
    product_code: string | null
    quantity: number
    unit: string
    direction: 'warehouse_to_production' | 'production_to_warehouse'
    notes: string | null
}

interface DeliveryJournal {
    id: string
    delivery_code: string | null
    item_name: string
    quantity_sent: number
    unit: string
    status: 'sent' | 'received_by_production' | 'completed_by_production' | 'received_by_warehouse' | 'cancelled'
    result_item_name: string | null
    result_quantity: number | null
    result_unit: string | null
    notes: string | null
    sent_by_name: string | null
    received_by_production_name: string | null
    completed_by_name: string | null
    received_by_warehouse_name: string | null
    sent_at: string
    completed_by_production_at: string | null
}

interface MOGroup {
    mo_id: string
    mo_code: string
    products: (DeliverySetting & { journal: DeliveryJournal | null })[]
}

export default function SanXuatDeliveryJournalPage() {
    const { currentSystem, hasModule } = useSystem()
    const { profile } = useUser()

    const [moGroups, setMoGroups] = useState<MOGroup[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedMoId, setSelectedMoId] = useState<string | null>(null)
    const [searchMo, setSearchMo] = useState('')

    // Receive from warehouse modal
    const [receiveModal, setReceiveModal] = useState<{ journal: DeliveryJournal } | null>(null)

    // Complete & send back modal
    const [completeModal, setCompleteModal] = useState<{ journal: DeliveryJournal } | null>(null)
    const [resultName, setResultName] = useState('')
    const [resultQty, setResultQty] = useState(0)
    const [resultUnit, setResultUnit] = useState('Cái')

    // Notification: warehouse sent new items
    const [notifications, setNotifications] = useState<{ mo_id: string; count: number }[]>([])
    const [showNotifications, setShowNotifications] = useState(false)

    const realtimeRef = useRef<any>(null)

    const loadData = useCallback(async () => {
        if (!currentSystem) return
        setLoading(true)
        try {
            const [settingsResult, journalResult] = await Promise.all([
                (supabase as any)
                    .from('delivery_settings')
                    .select('*')
                    .eq('system_code', currentSystem.code)
                    .order('created_at', { ascending: false }),
                (supabase as any)
                    .from('delivery_journal')
                    .select('*')
                    .eq('system_code', currentSystem.code)
                    .order('sent_at', { ascending: false })
                    .limit(500)
            ])

            if (settingsResult.error) throw settingsResult.error
            if (journalResult.error) throw journalResult.error

            const settings: DeliverySetting[] = (settingsResult.data || []).filter(
                (s: DeliverySetting) => s.direction === 'warehouse_to_production'
            )
            const journals: DeliveryJournal[] = journalResult.data || []

            const moMap = new Map<string, MOGroup>()

            for (const s of settings) {
                if (!moMap.has(s.mo_id)) {
                    moMap.set(s.mo_id, {
                        mo_id: s.mo_id,
                        mo_code: s.mo_code,
                        products: [],
                    })
                }
                const group = moMap.get(s.mo_id)!
                const journal = journals.find(
                    j => j.item_name === s.product_name && j.unit === s.unit
                ) || null

                group.products.push({ ...s, journal })
            }

            const groups = Array.from(moMap.values()).sort((a, b) => {
                const aNeedsAction = a.products.some(p => p.journal?.status === 'sent')
                const bNeedsAction = b.products.some(p => p.journal?.status === 'sent')
                if (aNeedsAction && !bNeedsAction) return -1
                if (!aNeedsAction && bNeedsAction) return 1
                return a.mo_code.localeCompare(b.mo_code)
            })

            setMoGroups(groups)

            const notifs = groups
                .filter(g => g.products.some(p => p.journal?.status === 'sent'))
                .map(g => ({ mo_id: g.mo_id, count: g.products.filter(p => p.journal?.status === 'sent').length }))
            setNotifications(notifs)

            if (groups.length > 0 && !selectedMoId) {
                setSelectedMoId(groups[0].mo_id)
            }
        } catch (err) {
            console.error('Load data error:', err)
        } finally {
            setLoading(false)
        }
    }, [currentSystem, selectedMoId])

    useEffect(() => {
        if (!currentSystem) return
        loadData()

        const channel = supabase
            .channel('delivery_journal_sanxuat')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'delivery_journal',
                filter: `system_code=eq.${currentSystem.code}`,
            }, () => loadData())
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'delivery_settings',
                filter: `system_code=eq.${currentSystem.code}`,
            }, () => loadData())
            .subscribe()

        realtimeRef.current = channel
        return () => { supabase.removeChannel(channel) }
    }, [currentSystem, loadData])

    const handleReceiveFromWarehouse = async () => {
        if (!receiveModal) return
        try {
            const { error } = await (supabase as any)
                .from('delivery_journal')
                .update({
                    status: 'received_by_production',
                    received_by_production: profile?.id || null,
                    received_by_production_name: profile?.full_name || 'Nhân viên SX',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', receiveModal.journal.id)

            if (error) throw error

            setReceiveModal(null)
            loadData()
        } catch (err: any) {
            console.error('Receive error:', err)
            alert('Lỗi nhận vật tư: ' + (err?.message || err))
        }
    }

    const handleCompleteAndSendBack = async () => {
        if (!completeModal) return
        try {
            const { error } = await (supabase as any)
                .from('delivery_journal')
                .update({
                    status: 'completed_by_production',
                    completed_by: profile?.id || null,
                    completed_by_name: profile?.full_name || 'Nhân viên SX',
                    result_item_name: resultName,
                    result_quantity: resultQty,
                    result_unit: resultUnit,
                    completed_by_production_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', completeModal.journal.id)

            if (error) throw error

            setCompleteModal(null)
            loadData()
        } catch (err: any) {
            console.error('Complete error:', err)
            alert('Lỗi hoàn thành vật tư: ' + (err?.message || err))
        }
    }

    const openReceiveModal = (journal: DeliveryJournal) => {
        setReceiveModal({ journal })
    }

    const openCompleteModal = (journal: DeliveryJournal) => {
        setCompleteModal({ journal })
        setResultName(journal.item_name + ' thành phẩm')
        setResultQty(journal.quantity_sent)
        setResultUnit(journal.unit)
    }

    const selectedGroup = moGroups.find(g => g.mo_id === selectedMoId)
    const filteredGroups = moGroups.filter(g =>
        !searchMo || g.mo_code.toLowerCase().includes(searchMo.toLowerCase())
    )
    const totalNotifs = notifications.reduce((sum, n) => sum + n.count, 0)

    if (!currentSystem) return null

    if (!hasModule('delivery_journal')) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-6">
                    <Factory size={40} className="text-slate-400" />
                </div>
                <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-2">Giao nhận Kho ↔ Sản xuất</h2>
                <p className="text-stone-500 max-w-md">Tính năng chưa được kích hoạt. Vào Cài đặt → Tiện ích để bật.</p>
            </div>
        )
    }

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col bg-stone-50 dark:bg-zinc-900">
            {/* Top bar */}
            <div className="flex items-center justify-between px-6 py-3 bg-white dark:bg-zinc-800 border-b border-stone-200 dark:border-zinc-700 shrink-0">
                <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
                        <Factory size={24} className="text-emerald-600" />
                        Giao nhận Kho → Sản xuất
                    </h1>
                    <span className="flex items-center gap-1 text-xs text-stone-500">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Live
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    {totalNotifs > 0 && (
                        <div className="relative">
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="relative p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-zinc-700 transition-colors"
                            >
                                <Bell size={20} className="text-amber-500" />
                                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-bounce">
                                    {totalNotifs}
                                </span>
                            </button>
                            {showNotifications && (
                                <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl border border-stone-200 dark:border-zinc-700 z-50 overflow-hidden">
                                    <div className="p-3 border-b border-stone-100 dark:border-zinc-700">
                                        <p className="text-sm font-bold text-stone-900 dark:text-white">Kho vừa gửi vật tư</p>
                                    </div>
                                    {notifications.map(n => {
                                        const grp = moGroups.find(g => g.mo_id === n.mo_id)
                                        return (
                                            <button
                                                key={n.mo_id}
                                                onClick={() => { setSelectedMoId(n.mo_id); setShowNotifications(false) }}
                                                className="w-full text-left px-4 py-3 hover:bg-stone-50 dark:hover:bg-zinc-700/50 border-b border-stone-100 dark:border-zinc-700/50 transition-colors"
                                            >
                                                <p className="text-sm font-bold text-stone-800 dark:text-stone-200">{grp?.mo_code || n.mo_id}</p>
                                                <p className="text-xs text-blue-600">{n.count} vật tư Kho đã gửi, cần nhận</p>
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                    <button onClick={loadData} className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-zinc-700 transition-colors" title="Làm mới">
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            {/* Main content: 2 columns */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left: MO List */}
                <div className="w-80 bg-white dark:bg-zinc-800 border-r border-stone-200 dark:border-zinc-700 flex flex-col shrink-0">
                    <div className="p-3 border-b border-stone-100 dark:border-zinc-700">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                            <input
                                type="text"
                                placeholder="Tìm lệnh sản xuất..."
                                value={searchMo}
                                onChange={e => setSearchMo(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="p-6 text-center text-stone-400 text-sm">Đang tải...</div>
                        ) : filteredGroups.length === 0 ? (
                            <div className="p-6 text-center text-stone-400 text-sm">
                                <PackageOpen size={32} className="mx-auto mb-2 text-stone-300" />
                                Chưa có vật tư nào được Kho gửi.<br />
                                <span className="text-xs">Kho cần cấu hình giao nhận trước.</span>
                            </div>
                        ) : (
                            filteredGroups.map(group => {
                                const isSelected = group.mo_id === selectedMoId
                                const waitingCount = group.products.filter(p => p.journal?.status === 'sent').length
                                const inProgressCount = group.products.filter(p => p.journal?.status === 'received_by_production').length
                                const hasWaiting = waitingCount > 0

                                return (
                                    <button
                                        key={group.mo_id}
                                        onClick={() => setSelectedMoId(group.mo_id)}
                                        className={`w-full text-left px-4 py-3 border-b border-stone-100 dark:border-zinc-700/50 transition-colors ${
                                            isSelected
                                                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-l-emerald-600'
                                                : 'hover:bg-stone-50 dark:hover:bg-zinc-700/50 border-l-4 border-l-transparent'
                                        } ${hasWaiting && !isSelected ? 'bg-blue-50/30 dark:bg-blue-900/5' : ''}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Hash size={14} className={isSelected ? 'text-emerald-500' : 'text-stone-400'} />
                                                <p className={`text-sm font-bold ${isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-stone-800 dark:text-stone-200'}`}>
                                                    {group.mo_code}
                                                </p>
                                                {hasWaiting && (
                                                    <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                                                        {waitingCount}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1.5">
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                {waitingCount} chờ nhận
                                            </span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">
                                                {inProgressCount} đang xử lý
                                            </span>
                                        </div>
                                    </button>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* Right: Products */}
                <div className="flex-1 overflow-y-auto p-6">
                    {!selectedGroup ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <ArrowLeftRight size={48} className="text-stone-300 mb-4" />
                            <p className="text-stone-500 text-lg font-medium">Chọn một lệnh sản xuất bên trái</p>
                            <p className="text-stone-400 text-sm mt-1">để xem vật tư và thao tác nhận / hoàn thành</p>
                        </div>
                    ) : (
                        <>
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold text-stone-900 dark:text-white">{selectedGroup.mo_code}</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {selectedGroup.products.map((product) => {
                                    const journal = product.journal
                                    const status = journal?.status || null
                                    const isWaitingForReceive = status === 'sent'
                                    const isReceived = status === 'received_by_production'
                                    const isCompleted = status === 'completed_by_production'
                                    const isFullyComplete = status === 'received_by_warehouse'

                                    let cardBg = 'bg-white dark:bg-zinc-800 border-stone-200 dark:border-zinc-700'
                                    let cardBorder = ''
                                    if (isWaitingForReceive) cardBorder = 'border-l-4 border-l-blue-500 animate-pulse'
                                    if (isReceived) cardBorder = 'border-l-4 border-l-cyan-500'
                                    if (isCompleted) cardBorder = 'border-l-4 border-l-amber-500'
                                    if (isFullyComplete) cardBorder = 'border-l-4 border-l-emerald-500'
                                    if (!status) cardBorder = 'border-l-4 border-l-stone-300'

                                    return (
                                        <div
                                            key={product.id}
                                            className={`${cardBg} ${cardBorder} rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all`}
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <h3 className="font-bold text-stone-800 dark:text-stone-100 text-sm pr-2">
                                                    {product.product_name}
                                                </h3>
                                                {product.product_code && (
                                                    <span className="text-[10px] font-mono text-stone-400 bg-stone-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded">
                                                        {product.product_code}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-3 text-xs text-stone-500 dark:text-stone-400 mb-3">
                                                <span>SL: <strong className="text-stone-700 dark:text-stone-300">{product.quantity}</strong></span>
                                                <span>ĐVT: <strong className="text-stone-700 dark:text-stone-300">{product.unit}</strong></span>
                                            </div>

                                            {/* Status */}
                                            {status && (
                                                <div className="mb-3">
                                                    {!status && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400">
                                                            Chưa gửi
                                                        </span>
                                                    )}
                                                    {isWaitingForReceive && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                            <Send size={10} /> Kho đã gửi
                                                        </span>
                                                    )}
                                                    {isReceived && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">
                                                            <PackageOpen size={10} /> Đã nhận
                                                        </span>
                                                    )}
                                                    {isCompleted && (
                                                        <div>
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                                <ClipboardCheck size={10} /> Đã gửi lại kho
                                                            </span>
                                                            {journal?.result_item_name && (
                                                                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                                                                    → {journal.result_item_name} ({journal.result_quantity} {journal.result_unit})
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                    {isFullyComplete && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                            <Check size={10} /> Kho đã nhận lại
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Journal info */}
                                            {journal && (
                                                <div className="text-[10px] text-stone-400 mb-3 space-y-0.5">
                                                    {journal.delivery_code && <p>Mã: {journal.delivery_code}</p>}
                                                    {journal.sent_by_name && <p>Gửi: {journal.sent_by_name}</p>}
                                                    {journal.received_by_production_name && <p>Nhận: {journal.received_by_production_name}</p>}
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div className="flex items-center gap-2">
                                                {isWaitingForReceive && (
                                                    <button
                                                        onClick={() => openReceiveModal(journal!)}
                                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                                                    >
                                                        <PackageOpen size={14} />
                                                        Nhận từ Kho
                                                    </button>
                                                )}
                                                {isReceived && (
                                                    <button
                                                        onClick={() => openCompleteModal(journal!)}
                                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-amber-500/20 transition-all active:scale-95"
                                                    >
                                                        <ClipboardCheck size={14} />
                                                        Hoàn thành & Gửi lại
                                                    </button>
                                                )}
                                                {isCompleted && (
                                                    <span className="flex-1 text-center text-xs text-stone-400 py-2">
                                                        Đang chờ Kho nhận lại...
                                                    </span>
                                                )}
                                                {!status && (
                                                    <span className="flex-1 text-center text-xs text-stone-400 py-2">
                                                        Chưa có giao nhận
                                                    </span>
                                                )}
                                                {isFullyComplete && (
                                                    <span className="flex-1 text-center text-xs text-emerald-600 dark:text-emerald-400 py-2 font-medium">
                                                        ✓ Hoàn tất
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {selectedGroup.products.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <PackageOpen size={48} className="text-stone-300 mb-4" />
                                    <p className="text-stone-500">Chưa có vật tư nào cho lệnh này</p>
                                    <p className="text-stone-400 text-sm mt-1">Kho cần cấu hình giao nhận</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Receive from Warehouse Modal */}
            {receiveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-800 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
                                    <PackageOpen size={22} className="text-blue-600" />
                                    Nhận vật tư từ Kho
                                </h3>
                                <button onClick={() => setReceiveModal(null)} className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-zinc-700">
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="bg-stone-50 dark:bg-zinc-900 rounded-2xl p-3 mb-4">
                                <p className="font-bold text-stone-800 dark:text-stone-200">{receiveModal.journal.item_name}</p>
                                <p className="text-xs text-stone-500">SL: {receiveModal.journal.quantity_sent} {receiveModal.journal.unit}</p>
                                {receiveModal.journal.sent_by_name && (
                                    <p className="text-xs text-stone-500">Người gửi: {receiveModal.journal.sent_by_name}</p>
                                )}
                            </div>

                            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-stone-200 dark:border-zinc-700">
                                <button onClick={() => setReceiveModal(null)} className="px-4 py-2 text-sm font-bold text-stone-600 hover:bg-stone-100 dark:hover:bg-zinc-700 rounded-2xl">
                                    Hủy
                                </button>
                                <button onClick={handleReceiveFromWarehouse} className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-lg shadow-blue-500/20 active:scale-95">
                                    Xác nhận đã nhận
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Complete & Send Back Modal */}
            {completeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-800 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
                                    <ClipboardCheck size={22} className="text-amber-600" />
                                    Hoàn thành & Gửi kết quả
                                </h3>
                                <button onClick={() => setCompleteModal(null)} className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-zinc-700">
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="bg-stone-50 dark:bg-zinc-900 rounded-2xl p-3 mb-4">
                                <p className="font-bold text-stone-800 dark:text-stone-200">{completeModal.journal.item_name}</p>
                                <p className="text-xs text-stone-500">Đã nhận: {completeModal.journal.quantity_sent} {completeModal.journal.unit}</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Tên thành phẩm *</label>
                                    <input
                                        type="text"
                                        value={resultName}
                                        onChange={e => setResultName(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Số lượng</label>
                                        <input
                                            type="number"
                                            min={0.01}
                                            step="any"
                                            value={resultQty}
                                            onChange={e => setResultQty(parseFloat(e.target.value) || 0)}
                                            className="w-full px-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Đơn vị</label>
                                        <input
                                            type="text"
                                            value={resultUnit}
                                            onChange={e => setResultUnit(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-stone-200 dark:border-zinc-700">
                                <button onClick={() => setCompleteModal(null)} className="px-4 py-2 text-sm font-bold text-stone-600 hover:bg-stone-100 dark:hover:bg-zinc-700 rounded-2xl">
                                    Hủy
                                </button>
                                <button onClick={handleCompleteAndSendBack} className="px-6 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-2xl shadow-lg shadow-amber-500/20 active:scale-95">
                                    Hoàn thành & Gửi
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}