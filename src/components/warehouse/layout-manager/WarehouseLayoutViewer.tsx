'use client';

import React, { useState, useEffect } from 'react';
import { WarehouseLayout, LayoutShape, ShapeType, isShapesFormat } from '@/components/warehouse/layout-manager/types';
import { layoutService } from '@/services/warehouse/layoutService';
import { useSystem } from '@/contexts/SystemContext';

const SHAPE_FILL: Record<ShapeType, string> = {
    ZONE: '#fed7aa', WALL: '#475569', PATH: '#dbeafe', DOOR: '#bbf7d0',
    RACK: '#fef3c7', ROOM: '#ede9fe', PILLAR: '#cbd5e1',
};
const SHAPE_STROKE: Record<ShapeType, string> = {
    ZONE: '#ea580c', WALL: '#1e293b', PATH: '#93c5fd', DOOR: '#16a34a',
    RACK: '#d97706', ROOM: '#7c3aed', PILLAR: '#64748b',
};
const SHAPE_LABELS: Record<ShapeType, string> = {
    ZONE: 'Khu vực', WALL: 'Tường', PATH: 'Lối đi', DOOR: 'Cửa',
    RACK: 'Kệ', ROOM: 'Phòng', PILLAR: 'Cột',
};

interface WarehouseLayoutViewerProps {
    positions?: any[];
    onPositionClick?: (position: any) => void;
    selectedZone?: any;
}

