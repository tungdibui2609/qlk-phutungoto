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

            {/* Header section */}
            <div className="p-10 border-b border-zinc-100 bg-zinc-50/30">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-10">
                    <h2 className="font-black text-3xl text-zinc-900 flex items-center gap-4 tracking-tighter">
                        <div className="w-12 h-12 rounded-2xl bg-orange-600 text-white flex items-center justify-center shadow-lg shadow-orange-500/20">
                            <Layers size={24} />
                        </div>
                        {warehouseId} - Sơ đồ chi tiết
                    </h2>

                    <div className="flex flex-wrap items-center gap-4 bg-white px-6 py-4 rounded-[1.5rem] border border-zinc-100 shadow-sm">
                        {Object.entries(PRODUCT_COLORS).filter(([k]) => k !== 'EMPTY' && k !== 'OTHER').map(([code, color]) => (
                            <div key={code} className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${color} shadow-sm`}></div>
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{code}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-16">
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

function ZoneSection({ zone, breadcrumb, getProductColor, onOpenModal, isDesignMode, onConfigureZone, layouts }: { zone: ZoneData, breadcrumb: string[], getProductColor: (id?: string) => string, onOpenModal: (data: { level: LevelData, rackName: string }) => void, isDesignMode?: boolean, onConfigureZone?: (zoneId: string) => void, layouts: Record<string, any> }) {
    const hasPositions = zone.positions && zone.positions.length > 0;
    const hasChildren = zone.children && zone.children.length > 0;

    // Logic for "Row" display (like Dãy A1)
    // We group positions into "Levels" for visualization if they are many
    const levelGroups = useMemo(() => {
        if (!hasPositions) return [];

        // Group positions by the "Level" part of their code if possible, or just treat as one big level
        // For simplicity and matching the UI, we'll try to find a digit in the code that looks like a level
        // Usually: Area-Rack-Level-Pos. Let's look for known patterns or just chunk 8 by 8.

        const groups: Record<number, NonNullable<ZoneData['positions']>> = {};
        zone.positions!.forEach((p: any) => {
            // Extraction logic: find the 3rd or 2nd to last segment in a hyphen-separated code
            const parts = p.code.split('-');
            let levelNum = 1;
            if (parts.length >= 2) {
                // Try to find a single digit segment
                const found = parts.find((p: string) => p.length === 1 && !isNaN(parseInt(p)));
                if (found) levelNum = parseInt(found);
                else {
                    // Fallback to second to last if index based
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

    return (
        <div className="space-y-8">
            {/* Folder-like Header for Section */}
            {!hasPositions && (
                <div className="flex items-center gap-4 border-b border-zinc-100 pb-4">
                    <div className="bg-zinc-900 text-white text-[10px] font-black px-4 py-1.5 rounded-xl tracking-[0.2em] uppercase shrink-0">
                        {zone.name}
                    </div>
                    {isDesignMode && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onConfigureZone?.(zone.id);
                            }}
                            className="p-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors shadow-sm"
                            title="Cấu hình Zone"
                        >
                            <Settings size={14} />
                        </button>
                    )}
                    <div className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest hidden md:block">
                        {breadcrumb.join(' • ')}
                    </div>
                </div>
            )}

            {hasPositions && (
                <div className="flex flex-col lg:flex-row lg:items-start gap-6 group hover:bg-orange-50/30 p-4 rounded-3xl transition-all duration-300">
                    <div className="w-32 shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="font-black text-sm text-zinc-800 uppercase tracking-tight group-hover:text-orange-600 transition-colors">
                                {zone.name}
                            </div>
                            {isDesignMode && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onConfigureZone?.(zone.id);
                                    }}
                                    className="p-1 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors shadow-sm"
                                    title="Cấu hình Layout"
                                >
                                    <Settings size={10} />
                                </button>
                            )}
                        </div>
                        <div className="text-[9px] font-bold text-zinc-400 mt-1">{zone.positions?.length} vị trí</div>
                    </div>

                    <div
                        className="flex-1 grid gap-4"
                        style={{
                            gridTemplateColumns: layouts[zone.id]?.child_columns > 0
                                ? `repeat(${layouts[zone.id].child_columns}, minmax(0, 1fr))`
                                : `repeat(auto-fill, minmax(200px, 1fr))`
                        }}
                    >
                        {levelGroups.map((group: any) => {
                            const total = group.positions.length;
                            const used = group.positions.filter((p: any) => p.lot_id).length;
                            const isFull = used === total;

                            // Dominant product in group
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
                                    className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm hover:shadow-xl hover:border-orange-200 transition-all cursor-pointer group/card"
                                >
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="font-black text-[10px] text-zinc-300 group-hover/card:text-zinc-500">TẦNG {group.levelNumber}</span>
                                        <span className={`text-[10px] font-black ${isFull ? 'text-orange-600' : 'text-zinc-400'}`}>
                                            {used}/{total}
                                        </span>
                                    </div>
                                    <div className="flex gap-[1.5px] h-2.5 w-full bg-zinc-50 rounded-full overflow-hidden p-[2px] border border-zinc-50">
                                        {group.positions.map((p: any, idx: number) => {
                                            const color = p.lot_id ? getProductColor(p.items[0]?.code) : 'bg-transparent';
                                            return <div key={idx} className={`h-full flex-1 rounded-full ${color} transition-colors`}></div>
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {hasChildren && (
                <div className="pl-6 border-l-2 border-zinc-50 space-y-12">
                    {zone.children?.map((child: ZoneData) => (
                        <ZoneSection
                            key={child.id}
                            zone={child}
                            breadcrumb={[...breadcrumb, child.name]}
                            getProductColor={getProductColor}
                            onOpenModal={onOpenModal}
                            isDesignMode={isDesignMode}
                            onConfigureZone={onConfigureZone}
                            layouts={layouts}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
