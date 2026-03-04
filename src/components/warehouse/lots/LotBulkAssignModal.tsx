import { useState } from 'react'
import { X, Save, Layers } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { Lot } from '@/app/(dashboard)/warehouses/lots/_hooks/useLotManagement'
import { useSystem } from '@/contexts/SystemContext'

interface LotBulkAssignModalProps {
    onClose: () => void
    onSuccess: () => void
    fetchUnassignedLots: (limit: number) => Promise<Lot[]>
}

export function LotBulkAssignModal({ onClose, onSuccess, fetchUnassignedLots }: LotBulkAssignModalProps) {
    const { showToast } = useToast()
    const { currentSystem } = useSystem()
    const [loading, setLoading] = useState(false)
    const [textInput, setTextInput] = useState('')

    // Results state
    const [results, setResults] = useState<{
        success: string[];
        missing: string[];
        assigned: string[];
        unmatched: string[];
    } | null>(null);

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
            onSuccess();
        } catch (err: any) {
            console.error('Error in bulk assign:', err);
            showToast('Lỗi khi gán hàng loạt: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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
                    <form onSubmit={handleAssign} className="p-4 space-y-4">
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
