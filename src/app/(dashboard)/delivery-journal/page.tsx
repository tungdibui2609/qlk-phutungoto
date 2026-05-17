'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Factory, Search, Send, Check, PackageOpen, ClipboardCheck, Truck, RefreshCw, X, AlertTriangle, ArrowLeftRight, Bell, Hash, Camera, Loader2, ArrowLeft } from 'lucide-react'
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
    received_by_production_at?: string | null
    received_by_warehouse_at?: string | null
    updated_at?: string | null
}

interface MOGroup {
    mo_id: string
    mo_code: string
    mo_name?: string
    products: { setting: DeliverySetting; journals: DeliveryJournal[]; totalSent: number; totalDone: number; activeCount: number; waitCount: number }[]
    totalBatches: number
    activeCount: number
    waitingCount: number
    doneCount: number
}

const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 400;
                const MAX_HEIGHT = 400;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
                resolve(dataUrl);
            };
        };
    });
};

const parseNotes = (notes: string | null) => {
    if (!notes) return { text: '', imageUrl: null }
    const match = notes.split(' [Ảnh minh chứng]: ')
    return {
        text: match[0],
        imageUrl: match[1] || null
    }
};

export default function DeliveryJournalPage() {
    const { currentSystem, hasModule } = useSystem()
    const { profile } = useUser()

    const formatDateTime = (dateStr: string | null | undefined) => {
        if (!dateStr) return '-'
        const d = new Date(dateStr)
        const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
        const date = d.toLocaleDateString('vi-VN')
        return `${time} ${date}`
    }

    const getConvertedQuantity = (qty: number, fromUnit: string, toUnit: string, productName: string): number => {
        if (fromUnit === toUnit) return qty
        let rate = 10
        const match = productName.match(/\((?:Thùng|thùng|Hộp|hộp|Bao|bao)\s+(\d+(?:\.\d+)?)\s*(?:Kg|kg|G|g)\)/i)
        if (match) rate = parseFloat(match[1])
        if (fromUnit === 'Thùng' && toUnit === 'Kg') return qty * rate
        if (fromUnit === 'Kg' && toUnit === 'Thùng') return qty / rate
        return qty
    }

    const getSummaryText = (journalsList: DeliveryJournal[], statusFilter: (j: DeliveryJournal) => boolean, defaultUnit: string) => {
        const list = journalsList.filter(statusFilter)
        if (list.length === 0) return `0 ${defaultUnit}`
        
        const unitMap = new Map<string, number>()
        for (const j of list) {
            const u = j.unit || defaultUnit
            unitMap.set(u, (unitMap.get(u) || 0) + j.quantity_sent)
        }
        
        return Array.from(unitMap.entries())
            .map(([unit, qty]) => `${qty} ${unit}`)
            .join(', ')
    }

    const [moGroups, setMoGroups] = useState<MOGroup[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedMoId, setSelectedMoId] = useState<string | null>(null)
    const [searchMo, setSearchMo] = useState('')

    // Ca làm việc (Shifts)
    const [activeShift, setActiveShift] = useState<any | null>(null)
    const [openShiftModal, setOpenShiftModal] = useState(false)
    const [openNotes, setOpenNotes] = useState('')
    const [closeShiftModal, setCloseShiftModal] = useState(false)
    const [closeNotes, setCloseNotes] = useState('')
    const [shiftSummary, setShiftSummary] = useState<any>(null)

    const loadActiveShift = useCallback(async () => {
        const companyId = currentSystem?.company_id || profile?.company_id
        if (!companyId) return
        try {
            const { data, error } = await (supabase as any)
                .from('delivery_shifts')
                .select('*')
                .eq('company_id', companyId)
                .eq('status', 'open')
                .maybeSingle()
            if (!error && data) {
                setActiveShift(data)
            } else {
                setActiveShift(null)
            }
        } catch (err) {
            console.error('Error loading active shift:', err)
        }
    }, [currentSystem, profile])

    const calculateShiftSummary = async (openedAtStr: string) => {
        const companyId = currentSystem?.company_id || profile?.company_id
        if (!companyId) return
        try {
            const { data, error } = await (supabase as any)
                .from('delivery_journal')
                .select('*')
                .eq('company_id', companyId)
                .gte('sent_at', openedAtStr)
            if (error) throw error
            const list = (data || []) as any[]
            const total_sent = list.length
            const total_received = list.filter((j: any) => j.status === 'received_by_warehouse' || j.status === 'received_by_production').length
            const total_cancelled = list.filter((j: any) => j.status === 'cancelled').length

            // Query delivery_settings để lấy mã Lệnh sản xuất (mo_code)
            const { data: settingsData } = await (supabase as any)
                .from('delivery_settings')
                .select('id, mo_code')
                .eq('company_id', companyId)
            const settingsMap = (settingsData || []).reduce((acc: Record<string, string>, s: any) => {
                acc[s.id] = s.mo_code
                return acc
            }, {})

            const units_summary: Record<string, { sent: number; received: number; cancelled: number }> = {}
            const mo_summary: Record<string, {
                mo_code: string;
                products: Record<string, {
                    product_name: string;
                    unit: string;
                    sent: number;
                    received: number;
                    cancelled: number;
                }>
            }> = {}

            for (const j of list) {
                const unit = j.unit || 'Thùng'
                const prodName = j.item_name || 'Hàng hóa'
                const moCode = j.setting_id ? (settingsMap[j.setting_id] || 'Không xác định') : 'Không xác định'

                // 1. Gom nhóm theo Đơn vị tính (ĐVT)
                if (!units_summary[unit]) {
                    units_summary[unit] = { sent: 0, received: 0, cancelled: 0 }
                }
                units_summary[unit].sent += j.quantity_sent || 0
                if (j.status === 'received_by_warehouse' || j.status === 'received_by_production') {
                    units_summary[unit].received += j.quantity_sent || 0
                } else if (j.status === 'cancelled') {
                    units_summary[unit].cancelled += j.quantity_sent || 0
                }

                // 2. Gom nhóm theo Lệnh sản xuất
                if (!mo_summary[moCode]) {
                    mo_summary[moCode] = {
                        mo_code: moCode,
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

            setShiftSummary({
                total_sent,
                total_received,
                total_cancelled,
                units_summary,
                mo_summary
            })
        } catch (err) {
            console.error('Error calculating shift summary:', err)
        }
    }

    const handleOpenShift = async () => {
        if (!currentSystem) return
        try {
            const payload = {
                system_code: currentSystem.code,
                company_id: currentSystem.company_id || profile?.company_id || null,
                status: 'open',
                opened_by: profile?.id || null,
                opened_by_name: profile?.full_name || 'Nhân viên kho',
                opened_at: new Date().toISOString(),
                notes: openNotes || null,
            }
            const { error } = await (supabase as any)
                .from('delivery_shifts')
                .insert([payload])
            if (error) throw error
            setOpenShiftModal(false)
            setOpenNotes('')
            loadActiveShift()
        } catch (err: any) {
            console.error('Open shift error:', err)
            alert('Lỗi mở ca: ' + (err?.message || err))
        }
    }

    const handleCloseShift = async () => {
        if (!activeShift) return
        try {
            const payload = {
                status: 'closed',
                closed_by: profile?.id || null,
                closed_by_name: profile?.full_name || 'Nhân viên kho',
                closed_at: new Date().toISOString(),
                summary_data: shiftSummary || {},
                notes: closeNotes || null,
            }
            const { error } = await (supabase as any)
                .from('delivery_shifts')
                .update(payload)
                .eq('id', activeShift.id)
            if (error) throw error
            setCloseShiftModal(false)
            setCloseNotes('')
            setShiftSummary(null)
            setActiveShift(null)
            loadActiveShift()
        } catch (err: any) {
            console.error('Close shift error:', err)
            alert('Lỗi chốt ca: ' + (err?.message || err))
        }
    }

    // Quick send modal
    const [sendModal, setSendModal] = useState<{ setting: DeliverySetting } | null>(null)
    const [expandedJournals, setExpandedJournals] = useState<Set<string>>(new Set())
    const toggleExpandJournal = (id: string) => {
        setExpandedJournals(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const [expandedProductHistories, setExpandedProductHistories] = useState<Set<string>>(new Set())
    const toggleExpandProductHistory = (settingId: string) => {
        setExpandedProductHistories(prev => {
            const next = new Set(prev)
            if (next.has(settingId)) next.delete(settingId)
            else next.add(settingId)
            return next
        })
    }
    const [sendQty, setSendQty] = useState(0)
    const [sendUnit, setSendUnit] = useState('Thùng')
    const [sendNotes, setSendNotes] = useState('')

    // Reject modal
    const [rejectModal, setRejectModal] = useState<{ journal: DeliveryJournal } | null>(null)
    const [rejectReason, setRejectReason] = useState<string>('')

    useEffect(() => {
        if (rejectModal) {
            setRejectReason('')
        }
    }, [rejectModal])

    // Notification
    const [notifications, setNotifications] = useState<{ mo_id: string; count: number }[]>([])
    const [showNotifications, setShowNotifications] = useState(false)

    const realtimeRef = useRef<any>(null)

    const loadData = useCallback(async () => {
        const companyId = currentSystem?.company_id || profile?.company_id
        if (!companyId) return
        setLoading(true)
        try {
            // Lấy ca đang mở trước
            const { data: activeShiftData } = await (supabase as any)
                .from('delivery_shifts')
                .select('*')
                .eq('company_id', companyId)
                .eq('status', 'open')
                .maybeSingle()

            let journalQuery = (supabase as any)
                .from('delivery_journal')
                .select('*')
                .eq('company_id', companyId)

            if (activeShiftData) {
                // Nếu có ca đang mở, chỉ lấy các đợt giao nhận phát sinh trong ca
                journalQuery = journalQuery.gte('sent_at', activeShiftData.opened_at)
            } else {
                // Nếu chưa mở ca, không lấy đợt nào cả để reset về 0 hết
                journalQuery = journalQuery.eq('id', '00000000-0000-0000-0000-000000000000')
            }

            const [settingsResult, journalResult] = await Promise.all([
                (supabase as any)
                    .from('delivery_settings')
                    .select('*')
                    .eq('company_id', companyId)
                    .order('created_at', { ascending: false }),
                journalQuery
                    .order('sent_at', { ascending: false })
                    .limit(2000)
            ])
            if (settingsResult.error) throw settingsResult.error
            if (journalResult.error) throw journalResult.error
            const settings: DeliverySetting[] = settingsResult.data || []
            const journals: DeliveryJournal[] = journalResult.data || []

            // Query productions to get MO names
            const moIds = Array.from(new Set(settings.map(s => s.mo_id))).filter(Boolean)
            let moNamesMap: Record<string, string> = {}
            if (moIds.length > 0) {
                const { data: prodData, error: prodErr } = await (supabase as any)
                    .from('productions')
                    .select('id, name')
                    .in('id', moIds)
                if (!prodErr && prodData) {
                    moNamesMap = prodData.reduce((acc: Record<string, string>, item: { id: string; name: string }) => {
                        acc[item.id] = item.name
                        return acc
                    }, {})
                }
            }

            const moMap = new Map<string, MOGroup>()
            for (const s of settings) {
                if (!moMap.has(s.mo_id)) moMap.set(s.mo_id, { mo_id: s.mo_id, mo_code: s.mo_code, mo_name: moNamesMap[s.mo_id] || '', products: [], totalBatches: 0, activeCount: 0, waitingCount: 0, doneCount: 0 })
                const group = moMap.get(s.mo_id)!
                const matched = journals.filter(j => (j as any).setting_id === s.id || (!(j as any).setting_id && j.item_name === s.product_name && j.unit === s.unit))
                const active = matched.filter(j => j.status === 'sent' && (j as any).from_department === 'Kho').length
                const wait = matched.filter(j => ((j.status === 'sent' && (j as any).from_department === 'Sản xuất') || j.status === 'completed_by_production')).length
                const done = matched.filter(j => j.status === 'received_by_warehouse' || j.status === 'received_by_production')
                const totalSent = matched.filter(j => j.status !== 'cancelled').reduce((a, j) => a + getConvertedQuantity(j.quantity_sent, j.unit || 'Kg', s.unit, s.product_name), 0)
                const totalDone = done.reduce((a, j) => a + getConvertedQuantity(j.quantity_sent, j.unit || 'Kg', s.unit, s.product_name), 0)
                group.products.push({ setting: s, journals: matched, totalSent, totalDone, activeCount: active, waitCount: wait })
                group.totalBatches += matched.length
                group.activeCount += active
                group.waitingCount += wait
                group.doneCount += done.length
            }
            const groups = Array.from(moMap.values()).sort((a, b) => {
                if (a.waitingCount > 0 && b.waitingCount === 0) return -1
                if (b.waitingCount > 0 && a.waitingCount === 0) return 1
                return a.mo_code.localeCompare(b.mo_code)
            })
            setMoGroups(groups)
            setNotifications(groups.filter(g => g.waitingCount > 0).map(g => ({ mo_id: g.mo_id, count: g.waitingCount })))
            if (groups.length > 0 && !selectedMoId) {
                const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024
                if (isDesktop) {
                    setSelectedMoId(groups[0].mo_id)
                }
            }
        } catch (err) {
            console.error('Load data error:', err)
        } finally {
            setLoading(false)
        }
    }, [currentSystem, profile, selectedMoId])

    useEffect(() => {
        const companyId = currentSystem?.company_id || profile?.company_id
        if (!companyId) return
        loadData()
        loadActiveShift()

        const channel = supabase
            .channel('delivery_journal_warehouse')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'delivery_journal',
                filter: `company_id=eq.${companyId}`,
            }, () => loadData())
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'delivery_settings',
                filter: `company_id=eq.${companyId}`,
            }, () => loadData())
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'delivery_shifts',
                filter: `company_id=eq.${companyId}`,
            }, () => loadActiveShift())
            .subscribe()

        realtimeRef.current = channel
        return () => { supabase.removeChannel(channel) }
    }, [currentSystem, profile, loadData, loadActiveShift])

    const handleSend = async () => {
        if (!sendModal || !currentSystem) return
        const { setting } = sendModal
        try {
            const payload = {
                system_code: currentSystem.code,
                company_id: currentSystem.company_id || profile?.company_id || null,
                setting_id: setting.id,
                item_name: setting.product_name,
                quantity_sent: sendQty || 1,
                unit: sendUnit,
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

    const handleDirectReceive = async (j: DeliveryJournal) => {
        const isFromProductionSent = j.status === 'completed_by_production' || (j.status === 'sent' && (j as any).from_department === 'Sản xuất')

        try {
            const updatePayload: any = {
                status: 'received_by_warehouse',
                received_by_warehouse: profile?.id || null,
                received_by_warehouse_name: profile?.full_name || 'Nhân viên kho',
                received_by_warehouse_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                notes: j.notes ? `${j.notes} (Nhận đủ)` : 'Nhận đủ 100%'
            }

            if (isFromProductionSent) {
                updatePayload.result_quantity = j.result_quantity || j.quantity_sent // Đảm bảo số lượng
                updatePayload.result_unit = j.result_unit || j.unit
                updatePayload.result_item_name = j.result_item_name || j.item_name
            } else {
                updatePayload.quantity_sent = j.quantity_sent
            }

            const { error } = await (supabase as any)
                .from('delivery_journal')
                .update(updatePayload)
                .eq('id', j.id)

            if (error) throw error
            loadData()
        } catch (err: any) {
            console.error('Receive error:', err)
            alert('Lỗi nhận hàng: ' + (err?.message || err))
        }
    }

    const handleRejectConfirm = async () => {
        if (!rejectModal) return
        if (!rejectReason.trim()) {
            alert('Vui lòng nhập lý do từ chối trả về!')
            return
        }
        const j = rejectModal.journal
        try {
            const finalNotes = `[Từ chối] Lý do: ${rejectReason}`
            
            const updatePayload = {
                status: 'cancelled',
                received_by_warehouse: profile?.id || null,
                received_by_warehouse_name: profile?.full_name || 'Nhân viên kho',
                received_by_warehouse_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                notes: finalNotes
            }

            const { error } = await (supabase as any)
                .from('delivery_journal')
                .update(updatePayload)
                .eq('id', j.id)

            if (error) throw error

            setRejectModal(null)
            loadData()
        } catch (err: any) {
            console.error('Reject error:', err)
            alert('Lỗi từ chối: ' + (err?.message || err))
        }
    }

    const openSendModal = (setting: DeliverySetting) => {
        setSendModal({ setting })
        setSendQty(1)
        setSendUnit('Thùng')
        setSendNotes(`Lệnh: ${setting.mo_code}`)
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
                                                <p className="text-xs text-amber-600">{n.count} đợt SX đã gửi, chờ kho nhận</p>
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

            {/* Shift Banner Widget */}
            <div className="shrink-0">
                {activeShift ? (
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border-b border-emerald-100 dark:border-emerald-900/30 px-6 py-2.5 flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span>🟢 Ca đang mở: <strong className="text-emerald-900 dark:text-white font-extrabold">{activeShift.opened_by_name}</strong> lúc {new Date(activeShift.opened_at).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Link href="/delivery-shifts" className="text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-300 text-[11px] font-bold underline mr-2">
                                Xem lịch sử ca
                            </Link>
                            <button
                                onClick={async () => {
                                    await calculateShiftSummary(activeShift.opened_at)
                                    setCloseShiftModal(true)
                                }}
                                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black shadow-sm active:scale-95 transition-all flex items-center gap-1"
                            >
                                🔴 Chốt ca đối soát
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-amber-50 dark:bg-amber-950/20 border-b border-amber-100 dark:border-amber-900/30 px-6 py-2.5 flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                            <AlertTriangle size={14} className="text-amber-500 animate-pulse" />
                            <span>⚠️ Chưa mở ca giao nhận. Vui lòng mở ca làm việc để thực hiện đối soát bàn giao cuối ca.</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Link href="/delivery-shifts" className="text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-300 text-[11px] font-bold underline mr-2">
                                Lịch sử ca
                            </Link>
                            <button
                                onClick={() => setOpenShiftModal(true)}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black shadow-sm active:scale-95 transition-all flex items-center gap-1"
                            >
                                🟢 Bắt đầu Mở ca
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Main content: 2 columns responsive */}
            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
                {/* Left: MO List */}
                <div className={`w-full lg:w-80 bg-white dark:bg-zinc-800 border-r border-stone-200 dark:border-zinc-700 flex flex-col shrink-0 ${selectedMoId ? 'hidden lg:flex' : 'flex'}`}>
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
                                const hasWaiting = group.waitingCount > 0
                                return (
                                    <button key={group.mo_id} onClick={() => setSelectedMoId(group.mo_id)}
                                        className={`w-full text-left px-4 py-3 border-b border-stone-100 dark:border-zinc-700/50 transition-colors ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-l-indigo-600' : 'hover:bg-stone-50 dark:hover:bg-zinc-700/50 border-l-4 border-l-transparent'} ${hasWaiting && !isSelected ? 'bg-amber-50/30 dark:bg-amber-900/5' : ''}`}>
                                        <div className="flex items-start gap-2">
                                            <Hash size={14} className={`mt-0.5 ${isSelected ? 'text-indigo-500' : 'text-stone-400'}`} />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between">
                                                    <p className={`text-sm font-bold truncate ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-stone-800 dark:text-stone-200'}`}>{group.mo_code}</p>
                                                    {hasWaiting && <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse shrink-0">{group.waitingCount}</span>}
                                                </div>
                                                {group.mo_name && (
                                                    <p className={`text-xs mt-0.5 truncate ${isSelected ? 'text-indigo-600/80 dark:text-indigo-400/80' : 'text-stone-500 dark:text-stone-400'}`}>
                                                        {group.mo_name}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2 pl-[22px] flex-wrap">
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{group.totalBatches} đợt</span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">{group.activeCount} đang xử lý</span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{group.doneCount} xong</span>
                                        </div>
                                    </button>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* Right: Products */}
                <div className={`w-full lg:flex-1 overflow-y-auto p-4 lg:p-6 ${selectedMoId ? 'flex' : 'hidden lg:flex'} flex-col`}>
                    {!selectedGroup ? (
                        <div className="flex flex-col items-center justify-center h-full text-center py-20">
                            <ArrowLeftRight size={48} className="text-stone-300 mb-4" />
                            <p className="text-stone-500 text-lg font-medium">Chọn một lệnh sản xuất bên trái</p>
                            <p className="text-stone-400 text-sm mt-1">để xem và thao tác giao nhận</p>
                        </div>
                    ) : (
                        <>
                            {/* Mobile Back Button */}
                            <button 
                                onClick={() => setSelectedMoId(null)}
                                className="lg:hidden mb-4 self-start px-3.5 py-2 bg-stone-150 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1 active:scale-95 shadow-sm border border-stone-200 dark:border-zinc-700"
                            >
                                <ArrowLeft size={14} /> Quay lại danh sách Lệnh
                            </button>
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold text-stone-900 dark:text-white flex items-baseline gap-3 flex-wrap">
                                    {selectedGroup.mo_code}
                                    {selectedGroup.mo_name && (
                                        <span className="text-sm font-normal text-stone-500 dark:text-stone-400">
                                            ({selectedGroup.mo_name})
                                        </span>
                                    )}
                                </h2>
                                <div className="flex items-center gap-3 mt-2">
                                    <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-bold">{selectedGroup.totalBatches} đợt</span>
                                    <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-bold">{selectedGroup.waitingCount} chờ nhận</span>
                                    <span className="text-xs px-2 py-1 rounded-full bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 font-bold">{selectedGroup.activeCount} đang xử lý</span>
                                    <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold">{selectedGroup.doneCount} hoàn tất</span>
                                </div>
                            </div>
                            <div className="space-y-5">
                                {[...selectedGroup.products]
                                    .sort((a, b) => (b.waitCount > 0 ? 1 : 0) - (a.waitCount > 0 ? 1 : 0))
                                    .map((pw) => {
                                        const { setting, journals, totalSent, totalDone, activeCount, waitCount } = pw
                                    const dir = setting.direction === 'warehouse_to_production' ? 'Kho → SX' : 'SX → Kho'
                                    return (
                                        <div key={setting.id} className="bg-white dark:bg-zinc-800 rounded-2xl border border-stone-200 dark:border-zinc-700 shadow-sm overflow-hidden">
                                            <div className="p-4 border-b border-stone-100 dark:border-zinc-700">
                                                <div className="flex items-start justify-between">
                                                    <div><h3 className="font-bold text-stone-800 dark:text-stone-100">{setting.product_name}</h3>
                                                    <div className="flex items-center gap-2 mt-1"><span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-stone-100 dark:bg-zinc-700 text-stone-500">{dir}</span><span className="text-[10px] text-stone-500">Cấu hình: {setting.quantity} {setting.unit}</span></div></div>
                                                    {activeShift ? (
                                                         <button onClick={() => openSendModal(setting)} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/20 active:scale-95 shrink-0"><Send size={14} /> Gửi đợt mới</button>
                                                     ) : (
                                                         <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1.5 rounded-xl font-extrabold border border-amber-200 dark:border-amber-900/30 animate-pulse">
                                                             ⚠ Cần mở ca
                                                         </span>
                                                     )}
                                                </div>
                                                <div className="flex items-center gap-4 mt-2 text-xs font-semibold">
                                                    <span className="text-stone-500">Đã gửi: <strong className="text-stone-700 dark:text-stone-300">{getSummaryText(journals, j => j.status !== 'cancelled', setting.unit)}</strong></span>
                                                    <span className="text-stone-500">Xong: <strong className="text-emerald-600">{getSummaryText(journals, j => j.status === 'received_by_warehouse' || j.status === 'received_by_production', setting.unit)}</strong></span>
                                                    <span className="text-stone-500">Đang: <strong className="text-cyan-600">{getSummaryText(journals, j => j.status === 'sent', setting.unit)}</strong></span>
                                                    {waitCount > 0 && <span className="text-amber-600 font-bold animate-pulse">⚠ {waitCount} chờ nhận</span>}
                                                </div>
                                                {totalSent > 0 && <div className="mt-2 h-1.5 bg-stone-100 dark:bg-zinc-700 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(100, (totalDone / totalSent) * 100)}%` }} /></div>}
                                            </div>
                                            {/* Toggle History Bar */}
                                            {journals.length > 0 && (
                                                <button 
                                                    onClick={() => toggleExpandProductHistory(setting.id)}
                                                    className="w-full py-2.5 px-4 bg-stone-50/50 hover:bg-stone-100/50 dark:bg-zinc-800/40 dark:hover:bg-zinc-700/30 flex items-center justify-between border-t border-stone-100 dark:border-zinc-700 text-xs font-semibold text-stone-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                                >
                                                    <span className="flex items-center gap-1.5">
                                                        📋 Lịch sử giao nhận ({journals.length} đợt)
                                                        {waitCount > 0 && <span className="px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-[9px] font-bold animate-pulse">Có đợt mới</span>}
                                                    </span>
                                                    <span className="text-[10px] flex items-center gap-0.5 text-stone-400">
                                                        {(() => {
                                                            const isHistoryExpanded = expandedProductHistories.has(setting.id) || waitCount > 0
                                                            return isHistoryExpanded ? 'Thu gọn' : 'Xem chi tiết'
                                                        })()}
                                                        <svg className={`w-3.5 h-3.5 transform transition-transform ${
                                                            (expandedProductHistories.has(setting.id) || waitCount > 0) ? 'rotate-180 text-indigo-500' : 'text-stone-400'
                                                        }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </span>
                                                </button>
                                            )}

                                            {(() => {
                                                const isHistoryExpanded = expandedProductHistories.has(setting.id) || waitCount > 0
                                                if (isHistoryExpanded && journals.length > 0) {
                                                    return (
                                                        <div className="divide-y divide-stone-100 dark:divide-zinc-700 max-h-60 overflow-y-auto">
                                                            {[...journals]
                                                                .sort((a, b) => {
                                                                    const aPending = a.status === 'completed_by_production' || (a.status === 'sent' && (a as any).from_department === 'Sản xuất')
                                                                    const bPending = b.status === 'completed_by_production' || (b.status === 'sent' && (b as any).from_department === 'Sản xuất')
                                                                    if (aPending && !bPending) return -1
                                                                    if (!aPending && bPending) return 1
                                                                    return new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
                                                                })
                                                                .map(j => {
                                                                    const st = j.status
                                                                    const isPendingAction = st === 'completed_by_production' || (st === 'sent' && (j as any).from_department === 'Sản xuất')
                                                                const isExpanded = expandedJournals.has(j.id) || isPendingAction
                                                                
                                                                let badge = <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500">--</span>
                                                                if (st === 'sent') {
                                                                    if ((j as any).from_department === 'Kho') badge = <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">Kho gửi</span>
                                                                    else badge = <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold">SX gửi</span>
                                                                } else if (st === 'received_by_production') {
                                                                    badge = <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓ SX đã nhận</span>
                                                                } else if (st === 'completed_by_production') {
                                                                    badge = <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold animate-pulse">SX xong</span>
                                                                } else if (st === 'received_by_warehouse') {
                                                                    badge = <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">✓ Kho đã nhận</span>
                                                                } else if (st === 'cancelled') {
                                                                    badge = <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">Hủy</span>
                                                                }
                                                                
                                                                // Format short time
                                                                const getShortTime = (dateStr: string) => {
                                                                    try {
                                                                        const d = new Date(dateStr)
                                                                        return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
                                                                    } catch {
                                                                        return ''
                                                                    }
                                                                }
                                                                
                                                                return (
                                                                    <div key={j.id} 
                                                                        onClick={() => !isPendingAction && toggleExpandJournal(j.id)}
                                                                        className={`flex flex-col border-b border-stone-100 dark:border-zinc-700 last:border-b-0 transition-all ${
                                                                            isPendingAction 
                                                                                ? 'bg-rose-50/40 dark:bg-rose-950/10 border-l-4 border-l-rose-500 px-3 py-3' 
                                                                                : 'hover:bg-stone-50/50 dark:hover:bg-zinc-700/20 cursor-pointer px-4 py-2.5'
                                                                        }`}
                                                                    >
                                                                        <div className="flex items-center justify-between gap-3">
                                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                                {badge}
                                                                                <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                                                                                    {j.quantity_sent} {j.unit}
                                                                                </span>
                                                                                {j.delivery_code && (
                                                                                    <span className="text-[10px] text-stone-400 font-mono">
                                                                                        {j.delivery_code}
                                                                                    </span>
                                                                                )}
                                                                                {isPendingAction && (
                                                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500 text-white font-bold animate-pulse uppercase tracking-wider shrink-0">
                                                                                        Chờ nhận
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            
                                                                            <div className="flex items-center gap-2 shrink-0">
                                                                                {isPendingAction && (
                                                                                    <>
                                                                                        <button onClick={(e) => { e.stopPropagation(); handleDirectReceive(j); }} 
                                                                                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold shadow-sm active:scale-95 transition-all flex items-center gap-0.5">
                                                                                            <Check size={12} /> Nhận đủ
                                                                                        </button>
                                                                                        <button onClick={(e) => { e.stopPropagation(); setRejectModal({ journal: j }); }} 
                                                                                            className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[11px] font-bold shadow-sm active:scale-95 transition-all flex items-center gap-0.5">
                                                                                            <X size={12} /> Từ chối
                                                                                        </button>
                                                                                    </>
                                                                                )}
                                                                                {!isPendingAction && (
                                                                                    <span className="text-[10px] text-stone-400 flex items-center gap-1.5 hover:text-stone-600">
                                                                                        {!isExpanded && <span className="text-[10px] bg-stone-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded text-stone-500 font-medium">{getShortTime(j.sent_at)}</span>}
                                                                                        <svg className={`w-3.5 h-3.5 transform transition-transform ${isExpanded ? 'rotate-180 text-stone-600' : 'text-stone-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                                                        </svg>
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        {isExpanded && (
                                                                            <div className="text-[10px] text-stone-400 mt-2 pl-2 border-l border-stone-200 dark:border-zinc-700 space-y-1 py-0.5 animate-fadeIn">
                                                                                {j.sent_by_name && (
                                                                                    <div>Gửi: <span className="font-semibold text-stone-600 dark:text-stone-300">{j.sent_by_name}</span> lúc <span className="font-medium text-stone-500">{formatDateTime(j.sent_at)}</span></div>
                                                                                )}
                                                                                {st === 'received_by_production' && j.received_by_production_name && (
                                                                                    <div className="text-emerald-600 dark:text-emerald-400 font-medium">Nhận: <span className="font-bold">{j.received_by_production_name}</span> lúc <span>{formatDateTime(j.received_by_production_at || j.updated_at)}</span></div>
                                                                                )}
                                                                                {st === 'received_by_warehouse' && j.received_by_warehouse_name && (
                                                                                    <div className="text-emerald-600 dark:text-emerald-400 font-medium">Nhận: <span className="font-bold">{j.received_by_warehouse_name}</span> lúc <span>{formatDateTime(j.received_by_warehouse_at || j.updated_at)}</span></div>
                                                                                )}
                                                                                {st === 'completed_by_production' && j.completed_by_name && (
                                                                                    <div className="text-amber-600 dark:text-amber-400 font-medium">Xong: <span className="font-bold">{j.completed_by_name}</span> lúc <span>{formatDateTime(j.completed_by_production_at || j.updated_at)}</span></div>
                                                                                )}
                                                                                {(st === 'completed_by_production' || st === 'received_by_warehouse') && j.result_item_name && (
                                                                                    <p className="text-[10px] text-emerald-600 font-medium mt-1">→ {j.result_item_name} ({j.result_quantity} {j.result_unit})</p>
                                                                                )}
                                                                                {(() => {
                                                                                    const { text: notesText } = parseNotes(j.notes)
                                                                                    const isReject = j.notes && j.notes.includes('[Từ chối]')
                                                                                    const isDiff = j.notes && j.notes.includes('[Chênh lệch]')
                                                                                    
                                                                                    return (
                                                                                        <>
                                                                                            {notesText && (
                                                                                                isReject ? (
                                                                                                    <div className="mt-2 p-2.5 bg-rose-50 dark:bg-rose-950/10 border border-rose-200/50 dark:border-rose-800/30 rounded-xl text-[10px] text-rose-700 dark:text-rose-400 font-medium flex items-start gap-1.5 animate-fadeIn">
                                                                                                        <X size={12} className="shrink-0 mt-0.5 text-rose-500" />
                                                                                                        <div>{notesText}</div>
                                                                                                    </div>
                                                                                                ) : isDiff ? (
                                                                                                    <div className="mt-2 p-2.5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 rounded-xl text-[10px] text-amber-700 dark:text-amber-400 font-medium flex items-start gap-1.5">
                                                                                                        <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                                                                                                        <div>{notesText}</div>
                                                                                                    </div>
                                                                                                ) : (
                                                                                                    <div className="text-[9px] text-stone-500 italic mt-1 pl-1">Ghi chú: {notesText}</div>
                                                                                                )
                                                                                            )}
                                                                                        </>
                                                                                    )
                                                                                })()}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    )
                                                } else if (journals.length === 0) {
                                                    return <div className="px-4 py-3 text-center text-xs text-stone-400">Chưa có đợt giao nhận nào</div>
                                                }
                                                return null
                                            })()}
                                        </div>
                                    )
                                })}
                            </div>
                            {selectedGroup.products.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <PackageOpen size={48} className="text-stone-300 mb-4" />
                                    <p className="text-stone-500">Chưa có sản phẩm nào</p>
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
                                <div className="grid grid-cols-2 gap-3">
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
                                        <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-1">Đơn vị</label>
                                        <select
                                            value={sendUnit}
                                            onChange={e => setSendUnit(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        >
                                            <option value="Thùng">Thùng</option>
                                            <option value="Kg">Kg</option>
                                        </select>
                                    </div>
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

            {/* Reject Modal */}
            {rejectModal && (() => {
                const j = rejectModal.journal
                const isFromProductionSent = j.status === 'sent' && (j as any).from_department === 'Sản xuất'
                const qty = isFromProductionSent ? j.quantity_sent : (j.result_quantity || j.quantity_sent)
                const unit = isFromProductionSent ? j.unit : (j.result_unit || j.unit)

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="bg-white dark:bg-zinc-800 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-fadeIn">
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
                                        <Truck size={22} className="text-rose-600" />
                                        Từ chối &amp; Trả về Sản xuất
                                    </h3>
                                    <button onClick={() => setRejectModal(null)} className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-zinc-700">
                                        <X size={18} />
                                    </button>
                                </div>

                                <div className="bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 rounded-2xl p-3.5 mb-4 space-y-1">
                                    <p className="font-bold text-stone-850 dark:text-stone-150">{j.item_name}</p>
                                    <p className="text-xs text-stone-500">Số lượng bị từ chối: <strong>{qty} {unit}</strong></p>
                                </div>

                                <div className="mb-4">
                                    <label className="block text-xs font-bold text-stone-500 mb-1.5 uppercase">
                                        Lý do từ chối trả về <span className="text-rose-500 font-extrabold">* (Bắt buộc)</span>
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        placeholder="Ví dụ: Gửi thiếu số lượng, sai mặt hàng, hàng bị dập nát..."
                                        className="w-full px-4 py-3 bg-stone-50 dark:bg-zinc-900 border border-rose-200 dark:border-rose-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
                                    />
                                </div>

                                <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-stone-200 dark:border-zinc-700">
                                    <button onClick={() => setRejectModal(null)} className="px-4 py-2 text-sm font-bold text-stone-600 hover:bg-stone-100 dark:hover:bg-zinc-700 rounded-2xl">
                                        Hủy
                                    </button>
                                    <button 
                                        onClick={handleRejectConfirm} 
                                        className="px-6 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-2xl shadow-lg shadow-rose-500/20 active:scale-95 transition-all"
                                    >
                                        Xác nhận từ chối &amp; Trả về
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })()}

            {/* Open Shift Modal */}
            {openShiftModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white dark:bg-zinc-800 rounded-3xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
                        <div className="p-6">
                            <h3 className="text-base font-black text-stone-900 dark:text-white flex items-center gap-1.5 mb-4">
                                🟢 Bắt đầu ca làm việc mới
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-stone-400 mb-1.5 uppercase">Người mở ca</label>
                                    <input 
                                        type="text" 
                                        disabled 
                                        value={profile?.full_name || 'Nhân viên'} 
                                        className="w-full px-4 py-2.5 bg-stone-100 dark:bg-zinc-700 rounded-2xl text-xs font-semibold outline-none" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-stone-400 mb-1.5 uppercase">Ghi chú đầu ca (nếu có)</label>
                                    <textarea 
                                        rows={2}
                                        value={openNotes}
                                        onChange={(e) => setOpenNotes(e.target.value)}
                                        placeholder="Ví dụ: Kiểm tra dụng cụ ca trước đầy đủ, máy móc vận hành bình thường..."
                                        className="w-full px-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none" 
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-stone-200 dark:border-zinc-700">
                                <button onClick={() => setOpenShiftModal(false)} className="px-4 py-2 text-xs font-bold text-stone-500 hover:bg-stone-100 rounded-xl">
                                    Hủy
                                </button>
                                <button onClick={handleOpenShift} className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md">
                                    Xác nhận Mở ca
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Close Shift Modal */}
            {closeShiftModal && shiftSummary && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white dark:bg-zinc-800 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                        <div className="p-6">
                            <h3 className="text-base font-black text-stone-900 dark:text-white flex items-center gap-1.5 mb-4 text-rose-600">
                                🔴 Chốt ca &amp; Bàn giao đối soát
                            </h3>
                            <div className="bg-stone-50 dark:bg-zinc-900 rounded-2xl p-4 mb-4 space-y-3">
                                <h4 className="text-xs font-black text-stone-500 uppercase tracking-wider">Tổng kết ca làm việc</h4>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="p-2 bg-white dark:bg-zinc-800 rounded-xl border border-stone-200/50">
                                        <div className="text-[9px] text-stone-400 font-bold uppercase">Tổng đợt</div>
                                        <div className="text-sm font-black mt-0.5">{shiftSummary.total_sent}</div>
                                    </div>
                                    <div className="p-2 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100/50 text-emerald-600">
                                        <div className="text-[9px] font-bold uppercase">Thành công</div>
                                        <div className="text-sm font-black mt-0.5">{shiftSummary.total_received}</div>
                                    </div>
                                    <div className="p-2 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-100/50 text-rose-600">
                                        <div className="text-[9px] font-bold uppercase">Từ chối</div>
                                        <div className="text-sm font-black mt-0.5">{shiftSummary.total_cancelled}</div>
                                    </div>
                                </div>

                                {Object.keys(shiftSummary.units_summary).length > 0 && (
                                    <div className="border border-stone-200/50 dark:border-zinc-700/50 rounded-xl overflow-hidden mt-2 text-[10px]">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="bg-stone-100 dark:bg-zinc-800 font-bold text-stone-500 border-b border-stone-200/50">
                                                    <th className="p-2">ĐVT</th>
                                                    <th className="p-2 text-right">Gửi</th>
                                                    <th className="p-2 text-right text-emerald-600">Nhận</th>
                                                    <th className="p-2 text-right text-rose-600">Hủy</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.entries(shiftSummary.units_summary).map(([unit, data]: any) => (
                                                    <tr key={unit} className="border-b border-stone-100 dark:border-zinc-700/30">
                                                        <td className="p-2 font-bold">{unit}</td>
                                                        <td className="p-2 text-right">{data.sent}</td>
                                                        <td className="p-2 text-right text-emerald-600 font-bold">{data.received}</td>
                                                        <td className="p-2 text-right text-rose-600 font-bold">{data.cancelled}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-stone-400 mb-1.5 uppercase">Ghi chú bàn giao cuối ca</label>
                                    <textarea 
                                        rows={2}
                                        value={closeNotes}
                                        onChange={(e) => setCloseNotes(e.target.value)}
                                        placeholder="Ví dụ: Đã giao nhận đủ, không mất mát hao hụt, bàn giao ca sau dụng cụ đầy đủ..."
                                        className="w-full px-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl text-xs focus:ring-2 focus:ring-rose-500 outline-none" 
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-stone-200 dark:border-zinc-700">
                                <button onClick={() => setCloseShiftModal(false)} className="px-4 py-2 text-xs font-bold text-stone-500 hover:bg-stone-100 rounded-xl">
                                    Hủy
                                </button>
                                <button onClick={handleCloseShift} className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md">
                                    Xác nhận chốt ca
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
