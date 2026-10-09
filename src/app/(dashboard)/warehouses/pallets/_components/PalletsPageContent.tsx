'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import {
    Search, RefreshCw, Layers, Trash2, X,
    Package, Loader2, ArrowLeft, Download,
    Edit3, Check, Calendar, MapPin, Users,
    Tag, AlertCircle, FileSpreadsheet, Link2,
    Unlink, CheckCircle2, AlertTriangle, Zap,
    ArrowUpRight, Eye
} from 'lucide-react'
import { advancedMatchSearch } from '@/lib/searchUtils'
import { decodeSTT, encodeSTT } from '@/lib/numberUtils'
import { syncDatesFromBoxesToLot } from '@/lib/lotDateSync'

interface BoxLabelItem {
    id: string
    code: string
    quantity: number
    unit: string
    status: string
    semi_finished_lot_code: string | null
    finished_lot_code: string | null
    created_at: string
    metadata?: {
        pallet_stt?: string
        pallet_local_id?: string
        scan_type?: string
        stamp_line1?: string
        stamp_line2?: string
        box_index?: number | string
        sku?: string
        product_name?: string
        spec?: string
        shift_group?: string
        region?: string
        production_date?: string
        packaging_date?: string
    } | null
    products: {
        name: string
        sku: string
        internal_name: string | null
    } | null
}

interface PalletLot {
    id: string
    code: string
    daily_seq?: number | null
    production_code: string | null
    system_code: string
    company_id: string | null
    created_at: string
    inbound_date: string | null
    quantity: number
    products: { name: string; sku: string } | null
    box_labels: BoxLabelItem[]
}

interface UnlinkedPalletGroup {
    pallet_stt: string
    boxes: BoxLabelItem[]
    total_weight: number
    created_at: string
    matchedLot?: {
        id: string
        code: string
        daily_seq?: number | null
        product_name?: string
    } | null
}

function getBoxIndex(box: BoxLabelItem): string {
    if (box.metadata?.box_index !== undefined && box.metadata?.box_index !== null) {
        return String(box.metadata.box_index)
    }
    if (!box.code) return '---'
    const parts = box.code.trim().split('-')
    const last = parts[parts.length - 1]
    return !isNaN(Number(last)) ? last : box.code
}

