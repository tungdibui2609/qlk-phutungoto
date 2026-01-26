'use client'
import { useState, useEffect } from 'react'
import { Grid3X3, Save, X, Columns, LayoutGrid, ChevronDown, Move, Box, Copy, ClipboardPaste, Users, RefreshCw } from 'lucide-react'
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

interface DeepLayoutTemplate {
    settings: LayoutSettings
    children: DeepLayoutTemplate[] // index-based matching for children
}

// Global clipboard for recursive layout settings
let layoutDeepClipboard: DeepLayoutTemplate | null = null

interface LayoutConfigPanelProps {
    zone: Zone
    layout: ZoneLayout | null
    siblingZones?: Zone[] // Zones with same parent (for batch apply)
    onSave: (layout: ZoneLayout) => void
    onBatchSave?: (layouts: ZoneLayout[]) => void
    onChange?: (layout: Partial<ZoneLayout>) => void
    onClose: () => void
    tableName?: string
    allZones?: Zone[]
    allLayouts?: Record<string, any>
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

export default function LayoutConfigPanel({
    zone,
    layout,
    siblingZones,
    onSave,
    onBatchSave,
    onChange,
    onClose,
    tableName = 'zone_layouts',
    allZones = [],
    allLayouts = {}
}: LayoutConfigPanelProps) {
    const { showToast, showConfirm } = useToast()
    const [positionColumns, setPositionColumns] = useState(layout?.position_columns ?? 8)
    const [cellWidth, setCellWidth] = useState(layout?.cell_width ?? 0)
    const [cellHeight, setCellHeight] = useState(layout?.cell_height ?? 0)
    const [childLayout, setChildLayout] = useState(layout?.child_layout ?? 'vertical')
    const [childColumns, setChildColumns] = useState(layout?.child_columns ?? 0)
    const [childWidth, setChildWidth] = useState(layout?.child_width ?? 0)
    const [collapsible, setCollapsible] = useState(layout?.collapsible ?? true)
    const [displayType, setDisplayType] = useState(layout?.display_type ?? 'auto')
    const [isSaving, setIsSaving] = useState(false)
    const [hasClipboard, setHasClipboard] = useState(!!layoutDeepClipboard)

    // Sync settings when layout or zone changes
    useEffect(() => {
        setPositionColumns(layout?.position_columns ?? 8)
        setCellWidth(layout?.cell_width ?? 0)
        setCellHeight(layout?.cell_height ?? 0)
        setChildLayout(layout?.child_layout ?? 'vertical')
        setChildColumns(layout?.child_columns ?? 0)
        setChildWidth(layout?.child_width ?? 0)
        setCollapsible(layout?.collapsible ?? true)
        setDisplayType(layout?.display_type ?? 'auto')
    }, [layout, zone.id])

    // Count siblings (excluding current zone)
    const siblingCount = (siblingZones || []).filter(z => z.id !== zone.id).length

    useEffect(() => {
        const interval = setInterval(() => {
            setHasClipboard(!!layoutDeepClipboard)
        }, 500)
        return () => clearInterval(interval)
    }, [])

    // Trigger preview when local states change
    useEffect(() => {
        if (onChange) {
            onChange({
                zone_id: zone.id,
                ...getCurrentSettings()
            } as any);
        }
    }, [positionColumns, cellWidth, cellHeight, childLayout, childColumns, childWidth, collapsible, displayType]);

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
        // Recursive function to build the template tree
        const buildTemplate = (targetZone: Zone): DeepLayoutTemplate => {
            const rawSettings = allLayouts[targetZone.id] || {};

            // Sanitize settings: Pick only layout configuration fields
            const sanitize = (s: any): LayoutSettings => ({
                position_columns: s.position_columns ?? 8,
                cell_width: s.cell_width ?? 0,
                cell_height: s.cell_height ?? 0,
                child_layout: s.child_layout ?? 'vertical',
                child_columns: s.child_columns ?? 0,
                child_width: s.child_width ?? 0,
                collapsible: s.collapsible ?? true,
                display_type: s.display_type ?? 'auto'
            });

            const actualSettings = targetZone.id === zone.id ? getCurrentSettings() : sanitize(rawSettings);

            const childrenZones = allZones
                .filter(z => z.parent_id === targetZone.id)
                .sort((a, b) => (a.code || '').localeCompare(b.code || ''));

            return {
                settings: actualSettings,
                children: childrenZones.map(z => buildTemplate(z))
            };
        };

        layoutDeepClipboard = buildTemplate(zone);
        setHasClipboard(true);
        showToast('Đã copy cấu hình (bao gồm cấp con)!', 'success');
    }

