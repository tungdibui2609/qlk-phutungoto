'use client';

import React, { useState, useEffect } from 'react';
import { WarehouseLayout, LayoutShape, ShapeType, isShapesFormat } from '@/components/warehouse/layout-manager/types';
import { layoutService } from '@/services/warehouse/layoutService';
import { useSystem } from '@/contexts/SystemContext';
import MultiLotZoneModal from './MultiLotZoneModal';

const SHAPE_FILL: Record<ShapeType, string> = {
    ZONE: '#fed7aa', RACK: '#fef3c7', ROOM: '#ede9fe', WALL: '#475569',
    PARTITION: '#cbd5e1', FENCE: '#f1f5f9', PATH: '#dbeafe', DOOR: '#bbf7d0',
    DOCK: '#e0e7ff', PILLAR: '#94a3b8', DESK: '#e0f2fe', PACK_STATION: '#fef08a',
    SCALE: '#ccfbf1', STAGING: '#fef9c3', QC_AREA: '#d1fae5', SCRAP: '#fee2e2',
    FORKLIFT_PARK: '#fef3c7', STAIRS: '#f1f5f9', FIRE_EXT: '#fee2e2',
    FIRST_AID: '#dcfce7', ARROW: '#3b82f6', TEXT_NOTE: 'transparent',
};

const SHAPE_STROKE: Record<ShapeType, string> = {
    ZONE: '#ea580c', RACK: '#d97706', ROOM: '#7c3aed', WALL: '#1e293b',
    PARTITION: '#64748b', FENCE: '#64748b', PATH: '#93c5fd', DOOR: '#16a34a',
    DOCK: '#4338ca', PILLAR: '#475569', DESK: '#0284c7', PACK_STATION: '#ca8a04',
    SCALE: '#0d9488', STAGING: '#eab308', QC_AREA: '#059669', SCRAP: '#dc2626',
    FORKLIFT_PARK: '#d97706', STAIRS: '#475569', FIRE_EXT: '#ef4444',
    FIRST_AID: '#16a34a', ARROW: '#1d4ed8', TEXT_NOTE: 'transparent',
};

const SHAPE_LABELS: Record<ShapeType, string> = {
    ZONE: 'Bãi hàng', RACK: 'Kệ hàng', ROOM: 'Phòng kho', WALL: 'Tường',
    PARTITION: 'Vách ngăn', FENCE: 'Hàng rào', PATH: 'Lối đi', DOOR: 'Cửa',
    DOCK: 'Dock xe tải', PILLAR: 'Cột trụ', DESK: 'Bàn thủ kho', PACK_STATION: 'Đóng gói',
    SCALE: 'Trạm cân', STAGING: 'Tập kết', QC_AREA: 'KCS / Kiểm hàng', SCRAP: 'Phế phẩm',
    FORKLIFT_PARK: 'Bãi xe nâng', STAIRS: 'Cầu thang', FIRE_EXT: 'PCCC',
    FIRST_AID: 'Tủ y tế', ARROW: 'Hướng đi', TEXT_NOTE: 'Ghi chú',
};

interface WarehouseLayoutViewerProps {
    positions?: any[];
    onPositionClick?: (position: any) => void;
    selectedZone?: any;
    lotInfo?: Record<string, any>;
}

