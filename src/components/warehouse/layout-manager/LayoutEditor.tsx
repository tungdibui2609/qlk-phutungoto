'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LayoutShape, ShapeType, WarehouseLayout, LayoutInput, isShapesFormat } from './types';
import { useToast } from '@/components/ui/ToastProvider';
import { Save, X, MousePointer, Square, Minus, MoveRight, DoorOpen, Trash2, ZoomIn, ZoomOut, Grid3X3, Box, Circle, RotateCw, Tag } from 'lucide-react';
import { layoutService } from '@/services/warehouse/layoutService';
import { useSystem } from '@/contexts/SystemContext';

interface LayoutEditorProps {
    layout?: WarehouseLayout;
    onClose: () => void;
    onSaveSuccess: () => void;
}

const GRID = 20;
const MIN_SIZE = GRID * 2;

type ToolId = 'SELECT' | ShapeType;

const TOOLS: { id: ToolId; label: string; icon: React.ComponentType<any> }[] = [
    { id: 'SELECT', label: 'Chọn / Di chuyển', icon: MousePointer },
    { id: 'ZONE', label: 'Khu vực để hàng', icon: Square },
    { id: 'RACK', label: 'Kệ hàng (nhiều ô)', icon: Grid3X3 },
    { id: 'ROOM', label: 'Phòng / Kho nhỏ', icon: Box },
    { id: 'WALL', label: 'Tường ngăn', icon: Minus },
    { id: 'PATH', label: 'Hành lang / Lối đi', icon: MoveRight },
    { id: 'DOOR', label: 'Cửa ra vào', icon: DoorOpen },
    { id: 'PILLAR', label: 'Cột trụ', icon: Circle },
];

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
    RACK: 'Kệ hàng', ROOM: 'Phòng', PILLAR: 'Cột',
};

const snap = (v: number) => Math.round(v / GRID) * GRID;

function initShapes(layout?: WarehouseLayout): LayoutShape[] {
    if (!layout?.grid_data?.length) return [];
    if (isShapesFormat(layout.grid_data)) return layout.grid_data;
    return [];
}

