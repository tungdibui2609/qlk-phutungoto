'use client'
import { useState, useEffect } from 'react'
import { Grid3X3, Save, X, Columns, LayoutGrid, ChevronDown, Move, Box, Copy, ClipboardPaste, Users, RefreshCw, BarChart2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { Database } from '@/lib/database.types'

type ZoneLayout = any // Fallback to any since zone_status_layouts might not be in types yet
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
    layout_gap: number
    container_height: number
    use_full_title: boolean
}

interface DeepLayoutTemplate {
    settings: LayoutSettings
    children: DeepLayoutTemplate[] // index-based matching for children
}

// Global clipboard for recursive layout settings
let layoutDeepClipboard: DeepLayoutTemplate | null = null

interface StatusLayoutConfigPanelProps {
    zone: Zone
    layout: any | null
    siblingZones?: Zone[] // Zones with same parent (for batch apply)
    onSave: (layout: any) => void
    onBatchSave?: (layouts: any[]) => void
    onChange?: (layout: Partial<any>) => void
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
    { value: 'grid', label: 'Grid', desc: 'Ô trạng thái' },
    { value: 'grouped', label: 'Gom con', desc: 'Gộp thành 1 ô' },
    { value: 'hidden', label: 'Ẩn', desc: 'Không hiển thị' },
]

