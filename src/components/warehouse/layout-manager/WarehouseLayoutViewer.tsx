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
    FIRST_AID: '#dcfce7', LOCKER: '#e2e8f0', ARROW: '#3b82f6', LINE: 'transparent', DASHED_LINE: 'transparent', TEXT_NOTE: 'transparent',
};

const SHAPE_STROKE: Record<ShapeType, string> = {
    ZONE: '#ea580c', RACK: '#d97706', ROOM: '#7c3aed', WALL: '#1e293b',
    PARTITION: '#64748b', FENCE: '#64748b', PATH: '#93c5fd', DOOR: '#16a34a',
    DOCK: '#4338ca', PILLAR: '#475569', DESK: '#0284c7', PACK_STATION: '#ca8a04',
    SCALE: '#0d9488', STAGING: '#eab308', QC_AREA: '#059669', SCRAP: '#dc2626',
    FORKLIFT_PARK: '#d97706', STAIRS: '#475569', FIRE_EXT: '#ef4444',
    FIRST_AID: '#16a34a', LOCKER: '#475569', ARROW: '#1d4ed8', LINE: '#2563eb', DASHED_LINE: '#eab308', TEXT_NOTE: 'transparent',
};

const SHAPE_LABELS: Record<ShapeType, string> = {
    ZONE: 'Bãi hàng', RACK: 'Kệ hàng', ROOM: 'Phòng kho', WALL: 'Tường',
    PARTITION: 'Vách ngăn', FENCE: 'Hàng rào', PATH: 'Lối đi', DOOR: 'Cửa',
    DOCK: 'Dock xe tải', PILLAR: 'Cột trụ', DESK: 'Bàn thủ kho', PACK_STATION: 'Đóng gói',
    SCALE: 'Trạm cân', STAGING: 'Tập kết', QC_AREA: 'KCS / Kiểm hàng', SCRAP: 'Phế phẩm',
    FORKLIFT_PARK: 'Bãi xe nâng', STAIRS: 'Cầu thang', FIRE_EXT: 'PCCC',
    FIRST_AID: 'Tủ y tế', LOCKER: 'Tủ đồ', ARROW: 'Hướng đi', LINE: 'Đường thẳng', DASHED_LINE: 'Đường nét đứt', TEXT_NOTE: 'Ghi chú',
};

import { CheckSquare } from 'lucide-react';

interface WarehouseLayoutViewerProps {
    positions?: any[];
    filteredPositions?: any[];
    searchTerm?: string;
    onPositionClick?: (position: any) => void;
    onPositionSelect?: (positionId: string) => void;
    selectedPositionIds?: Set<string>;
    onViewLotDetails?: (lotId: string) => void;
    onExportLot?: (positionId: string, lotId: string) => void;
    onUnassignPosition?: (positionId: string) => void;
    onMoveLot?: (positionId: string) => void;
    onPrintQr?: (lot: any) => void;
    onAssignLot?: (shape: LayoutShape) => void;
    selectedZone?: any;
    lotInfo?: Record<string, any>;
    isAssignmentMode?: boolean;
}

