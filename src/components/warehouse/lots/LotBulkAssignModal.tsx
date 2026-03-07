import { useState, useEffect } from 'react'
import { X, Save, Layers, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { Lot } from '@/app/(dashboard)/warehouses/lots/_hooks/useLotManagement'
import { useSystem } from '@/contexts/SystemContext'

interface LotBulkAssignModalProps {
    onClose: () => void
    onSuccess: (close?: boolean) => void
    fetchUnassignedLots: (limit: number) => Promise<Lot[]>
    initialUnassignedCount?: number
}

export function LotBulkAssignModal({ onClose, onSuccess, fetchUnassignedLots, initialUnassignedCount }: LotBulkAssignModalProps) {
    const { showToast } = useToast()
    const { currentSystem } = useSystem()
    const [loading, setLoading] = useState(false)
    const [textInput, setTextInput] = useState('')
    const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual')
    const [halls, setHalls] = useState<any[]>([])
    const [loadingHalls, setLoadingHalls] = useState(false)
    const [loadingCount, setLoadingCount] = useState(false)
    const [unassignedCount, setUnassignedCount] = useState(initialUnassignedCount ?? 0)
    const [expandedWarehouse, setExpandedWarehouse] = useState<string | null>(null)

    // Sync with parent count if it changes
    useEffect(() => {
        if (typeof initialUnassignedCount === 'number') {
            setUnassignedCount(initialUnassignedCount);
        }
    }, [initialUnassignedCount]);

    // Results state
    const [results, setResults] = useState<{
        success: string[];
        missing: string[];
        assigned: string[];
        unmatched: string[];
    } | null>(null);

    useEffect(() => {
        if (currentSystem?.code) {
            fetchInitialData();
        }
    }, [currentSystem?.code]);

    const fetchInitialData = async () => {
        if (!currentSystem?.code) return;
        setLoadingHalls(true);
        try {
            // 1. Fetch all zones to resolve names/hierarchy
            const { data: allZonesData } = await supabase
                .from('zones')
                .select('id, name, parent_id')
                .eq('system_type', currentSystem.code);

            const zoneMap = new Map();
            (allZonesData || []).forEach(z => zoneMap.set(z.id, z));

            // 2. Fetch Halls
            const { data: hallData } = await supabase
                .from('zones')
                .select('id, name, display_order, parent_id')
                .eq('system_type', currentSystem.code)
                .eq('is_hall', true)
                .order('display_order', { ascending: true })
                .order('name', { ascending: true });

            // 3. For each hall, count empty positions and resolve parent
            const hallResults = await Promise.all((hallData || []).map(async (hall) => {
                const descIds = getDescendantIds(hall.id, allZonesData || []);

                // Count empty positions
                const { count } = await supabase
                    .from('positions')
                    .select('id, zone_positions!inner(zone_id)', { count: 'exact', head: true })
                    .eq('system_type', currentSystem.code)
                    .is('lot_id', null)
                    .in('zone_positions.zone_id', descIds);

                // Build parent name path (at least one level up)
                let parentName = '';
                if (hall.parent_id) {
                    const parentZone = zoneMap.get(hall.parent_id);
                    if (parentZone) {
                        parentName = parentZone.name;
                        // Optional: go one more level up if needed
                        if (parentZone.parent_id) {
                            const grandParent = zoneMap.get(parentZone.parent_id);
                            if (grandParent) {
                                parentName = `${grandParent.name} > ${parentName}`;
                            }
                        }
                    }
                }

                return {
                    ...hall,
                    emptyCount: count || 0,
                    parentName: parentName || currentSystem.name // Fallback to system name
                };
            }));

            // 4. Count Unassigned Lots (Fresh fetch for verification)
            setLoadingCount(true);
            try {
                // Use robust join logic for fresh verification count
                const { count: lotCount, error: countError } = await supabase.from('lots')
                    .select('id, positions!left(id)', { count: 'exact', head: true })
                    .eq('system_code', currentSystem.code)
                    .is('positions', null)
                    .neq('status', 'hidden');

                if (countError) {
                    console.error('Count error from robust query:', countError);
                    // Keep using initialUnassignedCount
                } else if (lotCount !== null) {
                    setUnassignedCount(prev => Math.max(prev, lotCount));
                }
            } catch (err) {
                console.error('Error in count fetch:', err);
            } finally {
                setLoadingCount(false);
            }

            setHalls(hallResults);
        } catch (err) {
            console.error('Error fetching initial data:', err);
        } finally {
            setLoadingHalls(false);
        }
    };

    const getDescendantIds = (rootId: string, allZones: any[]) => {
        const descIds = new Set<string>([rootId]);
        let changed = true;
        while (changed) {
            changed = false;
            for (const zone of allZones) {
                if (zone.parent_id && descIds.has(zone.parent_id) && !descIds.has(zone.id)) {
                    descIds.add(zone.id);
                    changed = true;
                }
            }
        }
        return Array.from(descIds);
    };

    const handleAutoAssignHall = async (hall: any) => {
        if (!currentSystem?.code) return;
        if (hall.emptyCount === 0) {
            showToast('Không có vị trí trống trong sảnh này.', 'warning');
            return;
        }
        if (unassignedCount === 0) {
            showToast('Không có LOT nào chưa gán vị trí.', 'warning');
            return;
        }

        setLoading(true);
        try {
            // 1. Get all descendant zones
            const { data: allZones } = await supabase.from('zones').select('id, parent_id').eq('system_type', currentSystem.code);
            const descIds = getDescendantIds(hall.id, allZones || []);

            // 2. Fetch available positions
            const { data: posData } = await supabase
                .from('positions')
                .select('id, code, zone_positions!inner(zone_id)')
                .eq('system_type', currentSystem.code)
                .is('lot_id', null)
                .in('zone_positions.zone_id', descIds)
                .order('code');

            if (!posData || posData.length === 0) {
                showToast('Không tìm thấy vị trí trống.', 'error');
                return;
            }

            // Numeric sort in memory since Supabase JS client order() doesn't officially support 'numeric' option in all versions/types
            posData.sort((a, b) => (a.code || '').localeCompare(b.code || '', undefined, { numeric: true }));

            // 3. Fetch unassigned lots
            const lotsToAssign = await fetchUnassignedLots(posData.length);
            if (lotsToAssign.length === 0) {
                showToast('Không có LOT phù hợp để gán.', 'warning');
                return;
            }

            const actualCount = Math.min(posData.length, lotsToAssign.length);
            const historyInserts = [];

            for (let i = 0; i < actualCount; i++) {
                const lot = lotsToAssign[i];
                const pos = posData[i];

                await supabase.from('positions').update({ lot_id: lot.id }).eq('id', pos.id);

                historyInserts.push({
                    system_code: currentSystem.code,
                    action_type: 'assign_position',
                    entity_type: 'lot',
                    entity_id: lot.id,
                    details: {
                        position_code: pos.code,
                        position_id: pos.id,
                        auto_assign_hall: hall.name,
                        bulk_assign: true
                    }
                });
            }

            if (historyInserts.length > 0) {
                await (supabase as any).from('operation_history').insert(historyInserts);
            }

            showToast(`Gán thành công ${actualCount} LOT vào ${hall.name}!`, 'success');
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Error in auto assign hall:', err);
            showToast('Lỗi khi gán tự động: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAssign = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!currentSystem?.code) return;

        // 1. Parse Input
        const rawCodes = textInput.split(/[\n,;\t]+/).map(c => c.trim().toUpperCase()).filter(c => c !== '');
        // Unique codes
        const uniqueCodes = Array.from(new Set(rawCodes));

        if (uniqueCodes.length === 0) {
            showToast('Vui lòng nhập ít nhất một mã vị trí.', 'warning');
            return;
        }

        setLoading(true);
        setResults(null);

        try {
            // 2. Validate Positions
            // We might have more than 100 codes, chunk the querying if necessary, but typically < 200.
            const { data: posData, error: posError } = await supabase
                .from('positions')
                .select('id, lot_id, code')
                .eq('system_type', currentSystem.code)
                .in('code', uniqueCodes);

            if (posError) throw posError;

            const existingPositions = posData || [];
            const posMap = new Map();
            existingPositions.forEach(p => posMap.set(p.code, p));

            const validPositions: { id: string, code: string }[] = [];
            const missingCodes: string[] = [];
            const assignedCodes: string[] = [];

            for (const code of uniqueCodes) {
                const p = posMap.get(code);
                if (!p) {
                    missingCodes.push(code);
                } else if (p.lot_id) {
                    assignedCodes.push(code);
                } else {
                    validPositions.push({ id: p.id, code: p.code });
                }
            }

            if (missingCodes.length > 0) {
                showToast(`Không tìm thấy các mã vị trí sau:\n${missingCodes.join(', ')}`, 'error');
                setLoading(false);
                return;
            }

            if (assignedCodes.length > 0) {
                showToast(`Các vị trí sau đã có LOT:\n${assignedCodes.join(', ')}`, 'error');
                setLoading(false);
                return;
            }

            if (validPositions.length === 0) {
                showToast('Không có mã vị trí hợp lệ nào để gán.', 'warning');
                setLoading(false);
                return;
            }

            // 3. Fetch Unassigned Lots
            const lotsToAssign = await fetchUnassignedLots(validPositions.length);

            if (lotsToAssign.length === 0) {
                showToast('Không có LOT nào đang trống vị trí phù hợp với bộ lọc hiện tại.', 'warning');
                setLoading(false);
                return;
            }

            const actualUpdateCount = Math.min(validPositions.length, lotsToAssign.length);

            // 4. Perform Mapping and Update
            const historyInserts = [];

            for (let i = 0; i < actualUpdateCount; i++) {
                const lot = lotsToAssign[i];
                const pos = validPositions[i];

                // Remove any current position mapping defensively
                await supabase.from('positions').update({ lot_id: null }).eq('lot_id', lot.id);

                // Assign new
                const { error: assignError } = await supabase
                    .from('positions')
                    .update({ lot_id: lot.id })
                    .eq('id', pos.id);

                if (assignError) throw assignError;

                historyInserts.push({
                    system_code: currentSystem.code,
                    action_type: 'assign_position',
                    entity_type: 'lot',
                    entity_id: lot.id,
                    details: {
                        position_code: pos.code,
                        position_id: pos.id,
                        bulk_assign: true
                    }
                });
            }

            if (historyInserts.length > 0) {
                await (supabase as any).from('operation_history').insert(historyInserts);
            }

            const successCodes = validPositions.slice(0, actualUpdateCount).map(p => p.code);
            const unmatchedCodes = validPositions.slice(actualUpdateCount).map(p => p.code);

            setResults({
                success: successCodes,
                missing: missingCodes,
                assigned: assignedCodes,
                unmatched: unmatchedCodes
            });

            if (actualUpdateCount < validPositions.length || missingCodes.length > 0 || assignedCodes.length > 0) {
                showToast(`Đã xử lý xong. Có ${missingCodes.length + assignedCodes.length + unmatchedCodes.length} mã lỗi.`, 'warning');
            } else {
                showToast(`Gán thành công toàn bộ ${actualUpdateCount} vị trí!`, 'success');
            }

            // Still call onSuccess to refresh the parent list, but keep modal open to show results
            onSuccess(false);
        } catch (err: any) {
            console.error('Error in bulk assign:', err);
            showToast('Lỗi khi gán hàng loạt: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 h-[85vh] max-h-[700px]">
                <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Layers size={20} className="text-orange-500" />
                        Nhập vị trí hàng loạt
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {!results ? (
                    <div className="flex flex-col flex-1 overflow-hidden">
                        {/* Tabs */}
                        <div className="flex border-b border-slate-100 dark:border-slate-800">
                            <button
                                onClick={() => setActiveTab('manual')}
                                className={`flex-1 py-3 text-sm font-bold transition-colors relative ${activeTab === 'manual'
                                    ? 'text-orange-600'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                Nhập mã thủ công
                                {activeTab === 'manual' && (
                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600" />
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('auto')}
                                className={`flex-1 py-3 text-sm font-bold transition-colors relative ${activeTab === 'auto'
                                    ? 'text-orange-600'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                Gán sảnh tự động
                                {activeTab === 'auto' && (
                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600" />
                                )}
                            </button>
                        </div>

                        {activeTab === 'manual' ? (
                            <form onSubmit={handleAssign} className="p-4 space-y-4 overflow-y-auto">
                                <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 p-3 rounded-xl text-sm leading-relaxed border border-blue-100 dark:border-blue-800/50">
                                    <p className="font-semibold mb-1">Cách thức hoạt động:</p>
                                    <ul className="list-disc pl-5 space-y-1 opacity-90">
                                        <li>Nhập danh sách mã vị trí (cách nhau bởi xuống dòng, dấu phẩy, hoặc chấm phẩy).</li>
                                        <li>Hệ thống sẽ tự động tìm kiếm các LOT <b>chưa gán vị trí</b> (ưu tiên theo bộ lọc hiện tại) để gán lần lượt.</li>
                                        <li>Bỏ qua các vị trí không tồn tại hoặc đã được gán.</li>
                                    </ul>
                                </div>

                                <div>
                                    <label className="text-xs text-slate-500 font-medium mb-1 uppercase tracking-wider block">Danh sách mã vị trí</label>
                                    <textarea
                                        value={textInput}
                                        onChange={(e) => setTextInput(e.target.value)}
                                        placeholder="VD:&#10;A-1-1&#10;A-1-2&#10;A-1-3"
                                        className="w-full h-48 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all resize-none shadow-inner text-sm font-mono placeholder:font-sans"
                                    />
                                    <div className="mt-1 flex justify-between text-xs text-slate-400">
                                        <span>Có thể copy từ file Excel và paste vào đây.</span>
                                        <span className="font-semibold">{textInput.split(/[\n,;\t]+/).filter(c => c.trim() !== '').length} mã đang nhập</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium transition-colors"
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading || textInput.trim() === ''}
                                        className={`px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2 ${loading ? 'opacity-75 cursor-wait' : ''}`}
                                    >
                                        <Save size={16} />
                                        {loading ? 'Đang xử lý...' : 'Thực hiện gán'}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="p-4 space-y-4 overflow-y-auto min-h-[400px]">
                                <div className="bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 p-3 rounded-xl text-sm leading-relaxed border border-orange-100 dark:border-orange-800/50 flex items-start gap-3">
                                    <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-semibold mb-1">Gán nhanh theo Sảnh</p>
                                        <p className="opacity-90">
                                            Hệ thống sẽ tìm các vị trí trống thuộc Sảnh bạn chọn và gán tự động cho các LOT chưa có vị trí
                                            (đang có {loadingCount ? '...' : (unassignedCount ?? initialUnassignedCount ?? 0)} LOT chờ).
                                        </p>
                                    </div>
                                </div>

                                {loadingHalls ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
                                        <Loader2 className="animate-spin" size={32} />
                                        <p className="text-sm font-medium">Đang tải danh sách sảnh...</p>
                                    </div>
                                ) : halls.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400">
                                        <p>Không tìm thấy sảnh nào trong hệ thống.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {Object.entries(
                                            halls.reduce((acc: any, hall) => {
                                                const group = hall.parentName || 'Khác';
                                                if (!acc[group]) acc[group] = [];
                                                acc[group].push(hall);
                                                return acc;
                                            }, {})
                                        ).map(([warehouse, warehouseHalls]: [string, any]) => (
                                            <div key={warehouse} className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900/50 shadow-sm">
                                                <button
                                                    onClick={() => setExpandedWarehouse(expandedWarehouse === warehouse ? null : warehouse)}
                                                    className="w-full flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                                            <Layers size={18} />
                                                        </div>
                                                        <h4 className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                                                            {warehouse}
                                                        </h4>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                                                            {warehouseHalls.length} Sảnh
                                                        </span>
                                                        <ChevronRight
                                                            size={18}
                                                            className={`text-slate-400 transition-transform duration-200 ${expandedWarehouse === warehouse ? 'rotate-90' : ''}`}
                                                        />
                                                    </div>
                                                </button>

                                                <div className={`overflow-hidden transition-all duration-300 ${expandedWarehouse === warehouse ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                                    <div className="p-3 grid gap-2">
                                                        {warehouseHalls.map((hall: any) => (
                                                            <button
                                                                key={hall.id}
                                                                disabled={loading || hall.emptyCount === 0 || unassignedCount === 0}
                                                                onClick={() => handleAutoAssignHall(hall)}
                                                                className="group w-full flex items-center justify-between p-3 rounded-xl border border-transparent hover:border-orange-500/50 bg-slate-50/50 dark:bg-slate-800/20 hover:bg-orange-50/50 dark:hover:bg-orange-900/10 transition-all text-left disabled:opacity-50 disabled:grayscale"
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-7 h-7 rounded-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-orange-600 transition-colors">
                                                                        <Layers size={14} />
                                                                    </div>
                                                                    <div>
                                                                        <h5 className="font-bold text-slate-700 dark:text-slate-300 group-hover:text-orange-700 dark:group-hover:text-orange-400 transition-colors text-sm">
                                                                            {hall.name}
                                                                        </h5>
                                                                        <p className="text-[10px] font-medium text-slate-500">
                                                                            {hall.emptyCount} vị trí đang trống
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    {hall.emptyCount > 0 && unassignedCount > 0 && (
                                                                        <span className="text-[8px] font-black uppercase tracking-wider bg-orange-100 dark:bg-orange-900/50 text-orange-600 px-1.5 py-0.5 rounded">
                                                                            Khả dụng
                                                                        </span>
                                                                    )}
                                                                    <ChevronRight size={14} className="text-slate-300 group-hover:translate-x-1 group-hover:text-orange-400 transition-all" />
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="p-4 space-y-4">
                        <div className="text-center pb-2 border-b border-slate-100 dark:border-slate-800">
                            <h4 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                                Đã xử lý <span className="text-orange-600">{results.success.length + results.assigned.length + results.missing.length + results.unmatched.length}</span> mã
                            </h4>
                        </div>

                        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                            {/* Thành công */}
                            {results.success.length > 0 && (
                                <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 rounded-xl p-3">
                                    <h5 className="font-bold text-emerald-800 dark:text-emerald-400 mb-2 flex items-center justify-between">
                                        <span>✅ Gán thành công</span>
                                        <span className="bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100 px-2.5 py-0.5 rounded-full text-xs">
                                            {results.success.length} mã
                                        </span>
                                    </h5>
                                    <div className="flex flex-wrap gap-1.5">
                                        {results.success.map(code => (
                                            <span key={code} className="px-2 py-1 bg-white dark:bg-slate-800 border border-emerald-100 dark:border-emerald-800/50 rounded-lg text-xs font-mono text-slate-600 dark:text-slate-300">
                                                {code}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Lỗi: Không đủ LOT */}
                            {results.unmatched.length > 0 && (
                                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl p-3">
                                    <h5 className="font-bold text-amber-800 dark:text-amber-400 mb-2 flex items-center justify-between">
                                        <span>⚠️ Không đủ LOT trống để gán</span>
                                        <span className="bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100 px-2.5 py-0.5 rounded-full text-xs">
                                            {results.unmatched.length} mã
                                        </span>
                                    </h5>
                                    <p className="text-xs text-amber-700 dark:text-amber-500 mb-2">Các vị trí hợp lệ nhưng khoanh vùng lọc hiện tại không đủ số lượng LOT trống để gán.</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {results.unmatched.map(code => (
                                            <span key={code} className="px-2 py-1 bg-white dark:bg-slate-800 border border-amber-100 dark:border-amber-800/50 rounded-lg text-xs font-mono text-slate-600 dark:text-slate-300">
                                                {code}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Lỗi: Đã có LOT */}
                            {results.assigned.length > 0 && (
                                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl p-3">
                                    <h5 className="font-bold text-red-800 dark:text-red-400 mb-2 flex items-center justify-between">
                                        <span>❌ Đã có chứa LOT sẵn</span>
                                        <span className="bg-red-200 text-red-900 dark:bg-red-800 dark:text-red-100 px-2.5 py-0.5 rounded-full text-xs">
                                            {results.assigned.length} mã
                                        </span>
                                    </h5>
                                    <p className="text-xs text-red-700 dark:text-red-500 mb-2">Các vị trí này đã chứa LOT, không thể gán đè. Vui lòng kiểm tra lại.</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {results.assigned.map(code => (
                                            <span key={code} className="px-2 py-1 bg-white dark:bg-slate-800 border border-red-100 dark:border-red-800/50 rounded-lg text-xs font-mono text-slate-600 dark:text-slate-300">
                                                {code}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Lỗi: Không tồn tại */}
                            {results.missing.length > 0 && (
                                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                                    <h5 className="font-bold text-slate-800 dark:text-slate-300 mb-2 flex items-center justify-between">
                                        <span>❓ Không tìm thấy mã vị trí</span>
                                        <span className="bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 px-2.5 py-0.5 rounded-full text-xs">
                                            {results.missing.length} mã
                                        </span>
                                    </h5>
                                    <div className="flex flex-wrap gap-1.5">
                                        {results.missing.map(code => (
                                            <span key={code} className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-500 dark:text-slate-400">
                                                {code}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-2.5 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 rounded-xl font-bold shadow-lg transition-all active:scale-95"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