export default function PalletsPageContent() {
    const { currentSystem } = useSystem()
    const { showToast } = useToast()

    // Tab state: 'linked' (Đã kết nối) | 'unlinked' (Chưa kết nối)
    const [activeTab, setActiveTab] = useState<'linked' | 'unlinked'>('linked')

    // Linked Pallets state
    const [linkedPallets, setLinkedPallets] = useState<PalletLot[]>([])
    const [selectedPallet, setSelectedPallet] = useState<PalletLot | null>(null)

    // Unlinked Pallets state
    const [unlinkedGroups, setUnlinkedGroups] = useState<UnlinkedPalletGroup[]>([])
    const [selectedUnlinkedGroup, setSelectedUnlinkedGroup] = useState<UnlinkedPalletGroup | null>(null)
    const [previewGroup, setPreviewGroup] = useState<UnlinkedPalletGroup | null>(null)

    // Available Lots on web (for manual linking & matching)
    const [allActiveLots, setAllActiveLots] = useState<{ id: string; code: string; daily_seq: number | null; product_name?: string }[]>([])

    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [boxSearchQuery, setBoxSearchQuery] = useState('')
    const [isUnlinkingId, setIsUnlinkingId] = useState<string | null>(null)
    const [isExporting, setIsExporting] = useState(false)
    const [showMobileDetail, setShowMobileDetail] = useState(false)

    // Manual Link Modal
    const [groupToLink, setGroupToLink] = useState<UnlinkedPalletGroup | null>(null)
    const [linkLotSearch, setLinkLotSearch] = useState('')
    const [selectedLotForLink, setSelectedLotForLink] = useState<string | null>(null)
    const [isLinking, setIsLinking] = useState(false)

    // Auto-linking progress
    const [isAutoLinking, setIsAutoLinking] = useState(false)

    // Edit Box Modal
    const [editingBox, setEditingBox] = useState<BoxLabelItem | null>(null)
    const [editWeight, setEditWeight] = useState('')
    const [editLotCode, setEditLotCode] = useState('')
    const [isSavingEdit, setIsSavingEdit] = useState(false)

    // ─────────────────────────────────────────────────────────────
    // FETCH DATA
    // ─────────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        if (!currentSystem?.code) return
        setIsLoading(true)
        try {
            // 1. Fetch all lots in the system (to resolve daily_seq & for linking)
            const { data: lotsData, error: lotsErr } = await supabase
                .from('lots')
                .select(`
                    id,
                    code,
                    daily_seq,
                    production_code,
                    system_code,
                    company_id,
                    created_at,
                    inbound_date,
                    quantity,
                    products ( name, sku ),
                    box_labels (
                        id,
                        code,
                        quantity,
                        unit,
                        status,
                        semi_finished_lot_code,
                        finished_lot_code,
                        created_at,
                        metadata,
                        products ( name, sku, internal_name )
                    )
                `)
                .eq('system_code', currentSystem.code)
                .order('created_at', { ascending: false })
                .limit(200)

            if (lotsErr) throw lotsErr

            // 1.1 Store active lots for manual linking & matching
            const activeLotsList = (lotsData || []).map((l: any) => ({
                id: l.id,
                code: l.code,
                daily_seq: l.daily_seq,
                product_name: l.products?.name || ''
            }))
            setAllActiveLots(activeLotsList)

            // 1.2 Linked Pallets (Lots having box_labels attached)
            const linked = (lotsData || []).filter(
                (l: any) => Array.isArray(l.box_labels) && l.box_labels.length > 0
            ) as PalletLot[]

            linked.forEach(p => {
                p.box_labels.sort((a, b) => {
                    const idxA = parseInt(getBoxIndex(a), 10) || 0
                    const idxB = parseInt(getBoxIndex(b), 10) || 0
                    return idxA - idxB
                })
            })
            setLinkedPallets(linked)

            // Keep selected pallet in sync
            setSelectedPallet(prev => {
                if (!prev) return linked[0] || null
                return linked.find(p => p.id === prev.id) || linked[0] || null
            })

            // 2. Fetch Unlinked Boxes (lot_id IS NULL)
            const { data: unlinkedData, error: unlinkedErr } = await supabase
                .from('box_labels')
                .select(`
                    id,
                    code,
                    quantity,
                    unit,
                    status,
                    semi_finished_lot_code,
                    finished_lot_code,
                    created_at,
                    metadata,
                    products ( name, sku, internal_name )
                `)
                .is('lot_id', null)
                .order('created_at', { ascending: false })
                .limit(500)

            if (unlinkedErr) throw unlinkedErr

            // 2.1 Group unlinked box_labels by pallet_stt
            const groupMap = new Map<string, BoxLabelItem[]>()
            ;(unlinkedData || []).forEach((b: any) => {
                const rawStt = b.metadata?.pallet_stt
                if (!rawStt) return // Bỏ qua tem in đơn lẻ/QR test không thuộc đợt quét Pallet
                const stt = rawStt.trim().toUpperCase()
                if (!groupMap.has(stt)) {
                    groupMap.set(stt, [])
                }
                groupMap.get(stt)!.push(b)
            })

            const groups: UnlinkedPalletGroup[] = []
            groupMap.forEach((boxes, stt) => {
                boxes.sort((a, b) => {
                    const idxA = parseInt(getBoxIndex(a), 10) || 0
                    const idxB = parseInt(getBoxIndex(b), 10) || 0
                    return idxA - idxB
                })
                const total_weight = boxes.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0)
                const latestCreated = boxes[0]?.created_at || new Date().toISOString()

                // Check if any lot on web matches this STT
                const encodedSeq = encodeSTT(stt)
                const matched = activeLotsList.find(l => {
                    if (encodedSeq !== null && l.daily_seq === encodedSeq) return true
                    if (l.code.toUpperCase() === stt) return true
                    return false
                })

                groups.push({
                    pallet_stt: stt,
                    boxes,
                    total_weight,
                    created_at: latestCreated,
                    matchedLot: matched || null
                })
            })

            setUnlinkedGroups(groups)
            setSelectedUnlinkedGroup(prev => {
                if (!prev) return groups[0] || null
                return groups.find(g => g.pallet_stt === prev.pallet_stt) || groups[0] || null
            })
        } catch (err: any) {
            console.error('Lỗi tải dữ liệu Pallet:', err)
            showToast('Không thể tải dữ liệu Pallet: ' + (err.message || 'Lỗi mạng'), 'error')
        } finally {
            setIsLoading(false)
        }
    }, [currentSystem?.code, showToast])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    // Supabase Realtime subscription
    useEffect(() => {
        if (!currentSystem?.code) return

        const channel = supabase
            .channel('realtime_pallets_page')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'box_labels' }, () => {
                fetchData()
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'lots' }, () => {
                fetchData()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [currentSystem?.code, fetchData])

    // ─────────────────────────────────────────────────────────────
    // ACTIONS: UNLINK BOX (Gỡ thùng khỏi Lô)
    // ─────────────────────────────────────────────────────────────
    const handleUnlinkBox = async (box: BoxLabelItem) => {
        if (!selectedPallet) return
        const confirmed = window.confirm(`Bạn có chắc chắn muốn gỡ thùng #${getBoxIndex(box)} (${box.code}) ra khỏi Lô ${selectedPallet.code} không? Thùng sẽ được chuyển vào mục "Chưa kết nối".`)
        if (!confirmed) return

        setIsUnlinkingId(box.id)
        try {
            const { error } = await (supabase
                .from('box_labels') as any)
                .update({ lot_id: null, status: 'unlinked' })
                .eq('id', box.id)

            if (error) throw error

            showToast(`Đã gỡ thùng #${getBoxIndex(box)} ra khỏi Lô ${selectedPallet.code}!`, 'success')
            fetchData()
        } catch (err: any) {
            showToast('Lỗi khi gỡ thùng: ' + err.message, 'error')
        } finally {
            setIsUnlinkingId(null)
        }
    }

    // ─────────────────────────────────────────────────────────────
    // ACTIONS: UNLINK ENTIRE PALLET (Chuyển cả Pallet về Chưa kết nối)
    // ─────────────────────────────────────────────────────────────
    const handleUnlinkEntirePallet = async (pallet: PalletLot) => {
        const palletStt = pallet.daily_seq ? decodeSTT(pallet.daily_seq) : pallet.code
        const confirmed = window.confirm(
            `HỦY KẾT NỐI PALLET: Bạn có chắc muốn ngắt liên kết toàn bộ ${pallet.box_labels.length} thùng của Lô ${pallet.code} (STT: ${palletStt}) không?\n\nToàn bộ thùng sẽ chuyển về mục "Chưa kết nối" để ghép nối lại khi cần.`
        )
        if (!confirmed) return

        try {
            const boxIds = pallet.box_labels.map(b => b.id)
            const { error } = await (supabase
                .from('box_labels') as any)
                .update({
                    lot_id: null,
                    status: 'unlinked',
                    metadata: { pallet_stt: palletStt }
                })
                .in('id', boxIds)

            if (error) throw error

            showToast(`Đã chuyển toàn bộ thùng của STT ${palletStt} sang mục "Chưa kết nối"!`, 'success')
            fetchData()
        } catch (err: any) {
            showToast('Lỗi khi hủy liên kết Pallet: ' + err.message, 'error')
        }
    }

    // ─────────────────────────────────────────────────────────────
    // ACTIONS: CONNECT UNLINKED PALLET TO A LOT (Ghép nối vào Lô)
    // ─────────────────────────────────────────────────────────────
    const handleLinkGroupToLot = async (group: UnlinkedPalletGroup, targetLotId: string) => {
        const targetLot = allActiveLots.find(l => l.id === targetLotId)
        if (!targetLot) {
            showToast('Không tìm thấy thông tin Lô được chọn!', 'error')
            return
        }

        setIsLinking(true)
        try {
            const boxIds = group.boxes.map(b => b.id)
            const { error: boxErr } = await (supabase
                .from('box_labels') as any)
                .update({
                    lot_id: targetLot.id,
                    status: 'linked'
                })
                .in('id', boxIds)

            if (boxErr) throw boxErr

            // Tự động đồng bộ ngày sản xuất / ngày nguyên liệu vào Lô
            await syncDatesFromBoxesToLot(targetLot.id, group.boxes)

            showToast(`✅ Đã kết nối ${group.boxes.length} thùng (STT: ${group.pallet_stt}) vào Lô "${targetLot.code}"!`, 'success')
            setGroupToLink(null)
            setSelectedLotForLink(null)
            fetchData()
        } catch (err: any) {
            showToast('Lỗi kết nối Lô: ' + err.message, 'error')
        } finally {
            setIsLinking(false)
        }
    }

    // ─────────────────────────────────────────────────────────────
    // ACTIONS: AUTO-LINK ALL MATCHED PALLETS (Tự động kết nối tất cả)
    // ─────────────────────────────────────────────────────────────
    const handleAutoLinkAll = async () => {
        const eligible = unlinkedGroups.filter(g => !!g.matchedLot)
        if (eligible.length === 0) {
            showToast('Không có Pallet nào có STT khớp với các Lô hiện tại trên Web mẹ.', 'warning')
            return
        }

        setIsAutoLinking(true)
        let successCount = 0
        try {
            for (const group of eligible) {
                const targetLot = group.matchedLot!
                const boxIds = group.boxes.map(b => b.id)
                const { error } = await (supabase
                    .from('box_labels') as any)
                    .update({
                        lot_id: targetLot.id,
                        status: 'linked'
                    })
                    .in('id', boxIds)

                if (!error) {
                    await syncDatesFromBoxesToLot(targetLot.id, group.boxes)
                    successCount++
                }
            }

            showToast(`⚡ Đã tự động kết nối thành công ${successCount} / ${eligible.length} Pallet vào Lô tương ứng!`, 'success')
            fetchData()
        } catch (err: any) {
            showToast('Lỗi tự động kết nối: ' + err.message, 'error')
        } finally {
            setIsAutoLinking(false)
        }
    }

    // ─────────────────────────────────────────────────────────────
    // ACTIONS: DELETE UNLINKED GROUP (Xóa đợt quét thùng chưa kết nối)
    // ─────────────────────────────────────────────────────────────
    const handleDeleteUnlinkedGroup = async (group: UnlinkedPalletGroup) => {
        const confirmed = window.confirm(`Bạn có chắc chắn muốn XÓA toàn bộ ${group.boxes.length} thùng chưa kết nối của STT "${group.pallet_stt}" không? Thao tác này không thể hoàn tác.`)
        if (!confirmed) return

        try {
            const boxIds = group.boxes.map(b => b.id)
            const { error } = await supabase
                .from('box_labels')
                .delete()
                .in('id', boxIds)

            if (error) throw error

            showToast(`Đã xóa ${group.boxes.length} thùng của STT ${group.pallet_stt}`, 'success')
            fetchData()
        } catch (err: any) {
            showToast('Lỗi khi xóa: ' + err.message, 'error')
        }
    }

    // ─────────────────────────────────────────────────────────────
    // ACTIONS: EDIT BOX
    // ─────────────────────────────────────────────────────────────
    const handleOpenEditBox = (box: BoxLabelItem) => {
        setEditingBox(box)
        setEditWeight(String(box.quantity || 20))
        setEditLotCode(box.semi_finished_lot_code || box.finished_lot_code || '')
    }

    const handleSaveBoxEdit = async () => {
        if (!editingBox) return
        const w = parseFloat(editWeight)
        if (isNaN(w) || w <= 0) {
            showToast('Khối lượng không hợp lệ', 'warning')
            return
        }

        setIsSavingEdit(true)
        try {
            const { error } = await (supabase
                .from('box_labels') as any)
                .update({
                    quantity: w,
                    semi_finished_lot_code: editLotCode.trim(),
                    finished_lot_code: editLotCode.trim()
                })
                .eq('id', editingBox.id)

            if (error) throw error

            showToast(`Đã cập nhật thùng #${getBoxIndex(editingBox)}!`, 'success')
            setEditingBox(null)
            fetchData()
        } catch (err: any) {
            showToast('Lỗi lưu thùng: ' + err.message, 'error')
        } finally {
            setIsSavingEdit(false)
        }
    }

    // ─────────────────────────────────────────────────────────────
    // ACTIONS: EXCEL EXPORT
    // ─────────────────────────────────────────────────────────────
    const handleExportExcel = async (pallet: PalletLot) => {
        setIsExporting(true)
        try {
            const ExcelJS = (await import('exceljs')).default
            const { saveAs } = (await import('file-saver')).default

            const workbook = new ExcelJS.Workbook()
            const sttStr = pallet.daily_seq ? decodeSTT(pallet.daily_seq) : pallet.code
            const worksheet = workbook.addWorksheet(`Pallet_${sttStr}`)

            worksheet.columns = [
                { header: 'STT Thùng', key: 'stt', width: 12 },
                { header: 'Mã Thùng Barcode', key: 'code', width: 34 },
                { header: 'Mã Lô Thành Phẩm', key: 'lot_code', width: 22 },
                { header: 'Mã Sản Phẩm (SKU)', key: 'sku', width: 20 },
                { header: 'Tên Sản Phẩm', key: 'product_name', width: 32 },
                { header: 'Quy Cách', key: 'spec', width: 16 },
                { header: 'Tổ / Ca Đóng Gói', key: 'shift', width: 18 },
                { header: 'Vùng Nguyên Liệu', key: 'region', width: 18 },
                { header: 'Ngày Đóng Gói', key: 'packaging_date', width: 16 },
                { header: 'Khối Lượng (Kg)', key: 'weight', width: 16 },
            ]

            pallet.box_labels.forEach(box => {
                worksheet.addRow({
                    stt: getBoxIndex(box),
                    code: box.code,
                    lot_code: box.finished_lot_code || box.semi_finished_lot_code || '---',
                    sku: box.metadata?.sku || box.products?.sku || '---',
                    product_name: box.metadata?.product_name || box.products?.name || '---',
                    spec: box.metadata?.spec || '---',
                    shift: box.metadata?.shift_group || '---',
                    region: box.metadata?.region || '---',
                    packaging_date: box.metadata?.packaging_date || '---',
                    weight: Number(box.quantity) || 20,
                })
            })

            const buffer = await workbook.xlsx.writeBuffer()
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            saveAs(blob, `Pallet_${sttStr}_ChiTiet_${new Date().toISOString().slice(0, 10)}.xlsx`)
            showToast('Xuất báo cáo Excel Pallet thành công!', 'success')
        } catch (err: any) {
            console.error('Export Excel Error:', err)
            showToast('Lỗi xuất Excel: ' + err.message, 'error')
        } finally {
            setIsExporting(false)
        }
    }

    // ─────────────────────────────────────────────────────────────
    // FILTERED LISTS
    // ─────────────────────────────────────────────────────────────
    const filteredLinkedPallets = useMemo(() => {
        if (!searchQuery.trim()) return linkedPallets
        return linkedPallets.filter(p => {
            const stt = p.daily_seq ? decodeSTT(p.daily_seq) : ''
            return (
                advancedMatchSearch(p.code, searchQuery) ||
                advancedMatchSearch(stt, searchQuery) ||
                (p.production_code && advancedMatchSearch(p.production_code, searchQuery)) ||
                (p.products?.name && advancedMatchSearch(p.products.name, searchQuery))
            )
        })
    }, [linkedPallets, searchQuery])

    const filteredUnlinkedGroups = useMemo(() => {
        if (!searchQuery.trim()) return unlinkedGroups
        return unlinkedGroups.filter(g => advancedMatchSearch(g.pallet_stt, searchQuery))
    }, [unlinkedGroups, searchQuery])

    const filteredBoxes = useMemo(() => {
        if (!selectedPallet) return []
        if (!boxSearchQuery.trim()) return selectedPallet.box_labels
        return selectedPallet.box_labels.filter(b => {
            const idx = getBoxIndex(b)
            return (
                advancedMatchSearch(b.code, boxSearchQuery) ||
                advancedMatchSearch(idx, boxSearchQuery) ||
                (b.finished_lot_code && advancedMatchSearch(b.finished_lot_code, boxSearchQuery)) ||
                (b.metadata?.sku && advancedMatchSearch(b.metadata.sku, boxSearchQuery)) ||
                (b.metadata?.shift_group && advancedMatchSearch(b.metadata.shift_group, boxSearchQuery))
            )
        })
    }, [selectedPallet, boxSearchQuery])

    const filteredLotsForModal = useMemo(() => {
        if (!linkLotSearch.trim()) return allActiveLots.slice(0, 20)
        return allActiveLots.filter(l => {
            const stt = l.daily_seq ? decodeSTT(l.daily_seq) : ''
            return (
                advancedMatchSearch(l.code, linkLotSearch) ||
                advancedMatchSearch(stt, linkLotSearch) ||
                (l.product_name && advancedMatchSearch(l.product_name, linkLotSearch))
            )
        }).slice(0, 20)
    }, [allActiveLots, linkLotSearch])

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] p-4 md:p-6 bg-stone-50/50 dark:bg-zinc-950 font-sans">
            {/* ── HEADER ────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-stone-200 dark:border-zinc-800">
                <div>
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
                            <Layers size={22} />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-black text-stone-900 dark:text-zinc-100 tracking-tight">
                                Quản lý Pallet Quét (App Mobile)
                            </h1>
                            <p className="text-xs text-stone-500 dark:text-zinc-400">
                                Lô do Web tạo · Điện thoại quét OCR và tự động kết nối theo STT
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Tab Navigation */}
                    <div className="flex items-center p-1 bg-stone-200/60 dark:bg-zinc-800/80 rounded-xl">
                        <button
                            onClick={() => { setActiveTab('linked'); setShowMobileDetail(false); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                activeTab === 'linked'
                                    ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                                    : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-100'
                            }`}
                        >
                            <CheckCircle2 size={14} />
                            <span>Đã kết nối</span>
                            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                                {linkedPallets.length}
                            </span>
                        </button>

                        <button
                            onClick={() => { setActiveTab('unlinked'); setShowMobileDetail(false); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                activeTab === 'unlinked'
                                    ? 'bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 shadow-xs'
                                    : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-100'
                            }`}
                        >
                            <Unlink size={14} />
                            <span>Chưa kết nối</span>
                            {unlinkedGroups.length > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-extrabold animate-pulse">
                                    {unlinkedGroups.length}
                                </span>
                            )}
                        </button>
                    </div>

                    <button
                        onClick={fetchData}
                        disabled={isLoading}
                        title="Tải lại dữ liệu"
                        className="p-2 text-stone-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl hover:bg-stone-50 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* ── MAIN CONTENT (2 PANELS) ────────────────────────── */}
            {activeTab === 'linked' ? (
                /* TAB 1: ĐÃ KẾT NỐI */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
                    {/* PANEL TRÁI: DANH SÁCH LÔ / PALLET ĐÃ KẾT NỐI (4 Cols) */}
                    <div className={`lg:col-span-4 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-xs overflow-hidden ${showMobileDetail ? 'hidden lg:flex' : 'flex'}`}>
                        {/* Search Bar */}
                        <div className="p-3 border-b border-stone-100 dark:border-zinc-800">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={15} />
                                <input
                                    type="text"
                                    placeholder="Tìm theo STT (C544, F3219...), mã lô..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-1.5 bg-stone-50 dark:bg-zinc-800/60 border border-stone-200 dark:border-zinc-700 rounded-xl text-xs text-stone-800 dark:text-zinc-200 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        {/* Pallet List */}
                        <div className="flex-1 overflow-y-auto divide-y divide-stone-100 dark:divide-zinc-800/60 p-2 space-y-1.5">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-16 text-stone-400">
                                    <Loader2 className="animate-spin mb-2" size={24} />
                                    <span className="text-xs">Đang tải danh sách Pallet...</span>
                                </div>
                            ) : filteredLinkedPallets.length === 0 ? (
                                <div className="text-center py-16 px-4">
                                    <Layers className="mx-auto text-stone-300 dark:text-zinc-600 mb-2" size={36} />
                                    <p className="text-xs font-bold text-stone-600 dark:text-zinc-400">
                                        Không tìm thấy Pallet nào đã kết nối
                                    </p>
                                    <p className="text-[11px] text-stone-400 dark:text-zinc-500 mt-1">
                                        Hãy quét tem và đồng bộ từ App di động, hoặc kiểm tra tab "Chưa kết nối".
                                    </p>
                                </div>
                            ) : (
                                filteredLinkedPallets.map(pallet => {
                                    const isSelected = selectedPallet?.id === pallet.id
                                    const count = pallet.box_labels.length
                                    const isFull = count >= 30
                                    const totalWeight = pallet.box_labels.reduce((s, b) => s + (Number(b.quantity) || 0), 0)
                                    const sttDisplay = pallet.daily_seq ? decodeSTT(pallet.daily_seq) : pallet.code

                                    return (
                                        <div
                                            key={pallet.id}
                                            onClick={() => {
                                                setSelectedPallet(pallet)
                                                setShowMobileDetail(true)
                                            }}
                                            className={`p-3 rounded-xl cursor-pointer transition-all border ${
                                                isSelected
                                                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-500/40 shadow-xs'
                                                    : 'bg-white dark:bg-zinc-900 border-stone-100 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-zinc-700'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-200/50 dark:border-emerald-800/40">
                                                        STT: {sttDisplay}
                                                    </span>
                                                    <span className="font-mono text-xs text-stone-500 dark:text-zinc-400">
                                                        ({pallet.code})
                                                    </span>
                                                </div>
                                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                                                    isFull
                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                                }`}>
                                                    {count}/30 thùng
                                                </span>
                                            </div>

                                            <p className="text-xs font-bold text-stone-800 dark:text-zinc-200 truncate mb-2">
                                                {pallet.products?.name || 'Sản phẩm chưa định danh'}
                                            </p>

                                            {/* Progress Bar 30 boxes */}
                                            <div className="w-full bg-stone-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mb-2">
                                                <div
                                                    className={`h-full transition-all duration-300 ${isFull ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                                    style={{ width: `${Math.min(100, (count / 30) * 100)}%` }}
                                                />
                                            </div>

                                            <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-zinc-400 pt-1 border-t border-stone-100 dark:border-zinc-800/60">
                                                <span>KL: <strong className="text-stone-800 dark:text-zinc-200">{totalWeight.toFixed(1)} Kg</strong></span>
                                                <span>{new Date(pallet.created_at).toLocaleDateString('vi-VN')}</span>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {/* PANEL PHẢI: CHI TIẾT 30 THÙNG CỦA PALLET ĐANG CHỌN (8 Cols) */}
                    <div className={`lg:col-span-8 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-xs overflow-hidden ${showMobileDetail ? 'flex' : 'hidden lg:flex'}`}>
                        {!selectedPallet ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-stone-400 py-20">
                                <Layers size={40} className="text-stone-300 dark:text-zinc-600 mb-2" />
                                <p className="text-xs font-bold text-stone-600 dark:text-zinc-400">
                                    Chọn một Pallet ở cột bên trái để xem chi tiết 30 thùng
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Header Panel Phải */}
                                <div className="p-4 border-b border-stone-100 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-900/50">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setShowMobileDetail(false)}
                                                className="lg:hidden p-1.5 text-stone-500 hover:text-stone-800 rounded-lg hover:bg-stone-100"
                                            >
                                                <ArrowLeft size={18} />
                                            </button>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h2 className="text-lg font-black text-stone-900 dark:text-zinc-100">
                                                        Pallet STT: {selectedPallet.daily_seq ? decodeSTT(selectedPallet.daily_seq) : selectedPallet.code}
                                                    </h2>
                                                    <span className="font-mono text-xs text-stone-500 dark:text-zinc-400">
                                                        [Lô: {selectedPallet.code}]
                                                    </span>
                                                </div>
                                                <p className="text-xs text-stone-600 dark:text-zinc-400 font-medium">
                                                    {selectedPallet.products?.name || 'Chưa gán tên sản phẩm'} · Tiến độ: {selectedPallet.box_labels.length}/30 thùng · Tổng: {selectedPallet.box_labels.reduce((s, b) => s + (Number(b.quantity) || 0), 0).toFixed(1)} Kg
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleExportExcel(selectedPallet)}
                                                disabled={isExporting}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                                            >
                                                {isExporting ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                                                <span>Xuất Excel Pallet</span>
                                            </button>

                                            <button
                                                onClick={() => handleUnlinkEntirePallet(selectedPallet)}
                                                title="Hủy liên kết Pallet (Chuyển về Chưa kết nối)"
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 rounded-xl text-xs font-bold border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer"
                                            >
                                                <Unlink size={14} />
                                                <span>Hủy liên kết Lô</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Search thùng */}
                                    <div className="mt-3 relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={14} />
                                        <input
                                            type="text"
                                            placeholder="Tìm nhanh trong 30 thùng: STT, mã thùng, quy cách, tổ..."
                                            value={boxSearchQuery}
                                            onChange={e => setBoxSearchQuery(e.target.value)}
                                            className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl text-xs text-stone-800 dark:text-zinc-200 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                        />
                                    </div>
                                </div>

                                {/* Danh sách 30 thẻ thùng */}
                                <div className="flex-1 overflow-y-auto p-4">
                                    {filteredBoxes.length === 0 ? (
                                        <div className="text-center py-12 text-stone-400 text-xs">
                                            Không có thùng nào khớp với từ khóa tìm kiếm.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                            {filteredBoxes.map(box => {
                                                const idx = getBoxIndex(box)
                                                const meta = box.metadata || {}

                                                return (
                                                    <div
                                                        key={box.id}
                                                        className="p-3 bg-stone-50/70 dark:bg-zinc-800/40 rounded-xl border border-stone-200/80 dark:border-zinc-800 hover:border-emerald-400 transition-all group"
                                                    >
                                                        <div className="flex items-start justify-between gap-2 mb-2">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="w-7 h-7 flex items-center justify-center font-black text-xs bg-emerald-600 text-white rounded-lg">
                                                                    #{idx}
                                                                </span>
                                                                <div>
                                                                    <p className="font-mono font-bold text-xs text-stone-800 dark:text-zinc-200 truncate max-w-[130px]" title={box.code}>
                                                                        {box.code}
                                                                    </p>
                                                                    <p className="text-[10px] text-stone-500">
                                                                        Lô: <strong className="text-stone-700 dark:text-zinc-300">{box.finished_lot_code || box.semi_finished_lot_code || '---'}</strong>
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    onClick={() => handleOpenEditBox(box)}
                                                                    title="Sửa thông tin thùng"
                                                                    className="p-1 text-stone-400 hover:text-emerald-600 rounded-md hover:bg-white dark:hover:bg-zinc-700"
                                                                >
                                                                    <Edit3 size={13} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleUnlinkBox(box)}
                                                                    disabled={isUnlinkingId === box.id}
                                                                    title="Gỡ thùng này ra khỏi Pallet"
                                                                    className="p-1 text-stone-400 hover:text-rose-600 rounded-md hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-50"
                                                                >
                                                                    {isUnlinkingId === box.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Metadata Details (Hỗ trợ cả Tem In OCR lẫn Dấu Đóng Mực) */}
                                                        {meta.scan_type === 'stamp' ? (
                                                            <div className="bg-amber-50/80 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200/80 dark:border-amber-800/60 text-[10px] space-y-1 mb-2">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="font-extrabold text-[10px] text-amber-700 dark:text-amber-400">📦 ĐÓNG DẤU MỰC</span>
                                                                    <span className="font-mono text-stone-500">#{idx}</span>
                                                                </div>
                                                                <p className="truncate"><strong className="text-stone-500">Dòng 1:</strong> <span className="font-mono font-bold text-stone-800 dark:text-zinc-200">{meta.stamp_line1 || '---'}</span></p>
                                                                <p className="truncate"><strong className="text-stone-500">Dòng 2:</strong> <span className="font-mono font-bold text-stone-800 dark:text-zinc-200">{meta.stamp_line2 || '---'}</span></p>
                                                            </div>
                                                        ) : (
                                                            <div className="grid grid-cols-2 gap-1 text-[10px] bg-white dark:bg-zinc-800/80 p-2 rounded-lg border border-stone-100 dark:border-zinc-700/60 mb-2">
                                                                <div>
                                                                    <span className="text-stone-400 block">Quy cách:</span>
                                                                    <span className="font-bold text-stone-700 dark:text-zinc-300 truncate block">{meta.spec || '---'}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-stone-400 block">Tổ / Ca:</span>
                                                                    <span className="font-bold text-stone-700 dark:text-zinc-300 truncate block">{meta.shift_group || '---'}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-stone-400 block">Ngày SX:</span>
                                                                    <span className="font-bold text-amber-600 dark:text-amber-400 truncate block">{meta.production_date || '---'}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-stone-400 block">Ngày ĐG:</span>
                                                                    <span className="font-bold text-stone-700 dark:text-zinc-300 truncate block">{meta.packaging_date || '---'}</span>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="flex items-center justify-between text-[11px] pt-1">
                                                            <span className="text-stone-400 text-[10px]">Trọng lượng:</span>
                                                            <span className="font-black text-xs text-emerald-600 dark:text-emerald-400">
                                                                {Number(box.quantity || 20).toFixed(1)} {box.unit}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            ) : (
                /* TAB 2: CHƯA KẾT NỐI (Chờ kết nối Lô) */
                <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-xs overflow-hidden">
                    {/* Toolbar tab Chưa kết nối */}
                    <div className="p-4 border-b border-stone-100 dark:border-zinc-800 bg-amber-50/40 dark:bg-amber-950/20">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl">
                                    <AlertTriangle size={20} />
                                </div>
                                <div>
                                    <h2 className="text-sm md:text-base font-black text-stone-900 dark:text-zinc-100">
                                        Danh Sách Thùng / Pallet Chờ Kết Nối Vào Lô
                                    </h2>
                                    <p className="text-xs text-stone-500 dark:text-zinc-400">
                                        Các thùng tem được gửi lên từ điện thoại khi Web mẹ chưa tạo Lô khớp STT. Bạn có thể tự động hoặc ghép thủ công vào bất kỳ Lô nào.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleAutoLinkAll}
                                    disabled={isAutoLinking || unlinkedGroups.filter(g => !!g.matchedLot).length === 0}
                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                                >
                                    {isAutoLinking ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
                                    <span>Tự động kết nối ({unlinkedGroups.filter(g => !!g.matchedLot).length})</span>
                                </button>
                            </div>
                        </div>

                        {/* Search trong tab Chưa kết nối */}
                        <div className="mt-3 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={14} />
                            <input
                                type="text"
                                placeholder="Tìm kiếm theo STT (C544, G588...)..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl text-xs text-stone-800 dark:text-zinc-200 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                            />
                        </div>
                    </div>

                    {/* Danh sách Pallet chưa kết nối */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-stone-400">
                                <Loader2 className="animate-spin mb-2" size={26} />
                                <span className="text-xs">Đang tải danh sách chờ kết nối...</span>
                            </div>
                        ) : filteredUnlinkedGroups.length === 0 ? (
                            <div className="text-center py-20 px-4">
                                <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={42} />
                                <p className="text-sm font-bold text-stone-800 dark:text-zinc-200">
                                    Tuyệt vời! Không có Pallet nào đang chờ kết nối
                                </p>
                                <p className="text-xs text-stone-400 dark:text-zinc-500 mt-1 max-w-md mx-auto">
                                    Mọi đợt quét từ điện thoại đều đã được ghép đúng vào các Lô hàng trên Web mẹ.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {filteredUnlinkedGroups.map(group => {
                                    const hasMatch = !!group.matchedLot
                                    return (
                                        <div
                                            key={group.pallet_stt}
                                            className={`p-4 rounded-2xl border transition-all ${
                                                hasMatch
                                                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                                                    : 'bg-stone-50/60 dark:bg-zinc-800/40 border-stone-200 dark:border-zinc-700'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-black text-sm text-stone-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 px-2.5 py-1 rounded-xl border border-stone-200 dark:border-zinc-700 shadow-2xs">
                                                        STT: {group.pallet_stt}
                                                    </span>
                                                    <span className="text-xs font-bold text-stone-600 dark:text-zinc-400">
                                                        {group.boxes.length} thùng
                                                    </span>
                                                </div>

                                                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                                                    {group.total_weight.toFixed(1)} Kg
                                                </span>
                                            </div>

                                            {/* Gợi ý nếu đã có Lô khớp STT */}
                                            {hasMatch ? (
                                                <div className="p-2.5 bg-emerald-100/70 dark:bg-emerald-950/60 rounded-xl border border-emerald-200/80 dark:border-emerald-800/60 mb-3 text-xs">
                                                    <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-bold mb-1">
                                                        <Zap size={14} className="fill-emerald-600 text-emerald-600" />
                                                        <span>Phát hiện Lô khớp trên Web!</span>
                                                    </div>
                                                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                                                        Lô: <strong className="font-mono">{group.matchedLot!.code}</strong> {group.matchedLot!.product_name ? `(${group.matchedLot!.product_name})` : ''}
                                                    </p>
                                                    <button
                                                        onClick={() => handleLinkGroupToLot(group, group.matchedLot!.id)}
                                                        disabled={isLinking}
                                                        className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50"
                                                    >
                                                        <Check size={14} />
                                                        <span>Ghép ngay vào Lô {group.matchedLot!.code}</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="p-2 bg-stone-100 dark:bg-zinc-800/80 rounded-xl mb-3 text-[11px] text-stone-500 dark:text-zinc-400">
                                                    Chưa có Lô mang STT "{group.pallet_stt}" trên Web mẹ. Hãy tạo Lô hoặc chọn một Lô có sẵn để ghép.
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-200/60 dark:border-zinc-700/60 text-xs">
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => setPreviewGroup(group)}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-zinc-800 hover:bg-stone-100 dark:hover:bg-zinc-700 text-stone-800 dark:text-zinc-200 border border-stone-200 dark:border-zinc-700 rounded-lg font-bold transition-colors cursor-pointer"
                                                    >
                                                        <Eye size={13} />
                                                        <span>Xem {group.boxes.length} thùng quét</span>
                                                    </button>

                                                    <button
                                                        onClick={() => {
                                                            setGroupToLink(group)
                                                            setLinkLotSearch('')
                                                            setSelectedLotForLink(group.matchedLot?.id || null)
                                                        }}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 bg-stone-200/80 hover:bg-stone-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-stone-800 dark:text-zinc-200 rounded-lg font-bold transition-colors cursor-pointer"
                                                    >
                                                        <Link2 size={13} />
                                                        <span>Ghép Lô</span>
                                                    </button>
                                                </div>

                                                <button
                                                    onClick={() => handleDeleteUnlinkedGroup(group)}
                                                    title="Xóa đợt quét này"
                                                    className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── MODAL CHỌN LÔ ĐỂ GHÉP NỐI THỦ CÔNG ──────────────── */}
            {groupToLink && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg p-5 shadow-2xl border border-stone-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-zinc-800">
                            <div>
                                <h3 className="font-bold text-base text-stone-900 dark:text-zinc-100">
                                    Ghép Pallet STT: {groupToLink.pallet_stt} vào Lô
                                </h3>
                                <p className="text-xs text-stone-500">
                                    Tổng cộng {groupToLink.boxes.length} thùng ({groupToLink.total_weight.toFixed(1)} Kg)
                                </p>
                            </div>
                            <button
                                onClick={() => setGroupToLink(null)}
                                className="text-stone-400 hover:text-stone-600 dark:hover:text-zinc-200"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Search Lots */}
                        <div className="my-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={15} />
                                <input
                                    type="text"
                                    placeholder="Tìm mã lô, STT, tên sản phẩm..."
                                    value={linkLotSearch}
                                    onChange={e => setLinkLotSearch(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl text-xs text-stone-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                        </div>

                        {/* List of Lots to choose */}
                        <div className="flex-1 overflow-y-auto divide-y divide-stone-100 dark:divide-zinc-800 space-y-1 my-2">
                            {filteredLotsForModal.length === 0 ? (
                                <p className="text-center py-8 text-xs text-stone-400">
                                    Không tìm thấy Lô nào phù hợp.
                                </p>
                            ) : (
                                filteredLotsForModal.map(lot => {
                                    const isSelected = selectedLotForLink === lot.id
                                    const lotStt = lot.daily_seq ? decodeSTT(lot.daily_seq) : ''
                                    return (
                                        <div
                                            key={lot.id}
                                            onClick={() => setSelectedLotForLink(lot.id)}
                                            className={`p-3 rounded-xl cursor-pointer transition-all border ${
                                                isSelected
                                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500'
                                                    : 'hover:bg-stone-50 dark:hover:bg-zinc-800/60 border-transparent'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-xs text-stone-900 dark:text-zinc-100">
                                                        {lot.code}
                                                    </span>
                                                    {lotStt && (
                                                        <span className="font-mono text-[11px] font-black text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">
                                                            STT: {lotStt}
                                                        </span>
                                                    )}
                                                </div>
                                                {isSelected && <Check size={16} className="text-emerald-600" />}
                                            </div>
                                            {lot.product_name && (
                                                <p className="text-[11px] text-stone-500 mt-1 truncate">
                                                    {lot.product_name}
                                                </p>
                                            )}
                                        </div>
                                    )
                                })
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100 dark:border-zinc-800">
                            <button
                                onClick={() => setGroupToLink(null)}
                                className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-xl"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={() => selectedLotForLink && handleLinkGroupToLot(groupToLink, selectedLotForLink)}
                                disabled={!selectedLotForLink || isLinking}
                                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer shadow-xs"
                            >
                                {isLinking ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                <span>Xác Nhận Ghép Vào Lô</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL XEM CHI TIẾT CÁC THÙNG QUÉT (CHƯA KẾT NỐI) ─ */}
            {previewGroup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-3xl p-5 shadow-2xl border border-stone-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-zinc-800">
                            <div>
                                <h3 className="font-bold text-base text-stone-900 dark:text-zinc-100 flex items-center gap-2">
                                    <span>Thông Tin Quét STT:</span>
                                    <span className="font-mono text-emerald-600 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-lg">
                                        {previewGroup.pallet_stt}
                                    </span>
                                </h3>
                                <p className="text-xs text-stone-500">
                                    Đã quét {previewGroup.boxes.length} thùng · Tổng trọng lượng: {previewGroup.total_weight.toFixed(1)} Kg
                                </p>
                            </div>
                            <button
                                onClick={() => setPreviewGroup(null)}
                                className="text-stone-400 hover:text-stone-600 dark:hover:text-zinc-200"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Danh sách thẻ thùng chi tiết */}
                        <div className="flex-1 overflow-y-auto p-2 my-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                            {previewGroup.boxes.map(box => {
                                const idx = getBoxIndex(box)
                                const meta = box.metadata || {}
                                return (
                                    <div
                                        key={box.id}
                                        className="p-2.5 bg-stone-50 dark:bg-zinc-800/50 rounded-xl border border-stone-200 dark:border-zinc-700 text-xs"
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="font-black text-xs bg-emerald-600 text-white w-6 h-6 flex items-center justify-center rounded-md">
                                                #{idx}
                                            </span>
                                            <span className="font-black text-emerald-600 dark:text-emerald-400">
                                                {Number(box.quantity).toFixed(1)} {box.unit}
                                            </span>
                                        </div>
                                        <p className="font-mono font-bold text-[11px] text-stone-800 dark:text-zinc-200 truncate mb-1" title={box.code}>
                                            {box.code}
                                        </p>
                                        {meta.scan_type === 'stamp' ? (
                                            <div className="bg-amber-50/80 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200/80 dark:border-amber-800/60 text-[10px] space-y-1 mb-1">
                                                <p className="truncate"><strong className="text-stone-500">Dòng 1:</strong> <span className="font-mono font-bold text-stone-800 dark:text-zinc-200">{meta.stamp_line1 || '---'}</span></p>
                                                <p className="truncate"><strong className="text-stone-500">Dòng 2:</strong> <span className="font-mono font-bold text-stone-800 dark:text-zinc-200">{meta.stamp_line2 || '---'}</span></p>
                                            </div>
                                        ) : (
                                            <div className="text-[10px] text-stone-500 space-y-0.5">
                                                <p>Lô tem: <strong className="text-stone-700 dark:text-zinc-300">{box.finished_lot_code || box.semi_finished_lot_code || '---'}</strong></p>
                                                <p>Quy cách: <strong className="text-stone-700 dark:text-zinc-300">{meta.spec || '---'}</strong></p>
                                                <p>Tổ: <strong className="text-stone-700 dark:text-zinc-300">{meta.shift_group || '---'}</strong></p>
                                                <p>Ngày SX: <strong className="text-amber-600 dark:text-amber-400">{meta.production_date || '---'}</strong></p>
                                                <p>Ngày ĐG: <strong className="text-stone-700 dark:text-zinc-300">{meta.packaging_date || '---'}</strong></p>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-stone-100 dark:border-zinc-800">
                            <span className="text-xs text-stone-400">
                                Dữ liệu quét OCR lưu trên hệ thống, không làm thay đổi thông tin của Lô Web mẹ.
                            </span>
                            <button
                                onClick={() => setPreviewGroup(null)}
                                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-bold rounded-xl"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL SỬA THÔNG TIN THÙNG ─────────────────────── */}
            {editingBox && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-stone-200 dark:border-zinc-800">
                        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-zinc-800">
                            <h3 className="font-bold text-base text-stone-900 dark:text-zinc-100">
                                Sửa Thùng #{getBoxIndex(editingBox)}
                            </h3>
                            <button
                                onClick={() => setEditingBox(null)}
                                className="text-stone-400 hover:text-stone-600 dark:hover:text-zinc-200"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4 my-4">
                            <div>
                                <label className="text-xs font-bold text-stone-600 dark:text-zinc-400 block mb-1">
                                    Mã Thùng:
                                </label>
                                <p className="font-mono text-xs text-stone-800 dark:text-zinc-200 bg-stone-100 dark:bg-zinc-800 p-2.5 rounded-lg">
                                    {editingBox.code}
                                </p>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-stone-600 dark:text-zinc-400 block mb-1">
                                    Khối lượng ({editingBox.unit}):
                                </label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={editWeight}
                                    onChange={e => setEditWeight(e.target.value)}
                                    className="w-full px-3 py-2 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm font-bold text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-stone-600 dark:text-zinc-400 block mb-1">
                                    Mã Lô:
                                </label>
                                <input
                                    type="text"
                                    value={editLotCode}
                                    onChange={e => setEditLotCode(e.target.value)}
                                    className="w-full px-3 py-2 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm font-bold text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100 dark:border-zinc-800">
                            <button
                                onClick={() => setEditingBox(null)}
                                className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-xl"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleSaveBoxEdit}
                                disabled={isSavingEdit}
                                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer"
                            >
                                {isSavingEdit ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                <span>Lưu Thay Đổi</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
