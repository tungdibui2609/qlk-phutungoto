'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Factory, Search, Send, Check, PackageOpen, ClipboardCheck, Truck, RefreshCw, X, AlertTriangle, ArrowLeftRight, Bell, Hash } from 'lucide-react'
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
    pendingSend: number
    pendingReceive: number
    inProgress: number
    completed: number
}

type QuickAction = { type: 'send' | 'receive_back'; setting: DeliverySetting; journal: DeliveryJournal | null }

export default function DeliveryJournalPage() {
    const { currentSystem, hasModule } = useSystem()
    const { profile } = useUser()

    const [moGroups, setMoGroups] = useState<MOGroup[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedMoId, setSelectedMoId] = useState<string | null>(null)
    const [searchMo, setSearchMo] = useState('')

    // Quick send modal
    const [sendModal, setSendModal] = useState<{ setting: DeliverySetting } | null>(null)
    const [sendQty, setSendQty] = useState(0)
    const [sendNotes, setSendNotes] = useState('')

    // Receive back modal
    const [receiveModal, setReceiveModal] = useState<{ journal: DeliveryJournal } | null>(null)

    // Notification
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
                        pendingSend: 0,
                        pendingReceive: 0,
                        inProgress: 0,
                        completed: 0,
                    })
                }
                const group = moMap.get(s.mo_id)!
                const journal = journals.find(
                    j => j.item_name === s.product_name && j.unit === s.unit
                ) || null

                group.products.push({ ...s, journal })

                if (!journal || journal.status === 'cancelled') {
                    group.pendingSend++
                } else if (journal.status === 'completed_by_production') {
                    group.pendingReceive++
                } else if (journal.status === 'sent' || journal.status === 'received_by_production') {
                    group.inProgress++
                } else if (journal.status === 'received_by_warehouse') {
                    group.completed++
                }
            }

            const groups = Array.from(moMap.values()).sort((a, b) => {
                if (a.pendingReceive > 0 && b.pendingReceive === 0) return -1
                if (b.pendingReceive > 0 && a.pendingReceive === 0) return 1
                if (a.pendingSend > 0 && b.pendingSend === 0) return -1
                if (b.pendingSend > 0 && a.pendingSend === 0) return 1
                return a.mo_code.localeCompare(b.mo_code)
            })

            setMoGroups(groups)

            const notifs = groups
                .filter(g => g.pendingReceive > 0)
                .map(g => ({ mo_id: g.mo_id, count: g.pendingReceive }))
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
            .channel('delivery_journal_warehouse')
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

    const handleSend = async () => {
        if (!sendModal || !currentSystem) return
        const { setting } = sendModal
        try {
            const payload = {
                system_code: currentSystem.code,
                company_id: currentSystem.company_id || profile?.company_id || null,
                item_name: setting.product_name,
                quantity_sent: sendQty || setting.quantity,
                unit: setting.unit,
                from_department: 'Kho',
                to_department: 'Sản xuất',
                status: 'sent',
                notes: sendNotes || setting.notes || `Lệnh: ${setting.mo_code}`,
                sent_by: profile?.id || null,
                sent_by_name: profile?.full_name || 'Nhân viên kho',
                created_by: profile?.id || null,
                created_by_name: profile?.full_name || null,
                sent_at: new Date().toISOString(),
            }

            const { error } = await (supabase as any)
                .from('delivery_journal')
                .insert([payload])

            if (error) throw error

            setSendModal(null)
            loadData()
        } catch (err: any) {
            console.error('Send error:', err)
            alert('Lỗi gửi vật tư: ' + (err?.message || err))
        }
    }

    const handleReceiveBack = async () => {
        if (!receiveModal) return
        try {
            const { error } = await (supabase as any)
                .from('delivery_journal')
                .update({
                    status: 'received_by_warehouse',
                    received_by_warehouse: profile?.id || null,
                    received_by_warehouse_name: profile?.full_name || 'Nhân viên kho',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', receiveModal.journal.id)

            if (error) throw error

            setReceiveModal(null)
            loadData()
        } catch (err: any) {
            console.error('Receive back error:', err)
            alert('Lỗi nhận lại vật tư: ' + (err?.message || err))
        }
    }

    const openSendModal = (setting: DeliverySetting) => {
        setSendModal({ setting })
        setSendQty(setting.quantity)
        setSendNotes(setting.notes || `Lệnh: ${setting.mo_code}`)
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
                        <Factory size={24} className="text-indigo-600" />
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
                                        <p className="text-sm font-bold text-stone-900 dark:text-white">Cần nhận lại</p>
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
                                                <p className="text-xs text-amber-600">{n.count} sản phẩm SX đã gửi lại, chờ kho nhận</p>
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
                                className="w-full pl-9 pr-3 py-2 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="p-6 text-center text-stone-400 text-sm">Đang tải...</div>
                        ) : filteredGroups.length === 0 ? (
                            <div className="p-6 text-center text-stone-400 text-sm">
                                <PackageOpen size={32} className="mx-auto mb-2 text-stone-300" />
                                Chưa có lệnh SX nào được cấu hình giao nhận.<br />
                                <span className="text-xs">Vào Cài đặt giao nhận để thêm.</span>
                            </div>
                        ) : (
                            filteredGroups.map(group => {
                                const isSelected = group.mo_id === selectedMoId
                                const hasPendingReceive = group.pendingReceive > 0
                                return (
                                    <button
                                        key={group.mo_id}
                                        onClick={() => setSelectedMoId(group.mo_id)}
                                        className={`w-full text-left px-4 py-3 border-b border-stone-100 dark:border-zinc-700/50 transition-colors ${
                                            isSelected
                                                ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-l-indigo-600'
                                                : 'hover:bg-stone-50 dark:hover:bg-zinc-700/50 border-l-4 border-l-transparent'
                                        } ${hasPendingReceive && !isSelected ? 'bg-amber-50/30 dark:bg-amber-900/5' : ''}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Hash size={14} className={isSelected ? 'text-indigo-500' : 'text-stone-400'} />
                                                <p className={`text-sm font-bold ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-stone-800 dark:text-stone-200'}`}>
                                                    {group.mo_code}
                                                </p>
                                                {hasPendingReceive && (
                                                    <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                                                        {group.pendingReceive}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1.5">
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                {group.pendingSend} chờ gửi
                                            </span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">
                                                {group.inProgress} đang xử lý
                                            </span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                {group.completed} xong
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
                            <p className="text-stone-400 text-sm mt-1">để xem và thao tác giao nhận</p>
                        </div>
                    ) : (
                        <>
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold text-stone-900 dark:text-white">{selectedGroup.mo_code}</h2>
                                <div className="flex items-center gap-3 mt-2">
                                    <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-bold">
                                        {selectedGroup.pendingSend} chờ gửi
                                    </span>
                                    <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-bold">
                                        {selectedGroup.pendingReceive} chờ nhận lại
                                    </span>
                                    <span className="text-xs px-2 py-1 rounded-full bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 font-bold">
                                        {selectedGroup.inProgress} đang xử lý
                                    </span>
                                    <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold">
                                        {selectedGroup.completed} hoàn tất
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {selectedGroup.products.map((product) => {
                                    const journal = product.journal
                                    const status = journal?.status || null
                                    const isCompleted = status === 'received_by_warehouse'
                                    const isCancelled = status === 'cancelled'
                                    const isPending = !status || isCancelled
                                    const isWaitingReceive = status === 'completed_by_production'
                                    const isInProgress = status === 'sent' || status === 'received_by_production'

                                    let cardBg = 'bg-white dark:bg-zinc-800 border-stone-200 dark:border-zinc-700'
                                    let cardBorder = ''
                                    if (isPending) cardBorder = 'border-l-4 border-l-blue-500'
                                    if (isInProgress) cardBorder = 'border-l-4 border-l-cyan-500'
                                    if (isWaitingReceive) cardBorder = 'border-l-4 border-l-amber-500 animate-pulse'
                                    if (isCompleted) cardBorder = 'border-l-4 border-l-emerald-500'
                                    if (isCancelled) cardBorder = 'border-l-4 border-l-red-500'

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

                                            {/* Status badge */}
                                            {status && (
                                                <div className="mb-3">
                                                    {isPending && !isCancelled && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                            Chưa gửi
                                                        </span>
                                                    )}
                                                    {isCancelled && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                            <X size={10} /> Đã hủy
                                                        </span>
                                                    )}
                                                    {status === 'sent' && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                            <Send size={10} /> Đã gửi SX
                                                        </span>
                                                    )}
                                                    {status === 'received_by_production' && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">
                                                            <PackageOpen size={10} /> SX đã nhận
                                                        </span>
                                                    )}
                                                    {isWaitingReceive && (
                                                        <div>
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                                <ClipboardCheck size={10} /> SX hoàn thành
                                                            </span>
                                                            {journal?.result_item_name && (
                                                                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                                                                    → {journal.result_item_name} ({journal.result_quantity} {journal.result_unit})
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                    {isCompleted && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                            <Check size={10} /> Hoàn tất
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
                                                    {journal.completed_by_name && <p>Hoàn thành: {journal.completed_by_name}</p>}
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div className="flex items-center gap-2">
                                                {(isPending) && (
                                                    <button
                                                        onClick={() => openSendModal(product)}
                                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                                                    >
                                                        <Send size={14} />
                                                        Gửi cho SX
                                                    </button>
                                                )}
                                                {isWaitingReceive && (
                                                    <button
                                                        onClick={() => setReceiveModal({ journal: journal! })}
                                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                                                    >
                                                        <Truck size={14} />
                                                        Nhận lại từ SX
                                                    </button>
                                                )}
                                                {isInProgress && (
                                                    <span className="flex-1 text-center text-xs text-stone-400 py-2">
                                                        Đang chờ SX xử lý...
                                                    </span>
                                                )}
                                                {isCompleted && (
                                                    <span className="flex-1 text-center text-xs text-emerald-600 dark:text-emerald-400 py-2 font-medium">
                                                        ✓ Đã hoàn tất giao nhận
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
                                    <p className="text-stone-500">Chưa có sản phẩm nào được cấu hình cho lệnh này</p>
                                    <p className="text-stone-400 text-sm mt-1">Vào Cài đặt giao nhận để thêm sản phẩm</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Send Modal */}
            {sendModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-800 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
                                    <Send size={22} className="text-indigo-600" />
                                    Kho gửi vật tư
                                </h3>
                                <button onClick={() => setSendModal(null)} className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-zinc-700">
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="bg-stone-50 dark:bg-zinc-900 rounded-2xl p-3 mb-4">
                                <p className="font-bold text-stone-800 dark:text-stone-200">{sendModal.setting.product_name}</p>
                                <p className="text-xs text-stone-500">Lệnh: {sendModal.setting.mo_code} | ĐVT: {sendModal.setting.unit}</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Số lượng gửi</label>
                                    <input
                                        type="number"
                                        min={0.01}
                                        step="any"
                                        value={sendQty}
                                        onChange={e => setSendQty(parseFloat(e.target.value) || 0)}
                                        className="w-full px-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Ghi chú</label>
                                    <input
                                        type="text"
                                        value={sendNotes}
                                        onChange={e => setSendNotes(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-stone-200 dark:border-zinc-700">
                                <button onClick={() => setSendModal(null)} className="px-4 py-2 text-sm font-bold text-stone-600 hover:bg-stone-100 dark:hover:bg-zinc-700 rounded-2xl">
                                    Hủy
                                </button>
                                <button onClick={handleSend} className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-lg shadow-indigo-500/20 active:scale-95">
                                    Xác nhận gửi
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Receive Back Modal */}
            {receiveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-800 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
                                    <Truck size={22} className="text-emerald-600" />
                                    Nhận lại từ Sản xuất
                                </h3>
                                <button onClick={() => setReceiveModal(null)} className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-zinc-700">
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="bg-stone-50 dark:bg-zinc-900 rounded-2xl p-3 mb-4 space-y-2">
                                <p className="font-bold text-stone-800 dark:text-stone-200">{receiveModal.journal.item_name}</p>
                                <p className="text-xs text-stone-500">Đã gửi: {receiveModal.journal.quantity_sent} {receiveModal.journal.unit}</p>
                                {receiveModal.journal.result_item_name && (
                                    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-2">
                                        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                                            SX gửi lại: {receiveModal.journal.result_item_name}
                                        </p>
                                        <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                            SL: {receiveModal.journal.result_quantity} {receiveModal.journal.result_unit}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-stone-200 dark:border-zinc-700">
                                <button onClick={() => setReceiveModal(null)} className="px-4 py-2 text-sm font-bold text-stone-600 hover:bg-stone-100 dark:hover:bg-zinc-700 rounded-2xl">
                                    Hủy
                                </button>
                                <button onClick={handleReceiveBack} className="px-6 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-2xl shadow-lg shadow-emerald-500/20 active:scale-95">
                                    Xác nhận đã nhận
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}