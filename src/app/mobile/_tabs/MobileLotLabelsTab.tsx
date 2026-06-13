'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import {
    ScanLine, Loader2, Trash2, X, CheckCircle2,
    ArrowLeft, RefreshCw, QrCode, Tag, Package,
    Layers, Link2, Link2Off, AlertCircle, ChevronRight,
    Calendar, Hash, Search
} from 'lucide-react'
import { encodeSTT, decodeSTT } from '@/lib/numberUtils'

// ─── Types ────────────────────────────────────────────────────────────────────
interface BoxLabel {
    id: string
    code: string
    quantity: number
    unit: string
    status: string
    lot_id: string | null
    semi_finished_lot_code: string | null
    finished_lot_code: string | null
    products: { name: string; sku: string; internal_name: string | null } | null
}

interface LotInfo {
    id: string
    code: string
    production_code: string | null
    system_code: string
    inbound_date: string | null
    created_at: string
    products: { name: string; sku: string } | null
    box_labels: BoxLabel[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getBoxIndex(code: string): string {
    if (!code) return '---'
    const parts = code.trim().split('-')
    const last = parts[parts.length - 1]
    return !isNaN(Number(last)) ? last : code
}

// ─── Scan Input Component ─────────────────────────────────────────────────────
function ScanInput({
    placeholder,
    onScan,
    isLoading,
    disabled = false,
    color = '#0891b2',
    autoFocusKey,
}: {
    placeholder: string
    onScan: (value: string) => void
    isLoading?: boolean
    disabled?: boolean
    color?: string
    autoFocusKey?: string | number
}) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [value, setValue] = useState('')

    // Re-focus whenever key changes
    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 100)
    }, [autoFocusKey])

    const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && value.trim()) {
            onScan(value.trim())
            setValue('')
        }
    }

    return (
        <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: disabled ? '#d4d4d8' : color }}>
                {isLoading ? <Loader2 size={20} className="animate-spin" /> : <QrCode size={20} />}
            </div>
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={e => setValue(e.target.value.toUpperCase())}
                onKeyDown={handleKey}
                placeholder={placeholder}
                disabled={disabled || isLoading}
                autoCapitalize="characters"
                className="mobile-input"
                style={{
                    paddingLeft: 44,
                    paddingRight: value ? 44 : 14,
                    fontSize: 15,
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    borderColor: disabled ? '#e4e4e7' : color + '40',
                    letterSpacing: 1,
                    opacity: disabled ? 0.5 : 1,
                }}
            />
            {value && (
                <button
                    onClick={() => setValue('')}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa', padding: 0 }}
                >
                    <X size={16} />
                </button>
            )}
        </div>
    )
}

