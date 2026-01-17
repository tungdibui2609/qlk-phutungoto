'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { Link2, Search, Check, X, FolderOpen, Filter } from 'lucide-react'

type Position = Database['public']['Tables']['positions']['Row']
type Zone = Database['public']['Tables']['zones']['Row']
type ZonePosition = Database['public']['Tables']['zone_positions']['Row']

interface PositionWithZone extends Position {
    zoneName?: string | null
}

interface ZoneAssignmentProps {
    refreshKey?: number
}

export default function ZoneAssignment({ refreshKey }: ZoneAssignmentProps) {
    const [positions, setPositions] = useState<PositionWithZone[]>([])
    const [zones, setZones] = useState<Zone[]>([])
    const [loading, setLoading] = useState(true)

    // Filters
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedBatchName, setSelectedBatchName] = useState<string>('all')
    const [showUnassignedOnly, setShowUnassignedOnly] = useState(false)

    // Selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [targetZoneId, setTargetZoneId] = useState('')

    // Get unique batch names
    const batchNames = [...new Set(positions.map(p => p.batch_name).filter(Boolean))] as string[]

    useEffect(() => {
        fetchData()
    }, [refreshKey])

    async function fetchData() {
        setLoading(true)

        const [posRes, zoneRes, zpRes] = await Promise.all([
            supabase.from('positions').select('*').order('batch_name').order('display_order'),
            supabase.from('zones').select('*').order('name'),
            supabase.from('zone_positions').select('*, zones(name)')
        ])

        const posData = posRes.data || []
        const zoneData = zoneRes.data || []
        const zpData = (zpRes.data || []) as (ZonePosition & { zones: { name: string } | null })[]

        // Map positions with zone names
        const posWithZone: PositionWithZone[] = posData.map(pos => {
            const zp = zpData.find(z => z.position_id === (pos as any).id)
            return { ...(pos as any), zoneName: zp?.zones?.name || null }
        })

        setPositions(posWithZone)
        setZones(zoneData)
        setLoading(false)
    }

    // Filter positions
    const filteredPositions = positions.filter(p => {
        const matchesSearch = !searchTerm || p.code.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesBatch = selectedBatchName === 'all' || p.batch_name === selectedBatchName
        const matchesUnassigned = !showUnassignedOnly || !p.zoneName
        return matchesSearch && matchesBatch && matchesUnassigned
    })

    function toggleSelect(id: string) {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    function selectAll() {
        setSelectedIds(new Set(filteredPositions.map(p => p.id)))
    }

    function clearSelection() {
        setSelectedIds(new Set())
    }

    async function handleAssign() {
        if (selectedIds.size === 0 || !targetZoneId) {
            alert('Vui lòng chọn ô và zone!')
            return
        }

        // Delete existing assignments first
        const idsArray = Array.from(selectedIds)
        await supabase.from('zone_positions').delete().in('position_id', idsArray)

        // Insert new assignments
        const inserts = idsArray.map(id => ({ position_id: id, zone_id: targetZoneId }))
        const { error } = await supabase.from('zone_positions').insert(inserts)

        if (error) {
            alert('Lỗi: ' + error.message)
        } else {
            alert(`Đã gán ${selectedIds.size} ô vào zone thành công!`)
            setSelectedIds(new Set())
            fetchData()
        }
    }

    async function handleUnassign() {
        if (selectedIds.size === 0) return
        const idsArray = Array.from(selectedIds)
        await supabase.from('zone_positions').delete().in('position_id', idsArray)
        alert(`Đã bỏ gán ${selectedIds.size} ô!`)
        setSelectedIds(new Set())
        fetchData()
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Link2 className="text-purple-600" size={20} />
                Gán vị trí vào Zone
            </h3>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <Filter size={16} className="text-gray-400" />

                {/* Batch filter */}
                <div className="flex items-center gap-2">
                    <FolderOpen size={14} className="text-gray-400" />
                    <select
                        value={selectedBatchName}
                        onChange={(e) => setSelectedBatchName(e.target.value)}
                        className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800"
                    >
                        <option value="all">Tất cả nhóm</option>
                        {batchNames.map(name => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                </div>

                {/* Search */}
                <div className="relative flex-1 min-w-[150px]">
                    <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Tìm mã ô..."
                        className="w-full pl-8 pr-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800"
                    />
                </div>

                {/* Unassigned filter */}
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showUnassignedOnly}
                        onChange={(e) => setShowUnassignedOnly(e.target.checked)}
                        className="rounded"
                    />
                    Chỉ chưa gán
                </label>
            </div>

            {/* Action bar */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
                <button onClick={selectAll} className="text-sm text-blue-600 hover:underline">
                    Chọn tất cả ({filteredPositions.length})
                </button>
                <button onClick={clearSelection} className="text-sm text-gray-500 hover:underline">
                    Bỏ chọn
                </button>

                <span className="text-sm text-gray-400">|</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">Đã chọn: {selectedIds.size}</span>

                <div className="flex-1" />

                {/* Cascading Zone Selector */}
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 p-1.5 rounded-lg border border-gray-200 dark:border-gray-600">
                    <span className="text-sm font-medium text-gray-500 pl-2">Gán vào:</span>

                    {(() => {
                        // Helper to build path from targetZoneId
                        const path: Zone[] = []
                        let current = zones.find(z => z.id === targetZoneId)
                        while (current) {
                            path.unshift(current)
                            current = zones.find(z => z.id === current?.parent_id)
                        }

                        // We always want to show at least the Root dropdown
                        // And then one extra dropdown for the children of the current deepest selection

                        const levelsToShow = []

                        // Level 0
                        levelsToShow.push({
                            parentId: null,
                            selectedId: path[0]?.id || '',
                            options: zones.filter(z => z.parent_id === null).sort((a, b) => a.name.localeCompare(b.name))
                        })

                        // Subsequent levels
                        for (let i = 0; i < path.length; i++) {
                            const parentId = path[i].id
                            const children = zones.filter(z => z.parent_id === parentId).sort((a, b) => a.name.localeCompare(b.name))

                            if (children.length > 0) {
                                levelsToShow.push({
                                    parentId: parentId,
                                    selectedId: path[i + 1]?.id || '', // Next selected or empty
                                    options: children
                                })
                            }
                        }

                        return levelsToShow.map((level, idx) => (
                            <div key={level.parentId || 'root'} className="relative">
                                <select
                                    value={level.selectedId}
                                    onChange={(e) => {
                                        const val = e.target.value
                                        if (val) setTargetZoneId(val)
                                        else if (level.parentId) setTargetZoneId(level.parentId) // Revert to parent if cleared
                                        else setTargetZoneId('') // Clear all if root cleared
                                    }}
                                    className="w-32 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">{idx === 0 ? '-- Chọn Kho --' : '-- Chọn --'}</option>
                                    {level.options.map(opt => (
                                        <option key={opt.id} value={opt.id}>{opt.name}</option>
                                    ))}
                                </select>
                            </div>
                        ))
                    })()}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleAssign}
                        disabled={selectedIds.size === 0 || !targetZoneId}
                        className="flex items-center gap-1 px-4 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium shadow-sm transition-all transform active:scale-95"
                    >
                        <Check size={16} />
                        Gán ({selectedIds.size})
                    </button>

                    <button
                        onClick={handleUnassign}
                        disabled={selectedIds.size === 0}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 disabled:text-gray-400 disabled:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Position grid */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-[400px] overflow-y-auto">
                {loading ? (
                    <p className="p-8 text-center text-gray-400">Đang tải...</p>
                ) : filteredPositions.length === 0 ? (
                    <p className="p-8 text-center text-gray-400 italic">Không có ô nào</p>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 p-3">
                        {filteredPositions.map(pos => {
                            const isSelected = selectedIds.has(pos.id)
                            return (
                                <div
                                    key={pos.id}
                                    onClick={() => toggleSelect(pos.id)}
                                    className={`
                                        p-2 rounded-lg border-2 cursor-pointer transition-all text-center
                                        ${isSelected
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                                            : pos.zoneName
                                                ? 'border-green-300 bg-green-50 dark:bg-green-900/20'
                                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                                        }
                                    `}
                                >
                                    <p className="font-mono text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                                        {pos.code}
                                    </p>
                                    <p className="text-[10px] text-gray-400 truncate mt-0.5">
                                        {pos.zoneName || 'Chưa gán'}
                                    </p>
                                    {pos.batch_name && (
                                        <p className="text-[9px] text-blue-500 truncate mt-0.5">
                                            📁 {pos.batch_name}
                                        </p>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
