'use client'
import { useState, useEffect } from 'react'
import { Grid3X3, Save, X, Columns, LayoutGrid, ChevronDown, Move, Box, Copy, ClipboardPaste, Users } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { Database } from '@/lib/database.types'

type ZoneLayout = Database['public']['Tables']['zone_layouts']['Row']
type Zone = Database['public']['Tables']['zones']['Row']

interface LayoutSettings {
    position_columns: number
    cell_width: number
    cell_height: number
    child_layout: string
    child_columns: number
    child_width: number
    collapsible: boolean
    display_type: string
}

// Global clipboard for layout settings
let layoutClipboard: LayoutSettings | null = null

interface LayoutConfigPanelProps {
    zone: Zone
    layout: ZoneLayout | null
    siblingZones?: Zone[] // Zones with same parent (for batch apply)
    onSave: (layout: ZoneLayout) => void
    onBatchSave?: (layouts: ZoneLayout[]) => void
    onClose: () => void
    tableName?: string
}

const CHILD_LAYOUT_OPTIONS = [
    { value: 'vertical', label: 'Dọc', icon: '⬇️' },
    { value: 'horizontal', label: 'Ngang', icon: '➡️' },
    { value: 'grid', label: 'Lưới', icon: '⊞' },
]

const DISPLAY_TYPE_OPTIONS = [
    { value: 'auto', label: 'Tự động', desc: 'Theo level' },
    { value: 'header', label: 'Header', desc: 'Tiêu đề + con' },
    { value: 'section', label: 'Section', desc: 'Khung breadcrumb' },
    { value: 'grid', label: 'Grid', desc: 'Ô vị trí' },
    { value: 'hidden', label: 'Ẩn', desc: 'Không hiển thị' },
]