export default function WarehouseLayoutViewer({ 
    positions = [], 
    filteredPositions,
    searchTerm = '',
    onPositionClick, 
    onPositionSelect,
    selectedPositionIds,
    onViewLotDetails,
    onExportLot,
    onUnassignPosition,
    onMoveLot,
    onPrintQr,
    onAssignLot,
    selectedZone,
    lotInfo = {},
    isAssignmentMode = false
}: WarehouseLayoutViewerProps) {
    const { systemType } = useSystem();
    const [layoutsToRender, setLayoutsToRender] = useState<WarehouseLayout[]>([]);
    const [loading, setLoading] = useState(true);
    const [isBulkSelectionActive, setIsBulkSelectionActive] = useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Search Matching Logic for 2D Layout
    const normSearch = (searchTerm || '').trim().toLowerCase();
    const isSearching = normSearch.length > 0;

    const matchedPosIdSet = React.useMemo(() => {
        if (!filteredPositions) return null;
        return new Set(filteredPositions.map(p => p.id));
    }, [filteredPositions]);

    const isLotMatched = (lotItem: any) => {
        if (!isSearching) return false;
        if (matchedPosIdSet && lotItem.position?.id && matchedPosIdSet.has(lotItem.position.id)) {
            return true;
        }
        const matchLot = (lotItem.lotCode || '').toLowerCase().includes(normSearch);
        const matchProd = (lotItem.productName || '').toLowerCase().includes(normSearch);
        const matchSku = (lotItem.sku || '').toLowerCase().includes(normSearch);
        const matchBatch = (lotItem.batchCode || '').toLowerCase().includes(normSearch);
        const matchCust = (lotItem.customerName || '').toLowerCase().includes(normSearch);
        const matchPos = (lotItem.position?.code || '').toLowerCase().includes(normSearch);
        return matchLot || matchProd || matchSku || matchBatch || matchCust || matchPos;
    };

    // Multi-Lot Zone Modal State
    const [activeMultiLot, setActiveMultiLot] = useState<{
        shape: LayoutShape;
        lots: any[];
        allZoneLots?: any[];
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
            const firstItem = lot?.items?.[0];
            const totalLotQty = lot?.items && lot.items.length > 0
                ? lot.items.reduce((s: number, it: any) => s + (it.quantity || 0), 0)
                : Number(lot?.quantity ?? pos.quantity ?? 0);

            const prodName = firstItem?.product_name || 
                lot?.products?.name || 
                lot?.product_name || 
                lot?.product?.name || 
                pos.product_name || 
                (pos as any)?.products?.name || 
                (pos as any)?.product?.name || '';

            return {
                position: pos,
                lot: lot,
                lotId: pos.lot_id,
                lotCode: lot?.code || lot?.lot_number || pos.code,
                productName: prodName || 'Bao bì / Hàng hóa',
                sku: firstItem?.sku || lot?.products?.sku || lot?.sku || (pos as any)?.sku || '',
                quantity: totalLotQty,
                unit: firstItem?.unit || lot?.products?.unit || lot?.unit || (pos as any)?.unit || 'cái',
                inboundDate: lot?.inbound_date || lot?.created_at,
                batchCode: lot?.batch_code || lot?.batch_number,
                customerName: lot?.customer_name || lot?.supplier_name,
            };
        });
    };

    // Tự động cuộn đến khu vực khớp tìm kiếm đầu tiên trên sơ đồ
    useEffect(() => {
        if (!isSearching || layoutsToRender.length === 0 || !containerRef.current) return;
        const layout = layoutsToRender[0];
        const shapes: LayoutShape[] = isShapesFormat(layout.grid_data) ? layout.grid_data : [];
        const firstMatched = shapes.find(shape => {
            const zoneLots = getZoneLots(shape);
            return zoneLots.some(it => isLotMatched(it)) || 
                (shape.code && shape.code.toLowerCase().includes(normSearch)) ||
                (shape.label && shape.label.toLowerCase().includes(normSearch));
        });
        if (firstMatched && containerRef.current) {
            const container = containerRef.current;
            const targetX = firstMatched.x - container.clientWidth / 2 + firstMatched.width / 2;
            const targetY = firstMatched.y - container.clientHeight / 2 + firstMatched.height / 2;
            container.scrollTo({
                left: Math.max(0, targetX),
                top: Math.max(0, targetY),
                behavior: 'smooth'
            });
        }
    }, [isSearching, normSearch, layoutsToRender]);

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
                            <div className="flex items-center gap-3">
                                <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    {layout.name}
                                </h2>
                                {!isAssignmentMode && (
                                    <button
                                        type="button"
                                        onClick={() => setIsBulkSelectionActive(prev => !prev)}
                                        className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs ${
                                            isBulkSelectionActive
                                                ? 'bg-blue-600 text-white shadow-blue-500/20 shadow-md ring-2 ring-blue-400'
                                                : 'bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-zinc-800 dark:text-stone-300 dark:hover:bg-zinc-700'
                                        }`}
                                        title={isBulkSelectionActive ? "Đang bật chế độ chọn nhiều ô" : "Bấm để bật chế độ chọn nhiều ô hàng loạt"}
                                    >
                                        <CheckSquare size={13} />
                                        <span>{isBulkSelectionActive ? 'Chế độ: Chọn nhiều ô' : 'Chọn nhiều'}</span>
                                    </button>
                                )}
                            </div>
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

                        <div ref={containerRef} className="overflow-auto border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-zinc-950 p-2 scroll-smooth">
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
                                    {/* Filter hiệu ứng phát sáng loé lên khi khớp tìm kiếm */}
                                    <filter id={`searchGlow-${layout.id}`} x="-30%" y="-30%" width="160%" height="160%">
                                        <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                                        <feMerge>
                                            <feMergeNode in="blur" />
                                            <feMergeNode in="blur" />
                                            <feMergeNode in="SourceGraphic" />
                                        </feMerge>
                                    </filter>
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
                                    const baseOpacity = shape.opacity ?? 0.9;
                                    const isOtherMatch = isSearching && Boolean(
                                        (shape.code && shape.code.toLowerCase().includes(normSearch)) || 
                                        (shape.label && shape.label.toLowerCase().includes(normSearch))
                                    );
                                    const opacity = isSearching ? (isOtherMatch ? 1 : 0.2) : baseOpacity;

                                    // Helper lấy nhãn và biểu tượng nhận diện cho từng loại hạ tầng
                                    const getShapeTypeInfo = (t: ShapeType) => {
                                        switch (t) {
                                            case 'DESK': return { icon: '📦', text: 'BÀN KIỂM' };
                                            case 'STAGING': return { icon: '⚠️', text: 'TẬP KẾT' };
                                            case 'QC_AREA': return { icon: '✓', text: 'KCS' };
                                            case 'PACK_STATION': return { icon: '📦', text: 'ĐÓNG GÓI' };
                                            case 'FORKLIFT_PARK': return { icon: '⚡', text: 'XE NÂNG' };
                                            case 'DOCK': return { icon: '🚚', text: 'DOCK' };
                                            case 'ROOM': return { icon: '🏠', text: 'PHÒNG' };
                                            case 'LOCKER': return { icon: '🗄️', text: 'TỦ ĐỒ' };
                                            case 'PATH': return { icon: '🛣️', text: 'LỐI ĐI' };
                                            case 'SCRAP': return { icon: '⚠️', text: 'PHẾ PHẨM' };
                                            case 'SCALE': return { icon: '⚖️', text: 'TRẠM CÂN' };
                                            case 'ZONE': return { icon: '', text: 'ĐA LÔ' };
                                            default: return { icon: '📍', text: 'VỊ TRÍ' };
                                        }
                                    };

                                    // Bất kỳ hình khối hạ tầng nào (bàn, lối đi, tủ, phòng, tập kết, bãi chứa...) đều có thể là Vị trí Lưu trữ
                                    const isEligibleStorageType = 
                                        shape.type !== 'LINE' && 
                                        shape.type !== 'DASHED_LINE' && 
                                        shape.type !== 'ARROW' && 
                                        shape.type !== 'TEXT_NOTE' && 
                                        shape.type !== 'WALL' &&
                                        shape.type !== 'RACK'; // RACK có logic chia ô riêng
                                    
                                    const zoneLots = isEligibleStorageType ? getZoneLots(shape) : [];
                                    const hasLots = zoneLots.length > 0;
                                    const isStorageLocation = isEligibleStorageType && (
                                        shape.type === 'ZONE' || 
                                        hasLots || 
                                        shape.isStorage || 
                                        shape.isMultiLot || 
                                        Boolean(shape.code && shape.code.trim() !== '')
                                    );

                                    // Logic đối với Vị trí Lưu trữ / Chứa hàng (Bãi ZONE hoặc mọi hình khối hạ tầng được gán mã)
                                    if (isStorageLocation) {
                                        const typeInfo = getShapeTypeInfo(shape.type);
                                        const totalQty = zoneLots.reduce((sum, item) => sum + (item.quantity || 0), 0);
                                        const isMulti = shape.isMultiLot || zoneLots.length > 1;

                                        // Fallback position thông thường nếu chỉ có 1 position
                                        const singlePos = positions.find(p => p.code === (shape.code || shape.label));
                                        const isShapeSelected = Boolean(singlePos && selectedPositionIds?.has(singlePos.id));

                                        // Kiểm tra xem Zone này có khớp kết quả tìm kiếm không
                                        const isMatchInZone = zoneLots.some(item => isLotMatched(item));
                                        const isShapeTextMatch = isSearching && (
                                            (shape.code && shape.code.toLowerCase().includes(normSearch)) || 
                                            (shape.label && shape.label.toLowerCase().includes(normSearch))
                                        );
                                        const isZoneMatched = isMatchInZone || isShapeTextMatch;
                                        const effectiveOpacity = isSearching ? (isZoneMatched ? 1 : 0.22) : opacity;

                                        const handleClick = () => {
                                            if (isBulkSelectionActive && onPositionSelect && singlePos?.id) {
                                                onPositionSelect(singlePos.id);
                                            } else if (isAssignmentMode && onPositionClick && singlePos) {
                                                onPositionClick(singlePos);
                                            } else {
                                                setActiveMultiLot({ shape, lots: zoneLots, allZoneLots: zoneLots });
                                            }
                                        };

                                        const isMultiSplit = zoneLots.length > 1;
                                        const isHorizontal = sw >= sh;
                                        const splitCount = zoneLots.length;

                                        return (
                                            <g 
                                                key={shape.id} 
                                                transform={rotTransform} 
                                                onClick={handleClick} 
                                                className="cursor-pointer group"
                                            >
                                                {/* Vòng hào quang loé sáng / Radar ping khi khớp tìm kiếm */}
                                                {isZoneMatched && (
                                                    <rect 
                                                        x={sx - 6} y={sy - 6} width={sw + 12} height={sh + 12}
                                                        rx={(shape.rx || 6) + 4}
                                                        fill="rgba(16, 185, 129, 0.2)"
                                                        stroke="#10b981"
                                                        strokeWidth={3}
                                                        className="animate-pulse pointer-events-none"
                                                        filter={`url(#searchGlow-${layout.id})`}
                                                    />
                                                )}

                                                {/* Khung nền bao ngoài của khu vực */}
                                                <rect 
                                                    x={sx} y={sy} width={sw} height={sh}
                                                    fill={isShapeSelected ? 'rgba(219, 234, 254, 0.8)' : (isZoneMatched ? '#ecfdf5' : (hasLots ? '#fed7aa' : defFill))}
                                                    stroke={isShapeSelected ? '#2563eb' : (isZoneMatched ? '#059669' : (hasLots ? '#ea580c' : defStroke))}
                                                    strokeWidth={isZoneMatched ? 3.5 : (isShapeSelected ? 3.5 : (hasLots ? 2.5 : 2))} 
                                                    rx={shape.rx || 6} 
                                                    opacity={effectiveOpacity}
                                                    className="transition-all group-hover:brightness-95"
                                                />

                                                {/* Họa tiết nhận diện hạ tầng đặc thù */}
                                                {shape.type === 'STAGING' && (
                                                    <>
                                                        <rect x={sx + 4} y={sy + 4} width={sw - 8} height={6} fill={`url(#hazardStripes-${layout.id})`} opacity={0.65} />
                                                        <rect x={sx + 4} y={sy + sh - 10} width={sw - 8} height={6} fill={`url(#hazardStripes-${layout.id})`} opacity={0.65} />
                                                    </>
                                                )}
                                                {shape.type === 'FORKLIFT_PARK' && (
                                                    <rect x={sx + 4} y={sy + 4} width={sw - 8} height={6} fill={`url(#hazardStripes-${layout.id})`} opacity={0.5} />
                                                )}
                                                {shape.type === 'DOCK' && (
                                                    <rect x={sx + 6} y={sy + sh - 8} width={sw - 12} height={6} fill="#4338ca" rx={2} opacity={0.8} />
                                                )}
                                                {shape.type === 'ROOM' && (
                                                    <rect x={sx} y={sy} width={sw} height={Math.min(18, sh * 0.25)} rx={shape.rx || 6} fill={defStroke} fillOpacity={0.15} />
                                                )}
                                                {shape.type === 'LOCKER' && (
                                                    <line x1={sx + sw/2} y1={sy + 2} x2={sx + sw/2} y2={sy + sh - 2} stroke={defStroke} strokeWidth={1} strokeDasharray="3 3" opacity={0.4} />
                                                )}

                                                {/* Huy hiệu định vị trên đầu khu vực khớp tìm kiếm */}
                                                {isZoneMatched && (
                                                    <g transform={`translate(${cx}, ${sy - 15})`} className="animate-bounce pointer-events-none">
                                                        <rect x={-55} y={-11} width={110} height={22} rx={11} fill="#059669" stroke="#ffffff" strokeWidth={2} filter={`url(#searchGlow-${layout.id})`} />
                                                        <text x={0} y={4} textAnchor="middle" fontSize={10} fontWeight="900" fill="#ffffff">
                                                            🎯 TÌM THẤY Ở ĐÂY
                                                        </text>
                                                    </g>
                                                )}

                                                {/* TRƯỜNG HỢP 1: CÓ TỪ 2 LOT TRỞ LÊN -> TỰ ĐỘNG CHIA KHU VỰC THÀNH CÁC Ô NHỎ VỚI ĐƯỜNG KẺ MỜ */}
                                                {isMultiSplit ? (
                                                    <g>
                                                        {/* Các đường kẻ mờ phân cách giữa các ô con */}
                                                        {Array.from({ length: splitCount - 1 }).map((_, idx) => {
                                                            if (isHorizontal) {
                                                                const lineX = sx + (idx + 1) * (sw / splitCount);
                                                                return (
                                                                    <line 
                                                                        key={`div_${idx}`}
                                                                        x1={lineX} y1={sy + 3}
                                                                        x2={lineX} y2={sy + sh - 3}
                                                                        stroke="#ea580c"
                                                                        strokeWidth={1.5}
                                                                        strokeDasharray="4 3"
                                                                        strokeOpacity={0.4}
                                                                    />
                                                                );
                                                            } else {
                                                                const lineY = sy + (idx + 1) * (sh / splitCount);
                                                                return (
                                                                    <line 
                                                                        key={`div_${idx}`}
                                                                        x1={sx + 3} y1={lineY}
                                                                        x2={sx + sw - 3} y2={lineY}
                                                                        stroke="#ea580c"
                                                                        strokeWidth={1.5}
                                                                        strokeDasharray="4 3"
                                                                        strokeOpacity={0.4}
                                                                    />
                                                                );
                                                            }
                                                        })}

                                                        {/* Từng ô nhỏ hiển thị thông tin 1 Lot */}
                                                        {zoneLots.map((item, idx) => {
                                                            const cellW = isHorizontal ? sw / splitCount : sw;
                                                            const cellH = isHorizontal ? sh : sh / splitCount;
                                                            const cellX = isHorizontal ? sx + idx * cellW : sx;
                                                            const cellY = isHorizontal ? sy : sy + idx * cellH;
                                                            const subCx = cellX + cellW / 2;
                                                            const subCy = cellY + cellH / 2;
                                                            const lotLabel = item.position?.code || item.lotCode;
                                                            const isCellSelected = Boolean(item.position?.id && selectedPositionIds?.has(item.position.id));
                                                            const isCellMatch = isLotMatched(item);

                                                            return (
                                                                <g 
                                                                    key={item.lotId || idx}
                                                                    opacity={isSearching && !isCellMatch ? 0.35 : 1}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (isBulkSelectionActive && onPositionSelect && item.position?.id) {
                                                                            onPositionSelect(item.position.id);
                                                                        } else if (isAssignmentMode && onPositionClick && item.position) {
                                                                            onPositionClick(item.position);
                                                                        } else {
                                                                            // Chỉ hiện DUY NHẤT thông tin của ô con vừa click
                                                                            const subPosCode = item.position?.code || item.lotCode;
                                                                            setActiveMultiLot({ 
                                                                                shape: {
                                                                                    ...shape,
                                                                                    label: subPosCode,
                                                                                    code: subPosCode,
                                                                                    isMultiLot: false
                                                                                }, 
                                                                                lots: [item],
                                                                                allZoneLots: zoneLots
                                                                            });
                                                                        }
                                                                    }}
                                                                    className="group/cell cursor-pointer"
                                                                >
                                                                    {/* Vùng cảm ứng hover sáng nhẹ hoặc viền chọn / loé sáng tìm kiếm */}
                                                                    <rect 
                                                                        x={cellX + 2} y={cellY + 2}
                                                                        width={cellW - 4} height={cellH - 4}
                                                                        fill={isCellSelected ? 'rgba(59, 130, 246, 0.25)' : (isCellMatch ? 'rgba(16, 185, 129, 0.35)' : 'transparent')}
                                                                        stroke={isCellSelected ? '#2563eb' : (isCellMatch ? '#059669' : 'none')}
                                                                        strokeWidth={isCellMatch ? 2.5 : 2}
                                                                        rx={4}
                                                                        className={isCellMatch ? 'animate-pulse' : 'transition-colors group-hover/cell:fill-orange-400/20'}
                                                                    />

                                                                    {/* Badge nhỏ "KHỚP" khi ô con này khớp tìm kiếm */}
                                                                    {isCellMatch && (
                                                                        <g transform={`translate(${subCx}, ${cellY + 8})`}>
                                                                            <rect x={-18} y={-6} width={36} height={12} rx={3} fill="#059669" />
                                                                            <text x={0} y={2.5} textAnchor="middle" fontSize={7.5} fontWeight="900" fill="#ffffff">
                                                                                KHỚP
                                                                            </text>
                                                                        </g>
                                                                    )}

                                                                    {/* 3 Tầng thông tin: Mã Vị trí/Lô -> Tên sản phẩm -> Badge Số lượng */}
                                                                    {(() => {
                                                                        const hasProd = Boolean(item.productName && item.productName.trim() !== '');
                                                                        const show3Rows = hasProd && cellH >= 38;
                                                                        const labelY = show3Rows ? subCy - Math.min(13, cellH * 0.25) : subCy - 9;
                                                                        const badgeY = show3Rows ? subCy + Math.min(13, cellH * 0.27) : subCy + 10;
                                                                        const maxProdChars = Math.max(6, Math.floor((cellW - 8) / 6.2));
                                                                        const truncatedProd = item.productName && item.productName.length > maxProdChars 
                                                                            ? item.productName.slice(0, maxProdChars - 1) + '…' 
                                                                            : item.productName;

                                                                        return (
                                                                            <>
                                                                                {/* Mã Lô / Vị trí con của ô */}
                                                                                <text 
                                                                                    x={subCx} 
                                                                                    y={labelY} 
                                                                                    textAnchor="middle" 
                                                                                    dominantBaseline="central"
                                                                                    fontSize={Math.min(11.5, cellW / (lotLabel.length || 1) * 1.3, cellH * 0.26)}
                                                                                    fontWeight="bold" 
                                                                                    fill="#1e293b"
                                                                                >
                                                                                    {lotLabel}
                                                                                </text>

                                                                                {/* Tên sản phẩm ở giữa */}
                                                                                {show3Rows && (
                                                                                    <text 
                                                                                        x={subCx} 
                                                                                        y={subCy} 
                                                                                        textAnchor="middle" 
                                                                                        dominantBaseline="central"
                                                                                        fontSize={Math.min(9.5, Math.max(7.5, cellH * 0.2))}
                                                                                        fontWeight="600" 
                                                                                        fill={isCellMatch ? '#065f46' : '#334155'}
                                                                                        className="select-none pointer-events-none"
                                                                                    >
                                                                                        <title>{item.productName}{item.sku ? ` (${item.sku})` : ''}</title>
                                                                                        {truncatedProd}
                                                                                    </text>
                                                                                )}

                                                                                {/* Badge số lượng của Lô */}
                                                                                <g transform={`translate(${subCx}, ${badgeY})`}>
                                                                                    <rect 
                                                                                        x={-Math.min(45, cellW * 0.42)} 
                                                                                        y={-8} 
                                                                                        width={Math.min(90, cellW * 0.84)} 
                                                                                        height={16} 
                                                                                        rx={8} 
                                                                                        fill={isCellMatch ? '#059669' : '#ea580c'} 
                                                                                    />
                                                                                    <text 
                                                                                        x={0} y={3.5} 
                                                                                        textAnchor="middle" 
                                                                                        fontSize={Math.min(10, cellW * 0.12, cellH * 0.22)} 
                                                                                        fontWeight="bold" 
                                                                                        fill="#ffffff"
                                                                                    >
                                                                                        {item.quantity.toLocaleString()} {item.unit || ''}
                                                                                    </text>
                                                                                </g>
                                                                            </>
                                                                        );
                                                                    })()}
                                                                </g>
                                                            );
                                                        })}

                                                        {/* Badge Loại hình khối & Tên khu vực ở góc trái */}
                                                        <g transform={`translate(${sx + 4}, ${sy + 4})`}>
                                                            <rect width={Math.min(105, sw * 0.48)} height={14} rx={3} fill="#c2410c" />
                                                            <text x={Math.min(105, sw * 0.48) / 2} y={10} textAnchor="middle" fontSize={8} fontWeight="bold" fill="#ffffff">
                                                                {shape.type !== 'ZONE' 
                                                                    ? `${typeInfo.icon} ${typeInfo.text}${shape.label ? ` • ${shape.label}` : (shape.code ? ` • ${shape.code}` : '')}`
                                                                    : (shape.label ? `ĐA LÔ • ${shape.label}` : 'ĐA LÔ')}
                                                            </text>
                                                        </g>
                                                    </g>
                                                ) : (
                                                    /* TRƯỜNG HỢP 2: 1 LOT HOẶC TRỐNG -> HIỂN THỊ NGUYÊN BẢN CẢ KHU VỰC */
                                                    <g>
                                                        {(() => {
                                                            const firstLot = zoneLots[0];
                                                            const hasProd = Boolean(hasLots && firstLot?.productName && firstLot.productName.trim() !== '');
                                                            const show3Rows = hasProd && sh >= 38;
                                                            const labelY = hasLots ? (show3Rows ? cy - Math.min(14, sh * 0.26) : cy - 8) : cy;
                                                            const badgeY = show3Rows ? cy + Math.min(14, sh * 0.28) : cy + 10;
                                                            const maxZoneChars = Math.max(8, Math.floor((sw - 12) / 6.2));
                                                            const truncatedProd = firstLot?.productName && firstLot.productName.length > maxZoneChars 
                                                                ? firstLot.productName.slice(0, maxZoneChars - 1) + '…' 
                                                                : firstLot?.productName;

                                                            return (
                                                                <>
                                                                    {/* Label / Code */}
                                                                    {(shape.label || shape.code) && (
                                                                        <text 
                                                                            x={cx} y={labelY} 
                                                                            textAnchor="middle" dominantBaseline="central"
                                                                            fontSize={Math.min(13, sw / ((shape.label || shape.code || '').length || 1) * 1.5, sh * 0.3)}
                                                                            fontWeight="bold" 
                                                                            fill="#1e293b"
                                                                        >
                                                                            {shape.label || shape.code}
                                                                        </text>
                                                                    )}

                                                                    {/* Tên sản phẩm */}
                                                                    {show3Rows && (
                                                                        <text 
                                                                            x={cx} y={cy} 
                                                                            textAnchor="middle" dominantBaseline="central"
                                                                            fontSize={Math.min(10.5, sw * 0.09, sh * 0.22)}
                                                                            fontWeight="600" 
                                                                            fill={isZoneMatched ? '#065f46' : '#334155'}
                                                                            className="select-none pointer-events-none"
                                                                        >
                                                                            <title>{firstLot.productName}{firstLot.sku ? ` (${firstLot.sku})` : ''}</title>
                                                                            {truncatedProd}
                                                                        </text>
                                                                    )}

                                                                    {/* Thông tin tồn kho & số Lô */}
                                                                    {hasLots ? (
                                                                        <g transform={`translate(${cx}, ${badgeY})`}>
                                                                            <rect 
                                                                                x={-Math.min(48, sw * 0.42)} 
                                                                                y={-9} 
                                                                                width={Math.min(96, sw * 0.84)} 
                                                                                height={18} 
                                                                                rx={9} 
                                                                                fill={isZoneMatched ? '#059669' : '#ea580c'} 
                                                                            />
                                                                            <text x={0} y={4} textAnchor="middle" fontSize={Math.min(10, sw * 0.1, sh * 0.22)} fontWeight="bold" fill="#ffffff">
                                                                                {firstLot?.quantity?.toLocaleString()} {firstLot?.unit || 'cái'}
                                                                            </text>
                                                                        </g>
                                                                    ) : (
                                                                        <text x={cx} y={shape.label || shape.code ? cy + 12 : cy} textAnchor="middle" fontSize={9} fill="#94a3b8" fontWeight="500">
                                                                            Trống
                                                                        </text>
                                                                    )}
                                                                </>
                                                            );
                                                        })()}

                                                        {/* Badge Loại hình khối / ĐA LÔ nếu được cấu hình */}
                                                        {(isMulti || shape.type !== 'ZONE') && (
                                                            <g transform={`translate(${sx + 4}, ${sy + 4})`}>
                                                                <rect width={Math.min(100, sw * 0.48)} height={14} rx={3} fill="#c2410c" />
                                                                <text x={Math.min(100, sw * 0.48) / 2} y={10} textAnchor="middle" fontSize={8} fontWeight="bold" fill="#ffffff">
                                                                    {shape.type !== 'ZONE' 
                                                                        ? `${typeInfo.icon} ${typeInfo.text}${shape.code ? ` • ${shape.code}` : ''}` 
                                                                        : 'ĐA LÔ'}
                                                                </text>
                                                            </g>
                                                        )}
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

                                    // TỦ CHỨA ĐỒ / TỦ LOCKER (LOCKER)
                                    if (shape.type === 'LOCKER') {
                                        return (
                                            <g key={shape.id} transform={rotTransform}>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={defFill} stroke={defStroke} strokeWidth={2} rx={3} opacity={opacity} />
                                                <line x1={cx} y1={sy + 2} x2={cx} y2={sy + sh - 2} stroke={defStroke} strokeWidth={1.5} opacity={0.6} />
                                                <circle cx={cx - 4} cy={cy} r={Math.min(2.5, sw * 0.05)} fill={defStroke} />
                                                <circle cx={cx + 4} cy={cy} r={Math.min(2.5, sw * 0.05)} fill={defStroke} />
                                                <text x={cx} y={sh >= 40 ? sy + 14 : cy} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(13, sw * 0.35, sh * 0.35)}>
                                                    🗄️
                                                </text>
                                                {sh >= 40 && shape.label && (
                                                    <text x={cx} y={sy + sh - 10} textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight="bold" fill="#334155">
                                                        {shape.label}
                                                    </text>
                                                )}
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

                                    // ĐƯỜNG THẲNG / ĐƯỜNG NÉT ĐỨT (LINE / DASHED_LINE)
                                    if (shape.type === 'LINE' || shape.type === 'DASHED_LINE') {
                                        const sWidth = shape.strokeWidth || 3;
                                        const sDash = shape.strokeDasharray || (shape.type === 'DASHED_LINE' ? '8 6' : undefined);
                                        const orient = shape.lineOrientation || (sw >= sh ? 'horizontal' : 'vertical');

                                        let x1 = sx, y1 = sy, x2 = sx + sw, y2 = sy;
                                        if (orient === 'vertical') {
                                            x1 = sx; y1 = sy;
                                            x2 = sx; y2 = sy + sh;
                                        } else if (orient === 'horizontal') {
                                            x1 = sx; y1 = sy;
                                            x2 = sx + sw; y2 = sy;
                                        } else if (orient === 'diagonal-down') {
                                            x1 = sx; y1 = sy;
                                            x2 = sx + sw; y2 = sy + sh;
                                        } else if (orient === 'diagonal-up') {
                                            x1 = sx; y1 = sy + sh;
                                            x2 = sx + sw; y2 = sy;
                                        }

                                        return (
                                            <g key={shape.id} transform={rotTransform}>
                                                <line 
                                                    x1={x1} y1={y1} x2={x2} y2={y2} 
                                                    stroke={defStroke} 
                                                    strokeWidth={sWidth} 
                                                    strokeDasharray={sDash}
                                                    strokeLinecap="round"
                                                    opacity={opacity}
                                                />
                                                {shape.label && shape.label !== 'Đường thẳng' && shape.label !== 'Đường nét đứt' && (
                                                    <text 
                                                        x={cx} 
                                                        y={orient === 'horizontal' ? cy - 8 : cy} 
                                                        textAnchor="middle" 
                                                        dominantBaseline="central"
                                                        fontSize={10} 
                                                        fontWeight="bold" 
                                                        fill={defStroke}
                                                    >
                                                        {shape.label}
                                                    </text>
                                                )}
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

            {/* Modal Chi tiết Bãi chứa Đa Lô & Lô Hàng */}
            {activeMultiLot && (
                <MultiLotZoneModal
                    isOpen={!!activeMultiLot}
                    onClose={() => setActiveMultiLot(null)}
                    shape={activeMultiLot.shape}
                    lots={activeMultiLot.lots}
                    allZoneLots={activeMultiLot.allZoneLots}
                    onShowAllLots={() => {
                        if (activeMultiLot.allZoneLots) {
                            setActiveMultiLot({
                                shape: {
                                    ...activeMultiLot.shape,
                                    label: activeMultiLot.shape.label,
                                    isMultiLot: true
                                },
                                lots: activeMultiLot.allZoneLots,
                                allZoneLots: activeMultiLot.allZoneLots
                            });
                        }
                    }}
                    onSelectLot={(lotItem) => {
                        setActiveMultiLot(null);
                        if (onViewLotDetails && lotItem.lotId) {
                            onViewLotDetails(lotItem.lotId);
                        }
                    }}
                    onViewLotDetails={onViewLotDetails}
                    onExportLot={onExportLot}
                    onUnassignPosition={onUnassignPosition}
                    onMoveLot={onMoveLot}
                    onPrintQr={onPrintQr}
                    onAssignLot={onAssignLot}
                />
            )}
        </div>
    );
}