// ─── Label Card ────────────────────────────────────────────────────────────────
function LabelCard({
    label,
    isJustLinked,
    isUnlinking,
    onUnlink,
}: {
    label: BoxLabel
    isJustLinked?: boolean
    isUnlinking: boolean
    onUnlink: () => void
}) {
    const prodName = label.products?.internal_name || label.products?.name || 'Không rõ'
    const boxIdx = getBoxIndex(label.code)

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px',
            background: isJustLinked ? '#ecfdf5' : '#fff',
            border: `1.5px solid ${isJustLinked ? '#6ee7b7' : '#f4f4f5'}`,
            borderRadius: 18,
            transition: 'all 0.3s ease',
        }}>
            {/* STT */}
            <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: isJustLinked ? '#d1fae5' : '#f4f4f5',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 900, color: isJustLinked ? '#065f46' : '#71717a' }}>
                    #{boxIdx}
                </span>
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 900, color: '#18181b', textTransform: 'uppercase' }}>
                        {label.code}
                    </span>
                    {isJustLinked && (
                        <span style={{ padding: '1px 6px', background: '#059669', color: '#fff', fontSize: 9, fontWeight: 900, borderRadius: 6 }}>
                            Vừa gán
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
                    {label.finished_lot_code && (
                        <span style={{ padding: '1px 6px', background: '#d1fae5', color: '#065f46', fontSize: 9, fontWeight: 800, borderRadius: 6 }}>
                            TP: {label.finished_lot_code}
                        </span>
                    )}
                    {label.semi_finished_lot_code && (
                        <span style={{ padding: '1px 6px', background: '#dbeafe', color: '#1e40af', fontSize: 9, fontWeight: 800, borderRadius: 6 }}>
                            BTP: {label.semi_finished_lot_code}
                        </span>
                    )}
                </div>
                <p style={{ fontSize: 11, color: '#a1a1aa', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {prodName} · {label.quantity} {label.unit}
                </p>
            </div>

            {/* Unlink */}
            <button
                disabled={isUnlinking}
                onClick={onUnlink}
                style={{
                    width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                    border: '1.5px solid #fee2e2', background: '#fef2f2',
                    color: '#ef4444', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', cursor: 'pointer',
                    opacity: isUnlinking ? 0.5 : 1,
                }}
            >
                {isUnlinking ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            </button>
        </div>
    )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function MobileLotLabelsTab() {
    const { currentSystem } = useSystem()
    const { showToast } = useToast()

    // Step: 'scan_pallet' | 'scan_label'
    const [step, setStep] = useState<'scan_pallet' | 'scan_label'>('scan_pallet')
    const [palletScanKey, setPalletScanKey] = useState(0) // Re-focus trigger
    const [labelScanKey, setLabelScanKey] = useState(0)

    const [isLoadingPallet, setIsLoadingPallet] = useState(false)
    const [isLinkingLabel, setIsLinkingLabel] = useState(false)
    const [unlinkingId, setUnlinkingId] = useState<string | null>(null)

    const [currentLot, setCurrentLot] = useState<LotInfo | null>(null)
    const [justLinkedIds, setJustLinkedIds] = useState<Set<string>>(new Set())

    // ── STT & Date Search States ───────────────────────────────────────────────
    const [sttInput, setSttInput] = useState('')
    const [inboundDate, setInboundDate] = useState(() => new Date().toISOString().split('T')[0])
    const [useDateFilter, setUseDateFilter] = useState(false)
    const [foundLots, setFoundLots] = useState<any[]>([])
    const [isSearchingLots, setIsSearchingLots] = useState(false)
    const [searchError, setSearchError] = useState('')

    // ── Quét Pallet trực tiếp qua QR code ────────────────────────────────────────
    const handleScanPallet = useCallback(async (rawCode: string) => {
        if (!currentSystem?.code) return
        setIsLoadingPallet(true)
        setSearchError('')
        try {
            const { data, error } = await supabase
                .from('lots')
                .select(`
                    id, code, production_code, system_code, created_at, inbound_date, daily_seq,
                    products ( name, sku ),
                    suppliers ( name ),
                    box_labels (
                        id, code, quantity, unit, status, lot_id,
                        semi_finished_lot_code, finished_lot_code,
                        products ( name, sku, internal_name )
                    )
                `)
                .eq('system_code', currentSystem.code)
                .ilike('code', rawCode)
                .maybeSingle()

            if (error) throw error

            const lotData = data as any
            if (!lotData) {
                showToast(`Không tìm thấy pallet: ${rawCode}`, 'error')
                setPalletScanKey(k => k + 1)
                return
            }

            setCurrentLot(lotData as LotInfo)
            setJustLinkedIds(new Set())
            setStep('scan_label')
            setLabelScanKey(k => k + 1)
            showToast(`Đã chọn pallet: ${lotData.code}`, 'success')
        } catch (err: any) {
            showToast('Lỗi tìm pallet: ' + err.message, 'error')
            setPalletScanKey(k => k + 1)
        } finally {
            setIsLoadingPallet(false)
        }
    }, [currentSystem?.code])

    // ── Tìm kiếm Lots theo STT và Ngày ──────────────────────────────────────────
    const handleSearchLots = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        if (!sttInput.trim() || !currentSystem?.code) return

        setIsSearchingLots(true)
        setSearchError('')
        setFoundLots([])

        try {
            const parsedSeq = encodeSTT(sttInput.trim())
            if (parsedSeq === null || isNaN(parsedSeq)) {
                setSearchError('Số Thứ Tự (STT) không hợp lệ!')
                return
            }

            let query = supabase
                .from('lots')
                .select(`
                    id, code, production_code, system_code, created_at, inbound_date, daily_seq,
                    products ( name, sku ),
                    suppliers ( name ),
                    box_labels (
                        id, code, quantity, unit, status, lot_id,
                        semi_finished_lot_code, finished_lot_code,
                        products ( name, sku, internal_name )
                    )
                `)
                .eq('system_code', currentSystem.code)
                .eq('daily_seq', parsedSeq)
                .neq('status', 'hidden')

            if (useDateFilter) {
                query = query.eq('inbound_date', inboundDate)
            }

            const { data, error } = await query
                .order('created_at', { ascending: false })
                .limit(50)

            if (error) throw error

            if (!data || data.length === 0) {
                const formattedDate = inboundDate.split('-').reverse().join('/')
                const errMsg = useDateFilter
                    ? `Không tìm thấy Pallet nào có STT "${sttInput.trim()}" ngày ${formattedDate}!`
                    : `Không tìm thấy Pallet nào có STT "${sttInput.trim()}"!`
                setSearchError(errMsg)
                return
            }

            setFoundLots(data)
            showToast(`Tìm thấy ${data.length} pallet phù hợp`, 'success')
        } catch (err: any) {
            setSearchError('Lỗi tìm kiếm: ' + err.message)
        } finally {
            setIsSearchingLots(false)
        }
    }

    // ── Chọn Lot từ danh sách tìm thấy ──────────────────────────────────────────
    const handleSelectLot = (lot: any) => {
        setCurrentLot(lot as LotInfo)
        setJustLinkedIds(new Set())
        setStep('scan_label')
        setLabelScanKey(k => k + 1)
        showToast(`Đã chọn pallet: ${lot.code}`, 'success')
    }

    // ── Quét Tem thùng → Liên kết vào Pallet ─────────────────────────────────
    const handleScanLabel = useCallback(async (rawCode: string) => {
        if (!currentLot || !currentSystem?.code) return
        setIsLinkingLabel(true)
        try {
            // 1. Tìm tem thùng theo mã
            const { data: labelData, error: findErr } = await supabase
                .from('box_labels')
                .select('id, code, lot_id, status, quantity, unit, semi_finished_lot_code, finished_lot_code, products(name, sku, internal_name)')
                .eq('system_code', currentSystem.code)
                .ilike('code', rawCode)
                .maybeSingle()

            if (findErr) throw findErr

            const label = labelData as any
            if (!label) {
                showToast(`Không tìm thấy tem: ${rawCode}`, 'error')
                setLabelScanKey(k => k + 1)
                return
            }

            // 2. Kiểm tra đã liên kết chưa
            if (label.lot_id === currentLot.id) {
                showToast(`Tem ${rawCode} đã gắn trên pallet này rồi!`, 'error')
                setLabelScanKey(k => k + 1)
                return
            }

            let isTransferred = false
            if (label.lot_id && label.lot_id !== currentLot.id) {
                isTransferred = true
            }

            // 3. Gán tem vào pallet hiện tại
            const { error: updateErr } = await (supabase
                .from('box_labels') as any)
                .update({ lot_id: currentLot.id, status: 'linked' })
                .eq('id', label.id)

            if (updateErr) throw updateErr

            // 4. Cập nhật state local
            const newLabel: BoxLabel = { ...label, lot_id: currentLot.id }
            setCurrentLot(prev => {
                if (!prev) return prev
                const exists = prev.box_labels.some(l => l.id === label.id)
                const updatedLabels = exists
                    ? prev.box_labels.map(l => l.id === label.id ? newLabel : l)
                    : [newLabel, ...prev.box_labels]
                return { ...prev, box_labels: updatedLabels }
            })
            setJustLinkedIds(prev => new Set(prev).add(label.id))
            // Xóa "vừa gán" sau 3 giây
            setTimeout(() => {
                setJustLinkedIds(prev => { const s = new Set(prev); s.delete(label.id); return s })
            }, 3000)

            const successMsg = isTransferred
                ? `✓ Đã chuyển: ${rawCode} → ${currentLot.code}`
                : `✓ Đã liên kết: ${rawCode} → ${currentLot.code}`
            showToast(successMsg, 'success')
            setLabelScanKey(k => k + 1)
        } catch (err: any) {
            showToast('Lỗi liên kết tem: ' + err.message, 'error')
            setLabelScanKey(k => k + 1)
        } finally {
            setIsLinkingLabel(false)
        }
    }, [currentLot, currentSystem?.code])

    // ── Gỡ liên kết ────────────────────────────────────────────────────────────
    const handleUnlink = async (label: BoxLabel) => {
        const ok = window.confirm(`Gỡ tem "${label.code}" khỏi pallet này?`)
        if (!ok) return
        setUnlinkingId(label.id)
        try {
            const { error } = await (supabase.from('box_labels') as any)
                .update({ lot_id: null, status: 'printed' })
                .eq('id', label.id)
            if (error) throw error
            setCurrentLot(prev => {
                if (!prev) return prev
                return { ...prev, box_labels: prev.box_labels.filter(l => l.id !== label.id) }
            })
            showToast(`Đã gỡ tem ${label.code}`, 'success')
        } catch (err: any) {
            showToast('Lỗi gỡ liên kết: ' + err.message, 'error')
        } finally {
            setUnlinkingId(null)
        }
    }

    const resetToScanPallet = () => {
        setStep('scan_pallet')
        setCurrentLot(null)
        setJustLinkedIds(new Set())
        setPalletScanKey(k => k + 1)
    }

    const totalWeight = currentLot?.box_labels.reduce((s, l) => s + (parseFloat(String(l.quantity)) || 0), 0) ?? 0
    const displayUnit = currentLot?.box_labels?.[0]?.unit || 'Kg'

    /* ══════════════════════════════════════════════════════════════════════════
       STEP 1: QUÉT HOẶC TÌM PALLET
    ══════════════════════════════════════════════════════════════════════════ */
    if (step === 'scan_pallet') {
        return (
            <div className="mobile-animate-fade-in" style={{ minHeight: '100%', background: '#f9fafb' }}>
                {/* Header */}
                <div className="mobile-header">
                    <div className="mobile-header-brand">Quản lý Kho</div>
                    <div className="mobile-header-title">Liên Kết Tem</div>
                    <div className="mobile-header-subtitle">{currentSystem?.name}</div>
                </div>

                <div style={{ padding: '16px 16px 100px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Hướng dẫn */}
                    <div style={{
                        background: 'linear-gradient(135deg, #0c4a6e, #0369a1)',
                        borderRadius: 20, padding: 18, color: '#fff'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ScanLine size={20} />
                            </div>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 900 }}>Bước 1: Chọn Pallet/LOT</div>
                                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 1 }}>Nhập STT hoặc quét mã QR Pallet</div>
                            </div>
                        </div>
                    </div>

                    {/* Form tìm kiếm theo STT và Ngày */}
                    <div style={{ background: '#fff', borderRadius: 20, padding: 16, border: '1.5px solid #e0f2fe' }}>
                        <div style={{ fontSize: 10, fontWeight: 900, color: '#0369a1', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
                            Tìm theo số thứ tự (STT)
                        </div>
                        <form onSubmit={handleSearchLots} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {/* Ngày nhập kho */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: 10, fontWeight: 850, color: '#71717a', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={useDateFilter}
                                        onChange={e => setUseDateFilter(e.target.checked)}
                                        style={{ width: 14, height: 14, accentColor: '#0284c7', margin: 0 }}
                                    />
                                    <span>LỌC THEO NGÀY NHẬP KHO</span>
                                </label>
                                <input
                                    type="date"
                                    value={inboundDate}
                                    onChange={e => setInboundDate(e.target.value)}
                                    disabled={!useDateFilter}
                                    className="mobile-input"
                                    style={{
                                        padding: '10px 12px',
                                        fontSize: 13,
                                        height: 42,
                                        opacity: useDateFilter ? 1 : 0.5,
                                        background: useDateFilter ? '#ffffff' : '#f4f4f5',
                                        border: useDateFilter ? '2px solid #0284c7' : '2px solid transparent',
                                    }}
                                />
                            </div>

                            {/* Số thứ tự Pallet */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <label style={{ fontSize: 10, fontWeight: 800, color: '#71717a', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Hash size={12} />
                                    SỐ THỨ TỰ PALLET (STT)
                                </label>
                                <input
                                    type="text"
                                    value={sttInput}
                                    onChange={e => setSttInput(e.target.value)}
                                    placeholder="Nhập số STT (ví dụ: 3, 15...)"
                                    className="mobile-input"
                                    style={{ padding: '10px 12px', fontSize: 13, height: 42, fontFamily: 'monospace', fontWeight: 800 }}
                                />
                            </div>

                            {/* Nút Tìm kiếm */}
                            <button
                                type="submit"
                                disabled={isSearchingLots || !sttInput.trim()}
                                className="mobile-btn mobile-btn--primary"
                                style={{ height: 42, fontSize: 13, width: '100%', marginTop: 4, background: '#0284c7', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.2)' }}
                            >
                                {isSearchingLots ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Đang tìm kiếm...
                                    </>
                                ) : (
                                    <>
                                        <Search size={16} />
                                        Tìm Pallet
                                    </>
                                )}
                            </button>
                        </form>

                        {searchError && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, marginTop: 12, color: '#ef4444', fontSize: 11, fontWeight: 700 }}>
                                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                                <span>{searchError}</span>
                            </div>
                        )}
                    </div>

                    {/* Danh sách kết quả tìm kiếm */}
                    {foundLots.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div className="mobile-section-label">
                                Kết quả tìm thấy ({foundLots.length} Pallet)
                            </div>
                            {foundLots.map(lot => {
                                const prodName = lot.products?.name || 'Chưa khai báo sản phẩm'
                                const supplierName = lot.suppliers?.name || 'Không có NCC'
                                const count = lot.box_labels?.length ?? 0
                                const formattedSTT = decodeSTT(lot.daily_seq)

                                return (
                                    <div
                                        key={lot.id}
                                        onClick={() => handleSelectLot(lot)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            padding: '12px 14px',
                                            background: '#fff',
                                            border: '1.5px solid #e4e4e7',
                                            borderRadius: 18,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                        }}
                                        className="mobile-card"
                                    >
                                        <div style={{
                                            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                                            background: '#f0fdf4', border: '1.5px solid #bbf7d0',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <span style={{ fontSize: 14, fontWeight: 900, color: '#16a34a' }}>
                                                #{formattedSTT}
                                            </span>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 900, color: '#18181b', textTransform: 'uppercase' }}>
                                                    {lot.code}
                                                </span>
                                                {count > 0 && (
                                                    <span style={{ padding: '2px 6px', background: '#ecfdf5', color: '#065f46', fontSize: 8, fontWeight: 950, borderRadius: 6, border: '1px solid #d1fae5' }}>
                                                        {count} tem
                                                    </span>
                                                )}
                                            </div>
                                            <p style={{ fontSize: 11, color: '#71717a', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                                                {prodName}
                                            </p>
                                            <p style={{ fontSize: 9, color: '#a1a1aa', marginTop: 1, fontWeight: 550 }}>
                                                NCC: {supplierName}
                                            </p>
                                        </div>
                                        <ChevronRight size={18} color="#a1a1aa" style={{ flexShrink: 0 }} />
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Hoặc quét mã QR trực tiếp */}
                    <div style={{ background: '#fff', borderRadius: 20, padding: 16, border: '1.5px solid #f4f4f5' }}>
                        <div style={{ fontSize: 10, fontWeight: 900, color: '#71717a', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
                            Hoặc quét mã QR Pallet trực tiếp
                        </div>
                        <ScanInput
                            placeholder="Quét mã DL-LOT-XXXXXX-XXX..."
                            onScan={handleScanPallet}
                            isLoading={isLoadingPallet}
                            color="#0891b2"
                            autoFocusKey={palletScanKey}
                        />
                    </div>
                </div>
            </div>
        )
    }

    /* ══════════════════════════════════════════════════════════════════════════
       STEP 2: QUÉT TEM (có pallet đang chọn)
    ══════════════════════════════════════════════════════════════════════════ */
    return (
        <div className="mobile-animate-slide-up" style={{ minHeight: '100%', background: '#f9fafb' }}>
            {/* Sticky header */}
            <div className="mobile-header" style={{ paddingBottom: 16 }}>
                {/* Top row: Back + info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                        onClick={resetToScanPallet}
                        style={{ width: 38, height: 38, borderRadius: 12, background: '#f4f4f5', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    >
                        <ArrowLeft size={18} color="#71717a" />
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: 2 }}>
                            Pallet đang gán
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 900, color: '#18181b', textTransform: 'uppercase', letterSpacing: -0.5, lineHeight: 1.2 }}>
                            {currentLot?.code}
                        </div>
                        {currentLot?.products && (
                            <div style={{ fontSize: 10, color: '#a1a1aa', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {currentLot.products.name}
                            </div>
                        )}
                    </div>
                    {/* Stats pills */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                        <div style={{ padding: '3px 10px', background: '#d1fae5', color: '#065f46', borderRadius: 999, fontSize: 11, fontWeight: 900 }}>
                            {currentLot?.box_labels.length ?? 0} tem
                        </div>
                        <div style={{ padding: '3px 10px', background: '#dbeafe', color: '#1e40af', borderRadius: 999, fontSize: 11, fontWeight: 900 }}>
                            {totalWeight.toFixed(1)} {displayUnit}
                        </div>
                    </div>
                </div>

                {/* Scan label input */}
                <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 900, color: '#059669', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>
                        ▶ Quét mã Tem thùng để liên kết
                    </div>
                    <ScanInput
                        placeholder="BOX-LXXXXXX-XXX..."
                        onScan={handleScanLabel}
                        isLoading={isLinkingLabel}
                        color="#059669"
                        autoFocusKey={labelScanKey}
                    />
                </div>

                {/* Quick tip */}
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f0fdf4', borderRadius: 12, border: '1px solid #bbf7d0' }}>
                    <Link2 size={13} color="#16a34a" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: '#15803d', fontWeight: 700 }}>
                        Mỗi lần quét = liên kết 1 tem vào pallet này
                    </span>
                </div>
            </div>

            {/* Label list */}
            <div style={{ padding: '12px 16px 100px' }}>
                {(currentLot?.box_labels.length ?? 0) === 0 ? (
                    /* Empty state */
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 20px', textAlign: 'center', gap: 12 }}>
                        <div style={{ width: 64, height: 64, borderRadius: 20, background: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Tag size={28} color="#d4d4d8" />
                        </div>
                        <div>
                            <p style={{ fontWeight: 800, fontSize: 14, color: '#18181b' }}>Chưa có tem nào</p>
                            <p style={{ fontSize: 11, color: '#a1a1aa', marginTop: 4, lineHeight: 1.6 }}>
                                Quét tem thùng phía trên để liên kết vào pallet <strong>{currentLot?.code}</strong>
                            </p>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div className="mobile-section-label">
                            {currentLot!.box_labels.length} tem đã liên kết
                        </div>
                        {currentLot!.box_labels.map(label => (
                            <LabelCard
                                key={label.id}
                                label={label}
                                isJustLinked={justLinkedIds.has(label.id)}
                                isUnlinking={unlinkingId === label.id}
                                onUnlink={() => handleUnlink(label)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
