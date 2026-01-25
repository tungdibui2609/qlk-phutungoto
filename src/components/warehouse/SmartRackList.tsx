"use client";

import React, { useState, useMemo } from 'react';
import { Layers, X, Package, Settings } from 'lucide-react';
import { ZoneData, LevelData } from './types';

interface SmartRackListProps {
    zones: ZoneData[];
    isLoading: boolean;
    warehouseId: string | number;
    isDesignMode?: boolean;
    onConfigureZone?: (zoneId: string) => void;
    layouts?: Record<string, any>;
}

const PRODUCT_COLORS: Record<string, string> = {
    'OTHER': 'bg-zinc-400',
    'EMPTY': 'bg-zinc-100 dark:bg-zinc-800',
    'TA': 'bg-rose-500',
    'TB': 'bg-blue-400',
    'TC': 'bg-emerald-500',
    'TD': 'bg-indigo-500',
    'TA0.500': 'bg-amber-500',
    'TB0': 'bg-cyan-400',
    'TA0': 'bg-pink-500',
    'TC0': 'bg-purple-500',
};

export default function SmartRackList({ zones, isLoading, warehouseId, isDesignMode, onConfigureZone, layouts = {} }: SmartRackListProps) {
    const [selectedLevel, setSelectedLevel] = useState<{ level: LevelData, rackName: string } | null>(null);

    const getProductColor = (productIdentifier?: string) => {
        if (!productIdentifier) return PRODUCT_COLORS['EMPTY'];
        const idUpper = productIdentifier.toUpperCase().split(' ')[0];
        if (PRODUCT_COLORS[idUpper]) return PRODUCT_COLORS[idUpper];
        const dynamicCode = Object.keys(PRODUCT_COLORS).find(key =>
            key !== 'OTHER' && key !== 'EMPTY' && idUpper.startsWith(key)
        );
        return dynamicCode ? PRODUCT_COLORS[dynamicCode] : PRODUCT_COLORS['OTHER'];
    };

    if (isLoading) return <div className="p-12 text-center text-zinc-400 animate-pulse">Đang tải sơ đồ kho...</div>;

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden relative">
            {/* Detail Modal */}
            {selectedLevel && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300" onClick={() => setSelectedLevel(null)}>
                    <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl max-w-2xl w-full overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20" onClick={e => e.stopPropagation()}>
                        <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/50 relative">
                            <div className="relative z-10">
                                <h3 className="font-black text-2xl text-zinc-900 dark:text-zinc-100 tracking-tight">
                                    {selectedLevel.rackName}
                                </h3>
                                <p className="text-sm font-bold text-orange-500 mt-1 uppercase tracking-widest">
                                    {selectedLevel.level.product ? `Sản phẩm chủ đạo: ${selectedLevel.level.product}` : 'Khu vực trống'}
                                </p>
                            </div>
                            <button onClick={() => setSelectedLevel(null)} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-2xl transition-all hover:rotate-90">
                                <X size={24} className="text-zinc-500" />
                            </button>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto p-8">
                            <table className="w-full text-sm text-left border-separate border-spacing-y-3">
                                <thead className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.2em]">
                                    <tr>
                                        <th className="px-4">Vị trí</th>
                                        <th className="px-4">Thông tin hàng hóa</th>
                                        <th className="px-4 text-right">Số lượng</th>
                                        <th className="px-4 text-right">Đơn vị</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedLevel.level.items.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-16 text-center text-zinc-400 font-bold bg-zinc-50 rounded-[2rem]">
                                                <Package size={48} className="mx-auto mb-4 opacity-10" />
                                                Vị trí hiện đang trống
                                            </td>
                                        </tr>
                                    ) : (
                                        selectedLevel.level.items.map((item: any, idx: number) => (
                                            <tr key={idx} className="group">
                                                <td className="px-4 py-4 bg-zinc-50 rounded-l-2xl border-l border-t border-b border-zinc-100 font-black">P{item.position}</td>
                                                <td className="px-4 py-4 border-t border-b border-zinc-100">
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-orange-600 text-xs">{item.code}</span>
                                                        <span className="text-[10px] font-bold text-zinc-500">{item.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 border-t border-b border-zinc-100 text-right font-black">{item.quantity}</td>
                                                <td className="px-4 py-4 bg-zinc-50/50 rounded-r-2xl border-r border-t border-b border-zinc-100 text-right font-bold text-zinc-400">{item.unit}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Header section - Ultra Compact */}
            <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/20 flex items-center justify-between">
                <h2 className="font-black text-sm text-zinc-900 flex items-center gap-2 tracking-tighter">
                    <Layers size={14} className="text-orange-600" />
                    {warehouseId} - Sơ đồ
                </h2>

                <div className="flex flex-wrap items-center gap-2 px-3 py-1 bg-white/50 rounded-lg border border-zinc-50">
                    {Object.entries(PRODUCT_COLORS).filter(([k]) => k !== 'EMPTY' && k !== 'OTHER').map(([code, color]) => (
                        <div key={code} className="flex items-center gap-1 group cursor-help" title={code}>
                            <div className={`w-1.5 h-1.5 rounded-full ${color} shadow-sm group-hover:scale-125 transition-transform`}></div>
                            <span className="text-[7px] font-black text-zinc-400 uppercase tracking-tighter hidden sm:block">{code}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-3">
                <div className="space-y-4">
                    {zones.map((zone: ZoneData) => (
                        <ZoneSection
                            key={zone.id}
                            zone={zone}
                            breadcrumb={[zone.name]}
                            getProductColor={getProductColor}
                            onOpenModal={setSelectedLevel}
                            isDesignMode={isDesignMode}
                            onConfigureZone={onConfigureZone}
                            layouts={layouts}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

function ZoneSection({ zone, breadcrumb, getProductColor, onOpenModal, isDesignMode, onConfigureZone, layouts, parentLayout }: { zone: ZoneData, breadcrumb: string[], getProductColor: (id?: string) => string, onOpenModal: (data: { level: LevelData, rackName: string }) => void, isDesignMode?: boolean, onConfigureZone?: (zoneId: string) => void, layouts: Record<string, any>, parentLayout?: any }) {
    const hasPositions = zone.positions && zone.positions.length > 0;
    const hasChildren = zone.children && zone.children.length > 0;

    // Get zone's own layout, or inherit from parent if not set
    const ownLayout = layouts[zone.id];
    const layout = ownLayout ? {
        // Merge parent values as fallback
        ...parentLayout,
        ...ownLayout,
        // Use own values if explicitly set (> 0), otherwise inherit from parent
        cell_width: (ownLayout.cell_width && ownLayout.cell_width > 0) ? ownLayout.cell_width : (parentLayout?.cell_width || 0),
        cell_height: (ownLayout.cell_height && ownLayout.cell_height > 0) ? ownLayout.cell_height : (parentLayout?.cell_height || 0),
        position_columns: (ownLayout.position_columns && ownLayout.position_columns > 0) ? ownLayout.position_columns : (parentLayout?.position_columns || 8),
    } : parentLayout || null;

    // Debug logging - focus on zones with positions where cell_width matters
    if (isDesignMode && hasPositions) {
        console.log(`[TẦNG] Zone ${zone.name}: cell_width=${layout?.cell_width || 0}, cell_height=${layout?.cell_height || 0}, inherited=${!ownLayout}, columns=${layout?.position_columns || 8}`);
    } else if (isDesignMode && hasChildren && layout?.cell_width > 0) {
        console.log(`[DÃY] Zone ${zone.name}: cell_width=${layout.cell_width} -> sẽ kế thừa xuống children`);
    }

    // Logic for "Row" display (like Dãy A1)
    const levelGroups = useMemo(() => {
        if (!hasPositions) return [];
        const groups: Record<number, NonNullable<ZoneData['positions']>> = {};
        zone.positions!.forEach((p: any) => {
            const parts = p.code.split('-');
            let levelNum = 1;
            const levelPart = parts.find((pt: string) => pt.startsWith('T') && pt.length > 1 && !isNaN(parseInt(pt.substring(1))));
            if (levelPart) {
                levelNum = parseInt(levelPart.substring(1));
            } else {
                const found = parts.find((pt: string) => pt.length === 1 && !isNaN(parseInt(pt)));
                if (found) levelNum = parseInt(found);
                else {
                    const idx = Math.max(0, parts.length - 2);
                    levelNum = parseInt(parts[idx]) || 1;
                }
            }
            if (!groups[levelNum]) groups[levelNum] = [];
            groups[levelNum]!.push(p!);
        });

        return Object.entries(groups).map(([lvl, pings]) => ({
            levelNumber: parseInt(lvl),
            positions: pings!.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
        })).sort((a, b) => a.levelNumber - b.levelNumber);
    }, [zone.positions]);

    const getChildContainerStyle = () => {
        if (layout?.child_layout === 'grid') {
            return {
                display: 'grid',
                gridTemplateColumns: layout.child_columns > 0
                    ? `repeat(${layout.child_columns}, minmax(0, 1fr))`
                    : `repeat(auto-fill, minmax(200px, 1fr))`,
                gap: '0.75rem'
            };
        }
        if (layout?.child_layout === 'horizontal') {
            return {
                display: 'flex',
                flexWrap: 'nowrap' as const,
                overflowX: 'auto' as const,
                gap: '0.75rem',
                flexDirection: 'row' as const,
                alignItems: 'flex-start' as const,
                justifyContent: 'flex-start' as const,
                paddingBottom: '0.5rem'
            };
        }
        return { display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' };
    };

    const isHidden = layout?.display_type === 'hidden' && !isDesignMode;
    const showHeader = (isDesignMode || layout?.display_type === 'header' || layout?.display_type === 'section' || layout?.display_type === 'hidden' || (!layout?.display_type && !hasPositions)) && !isHidden;

    const renderLevelCard = (group: any) => {
        const total = group.positions.length;
        const used = group.positions.filter((p: any) => p.lot_id).length;
        const isFull = used === total;
        const dominantProduct = group.positions.find((p: any) => p.items.length > 0)?.items[0]?.name;

        return (
            <div
                key={group.levelNumber}
                onClick={() => onOpenModal({
                    level: {
                        id: `${zone.id}-L${group.levelNumber}`,
                        levelNumber: group.levelNumber,
                        total,
                        used,
                        product: dominantProduct,
                        items: group.positions.flatMap((p: any) => p.items)
                    },
                    rackName: `${breadcrumb.join(' • ')}`
                })}
                className={`bg-white border rounded p-1.5 shadow-sm hover:shadow-md transition-all cursor-pointer group/card ${isDesignMode ? 'ring-1 ring-orange-500/10' : ''}`}
                style={{
                    width: (layout?.cell_width && layout.cell_width > 0) ? `${layout.cell_width}px` : 'auto',
                    minWidth: '85px',
                    height: (layout?.cell_height && layout.cell_height > 0) ? `${layout.cell_height}px` : 'auto',
                    borderColor: isDesignMode ? '#fdba74' : '#f1f1f2'
                }}
            >
                <div className="flex justify-between items-center mb-0.5">
                    <span className={`font-bold text-[7px] tracking-tight ${isDesignMode ? 'text-zinc-500' : 'text-zinc-400'}`}>T{group.levelNumber}</span>
                    <span className={`text-[7px] font-black tabular-nums ${isFull ? 'text-orange-500' : 'text-zinc-400'}`}>
                        {used}/{total}
                    </span>
                </div>
                <div className="flex gap-[0.5px] h-1 w-full bg-zinc-50 rounded-[0.5px] overflow-hidden p-[0.5px]">
                    {group.positions.map((p: any, idx: number) => {
                        const color = p.lot_id ? getProductColor(p.items[0]?.code) : 'bg-transparent';
                        return <div key={idx} className={`h-full flex-1 rounded-[0.5px] ${color} transition-colors`}></div>
                    })}
                </div>
            </div>
        );
    };

    if (isHidden) {
        return (
            <div className="contents">
                {hasPositions && (
                    <div className="flex flex-wrap gap-2 mb-2">
                        {levelGroups.map((group: any) => renderLevelCard(group))}
                    </div>
                )}
                {hasChildren && zone.children?.map((child: ZoneData) => (
                    <ZoneSection
                        key={child.id}
                        zone={child}
                        breadcrumb={[...breadcrumb, child.name]}
                        getProductColor={getProductColor}
                        onOpenModal={onOpenModal}
                        isDesignMode={isDesignMode}
                        onConfigureZone={onConfigureZone}
                        layouts={layouts}
                        parentLayout={layout}
                    />
                ))}
            </div>
        );
    }

    return (
        <div
            className={`transition-all duration-300 ${isDesignMode ? 'border border-dashed border-orange-200 p-2 rounded-xl bg-orange-50/5 space-y-1.5' : 'space-y-0.5'}`}
            style={{
                width: hasChildren && layout?.child_layout === 'horizontal' ? '100%' : 'fit-content',
                maxWidth: '100%',
                flexShrink: hasChildren && layout?.child_layout === 'horizontal' ? 1 : 0
            }}
        >
            {showHeader && (
                <div className={`flex items-center justify-between gap-2 border-b pb-1 ${layout?.display_type === 'hidden' ? 'border-orange-100 bg-orange-50/50 -mx-1 px-1 py-0.5 rounded shadow-sm' : 'border-zinc-50'}`}>
                    <div className="flex items-center gap-1.5">
                        {layout?.display_type === 'hidden' && (
                            <span className="text-[7px] bg-orange-500 text-white font-black px-1 py-0.5 rounded shadow-sm">ẨN</span>
                        )}
                        <div className="bg-zinc-800 text-white text-[8px] font-black px-2 py-0.5 rounded-md tracking-wider uppercase shrink-0">
                            {zone.name}
                        </div>
                        {isDesignMode && (
                            <div className="text-[7px] font-bold text-zinc-300 uppercase tracking-widest hidden md:block">
                                {breadcrumb.join(' • ')}
                            </div>
                        )}
                    </div>
                    {isDesignMode && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onConfigureZone?.(zone.id);
                            }}
                            className="flex items-center gap-1 px-2 py-0.5 bg-orange-500 hover:bg-orange-600 text-white rounded text-[8px] font-bold transition-all shadow-sm active:scale-95"
                        >
                            <Settings size={10} />
                            CHỈNH
                        </button>
                    )}
                </div>
            )}

            {hasPositions && (
                <div
                    className={`transition-all duration-300 p-1.5 rounded-xl flex flex-col lg:flex-row lg:items-center gap-3 ${isDesignMode ? 'bg-white shadow-sm ring-1 ring-zinc-100' : 'hover:bg-zinc-50/50'}`}
                    style={{
                        width: 'max-content',
                        minWidth: 'auto',
                        flexShrink: 0
                    }}
                >
                    {(layout?.display_type !== 'grid' || isDesignMode) && (
                        <div className="w-14 shrink-0 flex flex-col pl-1 border-r border-zinc-100 pr-2">
                            <div className="font-black text-[10px] text-zinc-900 uppercase tracking-tighter truncate leading-none mb-1">
                                {zone.name}
                            </div>
                            <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-tighter tabular-nums">{zone.positions?.length} VT</div>
                        </div>
                    )}

                    <div
                        className="flex-none grid gap-1.5"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: (layout?.position_columns && layout.position_columns > 0)
                                ? (layout?.cell_width && layout.cell_width > 0)
                                    ? `repeat(${layout.position_columns}, ${layout.cell_width}px)`
                                    : `repeat(${layout.position_columns}, max-content)`
                                : `repeat(auto-fill, minmax(85px, 1fr))`,
                            width: layout?.cell_width ? 'auto' : 'max-content'
                        }}
                    >
                        {levelGroups.map((group: any) => renderLevelCard(group))}
                    </div>
                </div>
            )}

            {hasChildren && (
                <div
                    className={`${!hasPositions ? 'pl-2 border-l border-zinc-100/30' : ''} overflow-x-auto custom-scrollbar-horizontal max-w-full relative`}
                    style={{
                        ...getChildContainerStyle(),
                        width: '100%',
                        maxWidth: '100%'
                    }}
                >
                    <style jsx>{`
                        .custom-scrollbar-horizontal::-webkit-scrollbar {
                            height: 12px;
                            display: block !important;
                        }
                        .custom-scrollbar-horizontal::-webkit-scrollbar-track {
                            background: #f8fafc;
                            border-radius: 10px;
                            box-shadow: inset 0 0 2px rgba(0,0,0,0.05);
                        }
                        .custom-scrollbar-horizontal::-webkit-scrollbar-thumb {
                            background: #fb923c; /* Bolder Orange-400 */
                            border-radius: 10px;
                            border: 3px solid #f8fafc;
                        }
                        .custom-scrollbar-horizontal::-webkit-scrollbar-thumb:hover {
                            background: #f97316; /* Orange-500 */
                        }
                        /* Force visibility */
                        .custom-scrollbar-horizontal {
                            scrollbar-width: auto;
                            scrollbar-color: #fb923c #f8fafc;
                            -ms-overflow-style: auto;
                        }
                    `}</style>
                    {zone.children?.map((child: ZoneData) => (
                        <div key={child.id} className="shrink-0 h-full">
                            <ZoneSection
                                zone={child}
                                breadcrumb={[...breadcrumb, child.name]}
                                getProductColor={getProductColor}
                                onOpenModal={onOpenModal}
                                isDesignMode={isDesignMode}
                                onConfigureZone={onConfigureZone}
                                layouts={layouts}
                                parentLayout={layout}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
