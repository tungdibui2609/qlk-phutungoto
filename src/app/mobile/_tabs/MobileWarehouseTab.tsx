'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { Loader2, RotateCcw, BarChart3, Layers, ChevronDown, ChevronRight } from 'lucide-react'

interface ZoneData {
    id: string
    name: string
    parent_id: string | null
    totalPositions: number
    occupiedPositions: number
    children: ZoneData[]
}

export default function MobileWarehouseTab() {
    const { currentSystem } = useSystem()
    const { showToast } = useToast()
    const [loading, setLoading] = useState(true)
    const [zones, setZones] = useState<any[]>([])
    const [positions, setPositions] = useState<any[]>([])
    const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(null)
    const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set())

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [zonesRes, posRes] = await Promise.all([
                supabase.from('zones').select('*'),
                supabase.from('zone_positions').select('zone_id, positions!inner(id, lot_id)')
            ])
            if (zonesRes.data) setZones(zonesRes.data)
            if (posRes.data) setPositions(posRes.data)

            // Auto-select first warehouse
            if (zonesRes.data && !selectedWarehouse) {
                const topLevel = zonesRes.data.filter(z => !z.parent_id)
                if (topLevel.length > 0) setSelectedWarehouse(topLevel[0].id)
            }
        } catch (e: any) {
            showToast('Lỗi tải dữ liệu: ' + e.message, 'error')
        } finally { setLoading(false) }
    }, [selectedWarehouse])

    useEffect(() => { loadData() }, [])

    // Build zone tree
    const warehouses = useMemo(() => zones.filter(z => !z.parent_id), [zones])

    const buildTree = useCallback((parentId: string): ZoneData[] => {
        const children = zones.filter(z => z.parent_id === parentId)
        return children.map(z => {
            const childTree = buildTree(z.id)
            // Get positions for this zone
            const zonePositions = positions.filter(p => p.zone_id === z.id)
            const total = zonePositions.length
            const occupied = zonePositions.filter((p: any) => p.positions?.lot_id).length

            // Include children stats
            const childTotal = childTree.reduce((a, c) => a + c.totalPositions, 0)
            const childOccupied = childTree.reduce((a, c) => a + c.occupiedPositions, 0)

            return {
                id: z.id,
                name: z.name,
                parent_id: z.parent_id,
                totalPositions: total + childTotal,
                occupiedPositions: occupied + childOccupied,
                children: childTree
            }
        })
    }, [zones, positions])

    const currentTree = useMemo(() =>
        selectedWarehouse ? buildTree(selectedWarehouse) : [],
        [selectedWarehouse, buildTree]
    )

    // Global stats for selected warehouse
    const globalStats = useMemo(() => {
        if (!selectedWarehouse) return { total: 0, occupied: 0 }
        const total = currentTree.reduce((a, c) => a + c.totalPositions, 0)
        const occupied = currentTree.reduce((a, c) => a + c.occupiedPositions, 0)
        return { total, occupied }
    }, [currentTree, selectedWarehouse])

    const toggleExpand = (id: string) => {
        setExpandedZones(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    function renderZone(zone: ZoneData, depth: number = 0) {
        const pct = zone.totalPositions > 0 ? Math.round((zone.occupiedPositions / zone.totalPositions) * 100) : 0
        const isExpanded = expandedZones.has(zone.id)
        const hasChildren = zone.children.length > 0
        const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e'

        return (
            <div key={zone.id}>
                <button onClick={() => hasChildren && toggleExpand(zone.id)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: depth === 0 ? '#fff' : '#fafafa', border: '1px solid #f4f4f5', borderRadius: depth === 0 ? 18 : 14, marginBottom: 6, width: '100%', cursor: hasChildren ? 'pointer' : 'default', marginLeft: depth * 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                        {hasChildren ? (
                            isExpanded ? <ChevronDown size={16} color="#a1a1aa" /> : <ChevronRight size={16} color="#a1a1aa" />
                        ) : (
                            <Layers size={14} color="#d4d4d8" />
                        )}
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#18181b' }}>{zone.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 60 }}>
                            <div style={{ height: 5, background: '#f4f4f5', borderRadius: 999, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 999, transition: 'width 0.5s ease' }} />
                            </div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#71717a', minWidth: 55, textAlign: 'right' }}>
                            {zone.occupiedPositions}/{zone.totalPositions}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 800, color: barColor, minWidth: 32, textAlign: 'right' }}>{pct}%</span>
                    </div>
                </button>
                {isExpanded && hasChildren && (
                    <div style={{ marginLeft: 8 }}>
                        {zone.children.map(child => renderZone(child, depth + 1))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="mobile-animate-fade-in">
            <div className="mobile-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div className="mobile-header-brand">Sarita Workspace</div>
                        <div className="mobile-header-title">Trạng Thái Kho</div>
                        <div className="mobile-header-subtitle">{currentSystem?.name || ''}</div>
                    </div>
                    <button className="mobile-btn mobile-btn--primary" onClick={loadData} disabled={loading}>
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                        Tải lại
                    </button>
                </div>

                {/* Warehouse Selector */}
                {warehouses.length > 0 && (
                    <div className="mobile-pill-group" style={{ marginTop: 12 }}>
                        {warehouses.map(w => (
                            <button key={w.id} onClick={() => setSelectedWarehouse(w.id)}
                                className={`mobile-pill ${selectedWarehouse === w.id ? 'mobile-pill--active' : ''}`}>
                                {w.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ padding: 20 }}>
                {loading ? (
                    <div className="mobile-loading">
                        <Loader2 size={32} className="animate-spin" style={{ color: '#d97706' }} />
                        <span style={{ color: '#a1a1aa', fontSize: 13, fontWeight: 600 }}>Đang tải...</span>
                    </div>
                ) : (
                    <>
                        {/* Summary Card */}
                        <div style={{ background: 'linear-gradient(135deg, #18181b, #27272a)', borderRadius: 24, padding: 20, marginBottom: 20, color: '#fff' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <div>
                                    <div style={{ fontSize: 10, fontWeight: 800, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: 2 }}>Tổng quan</div>
                                    <div style={{ fontSize: 10, color: '#52525b', marginTop: 2 }}>
                                        {warehouses.find(w => w.id === selectedWarehouse)?.name || ''}
                                    </div>
                                </div>
                                <BarChart3 size={20} color="#a1a1aa" />
                            </div>
                            <div style={{ display: 'flex', gap: 16 }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 28, fontWeight: 900 }}>{globalStats.occupied}</div>
                                    <div style={{ fontSize: 10, color: '#71717a', fontWeight: 600 }}>Đang sử dụng</div>
                                </div>
                                <div style={{ width: 1, background: '#3f3f46' }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 28, fontWeight: 900 }}>{globalStats.total}</div>
                                    <div style={{ fontSize: 10, color: '#71717a', fontWeight: 600 }}>Tổng vị trí</div>
                                </div>
                                <div style={{ width: 1, background: '#3f3f46' }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 28, fontWeight: 900, color: globalStats.total > 0 ? (Math.round((globalStats.occupied / globalStats.total) * 100) >= 90 ? '#ef4444' : '#22c55e') : '#fff' }}>
                                        {globalStats.total > 0 ? Math.round((globalStats.occupied / globalStats.total) * 100) : 0}%
                                    </div>
                                    <div style={{ fontSize: 10, color: '#71717a', fontWeight: 600 }}>Tỉ lệ</div>
                                </div>
                            </div>
                            <div className="mobile-progress" style={{ marginTop: 14, background: '#3f3f46' }}>
                                <div className="mobile-progress-fill" style={{
                                    width: globalStats.total > 0 ? `${(globalStats.occupied / globalStats.total) * 100}%` : '0%',
                                    background: globalStats.total > 0 && Math.round((globalStats.occupied / globalStats.total) * 100) >= 90 ? '#ef4444' : 'linear-gradient(90deg, #22c55e, #4ade80)'
                                }} />
                            </div>
                        </div>

                        {/* Zone Tree */}
                        <div className="mobile-section-label">Chi tiết theo khu vực</div>
                        {currentTree.length === 0 ? (
                            <div className="mobile-empty" style={{ padding: 30 }}>
                                <p style={{ color: '#a1a1aa', fontSize: 13 }}>Không có dữ liệu</p>
                            </div>
                        ) : (
                            currentTree.map(zone => renderZone(zone))
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
