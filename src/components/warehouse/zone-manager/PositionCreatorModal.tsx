import { useState } from 'react'
import { Package, X, Zap } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { LocalZone, LocalPosition } from './types'
import { useSystem } from '@/contexts/SystemContext'

interface PositionCreatorModalProps {
    zoneId: string
    zones: LocalZone[]
    onClose: () => void
    findLeafZones: (id: string) => LocalZone[]
    setPositionsMap: React.Dispatch<React.SetStateAction<Record<string, LocalPosition[]>>>
    generateId: () => string
    buildDefaultPrefix: (id: string) => string
}

export function PositionCreatorModal({ zoneId, zones, onClose, findLeafZones, setPositionsMap, generateId, buildDefaultPrefix }: PositionCreatorModalProps) {
    const { showToast } = useToast()
    const { systemType } = useSystem()

    const currentZone = zones.find(z => z.id === zoneId)
    const leafZones = findLeafZones(zoneId)
    const hasChildren = zones.some(z => z.parent_id === zoneId && z._status !== 'deleted')

    // Local State for Form
    const [posPrefix, setPosPrefix] = useState(buildDefaultPrefix(zoneId))
    const [posStart, setPosStart] = useState(1)
    const [posCount, setPosCount] = useState(10)
    const [isCreatingPositions, setIsCreatingPositions] = useState(false)
    const [autoMode, setAutoMode] = useState(false)
    const [autoPosSuffix, setAutoPosSuffix] = useState('V')
    const [autoPosPattern, setAutoPosPattern] = useState('')

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

    async function handleAutoCreatePositions() {
        if (posCount < 1) return showToast('Số lượng phải > 0', 'warning')

        setIsCreatingPositions(true)
        try {
            if (leafZones.length === 0) {
                showToast('Không tìm thấy zone cuối cùng nào!', 'warning')
                return
            }

            let totalCreated = 0
            // We need to work on a copy of the map, but we can't easily deep copy the state setter function.
            // We will build a delta map and merge it.

            // Wait, setPositionsMap accepts a callback.
            // But we need to read current state? 
            // The prop setPositionsMap is a setter. 

            // Logic:
            const updates: Record<string, LocalPosition[]> = {}

            for (const leafZone of leafZones) {
                // Build zone parts map
                const zoneParts: Record<string, string> = {}
                const zonePathParts: string[] = []
                let current: LocalZone | undefined = leafZone

                while (current) {
                    if (current.code) {
                        zonePathParts.unshift(current.code)
                        const prefix = current.code.replace(/\d+/g, '').toUpperCase()
                        zoneParts[prefix] = current.code
                    }
                    current = zones.find(z => z.id === current?.parent_id)
                }

                const zonePath = zonePathParts.join('.')

                const pattern = autoPosPattern || `{zone}.${autoPosSuffix}{#}`
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

            console.log(`Auto-created positions for ${leafZones.length} zones. Total updates:`, updates)

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

                <div className="p-4 space-y-3 overflow-y-auto flex-1">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                        Đang tạo vị trí cho: <span className="font-bold">{currentZone?.name}</span>
                        {hasChildren && (
                            <span className="ml-2 text-xs bg-blue-200 dark:bg-blue-800 px-2 py-0.5 rounded-full">
                                {leafZones.length} zone cuối cùng
                            </span>
                        )}
                    </div>

                    {hasChildren && (
                        <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-900 rounded-lg">
                            <button
                                onClick={() => setAutoMode(false)}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${!autoMode
                                    ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <Package size={16} />
                                Thủ công
                            </button>
                            <button
                                onClick={() => setAutoMode(true)}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${autoMode
                                    ? 'bg-gradient-to-r from-purple-500 to-indigo-500 shadow text-white'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <Zap size={16} />
                                Auto ({leafZones.length} zone)
                            </button>
                        </div>
                    )}

                    {!autoMode ? (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Mã bắt đầu (Tiền tố)</label>
                                    <input
                                        type="text"
                                        value={posPrefix}
                                        onChange={(e) => setPosPrefix(e.target.value.toUpperCase())}
                                        className="w-full px-3 py-2 border rounded-lg text-sm font-mono uppercase bg-gray-50 focus:bg-white transition-colors outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="VD: A"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Số bắt đầu</label>
                                    <input
                                        type="number"
                                        value={posStart}
                                        onChange={(e) => setPosStart(Math.max(0, parseInt(e.target.value) || 0))}
                                        className="w-full px-3 py-2 border rounded-lg text-sm text-center bg-gray-50 focus:bg-white transition-colors outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Số lượng cần tạo</label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        min="1"
                                        max="100"
                                        value={posCount}
                                        onChange={(e) => setPosCount(parseInt(e.target.value))}
                                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <input
                                        type="number"
                                        min="1"
                                        max="1000"
                                        value={posCount}
                                        onChange={(e) => setPosCount(Math.max(1, parseInt(e.target.value) || 0))}
                                        className="w-20 px-2 py-1 text-center font-bold text-lg text-blue-600 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none hover:border-blue-300 transition-colors"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleCreatePositions}
                                disabled={isCreatingPositions}
                                className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold rounded-xl shadow-lg transform transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                {isCreatingPositions ? 'Đang xử lý...' : <><Package size={20} /> Tạo & Gán Ngay</>}
                            </button>
                        </>
                    ) : (
                        <>
                            {/* Simplified Auto Mode UI for brevity, since original logic was copied */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Hậu tố vị trí</label>
                                    <input type="text" value={autoPosSuffix} onChange={(e) => setAutoPosSuffix(e.target.value.toUpperCase())} className="w-full px-2 py-1.5 border rounded text-xs font-mono uppercase" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Số bắt đầu</label>
                                    <input type="number" value={posStart} onChange={(e) => setPosStart(parseInt(e.target.value) || 0)} className="w-full px-2 py-1.5 border rounded text-xs text-center" />
                                </div>
                            </div>

                            <input
                                type="text"
                                value={autoPosPattern || `{zone}.${autoPosSuffix}{#}`}
                                onChange={(e) => setAutoPosPattern(e.target.value.toUpperCase())}
                                placeholder="{zone}.V{#}"
                                className="w-full font-mono text-xs px-2 py-1 rounded border mb-2"
                            />

                            <button
                                onClick={handleAutoCreatePositions}
                                disabled={isCreatingPositions}
                                className="w-full py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold text-sm rounded-lg shadow-md flex items-center justify-center gap-2"
                            >
                                {isCreatingPositions ? 'Đang xử lý...' : <><Zap size={16} /> Tạo {leafZones.length * posCount} Vị Trí</>}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