export default function WarehouseLayoutViewer({ 
    positions = [], 
    onPositionClick, 
    selectedZone,
    lotInfo = {}
}: WarehouseLayoutViewerProps) {
    const { systemType } = useSystem();
    const [layoutsToRender, setLayoutsToRender] = useState<WarehouseLayout[]>([]);
    const [loading, setLoading] = useState(true);

    // Multi-Lot Zone Modal State
    const [activeMultiLot, setActiveMultiLot] = useState<{
        shape: LayoutShape;
        lots: any[];
    } | null>(null);

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

    // Lấy danh sách LOT thuộc về 1 Zone
    const getZoneLots = (shape: LayoutShape) => {
        const matched = positions.filter(p => {
            if (!p.lot_id) return false;
            if (shape.code && (p.code === shape.code || p.code.startsWith(shape.code + '-'))) return true;
            if (shape.label && (p.code === shape.label || p.code.startsWith(shape.label + '-'))) return true;
            if (shape.id && p.zone_id === shape.id) return true;
            return false;
        });

        return matched.map(pos => {
            const lot = lotInfo ? lotInfo[pos.lot_id] : pos.lot;
            return {
                position: pos,
                lot: lot,
                lotId: pos.lot_id,
                lotCode: lot?.lot_number || lot?.code || pos.code,
                productName: lot?.products?.name || lot?.product_name || 'Bao bì / Vật tư',
                sku: lot?.products?.sku || lot?.sku || '',
                quantity: Number(lot?.quantity ?? pos.quantity ?? 0),
                unit: lot?.products?.unit || lot?.unit || 'cái',
                inboundDate: lot?.inbound_date || lot?.created_at,
                batchCode: lot?.batch_code || lot?.batch_number,
                customerName: lot?.customer_name,
            };
        });
    };

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
                    <div key={layout.id} className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800">
                        <div className="mb-4 flex flex-wrap justify-between items-center gap-3">
                            <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                {layout.name}
                            </h2>
                            {/* Legend chú thích ký hiệu */}
                            <div className="flex flex-wrap gap-3 text-xs font-semibold text-gray-500">
                                {(['ZONE', 'RACK', 'DOCK', 'STAGING', 'QC_AREA', 'FORKLIFT_PARK', 'SCALE', 'PACK_STATION', 'FIRE_EXT'] as ShapeType[]).map(type => (
                                    <span key={type} className="flex items-center gap-1.5">
                                        <div 
                                            className="w-3.5 h-3.5 border rounded-sm" 
                                            style={{ backgroundColor: SHAPE_FILL[type], borderColor: SHAPE_STROKE[type] }} 
                                        />
                                        {SHAPE_LABELS[type]}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="overflow-auto border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-zinc-950 p-2">
                            <svg
                                width={layout.width}
                                height={layout.height}
                                viewBox={`0 0 ${layout.width} ${layout.height}`}
                                className="max-w-full h-auto select-none"
                                style={{ minHeight: 300 }}
                            >
                                {/* Technical Patterns */}
                                <defs>
                                    <pattern id={`viewGrid-${layout.id}`} width={20} height={20} patternUnits="userSpaceOnUse">
                                        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f1f5f9" strokeWidth="0.8" />
                                    </pattern>
                                    <pattern id={`hazardStripes-${layout.id}`} width="20" height="20" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                                        <line x1="0" y1="0" x2="0" y2="20" stroke="#fde047" strokeWidth="10" />
                                        <line x1="10" y1="0" x2="10" y2="20" stroke="#1f2937" strokeWidth="10" />
                                    </pattern>
                                    <pattern id={`fenceMesh-${layout.id}`} width="12" height="12" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                                        <rect width="12" height="12" fill="none" stroke="#94a3b8" strokeWidth="0.8" />
                                    </pattern>
                                </defs>
                                <rect width={layout.width} height={layout.height} fill={`url(#viewGrid-${layout.id})`} />

                                {/* Render Shapes */}
                                {shapes.map(shape => {
                                    const sx = shape.x, sy = shape.y;
                                    const sw = shape.width, sh = shape.height;
                                    const cx = sx + sw / 2, cy = sy + sh / 2;
                                    const rotTransform = shape.rotation ? `rotate(${shape.rotation} ${cx} ${cy})` : undefined;

                                    const defFill = shape.color || SHAPE_FILL[shape.type] || SHAPE_FILL.ZONE;
                                    const defStroke = shape.strokeColor || SHAPE_STROKE[shape.type] || SHAPE_STROKE.ZONE;
                                    const opacity = shape.opacity ?? 0.9;

                                    // Logic đối với ZONE (Bãi chứa hàng / Đa Lô)
                                    if (shape.type === 'ZONE') {
                                        const zoneLots = getZoneLots(shape);
                                        const hasLots = zoneLots.length > 0;
                                        const totalQty = zoneLots.reduce((sum, item) => sum + (item.quantity || 0), 0);
                                        const isMulti = shape.isMultiLot || zoneLots.length > 1;

                                        // Fallback position thông thường nếu chỉ có 1 position
                                        const singlePos = positions.find(p => p.code === (shape.code || shape.label));

                                        const handleClick = () => {
                                            if (isMulti || hasLots) {
                                                setActiveMultiLot({ shape, lots: zoneLots });
                                            } else if (singlePos && onPositionClick) {
                                                onPositionClick(singlePos);
                                            }
                                        };

                                        return (
                                            <g 
                                                key={shape.id} 
                                                transform={rotTransform} 
                                                onClick={handleClick} 
                                                className="cursor-pointer group"
                                            >
                                                <rect 
                                                    x={sx} y={sy} width={sw} height={sh}
                                                    fill={hasLots ? '#fed7aa' : defFill}
                                                    stroke={hasLots ? '#ea580c' : defStroke}
                                                    strokeWidth={hasLots ? 2.5 : 2} 
                                                    rx={shape.rx || 6} 
                                                    opacity={opacity}
                                                    className="transition-all group-hover:brightness-95"
                                                />

                                                {/* Label */}
                                                {shape.label && (
                                                    <text 
                                                        x={cx} y={hasLots ? cy - 8 : cy} 
                                                        textAnchor="middle" dominantBaseline="central"
                                                        fontSize={Math.min(13, sw / (shape.label.length || 1) * 1.5, sh * 0.35)}
                                                        fontWeight="bold" 
                                                        fill="#1e293b"
                                                    >
                                                        {shape.label}
                                                    </text>
                                                )}

                                                {/* Thông tin tồn kho & số Lô */}
                                                {hasLots ? (
                                                    <g transform={`translate(${cx}, ${cy + 10})`}>
                                                        <rect x={-45} y={-9} width={90} height={18} rx={9} fill="#ea580c" />
                                                        <text x={0} y={4} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#ffffff">
                                                            {zoneLots.length} Lô • {totalQty.toLocaleString()}
                                                        </text>
                                                    </g>
                                                ) : (
                                                    <text x={cx} y={cy + 12} textAnchor="middle" fontSize={9} fill="#94a3b8" fontWeight="500">
                                                        Trống
                                                    </text>
                                                )}

                                                {/* Badge ĐA LÔ nếu được cấu hình */}
                                                {isMulti && (
                                                    <g transform={`translate(${sx + 4}, ${sy + 4})`}>
                                                        <rect width={48} height={14} rx={3} fill="#c2410c" />
                                                        <text x={24} y={10} textAnchor="middle" fontSize={8} fontWeight="bold" fill="#ffffff">ĐA LÔ</text>
                                                    </g>
                                                )}
                                            </g>
                                        );
                                    }

                                    // CỘT TRỤ (PILLAR)
                                    if (shape.type === 'PILLAR') {
                                        return (
                                            <g key={shape.id} transform={rotTransform}>
                                                <circle 
                                                    cx={cx} cy={cy} r={Math.min(sw, sh)/2}
                                                    fill={defFill} stroke={defStroke} strokeWidth={2} opacity={opacity}
                                                />
                                                <line x1={sx + sw*0.2} y1={sy + sh*0.2} x2={sx + sw*0.8} y2={sy + sh*0.8} stroke={defStroke} strokeWidth={1.5} />
                                                <line x1={sx + sw*0.8} y1={sy + sh*0.2} x2={sx + sw*0.2} y2={sy + sh*0.8} stroke={defStroke} strokeWidth={1.5} />
                                            </g>
                                        );
                                    }

                                    // HÀNG RÀO (FENCE)
                                    if (shape.type === 'FENCE') {
                                        return (
                                            <g key={shape.id} transform={rotTransform}>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={defFill} stroke={defStroke} strokeWidth={1.5} opacity={opacity} />
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={`url(#fenceMesh-${layout.id})`} opacity={0.7} />
                                                <line x1={sx} y1={sy+3} x2={sx+sw} y2={sy+3} stroke={defStroke} strokeWidth={1.5} />
                                                <line x1={sx} y1={sy+sh-3} x2={sx+sw} y2={sy+sh-3} stroke={defStroke} strokeWidth={1.5} />
                                                {shape.label && <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="bold" fill="#475569">{shape.label}</text>}
                                            </g>
                                        );
                                    }

                                    // VÁCH NGĂN (PARTITION)
                                    if (shape.type === 'PARTITION') {
                                        return (
                                            <g key={shape.id} transform={rotTransform}>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={defFill} stroke={defStroke} strokeWidth={1.5} strokeDasharray="6 3" opacity={opacity} />
                                                <line x1={sx+3} y1={cy} x2={sx+sw-3} y2={cy} stroke={defStroke} strokeWidth={1} strokeDasharray="3 3" />
                                                {shape.label && <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="bold" fill="#475569">{shape.label}</text>}
                                            </g>
                                        );
                                    }

                                    // KHU TẬP KẾT (STAGING)
                                    if (shape.type === 'STAGING') {
                                        return (
                                            <g key={shape.id} transform={rotTransform}>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={defFill} stroke={defStroke} strokeWidth={2} strokeDasharray="8 4" opacity={opacity} />
                                                <rect x={sx + 4} y={sy + 4} width={sw - 8} height={10} fill={`url(#hazardStripes-${layout.id})`} opacity={0.65} />
                                                <rect x={sx + 4} y={sy + sh - 14} width={sw - 8} height={10} fill={`url(#hazardStripes-${layout.id})`} opacity={0.65} />
                                                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold" fill="#854d0e">{shape.label || 'TẬP KẾT'}</text>
                                            </g>
                                        );
                                    }

                                    // KHU KCS (QC_AREA)
                                    if (shape.type === 'QC_AREA') {
                                        return (
                                            <g key={shape.id} transform={rotTransform}>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={defFill} stroke={defStroke} strokeWidth={2} strokeDasharray="6 3" rx={6} opacity={opacity} />
                                                <rect x={sx + 6} y={sy + 6} width={50} height={16} rx={4} fill="#059669" />
                                                <text x={sx + 31} y={sy + 18} textAnchor="middle" fontSize={9} fontWeight="bold" fill="#ffffff">✓ KCS</text>
                                                <text x={cx} y={cy + 6} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold" fill="#065f46">{shape.label || 'Kiểm tra chất lượng'}</text>
                                            </g>
                                        );
                                    }

                                    // KHU PHẾ PHẨM (SCRAP)
                                    if (shape.type === 'SCRAP') {
                                        return (
                                            <g key={shape.id} transform={rotTransform}>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={defFill} stroke={defStroke} strokeWidth={2} strokeDasharray="6 4" rx={6} opacity={opacity} />
                                                <rect x={sx + 6} y={sy + 6} width={56} height={16} rx={4} fill="#dc2626" />
                                                <text x={sx + 34} y={sy + 18} textAnchor="middle" fontSize={9} fontWeight="bold" fill="#ffffff">⚠ PHẾ PHẨM</text>
                                                <text x={cx} y={cy + 6} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold" fill="#991b1b">{shape.label || 'Hàng lỗi'}</text>
                                            </g>
                                        );
                                    }

                                    // BÃI ĐỖ / SẠC XE NÂNG (FORKLIFT_PARK)
                                    if (shape.type === 'FORKLIFT_PARK') {
                                        return (
                                            <g key={shape.id} transform={rotTransform}>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={defFill} stroke={defStroke} strokeWidth={2} rx={6} opacity={opacity} />
                                                <rect x={sx + 4} y={sy + 4} width={sw - 8} height={8} fill={`url(#hazardStripes-${layout.id})`} opacity={0.5} />
                                                <rect x={sx + 6} y={sy + sh - 22} width={64} height={16} rx={4} fill="#d97706" />
                                                <text x={sx + 38} y={sy + sh - 10} textAnchor="middle" fontSize={9} fontWeight="bold" fill="#ffffff">⚡ XE NÂNG</text>
                                                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold" fill="#92400e">{shape.label || 'Bãi đỗ'}</text>
                                            </g>
                                        );
                                    }

                                    // CỬA DOCK XE TẢI (DOCK)
                                    if (shape.type === 'DOCK') {
                                        return (
                                            <g key={shape.id} transform={rotTransform}>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={defFill} stroke={defStroke} strokeWidth={2} rx={4} opacity={opacity} />
                                                <rect x={sx + 6} y={sy + sh - 16} width={sw - 12} height={12} fill="#4338ca" rx={2} opacity={0.8} />
                                                <rect x={sx + 4} y={sy + 4} width={sw - 8} height={8} fill={`url(#hazardStripes-${layout.id})`} opacity={0.6} />
                                                <text x={cx} y={cy - 2} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold" fill="#312e81">🚚 {shape.label || 'DOCK XUẤT NHẬP'}</text>
                                            </g>
                                        );
                                    }

                                    // BÀN THỦ KHO (DESK)
                                    if (shape.type === 'DESK') {
                                        return (
                                            <g key={shape.id} transform={rotTransform}>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={defFill} stroke={defStroke} strokeWidth={2} rx={6} opacity={opacity} />
                                                <rect x={sx + 6} y={sy + 6} width={Math.min(30, sw*0.35)} height={sh - 12} fill="#0284c7" fillOpacity={0.2} stroke="#0284c7" strokeWidth={1} rx={3} />
                                                <circle cx={sx + sw*0.65} cy={cy} r={Math.min(10, sh*0.25)} fill="#94a3b8" stroke="#475569" strokeWidth={1} opacity={0.7} />
                                                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold" fill="#0369a1">{shape.label || 'Bàn kiểm'}</text>
                                            </g>
                                        );
                                    }

                                    // TRẠM ĐÓNG GÓI (PACK_STATION)
                                    if (shape.type === 'PACK_STATION') {
                                        return (
                                            <g key={shape.id} transform={rotTransform}>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={defFill} stroke={defStroke} strokeWidth={2} rx={4} opacity={opacity} />
                                                <rect x={cx - 12} y={cy - 12} width={24} height={24} fill="#ca8a04" rx={3} opacity={0.5} />
                                                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold" fill="#854d0e">📦 {shape.label || 'Đóng gói'}</text>
                                            </g>
                                        );
                                    }

                                    // TRẠM CÂN ĐIỆN TỬ (SCALE)
                                    if (shape.type === 'SCALE') {
                                        return (
                                            <g key={shape.id} transform={rotTransform}>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={defFill} stroke={defStroke} strokeWidth={2} rx={4} opacity={opacity} />
                                                <rect x={cx - 20} y={sy + 6} width={40} height={14} fill="#0f172a" rx={2} />
                                                <text x={cx} y={sy + 16} textAnchor="middle" fontSize={8} fontWeight="bold" fill="#34d399">0.0 kg</text>
                                                <text x={cx} y={cy + 8} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold" fill="#0f766e">{shape.label || 'Trạm cân'}</text>
                                            </g>
                                        );
                                    }

                                    // BÌNH PCCC (FIRE_EXT)
                                    if (shape.type === 'FIRE_EXT') {
                                        return (
                                            <g key={shape.id} transform={rotTransform}>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={defFill} stroke={defStroke} strokeWidth={2} rx={4} opacity={opacity} />
                                                <circle cx={cx} cy={cy} r={Math.min(sw, sh)*0.35} fill="#dc2626" />
                                                <text x={cx} y={cy + 5} textAnchor="middle" fontSize={14}>🔥</text>
                                            </g>
                                        );
                                    }

                                    // TỦ Y TẾ (FIRST_AID)
                                    if (shape.type === 'FIRST_AID') {
                                        return (
                                            <g key={shape.id} transform={rotTransform}>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={defFill} stroke={defStroke} strokeWidth={2} rx={4} opacity={opacity} />
                                                <rect x={cx - 4} y={sy + sh*0.25} width={8} height={sh*0.5} fill="#16a34a" rx={1} />
                                                <rect x={sx + sw*0.25} y={cy - 4} width={sw*0.5} height={8} fill="#16a34a" rx={1} />
                                            </g>
                                        );
                                    }

                                    // CẦU THANG (STAIRS)
                                    if (shape.type === 'STAIRS') {
                                        return (
                                            <g key={shape.id} transform={rotTransform}>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={defFill} stroke={defStroke} strokeWidth={2} opacity={opacity} />
                                                {Array.from({ length: 5 }).map((_, i) => (
                                                    <line key={`st_${i}`} x1={sx} y1={sy + (i+1)*(sh/6)} x2={sx + sw} y2={sy + (i+1)*(sh/6)} stroke={defStroke} strokeWidth={1.5} />
                                                ))}
                                                <line x1={cx} y1={sy + sh*0.8} x2={cx} y2={sy + sh*0.2} stroke="#2563eb" strokeWidth={2} />
                                                <polygon points={`${cx},${sy + sh*0.15} ${cx - 4},${sy + sh*0.25} ${cx + 4},${sy + sh*0.25}`} fill="#2563eb" />
                                            </g>
                                        );
                                    }

                                    // MŨI TÊN (ARROW)
                                    if (shape.type === 'ARROW') {
                                        return (
                                            <g key={shape.id} transform={rotTransform}>
                                                <line x1={sx + 8} y1={cy} x2={sx + sw - 16} y2={cy} stroke={defFill} strokeWidth={Math.min(10, sh*0.35)} strokeLinecap="round" />
                                                <polygon points={`${sx + sw - 6},${cy} ${sx + sw - 22},${sy + sh*0.2} ${sx + sw - 22},${sy + sh*0.8}`} fill={defFill} />
                                                {shape.label && <text x={cx} y={sy + sh*0.85} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#1e40af">{shape.label}</text>}
                                            </g>
                                        );
                                    }

                                    // GHI CHÚ BẢN VẼ (TEXT_NOTE)
                                    if (shape.type === 'TEXT_NOTE') {
                                        return (
                                            <g key={shape.id} transform={rotTransform}>
                                                <text 
                                                    x={sx + 6} y={cy} 
                                                    dominantBaseline="central" 
                                                    fontSize={Math.min(18, sh * 0.6)} 
                                                    fontWeight="bold" 
                                                    fill="#1e293b"
                                                >
                                                    {shape.label || 'Ghi chú'}
                                                </text>
                                            </g>
                                        );
                                    }

                                    // CỬA (DOOR)
                                    if (shape.type === 'DOOR') {
                                        return (
                                            <g key={shape.id} transform={rotTransform}>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={defFill} stroke={defStroke} strokeWidth={2} rx={3} />
                                                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold" fill="#15803d">🚪 {shape.label || ''}</text>
                                            </g>
                                        );
                                    }

                                    // PHÒNG (ROOM)
                                    if (shape.type === 'ROOM') {
                                        return (
                                            <g key={shape.id} transform={rotTransform}>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={defFill} fillOpacity={0.4} stroke={defStroke} strokeWidth={2.5} strokeDasharray="10 4" rx={8} />
                                                <rect x={sx} y={sy} width={sw} height={22} rx={8} fill={defStroke} fillOpacity={0.15} />
                                                <text x={sx+8} y={sy+14} fontSize={11} fontWeight="bold" fill={defStroke}>{shape.label || 'Phòng'}</text>
                                            </g>
                                        );
                                    }

                                    // KỆ HÀNG (RACK)
                                    if (shape.type === 'RACK' && shape.rows && shape.cols) {
                                        const cW = sw / shape.cols, cH = sh / shape.rows;
                                        return (
                                            <g key={shape.id} transform={rotTransform}>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={defFill} stroke={defStroke} strokeWidth={2} />
                                                {Array.from({length: shape.rows-1}).map((_,i) => (
                                                    <line key={`r${i}`} x1={sx} y1={sy+(i+1)*cH} x2={sx+sw} y2={sy+(i+1)*cH} stroke={defStroke} strokeWidth={0.8} />
                                                ))}
                                                {Array.from({length: shape.cols-1}).map((_,i) => (
                                                    <line key={`c${i}`} x1={sx+(i+1)*cW} y1={sy} x2={sx+(i+1)*cW} y2={sy+sh} stroke={defStroke} strokeWidth={0.8} />
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
                                                {shape.label && <text x={cx} y={sy-6} textAnchor="middle" fontSize={11} fontWeight="bold" fill={defStroke}>{shape.label}</text>}
                                            </g>
                                        );
                                    }

                                    // Default (WALL, PATH...)
                                    return (
                                        <g key={shape.id} transform={rotTransform}>
                                            <rect 
                                                x={sx} y={sy} width={sw} height={sh}
                                                fill={defFill} stroke={defStroke} strokeWidth={2} 
                                                rx={shape.rx || 0} opacity={opacity} 
                                            />
                                            {shape.label && (
                                                <text 
                                                    x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
                                                    fontSize={Math.min(13, sw / (shape.label.length || 1) * 1.5, sh * 0.35)}
                                                    fontWeight="bold" fill={shape.type === 'WALL' ? '#ffffff' : '#475569'}
                                                >
                                                    {shape.label}
                                                </text>
                                            )}
                                        </g>
                                    );
                                })}
                            </svg>
                        </div>
                    </div>
                );
            })}

            {/* Modal Chi tiết Bãi chứa Đa Lô */}
            {activeMultiLot && (
                <MultiLotZoneModal
                    isOpen={!!activeMultiLot}
                    onClose={() => setActiveMultiLot(null)}
                    shape={activeMultiLot.shape}
                    lots={activeMultiLot.lots}
                    onSelectLot={(lotItem) => {
                        setActiveMultiLot(null);
                        if (onPositionClick && lotItem.position) {
                            onPositionClick(lotItem.position);
                        }
                    }}
                />
            )}
        </div>
    );
}