    function handlePaste() {
        if (!layoutDeepClipboard) return;

        // 1. Apply root settings to local state
        const rootSettings = layoutDeepClipboard.settings;
        setPositionColumns(rootSettings.position_columns);
        setCellWidth(rootSettings.cell_width);
        setCellHeight(rootSettings.cell_height);
        setChildLayout(rootSettings.child_layout);
        setChildColumns(rootSettings.child_columns);
        setChildWidth(rootSettings.child_width);
        setCollapsible(rootSettings.collapsible);
        setDisplayType(rootSettings.display_type || 'auto');

        // 2. Recursively collect and apply settings for descendants
        const batchToSave: any[] = [];

        const applyRecursive = (targetZone: Zone, template: DeepLayoutTemplate) => {
            const targetChildren = allZones
                .filter(z => z.parent_id === targetZone.id)
                .sort((a, b) => (a.code || '').localeCompare(b.code || ''));

            targetChildren.forEach((child, index) => {
                const childTemplate = template.children[index];
                if (childTemplate) {
                    batchToSave.push({
                        zone_id: child.id,
                        ...childTemplate.settings,
                        updated_at: new Date().toISOString()
                    });
                    applyRecursive(child, childTemplate);
                }
            });
        };

        applyRecursive(zone, layoutDeepClipboard);

        if (batchToSave.length > 0) {
            handleApplyBatchToPersistence(batchToSave);
        } else {
            showToast('Đã paste cấu hình cho Zone hiện tại!', 'info');
        }
    }

    async function handleApplyBatchToPersistence(batch: any[]) {
        try {
            console.log('Applying standard map deep paste batch:', batch);
            const { error: batchError } = await (supabase as any)
                .from(tableName)
                .upsert(batch, { onConflict: 'zone_id' });

            if (batchError) throw batchError;

            onBatchSave?.(batch);
            showToast(`Đã paste cấu hình cho ${batch.length} cấp con!`, 'success');
        } catch (err: any) {
            console.error('Deep paste error:', err);
            showToast('Lỗi paste cấp con: ' + (err.message || 'Thất bại'), 'error');
        }
    }

    function handleReset() {
        setPositionColumns(8)
        setCellWidth(0)
        setCellHeight(0)
        setChildLayout('vertical')
        setChildColumns(0)
        setChildWidth(0)
        setCollapsible(true)
        setDisplayType('auto')
        showToast('Đã đặt về mặc định hệ thống!', 'info')
    }

    async function handleResetAll() {
        if (!siblingZones || siblingZones.length === 0) return;
        if (!await showConfirm('Bạn có chắc chắn muốn đặt lại MẶC ĐỊNH cho TOÀN BỘ các zone cùng cấp không?')) return;

        setIsSaving(true);
        try {
            const defaultSettings = {
                position_columns: 8,
                cell_width: 0,
                cell_height: 0,
                child_layout: 'vertical',
                child_columns: 0,
                child_width: 0,
                collapsible: true,
                display_type: 'auto'
            };
            const now = new Date().toISOString();

            const upsertData = siblingZones.map(z => ({
                zone_id: z.id,
                ...defaultSettings,
                updated_at: now
            }));

            // Cast tableName to ensure TS knows it's a valid table
            // In a real scenario, tableName should be strictly typed in props
            const { data, error } = await supabase
                .from(tableName as 'zone_layouts')
                .upsert(upsertData, { onConflict: 'zone_id' })
                .select();

            if (error) throw error;

            const savedLayouts = data || [];
            showToast(`Đã khôi phục mặc định cho ${savedLayouts.length} zone!`, 'success');

            // Sync current panel to default too
            handleReset();

            const currentSaved = savedLayouts.find((l: ZoneLayout) => l.zone_id === zone.id);
            if (currentSaved) onSave(currentSaved);

            onBatchSave?.(savedLayouts);
        } catch (err: any) {
            console.error('Reset all error:', err);
            showToast('Lỗi khôi phục: ' + (err.message || 'Thất bại'), 'error');
        } finally {
            setIsSaving(false);
        }
    }