export default function WarehouseLayoutViewer({ positions = [], onPositionClick, selectedZone }: WarehouseLayoutViewerProps) {
    const { systemType } = useSystem();
    const [layoutsToRender, setLayoutsToRender] = useState<WarehouseLayout[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLayout = async () => {
            if (!systemType) return;
            setLoading(true);
            try {
                const layouts = await layoutService.getLayouts(systemType);
                if (selectedZone && selectedZone.code?.startsWith('LAYOUT-')) {
                    const layoutIdPrefix = selectedZone.code.substring(7).toLowerCase();
                    const matchedLayout = layouts.find(l => l.id.startsWith(layoutIdPrefix) && l.is_active);
                    setLayoutsToRender(matchedLayout ? [matchedLayout] : []);
                } else if (!selectedZone) {
                    const activeLayouts = layouts.filter(l => l.is_active);
                    setLayoutsToRender(activeLayouts);
                } else {
                    setLayoutsToRender([]);
                }
            } catch (error) {
                console.error('Failed to load active layout', error);
            } finally {
                setLoading(false);
            }
        };
        fetchLayout();
    }, [systemType, selectedZone]);

    if (loading) {
        return (
            <div className="flex justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (layoutsToRender.length === 0) {
        return (
            <div className="bg-white dark:bg-gray-900 p-12 rounded-lg text-center text-gray-500 border border-dashed border-gray-300 dark:border-gray-700">
                {selectedZone ? `Kho "${selectedZone.name}" chưa có sơ đồ 2D được liên kết.` : 'Không có sơ đồ 2D nào được kích hoạt.'}
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {layoutsToRender.map(layout => {
                const shapes: LayoutShape[] = isShapesFormat(layout.grid_data) ? layout.grid_data : [];
                return (
                    <div key={layout.id} className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
                        <div className="mb-3 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{layout.name}</h2>
                            <div className="flex gap-4 text-xs font-medium text-gray-500">
                                {(['ZONE', 'RACK', 'ROOM', 'WALL', 'PATH', 'DOOR', 'PILLAR'] as ShapeType[]).map(type => (
                                    <span key={type} className="flex items-center gap-1">
                                        <div className={`w-3 h-3 border ${type === 'PILLAR' ? 'rounded-full' : 'rounded-sm'}`} style={{ backgroundColor: SHAPE_FILL[type], borderColor: SHAPE_STROKE[type] }} />
                                        {SHAPE_LABELS[type]}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="overflow-auto border border-gray-200 dark:border-gray-700 rounded-md bg-white">
                            <svg
                                width={layout.width}
                                height={layout.height}
                                viewBox={`0 0 ${layout.width} ${layout.height}`}
                                className="max-w-full h-auto"
                                style={{ minHeight: 300 }}
                            >
                                {/* Background grid */}
                                <defs>
                                    <pattern id={`viewGrid-${layout.id}`} width={20} height={20} patternUnits="userSpaceOnUse">
                                        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f3f4f6" strokeWidth="0.5" />
                                    </pattern>
                                </defs>
                                <rect width={layout.width} height={layout.height} fill={`url(#viewGrid-${layout.id})`} />

                                {/* Shapes */}
                                {shapes.map(shape => {
                                    const matchedPos = shape.type === 'ZONE' && shape.label
                                        ? positions.find(p => p.code === shape.label) : null;
                                    const isOccupied = matchedPos && matchedPos.lot_id;
                                    const sx = shape.x, sy = shape.y;
                                    const cx = sx + shape.width / 2, cy = sy + shape.height / 2;
                                    const rotTransform = shape.rotation ? `rotate(${shape.rotation} ${cx} ${cy})` : undefined;

                                    // PILLAR
                                    if (shape.type === 'PILLAR') {
                                        return (
                                            <g key={shape.id} transform={rotTransform}>
                                                <circle cx={sx + shape.width/2} cy={sy + shape.height/2} r={Math.min(shape.width,shape.height)/2}
                                                    fill={SHAPE_FILL.PILLAR} stroke={SHAPE_STROKE.PILLAR} strokeWidth={2} />
                                            </g>
                                        );
                                    }
                                    // DOOR
                                    if (shape.type === 'DOOR') {
                                        return (
                                            <g key={shape.id} transform={rotTransform}>
                                                <rect x={sx} y={sy} width={shape.width} height={shape.height}
                                                    fill={SHAPE_FILL.DOOR} stroke={SHAPE_STROKE.DOOR} strokeWidth={2} rx={3} />
                                                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={12}>🚪 {shape.label || ''}</text>
                                            </g>
                                        );
                                    }
                                    // ROOM
                                    if (shape.type === 'ROOM') {
                                        return (
                                            <g key={shape.id} transform={rotTransform}>
                                                <rect x={sx} y={sy} width={shape.width} height={shape.height}
                                                    fill={SHAPE_FILL.ROOM} fillOpacity={0.4} stroke={SHAPE_STROKE.ROOM}
                                                    strokeWidth={2.5} strokeDasharray="10 4" rx={8} />
                                                <rect x={sx} y={sy} width={shape.width} height={22} rx={8} fill={SHAPE_STROKE.ROOM} fillOpacity={0.15} />
                                                <text x={sx+8} y={sy+14} fontSize={11} fontWeight="bold" fill={SHAPE_STROKE.ROOM}>{shape.label || 'Phòng'}</text>
                                            </g>
                                        );
                                    }
                                    // RACK with cells
                                    if (shape.type === 'RACK' && shape.rows && shape.cols) {
                                        const cW = shape.width / shape.cols, cH = shape.height / shape.rows;
                                        return (
                                            <g key={shape.id} transform={rotTransform}>
                                                <rect x={sx} y={sy} width={shape.width} height={shape.height}
                                                    fill={SHAPE_FILL.RACK} stroke={SHAPE_STROKE.RACK} strokeWidth={2} />
                                                {Array.from({length: shape.rows-1}).map((_,i) => (
                                                    <line key={`r${i}`} x1={sx} y1={sy+(i+1)*cH} x2={sx+shape.width} y2={sy+(i+1)*cH} stroke={SHAPE_STROKE.RACK} strokeWidth={0.8} />
                                                ))}
                                                {Array.from({length: shape.cols-1}).map((_,i) => (
                                                    <line key={`c${i}`} x1={sx+(i+1)*cW} y1={sy} x2={sx+(i+1)*cW} y2={sy+shape.height} stroke={SHAPE_STROKE.RACK} strokeWidth={0.8} />
                                                ))}
                                                {(shape.positions || []).map((code, idx) => {
                                                    const row = Math.floor(idx / shape.cols!), col = idx % shape.cols!;
                                                    const cellPos = positions.find(p => p.code === code);
                                                    const cellOcc = cellPos && cellPos.lot_id;
                                                    return (
                                                        <g key={idx}
                                                            onClick={() => { if (cellPos && onPositionClick) onPositionClick(cellPos); }}
                                                            className={cellPos ? 'cursor-pointer' : ''}>
                                                            {cellOcc && <rect x={sx+col*cW} y={sy+row*cH} width={cW} height={cH} fill="#fbbf24" opacity={0.6} />}
                                                            <text x={sx+col*cW+cW/2} y={sy+row*cH+cH/2} textAnchor="middle" dominantBaseline="central"
                                                                fontSize={Math.min(9, cW/5)} fill={cellOcc ? '#991b1b' : '#92400e'} fontWeight="600">{code}</text>
                                                        </g>
                                                    );
                                                })}
                                                {shape.label && <text x={sx+shape.width/2} y={sy-6} textAnchor="middle" fontSize={11} fontWeight="bold" fill={SHAPE_STROKE.RACK}>{shape.label}</text>}
                                            </g>
                                        );
                                    }
                                    // Default: ZONE, WALL, PATH
                                    return (
                                        <g key={shape.id}
                                            onClick={() => { if (matchedPos && onPositionClick) onPositionClick(matchedPos); }}
                                            className={matchedPos ? 'cursor-pointer' : ''}
                                            transform={rotTransform}>
                                            <rect x={sx} y={sy} width={shape.width} height={shape.height}
                                                fill={isOccupied ? '#fbbf24' : (SHAPE_FILL[shape.type] || SHAPE_FILL.ZONE)}
                                                stroke={isOccupied ? '#dc2626' : (SHAPE_STROKE[shape.type] || SHAPE_STROKE.ZONE)}
                                                strokeWidth={isOccupied ? 3 : 2} rx={shape.rx || (shape.type === 'ZONE' ? 4 : 0)} opacity={0.85} />
                                            {shape.label && (
                                                <text x={sx+shape.width/2} y={sy+shape.height/2} textAnchor="middle" dominantBaseline="central"
                                                    fontSize={Math.min(14, shape.width/shape.label.length*1.5, shape.height*0.4)}
                                                    fontWeight="bold" fill={isOccupied ? '#991b1b' : '#78350f'}>{shape.label}</text>
                                            )}
                                            {isOccupied && (
                                                <text x={sx+shape.width/2} y={sy+shape.height/2+14} textAnchor="middle" fontSize={9} fill="#991b1b">Đang có hàng</text>
                                            )}
                                        </g>
                                    );
                                })}
                            </svg>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
