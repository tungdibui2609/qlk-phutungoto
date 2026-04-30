'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Save, MapPin, Layers, CheckCircle2, ChevronRight, Loader2, Building2, ChevronDown, Zap, Flag } from 'lucide-react'
import { Combobox, ComboboxOption } from '@/components/ui/Combobox'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { Lot } from '@/app/(dashboard)/warehouses/lots/_hooks/useLotManagement'
import { useSystem } from '@/contexts/SystemContext'
import { logActivity } from '@/lib/audit'

interface LotAssignPositionModalProps {
    lot: Lot
    onClose: () => void
    onSuccess: () => void
}

export function LotAssignPositionModal({ lot, onClose, onSuccess }: LotAssignPositionModalProps) {
    const { showToast, showConfirm } = useToast()
    const { currentSystem } = useSystem()
    const [loading, setLoading] = useState(false)
    const [code, setCode] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [positions, setPositions] = useState<ComboboxOption[]>([])
    const [loadingPositions, setLoadingPositions] = useState(false)

    // New states for Auto Assign
    const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual')
    const [halls, setHalls] = useState<any[]>([])
    const [loadingHalls, setLoadingHalls] = useState(false)
    const [expandedWarehouse, setExpandedWarehouse] = useState<string | null>(null)

    // Fetch positions for suggestions (Manual tab)
    useEffect(() => {
        if (!currentSystem?.code || activeTab !== 'manual') return

        async function fetchPositions(search: string = '') {
            setLoadingPositions(true)
            try {
                let query = (supabase.from('positions') as any)
                    .select('code')
                    .eq('system_type', currentSystem!.code)
                    .order('code')
                    .limit(100)

                if (search) {
                    query = query.ilike('code', `%${search}%`)
                }

                const { data, error } = await query

                if (error) throw error
                if (data) {
                    const options = data.map((p: any) => ({
                        value: p.code,
                        label: p.code
                    }))
                    setPositions(options)
                }
            } catch (err) {
                console.error('Error fetching positions:', err)
            } finally {
                setLoadingPositions(false)
            }
        }

        const timer = setTimeout(() => {
            fetchPositions(searchTerm)
        }, 300)

        return () => clearTimeout(timer)
    }, [currentSystem?.code, searchTerm, activeTab])

    // Fetch halls for Auto Assign tab
    useEffect(() => {
        if (currentSystem?.code && activeTab === 'auto') {
            fetchHallsData()
        }
    }, [currentSystem?.code, activeTab])

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

    const fetchHallsData = async () => {
        if (!currentSystem?.code) return;
        setLoadingHalls(true);
        try {
            // Fetch ALL zones using pagination to guarantee no missing data, exactly like Map's useWarehouseData
            let allZones: any[] = [];
            let from = 0;
            const limit = 1000;
            
            while (true) {
                const { data, error } = await supabase
                    .from('zones')
                    .select('*')
                    .eq('system_type', currentSystem.code)
                    .order('level')
                    .order('code')
                    .order('id')
                    .range(from, from + limit - 1);
                    
                if (error) {
                    console.error('Error fetching zones:', error);
                    break;
                }
                if (!data || data.length === 0) break;
                
                allZones = [...allZones, ...data];
                if (data.length < limit) break;
                from += limit;
            }
            
            // 1. Identify Warehouses (Root zones: no parent_id)
            const warehouses = allZones.filter(z => !z.parent_id || z.parent_id === '');
            
            // 2. Identify Halls (Matching Map's (z as any).is_hall)
            const halls = allZones.filter(z => (z as any).is_hall);

            // 3. Helper to get all descendant ids for a warehouse (Top-down logic like Map)
            const getDescendantIds = (zoneId: string, zonesList: any[]): Set<string> => {
                const result = new Set<string>([zoneId]);
                let added = true;
                while (added) {
                    added = false;
                    for (const z of zonesList) {
                        if (z.parent_id && result.has(z.parent_id) && !result.has(z.id)) {
                            result.add(z.id);
                            added = true;
                        }
                    }
                }
                return result;
            };

            // 4. Group halls by warehouse and count positions
            const warehouseResults = await Promise.all(warehouses.map(async (wh: any) => {
                const descendants = getDescendantIds(wh.id, allZones);
                const whHalls = halls.filter(h => descendants.has(h.id));
                
                // For each hall, count empty floor positions
                const hallDetails = await Promise.all(whHalls.map(async (hall: any) => {
                    const { count } = await (supabase
                        .from('positions') as any)
                        .select('id, zone_positions!inner(zone_id)', { count: 'exact', head: true })
                        .eq('system_type', currentSystem.code)
                        .is('lot_id', null)
                        .eq('zone_positions.zone_id', hall.id);

                    return { ...hall, emptyCount: count || 0 };
                }));

                // Total empty positions in all halls of this warehouse
                const totalEmpty = hallDetails.reduce((sum, h) => sum + h.emptyCount, 0);

                return {
                    ...wh,
                    halls: hallDetails.sort((a, b) => (a.display_order || 0) - (b.display_order || 0)),
                    totalEmptyCount: totalEmpty
                };
            }));

            setHalls(warehouseResults.sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
        } catch (err) {
            console.error('Error fetching halls:', err);
        } finally {
            setLoadingHalls(false);
        }
    };

    const handleAssign = async (e: React.FormEvent) => {
        e.preventDefault()
        const targetCode = code.trim().toUpperCase()
        
        setLoading(true)

        try {
            // Case: Empty code = Unassign position
            if (!targetCode) {
                const confirmed = await showConfirm('Bạn có chắc chắn muốn xóa vị trí của LOT này và chuyển về trạng thái chưa gán?')
                if (!confirmed) {
                    setLoading(false)
                    return
                }

                // Get current positions to log them before unassigning
                const { data: currentPositions } = await (supabase.from('positions') as any)
                    .select('id, code')
                    .eq('lot_id', lot.id)

                // Unassign current positions
                const { error: unassignError } = await (supabase
                    .from('positions') as any)
                    .update({ lot_id: null })
                    .eq('lot_id', lot.id)

                if (unassignError) throw unassignError

                // Log Activity for Audit Trail
                if (currentPositions && currentPositions.length > 0) {
                    for (const pos of currentPositions) {
                        await logActivity({
                            supabase,
                            tableName: 'positions',
                            recordId: pos.id,
                            action: 'UPDATE',
                            oldData: { lot_id: lot.id },
                            newData: { lot_id: null },
                            systemCode: currentSystem?.code || ''
                        })
                    }
                }

                // Log history for operation_history (legacy)
                const historyObj = {
                    system_code: currentSystem?.code ?? null,
                    action_type: 'unassign_position',
                    entity_type: 'lot',
                    entity_id: lot.id,
                    details: {
                        previous_positions: currentPositions?.map((p: any) => p.code) || []
                    }
                } as any;

                await (supabase as any).from('operation_history').insert(historyObj);

                showToast('Đã xóa vị trí thành công!', 'success')
                onSuccess()
                return
            }

            // Check if position exists
            const { data: posData, error: posError } = await (supabase
                .from('positions') as any)
                .select('id, lot_id, code')
                .eq('code', targetCode)
                .single()

            if (posError || !posData) {
                showToast(`Không tìm thấy ô vị trí: ${targetCode}`, 'error')
                setLoading(false)
                return
            }

            if (posData.lot_id && posData.lot_id !== lot.id) {
                showToast(`Ô vị trí ${targetCode} đã được gán cho một LOT khác`, 'error')
                setLoading(false)
                return
            }

            // 1. Get current positions for "Move" audit trail
            const { data: oldPositions } = await (supabase.from('positions') as any)
                .select('id, code')
                .eq('lot_id', lot.id)

            // 2. Unassign current positions
            await (supabase
                .from('positions') as any)
                .update({ lot_id: null })
                .eq('lot_id', lot.id)
            
            // Log removal for old positions
            if (oldPositions && oldPositions.length > 0) {
                for (const oldP of oldPositions) {
                    await logActivity({
                        supabase,
                        tableName: 'positions',
                        recordId: oldP.id,
                        action: 'UPDATE',
                        oldData: { lot_id: lot.id },
                        newData: { lot_id: null },
                        systemCode: currentSystem?.code || ''
                    })
                }
            }

            // 3. Assign new position
            const { error: assignError } = await (supabase
                .from('positions') as any)
                .update({ lot_id: lot.id })
                .eq('id', posData.id)

            if (assignError) {
                throw assignError
            }

            // Log Audit for NEW assignment
            await logActivity({
                supabase,
                tableName: 'positions',
                recordId: posData.id,
                action: 'UPDATE',
                oldData: { lot_id: null },
                newData: { lot_id: lot.id },
                systemCode: currentSystem?.code || ''
            })

            // 4. Log history (Legacy)
            const historyObj = {
                system_code: currentSystem?.code ?? null,
                action_type: 'assign_position',
                entity_type: 'lot',
                entity_id: lot.id,
                details: {
                    position_code: targetCode,
                    position_id: posData.id
                }
            } as any;

            await (supabase as any).from('operation_history').insert(historyObj);

            showToast(`Gán thành công vào ô ${targetCode}!`, 'success')
            onSuccess()
        } catch (err: any) {
            console.error(err)
            showToast('Lỗi khi xử lý vị trí: ' + err.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleAutoAssignWarehouse = async (warehouse: any) => {
        if (!currentSystem?.code) return;
        if (warehouse.totalEmptyCount === 0) {
            showToast('Kho này hiện không còn vị trí sảnh sàn trống.', 'warning');
            return;
        }

        // Auto-assign logic: Try halls one by one until success
        for (const hall of warehouse.halls) {
            if (hall.emptyCount > 0) {
                await handleAutoAssignHall(hall);
                return;
            }
        }
    };

    const handleAutoAssignHall = async (hall: any) => {
        if (!currentSystem?.code) return;
        
        setLoading(true);
        try {
            // 1. Get all descendant zones
            const getDescendantIds = (zoneId: string, zonesList: any[]): Set<string> => {
                const result = new Set<string>([zoneId]);
                let added = true;
                while (added) {
                    added = false;
                    for (const z of zonesList) {
                        if (z.parent_id && result.has(z.parent_id) && !result.has(z.id)) {
                            result.add(z.id);
                            added = true;
                        }
                    }
                }
                return result;
            };
            const { data: allZones } = await supabase.from('zones').select('id, parent_id').eq('system_type', currentSystem.code).limit(5000);
            const descIds = Array.from(getDescendantIds(hall.id, allZones || []));

            // 2. Fetch available positions - ONLY floor positions (directly in this hall)
            const { data: posData } = await (supabase
                .from('positions') as any)
                .select('id, code, lot_id, lots!positions_lot_id_fkey(id), zone_positions!inner(zone_id)')
                .eq('system_type', currentSystem.code)
                .is('lot_id', null)
                .in('zone_positions.zone_id', descIds)
                .order('code');

            if (!posData || posData.length === 0) {
                showToast('Không tìm thấy vị trí sàn trống nào trong sảnh này.', 'error');
                setLoading(false);
                return;
            }

            // 3. Prioritize floor positions (directly in the hall zone)
            const floorPositions = posData.filter((p: any) => {
                const zps = p.zone_positions;
                if (!zps) return false;
                if (Array.isArray(zps)) {
                    return zps.some((zp: any) => zp.zone_id === hall.id);
                }
                return (zps as any).zone_id === hall.id;
            });
            const targetPos = (floorPositions.length > 0 ? floorPositions[0] : posData[0]) as any;

            // 3. Clear existing mappings for this lot
            const { data: oldPositions } = await (supabase.from('positions') as any)
                .select('id, code')
                .eq('lot_id', lot.id)

            await (supabase.from('positions') as any).update({ lot_id: null }).eq('lot_id', lot.id);

            // Log removal for old positions
            if (oldPositions && oldPositions.length > 0) {
                for (const oldP of oldPositions) {
                    await logActivity({
                        supabase,
                        tableName: 'positions',
                        recordId: oldP.id,
                        action: 'UPDATE',
                        oldData: { lot_id: lot.id },
                        newData: { lot_id: null },
                        systemCode: currentSystem.code || ''
                    })
                }
            }

            // 4. Assign new position
            const { error: assignError } = await (supabase
                .from('positions') as any)
                .update({ lot_id: lot.id })
                .eq('id', targetPos.id);

            if (assignError) throw assignError;

            // 5. Log history (Legacy)
            const historyObj = {
                system_code: currentSystem.code,
                action_type: 'assign_position',
                entity_type: 'lot',
                entity_id: lot.id,
                details: {
                    position_code: targetPos.code,
                    position_id: targetPos.id,
                    auto_assign_hall: hall.name,
                }
            };
            await (supabase as any).from('operation_history').insert(historyObj);

            // 6. Log Audit Activity (New)
            await logActivity({
                supabase,
                tableName: 'positions',
                recordId: targetPos.id,
                action: 'UPDATE',
                oldData: { lot_id: null },
                newData: { lot_id: lot.id },
                systemCode: currentSystem.code || ''
            })

            showToast(`Gán thành công vào ô ${targetPos.code} (Sảnh ${hall.name})!`, 'success');
            onSuccess();
        } catch (err: any) {
            console.error('Error in auto assign hall:', err);
            showToast('Lỗi khi gán tự động: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[85vh]">
                <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <MapPin size={20} className="text-orange-500" />
                        Gán mã vị trí
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 dark:border-slate-800">
                    <button
                        onClick={() => setActiveTab('manual')}
                        className={`flex-1 py-3 text-sm font-bold transition-colors relative ${activeTab === 'manual'
                            ? 'text-orange-600'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Thủ công
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
                        Tự động (Sảnh)
                        {activeTab === 'auto' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600" />
                        )}
                    </button>
                </div>

                <div className="p-4 space-y-4 overflow-y-auto">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="text-[10px] text-slate-500 font-bold mb-1 uppercase tracking-wider">Lot đang chọn</div>
                        <div className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200">
                            {lot.code}
                        </div>
                    </div>

                    {activeTab === 'manual' ? (
                        <form onSubmit={handleAssign} className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-500 font-medium mb-1 uppercase tracking-wider block">Mã vị trí (Ô/Kệ)</label>
                                <Combobox
                                    options={positions}
                                    value={code}
                                    onChange={(val) => {
                                        setCode(val || '')
                                        if (val) setSearchTerm(val)
                                    }}
                                    onSearchChange={(val) => setSearchTerm(val)}
                                    placeholder="Nhập mã vị trí (VD: A-1-1)"
                                    className="w-full"
                                    isLoading={loadingPositions}
                                    allowCustom={true}
                                />
                                <p className="mt-1 text-[10px] text-slate-400 italic">
                                    Để trống để xóa vị trí hiện tại.
                                </p>
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
                                    disabled={loading}
                                    className={`px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2 ${loading ? 'opacity-75 cursor-wait' : ''}`}
                                >
                                    <Save size={16} />
                                    {loading ? 'Đang lưu...' : 'Lưu vị trí'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="space-y-3 min-h-[300px]">
                            {loadingHalls ? (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
                                    <Loader2 className="animate-spin" size={32} />
                                    <p className="text-sm font-medium">Đang tải danh sách...</p>
                                </div>
                            ) : halls.length === 0 ? (
                                <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl">
                                    <p>Hệ thống chưa cấu hình Sảnh cho các kho.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {halls.map((warehouse: any) => (
                                        <div key={warehouse.id} className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900/50 shadow-sm">
                                            <button
                                                onClick={() => setExpandedWarehouse(expandedWarehouse === warehouse.id ? null : warehouse.id)}
                                                className="w-full flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                                        <Building2 size={18} />
                                                    </div>
                                                    <h4 className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                                                        {warehouse.name}
                                                    </h4>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                                                        {warehouse.halls.length} Sảnh
                                                    </span>
                                                    <ChevronDown
                                                        size={18}
                                                        className={`text-slate-400 transition-transform duration-200 ${expandedWarehouse === warehouse.id ? 'rotate-180' : ''}`}
                                                    />
                                                </div>
                                            </button>

                                            <div className={`overflow-hidden transition-all duration-300 ${expandedWarehouse === warehouse.id ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                                <div className="p-3 grid gap-2 bg-slate-50/30 dark:bg-slate-900/20">
                                                    {/* Option: Auto (Any hall) */}
                                                    <button
                                                        disabled={loading || warehouse.totalEmptyCount === 0}
                                                        onClick={() => handleAutoAssignWarehouse(warehouse)}
                                                        className="group w-full flex items-center justify-between p-3 rounded-xl border-2 border-yellow-500/20 bg-yellow-50/30 dark:bg-yellow-900/10 hover:bg-yellow-100/50 dark:hover:bg-yellow-900/20 transition-all text-left disabled:opacity-50"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-yellow-500 text-white flex items-center justify-center shadow-lg shadow-yellow-500/20">
                                                                <Zap size={16} />
                                                            </div>
                                                            <div>
                                                                <h5 className="font-bold text-yellow-700 dark:text-yellow-400 text-sm">
                                                                    Tự động (Bất kỳ sảnh nào)
                                                                </h5>
                                                                <p className="text-[10px] font-medium text-yellow-600/70 dark:text-yellow-400/50">
                                                                    Hệ thống tự chọn sảnh có vị trí sàn trống
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-black bg-yellow-500 text-white px-2 py-0.5 rounded">
                                                                {warehouse.totalEmptyCount} Ô
                                                            </span>
                                                            <ChevronRight size={14} className="text-yellow-500 group-hover:translate-x-1 transition-all" />
                                                        </div>
                                                    </button>

                                                    {/* Specific Halls */}
                                                    {warehouse.halls.map((hall: any) => (
                                                        <button
                                                            key={hall.id}
                                                            disabled={loading || hall.emptyCount === 0}
                                                            onClick={() => handleAutoAssignHall(hall)}
                                                            className="group w-full flex items-center justify-between p-3 rounded-xl border border-transparent hover:border-blue-500/50 bg-white dark:bg-slate-800/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all text-left disabled:opacity-50"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition-colors">
                                                                    <Flag size={14} />
                                                                </div>
                                                                <div>
                                                                    <h5 className="font-bold text-slate-700 dark:text-slate-300 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors text-sm">
                                                                        {hall.name}
                                                                    </h5>
                                                                    <p className="text-[10px] font-medium text-slate-500">
                                                                        Mã: {hall.code || '---'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                                                    {hall.emptyCount} ô trống
                                                                </span>
                                                                <ChevronRight size={14} className="text-slate-300 group-hover:translate-x-1 group-hover:text-blue-400 transition-all" />
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
            </div>
        </div>
    )
}