    async function handleSave() {
        setIsSaving(true);
        try {
            const payload = {
                zone_id: zone.id,
                ...getCurrentSettings(),
                updated_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from(tableName as 'zone_layouts')
                .upsert(payload, { onConflict: 'zone_id' })
                .select()
                .single();

            if (error) throw error;
            showToast('Đã lưu cấu hình!', 'success');
            onSave(data);
        } catch (err: any) {
            console.error('Save error:', err);
            showToast('Lỗi lưu: ' + (err.message || 'Không thể lưu'), 'error');
        } finally {
            setIsSaving(false);
        }
    }

    async function handleApplyToSiblings() {
        if (!siblingZones || siblingZones.length === 0) {
            showToast('Không có zone cùng cấp để áp dụng', 'info');
            return;
        }

        setIsSaving(true);
        try {
            const settings = getCurrentSettings();
            const now = new Date().toISOString();

            // Sync all sibling zones (including current if list is complete)
            const upsertData = siblingZones.map(z => ({
                zone_id: z.id,
                ...settings,
                updated_at: now
            }));

            const { data, error } = await supabase
                .from(tableName as 'zone_layouts')
                .upsert(upsertData, { onConflict: 'zone_id' })
                .select();

            if (error) throw error;

            const savedLayouts = data || [];
            showToast(`Đã đồng bộ ${savedLayouts.length} vị trí!`, 'success');

            // Find current zone's result to update local panel if it stays open
            const currentSaved = savedLayouts.find((l: ZoneLayout) => l.zone_id === zone.id);
            if (currentSaved) onSave(currentSaved);

            onBatchSave?.(savedLayouts);
        } catch (err: any) {
            console.error('Batch save error:', err);
            showToast('Lỗi lưu hàng loạt: ' + (err.message || 'Thất bại'), 'error');
        } finally {
            setIsSaving(false);
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

            {/* Copy/Paste/Default buttons */}
            <div className="flex gap-1.5">
                <button
                    onClick={handleCopy}
                    title="Copy cấu hình"
                    className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1.5 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700/50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg text-[10px] font-bold transition-all border border-gray-100 dark:border-gray-600"
                >
                    <Copy size={12} />
                    COPY
                </button>
                <button
                    onClick={handlePaste}
                    disabled={!hasClipboard}
                    title="Paste cấu hình"
                    className={`flex-1 flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${hasClipboard
                        ? 'bg-orange-50 hover:bg-orange-100 border-orange-100 text-orange-600 shadow-sm'
                        : 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                        }`}
                >
                    <ClipboardPaste size={12} />
                    PASTE
                </button>
                <button
                    onClick={handleReset}
                    title="Khôi phục mặc định"
                    className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[10px] font-bold transition-all border border-red-100 shadow-sm"
                >
                    <RefreshCw size={12} />
                    RESET
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

                {siblingCount > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={handleApplyToSiblings}
                            disabled={isSaving}
                            className="py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                        >
                            <Users size={14} />
                            Đồng bộ {siblingCount} zone
                        </button>
                        <button
                            onClick={handleResetAll}
                            disabled={isSaving}
                            className="py-2 bg-stone-500 hover:bg-stone-600 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors shadow-sm"
                        >
                            <RefreshCw size={14} />
                            Reset All
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
