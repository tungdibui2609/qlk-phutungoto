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

const formatShortDate = (dateVal?: string | Date) => {
    if (!dateVal) return '';
    try {
        const dt = new Date(dateVal);
        if (isNaN(dt.getTime())) return '';
        const d = String(dt.getDate()).padStart(2, '0');
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        return `${d}/${m}`;
    } catch {
        return '';
    }
};

const formatFullDate = (dateVal?: string | Date) => {
    if (!dateVal) return '';
    try {
        const dt = new Date(dateVal);
        if (isNaN(dt.getTime())) return '';
        const d = String(dt.getDate()).padStart(2, '0');
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const y = dt.getFullYear();
        return `${d}/${m}/${y}`;
    } catch {
        return '';
    }
};

import { 
    CheckSquare, ArrowLeftRight, X, Sparkles, Inbox, 
    ChevronDown, ChevronUp, Layers, Tag, Package, 
    PlusCircle, RefreshCw, MoveRight, ZoomIn, ZoomOut, Maximize2 
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/ToastProvider';

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
    onSwapLots?: (posAId: string, posBId: string) => Promise<void> | void;
    onMoveLotToPosition?: (sourcePosId: string, targetPosId: string) => Promise<void> | void;
    onMoveLotToZoneShape?: (sourcePosId: string, targetShape: LayoutShape) => Promise<void> | void;
    onToggleOrientation?: (shapeId: string, orientation: 'horizontal' | 'vertical') => Promise<void> | void;
    onRefreshData?: () => void;
    unassignedLots?: any[];
    loadingUnassignedLots?: boolean;
    onAssignStagingLotToPosition?: (lotId: string, posId: string) => Promise<void> | void;
    onAssignStagingLotToZoneShape?: (lotId: string, shape: LayoutShape) => Promise<void> | void;
    onRefreshUnassignedLots?: () => void;
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
    isAssignmentMode = false,
    onSwapLots,
    onMoveLotToPosition,
    onMoveLotToZoneShape,
    onToggleOrientation,
    onRefreshData,
    unassignedLots = [],
    loadingUnassignedLots = false,
    onAssignStagingLotToPosition,
    onAssignStagingLotToZoneShape,
    onRefreshUnassignedLots
}: WarehouseLayoutViewerProps) {
    const { systemType } = useSystem();
    const [layoutsToRender, setLayoutsToRender] = useState<WarehouseLayout[]>([]);
    const [loading, setLoading] = useState(true);
    const [isBulkSelectionActive, setIsBulkSelectionActive] = useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const { showToast } = useToast();

    // Khay Hàng Chờ Xếp Vị Trí (Staging Buffer State)
    const [selectedStagingLot, setSelectedStagingLot] = useState<any | null>(null);
    const [isStagingExpanded, setIsStagingExpanded] = useState(true);

    // Zoom & Fit Screen State
    const [zoomMap, setZoomMap] = useState<Record<string, number>>({});
    const [isFitMap, setIsFitMap] = useState<Record<string, boolean>>({});

    const handleZoomChange = (layoutId: string, delta: number) => {
        setZoomMap(prev => {
            const current = prev[layoutId] ?? 1.0;
            const next = Math.min(2.5, Math.max(0.3, Number((current + delta).toFixed(2))));
            return { ...prev, [layoutId]: next };
        });
        setIsFitMap(prev => ({ ...prev, [layoutId]: false }));
    };

    const toggleFit = (layoutId: string) => {
        setIsFitMap(prev => {
            const current = prev[layoutId] !== false; // Mặc định ban đầu là true (vừa màn hình)
            return { ...prev, [layoutId]: !current };
        });
    };

    // Pointer-based Drag & Drop State (hoạt động 100% trên SVG chuột & cảm ứng)
    const [pointerDrag, setPointerDrag] = useState<{
        isDragging: boolean;
        startX: number;
        startY: number;
        currentX: number;
        currentY: number;
        sourceItem: any;
        sourceShape?: LayoutShape | null;
        isStaging?: boolean;
    } | null>(null);

    const pointerDragRef = React.useRef<{
        startX: number;
        startY: number;
        sourceItem: any;
        sourceShape?: LayoutShape | null;
        isStaging?: boolean;
    } | null>(null);

    // Hover Target trong lúc kéo thả
    const [dragOverCell, setDragOverCell] = useState<{
        posId: string;
        shapeId: string;
        productName: string;
        isSameZone: boolean;
    } | null>(null);

    const [dragOverShape, setDragOverShape] = useState<{
        shapeId: string;
        label: string;
    } | null>(null);

    // Chế độ Đổi chỗ bằng Click (bấm ô 1 rồi bấm ô 2)
    const [clickSwapSource, setClickSwapSource] = useState<{
        posId: string;
        lotId: string;
        productName: string;
        zoneCode: string;
    } | null>(null);
    const [isSwapModeActive, setIsSwapModeActive] = useState(false);

    // Multi-Lot Zone Modal State
    const [activeMultiLot, setActiveMultiLot] = useState<{
        shape: LayoutShape;
        lots: any[];
        allZoneLots?: any[];
    } | null>(null);

    const justFinishedDragRef = React.useRef(false);

    // Pointer Event Handlers cho Drag & Drop trực tiếp trên sơ đồ
    const handleCellPointerDown = (e: React.PointerEvent, item: any, shape: LayoutShape) => {
        if (isBulkSelectionActive || isAssignmentMode || isSwapModeActive || clickSwapSource || selectedStagingLot) return;
        if (e.button !== 0) return; // Chỉ nhận chuột trái hoặc cảm ứng

        pointerDragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            sourceItem: item,
            sourceShape: shape
        };

        setPointerDrag({
            isDragging: false,
            startX: e.clientX,
            startY: e.clientY,
            currentX: e.clientX,
            currentY: e.clientY,
            sourceItem: item,
            sourceShape: shape
        });
    };

    // Bắt đầu kéo thả từ Khay Hàng Chờ (Staging Buffer)
    const handleStagingPointerDown = (e: React.PointerEvent, stagingItem: any) => {
        if (e.button !== 0) return;
        pointerDragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            sourceItem: {
                ...stagingItem,
                isStaging: true
            },
            sourceShape: null
        };

        setPointerDrag({
            isDragging: false,
            startX: e.clientX,
            startY: e.clientY,
            currentX: e.clientX,
            currentY: e.clientY,
            sourceItem: {
                ...stagingItem,
                isStaging: true
            },
            sourceShape: null,
            isStaging: true
        });
    };

    // Window-level listener khi đang pointerDrag để kéo thả mượt mà 100% không bị hụt tay
    useEffect(() => {
        if (!pointerDrag) return;

        const handlePointerMove = (e: PointerEvent) => {
            const dist = Math.hypot(e.clientX - pointerDrag.startX, e.clientY - pointerDrag.startY);
            if (dist > 5) {
                setPointerDrag(prev => prev ? {
                    ...prev,
                    isDragging: true,
                    currentX: e.clientX,
                    currentY: e.clientY
                } : null);

                // Tìm phần tử nằm dưới con trỏ
                const elements = document.elementsFromPoint(e.clientX, e.clientY);
                let foundCell: Element | null = null;
                let foundShape: Element | null = null;

                for (const el of elements) {
                    if (!foundCell) {
                        const c = el.closest('[data-role="lot-cell"]');
                        if (c && c.getAttribute('data-pos-id') !== pointerDrag.sourceItem.position?.id) {
                            foundCell = c;
                        }
                    }
                    if (!foundShape) {
                        const s = el.closest('[data-role="zone-shape"]');
                        if (s && s.getAttribute('data-shape-id') !== pointerDrag.sourceShape?.id) {
                            foundShape = s;
                        }
                    }
                }

                const layout = layoutsToRender[0];
                const allShapes: LayoutShape[] = layout && isShapesFormat(layout.grid_data) ? layout.grid_data : [];

                const tgtShapeId = foundShape?.getAttribute('data-shape-id') || foundCell?.getAttribute('data-shape-id');
                const tgtShape = tgtShapeId ? allShapes.find(s => s.id === tgtShapeId) : null;
                const isTargetMultiLot = tgtShape ? Boolean((tgtShape.isMultiLot !== false) && (tgtShape.isStorage !== false)) : false;
                const isInternalDrag = Boolean(pointerDrag.sourceShape && tgtShape && pointerDrag.sourceShape.id === tgtShape.id);

                // Nếu hình đích là Đa Lô (isMultiLot = true hoặc ZONE) và kéo từ ngoài vào (không phải đổi chỗ nội bộ):
                // Ưu tiên hiển thị hover thả vào toàn bộ Khu Vực / Tủ Đồ Đa Lô
                if (tgtShape && isTargetMultiLot && !isInternalDrag) {
                    setDragOverShape({
                        shapeId: tgtShape.id,
                        label: tgtShape.label || tgtShape.code || ''
                    });
                    setDragOverCell(null);
                    return;
                }

                if (foundCell) {
                    const tgtPosId = foundCell.getAttribute('data-pos-id') || '';
                    const cellShapeId = foundCell.getAttribute('data-shape-id') || '';
                    const tgtProd = foundCell.getAttribute('data-prod-name') || '';
                    setDragOverCell({
                        posId: tgtPosId,
                        shapeId: cellShapeId,
                        productName: tgtProd,
                        isSameZone: Boolean(pointerDrag.sourceShape && cellShapeId === pointerDrag.sourceShape.id)
                    });
                    setDragOverShape(null);
                    return;
                }

                if (foundShape) {
                    const shId = foundShape.getAttribute('data-shape-id') || '';
                    const shLabel = foundShape.getAttribute('data-shape-label') || '';
                    setDragOverShape({
                        shapeId: shId,
                        label: shLabel
                    });
                    setDragOverCell(null);
                    return;
                }

                setDragOverCell(null);
                setDragOverShape(null);
            }
        };

        const handlePointerUp = (e: PointerEvent) => {
            if (pointerDrag.isDragging) {
                justFinishedDragRef.current = true;
                setTimeout(() => {
                    justFinishedDragRef.current = false;
                }, 200);

                const elements = document.elementsFromPoint(e.clientX, e.clientY);
                let foundCell: Element | null = null;
                let foundShape: Element | null = null;

                for (const el of elements) {
                    if (!foundCell) {
                        const c = el.closest('[data-role="lot-cell"]');
                        if (c && c.getAttribute('data-pos-id') !== pointerDrag.sourceItem.position?.id) {
                            foundCell = c;
                        }
                    }
                    if (!foundShape) {
                        const s = el.closest('[data-role="zone-shape"]');
                        if (s && s.getAttribute('data-shape-id') !== pointerDrag.sourceShape?.id) {
                            foundShape = s;
                        }
                    }
                }

                const layout = layoutsToRender[0];
                const allShapes: LayoutShape[] = layout && isShapesFormat(layout.grid_data) ? layout.grid_data : [];

                const tgtShapeId = foundShape?.getAttribute('data-shape-id') || foundCell?.getAttribute('data-shape-id');
                const tgtShape = tgtShapeId ? allShapes.find(s => s.id === tgtShapeId) : null;
                const isTargetMultiLot = tgtShape ? Boolean((tgtShape.isMultiLot !== false) && (tgtShape.isStorage !== false)) : false;
                const isInternalDrag = Boolean(pointerDrag.sourceShape && tgtShape && pointerDrag.sourceShape.id === tgtShape.id);

                // 1. Trường hợp kéo từ Khay Chờ (Staging Buffer)
                if (pointerDrag.sourceItem?.isStaging) {
                    const lotId = pointerDrag.sourceItem.lotId;
                    if (tgtShape && isTargetMultiLot) {
                        if (onAssignStagingLotToZoneShape) {
                            onAssignStagingLotToZoneShape(lotId, tgtShape);
                        }
                    } else if (foundCell) {
                        const tgtPosId = foundCell.getAttribute('data-pos-id');
                        if (tgtPosId && onAssignStagingLotToPosition) {
                            onAssignStagingLotToPosition(lotId, tgtPosId);
                        }
                    } else if (tgtShape) {
                        if (onAssignStagingLotToZoneShape) {
                            onAssignStagingLotToZoneShape(lotId, tgtShape);
                        }
                    }
                } else {
                    // 2. Trường hợp hoán đổi / di chuyển giữa các ô trên sơ đồ
                    const srcPosId = pointerDrag.sourceItem.position?.id;

                    if (srcPosId) {
                        if (tgtShape && isTargetMultiLot && !isInternalDrag) {
                            handleExecuteMoveToShape(srcPosId, tgtShape);
                        } else if (foundCell) {
                            const tgtPosId = foundCell.getAttribute('data-pos-id');
                            if (tgtPosId) {
                                handleExecuteSwap(srcPosId, tgtPosId);
                            }
                        } else if (tgtShape) {
                            handleExecuteMoveToShape(srcPosId, tgtShape);
                        }
                    }
                }
            }

            pointerDragRef.current = null;
            setPointerDrag(null);
            setDragOverCell(null);
            setDragOverShape(null);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
        };
    }, [pointerDrag, layoutsToRender]);

    // Helper execute swap positions
    const handleExecuteSwap = async (sourcePosId: string, targetPosId: string) => {
        if (!sourcePosId || !targetPosId || sourcePosId === targetPosId) return;

        // Optimistically update activeMultiLot if open
        setActiveMultiLot(prev => {
            if (!prev) return null;
            const updateList = (list: any[]) => {
                const idxA = list.findIndex(it => (it.position?.id === sourcePosId) || (it.lotId === sourcePosId));
                const idxB = list.findIndex(it => (it.position?.id === targetPosId) || (it.lotId === targetPosId));
                if (idxA !== -1 && idxB !== -1) {
                    const next = [...list];
                    const temp = next[idxA];
                    next[idxA] = next[idxB];
                    next[idxB] = temp;
                    return next;
                }
                return list;
            };
            return {
                ...prev,
                lots: updateList(prev.lots),
                allZoneLots: prev.allZoneLots ? updateList(prev.allZoneLots) : prev.allZoneLots
            };
        });

        if (onSwapLots) {
            await onSwapLots(sourcePosId, targetPosId);
        } else {
            const posA = positions.find(p => p.id === sourcePosId);
            const posB = positions.find(p => p.id === targetPosId);
            if (!posA || !posB) return;
            try {
                await (supabase.from('positions') as any).update({ lot_id: posB.lot_id }).eq('id', sourcePosId);
                await (supabase.from('positions') as any).update({ lot_id: posA.lot_id }).eq('id', targetPosId);
                if (onRefreshData) onRefreshData();
            } catch (err) {
                console.error('Swap lots error:', err);
            }
        }
    };

    // Helper execute move lot into a zone shape
    const handleExecuteMoveToShape = async (sourcePosId: string, targetShape: LayoutShape) => {
        if (!sourcePosId) return;
        if (onMoveLotToZoneShape) {
            await onMoveLotToZoneShape(sourcePosId, targetShape);
        } else {
            const isTargetMulti = targetShape.isMultiLot !== false && targetShape.isStorage !== false;
            const targetCodeUpper = (targetShape.code || '').trim().toUpperCase();
            const targetLabelUpper = (targetShape.label || '').trim().toUpperCase();

            const targetPositions = positions.filter(p => {
                const pCodeUpper = (p.code || '').trim().toUpperCase();
                if (targetCodeUpper) {
                    if (pCodeUpper === targetCodeUpper || pCodeUpper.startsWith(targetCodeUpper + '-')) return true;
                    return false;
                }
                if (targetLabelUpper) {
                    if (pCodeUpper === targetLabelUpper || pCodeUpper.startsWith(targetLabelUpper + '-')) return true;
                }
                if (targetShape.id && p.zone_id === targetShape.id) return true;
                return false;
            });
            const emptyPos = targetPositions.find(p => !p.lot_id);
            if (emptyPos) {
                if (onMoveLotToPosition) {
                    await onMoveLotToPosition(sourcePosId, emptyPos.id);
                } else {
                    const src = positions.find(p => p.id === sourcePosId);
                    if (src?.lot_id) {
                        await (supabase.from('positions') as any).update({ lot_id: null }).eq('id', sourcePosId);
                        await (supabase.from('positions') as any).update({ lot_id: src.lot_id }).eq('id', emptyPos.id);
                        if (onRefreshData) onRefreshData();
                    }
                }
            } else if (!isTargetMulti && targetPositions.length === 1 && targetPositions[0].id !== sourcePosId) {
                await handleExecuteSwap(sourcePosId, targetPositions[0].id);
            }
        }
    };

    // Helper toggle split orientation (Ngang ↔ vs Dọc ↕)
    const handleToggleOrientation = async (shapeId: string, orientation: 'horizontal' | 'vertical') => {
        setLayoutsToRender(prev => prev.map(layout => {
            const shapes = (layout.grid_data || []) as LayoutShape[];
            const updated = shapes.map(s => s.id === shapeId ? { ...s, splitOrientation: orientation } : s);
            return { ...layout, grid_data: updated };
        }));

        if (activeMultiLot && activeMultiLot.shape.id === shapeId) {
            setActiveMultiLot(prev => prev ? {
                ...prev,
                shape: { ...prev.shape, splitOrientation: orientation }
            } : null);
        }

        if (onToggleOrientation) {
            await onToggleOrientation(shapeId, orientation);
        } else {
            try {
                const currentLayout = layoutsToRender[0];
                if (currentLayout) {
                    const shapes = (currentLayout.grid_data || []) as LayoutShape[];
                    const updated = shapes.map(s => s.id === shapeId ? { ...s, splitOrientation: orientation } : s);
                    await layoutService.saveLayout({ ...currentLayout, grid_data: updated });
                }
            } catch (err) {
                console.error('Failed to save layout orientation:', err);
            }
        }
    };

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
        const matchTag = (lotItem.allTags || []).some((t: string) => t.toLowerCase().includes(normSearch)) || 
            (lotItem.tag || '').toLowerCase().includes(normSearch);
        return matchLot || matchProd || matchSku || matchBatch || matchCust || matchPos || matchTag;
    };

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
        const shapeCodeUpper = (shape.code || '').trim().toUpperCase();
        const shapeLabelUpper = (shape.label || '').trim().toUpperCase();

        const matched = positions.filter(p => {
            if (!p.lot_id) return false;
            const pCodeUpper = (p.code || '').trim().toUpperCase();

            // 1. Ưu tiên tuyệt đối mã định danh (shape.code)
            if (shapeCodeUpper) {
                if (pCodeUpper === shapeCodeUpper || pCodeUpper.startsWith(shapeCodeUpper + '-')) return true;
                // Nếu hình đã có code riêng mà không khớp code thì KHÔNG BAO GIỜ so khớp theo label nữa!
                return false;
            }

            // 2. Chỉ khi hình không hề có mã code mới xem xét fallback sang label
            if (shapeLabelUpper) {
                if (pCodeUpper === shapeLabelUpper || pCodeUpper.startsWith(shapeLabelUpper + '-')) return true;
            }

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

            // Trích xuất toàn bộ tags từ lot, items, lot_tags, position
            const itemTags = (lot?.items || []).flatMap((it: any) => it.tags || []);
            const rawTags: any[] = [
                ...(lot?.tags || []),
                ...itemTags,
                ...(firstItem?.tags || []),
                ...(Array.isArray(lot?.lot_tags) ? lot.lot_tags.map((t: any) => (typeof t === 'string' ? t : t.tag)) : []),
                ...(pos?.tags ? (Array.isArray(pos.tags) ? pos.tags : [pos.tags]) : []),
                ...(Array.isArray(pos?.lot_tags) ? pos.lot_tags.map((t: any) => (typeof t === 'string' ? t : t.tag)) : [])
            ];
            const cleanTags = Array.from(new Set(rawTags.map(t => String(t || '').trim()))).filter(t => 
                t && !t.startsWith('MERGED_FROM:') && !t.startsWith('MERGED_DATA:')
            );
            const primaryTag = cleanTags[0] || '';

            // Mã Lô SX / Batch
            const batchCode = lot?.production_lot_codes?.[0] || 
                lot?.batch_code || 
                lot?.batch_number || 
                pos?.batch_code || '';

            // Ngày nhập kho hoặc ngày tạo
            const inboundDate = lot?.inbound_date || lot?.created_at || pos?.inbound_date || pos?.created_at || '';

            return {
                position: pos,
                lot: lot,
                lotId: pos.lot_id,
                lotCode: lot?.code || lot?.lot_number || pos.code,
                productName: prodName || 'Bao bì / Hàng hóa',
                sku: firstItem?.sku || lot?.products?.sku || lot?.sku || (pos as any)?.sku || '',
                quantity: totalLotQty,
                unit: firstItem?.unit || lot?.products?.unit || lot?.unit || (pos as any)?.unit || 'cái',
                inboundDate: inboundDate,
                batchCode: batchCode,
                tag: primaryTag,
                allTags: cleanTags,
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
                                    {layout.code && (
                                        <span className="px-2 py-0.5 text-xs font-mono font-black bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 rounded-lg">
                                            {layout.code}
                                        </span>
                                    )}
                                </h2>
                                {!isAssignmentMode && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsSwapModeActive(prev => {
                                                    const next = !prev;
                                                    if (!next) setClickSwapSource(null);
                                                    return next;
                                                });
                                            }}
                                            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs ${
                                                isSwapModeActive || clickSwapSource
                                                    ? 'bg-amber-600 text-white shadow-amber-500/30 shadow-md ring-2 ring-amber-400'
                                                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-zinc-800 dark:text-stone-300 dark:hover:bg-zinc-700'
                                            }`}
                                            title="Bấm để bật chế độ Đổi vị trí: Bấm chọn ô 1 rồi bấm ô 2 để hoán đổi tức thì"
                                        >
                                            <ArrowLeftRight size={13} />
                                            <span>{isSwapModeActive || clickSwapSource ? 'Đang bật: Đổi vị trí' : 'Đổi vị trí (Click)'}</span>
                                        </button>

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

                                        {/* Zoom & Fit to Screen Controls */}
                                        <div className="flex items-center border border-stone-200 dark:border-zinc-700 rounded-xl overflow-hidden bg-stone-100 dark:bg-zinc-800 shadow-2xs">
                                            <button
                                                type="button"
                                                onClick={() => handleZoomChange(layout.id, -0.1)}
                                                className="p-1.5 hover:bg-stone-200 dark:hover:bg-zinc-700 text-stone-600 dark:text-stone-300 transition-colors"
                                                title="Thu nhỏ sơ đồ"
                                            >
                                                <ZoomOut size={13} />
                                            </button>
                                            <span className="text-[11px] font-bold px-1.5 min-w-[36px] text-center text-stone-700 dark:text-stone-200">
                                                {isFitMap[layout.id] !== false ? 'Vừa' : `${Math.round((zoomMap[layout.id] || 1) * 100)}%`}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleZoomChange(layout.id, 0.1)}
                                                className="p-1.5 hover:bg-stone-200 dark:hover:bg-zinc-700 text-stone-600 dark:text-stone-300 transition-colors"
                                                title="Phóng to sơ đồ"
                                            >
                                                <ZoomIn size={13} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => toggleFit(layout.id)}
                                                className={`px-2.5 py-1 text-[11px] font-bold border-l border-stone-200 dark:border-zinc-700 transition-all flex items-center gap-1 ${
                                                    isFitMap[layout.id] !== false
                                                        ? 'bg-blue-600 text-white shadow-xs'
                                                        : 'hover:bg-stone-200 dark:hover:bg-zinc-700 text-blue-600 dark:text-blue-400'
                                                }`}
                                                title={isFitMap[layout.id] !== false ? "Đang bật chế độ tự động co giãn vừa màn hình" : "Bấm để tự động co giãn vừa khung hình (không cần cuộn ngang)"}
                                            >
                                                <Maximize2 size={12} />
                                                <span>{isFitMap[layout.id] !== false ? 'Đang vừa' : 'Vừa màn hình'}</span>
                                            </button>
                                        </div>
                                    </div>
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

                        {/* Banner hướng dẫn khi đang chọn Lô từ Khay Chờ để xếp vị trí */}
                        {selectedStagingLot && (
                            <div className="mb-3 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl flex items-center justify-between text-xs font-bold shadow-lg ring-2 ring-blue-300 animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="flex items-center gap-2">
                                    <span className="p-1 bg-white/20 rounded-lg text-sm">📥</span>
                                    <span>
                                        Đang xếp: <strong className="underline underline-offset-2">{selectedStagingLot.productName}</strong> {selectedStagingLot.tag ? `(Tag: ${selectedStagingLot.tag})` : (selectedStagingLot.batchCode ? `(Lô: ${selectedStagingLot.batchCode})` : '')} • {selectedStagingLot.quantity.toLocaleString()} {selectedStagingLot.unit}. 
                                        <span className="ml-1 opacity-90 font-normal">👉 Bấm vào bất kỳ ô hoặc khu vực nào trên sơ đồ 2D để XẾP VÀO!</span>
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedStagingLot(null)}
                                    className="px-2.5 py-1 bg-black/20 hover:bg-black/30 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                                >
                                    <X size={12} />
                                    <span>Huỷ</span>
                                </button>
                            </div>
                        )}

                        {/* Banner hướng dẫn khi đang chọn ô để Đổi chỗ (Click-to-Swap) */}
                        {clickSwapSource && (
                            <div className="mb-3 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl flex items-center justify-between text-xs font-bold shadow-md animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="flex items-center gap-2">
                                    <span className="p-1 bg-white/20 rounded-lg text-sm">⇄</span>
                                    <span>
                                        Đang chọn: <strong className="underline underline-offset-2">{clickSwapSource.productName}</strong> ({clickSwapSource.zoneCode}). 
                                        <span className="ml-1 opacity-90 font-normal">👉 Bấm vào bất kỳ ô nào khác trên sơ đồ để ĐỔI CHỖ ngay!</span>
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setClickSwapSource(null)}
                                    className="px-2.5 py-1 bg-black/20 hover:bg-black/30 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                                >
                                    <X size={12} />
                                    <span>Huỷ</span>
                                </button>
                            </div>
                        )}

                        {/* Khay Hàng Chờ Xếp Vị Trí (Inbound Staging Buffer Panel) */}
                        {(() => {
                            const layoutUnassignedLots = unassignedLots.filter(item => {
                                if (!item.warehouseName || !item.warehouseName.trim()) return true;
                                const target = item.warehouseName.trim().toLowerCase();
                                const lCode = (layout.code || '').trim().toLowerCase();
                                const lName = (layout.name || '').trim().toLowerCase();
                                return (lCode && target === lCode) || (lName && target === lName);
                            });

                            return (
                                <div className="mb-4 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent dark:from-amber-950/30 dark:via-orange-950/10 rounded-2xl border border-amber-200/80 dark:border-amber-900/50 p-3.5 shadow-sm">
                                    <div className="flex items-center justify-between gap-3 mb-1">
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-md shadow-amber-500/20">
                                                <Inbox size={18} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-300">
                                                        Khu vực Chờ Nhập Kho {layout.code ? `(${layout.code})` : ''}
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-500 text-white shadow-2xs">
                                                        {layoutUnassignedLots.length} lô chờ
                                                    </span>
                                                    {loadingUnassignedLots && (
                                                        <span className="text-[11px] text-amber-600 animate-pulse">Đang tải...</span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                                                    Kéo thẻ hàng thả vào sơ đồ hoặc bấm &quot;Xếp vào ô&quot; để định vị trí
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            {onRefreshUnassignedLots && (
                                                <button
                                                    type="button"
                                                    onClick={onRefreshUnassignedLots}
                                                    className="p-1.5 hover:bg-amber-100 dark:hover:bg-amber-950/60 text-amber-700 dark:text-amber-400 rounded-lg transition-colors"
                                                    title="Làm mới danh sách chờ"
                                                >
                                                    <RefreshCw size={13} className={loadingUnassignedLots ? 'animate-spin' : ''} />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setIsStagingExpanded(prev => !prev)}
                                                className="px-2.5 py-1 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/60 rounded-xl transition-all flex items-center gap-1"
                                            >
                                                <span>{isStagingExpanded ? 'Thu gọn' : 'Mở rộng'}</span>
                                                {isStagingExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </button>
                                        </div>
                                    </div>

                                    {isStagingExpanded && (
                                        <div className="mt-2.5">
                                            {layoutUnassignedLots.length === 0 ? (
                                                <div className="py-4 px-4 bg-white/80 dark:bg-zinc-900/80 rounded-xl border border-dashed border-amber-300/60 dark:border-amber-800/40 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
                                                    <Sparkles size={15} className="text-amber-500" />
                                                    <span>Tất cả các lô hàng của kho {layout.code || layout.name} đã được xếp vào vị trí đầy đủ! 🎉</span>
                                                </div>
                                            ) : (
                                                <div className="flex gap-2.5 overflow-x-auto pb-1.5 pt-0.5 custom-scrollbar">
                                                    {layoutUnassignedLots.map((item) => {
                                                        const isSelected = selectedStagingLot?.lotId === item.lotId;
                                                        const dateStr = formatShortDate(item.inboundDate);
                                                        const tagOrBatch = item.tag ? `🏷️ ${item.tag}` : (item.batchCode ? `Lô ${item.batchCode}` : item.lotCode);

                                                        return (
                                                            <div
                                                                key={item.lotId}
                                                                onPointerDown={(e) => handleStagingPointerDown(e, item)}
                                                                className={`shrink-0 w-64 p-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing shadow-xs ${
                                                                    isSelected
                                                                        ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-400'
                                                                        : 'bg-white dark:bg-zinc-850 hover:bg-amber-50/50 dark:hover:bg-zinc-800 border-stone-200 dark:border-zinc-700 hover:border-amber-400'
                                                                }`}
                                                            >
                                                                <div className="flex items-center justify-between gap-1 mb-1.5">
                                                                    <span className={`text-[11px] font-mono font-black px-1.5 py-0.5 rounded ${
                                                                        isSelected ? 'bg-white/20 text-white' : 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300'
                                                                    }`}>
                                                                        {tagOrBatch}
                                                                    </span>
                                                                    {dateStr && (
                                                                        <span className={`text-[10px] font-medium ${isSelected ? 'text-amber-100' : 'text-stone-400'}`}>
                                                                            📅 {dateStr}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <div className={`text-xs font-bold truncate mb-2 ${isSelected ? 'text-white' : 'text-stone-900 dark:text-white'}`} title={item.productName}>
                                                                    {item.productName}
                                                                </div>

                                                                <div className="flex items-center justify-between gap-1">
                                                                    <span className={`text-xs font-black ${isSelected ? 'text-amber-100' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                                        {item.quantity.toLocaleString()} {item.unit}
                                                                    </span>

                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (isSelected) {
                                                                                setSelectedStagingLot(null);
                                                                            } else {
                                                                                setSelectedStagingLot(item);
                                                                                setClickSwapSource(null);
                                                                            }
                                                                        }}
                                                                        className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 shadow-2xs ${
                                                                            isSelected
                                                                                ? 'bg-white text-amber-900 hover:bg-amber-100'
                                                                                : 'bg-amber-600 hover:bg-amber-700 text-white'
                                                                        }`}
                                                                    >
                                                                        <span>{isSelected ? 'Đang chọn' : 'Xếp vào ô'}</span>
                                                                        <MoveRight size={11} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        <div ref={containerRef} className="overflow-auto border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-zinc-950 p-2 scroll-smooth flex justify-center">
                            <svg
                                width={isFitMap[layout.id] !== false ? "100%" : Math.round(layout.width * (zoomMap[layout.id] || 1))}
                                height={isFitMap[layout.id] !== false ? "auto" : Math.round(layout.height * (zoomMap[layout.id] || 1))}
                                viewBox={`0 0 ${layout.width} ${layout.height}`}
                                className={`select-none transition-all duration-150 ${isFitMap[layout.id] !== false ? 'w-full h-auto' : ''}`}
                                style={isFitMap[layout.id] !== false ? { maxWidth: '100%', aspectRatio: `${layout.width}/${layout.height}` } : { minHeight: 300 }}
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
                                            case 'ZONE': return { icon: '', text: 'KHU VỰC' };
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
                                    
                                    const isStorageLocation = isEligibleStorageType && shape.isStorage !== false;
                                    const zoneLots = isStorageLocation ? getZoneLots(shape) : [];
                                    const hasLots = zoneLots.length > 0;

                                    // Logic đối với Vị trí Lưu trữ / Chứa hàng (Bãi ZONE hoặc mọi hình khối hạ tầng được gán mã)
                                    if (isStorageLocation) {
                                        const typeInfo = getShapeTypeInfo(shape.type);
                                        const totalQty = zoneLots.reduce((sum, item) => sum + (item.quantity || 0), 0);
                                        const isMulti = shape.isMultiLot !== false || zoneLots.length > 1;

                                        // Fallback position thông thường nếu chỉ có 1 position
                                        const shapeLookupCode = (shape.code && shape.code.trim().toUpperCase()) || (shape.label && shape.label.trim().toUpperCase());
                                        const singlePos = positions.find(p => (p.code || '').trim().toUpperCase() === shapeLookupCode);
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
                                            if (justFinishedDragRef.current) return;
                                            if (selectedStagingLot) {
                                                if (onAssignStagingLotToZoneShape) {
                                                    onAssignStagingLotToZoneShape(selectedStagingLot.lotId, shape);
                                                }
                                                setSelectedStagingLot(null);
                                                return;
                                            }
                                            if (clickSwapSource) {
                                                const srcPosId = clickSwapSource.posId;
                                                setClickSwapSource(null);
                                                handleExecuteMoveToShape(srcPosId, shape);
                                                return;
                                            }
                                            if (isBulkSelectionActive && onPositionSelect && singlePos?.id) {
                                                onPositionSelect(singlePos.id);
                                            } else if (isAssignmentMode && onPositionClick && singlePos) {
                                                onPositionClick(singlePos);
                                            } else {
                                                setActiveMultiLot({ shape, lots: zoneLots, allZoneLots: zoneLots });
                                            }
                                        };

                                        const isMultiSplit = zoneLots.length > 1;
                                        const isHorizontal = shape.splitOrientation === 'vertical' 
                                            ? false 
                                            : (shape.splitOrientation === 'horizontal' ? true : sw >= sh);
                                        const splitCount = zoneLots.length;
                                        const zoneLabel = shape.label || shape.code || '';
                                        const showVerticalStrip = Boolean(zoneLabel || shape.type !== 'ZONE') && sw >= 36 && sh >= 20;
                                        const stripW = showVerticalStrip ? Math.min(18, Math.max(14, Math.floor(sw * 0.12))) : 0;
                                        const contentX = sx + stripW;
                                        const contentW = sw - stripW;

                                        const isThisShapeHovered = dragOverShape?.shapeId === shape.id;

                                        return (
                                            <g 
                                                key={shape.id} 
                                                data-role="zone-shape"
                                                data-shape-id={shape.id}
                                                data-shape-label={shape.label || shape.code || ''}
                                                transform={rotTransform} 
                                                onClick={handleClick} 
                                                className="cursor-pointer group"
                                            >
                                                {/* Vùng hào quang loé sáng / Radar ping khi khớp tìm kiếm */}
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

                                                {/* Vùng phát sáng khi đang kéo LOT thả vào Zone này */}
                                                {isThisShapeHovered && (
                                                    <g className="pointer-events-none">
                                                        <rect 
                                                            x={sx - 3} y={sy - 3} width={sw + 6} height={sh + 6}
                                                            rx={(shape.rx || 6) + 3}
                                                            fill="rgba(59, 130, 246, 0.22)"
                                                            stroke="#2563eb"
                                                            strokeWidth={3.5}
                                                            strokeDasharray="6 3"
                                                            className="animate-pulse"
                                                        />
                                                        <g transform={`translate(${cx}, ${sy - 15})`} className="animate-bounce">
                                                            <rect x={-65} y={-11} width={130} height={22} rx={11} fill="#2563eb" stroke="#ffffff" strokeWidth={1.5} />
                                                            <text x={0} y={3.5} textAnchor="middle" fontSize={10} fontWeight="900" fill="#ffffff">
                                                                📦 THẢ VÀO KHU NÀY
                                                            </text>
                                                        </g>
                                                    </g>
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

                                                {/* Dải tên Zone theo mép chiều cao (Vertical Ribbon on left edge) */}
                                                {showVerticalStrip && (
                                                    <g className="select-none pointer-events-none">
                                                        <rect 
                                                            x={sx + 1.5} 
                                                            y={sy + 1.5} 
                                                            width={stripW - 1.5} 
                                                            height={sh - 3} 
                                                            rx={Math.min(shape.rx || 3, 3)} 
                                                            fill={shape.type === 'ZONE' ? (hasLots ? '#c2410c' : '#475569') : defStroke}
                                                            fillOpacity={0.92} 
                                                        />
                                                        <text 
                                                            x={sx + stripW / 2} 
                                                            y={sy + sh / 2} 
                                                            textAnchor="middle" 
                                                            dominantBaseline="central" 
                                                            transform={`rotate(-90, ${sx + stripW / 2}, ${sy + sh / 2})`}
                                                            fontSize={Math.min(10, stripW * 0.72, Math.max(7.5, (sh - 6) / Math.max(zoneLabel.length || 1, 1) * 1.5))} 
                                                            fontWeight="900" 
                                                            fill="#ffffff"
                                                            letterSpacing="0.5px"
                                                        >
                                                            <title>{`Khu vực: ${zoneLabel || typeInfo.text}`}</title>
                                                            {shape.type !== 'ZONE' ? `${typeInfo.icon} ${zoneLabel || typeInfo.text}` : zoneLabel}
                                                        </text>
                                                    </g>
                                                )}

                                                {/* TRƯỜNG HỢP 1: CÓ TỪ 2 LOT TRỞ LÊN -> TỰ ĐỘNG CHIA KHU VỰC THÀNH CÁC Ô NHỎ VỚI ĐƯỜNG KẺ MỜ */}
                                                {isMultiSplit ? (
                                                    <g>
                                                        {/* Các đường kẻ mờ phân cách giữa các ô con */}
                                                        {Array.from({ length: splitCount - 1 }).map((_, idx) => {
                                                            if (isHorizontal) {
                                                                 const lineX = contentX + (idx + 1) * (contentW / splitCount);
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
                                                                        x1={contentX + 3} y1={lineY}
                                                                        x2={contentX + contentW - 3} y2={lineY}
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
                                                            const cellW = isHorizontal ? contentW / splitCount : contentW;
                                                            const cellH = isHorizontal ? sh : sh / splitCount;
                                                            const cellX = isHorizontal ? contentX + idx * cellW : contentX;
                                                            const cellY = isHorizontal ? sy : sy + idx * cellH;
                                                            const subCx = cellX + cellW / 2;
                                                            const subCy = cellY + cellH / 2;
                                                            const lotLabel = item.position?.code || item.lotCode;
                                                            const isCellSelected = Boolean(item.position?.id && selectedPositionIds?.has(item.position.id));
                                                            const isCellMatch = isLotMatched(item);
                                                            const isThisCellDragging = pointerDrag?.isDragging && pointerDrag.sourceItem?.position?.id === item.position?.id;
                                                            const isThisCellHovered = dragOverCell?.posId === item.position?.id;
                                                            const isThisClickSwapSource = clickSwapSource?.posId === item.position?.id;

                                                            return (
                                                                <g 
                                                                    key={item.lotId || idx}
                                                                    data-role="lot-cell"
                                                                    data-pos-id={item.position?.id}
                                                                    data-shape-id={shape.id}
                                                                    data-prod-name={item.productName || ''}
                                                                    opacity={isSearching && !isCellMatch ? 0.35 : (isThisCellDragging ? 0.45 : 1)}
                                                                    onPointerDown={(e) => handleCellPointerDown(e, item, shape)}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (justFinishedDragRef.current) return;

                                                                        // Nếu đang chọn Lô từ Khay Chờ để xếp vị trí:
                                                                        if (selectedStagingLot) {
                                                                            if (onAssignStagingLotToPosition && item.position?.id) {
                                                                                onAssignStagingLotToPosition(selectedStagingLot.lotId, item.position.id);
                                                                            } else if (onAssignStagingLotToZoneShape) {
                                                                                onAssignStagingLotToZoneShape(selectedStagingLot.lotId, shape);
                                                                            }
                                                                            setSelectedStagingLot(null);
                                                                            return;
                                                                        }

                                                                        // Nếu đang trong chế độ Đổi chỗ Click-to-Swap:
                                                                        if (clickSwapSource) {
                                                                            if (clickSwapSource.posId === item.position?.id) {
                                                                                setClickSwapSource(null);
                                                                                return;
                                                                            }
                                                                            const srcId = clickSwapSource.posId;
                                                                            const tgtId = item.position?.id;
                                                                            setClickSwapSource(null);
                                                                            if (srcId && tgtId) {
                                                                                handleExecuteSwap(srcId, tgtId);
                                                                            }
                                                                            return;
                                                                        }

                                                                        if (isSwapModeActive && item.position?.id) {
                                                                            setClickSwapSource({
                                                                                posId: item.position.id,
                                                                                lotId: item.lotId,
                                                                                productName: item.productName || item.position.code || 'Lô hàng',
                                                                                zoneCode: shape.label || shape.code || ''
                                                                            });
                                                                            return;
                                                                        }

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
                                                                    className={`group/cell cursor-pointer ${pointerDrag?.isDragging ? 'cursor-grabbing' : (isSwapModeActive ? 'cursor-alias' : 'cursor-grab')}`}
                                                                >
                                                                    {/* Vùng cảm ứng hover sáng nhẹ hoặc viền chọn / loé sáng tìm kiếm */}
                                                                    <rect 
                                                                        x={cellX + 2} y={cellY + 2}
                                                                        width={cellW - 4} height={cellH - 4}
                                                                        fill={
                                                                            isThisClickSwapSource
                                                                                ? 'rgba(245, 158, 11, 0.4)'
                                                                                : (isThisCellHovered 
                                                                                    ? (dragOverCell?.isSameZone ? 'rgba(245, 158, 11, 0.35)' : 'rgba(16, 185, 129, 0.35)')
                                                                                    : (isCellSelected ? 'rgba(59, 130, 246, 0.25)' : (isCellMatch ? 'rgba(16, 185, 129, 0.35)' : 'transparent')))
                                                                        }
                                                                        stroke={
                                                                            isThisClickSwapSource
                                                                                ? '#f59e0b'
                                                                                : (isThisCellHovered
                                                                                    ? (dragOverCell?.isSameZone ? '#f59e0b' : '#10b981')
                                                                                    : (isCellSelected ? '#2563eb' : (isCellMatch ? '#059669' : (isThisCellDragging ? '#ea580c' : 'none'))))
                                                                        }
                                                                         strokeWidth={isThisClickSwapSource ? 3 : (isThisCellHovered ? 3 : (isCellMatch ? 2.5 : 2))}
                                                                        strokeDasharray={isThisClickSwapSource ? '4 2' : (isThisCellHovered ? '4 2' : (isThisCellDragging ? '3 3' : undefined))}
                                                                        rx={4}
                                                                        className={isThisClickSwapSource ? 'animate-pulse' : (isCellMatch ? 'animate-pulse' : 'transition-colors group-hover/cell:fill-orange-400/20')}
                                                                    />

                                                                    {/* Floating badge khi kéo đè lên ô này để hoán đổi */}
                                                                    {isThisCellHovered && (
                                                                        <g transform={`translate(${subCx}, ${subCy})`} className="pointer-events-none animate-bounce">
                                                                            <rect 
                                                                                x={-50} y={-11} width={100} height={22} rx={11} 
                                                                                fill={dragOverCell?.isSameZone ? '#d97706' : '#059669'} 
                                                                                stroke="#ffffff" strokeWidth={1.5} 
                                                                            />
                                                                            <text x={0} y={3.5} textAnchor="middle" fontSize={9.5} fontWeight="900" fill="#ffffff">
                                                                                {dragOverCell?.isSameZone ? '⇄ ĐỔI THỨ TỰ' : '⇄ HOÁN ĐỔI'}
                                                                            </text>
                                                                        </g>
                                                                    )}

                                                                    {/* Badge nhỏ "KHỚP" khi ô con này khớp tìm kiếm */}
                                                                    {isCellMatch && (
                                                                        <g transform={`translate(${subCx}, ${cellY + 8})`}>
                                                                            <rect x={-18} y={-6} width={36} height={12} rx={3} fill="#059669" />
                                                                            <text x={0} y={2.5} textAnchor="middle" fontSize={7.5} fontWeight="900" fill="#ffffff">
                                                                                KHỚP
                                                                            </text>
                                                                        </g>
                                                                    )}

                                                                    {/* 3 Tầng thông tin: Mã Tag/Lô SX + Ngày nhập -> Tên sản phẩm -> Badge Số lượng */}
                                                                    {(() => {
                                                                        const hasProd = Boolean(item.productName && item.productName.trim() !== '');
                                                                        const show3Rows = hasProd && cellH >= 38;
                                                                        const labelY = show3Rows ? subCy - Math.min(13, cellH * 0.25) : subCy - 9;
                                                                        const badgeY = show3Rows ? subCy + Math.min(13, cellH * 0.27) : subCy + 10;
                                                                        
                                                                        // Header hiển thị: Ưu tiên Mã Tag, sau đó Số Batch / Lô SX, kèm Ngày nhập kho
                                                                        const dateStr = formatShortDate(item.inboundDate);
                                                                        const tagOrBatch = item.tag ? `🏷️ ${item.tag}` : (item.batchCode ? `Lô ${item.batchCode}` : '');
                                                                        
                                                                        let headerText = '';
                                                                        if (tagOrBatch && dateStr) {
                                                                            headerText = `${tagOrBatch} • ${dateStr}`;
                                                                        } else if (tagOrBatch) {
                                                                            headerText = tagOrBatch;
                                                                        } else if (dateStr) {
                                                                            headerText = `📅 ${dateStr}`;
                                                                        } else {
                                                                            // Fallback vị trí nếu hoàn toàn không có tag/batch/date
                                                                            headerText = lotLabel;
                                                                        }

                                                                        const maxHeaderChars = Math.max(6, Math.floor((cellW - 6) / 5.5));
                                                                        const truncatedHeader = headerText.length > maxHeaderChars 
                                                                            ? headerText.slice(0, maxHeaderChars - 1) + '…' 
                                                                            : headerText;

                                                                        const maxProdChars = Math.max(6, Math.floor((cellW - 8) / 6.2));
                                                                        const truncatedProd = item.productName && item.productName.length > maxProdChars 
                                                                            ? item.productName.slice(0, maxProdChars - 1) + '…' 
                                                                            : item.productName;

                                                                        return (
                                                                            <>
                                                                                {/* Dòng 1: Mã Tag / Batch & Ngày nhập kho (thay thế mã vị trí cứng K1.01) */}
                                                                                <text 
                                                                                    x={subCx} 
                                                                                    y={labelY} 
                                                                                    textAnchor="middle" 
                                                                                    dominantBaseline="central"
                                                                                    fontSize={Math.min(10.5, cellW / (truncatedHeader.length || 1) * 1.35, cellH * 0.25)}
                                                                                    fontWeight="bold" 
                                                                                    fill={isCellMatch ? '#065f46' : '#0f172a'}
                                                                                    className="select-none pointer-events-none"
                                                                                >
                                                                                    <title>{`Vị trí: ${lotLabel}\nTag / Tem: ${item.tag || 'Chưa gắn'}\nLô SX: ${item.batchCode || 'Không'}\nNgày nhập kho: ${formatFullDate(item.inboundDate) || 'Chưa rõ'}\nSản phẩm: ${item.productName}\nSố lượng: ${item.quantity.toLocaleString()} ${item.unit || ''}`}</title>
                                                                                    {truncatedHeader}
                                                                                </text>

                                                                                {/* Dòng 2: Tên sản phẩm ở giữa */}
                                                                                {show3Rows && (
                                                                                    <text 
                                                                                        x={subCx} 
                                                                                        y={subCy} 
                                                                                        textAnchor="middle" 
                                                                                        dominantBaseline="central"
                                                                                        fontSize={Math.min(9.5, Math.max(7.5, cellH * 0.2))}
                                                                                        fontWeight="600" 
                                                                                        fill={isCellMatch ? '#047857' : '#1d4ed8'}
                                                                                        className="select-none pointer-events-none"
                                                                                    >
                                                                                        <title>{item.productName}{item.sku ? ` (${item.sku})` : ''}</title>
                                                                                        {truncatedProd}
                                                                                    </text>
                                                                                )}

                                                                                {/* Dòng 3: Badge số lượng của Lô */}
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

                                                    </g>
                                                ) : (
                                                    /* TRƯỜNG HỢP 2: 1 LOT HOẶC TRỐNG -> HIỂN THỊ NGUYÊN BẢN CẢ KHU VỰC */
                                                    <g
                                                        data-role={hasLots ? "lot-cell" : "empty-shape"}
                                                        data-pos-id={zoneLots[0]?.position?.id}
                                                        data-shape-id={shape.id}
                                                        data-prod-name={zoneLots[0]?.productName || ''}
                                                        onPointerDown={(e) => {
                                                            if (hasLots && zoneLots[0]) {
                                                                handleCellPointerDown(e, zoneLots[0], shape);
                                                            }
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (justFinishedDragRef.current) return;
                                                            const first = zoneLots[0];

                                                            // Nếu đang chọn Lô từ Khay Chờ để xếp vị trí:
                                                            if (selectedStagingLot) {
                                                                if (isMulti) {
                                                                    if (onAssignStagingLotToZoneShape) {
                                                                        onAssignStagingLotToZoneShape(selectedStagingLot.lotId, shape);
                                                                    }
                                                                } else if (first?.position?.id && onAssignStagingLotToPosition) {
                                                                    onAssignStagingLotToPosition(selectedStagingLot.lotId, first.position.id);
                                                                } else if (onAssignStagingLotToZoneShape) {
                                                                    onAssignStagingLotToZoneShape(selectedStagingLot.lotId, shape);
                                                                }
                                                                setSelectedStagingLot(null);
                                                                return;
                                                            }

                                                            if (clickSwapSource && first?.position?.id) {
                                                                if (clickSwapSource.posId === first.position.id) {
                                                                    setClickSwapSource(null);
                                                                    return;
                                                                }
                                                                const srcId = clickSwapSource.posId;
                                                                const tgtId = first.position.id;
                                                                setClickSwapSource(null);
                                                                if (isMulti) {
                                                                    handleExecuteMoveToShape(srcId, shape);
                                                                } else {
                                                                    handleExecuteSwap(srcId, tgtId);
                                                                }
                                                                return;
                                                            }

                                                            if (isSwapModeActive && first?.position?.id) {
                                                                setClickSwapSource({
                                                                    posId: first.position.id,
                                                                    lotId: first.lotId,
                                                                    productName: first.productName || first.position.code || 'Lô hàng',
                                                                    zoneCode: shape.label || shape.code || ''
                                                                });
                                                                return;
                                                            }

                                                            handleClick();
                                                        }}
                                                        className={hasLots && !isBulkSelectionActive && !isAssignmentMode ? (pointerDrag?.isDragging ? 'cursor-grabbing' : (isSwapModeActive ? 'cursor-alias' : 'cursor-grab')) : ''}
                                                    >
                                                        {(() => {
                                                            const firstLot = zoneLots[0];
                                                            const hasProd = Boolean(hasLots && firstLot?.productName && firstLot.productName.trim() !== '');
                                                            const show3Rows = hasProd && sh >= 38;
                                                            const singleCx = contentX + contentW / 2;
                                                            const singleCy = sy + sh / 2;
                                                            const labelY = hasLots ? (show3Rows ? singleCy - Math.min(14, sh * 0.26) : singleCy - 8) : singleCy;
                                                            const badgeY = show3Rows ? singleCy + Math.min(14, sh * 0.28) : singleCy + 10;
                                                            
                                                            // Header hiển thị: Khi có hàng, ưu tiên Mã Tag, Số Batch, Ngày nhập kho
                                                            const dateStr = firstLot ? formatShortDate(firstLot.inboundDate) : '';
                                                            const tagOrBatch = firstLot?.tag ? `🏷️ ${firstLot.tag}` : (firstLot?.batchCode ? `Lô ${firstLot.batchCode}` : '');
                                                            
                                                            let headerText = !showVerticalStrip ? (shape.label || shape.code || '') : '';
                                                            if (hasLots) {
                                                                if (tagOrBatch && dateStr) {
                                                                    headerText = `${tagOrBatch} • ${dateStr}`;
                                                                } else if (tagOrBatch) {
                                                                    headerText = tagOrBatch;
                                                                } else if (dateStr) {
                                                                    headerText = `📅 ${dateStr}`;
                                                                }
                                                            }

                                                            const maxHeaderChars = Math.max(8, Math.floor((contentW - 12) / 6.0));
                                                            const truncatedHeader = headerText.length > maxHeaderChars 
                                                                ? headerText.slice(0, maxHeaderChars - 1) + '…' 
                                                                : headerText;

                                                            const maxZoneChars = Math.max(8, Math.floor((contentW - 12) / 6.2));
                                                            const truncatedProd = firstLot?.productName && firstLot.productName.length > maxZoneChars 
                                                                ? firstLot.productName.slice(0, maxZoneChars - 1) + '…' 
                                                                : firstLot?.productName;

                                                            return (
                                                                <>
                                                                    {/* Header Dòng 1: Tag / Batch / Ngày nhập (khi có hàng) hoặc Tên khu vực (khi trống) */}
                                                                    {headerText && (
                                                                        <text 
                                                                            x={singleCx} y={labelY} 
                                                                            textAnchor="middle" dominantBaseline="central"
                                                                            fontSize={Math.min(12, contentW / (truncatedHeader.length || 1) * 1.4, sh * 0.28)}
                                                                            fontWeight="bold" 
                                                                            fill={isZoneMatched ? '#065f46' : '#1e293b'}
                                                                        >
                                                                            <title>{hasLots ? `Vị trí: ${shape.label || shape.code}\nTag / Tem: ${firstLot?.tag || 'Chưa gắn'}\nLô SX: ${firstLot?.batchCode || 'Không'}\nNgày nhập kho: ${formatFullDate(firstLot?.inboundDate) || 'Chưa rõ'}\nSản phẩm: ${firstLot?.productName}\nSố lượng: ${firstLot?.quantity?.toLocaleString()} ${firstLot?.unit || ''}` : (shape.label || shape.code)}</title>
                                                                            {truncatedHeader}
                                                                        </text>
                                                                    )}

                                                                    {/* Tên sản phẩm */}
                                                                    {show3Rows && (
                                                                        <text 
                                                                            x={singleCx} y={singleCy} 
                                                                            textAnchor="middle" dominantBaseline="central"
                                                                            fontSize={Math.min(10.5, contentW * 0.09, sh * 0.22)}
                                                                            fontWeight="600" 
                                                                            fill={isZoneMatched ? '#047857' : '#1d4ed8'}
                                                                            className="select-none pointer-events-none"
                                                                        >
                                                                            <title>{firstLot?.productName}{firstLot?.sku ? ` (${firstLot.sku})` : ''}</title>
                                                                            {truncatedProd}
                                                                        </text>
                                                                    )}

                                                                    {/* Thông tin tồn kho & số Lô */}
                                                                    {hasLots ? (
                                                                        <g transform={`translate(${singleCx}, ${badgeY})`}>
                                                                            <rect 
                                                                                x={-Math.min(48, contentW * 0.42)} 
                                                                                y={-9} 
                                                                                width={Math.min(96, contentW * 0.84)} 
                                                                                height={18} 
                                                                                rx={9} 
                                                                                fill={isZoneMatched ? '#059669' : '#ea580c'} 
                                                                            />
                                                                            <text x={0} y={4} textAnchor="middle" fontSize={Math.min(10, contentW * 0.1, sh * 0.22)} fontWeight="bold" fill="#ffffff">
                                                                                {firstLot?.quantity?.toLocaleString()} {firstLot?.unit || 'cái'}
                                                                            </text>
                                                                        </g>
                                                                    ) : (
                                                                        <text x={singleCx} y={headerText ? singleCy + 12 : singleCy} textAnchor="middle" fontSize={9} fill="#94a3b8" fontWeight="500">
                                                                            Trống
                                                                        </text>
                                                                    )}
                                                                </>
                                                            );
                                                        })()}
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

            {/* Floating Cursor Chip khi đang Pointer Drag & Drop */}
            {pointerDrag?.isDragging && (
                <div 
                    className={`fixed pointer-events-none z-[99999] px-3.5 py-1.5 ${pointerDrag.sourceItem?.isStaging ? 'bg-amber-600' : 'bg-orange-600'} text-white text-xs font-black rounded-xl shadow-2xl flex items-center gap-2 transform -translate-x-1/2 -translate-y-full border-2 border-white animate-in fade-in zoom-in duration-100`}
                    style={{ left: pointerDrag.currentX, top: pointerDrag.currentY - 10 }}
                >
                    <span className="text-base">{pointerDrag.sourceItem?.isStaging ? '📥' : '📦'}</span>
                    <div className="flex flex-col">
                        <span className="leading-tight">{pointerDrag.sourceItem?.productName || 'Lô hàng'}</span>
                        <span className="text-[10px] text-amber-100 font-normal">
                            {pointerDrag.sourceItem?.isStaging ? 'Thả vào ô hoặc bãi để XẾP VỊ TRÍ' : 'Thả vào ô hoặc bãi cần đổi'}
                        </span>
                    </div>
                </div>
            )}

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
                    onSwapLots={handleExecuteSwap}
                    onToggleOrientation={handleToggleOrientation}
                />
            )}
        </div>
    );
}
