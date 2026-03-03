import { useState, useMemo, useEffect } from 'react'
import { Package, X, Zap, Copy, Check, Star } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { LocalZone, LocalPosition } from './types'
import { useSystem } from '@/contexts/SystemContext'

interface PositionCreatorModalProps {
    zoneId: string
    zones: LocalZone[]
    onClose: () => void
    findLeafZones: (id: string) => LocalZone[]
    setPositionsMap: React.Dispatch<React.SetStateAction<Record<string, LocalPosition[]>>>
    positionsMap: Record<string, LocalPosition[]>
    generateId: () => string
    buildDefaultPrefix: (id: string) => string
}

export function PositionCreatorModal({ zoneId, zones, onClose, findLeafZones, setPositionsMap, positionsMap, generateId, buildDefaultPrefix }: PositionCreatorModalProps) {
    const { showToast } = useToast()
    const { systemType } = useSystem()

    const currentZone = zones.find(z => z.id === zoneId)
    const leafZones = findLeafZones(zoneId)
    const hasChildren = zones.some(z => z.parent_id === zoneId && z._status !== 'deleted')

    // Modes: manual, auto, clone
    const [mode, setMode] = useState<'manual' | 'auto' | 'clone'>('manual')

    // Local State for Form
    const [posPrefix, setPosPrefix] = useState(buildDefaultPrefix(zoneId))
    const [posStart, setPosStart] = useState(1)
    const [posCount, setPosCount] = useState(10)
    const [isCreatingPositions, setIsCreatingPositions] = useState(false)
    const [autoPosSuffix, setAutoPosSuffix] = useState('V')
    const [autoPosPattern, setAutoPosPattern] = useState(`{zone}.${autoPosSuffix}{#}`)

    // Clone mode state
    const [sourceId, setSourceId] = useState('')
    const [searchSource, setSearchSource] = useState('')
    const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
        if (typeof window === 'undefined') return []
        const saved = localStorage.getItem('warehouse_clone_pins')
        return saved ? JSON.parse(saved) : []
    })

    const togglePin = (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        setPinnedIds(prev => {
            const next = prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
            localStorage.setItem('warehouse_clone_pins', JSON.stringify(next))
            return next
        })
    }

    const availableTags = useMemo(() => {
        // Use one of the leaf zones to get the full hierarchy depth (e.g. down to {T})
        const leafZones = findLeafZones(zoneId)
        const sampleZone = leafZones.length > 0 ? leafZones[0] : zones.find(z => z.id === zoneId)

        const tags: string[] = []
        let current = sampleZone
        while (current) {
            if (current.code) {
                const prefix = current.code.replace(/\d+/g, '').toUpperCase()
                if (prefix) {
                    const tag = `{${prefix}}`
                    // Avoid duplicates if multiple levels have same prefix (though rare in this project)
                    if (!tags.includes(tag)) tags.unshift(tag)
                }
            }
            current = zones.find(z => z.id === current?.parent_id)
        }
        return tags.join('')
    }, [zoneId, zones, findLeafZones])

    const [copied, setCopied] = useState(false)

    const handleCopyTags = () => {
        navigator.clipboard.writeText(availableTags)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        showToast('Đã sao chép mã Level!', 'success')
    }

    async function handleCreatePositions() {
        if (posCount < 1) return showToast('Số lượng phải > 0', 'warning')

        setIsCreatingPositions(true)
        try {
            const newPositions: LocalPosition[] = Array.from({ length: posCount }).map((_, i) => ({
                id: generateId(),
                code: `${posPrefix}${posStart + i}`.toUpperCase(),
                display_order: posStart + i,
                batch_name: `Batch ${new Date().toLocaleTimeString()} - ${currentZone?.name}`,
                created_at: new Date().toISOString(),
                status: 'active',
                lot_id: null,
                _status: 'new',
                system_type: systemType
            } as any))

            console.log(`Manually created ${newPositions.length} positions:`, newPositions.map(p => p.code))

            setPositionsMap(prev => {
                const currentList = prev[zoneId] || []
                return {
                    ...prev,
                    [zoneId]: [...currentList, ...newPositions].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
                }
            })

            onClose()
        } catch (err: any) {
            showToast('Lỗi: ' + err.message, 'error')
        } finally {
            setIsCreatingPositions(false)
        }
    }

    async function handleClonePositions() {
        if (!sourceId) return showToast('Vui lòng chọn zone nguồn', 'warning')
        const sourceZone = zones.find(z => z.id === sourceId)
        if (!sourceZone || !currentZone) return

        setIsCreatingPositions(true)
        await new Promise(resolve => setTimeout(resolve, 50))

        try {
            // 1. Helper to map all sub-zones by relative path (code chain)
            const getRelativeMap = (rootId: string) => {
                const map = new Map<string, string>() // relativePath -> zoneId
                const traverse = (parentId: string, currentPath: string) => {
                    const children = zones.filter(z => z.parent_id === parentId && z._status !== 'deleted')
                    children.forEach(child => {
                        const path = currentPath ? `${currentPath}.${child.code}` : child.code
                        map.set(path.toUpperCase(), child.id)
                        traverse(child.id, path)
                    })
                }
                map.set("", rootId) // Root itself is the empty path
                traverse(rootId, "")
                return map
            }

            const sourceMap = getRelativeMap(sourceId)
            const targetMap = getRelativeMap(zoneId)


            // Calculate Full Prefixes for Root Zones
            const getFullPrefix = (zId: string) => {
                const parts: string[] = []
                let curr: LocalZone | undefined = zones.find(z => z.id === zId)
                while (curr) {
                    if (curr.code) parts.unshift(curr.code)
                    const parentId = curr.parent_id
                    curr = zones.find(z => z.id === parentId)
                }
                return parts.join('.')
            }

            const sourceFullPrefix = getFullPrefix(sourceId)
            const targetFullPrefix = getFullPrefix(zoneId)

            const updates: Record<string, LocalPosition[]> = {}
            let totalCloned = 0

            // 2. Pair zones and clone positions
            sourceMap.forEach((_, path) => {
                // Note: we iterate sourceMap keys (paths) to find if target has same path
                // path is relative like "" or "D1" or "D1.T1"

                // Get actual IDs from maps
                const sId = sourceMap.get(path) // Should exist since we iterating sourceMap
                const tId = targetMap.get(path)

                if (!sId || !tId) return

                const sPositions = positionsMap[sId] || []
                if (sPositions.length === 0) return

                const cloned = sPositions.map(p => {
                    let newCode = p.code

                    // Robust Prefix Replacement
                    // Create regex for source prefix logic
                    // We escape dots to ensure accurate matching
                    const escapedSource = sourceFullPrefix.replace(/\./g, '\\.')
                    const regex = new RegExp(`^${escapedSource}`, 'i')

                    if (regex.test(newCode)) {
                        newCode = newCode.replace(regex, targetFullPrefix)
                    } else {
                        // If strict prefix match fails, try replacing just the segment
                        // e.g. if code was manually named but contains sourceZone.code
                        const sCodeEscaped = sourceZone.code.replace(/\./g, '\\.')
                        const subRegex = new RegExp(sCodeEscaped, 'i')
                        if (subRegex.test(newCode)) {
                            newCode = newCode.replace(subRegex, currentZone.code)
                        } else {
                            // Fallback: Code did not match anything, avoiding exact collision
                            newCode = `${targetFullPrefix}.${newCode}`
                        }
                    }

                    return {
                        ...p,
                        id: generateId(),
                        code: newCode.toUpperCase(),
                        display_order: p.display_order,
                        batch_name: `Cloned from ${sourceZone.name}`,
                        created_at: new Date().toISOString(),
                        status: 'active',
                        lot_id: null, // Clear lots on clone
                        _status: 'new',
                        system_type: systemType
                    } as any
                })

                updates[tId] = cloned
                totalCloned += cloned.length
            })

            if (totalCloned === 0) {
                showToast('Không tìm thấy vị trí nào để sao chép!', 'warning')
                setIsCreatingPositions(false)
                return
            }

            setPositionsMap(prev => {
                const next = { ...prev }
                Object.entries(updates).forEach(([zId, posList]) => {
                    const currentList = next[zId] || []
                    next[zId] = [...currentList, ...posList].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
                })
                return next
            })

            showToast(`Đã sao chép thành công ${totalCloned} vị trí!`, 'success')
            onClose()
        } catch (err: any) {
            showToast('Lỗi: ' + err.message, 'error')
        } finally {
            setIsCreatingPositions(false)
        }
    }

    // Filter zones for cloning (only those that have positions somewhere in their tree)
    async function handleAutoCreatePositions() {
        if (posCount < 1) return showToast('Số lượng phải > 0', 'warning')

        setIsCreatingPositions(true)
        // Give UI a chance to render loading state
        await new Promise(resolve => setTimeout(resolve, 50))

        try {
            if (leafZones.length === 0) {
                showToast('Không tìm thấy zone cuối cùng nào!', 'warning')
                setIsCreatingPositions(false)
                return
            }

            // Optimization: Map zones by ID for O(1) lookup
            const zoneMap = new Map<string, LocalZone>()
            zones.forEach(z => zoneMap.set(z.id, z))

            const updates: Record<string, LocalPosition[]> = {}
            const pattern = autoPosPattern || `{zone}.${autoPosSuffix}{#}`

            for (const leafZone of leafZones) {
                // Build zone parts map efficiently
                const zoneParts: Record<string, string> = {}
                const zonePathParts: string[] = []
                let current: LocalZone | undefined = leafZone

                while (current) {
                    if (current.code) {
                        zonePathParts.unshift(current.code)
                        const prefix = current.code.replace(/\d+/g, '').toUpperCase()
                        zoneParts[prefix] = current.code
                    }
                    current = current.parent_id ? zoneMap.get(current.parent_id) : undefined
                }

                const zonePath = zonePathParts.join('.')
                let codePattern = pattern.replace(/\{#\}/g, '___POS_NUM___')
                codePattern = codePattern.replace(/\{zone\}/gi, zonePath)

                const sortedPrefixes = Object.keys(zoneParts).sort((a, b) => b.length - a.length)
                for (const prefix of sortedPrefixes) {
                    const regex = new RegExp(`\\{${prefix}\\}`, 'gi')
                    codePattern = codePattern.replace(regex, zoneParts[prefix])
                }

                const newPositions: LocalPosition[] = Array.from({ length: posCount }).map((_, i) => ({
                    id: generateId(),
                    code: codePattern.replace(/___POS_NUM___/g, String(posStart + i)).toUpperCase(),
                    display_order: posStart + i,
                    batch_name: `Auto Batch ${new Date().toLocaleTimeString()} - ${leafZone?.name}`,
                    created_at: new Date().toISOString(),
                    status: 'active',
                    lot_id: null,
                    _status: 'new',
                    system_type: systemType
                } as any))

                updates[leafZone.id] = newPositions
            }

            setPositionsMap(prev => {
                const next = { ...prev }
                Object.entries(updates).forEach(([zId, newPos]) => {
                    const currentList = next[zId] || []
                    next[zId] = [...currentList, ...newPos].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
                })
                return next
            })

            showToast(`Đã tạo ${leafZones.length * posCount} vị trí cho ${leafZones.length} zone cuối cùng!`, 'success')
            onClose()
        } catch (err: any) {
            showToast('Lỗi: ' + err.message, 'error')
        } finally {
            setIsCreatingPositions(false)
        }
    }

    // Filter zones for cloning (only those that have positions somewhere in their tree)
    const cloneableZones = useMemo(() => {
        const zonesWithPos = new Map<string, boolean>()
        const checkTree = (id: string): boolean => {
            if (zonesWithPos.has(id)) return zonesWithPos.get(id)!
            const hasDirect = (positionsMap[id] || []).length > 0
            if (hasDirect) {
                zonesWithPos.set(id, true)
                return true
            }
            const children = zones.filter(child => child.parent_id === id && child._status !== 'deleted')
            const result = children.some(child => checkTree(child.id))
            zonesWithPos.set(id, result)
            return result
        }

        const filtered = zones.filter(z => {
            if (z.id === zoneId || z._status === 'deleted') return false
            return checkTree(z.id)
        }).filter(z =>
            z.name.toLowerCase().includes(searchSource.toLowerCase()) ||
            z.code.toLowerCase().includes(searchSource.toLowerCase())
        )

        // Sort: Pinned first, then by name
        return [...filtered].sort((a, b) => {
            const aPinned = pinnedIds.includes(a.id)
            const bPinned = pinnedIds.includes(b.id)
            if (aPinned && !bPinned) return -1
            if (!aPinned && bPinned) return 1
            return a.name.localeCompare(b.name)
        }).slice(0, 50).map(z => {
            const pathParts: string[] = []
            let curr: LocalZone | undefined = z
            while (curr) {
                const parent = zones.find(p => p.id === curr?.parent_id)
                if (parent) pathParts.unshift(parent.name)
                curr = parent
            }
            return { ...z, path: pathParts.length > 0 ? pathParts.join(' > ') : '' }
        })
    }, [zones, positionsMap, zoneId, searchSource, pinnedIds])

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
                <div className="p-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Package size={18} className="text-orange-500" />
                        Tạo vị trí hàng loạt
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-4 space-y-4 overflow-y-auto flex-1">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                        Mục tiêu: <span className="font-bold">{currentZone?.name}</span> ({currentZone?.code})
                    </div>

                    {/* Mode Tabs */}
                    <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-900 rounded-lg">
                        {[
                            { id: 'manual', label: 'Thủ công', icon: Package },
                            { id: 'auto', label: 'Tự động', icon: Zap },
                            { id: 'clone', label: 'Sao chép', icon: Copy }
                        ].map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setMode(t.id as any)}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-bold transition-all ${mode === t.id
                                    ? t.id === 'clone'
                                        ? 'bg-emerald-500 text-white shadow'
                                        : t.id === 'auto'
                                            ? 'bg-indigo-500 text-white shadow'
                                            : 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white'
                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                            >
                                <t.icon size={14} />
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {mode === 'manual' && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Tiền tố mã</label>
                                    <input
                                        type="text"
                                        value={posPrefix}
                                        onChange={(e) => setPosPrefix(e.target.value.toUpperCase())}
                                        className="w-full px-3 py-2 border rounded-lg text-sm font-mono uppercase bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Số bắt đầu</label>
                                    <input
                                        type="number"
                                        value={posStart}
                                        onChange={(e) => setPosStart(Math.max(0, parseInt(e.target.value) || 0))}
                                        className="w-full px-3 py-2 border rounded-lg text-sm text-center bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Số lượng</label>
                                <div className="flex items-center gap-4">
                                    <input type="range" min="1" max="100" value={posCount} onChange={(e) => setPosCount(parseInt(e.target.value))} className="flex-1" />
                                    <input type="number" value={posCount} onChange={(e) => setPosCount(Math.max(1, parseInt(e.target.value) || 0))} className="w-20 px-2 py-1 text-center font-bold border rounded-lg" />
                                </div>
                            </div>

                            <button onClick={handleCreatePositions} disabled={isCreatingPositions} className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-colors">
                                {isCreatingPositions ? 'Đang tạo...' : 'Tạo & Gán Ngay'}
                            </button>
                        </>
                    )}

                    {mode === 'auto' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Số bắt đầu</label>
                                    <input type="number" value={posStart} onChange={(e) => setPosStart(Math.max(0, parseInt(e.target.value) || 0))} className="w-full px-3 py-2 border rounded-lg text-sm text-center" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Số lượng mỗi zone</label>
                                    <input type="number" value={posCount} onChange={(e) => setPosCount(Math.max(1, parseInt(e.target.value) || 0))} className="w-full px-3 py-2 border rounded-lg text-sm text-center" />
                                </div>
                            </div>

                            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 space-y-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Mã Level gợi ý</label>
                                    <div className="flex items-center gap-1">
                                        <code className="flex-1 px-2 py-1.5 bg-white dark:bg-gray-800 border rounded text-xs font-mono text-purple-600 break-all">{availableTags}</code>
                                        <button onClick={handleCopyTags} className="p-1.5 bg-white border rounded hover:bg-gray-50 transition-colors">
                                            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Pattern (Mẫu mã)</label>
                                    <input value={autoPosPattern} onChange={(e) => setAutoPosPattern(e.target.value)} className="w-full font-mono text-sm px-2 py-1.5 rounded border uppercase outline-none focus:border-blue-500" />
                                    <p className="text-[10px] text-gray-400 mt-1">Dùng {'{zone}'}, {'{#}'} hoặc các thẻ Level phía trên.</p>
                                </div>
                            </div>

                            <button onClick={handleAutoCreatePositions} disabled={isCreatingPositions} className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-colors">
                                {isCreatingPositions ? 'Đang xử lý...' : `Tạo ${leafZones.length * posCount} Vị Trí`}
                            </button>
                        </div>
                    )}

                    {mode === 'clone' && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="block text-xs font-medium text-gray-500">Chọn Zone nguồn để sao chép cấu trúc</label>
                                <input
                                    type="text"
                                    placeholder="Tìm theo tên hoặc mã..."
                                    value={searchSource}
                                    onChange={(e) => setSearchSource(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white outline-none focus:border-emerald-500 transition-colors"
                                />

                                <div className="grid grid-cols-1 gap-2 max-h-[160px] overflow-y-auto">
                                    {cloneableZones.map(z => (
                                        <div
                                            key={z.id}
                                            onClick={() => setSourceId(z.id)}
                                            className={`group relative flex items-center justify-between p-2 rounded-lg border text-sm transition-all cursor-pointer ${sourceId === z.id
                                                ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                                                : 'border-gray-100 dark:border-gray-700 hover:border-emerald-200 hover:bg-emerald-50/50'}`}
                                        >
                                            <div className="flex flex-col items-start overflow-hidden pr-8 text-left">
                                                <div className="flex items-center gap-1.5 w-full">
                                                    <span className="font-bold text-gray-800 dark:text-gray-200 truncate">{z.name}</span>
                                                    {pinnedIds.includes(z.id) && <Star size={10} className="fill-yellow-400 text-yellow-400" />}
                                                </div>
                                                {(z as any).path && <span className="text-[10px] text-gray-400 truncate w-full">{(z as any).path}</span>}
                                                <span className="text-[10px] font-mono text-gray-400">{z.code}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => togglePin(e, z.id)}
                                                    className={`p-1.5 rounded-full transition-all ${pinnedIds.includes(z.id) ? 'bg-yellow-50 text-yellow-500' : 'text-gray-300 hover:text-yellow-500 hover:bg-yellow-50 opacity-0 group-hover:opacity-100'}`}
                                                    title={pinnedIds.includes(z.id) ? "Bỏ ghim" : "Ghim lên đầu"}
                                                >
                                                    <Star size={14} className={pinnedIds.includes(z.id) ? 'fill-yellow-400' : ''} />
                                                </button>
                                                {sourceId === z.id && <Check size={16} className="text-emerald-500" />}
                                            </div>
                                        </div>
                                    ))}
                                    {cloneableZones.length === 0 && (
                                        <div className="py-4 text-center text-xs text-gray-400 italic">Không tìm thấy zone nào có vị trí</div>
                                    )}
                                </div>
                            </div>

                            {sourceId && (
                                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
                                    <p className="text-xs text-emerald-800 dark:text-emerald-300">
                                        💡 Hệ thống sẽ copy toàn bộ vị trí từ <b>{zones.find(z => z.id === sourceId)?.name}</b> và đổi tiền tố mã
                                        từ <code className="bg-emerald-100 px-1 rounded">{zones.find(z => z.id === sourceId)?.code}</code> thành <code className="bg-emerald-100 px-1 rounded">{currentZone?.code}</code>.
                                    </p>
                                </div>
                            )}

                            <button
                                onClick={handleClonePositions}
                                disabled={isCreatingPositions || !sourceId}
                                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                            >
                                {isCreatingPositions ? 'Đang sao chép...' : <><Copy size={18} /> Sao chép Ngay</>}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
