'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { ChevronRight, ChevronDown, Layers, Filter } from 'lucide-react'

type Zone = Database['public']['Tables']['zones']['Row']

interface ZoneFilterProps {
    selectedZoneId: string | null
    onZoneSelect: (zoneId: string | null) => void
}

export default function ZoneFilter({ selectedZoneId, onZoneSelect }: ZoneFilterProps) {
    const [zones, setZones] = useState<Zone[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

    useEffect(() => {
        fetchZones()
    }, [])

    async function fetchZones() {
        setLoading(true)
        const { data, error } = await supabase
            .from('zones')
            .select('*')
            .order('level')
            .order('name')

        if (error) {
            console.error('Error:', error)
        } else {
            setZones(data || [])
            // Expand all by default
            setExpandedNodes(new Set((data || []).map(z => z.id)))
        }
        setLoading(false)
    }

    function toggleExpand(id: string, e: React.MouseEvent) {
        e.stopPropagation()
        setExpandedNodes(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    function buildTree(parentId: string | null): Zone[] {
        return zones.filter(z => z.parent_id === parentId)
    }

    function renderZoneNode(zone: Zone, depth: number = 0) {
        const children = buildTree(zone.id)
        const hasChildren = children.length > 0
        const isExpanded = expandedNodes.has(zone.id)
        const isSelected = selectedZoneId === zone.id

        return (
            <div key={zone.id}>
                <div
                    onClick={() => onZoneSelect(zone.id)}
                    className={`
                        flex items-center gap-2 py-2 px-3 cursor-pointer rounded-lg transition-all
                        ${isSelected
                            ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300'
                        }
                    `}
                    style={{ paddingLeft: `${depth * 16 + 12}px` }}
                >
                    {/* Expand button */}
                    <button
                        onClick={(e) => toggleExpand(zone.id, e)}
                        className={`w-5 h-5 flex items-center justify-center ${!hasChildren && 'invisible'}`}
                    >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>

                    <Layers size={14} className={isSelected ? 'text-orange-500' : 'text-gray-400'} />

                    <span className="text-sm font-medium truncate">{zone.name}</span>
                    <span className="text-xs text-gray-400 ml-1">({zone.code})</span>
                </div>

                {hasChildren && isExpanded && (
                    <div>
                        {children.map(child => renderZoneNode(child, depth + 1))}
                    </div>
                )}
            </div>
        )
    }

    const rootZones = buildTree(null)

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                <Filter size={16} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Lọc theo Zone</span>
            </div>

            {/* All button */}
            <div
                onClick={() => onZoneSelect(null)}
                className={`
                    px-4 py-2 cursor-pointer transition-all border-b border-gray-100 dark:border-gray-700
                    ${selectedZoneId === null
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/30 text-gray-600 dark:text-gray-400'
                    }
                `}
            >
                <span className="text-sm font-medium">📦 Tất cả vị trí</span>
            </div>

            {/* Zone tree */}
            <div className="max-h-[400px] overflow-y-auto p-2">
                {loading ? (
                    <p className="text-sm text-gray-400 text-center py-4">Đang tải...</p>
                ) : rootZones.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4 italic">Chưa có zone nào</p>
                ) : (
                    rootZones.map(zone => renderZoneNode(zone))
                )}
            </div>
        </div>
    )
}
