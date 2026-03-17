'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useSystem } from '@/contexts/SystemContext'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { QrCode, Loader2, Camera, Keyboard, RotateCcw, CheckCircle2, Package, MapPin, X, Upload, Settings2 } from 'lucide-react'
import { Scanner } from '@yudiel/react-qr-scanner'
import { Database } from '@/lib/database.types'

interface ScannedItem {
    id: string
    code: string
    position: string
    positionId: string | null
    synced: boolean
    timestamp: number
}

type Zone = Database['public']['Tables']['zones']['Row']

export default function MobileAssignTab() {
    const { profile } = useUser()
    const { currentSystem } = useSystem()
    const { showToast } = useToast()

    const [useCamera, setUseCamera] = useState(true)
    const [manualCode, setManualCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [paused, setPaused] = useState(false)
    const [items, setItems] = useState<ScannedItem[]>([])
    const [step, setStep] = useState<'scan' | 'confirm'>('scan')

    // Zone selection
    const [zones, setZones] = useState<Zone[]>([])
    const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(null)
    const [selectedZone, setSelectedZone] = useState<string | null>(null)
    const [showSettings, setShowSettings] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)

    // Pending lot + position
    const [pendingLot, setPendingLot] = useState<any>(null)
    const [pendingPosition, setPendingPosition] = useState<{ id: string; code: string } | null>(null)

    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => { loadZones() }, [])
    useEffect(() => {
        if (!useCamera && step === 'scan' && inputRef.current) inputRef.current.focus()
    }, [useCamera, step])

    async function loadZones() {
        const { data } = await supabase.from('zones').select('*')
        if (data) setZones(data)
    }

    // Get warehouse zones (top-level)
    const warehouses = useMemo(() => zones.filter(z => !z.parent_id), [zones])

    // Get child zones for selected warehouse
    const childZones = useMemo(() => {
        if (!selectedWarehouse) return []
        const getAllChildren = (parentId: string): Zone[] => {
            const children = zones.filter(z => z.parent_id === parentId)
            return children.reduce<Zone[]>((acc, child) => [...acc, child, ...getAllChildren(child.id)], [])
        }
        return getAllChildren(selectedWarehouse)
    }, [selectedWarehouse, zones])

    // Get leaf zones with positions
    const leafZones = useMemo(() => {
        return childZones.filter(z => !zones.some(other => other.parent_id === z.id))
    }, [childZones, zones])

    async function handleScanResult(rawCode: string, isManual = false) {
        if (loading || (!isManual && paused) || !rawCode) return
        let code = rawCode.trim()
        try { if (code.startsWith('http')) { const url = new URL(code); const parts = url.pathname.split('/'); code = parts[parts.length - 1] || code } } catch { }
        code = code.toUpperCase()
        setPaused(true); setManualCode('')
        await processLotScan(code)
    }

    async function processLotScan(code: string) {
        if (!profile?.company_id) return
        setLoading(true)
        try {
            const { data: lot, error } = await supabase.from('lots')
                .select('*, lot_items(id, quantity, unit, product_id, products(name, sku)), positions!positions_lot_id_fkey(id, code)')
                .or(`code.eq.${code},production_code.eq.${code}`)
                .maybeSingle()

            if (error || !lot) { showToast(`Không tìm thấy LOT "${code}"`, 'error'); setPaused(false); setLoading(false); return }

            // Find an available position
            if (!selectedZone) {
                showToast('Vui lòng chọn vị trí làm việc trước', 'warning')
                setShowSettings(true); setPaused(false); setLoading(false); return
            }

            // Get all descendant zone IDs of selectedZone
            const targetZoneIds = new Set<string>([selectedZone])
            let added = true
            while (added) { added = false; for (const z of zones) { if (z.parent_id && targetZoneIds.has(z.parent_id) && !targetZoneIds.has(z.id)) { targetZoneIds.add(z.id); added = true } } }

            const occupiedByItems = new Set(items.filter(i => i.positionId).map(i => i.positionId))

            const { data: availablePositions } = await (supabase.from('zone_positions')
                .select('position_id, positions!inner(id, code, lot_id)')
                .is('positions.lot_id', null)
                .in('zone_id', Array.from(targetZoneIds))
                .order('position_id')
                .limit(20) as any)

            const filtered = (availablePositions || []).filter((p: any) => !occupiedByItems.has(p.position_id))

            if (!filtered.length) {
                showToast('Không còn vị trí trống trong khu vực này!', 'error')
                setPaused(false); setLoading(false); return
            }

            const targetPos = filtered[0]
            setPendingLot(lot)
            setPendingPosition({ id: targetPos.position_id, code: targetPos.positions.code })

            // Auto-assign
            await doAssign(lot, targetPos.position_id, targetPos.positions.code, code)

        } catch (e: any) { showToast('Lỗi: ' + e.message, 'error'); setPaused(false) }
        finally { setLoading(false) }
    }

    async function doAssign(lot: any, positionId: string, positionCode: string, lotCode: string) {
        try {
            // Clear old position
            if (lot.positions?.length > 0) {
                const oldPosId = lot.positions[0].id
                await supabase.from('positions').update({ lot_id: null } as any).eq('id', oldPosId)
            }

            // Assign to new position
            const { error } = await supabase.from('positions').update({ lot_id: lot.id } as any).eq('id', positionId)
            if (error) throw error

            const newItem: ScannedItem = {
                id: lot.id, code: lotCode, position: positionCode,
                positionId: positionId, synced: true, timestamp: Date.now()
            }
            setItems(prev => [newItem, ...prev.filter(i => i.id !== lot.id)])
            showToast(`✓ Đã gán ${lotCode} → ${positionCode}`, 'success')
        } catch (e: any) {
            showToast('Lỗi gán vị trí: ' + e.message, 'error')
        }
        setPaused(false)
    }

    const pendingCount = items.filter(i => !i.synced).length
    const syncedCount = items.filter(i => i.synced).length

    return (
        <div className="mobile-animate-fade-in">
            <div className="mobile-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div className="mobile-header-brand">Sarita Workspace</div>
                        <div className="mobile-header-title">Gán Vị Trí</div>
                        <div className="mobile-header-subtitle">{currentSystem?.name || ''}</div>
                        {items.length > 0 && (
                            <div style={{ fontSize: 10, color: '#a1a1aa', fontWeight: 600, marginTop: 2 }}>
                                {syncedCount} đã gán • {items.length} tổng
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="mobile-btn mobile-btn--ghost" onClick={() => setShowSettings(true)}>
                            <Settings2 size={16} />
                        </button>
                        <button className="mobile-btn mobile-btn--ghost" onClick={() => setUseCamera(!useCamera)}>
                            {useCamera ? <Keyboard size={16} /> : <Camera size={16} />}
                        </button>
                        <button className="mobile-btn mobile-btn--ghost" onClick={() => { setPaused(false); setManualCode('') }}>
                            <RotateCcw size={16} />
                        </button>
                    </div>
                </div>

                {/* Location Badge */}
                {selectedZone && (
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MapPin size={12} color="#059669" />
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#059669' }}>
                            {(() => {
                                const zone = zones.find(z => z.id === selectedZone)
                                const warehouse = zones.find(z => z.id === selectedWarehouse)
                                return `${warehouse?.name || ''} › ${zone?.name || ''}`
                            })()}
                        </span>
                    </div>
                )}
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* Camera */}
                {useCamera && (
                    <div className="mobile-scanner" style={{ marginBottom: 20 }}>
                        <Scanner
                            onScan={(result) => { if (result?.length > 0) handleScanResult(result[0].rawValue) }}
                            styles={{ container: { width: '100%', height: '100%' }, video: { objectFit: 'cover' as any } }}
                            components={{ finder: false }}
                            constraints={{ facingMode: 'environment' }}
                        />
                        <div className="mobile-scanner-corner mobile-scanner-corner--tl" style={{ borderColor: '#059669' }} />
                        <div className="mobile-scanner-corner mobile-scanner-corner--tr" style={{ borderColor: '#059669' }} />
                        <div className="mobile-scanner-corner mobile-scanner-corner--bl" style={{ borderColor: '#059669' }} />
                        <div className="mobile-scanner-corner mobile-scanner-corner--br" style={{ borderColor: '#059669' }} />
                        {loading && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 16 }}>
                                <Loader2 size={36} className="animate-spin" style={{ color: '#059669' }} />
                            </div>
                        )}
                    </div>
                )}

                {/* Instruction / Manual Input */}
                {!useCamera && (
                    <div style={{ width: '100%', maxWidth: 380, marginBottom: 20 }} className="mobile-animate-slide-up">
                        <div className="mobile-card" style={{ padding: 24, textAlign: 'center' }}>
                            <div style={{ width: 56, height: 56, borderRadius: 18, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', color: '#059669' }}>
                                <QrCode size={28} />
                            </div>
                            <div style={{ fontSize: 18, fontWeight: 900, color: '#18181b', marginBottom: 14 }}>Nhập mã LOT</div>
                            <form onSubmit={e => { e.preventDefault(); handleScanResult(manualCode, true) }}>
                                <input ref={inputRef} type="text" value={manualCode} onChange={e => setManualCode(e.target.value)}
                                    className="mobile-input" style={{ textAlign: 'center', fontSize: 20, fontWeight: 900, textTransform: 'uppercase', marginBottom: 12 }}
                                    placeholder="VÍ DỤ: LOT23..." />
                                <button type="submit" disabled={loading || !manualCode} className="mobile-btn mobile-btn--success mobile-btn--lg">
                                    {loading ? <Loader2 size={22} className="animate-spin" /> : 'Xác nhận'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {useCamera && !loading && (
                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#18181b' }}>Quét mã sản phẩm</p>
                        <p style={{ fontSize: 12, color: '#a1a1aa', marginTop: 4 }}>LOT sẽ được tự động gán vào vị trí trống</p>
                    </div>
                )}

                {/* Items History */}
                {items.length > 0 && (
                    <div style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '0 4px' }}>
                            <div className="mobile-section-label" style={{ marginBottom: 0 }}>Đã gán ({items.length})</div>
                            {items.length > 0 && (
                                <button className="mobile-btn mobile-btn--ghost" style={{ fontSize: 10, padding: '4px 10px' }}
                                    onClick={() => setItems([])}>
                                    <X size={12} /> Xóa tất cả
                                </button>
                            )}
                        </div>
                        {items.map(item => (
                            <div key={item.timestamp} className="mobile-lot-item mobile-lot-item--scanned">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 10, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                                        <CheckCircle2 size={18} />
                                    </div>
                                    <div>
                                        <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 900, color: '#059669' }}>{item.code}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                            <MapPin size={10} color="#a1a1aa" />
                                            <span style={{ fontSize: 11, color: '#71717a', fontWeight: 600 }}>{item.position}</span>
                                        </div>
                                    </div>
                                </div>
                                <span style={{ fontSize: 10, color: '#a1a1aa' }}>{new Date(item.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        ))}
                    </div>
                )}

                {items.length === 0 && useCamera && (
                    <div className="mobile-empty" style={{ padding: '30px 20px' }}>
                        <div className="mobile-empty-icon" style={{ width: 64, height: 64, marginBottom: 14 }}>
                            <Package size={28} />
                        </div>
                        <p style={{ color: '#71717a', fontWeight: 700, fontSize: 14 }}>Chưa gán mã nào</p>
                        <p style={{ color: '#a1a1aa', fontSize: 12, marginTop: 4 }}>Quét mã QR để bắt đầu gán vị trí</p>
                    </div>
                )}
            </div>

            {/* Settings Modal */}
            {showSettings && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
                    onClick={() => setShowSettings(false)}>
                    <div className="mobile-card-premium mobile-animate-slide-up" style={{ padding: 28, maxWidth: 360, width: '100%' }}
                        onClick={e => e.stopPropagation()}>
                        <div style={{ textAlign: 'center', marginBottom: 20 }}>
                            <div style={{ width: 52, height: 52, borderRadius: 18, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', color: '#059669' }}>
                                <MapPin size={26} />
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 900, color: '#18181b' }}>Vị trí làm việc</div>
                        </div>

                        {/* Warehouse */}
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 10, fontWeight: 800, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: 2, display: 'block', marginBottom: 6 }}>Kho</label>
                            <div className="mobile-pill-group">
                                {warehouses.map(w => (
                                    <button key={w.id} onClick={() => { setSelectedWarehouse(w.id); setSelectedZone(null) }}
                                        className={`mobile-pill ${selectedWarehouse === w.id ? 'mobile-pill--active' : ''}`}>
                                        {w.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Zone */}
                        {selectedWarehouse && leafZones.length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ fontSize: 10, fontWeight: 800, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: 2, display: 'block', marginBottom: 6 }}>Khu vực</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {leafZones.map(z => {
                                        // Build zone path
                                        const path: string[] = []
                                        let cur: Zone | undefined = z
                                        while (cur && cur.id !== selectedWarehouse) { path.unshift(cur.name); cur = zones.find(p => p.id === cur!.parent_id) }
                                        return (
                                            <button key={z.id} onClick={() => setSelectedZone(z.id)}
                                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 14, border: selectedZone === z.id ? '2px solid #059669' : '1px solid #e4e4e7', background: selectedZone === z.id ? '#ecfdf5' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: selectedZone === z.id ? '#059669' : '#52525b' }}>{path.join(' › ')}</span>
                                                {selectedZone === z.id && <CheckCircle2 size={16} color="#059669" />}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        <button onClick={() => setShowSettings(false)} className="mobile-btn mobile-btn--lg" style={{ background: '#18181b', color: '#fff', marginTop: 8 }}>
                            Đóng
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