export default function LayoutEditor({ layout, onClose, onSaveSuccess }: LayoutEditorProps) {
    const { systemType } = useSystem();
    const { showToast } = useToast();
    const svgRef = useRef<SVGSVGElement>(null);

    const [name, setName] = useState(layout?.name || 'Sơ đồ mới');
    const [canvasW, setCanvasW] = useState(layout?.width || 1200);
    const [canvasH, setCanvasH] = useState(layout?.height || 800);
    const [activeTool, setActiveTool] = useState<ToolId>('ZONE');
    const [shapes, setShapes] = useState<LayoutShape[]>(() => initShapes(layout));
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [zoom, setZoom] = useState(1);

    // Drawing state (refs to avoid stale closures)
    const [drawPreview, setDrawPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
    const drawingRef = useRef(false);
    const drawStartRef = useRef({ x: 0, y: 0 });

    // Dragging state
    const draggingRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
    const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null);

    // Label popup
    const [labelPopup, setLabelPopup] = useState<{ shapeId: string; value: string } | null>(null);
    // Rack config popup
    const [rackPopup, setRackPopup] = useState<{ shapeId: string; prefix: string; rows: number; cols: number } | null>(null);
    // Radius popup
    const [radiusPopup, setRadiusPopup] = useState<{ shapeId: string; radii: [number, number, number, number] } | null>(null);

    const createRoundedRectPath = (x: number, y: number, w: number, h: number, radii: [number, number, number, number]) => {
        let [rTL, rTR, rBR, rBL] = radii;
        const minD = Math.min(w, h) / 2;
        rTL = Math.min(rTL, minD);
        rTR = Math.min(rTR, minD);
        rBR = Math.min(rBR, minD);
        rBL = Math.min(rBL, minD);

        const path = [];
        path.push(`M ${x + rTL} ${y}`);
        path.push(`L ${x + w - rTR} ${y}`);
        if (rTR > 0) path.push(`A ${rTR} ${rTR} 0 0 1 ${x + w} ${y + rTR}`);
        path.push(`L ${x + w} ${y + h - rBR}`);
        if (rBR > 0) path.push(`A ${rBR} ${rBR} 0 0 1 ${x + w - rBR} ${y + h}`);
        path.push(`L ${x + rBL} ${y + h}`);
        if (rBL > 0) path.push(`A ${rBL} ${rBL} 0 0 1 ${x} ${y + h - rBL}`);
        path.push(`L ${x} ${y + rTL}`);
        if (rTL > 0) path.push(`A ${rTL} ${rTL} 0 0 1 ${x + rTL} ${y}`);
        path.push('Z');
        return path.join(' ');
    };

    const getSvgPoint = useCallback((e: React.MouseEvent): { x: number; y: number } => {
        const svg = svgRef.current;
        if (!svg) return { x: 0, y: 0 };
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const ctm = svg.getScreenCTM();
        if (!ctm) return { x: 0, y: 0 };
        const p = pt.matrixTransform(ctm.inverse());
        return { x: snap(p.x), y: snap(p.y) };
    }, []);

    // ---- Mouse Handlers ----
    const onMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (labelPopup || rackPopup || radiusPopup) return;
        if (e.button !== 0) return;
        e.preventDefault();
        const pt = getSvgPoint(e);

        if (activeTool === 'SELECT') {
            // Hit test (reverse for z-order)
            const hit = [...shapes].reverse().find(s => {
                const sx = dragPos?.id === s.id ? dragPos.x : s.x;
                const sy = dragPos?.id === s.id ? dragPos.y : s.y;
                return pt.x >= sx && pt.x <= sx + s.width && pt.y >= sy && pt.y <= sy + s.height;
            });
            if (hit) {
                setSelectedId(hit.id);
                draggingRef.current = { id: hit.id, offsetX: pt.x - hit.x, offsetY: pt.y - hit.y };
            } else {
                setSelectedId(null);
            }
        } else if (activeTool === 'DOOR' || activeTool === 'PILLAR') {
            const isPillar = activeTool === 'PILLAR';
            const newShape: LayoutShape = {
                id: crypto.randomUUID(),
                type: activeTool,
                x: pt.x,
                y: pt.y,
                width: isPillar ? GRID * 2 : GRID * 3,
                height: isPillar ? GRID * 2 : GRID,
                rotation: 0,
            };
            setShapes(prev => [...prev, newShape]);
            setSelectedId(newShape.id);
            setLabelPopup({ shapeId: newShape.id, value: '' });
        } else {
            drawingRef.current = true;
            drawStartRef.current = pt;
            setDrawPreview({ x: pt.x, y: pt.y, w: 0, h: 0 });
        }
    }, [activeTool, shapes, labelPopup, rackPopup, getSvgPoint, dragPos]);

    const onMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        const pt = getSvgPoint(e);

        if (drawingRef.current) {
            const sx = drawStartRef.current.x;
            const sy = drawStartRef.current.y;
            setDrawPreview({
                x: Math.min(sx, pt.x),
                y: Math.min(sy, pt.y),
                w: Math.abs(pt.x - sx),
                h: Math.abs(pt.y - sy),
            });
        } else if (draggingRef.current) {
            const d = draggingRef.current;
            setDragPos({
                id: d.id,
                x: snap(pt.x - d.offsetX),
                y: snap(pt.y - d.offsetY),
            });
        }
    }, [getSvgPoint]);

    const onMouseUp = useCallback(() => {
        if (drawingRef.current && drawPreview) {
            drawingRef.current = false;
            const w = Math.max(drawPreview.w, MIN_SIZE);
            const h = Math.max(drawPreview.h, MIN_SIZE);
            const newShape: LayoutShape = {
                id: crypto.randomUUID(),
                type: activeTool as ShapeType,
                x: drawPreview.x,
                y: drawPreview.y,
                width: w,
                height: h,
            };
            setShapes(prev => [...prev, newShape]);
            setSelectedId(newShape.id);
            setDrawPreview(null);

            if (activeTool === 'RACK') {
                setRackPopup({ shapeId: newShape.id, prefix: '', rows: 2, cols: 3 });
            } else {
                setLabelPopup({ shapeId: newShape.id, value: '' });
            }
        } else if (draggingRef.current && dragPos) {
            setShapes(prev => prev.map(s =>
                s.id === dragPos.id ? { ...s, x: dragPos.x, y: dragPos.y } : s
            ));
            draggingRef.current = null;
            setDragPos(null);
        } else {
            drawingRef.current = false;
            draggingRef.current = null;
            setDrawPreview(null);
        }
    }, [activeTool, drawPreview, dragPos]);

    // Global mouseup fallback
    useEffect(() => {
        const handler = () => {
            if (drawingRef.current) {
                drawingRef.current = false;
                setDrawPreview(null);
            }
            if (draggingRef.current) {
                draggingRef.current = null;
            }
        };
        window.addEventListener('mouseup', handler);
        return () => window.removeEventListener('mouseup', handler);
    }, []);

    // Delete with keyboard
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !labelPopup) {
                setShapes(prev => prev.filter(s => s.id !== selectedId));
                setSelectedId(null);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [selectedId, labelPopup]);

    const handleLabelConfirm = () => {
        if (!labelPopup) return;
        const val = labelPopup.value.trim().toUpperCase();
        if (labelPopup.value && !val) {
            showToast('Mã vị trí không hợp lệ', 'warning');
            return;
        }
        setShapes(prev => prev.map(s =>
            s.id === labelPopup.shapeId ? { ...s, label: val || undefined } : s
        ));
        setLabelPopup(null);
    };

    const handleLabelCancel = () => {
        setLabelPopup(null);
    };

    const handleRackConfirm = () => {
        if (!rackPopup) return;
        const { shapeId, prefix, rows, cols } = rackPopup;
        const p = prefix.trim().toUpperCase() || 'R';
        const codes: string[] = [];
        for (let r = 1; r <= rows; r++) {
            for (let c = 1; c <= cols; c++) {
                codes.push(`${p}-${String(r).padStart(2,'0')}${String(c).padStart(2,'0')}`);
            }
        }
        setShapes(prev => prev.map(s =>
            s.id === shapeId ? { ...s, label: p, rows, cols, positions: codes } : s
        ));
        setRackPopup(null);
    };

    const handleRackCancel = () => {
        setRackPopup(null);
    };

    const handleRadiusConfirm = () => {
        if (!radiusPopup) return;
        setShapes(prev => prev.map(s => 
            s.id === radiusPopup.shapeId ? { ...s, customRadii: radiusPopup.radii } : s
        ));
        setRadiusPopup(null);
    };

    const handleRadiusCancel = () => {
        setRadiusPopup(null);
    };

    const handleDeleteSelected = () => {
        if (!selectedId) return;
        setShapes(prev => prev.filter(s => s.id !== selectedId));
        setSelectedId(null);
    };

    const handleSave = async () => {
        if (!name.trim()) { showToast('Vui lòng nhập tên sơ đồ', 'warning'); return; }
        setIsSaving(true);
        try {
            const layoutData: LayoutInput = {
                system_type: systemType,
                name: name.trim(),
                width: canvasW,
                height: canvasH,
                grid_data: shapes,
                is_active: true,
            };
            if (layout?.id) {
                await layoutService.saveLayout({ ...layoutData, id: layout.id } as WarehouseLayout);
            } else {
                await layoutService.saveLayout(layoutData);
            }
            showToast('Đã lưu sơ đồ thành công!', 'success');
            onSaveSuccess();
        } catch (err: any) {
            showToast(err.message || 'Lỗi khi lưu', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const selectedShape = shapes.find(s => s.id === selectedId);

    // ---- Render ----
    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
            {/* Top Toolbar */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex flex-wrap gap-3 items-center justify-between">
                <div className="flex items-center gap-3">
                    <input
                        type="text" value={name} onChange={e => setName(e.target.value)}
                        placeholder="Tên sơ đồ..."
                        className="px-3 py-1.5 border rounded-md dark:bg-gray-800 dark:border-gray-700 font-medium w-48"
                    />
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                        <span>Canvas:</span>
                        <input type="number" min={400} max={3000} step={100} value={canvasW}
                            onChange={e => setCanvasW(parseInt(e.target.value) || 1200)}
                            className="w-16 px-1 py-1 border rounded text-center dark:bg-gray-800 dark:border-gray-700 text-xs"
                        />
                        <span>×</span>
                        <input type="number" min={300} max={2000} step={100} value={canvasH}
                            onChange={e => setCanvasH(parseInt(e.target.value) || 800)}
                            className="w-16 px-1 py-1 border rounded text-center dark:bg-gray-800 dark:border-gray-700 text-xs"
                        />
                    </div>
                    <div className="flex items-center gap-1 border-l pl-3 dark:border-gray-700">
                        <button type="button" onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><ZoomOut className="w-4 h-4" /></button>
                        <span className="text-xs text-gray-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
                        <button type="button" onClick={() => setZoom(z => Math.min(2, z + 0.1))}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><ZoomIn className="w-4 h-4" /></button>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {selectedId && (
                        <button type="button" onClick={handleDeleteSelected}
                            className="px-3 py-1.5 text-sm font-medium rounded-md bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 flex items-center gap-1">
                            <Trash2 className="w-4 h-4" /> Xóa
                        </button>
                    )}
                    {selectedShape && selectedShape.type !== 'RACK' && (
                        <button type="button"
                            onClick={() => setLabelPopup({ shapeId: selectedShape.id, value: selectedShape.label || '' })}
                            className="px-3 py-1.5 text-sm font-medium rounded-md bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 flex items-center gap-1">
                            <Tag className="w-3.5 h-3.5" /> {selectedShape.label ? `Tên: ${selectedShape.label}` : 'Đặt tên'}
                        </button>
                    )}
                    {selectedShape?.type === 'RACK' && (
                        <button type="button"
                            onClick={() => setRackPopup({ shapeId: selectedShape.id, prefix: selectedShape.label || '', rows: selectedShape.rows || 2, cols: selectedShape.cols || 3 })}
                            className="px-3 py-1.5 text-sm font-medium rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400">
                            {selectedShape.positions?.length ? `Sửa kệ (${selectedShape.positions.length} ô)` : 'Cấu hình Kệ hàng'}
                        </button>
                    )}
                    {selectedShape && (selectedShape.type === 'ZONE' || selectedShape.type === 'ROOM') && (
                        <button type="button"
                            onClick={() => setRadiusPopup({ shapeId: selectedShape.id, radii: selectedShape.customRadii || (selectedShape.type === 'ROOM' ? [8,8,8,8] : [4,4,4,4]) })}
                            className="px-3 py-1.5 text-sm font-medium rounded-md bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400 flex items-center gap-1">
                            Bo góc
                        </button>
                    )}
                    {selectedShape && (
                        <button type="button"
                            onClick={() => setShapes(prev => prev.map(s => s.id === selectedId ? { ...s, rotation: ((s.rotation || 0) + 90) % 360 } : s))}
                            className="px-3 py-1.5 text-sm font-medium rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 flex items-center gap-1">
                            <RotateCw className="w-3.5 h-3.5" /> Xoay {((selectedShape.rotation || 0) + 90) % 360}°
                        </button>
                    )}
                    <button type="button" onClick={onClose}
                        className="px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1">
                        <X className="w-4 h-4" /> Hủy
                    </button>
                    <button type="button" onClick={handleSave} disabled={isSaving}
                        className="px-4 py-1.5 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 flex items-center gap-1">
                        <Save className="w-4 h-4" /> {isSaving ? 'Đang lưu...' : 'Lưu Sơ Đồ'}
                    </button>
                </div>
            </div>

            <div className="flex flex-1 min-h-0">
                {/* Left Tools Panel */}
                <div className="w-48 p-3 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 overflow-y-auto flex flex-col gap-1">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Công cụ</h3>
                    {TOOLS.map(tool => (
                        <button key={tool.id} onClick={() => { setActiveTool(tool.id as ToolId); setSelectedId(null); }}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm font-medium transition-colors ${
                                activeTool === tool.id
                                    ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 ring-1 ring-blue-400'
                                    : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                            }`}>
                            <tool.icon className="w-4 h-4" />
                            {tool.label}
                        </button>
                    ))}

                    <div className="mt-6">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Chú thích</h3>
                        <div className="space-y-1.5">
                            {(['ZONE', 'RACK', 'ROOM', 'WALL', 'PATH', 'DOOR', 'PILLAR'] as ShapeType[]).map(type => (
                                <div key={type} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                    <div className={`w-4 h-4 border ${type === 'PILLAR' ? 'rounded-full' : 'rounded'}`} style={{ backgroundColor: SHAPE_FILL[type], borderColor: SHAPE_STROKE[type] }} />
                                    {SHAPE_LABELS[type]}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-xs leading-relaxed">
                        <p><strong>Vẽ:</strong> Chọn công cụ → kéo thả trên canvas.</p>
                        <p className="mt-1"><strong>Di chuyển:</strong> Dùng công cụ &quot;Chọn&quot; → kéo thả hình.</p>
                        <p className="mt-1"><strong>Xóa:</strong> Chọn hình → nhấn Delete hoặc nút Xóa.</p>
                        <p className="mt-1"><strong>Mã vị trí:</strong> Vẽ xong Khu vực → nhập mã ngay.</p>
                    </div>
                </div>

                {/* SVG Canvas */}
                <div className="flex-1 overflow-auto bg-gray-200 dark:bg-gray-950 relative">
                    {/* Label Popup */}
                    {labelPopup && (
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-white dark:bg-gray-800 p-5 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-80">
                            <h4 className="font-bold mb-1 text-gray-900 dark:text-white text-base">Đặt Mã Vị Trí</h4>
                            <p className="text-xs text-gray-500 mb-4">Mã này sẽ được đồng bộ vào hệ thống để gán hàng hóa.</p>
                            <input
                                autoFocus type="text" value={labelPopup.value}
                                onChange={e => setLabelPopup(prev => prev ? { ...prev, value: e.target.value } : null)}
                                placeholder="VD: A1, KHO-LANH-01..."
                                className="w-full px-3 py-2 border rounded-md mb-4 dark:bg-gray-900 dark:border-gray-700 dark:text-white uppercase text-sm"
                                onKeyDown={e => e.key === 'Enter' && handleLabelConfirm()}
                            />
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={handleLabelCancel} className="px-3 py-1.5 text-sm rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600">Bỏ qua</button>
                                <button type="button" onClick={handleLabelConfirm} className="px-4 py-1.5 text-sm rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium">Xác nhận</button>
                            </div>
                        </div>
                    )}

                    {/* Rack Config Popup */}
                    {rackPopup && (
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-white dark:bg-gray-800 p-5 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-80">
                            <h4 className="font-bold mb-1 text-gray-900 dark:text-white text-base">Cấu hình Kệ Hàng</h4>
                            <p className="text-xs text-gray-500 mb-3">Nhập tiền tố và số hàng/cột. Hệ thống sẽ tự tạo mã vị trí.</p>
                            <div className="space-y-2 mb-4">
                                <input autoFocus type="text" value={rackPopup.prefix}
                                    onChange={e => setRackPopup(prev => prev ? { ...prev, prefix: e.target.value } : null)}
                                    placeholder="Tiền tố VD: KE-A" className="w-full px-3 py-2 border rounded-md dark:bg-gray-900 dark:border-gray-700 dark:text-white uppercase text-sm" />
                                <div className="flex gap-2">
                                    <label className="flex-1"><span className="text-xs text-gray-500">Hàng</span>
                                        <input type="number" min={1} max={20} value={rackPopup.rows}
                                            onChange={e => setRackPopup(prev => prev ? { ...prev, rows: parseInt(e.target.value) || 1 } : null)}
                                            className="w-full px-2 py-1.5 border rounded-md dark:bg-gray-900 dark:border-gray-700 text-sm" />
                                    </label>
                                    <label className="flex-1"><span className="text-xs text-gray-500">Cột</span>
                                        <input type="number" min={1} max={20} value={rackPopup.cols}
                                            onChange={e => setRackPopup(prev => prev ? { ...prev, cols: parseInt(e.target.value) || 1 } : null)}
                                            className="w-full px-2 py-1.5 border rounded-md dark:bg-gray-900 dark:border-gray-700 text-sm" />
                                    </label>
                                </div>
                                <p className="text-xs text-gray-400">Sẽ tạo {rackPopup.rows * rackPopup.cols} vị trí: {(rackPopup.prefix.trim().toUpperCase() || 'R')}-0101 ... {(rackPopup.prefix.trim().toUpperCase() || 'R')}-{String(rackPopup.rows).padStart(2,'0')}{String(rackPopup.cols).padStart(2,'0')}</p>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={handleRackCancel} className="px-3 py-1.5 text-sm rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-700">Hủy</button>
                                <button type="button" onClick={handleRackConfirm} className="px-4 py-1.5 text-sm rounded-md bg-amber-600 hover:bg-amber-700 text-white font-medium">Xác nhận</button>
                            </div>
                        </div>
                    )}

                    {/* Radius Config Popup */}
                    {radiusPopup && (
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-white dark:bg-gray-800 p-5 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-80">
                            <h4 className="font-bold mb-1 text-gray-900 dark:text-white text-base">Cấu hình Bo Góc</h4>
                            <p className="text-xs text-gray-500 mb-4">Nhập bán kính bo góc cho từng góc (pixel).</p>
                            
                            <div className="grid grid-cols-2 gap-4 mb-5">
                                <label className="flex flex-col gap-1">
                                    <span className="text-xs font-semibold text-gray-600">Góc trên - trái</span>
                                    <input type="number" min={0} value={radiusPopup.radii[0]} onChange={(e) => setRadiusPopup({ ...radiusPopup, radii: [parseInt(e.target.value)||0, radiusPopup.radii[1], radiusPopup.radii[2], radiusPopup.radii[3]] })} className="px-3 py-1.5 border rounded-md" />
                                </label>
                                <label className="flex flex-col gap-1">
                                    <span className="text-xs font-semibold text-gray-600">Góc trên - phải</span>
                                    <input type="number" min={0} value={radiusPopup.radii[1]} onChange={(e) => setRadiusPopup({ ...radiusPopup, radii: [radiusPopup.radii[0], parseInt(e.target.value)||0, radiusPopup.radii[2], radiusPopup.radii[3]] })} className="px-3 py-1.5 border rounded-md" />
                                </label>
                                <label className="flex flex-col gap-1">
                                    <span className="text-xs font-semibold text-gray-600">Góc dưới - trái</span>
                                    <input type="number" min={0} value={radiusPopup.radii[3]} onChange={(e) => setRadiusPopup({ ...radiusPopup, radii: [radiusPopup.radii[0], radiusPopup.radii[1], radiusPopup.radii[2], parseInt(e.target.value)||0] })} className="px-3 py-1.5 border rounded-md" />
                                </label>
                                <label className="flex flex-col gap-1">
                                    <span className="text-xs font-semibold text-gray-600">Góc dưới - phải</span>
                                    <input type="number" min={0} value={radiusPopup.radii[2]} onChange={(e) => setRadiusPopup({ ...radiusPopup, radii: [radiusPopup.radii[0], radiusPopup.radii[1], parseInt(e.target.value)||0, radiusPopup.radii[3]] })} className="px-3 py-1.5 border rounded-md" />
                                </label>
                            </div>
                            <div className="flex gap-2 mb-4 justify-between">
                                <button type="button" onClick={() => setRadiusPopup({ ...radiusPopup, radii: [0,0,0,0] })} className="text-xs px-2 py-1 bg-gray-100 rounded">Vuông</button>
                                <button type="button" onClick={() => setRadiusPopup({ ...radiusPopup, radii: [16,16,16,16] })} className="text-xs px-2 py-1 bg-gray-100 rounded">Bo tròn</button>
                                <button type="button" onClick={() => setRadiusPopup({ ...radiusPopup, radii: [16,16,0,0] })} className="text-xs px-2 py-1 bg-gray-100 rounded">Chỉ trên</button>
                            </div>

                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={handleRadiusCancel} className="px-3 py-1.5 text-sm rounded-md bg-gray-100 hover:bg-gray-200">Hủy</button>
                                <button type="button" onClick={handleRadiusConfirm} className="px-4 py-1.5 text-sm rounded-md bg-teal-600 hover:bg-teal-700 text-white font-medium">Lưu góc</button>
                            </div>
                        </div>
                    )}

                    <svg
                        ref={svgRef}
                        width={canvasW * zoom}
                        height={canvasH * zoom}
                        viewBox={`0 0 ${canvasW} ${canvasH}`}
                        className="bg-white shadow-lg cursor-crosshair"
                        style={{ minWidth: canvasW * zoom, minHeight: canvasH * zoom }}
                        onMouseDown={onMouseDown}
                        onMouseMove={onMouseMove}
                        onMouseUp={onMouseUp}
                        onDragStart={e => e.preventDefault()}
                    >
                        {/* Grid */}
                        <defs>
                            <pattern id="smallGrid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                                <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
                            </pattern>
                            <pattern id="grid" width={GRID * 5} height={GRID * 5} patternUnits="userSpaceOnUse">
                                <rect width={GRID * 5} height={GRID * 5} fill="url(#smallGrid)" />
                                <path d={`M ${GRID * 5} 0 L 0 0 0 ${GRID * 5}`} fill="none" stroke="#d1d5db" strokeWidth="1" />
                            </pattern>
                        </defs>
                        <rect width={canvasW} height={canvasH} fill="url(#grid)" />

                        {/* Shapes */}
                        {shapes.map(shape => {
                            const sx = dragPos?.id === shape.id ? dragPos.x : shape.x;
                            const sy = dragPos?.id === shape.id ? dragPos.y : shape.y;
                            const isSelected = shape.id === selectedId;
                            const rot = shape.rotation || 0;
                            const cx = sx + shape.width / 2;
                            const cy = sy + shape.height / 2;
                            const rotTransform = rot ? `rotate(${rot} ${cx} ${cy})` : undefined;

                            const selBox = isSelected && (
                                <>
                                    <rect x={sx - 2} y={sy - 2} width={shape.width + 4} height={shape.height + 4}
                                        fill="none" stroke="#3b82f6" strokeWidth={2} strokeDasharray="6 3" rx={4} />
                                    {[[sx - 4, sy - 4], [sx + shape.width, sy - 4], [sx - 4, sy + shape.height], [sx + shape.width, sy + shape.height]].map(([hx, hy], i) => (
                                        <rect key={i} x={hx} y={hy} width={8} height={8} fill="#3b82f6" stroke="white" strokeWidth={1} rx={1} />
                                    ))}
                                </>
                            );

                            // PILLAR: circle
                            if (shape.type === 'PILLAR') {
                                const r = Math.min(shape.width, shape.height) / 2;
                                return (
                                    <g key={shape.id} transform={rotTransform}>
                                        <circle cx={cx} cy={cy} r={r}
                                            fill={SHAPE_FILL.PILLAR} stroke={SHAPE_STROKE.PILLAR} strokeWidth={2} />
                                        {shape.label && (
                                            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
                                                fontSize={9} fontWeight="bold" fill="#334155" style={{ userSelect: 'none' }}>{shape.label}</text>
                                        )}
                                        {selBox}
                                    </g>
                                );
                            }

                            // DOOR
                            if (shape.type === 'DOOR') {
                                return (
                                    <g key={shape.id} transform={rotTransform}>
                                        <rect x={sx} y={sy} width={shape.width} height={shape.height}
                                            fill={SHAPE_FILL.DOOR} stroke={SHAPE_STROKE.DOOR} strokeWidth={2} rx={3} />
                                        <path d={`M ${sx + 4} ${sy + shape.height} A ${shape.width - 8} ${shape.width - 8} 0 0 1 ${sx + shape.width - 4} ${sy + shape.height}`}
                                            fill="none" stroke={SHAPE_STROKE.DOOR} strokeWidth={1.5} strokeDasharray="4 2" />
                                        <text x={sx + shape.width / 2} y={sy + shape.height / 2 - 2} textAnchor="middle" dominantBaseline="central"
                                            fontSize={10} fontWeight="bold" fill={SHAPE_STROKE.DOOR}>🚪 {shape.label || ''}</text>
                                        {selBox}
                                    </g>
                                );
                            }

                            // RACK: rectangle with internal grid cells
                            if (shape.type === 'RACK' && shape.rows && shape.cols) {
                                const cellW = shape.width / shape.cols;
                                const cellH = shape.height / shape.rows;
                                return (
                                    <g key={shape.id} transform={rotTransform}>
                                        <rect x={sx} y={sy} width={shape.width} height={shape.height}
                                            fill={SHAPE_FILL.RACK} stroke={SHAPE_STROKE.RACK} strokeWidth={2} />
                                        {/* Grid lines */}
                                        {Array.from({ length: shape.rows - 1 }).map((_, i) => (
                                            <line key={`r${i}`} x1={sx} y1={sy + (i + 1) * cellH} x2={sx + shape.width} y2={sy + (i + 1) * cellH}
                                                stroke={SHAPE_STROKE.RACK} strokeWidth={0.8} />
                                        ))}
                                        {Array.from({ length: shape.cols - 1 }).map((_, i) => (
                                            <line key={`c${i}`} x1={sx + (i + 1) * cellW} y1={sy} x2={sx + (i + 1) * cellW} y2={sy + shape.height}
                                                stroke={SHAPE_STROKE.RACK} strokeWidth={0.8} />
                                        ))}
                                        {/* Cell position codes */}
                                        {(shape.positions || []).map((code, idx) => {
                                            const row = Math.floor(idx / shape.cols!);
                                            const col = idx % shape.cols!;
                                            return (
                                                <text key={idx} x={sx + col * cellW + cellW / 2} y={sy + row * cellH + cellH / 2}
                                                    textAnchor="middle" dominantBaseline="central"
                                                    fontSize={Math.min(10, cellW / 5)} fill="#92400e" fontWeight="600"
                                                    style={{ userSelect: 'none' }}>
                                                    {code}
                                                </text>
                                            );
                                        })}
                                        {/* Header label */}
                                        {shape.label && (
                                            <text x={sx + shape.width / 2} y={sy - 6} textAnchor="middle" fontSize={11}
                                                fontWeight="bold" fill={SHAPE_STROKE.RACK} style={{ userSelect: 'none' }}>
                                                {shape.label}
                                            </text>
                                        )}
                                        {selBox}
                                    </g>
                                );
                            }

                            // ROOM: dashed border container
                            if (shape.type === 'ROOM') {
                                const d = createRoundedRectPath(sx, sy, shape.width, shape.height, shape.customRadii || [8,8,8,8]);
                                return (
                                    <g key={shape.id} transform={rotTransform}>
                                        <path d={d}
                                            fill={SHAPE_FILL.ROOM} fillOpacity={0.4} stroke={SHAPE_STROKE.ROOM} strokeWidth={isSelected ? 3 : 2.5}
                                            strokeDasharray="10 4" />
                                        <path d={createRoundedRectPath(sx, sy, shape.width, 22, [shape.customRadii?.[0]||8, shape.customRadii?.[1]||8, 0, 0])}
                                            fill={SHAPE_STROKE.ROOM} fillOpacity={0.15} />
                                        <text x={sx + 8} y={sy + 14} fontSize={11} fontWeight="bold" fill={SHAPE_STROKE.ROOM} className="pointer-events-none select-none">{shape.label || 'Phòng'}</text>
                                        {selBox}
                                    </g>
                                );
                            }

                            // Default: ZONE, WALL, PATH, generic RACK
                            const d = createRoundedRectPath(sx, sy, shape.width, shape.height, shape.customRadii || (shape.type === 'ZONE' ? [4,4,4,4] : [0,0,0,0]));
                            return (
                                <g key={shape.id} transform={rotTransform}>
                                    <path d={d}
                                        fill={SHAPE_FILL[shape.type] || SHAPE_FILL.ZONE}
                                        stroke={isSelected ? '#3b82f6' : (SHAPE_STROKE[shape.type] || SHAPE_STROKE.ZONE)}
                                        strokeWidth={isSelected ? 3 : 2} opacity={0.85} />
                                    {shape.label && (
                                        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
                                            fontSize={Math.min(14, shape.width / shape.label.length * 1.5, shape.height * 0.4)}
                                            fontWeight="bold" fill="#78350f" className="pointer-events-none select-none">{shape.label}</text>
                                    )}
                                    {!shape.label && shape.width > 50 && (
                                        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
                                            fontSize={10} fill="#64748b" style={{ userSelect: 'none' }}>
                                            {SHAPE_LABELS[shape.type] || ''}
                                        </text>
                                    )}
                                    {selBox}
                                </g>
                            );
                        })}

                        {/* Draw Preview */}
                        {drawPreview && drawPreview.w > 0 && drawPreview.h > 0 && (
                            <rect x={drawPreview.x} y={drawPreview.y} width={drawPreview.w} height={drawPreview.h}
                                fill={SHAPE_FILL[activeTool as ShapeType] || '#fed7aa'} fillOpacity={0.4}
                                stroke={SHAPE_STROKE[activeTool as ShapeType] || '#ea580c'}
                                strokeWidth={2} strokeDasharray="8 4" rx={activeTool === 'ZONE' ? 4 : 0} />
                        )}
                    </svg>
                </div>
            </div>
        </div>
    );
}