export default function StatusLayoutConfigPanel({
    zone,
    layout,
    siblingZones,
    onSave,
    onBatchSave,
    onChange,
    onClose,
    tableName = 'zone_status_layouts',
    allZones = [],
    allLayouts = {}
}: StatusLayoutConfigPanelProps) {
    const { showToast } = useToast()
    const [positionColumns, setPositionColumns] = useState(layout?.position_columns ?? 10) // Status map defaults to more columns for overview
    const [cellWidth, setCellWidth] = useState(layout?.cell_width ?? 0)
    const [cellHeight, setCellHeight] = useState(layout?.cell_height ?? 0)
    const [childLayout, setChildLayout] = useState(layout?.child_layout ?? 'vertical')
    const [childColumns, setChildColumns] = useState(layout?.child_columns ?? 0)
    const [childWidth, setChildWidth] = useState(layout?.child_width ?? 0)
    const [collapsible, setCollapsible] = useState(layout?.collapsible ?? true)
    const [displayType, setDisplayType] = useState(layout?.display_type ?? 'auto')
    const [layoutGap, setLayoutGap] = useState(layout?.layout_gap ?? 16)
    const [containerHeight, setContainerHeight] = useState(layout?.container_height ?? 0)
    const [useFullTitle, setUseFullTitle] = useState(layout?.use_full_title ?? false)
    const [isSaving, setIsSaving] = useState(false)
    const [hasClipboard, setHasClipboard] = useState(!!layoutDeepClipboard)

    // Sync settings when layout or zone changes
    useEffect(() => {
        setPositionColumns(layout?.position_columns ?? 10)
        setCellWidth(layout?.cell_width ?? 0)
        setCellHeight(layout?.cell_height ?? 0)
        setChildLayout(layout?.child_layout ?? 'vertical')
        setChildColumns(layout?.child_columns ?? 0)
        setChildWidth(layout?.child_width ?? 0)
        setCollapsible(layout?.collapsible ?? true)
        setDisplayType(layout?.display_type ?? 'auto')
        setLayoutGap(layout?.layout_gap ?? 16)
        setContainerHeight(layout?.container_height ?? 0)
        setUseFullTitle(layout?.use_full_title ?? false)
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
    }, [positionColumns, cellWidth, cellHeight, childLayout, childColumns, childWidth, collapsible, displayType, layoutGap, containerHeight, useFullTitle]);

    function getCurrentSettings(): LayoutSettings {
        return {
            position_columns: positionColumns,
            cell_width: cellWidth,
            cell_height: cellHeight,
            child_layout: childLayout,
            child_columns: childColumns,
            child_width: childWidth,
            collapsible,
            display_type: displayType,
            layout_gap: layoutGap,
            container_height: containerHeight,
            use_full_title: useFullTitle
        }
    }

    function handleCopy() {
        // Recursive function to build the template tree
        const buildTemplate = (targetZone: Zone): DeepLayoutTemplate => {
            const rawSettings = allLayouts[targetZone.id] || {};

            // Sanitize settings: Pick only layout configuration fields, ignore ID, created_at, updated_at
            const sanitize = (s: any): LayoutSettings => ({
                position_columns: s.position_columns ?? 10,
                cell_width: s.cell_width ?? 0,
                cell_height: s.cell_height ?? 0,
                child_layout: s.child_layout ?? 'vertical',
                child_columns: s.child_columns ?? 0,
                child_width: s.child_width ?? 0,
                collapsible: s.collapsible ?? true,
                display_type: s.display_type ?? 'auto',
                layout_gap: s.layout_gap ?? 16,
                container_height: s.container_height ?? 0,
                use_full_title: s.use_full_title ?? false
            });

            // If it's the root of the copy, use the current local states
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
        setLayoutGap(rootSettings.layout_gap ?? 16);
        setContainerHeight(rootSettings.container_height ?? 0);
        setUseFullTitle(rootSettings.use_full_title ?? false);

        // 2. Recursively collect and apply settings for descendants
        const batchToSave: any[] = [];

        const applyRecursive = (targetZone: Zone, template: DeepLayoutTemplate) => {
            // Match children by index
            const targetChildren = allZones
                .filter(z => z.parent_id === targetZone.id)
                .sort((a, b) => (a.code || '').localeCompare(b.code || ''));

            targetChildren.forEach((child, index) => {
                const childTemplate = template.children[index];
                if (childTemplate) {
                    batchToSave.push({
                        zone_id: child.id,
                        ...childTemplate.settings
                    });
                    // Go deeper
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
            console.log('Applying deep paste batch:', batch);
            const { error: batchError } = await supabase
                .from(tableName as any)
                .upsert(batch, { onConflict: 'zone_id' });

            if (batchError) {
                console.error('Supabase batch error:', batchError);
                throw batchError;
            }

            onBatchSave?.(batch);
            showToast(`Đã paste cấu hình cho ${batch.length} cấp con!`, 'success');
        } catch (err: any) {
            console.error('Deep paste error details:', err);
            const msg = err.message || err.details || 'Thất bại (Chi tiết trong Console)';
            showToast('Lỗi paste cấp con: ' + msg, 'error');
        }
    }

    function handleReset() {
        setPositionColumns(10)
        setCellWidth(0)
        setCellHeight(0)
        setChildLayout('vertical')
        setChildColumns(0)
        setChildWidth(0)
        setCollapsible(true)
        setDisplayType('auto')
        setLayoutGap(16)
        setContainerHeight(0)
        setUseFullTitle(false)
        showToast('Đã đặt về mặc định trạng thái!', 'info')
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
                .from(tableName as any)
                .upsert(payload, { onConflict: 'zone_id' })
                .select()
                .single();

            if (error) {
                // FALLBACK to localStorage if table doesn't exist
                if (error.code === 'PGRST116' || error.code === '42P01') {
                    console.warn('Table zone_status_layouts not found, falling back to localStorage');
                    const localLayouts = JSON.parse(localStorage.getItem('local_status_layouts') || '{}');
                    localLayouts[zone.id] = payload;
                    localStorage.setItem('local_status_layouts', JSON.stringify(localLayouts));
                    showToast('Đã lưu (Local): Bảng SQL chưa tồn tại.', 'warning');
                    onSave(payload);
                    return;
                }
                throw error;
            }
            showToast('Đã lưu cấu hình trạng thái!', 'success');
            onSave(data);
        } catch (err: any) {
            console.error('Save status layout error:', err);
            const msg = err.message || err.details || 'Không thể lưu';
            showToast('Lỗi lưu: ' + msg, 'error');
        } finally {
            setIsSaving(false);
        }
    }

    async function handleApplyToSiblings() {
        if (!siblingZones || siblingZones.length === 0) return;

        setIsSaving(true);
        try {
            const settings = getCurrentSettings();
            const now = new Date().toISOString();

            const upsertData = siblingZones.map(z => ({
                zone_id: z.id,
                ...settings,
                updated_at: now
            }));

            const { data, error } = await supabase
                .from(tableName as any)
                .upsert(upsertData, { onConflict: 'zone_id' })
                .select();

            if (error) {
                if (error.code === '42P01') {
                    const localLayouts = JSON.parse(localStorage.getItem('local_status_layouts') || '{}');
                    siblingZones.forEach(z => {
                        localLayouts[z.id] = { zone_id: z.id, ...settings, updated_at: now };
                    });
                    localStorage.setItem('local_status_layouts', JSON.stringify(localLayouts));
                    showToast(`Đã đồng bộ ${siblingZones.length} zone (Local)!`, 'warning');
                    onBatchSave?.(Object.values(localLayouts).filter((l: any) => siblingZones.some(sz => sz.id === l.zone_id)));
                    return;
                }
                throw error;
            }

            const savedLayouts = data || [];
            showToast(`Đã đồng bộ ${savedLayouts.length} trạng thái!`, 'success');
            onBatchSave?.(savedLayouts);
        } catch (err: any) {
            console.error('Batch save status error:', err);
            const msg = err.message || err.details || 'Thất bại';
            showToast('Lỗi lưu hàng loạt: ' + msg, 'error');
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl p-4 space-y-4 w-80 max-h-[85vh] overflow-y-auto z-[60]">
            <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600">
                        <BarChart2 size={18} />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-sm line-clamp-1">
                            Layout Trạng thái
                        </h3>
                        <p className="text-[10px] text-gray-500 font-medium">{zone.name}</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                    <X size={18} className="text-gray-400" />
                </button>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
                <button
                    onClick={handleCopy}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold transition-all border border-slate-200 dark:border-slate-700"
                >
                    <Copy size={12} /> COPY
                </button>
                <button
                    onClick={handlePaste}
                    disabled={!hasClipboard}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[10px] font-bold transition-all border ${hasClipboard
                        ? 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-600 shadow-sm'
                        : 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                        }`}
                >
                    <ClipboardPaste size={12} /> PASTE
                </button>
            </div>

            {/* Layout Mode */}
            <div>
                <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Hiển thị</div>
                <div className="grid grid-cols-2 gap-1.5">
                    {DISPLAY_TYPE_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setDisplayType(opt.value)}
                            className={`px-2.5 py-2 text-xs border transition-all text-left ${displayType === opt.value
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 dark:shadow-none'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                                }`}
                        >
                            <div className="font-bold">{opt.label}</div>
                            <div className={`text-[9px] ${displayType === opt.value ? 'text-indigo-100' : 'text-slate-400'}`}>
                                {opt.desc}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid Settings */}
            <div className="space-y-3 pt-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cấu hình lưới</div>

                <div className="bg-slate-50 dark:bg-slate-900/40 p-3 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Số cột (vị trí)</label>
                        <span className="text-xs font-mono bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5">{positionColumns}</span>
                    </div>
                    <input
                        type="range" min="1" max="30" value={positionColumns}
                        onChange={(e) => setPositionColumns(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-indigo-200 dark:bg-indigo-900 cursor-pointer accent-indigo-600"
                    />
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/40 p-3 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Khoảng cách (Gap)</label>
                        <span className="text-xs font-mono bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5">{layoutGap}px</span>
                    </div>
                    <input
                        type="range" min="0" max="64" step="4" value={layoutGap}
                        onChange={(e) => setLayoutGap(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-indigo-200 dark:bg-indigo-900 cursor-pointer accent-indigo-600"
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500">
                            {displayType === 'grouped' ? 'Thanh Rộng (px)' : 'Ô Rộng (px)'}
                        </label>
                        <input
                            type="number" min="0" max="600" value={cellWidth}
                            onChange={(e) => setCellWidth(Math.max(0, Math.min(600, parseInt(e.target.value) || 0)))}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500">
                            {displayType === 'grouped' ? 'Thanh Cao (px)' : 'Ô Cao (px)'}
                        </label>
                        <input
                            type="number" min="0" max="200" value={cellHeight}
                            onChange={(e) => setCellHeight(Math.max(0, Math.min(200, parseInt(e.target.value) || 0)))}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                </div>

                {displayType === 'grouped' && (
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Khung Cao (tổng thể)</label>
                        <input
                            type="number" min="0" max="300" value={containerHeight}
                            onChange={(e) => setContainerHeight(Math.max(0, Math.min(300, parseInt(e.target.value) || 0)))}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                )}
            </div>

            {/* Child Zones */}
            <div className="space-y-3 pt-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cấu hình Zone con</div>
                <div className="grid grid-cols-3 gap-1.5">
                    {CHILD_LAYOUT_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setChildLayout(opt.value)}
                            className={`py-2 text-[10px] font-bold border transition-all ${childLayout === opt.value
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                                }`}
                        >
                            <span className="block mb-0.5">{opt.icon}</span>
                            {opt.label}
                        </button>
                    ))}
                </div>

                {childLayout === 'grid' && (
                    <div className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/40 p-2 border border-slate-100 dark:border-slate-800">
                        <label className="text-xs text-slate-600 dark:text-slate-400">Số cột Zone</label>
                        <input
                            type="number" min="0" max="10" value={childColumns}
                            onChange={(e) => setChildColumns(Math.max(0, Math.min(10, parseInt(e.target.value) || 0)))}
                            className="w-16 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-center"
                        />
                    </div>
                )}
            </div>

            {/* Options */}
            <div className="pt-2 grid grid-cols-2 gap-2">
                <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-100 transition-colors">
                    <div className={`w-5 h-5 border-2 flex items-center justify-center transition-colors ${collapsible ? 'bg-indigo-600 border-indigo-600' : 'bg-white dark:bg-slate-800 border-slate-300'}`}>
                        {collapsible && <div className="w-2 h-2 bg-white"></div>}
                    </div>
                    <input
                        type="checkbox" className="hidden"
                        checked={collapsible} onChange={(e) => {
                            const val = e.target.checked
                            setCollapsible(val)
                            if (val && displayType === 'grouped') setUseFullTitle(false)
                        }}
                    />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">Thu gọn được</span>
                </label>

                {displayType === 'grouped' && (
                    <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-100 transition-colors">
                        <div className={`w-5 h-5 border-2 flex items-center justify-center transition-colors ${useFullTitle ? 'bg-indigo-600 border-indigo-600' : 'bg-white dark:bg-slate-800 border-slate-300'}`}>
                            {useFullTitle && <div className="w-2 h-2 bg-white"></div>}
                        </div>
                        <input
                            type="checkbox" className="hidden"
                            checked={useFullTitle} onChange={(e) => {
                                const val = e.target.checked
                                setUseFullTitle(val)
                                if (val) setCollapsible(false)
                            }}
                        />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">Hiện tên đầy đủ</span>
                    </label>
                )}
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-200 dark:shadow-none active:scale-[0.98]"
                >
                    {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                    LƯU CẤU HÌNH
                </button>

                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={handleApplyToSiblings}
                        disabled={isSaving}
                        className="py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-[0.98]"
                    >
                        <Users size={14} /> ĐỒNG BỘ ({siblingCount})
                    </button>
                    <button
                        onClick={handleReset}
                        className="py-2.5 bg-white hover:bg-slate-50 border-2 border-slate-100 text-slate-400 text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                    >
                        <RefreshCw size={14} /> MẶC ĐỊNH
                    </button>
                </div>
            </div>
        </div>
    )
}