export default function LayoutConfigPanel({ zone, layout, siblingZones, onSave, onBatchSave, onClose, tableName = 'zone_layouts' }: LayoutConfigPanelProps) {
    const { showToast } = useToast()
    const [positionColumns, setPositionColumns] = useState(layout?.position_columns ?? 8)
    const [cellWidth, setCellWidth] = useState(layout?.cell_width ?? 0)
    const [cellHeight, setCellHeight] = useState(layout?.cell_height ?? 0)
    const [childLayout, setChildLayout] = useState(layout?.child_layout ?? 'vertical')
    const [childColumns, setChildColumns] = useState(layout?.child_columns ?? 0)
    const [childWidth, setChildWidth] = useState(layout?.child_width ?? 0)
    const [collapsible, setCollapsible] = useState(layout?.collapsible ?? true)
    const [displayType, setDisplayType] = useState(layout?.display_type ?? 'auto')
    const [isSaving, setIsSaving] = useState(false)
    const [hasClipboard, setHasClipboard] = useState(!!layoutClipboard)

    // Count siblings (excluding current zone)
    const siblingCount = (siblingZones || []).filter(z => z.id !== zone.id).length

    useEffect(() => {
        const interval = setInterval(() => {
            setHasClipboard(!!layoutClipboard)
        }, 500)
        return () => clearInterval(interval)
    }, [])

    function getCurrentSettings(): LayoutSettings {
        return {
            position_columns: positionColumns,
            cell_width: cellWidth,
            cell_height: cellHeight,
            child_layout: childLayout,
            child_columns: childColumns,
            child_width: childWidth,
            collapsible,
            display_type: displayType
        }
    }

    function handleCopy() {
        layoutClipboard = getCurrentSettings()
        setHasClipboard(true)
        showToast('Đã copy cấu hình!', 'success')
    }

    function handlePaste() {
        if (!layoutClipboard) return
        setPositionColumns(layoutClipboard.position_columns)
        setCellWidth(layoutClipboard.cell_width)
        setCellHeight(layoutClipboard.cell_height)
        setChildLayout(layoutClipboard.child_layout)
        setChildColumns(layoutClipboard.child_columns)
        setChildWidth(layoutClipboard.child_width)
        setCollapsible(layoutClipboard.collapsible)
        setDisplayType(layoutClipboard.display_type || 'auto')
        showToast('Đã paste! Nhấn Lưu để áp dụng.', 'info')
    }

    async function handleSave() {
        setIsSaving(true)
        try {
            const payload = {
                ...getCurrentSettings(),
                updated_at: new Date().toISOString()
            }

            if (layout) {
                const { data, error } = await (supabase as any)
                    .from(tableName)
                    .update(payload)
                    .eq('id', layout.id)
                    .select()
                    .single()

                if (error) throw error
                showToast('Đã lưu!', 'success')
                onSave(data)
            } else {
                const { data, error } = await (supabase as any)
                    .from(tableName)
                    .insert({ zone_id: zone.id, ...payload })
                    .select()
                    .single()

                if (error) throw error
                showToast('Đã tạo cấu hình!', 'success')
                onSave(data)
            }
        } catch (err: any) {
            showToast('Lỗi: ' + err.message, 'error')
        } finally {
            setIsSaving(false)
        }
    }

    async function handleApplyToSiblings() {
        if (!siblingZones || siblingZones.length === 0) return

        setIsSaving(true)
        try {
            const settings = getCurrentSettings()
            const siblings = siblingZones.filter(z => z.id !== zone.id)
            const savedLayouts: ZoneLayout[] = []

            for (const sibling of siblings) {
                // Check if layout exists for this zone
                const { data: existing } = await (supabase as any)
                    .from(tableName)
                    .select('id')
                    .eq('zone_id', sibling.id)
                    .single()

                if (existing) {
                    // Update existing
                    const { data, error } = await (supabase as any)
                        .from(tableName)
                        .update({ ...settings, updated_at: new Date().toISOString() })
                        .eq('id', (existing as any).id)
                        .select()
                        .single()
                    if (!error && data) savedLayouts.push(data)
                } else {
                    // Insert new
                    const { data, error } = await (supabase as any)
                        .from(tableName)
                        .insert({ zone_id: sibling.id, ...settings })
                        .select()
                        .single()
                    if (!error && data) savedLayouts.push(data)
                }
            }

            showToast(`Đã áp dụng cho ${savedLayouts.length} zone!`, 'success')
            onBatchSave?.(savedLayouts)
        } catch (err: any) {
            showToast('Lỗi: ' + err.message, 'error')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg p-4 space-y-3 w-80 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Grid3X3 size={18} className="text-blue-500" />
                    {zone.name}
                </h3>
                <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                    <X size={18} className="text-gray-400" />
                </button>
            </div>

            {/* Copy/Paste buttons */}
            <div className="flex gap-2">
                <button
                    onClick={handleCopy}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium transition-colors"
                >
                    <Copy size={14} />
                    Copy
                </button>
                <button
                    onClick={handlePaste}
                    disabled={!hasClipboard}
                    className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${hasClipboard
                        ? 'bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-300'
                        : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                        }`}
                >
                    <ClipboardPaste size={14} />
                    Paste
                </button>
            </div>

            {/* Section: Kiểu hiển thị */}
            <div className="border-t pt-3">
                <div className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                    🎯 KIỂU HIỂN THỊ
                </div>
                <div className="grid grid-cols-2 gap-1">
                    {DISPLAY_TYPE_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setDisplayType(opt.value)}
                            className={`px-2 py-2 text-xs rounded-lg border transition-colors text-left ${displayType === opt.value
                                ? 'bg-blue-500 text-white border-blue-500'
                                : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                                }`}
                        >
                            <div className="font-medium">{opt.label}</div>
                            <div className={`text-[10px] ${displayType === opt.value ? 'text-blue-100' : 'text-gray-400'}`}>
                                {opt.desc}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Section: Vị trí */}
            <div className="border-t pt-3">
                <div className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                    <Box size={12} /> VỊ TRÍ
                </div>

                <div className="mb-2">
                    <label className="block text-xs text-gray-500 mb-1">Số cột</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="range" min="1" max="20" value={positionColumns}
                            onChange={(e) => setPositionColumns(parseInt(e.target.value))}
                            className="flex-1 h-2 bg-gray-200 rounded-lg cursor-pointer"
                        />
                        <input
                            type="number" min="1" max="20" value={positionColumns}
                            onChange={(e) => setPositionColumns(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                            className="w-14 px-2 py-1 text-center border rounded-lg text-sm"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Rộng (px)</label>
                        <input
                            type="number" min="0" max="300" value={cellWidth}
                            onChange={(e) => setCellWidth(Math.max(0, Math.min(300, parseInt(e.target.value) || 0)))}
                            className="w-full px-2 py-1.5 text-center border rounded-lg text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Cao (px)</label>
                        <input
                            type="number" min="0" max="200" value={cellHeight}
                            onChange={(e) => setCellHeight(Math.max(0, Math.min(200, parseInt(e.target.value) || 0)))}
                            className="w-full px-2 py-1.5 text-center border rounded-lg text-sm"
                        />
                    </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">0 = tự động</p>
            </div>

            {/* Section: Zone con */}
            <div className="border-t pt-3">
                <div className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                    <LayoutGrid size={12} /> ZONE CON
                </div>

                <div className="mb-2">
                    <label className="block text-xs text-gray-500 mb-1">Bố trí</label>
                    <div className="grid grid-cols-3 gap-1">
                        {CHILD_LAYOUT_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setChildLayout(opt.value)}
                                className={`px-2 py-1.5 text-xs rounded-lg border transition-colors ${childLayout === opt.value
                                    ? 'bg-blue-500 text-white border-blue-500'
                                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                                    }`}
                            >
                                {opt.icon} {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {childLayout === 'horizontal' && (
                    <div className="mb-2">
                        <label className="block text-xs text-gray-500 mb-1">Rộng zone con (px)</label>
                        <input
                            type="number" min="0" max="500" value={childWidth}
                            onChange={(e) => setChildWidth(Math.max(0, Math.min(500, parseInt(e.target.value) || 0)))}
                            className="w-full px-3 py-2 border rounded-lg text-sm"
                        />
                    </div>
                )}

                {childLayout === 'grid' && (
                    <div className="mb-2">
                        <label className="block text-xs text-gray-500 mb-1">Số cột zone con</label>
                        <input
                            type="number" min="0" max="10" value={childColumns}
                            onChange={(e) => setChildColumns(Math.max(0, Math.min(10, parseInt(e.target.value) || 0)))}
                            className="w-full px-3 py-2 border rounded-lg text-sm"
                        />
                    </div>
                )}
            </div>

            {/* Collapsible */}
            <label className="flex items-center gap-2 cursor-pointer border-t pt-3">
                <input
                    type="checkbox" checked={collapsible}
                    onChange={(e) => setCollapsible(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Thu gọn được</span>
            </label>

            {/* Action buttons */}
            <div className="space-y-2 border-t pt-3">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                >
                    {isSaving ? 'Đang lưu...' : <><Save size={16} /> Lưu</>}
                </button>

                {/* Apply to siblings button */}
                {siblingCount > 0 && (
                    <button
                        onClick={handleApplyToSiblings}
                        disabled={isSaving}
                        className="w-full py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                        <Users size={14} />
                        Áp dụng cho {siblingCount} zone cùng cấp
                    </button>
                )}
            </div>
        </div>
    )
}
