'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { LayoutShape, ShapeType, WarehouseLayout, LayoutInput, isShapesFormat } from './types';
import { useToast } from '@/components/ui/ToastProvider';
import { 
    Save, X, MousePointer, Square, Minus, MoveRight, DoorOpen, Trash2, 
    ZoomIn, ZoomOut, Grid3X3, Box, Circle, RotateCw, Tag, Copy, Undo2, 
    Redo2, Lock, Unlock, ArrowUp, ArrowDown, Scale, Flame, AlertTriangle, 
    Layers, Sparkles, Check, ChevronRight, Sliders, Palette, Truck, 
    CheckCircle2, BatteryCharging, HeartPulse, ArrowRight, Type, Ruler
} from 'lucide-react';
import { layoutService } from '@/services/warehouse/layoutService';
import { useSystem } from '@/contexts/SystemContext';
import { useUser } from '@/contexts/UserContext';

interface LayoutEditorProps {
    layout?: WarehouseLayout;
    onClose: () => void;
    onSaveSuccess: () => void;
}

const GRID = 20;
const MIN_SIZE = GRID * 2;

const LineIcon = (props: any) => (
    <svg width={props.size || 16} height={props.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" {...props}>
        <line x1="3" y1="21" x2="21" y2="3" />
    </svg>
);

const DashedLineIcon = (props: any) => (
    <svg width={props.size || 16} height={props.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeDasharray="4 4" {...props}>
        <line x1="3" y1="21" x2="21" y2="3" />
    </svg>
);

type ToolId = 'SELECT' | ShapeType;

// Danh mục công cụ chuyên nghiệp phân theo nhóm kiến trúc & vận hành kho
const TOOL_GROUPS: {
    name: string;
    tools: { id: ToolId; label: string; icon: React.ComponentType<any> }[];
}[] = [
    {
        name: 'Thao tác & Ký hiệu',
        tools: [
            { id: 'SELECT', label: 'Chọn / Di chuyển', icon: MousePointer },
            { id: 'LINE', label: 'Đường thẳng (Vạch liền)', icon: LineIcon },
            { id: 'DASHED_LINE', label: 'Đường nét đứt (Vạch đứt)', icon: DashedLineIcon },
            { id: 'ARROW', label: 'Mũi tên luồng di chuyển', icon: ArrowRight },
            { id: 'TEXT_NOTE', label: 'Văn bản / Ghi chú', icon: Type },
        ]
    },
    {
        name: 'Khu vực lưu trữ',
        tools: [
            { id: 'ZONE', label: 'Bãi chứa hàng (Đa Lô)', icon: Square },
            { id: 'RACK', label: 'Kệ hàng (Chia ô)', icon: Grid3X3 },
            { id: 'STAGING', label: 'Khu tập kết / Đệm hàng', icon: Layers },
            { id: 'QC_AREA', label: 'Khu kiểm hàng (KCS)', icon: CheckCircle2 },
            { id: 'SCRAP', label: 'Khu phế phẩm / Hàng lỗi', icon: AlertTriangle },
            { id: 'ROOM', label: 'Phòng / Kho biệt lập', icon: Box },
        ]
    },
    {
        name: 'Kiến trúc & Ngăn cách',
        tools: [
            { id: 'WALL', label: 'Tường chịu lực', icon: Minus },
            { id: 'PARTITION', label: 'Vách ngăn / Panel', icon: Minus },
            { id: 'FENCE', label: 'Hàng rào / Lan can', icon: Grid3X3 },
            { id: 'DOOR', label: 'Cửa đi / Cửa cuốn', icon: DoorOpen },
            { id: 'DOCK', label: 'Cửa xuất nhập (Dock xe tải)', icon: Truck },
            { id: 'PILLAR', label: 'Cột trụ nhà xưởng', icon: Circle },
            { id: 'STAIRS', label: 'Cầu thang bộ', icon: MoveRight },
            { id: 'PATH', label: 'Lối đi / Hành lang', icon: MoveRight },
        ]
    },
    {
        name: 'Bàn thao tác & Thiết bị',
        tools: [
            { id: 'DESK', label: 'Bàn làm việc / Thủ kho', icon: Box },
            { id: 'PACK_STATION', label: 'Trạm đóng gói / Máy dán', icon: Sparkles },
            { id: 'SCALE', label: 'Trạm cân điện tử', icon: Scale },
            { id: 'FORKLIFT_PARK', label: 'Bãi đỗ / Sạc xe nâng', icon: BatteryCharging },
        ]
    },
    {
        name: 'An toàn lao động & PCCC',
        tools: [
            { id: 'FIRE_EXT', label: 'Bình PCCC / An toàn', icon: Flame },
            { id: 'FIRST_AID', label: 'Tủ y tế / Sơ cứu', icon: HeartPulse },
        ]
    }
];

const SHAPE_DEFAULTS: Record<ShapeType, { fill: string; stroke: string; label: string }> = {
    ZONE: { fill: '#fed7aa', stroke: '#ea580c', label: 'Khu vực' },
    RACK: { fill: '#fef3c7', stroke: '#d97706', label: 'Kệ hàng' },
    ROOM: { fill: '#ede9fe', stroke: '#7c3aed', label: 'Phòng' },
    WALL: { fill: '#475569', stroke: '#1e293b', label: 'Tường' },
    PARTITION: { fill: '#cbd5e1', stroke: '#64748b', label: 'Vách ngăn' },
    FENCE: { fill: '#f1f5f9', stroke: '#64748b', label: 'Hàng rào' },
    PATH: { fill: '#dbeafe', stroke: '#93c5fd', label: 'Lối đi' },
    DOOR: { fill: '#bbf7d0', stroke: '#16a34a', label: 'Cửa' },
    DOCK: { fill: '#e0e7ff', stroke: '#4338ca', label: 'Cửa Dock xe tải' },
    PILLAR: { fill: '#94a3b8', stroke: '#475569', label: 'Cột' },
    DESK: { fill: '#e0f2fe', stroke: '#0284c7', label: 'Bàn kiểm' },
    PACK_STATION: { fill: '#fef08a', stroke: '#ca8a04', label: 'Đóng gói' },
    SCALE: { fill: '#ccfbf1', stroke: '#0d9488', label: 'Trạm cân' },
    STAGING: { fill: '#fef9c3', stroke: '#eab308', label: 'Khu tập kết' },
    QC_AREA: { fill: '#d1fae5', stroke: '#059669', label: 'KCS / Kiểm hàng' },
    SCRAP: { fill: '#fee2e2', stroke: '#dc2626', label: 'Phế phẩm' },
    FORKLIFT_PARK: { fill: '#fef3c7', stroke: '#d97706', label: 'Đỗ xe nâng' },
    STAIRS: { fill: '#f1f5f9', stroke: '#475569', label: 'Cầu thang' },
    FIRE_EXT: { fill: '#fee2e2', stroke: '#ef4444', label: 'PCCC' },
    FIRST_AID: { fill: '#dcfce7', stroke: '#16a34a', label: 'Tủ y tế' },
    ARROW: { fill: '#3b82f6', stroke: '#1d4ed8', label: 'Hướng đi' },
    LINE: { fill: 'transparent', stroke: '#2563eb', label: 'Đường thẳng' },
    DASHED_LINE: { fill: 'transparent', stroke: '#eab308', label: 'Đường nét đứt' },
    TEXT_NOTE: { fill: 'transparent', stroke: 'transparent', label: 'Ghi chú' },
};

const COLOR_PRESETS = [
    { fill: '#fed7aa', stroke: '#ea580c', name: 'Cam (Thùng carton)' },
    { fill: '#dbeafe', stroke: '#2563eb', name: 'Xanh dương (Túi PA / Nilon)' },
    { fill: '#bbf7d0', stroke: '#16a34a', name: 'Xanh lá (Vật tư sạch)' },
    { fill: '#fef08a', stroke: '#ca8a04', name: 'Vàng (Đệm hàng)' },
    { fill: '#fee2e2', stroke: '#dc2626', name: 'Đỏ (Hàng lỗi / Phế)' },
    { fill: '#ede9fe', stroke: '#7c3aed', name: 'Tím (Khu biệt lập)' },
    { fill: '#f1f5f9', stroke: '#64748b', name: 'Xám (Hạ tầng)' },
];

const snap = (v: number) => Math.round(v / GRID) * GRID;

function initShapes(layout?: WarehouseLayout): LayoutShape[] {
    if (!layout?.grid_data?.length) return [];
    if (isShapesFormat(layout.grid_data)) return layout.grid_data;
    return [];
}

export default function LayoutEditor({ layout, onClose, onSaveSuccess }: LayoutEditorProps) {
    const { systemType } = useSystem();
    const { profile } = useUser();
    const { showToast } = useToast();
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [name, setName] = useState(layout?.name || 'Sơ đồ mới');
    const [canvasW, setCanvasW] = useState(layout?.width || 1400);
    const [canvasH, setCanvasH] = useState(layout?.height || 900);
    const [activeTool, setActiveTool] = useState<ToolId>('ZONE');
    const [shapes, setShapes] = useState<LayoutShape[]>(() => initShapes(layout));
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [zoom, setZoom] = useState(() => {
        const w = layout?.width || 1400;
        if (w >= 2000) return 0.45;
        if (w >= 1600) return 0.6;
        if (w >= 1200) return 0.8;
        return 1.0;
    });

    // Spacebar Pan / Drag State (Photoshop / Figma style)
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);

    // Inspector Panel State (chỉ mở khi bấm 'Thuộc tính' hoặc nhấp đúp, không tự ý đẩy lệch màn hình)
    const [showInspector, setShowInspector] = useState(false);

    // Ruler State & Cursor Coordinate Tracking
    const [showRulers, setShowRulers] = useState(true);
    const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

    // Generate ruler tick marks: 20px = 1 mét (CAD scale)
    const xTicks = useMemo(() => {
        const ticks: { pos: number; isMajor: boolean; label?: string }[] = [];
        for (let x = 0; x <= canvasW; x += 20) {
            const isMajor = x % 100 === 0;
            ticks.push({
                pos: x,
                isMajor,
                label: isMajor ? `${x / 20}m` : undefined,
            });
        }
        return ticks;
    }, [canvasW]);

    const yTicks = useMemo(() => {
        const ticks: { pos: number; isMajor: boolean; label?: string }[] = [];
        for (let y = 0; y <= canvasH; y += 20) {
            const isMajor = y % 100 === 0;
            ticks.push({
                pos: y,
                isMajor,
                label: isMajor ? `${y / 20}m` : undefined,
            });
        }
        return ticks;
    }, [canvasH]);

    const handleFitToScreen = useCallback(() => {
        if (!containerRef.current) return;
        const { clientWidth, clientHeight } = containerRef.current;
        const padding = 48; // p-6
        const targetW = clientWidth - padding;
        const targetH = clientHeight - padding;
        if (targetW <= 0 || targetH <= 0) return;
        const fitScale = Math.min(targetW / canvasW, targetH / canvasH);
        const clamped = Math.min(2.0, Math.max(0.2, Number((fitScale * 0.95).toFixed(2))));
        setZoom(clamped);
    }, [canvasW, canvasH]);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.deltaY < 0) {
                setZoom(z => Math.min(2.5, Number((z + 0.05).toFixed(2))));
            } else {
                setZoom(z => Math.max(0.2, Number((z - 0.05).toFixed(2))));
            }
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            handleFitToScreen();
        }, 60);
        return () => clearTimeout(timer);
    }, [handleFitToScreen]);

    // History stack cho Undo / Redo
    const [history, setHistory] = useState<LayoutShape[][]>([initShapes(layout)]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const pushHistory = useCallback((newShapes: LayoutShape[]) => {
        setHistory(prev => {
            const next = prev.slice(0, historyIndex + 1);
            return [...next, newShapes];
        });
        setHistoryIndex(prev => prev + 1);
    }, [historyIndex]);

    const handleUndo = useCallback(() => {
        if (historyIndex > 0) {
            setHistoryIndex(prev => prev - 1);
            setShapes(history[historyIndex - 1]);
            setSelectedId(null);
        }
    }, [history, historyIndex]);

    const handleRedo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(prev => prev + 1);
            setShapes(history[historyIndex + 1]);
            setSelectedId(null);
        }
    }, [history, historyIndex]);

    // Drawing state
    const [drawPreview, setDrawPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
    const drawingRef = useRef(false);
    const drawStartRef = useRef({ x: 0, y: 0 });
    const drawEndRef = useRef({ x: 0, y: 0 });

    // Drag candidate (distinguishes single-click / double-click from intentional drag)
    const dragCandidateRef = useRef<{
        id: string;
        startClientX: number;
        startClientY: number;
        startSvgX: number;
        startSvgY: number;
        origX: number;
        origY: number;
        isLocked?: boolean;
    } | null>(null);

    // Active dragging / Resizing state
    const draggingRef = useRef<{ 
        id: string; 
        origX: number; 
        origY: number;
        startSvgX: number;
        startSvgY: number;
        isResize?: boolean;
        handle?: string;
        origW?: number;
        origH?: number;
    } | null>(null);
    const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number; w?: number; h?: number } | null>(null);

    // Popups
    const [rackPopup, setRackPopup] = useState<{ shapeId: string; prefix: string; rows: number; cols: number } | null>(null);

    const selectedShape = shapes.find(s => s.id === selectedId);

    // Update 1 shape helper
    const updateSelectedShape = useCallback((updater: Partial<LayoutShape>) => {
        if (!selectedId) return;
        setShapes(prev => {
            const next = prev.map(s => s.id === selectedId ? { ...s, ...updater } : s);
            pushHistory(next);
            return next;
        });
    }, [selectedId, pushHistory]);

    // Duplicate shape
    const handleDuplicate = useCallback(() => {
        if (!selectedShape) return;
        const newShape: LayoutShape = {
            ...selectedShape,
            id: crypto.randomUUID(),
            x: selectedShape.x + GRID * 2,
            y: selectedShape.y + GRID * 2,
            code: selectedShape.code ? `${selectedShape.code}-COPY` : undefined,
            label: selectedShape.label ? `${selectedShape.label} (Sao chép)` : undefined
        };
        const next = [...shapes, newShape];
        setShapes(next);
        setSelectedId(newShape.id);
        pushHistory(next);
        showToast('Đã nhân bản đối tượng', 'info');
    }, [selectedShape, shapes, pushHistory, showToast]);

    // Delete shape
    const handleDeleteSelected = useCallback(() => {
        if (!selectedId || selectedShape?.isLocked) return;
        const next = shapes.filter(s => s.id !== selectedId);
        setShapes(next);
        setSelectedId(null);
        pushHistory(next);
    }, [selectedId, selectedShape, shapes, pushHistory]);

    // Lock / Unlock All Shapes
    const handleToggleLockAll = useCallback(() => {
        const hasUnlocked = shapes.some(s => !s.isLocked);
        const next = shapes.map(s => ({ ...s, isLocked: hasUnlocked }));
        setShapes(next);
        pushHistory(next);
        showToast(hasUnlocked ? 'Đã khóa tất cả hình khối (tránh kéo/xóa nhầm)' : 'Đã mở khóa tất cả hình khối', 'info');
    }, [shapes, pushHistory, showToast]);

    // Layer ordering
    const handleBringToFront = useCallback(() => {
        if (!selectedId) return;
        const target = shapes.find(s => s.id === selectedId);
        if (!target) return;
        const next = [...shapes.filter(s => s.id !== selectedId), target];
        setShapes(next);
        pushHistory(next);
    }, [selectedId, shapes, pushHistory]);

    const handleSendToBack = useCallback(() => {
        if (!selectedId) return;
        const target = shapes.find(s => s.id === selectedId);
        if (!target) return;
        const next = [target, ...shapes.filter(s => s.id !== selectedId)];
        setShapes(next);
        pushHistory(next);
    }, [selectedId, shapes, pushHistory]);

    // Nudge (Phím mũi tên)
    const handleNudge = useCallback((dx: number, dy: number) => {
        if (!selectedId || selectedShape?.isLocked) return;
        setShapes(prev => {
            const next = prev.map(s => s.id === selectedId ? { ...s, x: Math.max(0, s.x + dx), y: Math.max(0, s.y + dy) } : s);
            pushHistory(next);
            return next;
        });
    }, [selectedId, selectedShape, pushHistory]);

    // Pan Mouse Handlers (Space + Drag or Middle Click)
    const handleContainerMouseDown = useCallback((e: React.MouseEvent) => {
        if (isSpacePressed || e.button === 1) {
            e.preventDefault();
            if (!containerRef.current) return;
            setIsPanning(true);
            panStartRef.current = {
                x: e.clientX,
                y: e.clientY,
                scrollLeft: containerRef.current.scrollLeft,
                scrollTop: containerRef.current.scrollTop
            };
        }
    }, [isSpacePressed]);

    useEffect(() => {
        if (!isPanning) return;
        const handleMouseMove = (e: MouseEvent) => {
            if (!panStartRef.current || !containerRef.current) return;
            const dx = e.clientX - panStartRef.current.x;
            const dy = e.clientY - panStartRef.current.y;
            containerRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
            containerRef.current.scrollTop = panStartRef.current.scrollTop - dy;
        };
        const handleMouseUp = () => {
            setIsPanning(false);
            panStartRef.current = null;
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isPanning]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') {
                return;
            }
            if (e.code === 'Space' && !e.repeat) {
                e.preventDefault();
                setIsSpacePressed(true);
                return;
            }
            if (e.key === 'Escape') {
                if (showInspector) {
                    e.preventDefault();
                    setShowInspector(false);
                    return;
                }
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedId && !selectedShape?.isLocked) {
                    e.preventDefault();
                    handleDeleteSelected();
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) handleRedo();
                else handleUndo();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                handleRedo();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                handleDuplicate();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
                e.preventDefault();
                if (selectedShape) {
                    const nextLocked = !selectedShape.isLocked;
                    updateSelectedShape({ isLocked: nextLocked });
                    showToast(nextLocked ? 'Đã khóa cố định hình khối' : 'Đã mở khóa hình khối', 'info');
                }
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault(); handleNudge(-GRID, 0);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault(); handleNudge(GRID, 0);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault(); handleNudge(0, -GRID);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault(); handleNudge(0, GRID);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                setIsSpacePressed(false);
                setIsPanning(false);
                panStartRef.current = null;
            }
        };

        const handleBlur = () => {
            setIsSpacePressed(false);
            setIsPanning(false);
            panStartRef.current = null;
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
        };
    }, [selectedId, selectedShape, showInspector, handleDeleteSelected, handleUndo, handleRedo, handleDuplicate, handleNudge]);

    const getSvgPoint = useCallback((e: React.MouseEvent | MouseEvent): { x: number; y: number } => {
        const svg = svgRef.current;
        if (!svg) return { x: 0, y: 0 };
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const ctm = svg.getScreenCTM();
        if (!ctm) return { x: 0, y: 0 };
        const p = pt.matrixTransform(ctm.inverse());
        return { x: p.x, y: p.y };
    }, []);

    // ---- Mouse Handlers ----
    const onMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (isSpacePressed || e.button === 1) {
            handleContainerMouseDown(e);
            return;
        }
        if (rackPopup) return;
        if (e.button !== 0) return;
        e.preventDefault();
        const pt = getSvgPoint(e);

        if (activeTool === 'SELECT') {
            const hit = [...shapes].reverse().find(s => {
                const sx = dragPos?.id === s.id ? dragPos.x : s.x;
                const sy = dragPos?.id === s.id ? dragPos.y : s.y;
                return pt.x >= sx && pt.x <= sx + s.width && pt.y >= sy && pt.y <= sy + s.height;
            });
            if (hit) {
                // Click to select - strictly selects without shifting position
                setSelectedId(hit.id);
                // Record pending drag intent (requires intentional movement > 5px to activate moving)
                dragCandidateRef.current = {
                    id: hit.id,
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    startSvgX: pt.x,
                    startSvgY: pt.y,
                    origX: hit.x,
                    origY: hit.y,
                    isLocked: hit.isLocked,
                };
            } else {
                setSelectedId(null);
                setShowInspector(false);
                dragCandidateRef.current = null;
            }
        } else if (activeTool === 'DOOR' || activeTool === 'PILLAR' || activeTool === 'FIRE_EXT') {
            const isPillar = activeTool === 'PILLAR';
            const isFire = activeTool === 'FIRE_EXT';
            const newShape: LayoutShape = {
                id: crypto.randomUUID(),
                type: activeTool,
                x: snap(pt.x),
                y: snap(pt.y),
                width: isPillar || isFire ? GRID * 2 : GRID * 3,
                height: isPillar || isFire ? GRID * 2 : GRID,
                rotation: 0,
                label: isFire ? 'PCCC' : isPillar ? 'Cột' : 'Cửa',
            };
            const next = [...shapes, newShape];
            setShapes(next);
            setSelectedId(newShape.id);
            pushHistory(next);
        } else {
            drawingRef.current = true;
            drawStartRef.current = { x: snap(pt.x), y: snap(pt.y) };
            drawEndRef.current = { x: snap(pt.x), y: snap(pt.y) };
            setDrawPreview({ x: snap(pt.x), y: snap(pt.y), w: 0, h: 0 });
        }
    }, [activeTool, shapes, rackPopup, getSvgPoint, dragPos, pushHistory, handleContainerMouseDown, isSpacePressed]);

    const onMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (isPanning || isSpacePressed) return;
        const pt = getSvgPoint(e);
        setCursorPos({ x: Math.round(pt.x), y: Math.round(pt.y) });

        if (drawingRef.current) {
            const sx = drawStartRef.current.x;
            const sy = drawStartRef.current.y;
            const curX = snap(pt.x);
            const curY = snap(pt.y);
            drawEndRef.current = { x: curX, y: curY };
            setDrawPreview({
                x: Math.min(sx, curX),
                y: Math.min(sy, curY),
                w: Math.abs(curX - sx),
                h: Math.abs(curY - sy),
            });
            return;
        }

        // Check if pending candidate exceeds movement threshold (> 5 screen pixels) to initiate drag
        if (dragCandidateRef.current && !draggingRef.current) {
            const cand = dragCandidateRef.current;
            if (!cand.isLocked) {
                const screenDist = Math.hypot(e.clientX - cand.startClientX, e.clientY - cand.startClientY);
                if (screenDist >= 5) {
                    draggingRef.current = {
                        id: cand.id,
                        origX: cand.origX,
                        origY: cand.origY,
                        startSvgX: cand.startSvgX,
                        startSvgY: cand.startSvgY,
                    };
                }
            }
        }

        if (draggingRef.current) {
            const d = draggingRef.current;
            if (d.isResize) {
                let nx = d.origX;
                let ny = d.origY;
                let nw = d.origW!;
                let nh = d.origH!;

                if (d.handle?.includes('e')) nw = snap(Math.max(MIN_SIZE, pt.x - nx));
                if (d.handle?.includes('s')) nh = snap(Math.max(MIN_SIZE, pt.y - ny));
                if (d.handle?.includes('w')) {
                    const newX = snap(Math.min(d.origX + d.origW! - MIN_SIZE, pt.x));
                    nw = d.origX + d.origW! - newX;
                    nx = newX;
                }
                if (d.handle?.includes('n')) {
                    const newY = snap(Math.min(d.origY + d.origH! - MIN_SIZE, pt.y));
                    nh = d.origY + d.origH! - newY;
                    ny = newY;
                }
                setDragPos({ id: d.id, x: nx, y: ny, w: nw, h: nh });
            } else {
                const dx = pt.x - d.startSvgX;
                const dy = pt.y - d.startSvgY;
                const newX = snap(Math.max(0, d.origX + dx));
                const newY = snap(Math.max(0, d.origY + dy));
                setDragPos({
                    id: d.id,
                    x: newX,
                    y: newY,
                });
            }
        }
    }, [isPanning, isSpacePressed, getSvgPoint]);

    const onMouseUp = useCallback(() => {
        if (drawingRef.current && drawPreview) {
            drawingRef.current = false;
            const isLineTool = activeTool === 'LINE' || activeTool === 'DASHED_LINE';
            let w = Math.max(drawPreview.w, MIN_SIZE);
            let h = Math.max(drawPreview.h, MIN_SIZE);
            let lineOrientation: 'horizontal' | 'vertical' | 'diagonal-down' | 'diagonal-up' | undefined = undefined;

            if (isLineTool) {
                const sx = drawStartRef.current.x;
                const sy = drawStartRef.current.y;
                const ex = drawEndRef.current.x;
                const ey = drawEndRef.current.y;
                const dx = ex - sx;
                const dy = ey - sy;

                if (drawPreview.w === 0 && drawPreview.h === 0) {
                    w = GRID * 6; // 120px mặc định khi chỉ click chuột
                    h = GRID;     // 20px chiều cao vùng chạm chọn
                    lineOrientation = 'horizontal';
                } else if (Math.abs(dx) >= Math.abs(dy) * 1.5) {
                    w = Math.max(drawPreview.w, GRID * 2);
                    h = Math.max(drawPreview.h, GRID);
                    lineOrientation = 'horizontal';
                } else if (Math.abs(dy) >= Math.abs(dx) * 1.5) {
                    w = Math.max(drawPreview.w, GRID);
                    h = Math.max(drawPreview.h, GRID * 2);
                    lineOrientation = 'vertical';
                } else {
                    w = Math.max(drawPreview.w, GRID * 2);
                    h = Math.max(drawPreview.h, GRID * 2);
                    lineOrientation = (dx * dy >= 0) ? 'diagonal-down' : 'diagonal-up';
                }
            }

            const newShape: LayoutShape = {
                id: crypto.randomUUID(),
                type: activeTool as ShapeType,
                x: drawPreview.x,
                y: drawPreview.y,
                width: w,
                height: h,
                label: SHAPE_DEFAULTS[activeTool as ShapeType]?.label || 'Khu vực',
                code: activeTool === 'ZONE' ? `ZONE-${Math.floor(100 + Math.random() * 900)}` : undefined,
                isMultiLot: activeTool === 'ZONE' ? true : undefined,
                strokeWidth: isLineTool ? 3 : undefined,
                strokeDasharray: activeTool === 'DASHED_LINE' ? '8 6' : undefined,
                lineOrientation,
            };
            const next = [...shapes, newShape];
            setShapes(next);
            setSelectedId(newShape.id);
            setDrawPreview(null);
            pushHistory(next);

            if (activeTool === 'RACK') {
                setRackPopup({ shapeId: newShape.id, prefix: 'K', rows: 2, cols: 3 });
            }
        } else if (draggingRef.current && dragPos) {
            const d = draggingRef.current;
            const hasMoved = dragPos.x !== d.origX || dragPos.y !== d.origY ||
                (dragPos.w !== undefined && dragPos.w !== d.origW) ||
                (dragPos.h !== undefined && dragPos.h !== d.origH);
            if (hasMoved) {
                const next = shapes.map(s =>
                    s.id === dragPos.id ? { 
                        ...s, 
                        x: dragPos.x, 
                        y: dragPos.y,
                        width: dragPos.w ?? s.width,
                        height: dragPos.h ?? s.height
                    } : s
                );
                setShapes(next);
                pushHistory(next);
            }
        }

        // Always clean up all drag and draw refs on mouseup
        dragCandidateRef.current = null;
        draggingRef.current = null;
        setDragPos(null);
        drawingRef.current = false;
    }, [activeTool, drawPreview, dragPos, shapes, pushHistory]);

    // Global mouseup failsafe to prevent sticky dragging if released outside canvas
    useEffect(() => {
        const handleGlobalMouseUp = () => {
            if (dragCandidateRef.current || draggingRef.current) {
                if (draggingRef.current && dragPos) {
                    const d = draggingRef.current;
                    const hasMoved = dragPos.x !== d.origX || dragPos.y !== d.origY ||
                        (dragPos.w !== undefined && dragPos.w !== d.origW) ||
                        (dragPos.h !== undefined && dragPos.h !== d.origH);
                    if (hasMoved) {
                        setShapes(prev => {
                            const next = prev.map(s =>
                                s.id === dragPos.id ? {
                                    ...s,
                                    x: dragPos.x,
                                    y: dragPos.y,
                                    width: dragPos.w ?? s.width,
                                    height: dragPos.h ?? s.height
                                } : s
                            );
                            pushHistory(next);
                            return next;
                        });
                    }
                }
                dragCandidateRef.current = null;
                draggingRef.current = null;
                setDragPos(null);
            }
        };

        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, [dragPos, pushHistory]);

    const onMouseLeave = useCallback(() => {
        setCursorPos(null);
    }, []);

    // Handle Resize
    const onResizeStart = useCallback((e: React.MouseEvent, shapeId: string, handle: string) => {
        e.stopPropagation();
        e.preventDefault();
        const shape = shapes.find(s => s.id === shapeId);
        if (!shape || shape.isLocked) return;
        const pt = getSvgPoint(e);
        draggingRef.current = {
            id: shapeId,
            origX: shape.x,
            origY: shape.y,
            startSvgX: pt.x,
            startSvgY: pt.y,
            isResize: true,
            handle,
            origW: shape.width,
            origH: shape.height
        };
    }, [shapes, getSvgPoint]);

    // Handle Save
    const handleSave = async () => {
        if (!name.trim()) return showToast('Vui lòng nhập tên sơ đồ', 'error');
        setIsSaving(true);
        try {
            const layoutData: LayoutInput = {
                name,
                width: canvasW,
                height: canvasH,
                system_type: systemType,
                company_id: (layout as any)?.company_id || profile?.company_id || undefined,
                grid_data: shapes,
                is_active: layout?.is_active ?? true,
            };

            const payload = layout?.id ? { ...layoutData, id: layout.id } : layoutData;
            const saved = await layoutService.saveLayout(payload);
            if (saved) {
                showToast('Lưu sơ đồ và đồng bộ vị trí thành công', 'success');
                onSaveSuccess();
            }
        } catch (error: any) {
            console.error('Save failed:', error);
            showToast(`Lỗi khi lưu sơ đồ: ${error.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
            {/* Top Toolbar (Thiết kế nhỏ gọn, hiện đại chuẩn Figma/CAD) */}
            <div className="px-3.5 py-2 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between gap-3 bg-white dark:bg-zinc-900 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                    <input 
                        type="text" 
                        value={name} 
                        onChange={e => setName(e.target.value)}
                        className="w-44 sm:w-52 px-2.5 py-1 font-bold text-sm bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white shadow-xs"
                        placeholder="Tên sơ đồ mặt bằng..."
                    />
                    <div className="flex items-center gap-1 text-[11px] text-gray-500 font-semibold bg-gray-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded-lg border border-gray-200/60 dark:border-zinc-700/60 shrink-0">
                        <span className="text-gray-400 font-bold">W:</span>
                        <input type="number" step={100} value={canvasW} onChange={e => setCanvasW(Number(e.target.value))} className="w-11 bg-transparent text-center font-bold outline-none text-xs text-gray-700 dark:text-gray-200" />
                        <span className="text-gray-300 dark:text-zinc-600">×</span>
                        <span className="text-gray-400 font-bold">H:</span>
                        <input type="number" step={100} value={canvasH} onChange={e => setCanvasH(Number(e.target.value))} className="w-11 bg-transparent text-center font-bold outline-none text-xs text-gray-700 dark:text-gray-200" />
                        <span className="text-[10px] text-gray-400">px</span>
                    </div>
                </div>

                {/* Actions Toolbar */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {/* Undo / Redo */}
                    <div className="flex items-center border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-800 shadow-xs">
                        <button 
                            type="button" 
                            onClick={handleUndo} 
                            disabled={historyIndex === 0} 
                            title="Hoàn tác (Ctrl+Z)"
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-700 disabled:opacity-30 transition-colors"
                        >
                            <Undo2 size={14} />
                        </button>
                        <div className="w-px h-3.5 bg-gray-200 dark:bg-zinc-700" />
                        <button 
                            type="button" 
                            onClick={handleRedo} 
                            disabled={historyIndex >= history.length - 1} 
                            title="Làm lại (Ctrl+Y)"
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-700 disabled:opacity-30 transition-colors"
                        >
                            <Redo2 size={14} />
                        </button>
                    </div>

                    {/* Zoom & View */}
                    <div className="flex items-center border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-800 shadow-xs">
                        <button 
                            type="button" 
                            onClick={() => setZoom(z => Math.max(0.2, Number((z - 0.1).toFixed(2))))} 
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors text-gray-600 dark:text-gray-300"
                            title="Thu nhỏ"
                        >
                            <ZoomOut size={14} />
                        </button>
                        <span className="text-[11px] font-bold px-1.5 min-w-[34px] text-center">{Math.round(zoom * 100)}%</span>
                        <button 
                            type="button" 
                            onClick={() => setZoom(z => Math.min(2.5, Number((z + 0.1).toFixed(2))))} 
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors text-gray-600 dark:text-gray-300"
                            title="Phóng to"
                        >
                            <ZoomIn size={14} />
                        </button>
                        <button 
                            type="button" 
                            onClick={handleFitToScreen} 
                            className="px-2 py-1 text-[11px] font-semibold border-l border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors text-blue-600 dark:text-blue-400"
                            title="Tự động căn vừa khung hình"
                        >
                            Vừa khung
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setShowRulers(r => !r)} 
                            className={`px-2 py-1 text-[11px] font-semibold border-l border-gray-200 dark:border-zinc-700 transition-colors flex items-center gap-1 ${
                                showRulers 
                                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' 
                                    : 'hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-500'
                            }`}
                            title={showRulers ? "Ẩn thước kẻ đo kích thước (m / px)" : "Hiện thước kẻ đo kích thước (m / px)"}
                        >
                            <Ruler size={12} />
                            <span>Thước</span>
                        </button>
                    </div>

                    {/* Nút Khóa Tất Cả / Mở Khóa Tất Cả */}
                    {shapes.length > 0 && (
                        <button 
                            type="button" 
                            onClick={handleToggleLockAll}
                            title={shapes.some(s => !s.isLocked) ? "Khóa tất cả hình khối để chống click/kéo nhầm" : "Mở khóa tất cả hình khối"}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-xs ${
                                shapes.every(s => s.isLocked)
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                                    : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700'
                            }`}
                        >
                            {shapes.every(s => s.isLocked) ? <Lock size={13} className="text-amber-600 dark:text-amber-400" /> : <Unlock size={13} />}
                            <span>{shapes.every(s => s.isLocked) ? 'Đã khóa' : 'Khóa tất cả'}</span>
                        </button>
                    )}

                    {/* Context tools khi có đối tượng được chọn */}
                    {selectedShape && (
                        <div className="flex items-center gap-1 bg-gray-100/80 dark:bg-zinc-800/80 p-0.5 rounded-lg border border-gray-200/80 dark:border-zinc-700/80 animate-in fade-in duration-150">
                            {/* Nút Khóa / Mở khóa cho hình đang chọn */}
                            <button 
                                type="button" 
                                onClick={() => {
                                    const nextLocked = !selectedShape.isLocked;
                                    updateSelectedShape({ isLocked: nextLocked });
                                    showToast(nextLocked ? 'Đã khóa vị trí hình khối' : 'Đã mở khóa hình khối', 'info');
                                }}
                                title={selectedShape.isLocked ? "Mở khóa đối tượng này (Ctrl+L)" : "Khóa cố định đối tượng này (Ctrl+L)"}
                                className={`p-1.5 rounded-md transition-all ${
                                    selectedShape.isLocked
                                        ? 'bg-amber-500 text-white shadow-xs'
                                        : 'text-gray-600 hover:bg-white dark:text-gray-300 dark:hover:bg-zinc-700'
                                }`}
                            >
                                {selectedShape.isLocked ? <Lock size={13} /> : <Unlock size={13} />}
                            </button>

                            {/* Nút Mở Thuộc tính */}
                            <button 
                                type="button" 
                                onClick={() => setShowInspector(prev => !prev)}
                                title="Mở / đóng bảng thuộc tính"
                                className={`px-2 py-1 text-xs font-bold rounded-md flex items-center gap-1 transition-all ${
                                    showInspector
                                        ? 'bg-blue-600 text-white shadow-xs'
                                        : 'text-blue-600 dark:text-blue-400 hover:bg-blue-100/60 dark:hover:bg-blue-900/40'
                                }`}
                            >
                                <Sliders size={13} />
                                <span>Thuộc tính</span>
                            </button>

                            {/* Nút Nhân bản */}
                            <button 
                                type="button" 
                                onClick={handleDuplicate}
                                title="Nhân bản (Ctrl+D)"
                                className="p-1.5 rounded-md text-gray-600 hover:bg-white dark:text-gray-300 dark:hover:bg-zinc-700 transition-all"
                            >
                                <Copy size={13} />
                            </button>

                            {/* Nút Xóa */}
                            <button 
                                type="button" 
                                onClick={handleDeleteSelected}
                                disabled={selectedShape.isLocked}
                                title={selectedShape.isLocked ? "Đối tượng đang khóa, không thể xóa" : "Xóa (Delete)"}
                                className={`p-1.5 rounded-md transition-all ${
                                    selectedShape.isLocked 
                                        ? 'opacity-30 cursor-not-allowed text-gray-400' 
                                        : 'text-rose-600 hover:bg-rose-100 dark:text-rose-400 dark:hover:bg-rose-950/40'
                                }`}
                            >
                                <Trash2 size={13} />
                            </button>
                        </div>
                    )}

                    <div className="w-px h-5 bg-gray-200 dark:border-zinc-700 mx-0.5" />

                    <button 
                        type="button" 
                        onClick={onClose}
                        className="px-3 py-1 text-xs font-semibold border border-gray-200 dark:border-zinc-700 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300 transition-colors"
                    >
                        Hủy
                    </button>
                    <button 
                        type="button" 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="px-3.5 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm flex items-center gap-1.5 active:scale-95 disabled:opacity-50 transition-all"
                    >
                        <Save size={14} /> {isSaving ? 'Đang lưu...' : 'Lưu Sơ Đồ'}
                    </button>
                </div>
            </div>

            {/* Main Area: Left Tools + Canvas + Right Inspector */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Left Tool Palette */}
                <div className="w-56 p-3 border-r border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                    {TOOL_GROUPS.map((group, gIdx) => (
                        <div key={gIdx} className="space-y-1">
                            <h4 className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500 px-2">
                                {group.name}
                            </h4>
                            <div className="space-y-0.5">
                                {group.tools.map(tool => {
                                    const Icon = tool.icon;
                                    const isActive = activeTool === tool.id;
                                    return (
                                        <button
                                            key={tool.id}
                                            onClick={() => { setActiveTool(tool.id); }}
                                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-bold transition-all ${
                                                isActive
                                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                                                    : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-200/60 dark:hover:bg-zinc-800'
                                            }`}
                                        >
                                            <Icon size={16} className={isActive ? 'text-white' : 'text-gray-500'} />
                                            <span className="truncate">{tool.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Center SVG Canvas */}
                <div 
                    ref={containerRef}
                    onWheel={handleWheel}
                    onMouseDown={handleContainerMouseDown}
                    className={`flex-1 overflow-auto bg-gray-200 dark:bg-zinc-950 p-6 flex relative custom-scrollbar ${
                        isPanning 
                            ? 'cursor-grabbing select-none' 
                            : isSpacePressed 
                                ? 'cursor-grab select-none' 
                                : ''
                    }`}
                >
                    <div className="relative shrink-0 m-auto flex flex-col transition-[width,height] duration-150">
                        {/* Top Ruler Row */}
                        {showRulers && (
                            <div className="flex shrink-0">
                                {/* Corner Intersection Box */}
                                <div 
                                    className="w-6 h-6 shrink-0 bg-gray-100 dark:bg-zinc-800 border-t border-l border-r border-b border-gray-300 dark:border-zinc-700 flex items-center justify-center text-[9px] font-black text-gray-500 select-none"
                                    title="Gốc tọa độ (0, 0) - Tỷ lệ: 1 ô 20px = 1 mét"
                                >
                                    m
                                </div>
                                {/* Top Horizontal Ruler */}
                                <div 
                                    className="h-6 shrink-0 border-t border-b border-r border-gray-300 dark:border-zinc-700 overflow-hidden bg-gray-50 dark:bg-zinc-900"
                                    style={{ width: `${Math.round(canvasW * zoom)}px` }}
                                >
                                    <svg 
                                        width="100%" 
                                        height="100%" 
                                        viewBox={`0 0 ${canvasW} 24`} 
                                        className="block select-none pointer-events-none"
                                    >
                                        {/* Highlight span of selected shape */}
                                        {selectedShape && (
                                            <rect 
                                                x={selectedShape.x} y={0} 
                                                width={selectedShape.width} height={24} 
                                                fill="#3b82f6" fillOpacity={0.25} 
                                            />
                                        )}
                                        {/* Cursor Position Indicator */}
                                        {cursorPos && (
                                            <g>
                                                <line x1={cursorPos.x} y1={0} x2={cursorPos.x} y2={24} stroke="#ef4444" strokeWidth={1.5} />
                                                <polygon points={`${cursorPos.x - 3},24 ${cursorPos.x + 3},24 ${cursorPos.x},18`} fill="#ef4444" />
                                            </g>
                                        )}
                                        {/* Ticks and Metric Labels */}
                                        {xTicks.map(t => (
                                            <g key={t.pos}>
                                                <line 
                                                    x1={t.pos} y1={t.isMajor ? 10 : 18} 
                                                    x2={t.pos} y2={24} 
                                                    stroke={t.isMajor ? "#475569" : "#cbd5e1"} 
                                                    strokeWidth={t.isMajor ? 1 : 0.75} 
                                                />
                                                {t.label && (
                                                    <text 
                                                        x={t.pos + 3} y={9} 
                                                        fontSize={8} fontWeight="bold" 
                                                        fill="#475569" 
                                                        fontFamily="ui-monospace, monospace"
                                                    >
                                                        {t.label}
                                                    </text>
                                                )}
                                            </g>
                                        ))}
                                    </svg>
                                </div>
                            </div>
                        )}

                        {/* Canvas + Left Ruler Row */}
                        <div className="flex shrink-0">
                            {/* Left Vertical Ruler */}
                            {showRulers && (
                                <div 
                                    className="w-6 shrink-0 border-l border-b border-r border-gray-300 dark:border-zinc-700 overflow-hidden bg-gray-50 dark:bg-zinc-900"
                                    style={{ height: `${Math.round(canvasH * zoom)}px` }}
                                >
                                    <svg 
                                        width="100%" 
                                        height="100%" 
                                        viewBox={`0 0 24 ${canvasH}`} 
                                        className="block select-none pointer-events-none"
                                    >
                                        {/* Highlight span of selected shape */}
                                        {selectedShape && (
                                            <rect 
                                                x={0} y={selectedShape.y} 
                                                width={24} height={selectedShape.height} 
                                                fill="#3b82f6" fillOpacity={0.25} 
                                            />
                                        )}
                                        {/* Cursor Position Indicator */}
                                        {cursorPos && (
                                            <g>
                                                <line x1={0} y1={cursorPos.y} x2={24} y2={cursorPos.y} stroke="#ef4444" strokeWidth={1.5} />
                                                <polygon points={`24,${cursorPos.y - 3} 24,${cursorPos.y + 3} 18,${cursorPos.y}`} fill="#ef4444" />
                                            </g>
                                        )}
                                        {/* Ticks and Metric Labels */}
                                        {yTicks.map(t => (
                                            <g key={t.pos}>
                                                <line 
                                                    x1={t.isMajor ? 10 : 18} y1={t.pos} 
                                                    x2={24} y2={t.pos} 
                                                    stroke={t.isMajor ? "#475569" : "#cbd5e1"} 
                                                    strokeWidth={t.isMajor ? 1 : 0.75} 
                                                />
                                                {t.label && (
                                                    <text 
                                                        x={2} y={t.pos + 7} 
                                                        fontSize={7.5} fontWeight="bold" 
                                                        fill="#475569" 
                                                        fontFamily="ui-monospace, monospace"
                                                    >
                                                        {t.label}
                                                    </text>
                                                )}
                                            </g>
                                        ))}
                                    </svg>
                                </div>
                            )}

                            {/* Canvas Main Plane */}
                            <div 
                                className="bg-white shadow-2xl rounded-none border border-gray-300 dark:border-zinc-700 relative shrink-0"
                                style={{ 
                                    width: `${Math.round(canvasW * zoom)}px`, 
                                    height: `${Math.round(canvasH * zoom)}px`,
                                    minWidth: `${Math.round(canvasW * zoom)}px`,
                                    minHeight: `${Math.round(canvasH * zoom)}px`,
                                }}
                            >
                                <svg
                                    ref={svgRef}
                                    width="100%"
                                    height="100%"
                                    viewBox={`0 0 ${canvasW} ${canvasH}`}
                                    onMouseDown={onMouseDown}
                                    onMouseMove={onMouseMove}
                                    onMouseLeave={onMouseLeave}
                                    onMouseUp={onMouseUp}
                                    className={`select-none ${
                                        isPanning 
                                            ? 'cursor-grabbing' 
                                            : isSpacePressed 
                                                ? 'cursor-grab' 
                                                : activeTool === 'SELECT' 
                                                    ? 'cursor-default' 
                                                    : 'cursor-crosshair'
                                    }`}
                                >
                            {/* Grid background & Technical Hatch Patterns */}
                            <defs>
                                <pattern id="editorGrid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                                    <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="#f1f5f9" strokeWidth="1" />
                                </pattern>
                                <pattern id="hazardStripes" width="20" height="20" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                                    <line x1="0" y1="0" x2="0" y2="20" stroke="#fde047" strokeWidth="10" />
                                    <line x1="10" y1="0" x2="10" y2="20" stroke="#1f2937" strokeWidth="10" />
                                </pattern>
                                <pattern id="fencePattern" width="12" height="12" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                                    <rect width="12" height="12" fill="none" stroke="#94a3b8" strokeWidth="0.8" />
                                </pattern>
                            </defs>
                            <rect width={canvasW} height={canvasH} fill="url(#editorGrid)" />

                            {/* Render All Shapes */}
                            {shapes.map(shape => {
                                const isSelected = shape.id === selectedId;
                                const sx = dragPos?.id === shape.id ? dragPos.x : shape.x;
                                const sy = dragPos?.id === shape.id ? dragPos.y : shape.y;
                                const sw = dragPos?.id === shape.id && dragPos.w ? dragPos.w : shape.width;
                                const sh = dragPos?.id === shape.id && dragPos.h ? dragPos.h : shape.height;

                                const def = SHAPE_DEFAULTS[shape.type] || SHAPE_DEFAULTS.ZONE;
                                const fill = shape.color || def.fill;
                                const stroke = shape.strokeColor || def.stroke;
                                const opacity = shape.opacity ?? 0.9;
                                const rotTransform = shape.rotation ? `rotate(${shape.rotation} ${sx + sw/2} ${sy + sh/2})` : undefined;

                                return (
                                    <g 
                                        key={shape.id} 
                                        transform={rotTransform} 
                                        className="cursor-pointer"
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            setShowInspector(true);
                                        }}
                                    >
                                        {/* Hình dạng theo từng loại chuyên dụng */}
                                        {shape.type === 'PILLAR' ? (
                                            /* Cột trụ nhà xưởng (hình tròn có dấu X chịu lực) */
                                            <g>
                                                <circle 
                                                    cx={sx + sw/2} cy={sy + sh/2} r={Math.min(sw, sh)/2}
                                                    fill={fill} stroke={stroke} strokeWidth={isSelected ? 3 : 2}
                                                    opacity={opacity}
                                                />
                                                <line x1={sx + sw*0.2} y1={sy + sh*0.2} x2={sx + sw*0.8} y2={sy + sh*0.8} stroke={stroke} strokeWidth={1.5} />
                                                <line x1={sx + sw*0.8} y1={sy + sh*0.2} x2={sx + sw*0.2} y2={sy + sh*0.8} stroke={stroke} strokeWidth={1.5} />
                                            </g>
                                        ) : shape.type === 'FENCE' ? (
                                            /* Hàng rào lưới bảo vệ / Lan can */
                                            <g>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={fill} stroke={stroke} strokeWidth={2} opacity={opacity} />
                                                <rect x={sx} y={sy} width={sw} height={sh} fill="url(#fencePattern)" opacity={0.7} />
                                                <line x1={sx} y1={sy+3} x2={sx+sw} y2={sy+3} stroke={stroke} strokeWidth={1.5} />
                                                <line x1={sx} y1={sy+sh-3} x2={sx+sw} y2={sy+sh-3} stroke={stroke} strokeWidth={1.5} />
                                            </g>
                                        ) : shape.type === 'PARTITION' ? (
                                            /* Vách ngăn panel nhẹ / Vách thạch cao */
                                            <g>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={fill} stroke={stroke} strokeWidth={1.5} strokeDasharray="6 3" opacity={opacity} />
                                                <line x1={sx+3} y1={sy+sh/2} x2={sx+sw-3} y2={sy+sh/2} stroke={stroke} strokeWidth={1} strokeDasharray="3 3" />
                                            </g>
                                        ) : shape.type === 'STAGING' ? (
                                            /* Khu tập kết / Đệm hàng chờ xuất nhập */
                                            <g>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={fill} stroke={stroke} strokeWidth={isSelected ? 3 : 2} strokeDasharray="8 4" opacity={opacity} />
                                                <rect x={sx + 4} y={sy + 4} width={sw - 8} height={10} fill="url(#hazardStripes)" opacity={0.65} />
                                                <rect x={sx + 4} y={sy + sh - 14} width={sw - 8} height={10} fill="url(#hazardStripes)" opacity={0.65} />
                                            </g>
                                        ) : shape.type === 'QC_AREA' ? (
                                            /* Khu kiểm hàng KCS */
                                            <g>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={fill} stroke={stroke} strokeWidth={isSelected ? 3 : 2} strokeDasharray="6 3" rx={6} opacity={opacity} />
                                                <rect x={sx + 6} y={sy + 6} width={50} height={16} rx={4} fill="#059669" />
                                                <text x={sx + 31} y={sy + 18} textAnchor="middle" fontSize={9} fontWeight="bold" fill="#ffffff">✓ KCS</text>
                                            </g>
                                        ) : shape.type === 'SCRAP' ? (
                                            /* Khu phế phẩm / Hàng hỏng */
                                            <g>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={fill} stroke={stroke} strokeWidth={isSelected ? 3 : 2} strokeDasharray="6 4" rx={6} opacity={opacity} />
                                                <line x1={sx} y1={sy} x2={sx+sw} y2={sy+sh} stroke="#dc2626" strokeWidth={1} strokeOpacity={0.3} />
                                                <line x1={sx+sw} y1={sy} x2={sx} y2={sy+sh} stroke="#dc2626" strokeWidth={1} strokeOpacity={0.3} />
                                                <rect x={sx + 6} y={sy + 6} width={56} height={16} rx={4} fill="#dc2626" />
                                                <text x={sx + 34} y={sy + 18} textAnchor="middle" fontSize={9} fontWeight="bold" fill="#ffffff">⚠ PHẾ LIỆU</text>
                                            </g>
                                        ) : shape.type === 'FORKLIFT_PARK' ? (
                                            /* Bãi đỗ / Sạc xe nâng */
                                            <g>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={fill} stroke={stroke} strokeWidth={isSelected ? 3 : 2} rx={6} opacity={opacity} />
                                                <rect x={sx + 4} y={sy + 4} width={sw - 8} height={8} fill="url(#hazardStripes)" opacity={0.5} />
                                                <rect x={sx + 6} y={sy + sh - 22} width={64} height={16} rx={4} fill="#d97706" />
                                                <text x={sx + 38} y={sy + sh - 10} textAnchor="middle" fontSize={9} fontWeight="bold" fill="#ffffff">⚡ XE NÂNG</text>
                                            </g>
                                        ) : shape.type === 'DOCK' ? (
                                            /* Cửa Dock xuất nhập hàng xe tải */
                                            <g>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={fill} stroke={stroke} strokeWidth={isSelected ? 3 : 2} rx={4} opacity={opacity} />
                                                {/* Dock leveller plate */}
                                                <rect x={sx + 6} y={sy + sh - 16} width={sw - 12} height={12} fill="#4338ca" rx={2} opacity={0.8} />
                                                <rect x={sx + 4} y={sy + 4} width={sw - 8} height={8} fill="url(#hazardStripes)" opacity={0.6} />
                                                <text x={sx + sw/2} y={sy + sh - 7} textAnchor="middle" fontSize={8} fontWeight="bold" fill="#ffffff">DOCK SÀN NÂNG</text>
                                            </g>
                                        ) : shape.type === 'DESK' ? (
                                            /* Bàn làm việc / Bàn kiểm đếm thủ kho */
                                            <g>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={fill} stroke={stroke} strokeWidth={isSelected ? 3 : 2} rx={6} opacity={opacity} />
                                                {/* Ngăn bàn / Bàn máy tính */}
                                                <rect x={sx + 6} y={sy + 6} width={Math.min(30, sw*0.35)} height={sh - 12} fill="#0284c7" fillOpacity={0.2} stroke="#0284c7" strokeWidth={1} rx={3} />
                                                {/* Ghế ngồi thủ kho */}
                                                <circle cx={sx + sw*0.65} cy={sy + sh/2} r={Math.min(10, sh*0.25)} fill="#94a3b8" stroke="#475569" strokeWidth={1} opacity={0.7} />
                                            </g>
                                        ) : shape.type === 'PACK_STATION' ? (
                                            /* Trạm đóng gói bao bì / Máy dán thùng */
                                            <g>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={fill} stroke={stroke} strokeWidth={isSelected ? 3 : 2} rx={4} opacity={opacity} />
                                                <rect x={sx + sw/2 - 12} y={sy + sh/2 - 12} width={24} height={24} fill="#ca8a04" rx={3} opacity={0.5} />
                                                <line x1={sx + sw/2 - 12} y1={sy + sh/2} x2={sx + sw/2 + 12} y2={sy + sh/2} stroke="#854d0e" strokeWidth={1.5} />
                                                <line x1={sx + sw/2} y1={sy + sh/2 - 12} x2={sx + sw/2} y2={sy + sh/2 + 12} stroke="#854d0e" strokeWidth={1.5} />
                                            </g>
                                        ) : shape.type === 'SCALE' ? (
                                            /* Trạm cân điện tử */
                                            <g>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={fill} stroke={stroke} strokeWidth={isSelected ? 3 : 2} rx={4} opacity={opacity} />
                                                {/* 4 đệm góc cân */}
                                                <rect x={sx+4} y={sy+4} width={6} height={6} fill="#0d9488" rx={1} />
                                                <rect x={sx+sw-10} y={sy+4} width={6} height={6} fill="#0d9488" rx={1} />
                                                <rect x={sx+4} y={sy+sh-10} width={6} height={6} fill="#0d9488" rx={1} />
                                                <rect x={sx+sw-10} y={sy+sh-10} width={6} height={6} fill="#0d9488" rx={1} />
                                                {/* Màn hình hiển thị số kg */}
                                                <rect x={sx + sw/2 - 20} y={sy + 6} width={40} height={14} fill="#0f172a" rx={2} />
                                                <text x={sx + sw/2} y={sy + 16} textAnchor="middle" fontSize={8} fontWeight="bold" fill="#34d399">0.0 kg</text>
                                            </g>
                                        ) : shape.type === 'FIRE_EXT' ? (
                                            /* Hộp / Bình PCCC cứu hỏa */
                                            <g>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={fill} stroke={stroke} strokeWidth={isSelected ? 3 : 2} rx={4} opacity={opacity} />
                                                <circle cx={sx + sw/2} cy={sy + sh/2} r={Math.min(sw, sh)*0.35} fill="#dc2626" />
                                                <text x={sx + sw/2} y={sy + sh/2 + 4} textAnchor="middle" fontSize={14}>🔥</text>
                                            </g>
                                        ) : shape.type === 'FIRST_AID' ? (
                                            /* Tủ y tế / Sơ cứu tai nạn */
                                            <g>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={fill} stroke={stroke} strokeWidth={isSelected ? 3 : 2} rx={4} opacity={opacity} />
                                                <rect x={sx + sw/2 - 4} y={sy + sh*0.25} width={8} height={sh*0.5} fill="#16a34a" rx={1} />
                                                <rect x={sx + sw*0.25} y={sy + sh/2 - 4} width={sw*0.5} height={8} fill="#16a34a" rx={1} />
                                            </g>
                                        ) : shape.type === 'STAIRS' ? (
                                            /* Cầu thang bộ */
                                            <g>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={fill} stroke={stroke} strokeWidth={isSelected ? 3 : 2} opacity={opacity} />
                                                {Array.from({ length: 5 }).map((_, i) => (
                                                    <line key={`st_${i}`} x1={sx} y1={sy + (i+1)*(sh/6)} x2={sx + sw} y2={sy + (i+1)*(sh/6)} stroke={stroke} strokeWidth={1.5} />
                                                ))}
                                                <line x1={sx + sw/2} y1={sy + sh*0.8} x2={sx + sw/2} y2={sy + sh*0.2} stroke="#2563eb" strokeWidth={2} />
                                                <polygon points={`${sx + sw/2},${sy + sh*0.15} ${sx + sw/2 - 4},${sy + sh*0.25} ${sx + sw/2 + 4},${sy + sh*0.25}`} fill="#2563eb" />
                                            </g>
                                        ) : shape.type === 'ARROW' ? (
                                            /* Mũi tên chỉ hướng luồng di chuyển */
                                            <g>
                                                <line x1={sx + 8} y1={sy + sh/2} x2={sx + sw - 16} y2={sy + sh/2} stroke={fill} strokeWidth={Math.min(10, sh*0.35)} strokeLinecap="round" />
                                                <polygon points={`${sx + sw - 6},${sy + sh/2} ${sx + sw - 22},${sy + sh*0.2} ${sx + sw - 22},${sy + sh*0.8}`} fill={fill} />
                                            </g>
                                        ) : shape.type === 'TEXT_NOTE' ? (
                                            /* Nhãn chữ / Ghi chú bản vẽ */
                                            <g>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill="none" stroke={isSelected ? '#3b82f6' : 'transparent'} strokeWidth={1} strokeDasharray="3 3" />
                                                <text 
                                                    x={sx + 6} y={sy + sh/2} 
                                                    dominantBaseline="central" 
                                                    fontSize={Math.min(20, sh * 0.6)} 
                                                    fontWeight="bold" 
                                                    fill="#1e293b"
                                                >
                                                    {shape.label || 'Ghi chú'}
                                                </text>
                                            </g>
                                        ) : shape.type === 'RACK' && shape.rows && shape.cols ? (
                                            /* Kệ hàng chia ô */
                                            <g>
                                                <rect x={sx} y={sy} width={sw} height={sh} fill={fill} stroke={stroke} strokeWidth={isSelected ? 3 : 2} opacity={opacity} />
                                                {Array.from({ length: shape.rows - 1 }).map((_, i) => (
                                                    <line key={`r${i}`} x1={sx} y1={sy + (i+1)*(sh/shape.rows!)} x2={sx + sw} y2={sy + (i+1)*(sh/shape.rows!)} stroke={stroke} strokeWidth={1} />
                                                ))}
                                                {Array.from({ length: shape.cols - 1 }).map((_, i) => (
                                                    <line key={`c${i}`} x1={sx + (i+1)*(sw/shape.cols!)} y1={sy} x2={sx + (i+1)*(sw/shape.cols!)} y2={sy + sh} stroke={stroke} strokeWidth={1} />
                                                ))}
                                            </g>
                                        ) : shape.type === 'ROOM' ? (
                                            /* Phòng / Văn phòng / Kho biệt lập */
                                            <g>
                                                <rect 
                                                    x={sx} y={sy} width={sw} height={sh} 
                                                    fill={fill} fillOpacity={0.4} 
                                                    stroke={stroke} strokeWidth={isSelected ? 3 : 2.5} 
                                                    strokeDasharray="10 4" rx={shape.rx || 8} 
                                                />
                                                <rect x={sx} y={sy} width={sw} height={Math.min(24, Math.max(16, sh * 0.3))} rx={shape.rx || 8} fill={stroke} fillOpacity={0.15} />
                                                <text x={sx + 8} y={sy + Math.min(14, sh * 0.2)} fontSize={11} fontWeight="bold" fill={stroke}>{shape.label || 'Phòng'}</text>
                                            </g>
                                        ) : shape.type === 'DOOR' ? (
                                            /* Cửa ra vào / Cửa cuốn */
                                            <g>
                                                <rect 
                                                    x={sx} y={sy} width={sw} height={sh}
                                                    fill={fill} stroke={stroke} strokeWidth={isSelected ? 3 : 2}
                                                    rx={shape.rx || 3}
                                                    opacity={opacity}
                                                />
                                                <text x={sx + sw/2} y={sy + sh/2} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(11, sh * 0.5)} fontWeight="bold" fill="#15803d">
                                                    🚪 {shape.label || ''}
                                                </text>
                                            </g>
                                        ) : shape.type === 'LINE' || shape.type === 'DASHED_LINE' ? (
                                            /* Đường thẳng / Đường nét đứt */
                                            (() => {
                                                const sWidth = shape.strokeWidth || 3;
                                                const sDash = shape.strokeDasharray || (shape.type === 'DASHED_LINE' ? '8 6' : undefined);
                                                const orient = shape.lineOrientation || (sw >= sh ? 'horizontal' : 'vertical');

                                                let x1 = sx, y1 = sy + sh / 2, x2 = sx + sw, y2 = sy + sh / 2;
                                                if (orient === 'vertical') {
                                                    x1 = sx + sw / 2; y1 = sy;
                                                    x2 = sx + sw / 2; y2 = sy + sh;
                                                } else if (orient === 'diagonal-down') {
                                                    x1 = sx; y1 = sy;
                                                    x2 = sx + sw; y2 = sy + sh;
                                                } else if (orient === 'diagonal-up') {
                                                    x1 = sx; y1 = sy + sh;
                                                    x2 = sx + sw; y2 = sy;
                                                }

                                                return (
                                                    <g>
                                                        {/* Vùng đệm trong suốt để click/kéo chọn dễ dàng */}
                                                        <line 
                                                            x1={x1} y1={y1} x2={x2} y2={y2} 
                                                            stroke="transparent" 
                                                            strokeWidth={Math.max(sWidth + 16, 20)} 
                                                        />
                                                        {/* Đường vẽ thực tế */}
                                                        <line 
                                                            x1={x1} y1={y1} x2={x2} y2={y2} 
                                                            stroke={stroke} 
                                                            strokeWidth={sWidth} 
                                                            strokeDasharray={sDash}
                                                            strokeLinecap="round"
                                                            opacity={opacity}
                                                        />
                                                        {/* Nhãn tùy biến (nếu người dùng nhập tên khác mặc định) */}
                                                        {shape.label && shape.label !== 'Đường thẳng' && shape.label !== 'Đường nét đứt' && (
                                                            <text 
                                                                x={sx + sw / 2} 
                                                                y={orient === 'horizontal' ? sy + sh / 2 - 8 : sy + sh / 2} 
                                                                textAnchor="middle" 
                                                                dominantBaseline="central"
                                                                fontSize={10} 
                                                                fontWeight="bold" 
                                                                fill={stroke}
                                                            >
                                                                {shape.label}
                                                            </text>
                                                        )}
                                                    </g>
                                                );
                                            })()
                                        ) : (
                                            /* ZONE, WALL, PATH... */
                                            <rect 
                                                x={sx} y={sy} width={sw} height={sh}
                                                fill={fill} stroke={stroke} strokeWidth={isSelected ? 3 : 2}
                                                rx={shape.rx || 0}
                                                opacity={opacity}
                                            />
                                        )}

                                        {/* Label & Badges (cho các shape không phải TEXT_NOTE, ROOM, DOOR, LINE, DASHED_LINE) */}
                                        {shape.type !== 'TEXT_NOTE' && shape.type !== 'ROOM' && shape.type !== 'DOOR' && shape.type !== 'LINE' && shape.type !== 'DASHED_LINE' && shape.label && (
                                            <text 
                                                x={sx + sw/2} y={shape.type === 'ARROW' ? sy + sh*0.85 : sy + sh/2} 
                                                textAnchor="middle" dominantBaseline="central"
                                                fontSize={Math.min(13, sw / (shape.label.length || 1) * 1.6, sh * 0.35)}
                                                fontWeight="bold" 
                                                fill={shape.type === 'WALL' ? '#ffffff' : '#1e293b'}
                                            >
                                                {shape.label}
                                            </text>
                                        )}

                                        {/* Badge Multi-Lot trên hình ZONE */}
                                        {shape.type === 'ZONE' && shape.isMultiLot && (
                                            <g transform={`translate(${sx + 4}, ${sy + 4})`}>
                                                <rect width={56} height={16} rx={4} fill="#ea580c" />
                                                <text x={28} y={11} textAnchor="middle" fontSize={9} fontWeight="bold" fill="#ffffff">ĐA LÔ</text>
                                            </g>
                                        )}

                                        {/* Huy hiệu ổ khóa khi hình khối bị khóa */}
                                        {shape.isLocked && (
                                            <g transform={`translate(${sx + sw - 22}, ${sy + 4})`}>
                                                <rect width={18} height={18} rx={4} fill="#f59e0b" fillOpacity={0.9} />
                                                <path 
                                                    d="M 6 8 L 6 6 A 3 3 0 0 1 12 6 L 12 8 M 5 8 L 13 8 L 13 14 L 5 14 Z" 
                                                    fill="none" 
                                                    stroke="#ffffff" 
                                                    strokeWidth={1.5} 
                                                    strokeLinecap="round" 
                                                    strokeLinejoin="round" 
                                                />
                                            </g>
                                        )}

                                        {/* Selection Outline & Resize Handles */}
                                        {isSelected && (
                                            <g>
                                                <rect 
                                                    x={sx - 3} y={sy - 3} width={sw + 6} height={sh + 6} 
                                                    fill="none" 
                                                    stroke={shape.isLocked ? "#f59e0b" : "#2563eb"} 
                                                    strokeWidth="2" 
                                                    strokeDasharray={shape.isLocked ? "6 3" : "4 2"} 
                                                />
                                                {/* Dimension indicator / Lock status */}
                                                <text x={sx + sw/2} y={sy - 8} textAnchor="middle" fontSize={11} fontWeight="bold" fill={shape.isLocked ? "#d97706" : "#2563eb"}>
                                                    {shape.isLocked ? '🔒 Đã khóa vị trí' : `${(sw/20).toFixed(1)}m × ${(sh/20).toFixed(1)}m`}
                                                </text>

                                                {!shape.isLocked && (
                                                    <>
                                                        <rect x={sx - 6} y={sy - 6} width={10} height={10} fill="#2563eb" onMouseDown={e => onResizeStart(e, shape.id, 'nw')} className="cursor-nw-resize" />
                                                        <rect x={sx + sw - 4} y={sy - 6} width={10} height={10} fill="#2563eb" onMouseDown={e => onResizeStart(e, shape.id, 'ne')} className="cursor-ne-resize" />
                                                        <rect x={sx + sw - 4} y={sy + sh - 4} width={10} height={10} fill="#2563eb" onMouseDown={e => onResizeStart(e, shape.id, 'se')} className="cursor-se-resize" />
                                                        <rect x={sx - 6} y={sy + sh - 4} width={10} height={10} fill="#2563eb" onMouseDown={e => onResizeStart(e, shape.id, 'sw')} className="cursor-sw-resize" />
                                                    </>
                                                )}
                                            </g>
                                        )}
                                    </g>
                                );
                            })}

                            {/* Draw Preview when creating */}
                            {drawPreview && (
                                activeTool === 'LINE' || activeTool === 'DASHED_LINE' ? (
                                    <g>
                                        <rect 
                                            x={drawPreview.x} y={drawPreview.y} width={Math.max(drawPreview.w, 1)} height={Math.max(drawPreview.h, 1)}
                                            fill="#93c5fd" fillOpacity="0.1" stroke="#93c5fd" strokeWidth="1" strokeDasharray="3 3"
                                        />
                                        <line 
                                            x1={drawPreview.x} 
                                            y1={drawPreview.w >= drawPreview.h ? drawPreview.y + drawPreview.h/2 : drawPreview.y} 
                                            x2={drawPreview.x + drawPreview.w} 
                                            y2={drawPreview.w >= drawPreview.h ? drawPreview.y + drawPreview.h/2 : drawPreview.y + drawPreview.h} 
                                            stroke={activeTool === 'DASHED_LINE' ? '#eab308' : '#2563eb'} 
                                            strokeWidth={3} 
                                            strokeDasharray={activeTool === 'DASHED_LINE' ? '8 6' : undefined}
                                            strokeLinecap="round"
                                        />
                                        <text
                                            x={drawPreview.x + drawPreview.w / 2}
                                            y={drawPreview.y - 6}
                                            textAnchor="middle"
                                            fontSize={10}
                                            fontWeight="bold"
                                            fill={activeTool === 'DASHED_LINE' ? '#d97706' : '#2563eb'}
                                        >
                                            {`${((Math.max(drawPreview.w, drawPreview.h)) / 20).toFixed(1)}m`}
                                        </text>
                                    </g>
                                ) : (
                                    <rect 
                                        x={drawPreview.x} y={drawPreview.y} width={drawPreview.w} height={drawPreview.h}
                                        fill="#93c5fd" fillOpacity="0.3" stroke="#2563eb" strokeWidth="2" strokeDasharray="6 3"
                                    />
                                )
                            )}
                        </svg>
                    </div>
                </div>
            </div>

            {/* Bottom HUD: Coordinates & Shortcuts */}
            <div className="absolute bottom-4 left-4 flex items-center gap-2 pointer-events-none select-none z-10">
                <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 shadow-md border border-gray-200/80 dark:border-zinc-700/80 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    <span>Giữ <kbd className="px-1.5 py-0.5 text-[11px] font-bold bg-gray-100 dark:bg-zinc-800 rounded border border-gray-300 dark:border-zinc-700 font-mono text-gray-800 dark:text-gray-200 shadow-xs">Space</kbd> + kéo chuột để Pan</span>
                </div>

                {cursorPos && (
                    <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-mono font-bold text-gray-700 dark:text-gray-200 shadow-md border border-gray-200/80 dark:border-zinc-700/80 flex items-center gap-2 animate-in fade-in duration-100">
                        <span className="text-blue-600 dark:text-blue-400">X: {cursorPos.x}px ({(cursorPos.x / 20).toFixed(1)}m)</span>
                        <span className="text-gray-300 dark:text-zinc-700">|</span>
                        <span className="text-emerald-600 dark:text-emerald-400">Y: {cursorPos.y}px ({(cursorPos.y / 20).toFixed(1)}m)</span>
                    </div>
                )}
            </div>
        </div>

                {/* Right Inspector Sidebar (Bảng thuộc tính cố định bên phải, KHÔNG che đè lên sơ đồ thiết kế) */}
                {selectedShape && showInspector && (
                    <div className="w-80 shrink-0 border-l border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col h-full z-20 shadow-xl">
                        {/* Sticky Header - Luôn cố định trên cùng, nút Đóng luôn nhìn thấy rõ ràng */}
                        <div className="p-3.5 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-gray-50/90 dark:bg-zinc-900/90 backdrop-blur-sm">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-lg">
                                    <Sliders size={15} />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-xs text-gray-900 dark:text-white uppercase tracking-wider">
                                        Thuộc Tính
                                    </h3>
                                    <span className="text-[10px] text-gray-500 font-bold truncate max-w-[130px] block">
                                        {selectedShape.label || selectedShape.type}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button 
                                    type="button"
                                    onClick={() => {
                                        const nextLocked = !selectedShape.isLocked;
                                        updateSelectedShape({ isLocked: nextLocked });
                                        showToast(nextLocked ? 'Đã khóa vị trí hình khối' : 'Đã mở khóa hình khối', 'info');
                                    }}
                                    className={`p-1.5 rounded-xl border transition-colors ${
                                        selectedShape.isLocked 
                                            ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800' 
                                            : 'text-gray-400 border-gray-200 dark:border-zinc-700 hover:text-gray-700'
                                    }`}
                                    title={selectedShape.isLocked ? 'Đang khóa (Không thể di chuyển)' : 'Chưa khóa (Ctrl+L)'}
                                >
                                    {selectedShape.isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setShowInspector(false)}
                                    className="px-2.5 py-1.5 rounded-xl text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors flex items-center gap-1 text-xs font-bold shadow-xs active:scale-95"
                                    title="Đóng bảng thuộc tính (Esc)"
                                >
                                    <X size={15} />
                                    <span>Đóng</span>
                                </button>
                            </div>
                        </div>

                        {/* Scrollable Content - Cuộn riêng biệt bên dưới header */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">

                        {/* Tên & Mã định danh */}
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 block mb-1">Tên hiển thị (Label)</label>
                                <input 
                                    type="text" 
                                    value={selectedShape.label || ''} 
                                    onChange={e => updateSelectedShape({ label: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="VD: Khu Thùng Carton 10kg"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 block mb-1">Mã hệ thống (Code)</label>
                                <input 
                                    type="text" 
                                    value={selectedShape.code || ''} 
                                    onChange={e => updateSelectedShape({ code: e.target.value.toUpperCase() })}
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 font-mono text-sm uppercase outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="VD: KHU-THUNG-10KG"
                                />
                            </div>
                        </div>

                        {/* Multi-Lot Zone Setting */}
                        {selectedShape.type === 'ZONE' && (
                            <div className="p-3.5 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/40 rounded-2xl space-y-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox"
                                        checked={selectedShape.isMultiLot ?? true}
                                        onChange={e => updateSelectedShape({ isMultiLot: e.target.checked })}
                                        className="w-4 h-4 text-orange-600 rounded"
                                    />
                                    <span className="text-xs font-bold text-orange-900 dark:text-orange-300">
                                        Bãi Chứa Đa Lô (Nhiều LOT)
                                    </span>
                                </label>
                                <p className="text-[11px] text-orange-700 dark:text-orange-400 leading-relaxed">
                                    Cho phép lưu trữ nhiều lô hàng khác nhau trong cùng khu vực này và quản lý bốc xuất theo lô.
                                </p>

                                <div className="grid grid-cols-2 gap-2 pt-1">
                                    <div>
                                        <label className="text-[11px] font-bold text-orange-800 dark:text-orange-300 block mb-1">Sức chứa tối đa</label>
                                        <input 
                                            type="number"
                                            value={selectedShape.capacity || ''}
                                            onChange={e => updateSelectedShape({ capacity: Number(e.target.value) })}
                                            placeholder="VD: 5000"
                                            className="w-full px-2.5 py-1.5 rounded-lg border border-orange-200 dark:border-orange-800 bg-white dark:bg-zinc-900 text-xs font-bold outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-bold text-orange-800 dark:text-orange-300 block mb-1">Đơn vị</label>
                                        <input 
                                            type="text"
                                            value={selectedShape.capacityUnit || 'Cái'}
                                            onChange={e => updateSelectedShape({ capacityUnit: e.target.value })}
                                            placeholder="Thùng / Pallet"
                                            className="w-full px-2.5 py-1.5 rounded-lg border border-orange-200 dark:border-orange-800 bg-white dark:bg-zinc-900 text-xs font-bold outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tùy chỉnh chuyên dụng cho Đường thẳng & Đường nét đứt */}
                        {(selectedShape.type === 'LINE' || selectedShape.type === 'DASHED_LINE') && (
                            <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 rounded-2xl space-y-3.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-blue-900 dark:text-blue-300">Kiểu đường vẽ</span>
                                    <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 p-0.5 rounded-lg border border-blue-200 dark:border-blue-800">
                                        <button
                                            type="button"
                                            onClick={() => updateSelectedShape({ type: 'LINE', strokeDasharray: undefined })}
                                            className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all ${
                                                selectedShape.type === 'LINE' 
                                                    ? 'bg-blue-600 text-white shadow-xs' 
                                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700'
                                            }`}
                                        >
                                            Nét liền ──
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => updateSelectedShape({ type: 'DASHED_LINE', strokeDasharray: selectedShape.strokeDasharray || '8 6' })}
                                            className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all ${
                                                selectedShape.type === 'DASHED_LINE' 
                                                    ? 'bg-blue-600 text-white shadow-xs' 
                                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700'
                                            }`}
                                        >
                                            Nét đứt ╌╌
                                        </button>
                                    </div>
                                </div>

                                {/* Hướng đường */}
                                <div>
                                    <label className="text-[11px] font-bold text-blue-800 dark:text-blue-300 block mb-1.5">Hướng đường</label>
                                    <div className="grid grid-cols-4 gap-1">
                                        {[
                                            { id: 'horizontal', label: 'Ngang ──' },
                                            { id: 'vertical', label: 'Dọc │' },
                                            { id: 'diagonal-down', label: 'Chéo ╲' },
                                            { id: 'diagonal-up', label: 'Chéo ╱' },
                                        ].map(h => {
                                            const currentOrient = selectedShape.lineOrientation || (selectedShape.width >= selectedShape.height ? 'horizontal' : 'vertical');
                                            const isActive = currentOrient === h.id;
                                            return (
                                                <button
                                                    key={h.id}
                                                    type="button"
                                                    onClick={() => updateSelectedShape({ lineOrientation: h.id as any })}
                                                    className={`py-1.5 px-1 text-[10px] font-bold rounded-lg border text-center transition-all ${
                                                        isActive
                                                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                                            : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    {h.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Độ dày nét (strokeWidth) */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-[11px] font-bold text-blue-800 dark:text-blue-300">Độ dày nét vẽ</label>
                                        <span className="text-[11px] font-mono font-bold text-blue-600">{(selectedShape.strokeWidth || 3)}px</span>
                                    </div>
                                    <div className="grid grid-cols-6 gap-1">
                                        {[1, 2, 3, 4, 6, 8].map(w => {
                                            const isActive = (selectedShape.strokeWidth || 3) === w;
                                            return (
                                                <button
                                                    key={w}
                                                    type="button"
                                                    onClick={() => updateSelectedShape({ strokeWidth: w })}
                                                    className={`py-1 text-[10px] font-bold rounded-lg border text-center transition-all ${
                                                        isActive
                                                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                                            : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    {w}px
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Kiểu ngắt quãng nét đứt */}
                                {selectedShape.type === 'DASHED_LINE' && (
                                    <div>
                                        <label className="text-[11px] font-bold text-blue-800 dark:text-blue-300 block mb-1.5">Mẫu nét đứt</label>
                                        <div className="grid grid-cols-3 gap-1">
                                            {[
                                                { dash: '12 8', label: 'Thưa' },
                                                { dash: '8 6', label: 'Tiêu chuẩn' },
                                                { dash: '4 4', label: 'Dày' },
                                            ].map(d => {
                                                const currentDash = selectedShape.strokeDasharray || '8 6';
                                                const isActive = currentDash === d.dash;
                                                return (
                                                    <button
                                                        key={d.dash}
                                                        type="button"
                                                        onClick={() => updateSelectedShape({ strokeDasharray: d.dash })}
                                                        className={`py-1 text-[10px] font-bold rounded-lg border text-center transition-all ${
                                                            isActive
                                                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                                                : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        {d.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Kích thước & Tọa độ */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-600 dark:text-gray-400 block">Kích Thước & Tọa Độ (Grid 20px)</label>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-zinc-800 p-2 rounded-xl border border-gray-200 dark:border-zinc-700">
                                    <span className="text-[11px] font-bold text-gray-400">W:</span>
                                    <input 
                                        type="number" step={20} min={MIN_SIZE} value={selectedShape.width}
                                        onChange={e => updateSelectedShape({ width: Math.max(MIN_SIZE, snap(Number(e.target.value))) })}
                                        className="w-full bg-transparent font-bold text-xs outline-none"
                                    />
                                    <span className="text-[10px] text-gray-400">({(selectedShape.width/20).toFixed(1)}m)</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-zinc-800 p-2 rounded-xl border border-gray-200 dark:border-zinc-700">
                                    <span className="text-[11px] font-bold text-gray-400">H:</span>
                                    <input 
                                        type="number" step={20} min={MIN_SIZE} value={selectedShape.height}
                                        onChange={e => updateSelectedShape({ height: Math.max(MIN_SIZE, snap(Number(e.target.value))) })}
                                        className="w-full bg-transparent font-bold text-xs outline-none"
                                    />
                                    <span className="text-[10px] text-gray-400">({(selectedShape.height/20).toFixed(1)}m)</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-zinc-800 p-2 rounded-xl border border-gray-200 dark:border-zinc-700">
                                    <span className="text-[11px] font-bold text-gray-400">X:</span>
                                    <input 
                                        type="number" step={20} value={selectedShape.x}
                                        onChange={e => updateSelectedShape({ x: snap(Number(e.target.value)) })}
                                        className="w-full bg-transparent font-bold text-xs outline-none"
                                    />
                                </div>
                                <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-zinc-800 p-2 rounded-xl border border-gray-200 dark:border-zinc-700">
                                    <span className="text-[11px] font-bold text-gray-400">Y:</span>
                                    <input 
                                        type="number" step={20} value={selectedShape.y}
                                        onChange={e => updateSelectedShape({ y: snap(Number(e.target.value)) })}
                                        className="w-full bg-transparent font-bold text-xs outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Xoay góc */}
                        <div className="flex items-center justify-between bg-gray-50 dark:bg-zinc-800 p-3 rounded-xl border border-gray-200 dark:border-zinc-700">
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Góc xoay</span>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => updateSelectedShape({ rotation: ((selectedShape.rotation || 0) + 90) % 360 })}
                                    className="px-3 py-1.5 bg-white dark:bg-zinc-700 hover:bg-gray-100 rounded-lg text-xs font-bold border border-gray-200 dark:border-zinc-600 flex items-center gap-1"
                                >
                                    <RotateCw size={12} /> {selectedShape.rotation || 0}°
                                </button>
                            </div>
                        </div>

                        {/* Màu sắc tùy chỉnh */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                                <Palette size={14} /> {selectedShape.type === 'LINE' || selectedShape.type === 'DASHED_LINE' ? 'Màu nét vẽ (Vạch sơn)' : 'Màu sắc đại diện'}
                            </label>
                            {selectedShape.type === 'LINE' || selectedShape.type === 'DASHED_LINE' ? (
                                <div className="grid grid-cols-6 gap-1.5">
                                    {[
                                        { color: '#eab308', name: 'Vàng (Sơn an toàn)' },
                                        { color: '#2563eb', name: 'Xanh dương (Chỉ dẫn)' },
                                        { color: '#dc2626', name: 'Đỏ (Ranh giới cấm)' },
                                        { color: '#16a34a', name: 'Xanh lá (Luồng ưu tiên)' },
                                        { color: '#f8fafc', stroke: '#94a3b8', name: 'Trắng (Vạch sơn phân làn)' },
                                        { color: '#334155', name: 'Xám đậm (Hạ tầng)' },
                                    ].map((c, cIdx) => (
                                        <button
                                            key={cIdx}
                                            type="button"
                                            onClick={() => updateSelectedShape({ strokeColor: c.color, color: c.color })}
                                            className="h-8 rounded-lg border-2 transition-transform hover:scale-105 flex items-center justify-center shadow-xs"
                                            style={{ backgroundColor: c.color, borderColor: c.stroke || c.color }}
                                            title={c.name}
                                        >
                                            {(selectedShape.strokeColor === c.color || selectedShape.color === c.color) && (
                                                <span className="text-[10px] font-black" style={{ color: c.color === '#f8fafc' ? '#0f172a' : '#ffffff' }}>✓</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-4 gap-2">
                                    {COLOR_PRESETS.map((preset, pIdx) => (
                                        <button
                                            key={pIdx}
                                            onClick={() => updateSelectedShape({ color: preset.fill, strokeColor: preset.stroke })}
                                            className="h-8 rounded-lg border-2 transition-transform hover:scale-105"
                                            style={{ backgroundColor: preset.fill, borderColor: preset.stroke }}
                                            title={preset.name}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Layer Order */}
                        <div className="space-y-2 border-t border-gray-100 dark:border-zinc-800 pt-3">
                            <label className="text-xs font-bold text-gray-600 dark:text-gray-400 block">Sắp xếp Lớp (Layer)</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button 
                                    onClick={handleBringToFront}
                                    className="px-3 py-2 bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-xl text-xs font-bold border border-gray-200 dark:border-zinc-700 flex items-center justify-center gap-1.5"
                                >
                                    <ArrowUp size={14} /> Lên trên cùng
                                </button>
                                <button 
                                    onClick={handleSendToBack}
                                    className="px-3 py-2 bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-xl text-xs font-bold border border-gray-200 dark:border-zinc-700 flex items-center justify-center gap-1.5"
                                >
                                    <ArrowDown size={14} /> Xuống dưới cùng
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
    );
}
