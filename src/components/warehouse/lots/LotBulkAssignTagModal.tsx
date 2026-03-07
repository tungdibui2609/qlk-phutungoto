'use client'

import { useState } from 'react'
import { X, Save, Tag, CheckCircle2, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { Lot } from '@/app/(dashboard)/warehouses/lots/_hooks/useLotManagement'
import { useSystem } from '@/contexts/SystemContext'

interface LotBulkAssignTagModalProps {
    onClose: () => void
    onSuccess: () => void
    fetchUntaggedLots: (limit: number) => Promise<Lot[]>
}

export function LotBulkAssignTagModal({ onClose, onSuccess, fetchUntaggedLots }: LotBulkAssignTagModalProps) {
    const { showToast } = useToast()
    const { currentSystem } = useSystem()
    const [loading, setLoading] = useState(false)
    const [textInput, setTextInput] = useState('')
    const [existingTags, setExistingTags] = useState<string[]>([])
    const [loadingTags, setLoadingTags] = useState(false)
    const [tagSearch, setTagSearch] = useState('')
    const [assignMode, setAssignMode] = useState<'sequential' | 'single-to-all'>('sequential')
    const [results, setResults] = useState<{
        success: { lot: string, tag: string }[];
        alreadyTagged: string[];
        error: string[];
    } | null>(null);

    // 1. Fetch Existing Tags
    const loadExistingTags = async () => {
        if (!currentSystem?.code) return;
        setLoadingTags(true);
        try {
            const [masterRes, allTagsRes] = await Promise.all([
                fetch(`/api/lot-tags/master?systemCode=${currentSystem.code}`).then(r => r.json()).catch(() => ({ ok: false })),
                fetch("/api/lot-tags?all=1").then(r => r.json()).catch(() => ({ ok: false }))
            ]);

            const allUniqueTags = new Set<string>();
            if (masterRes?.ok && Array.isArray(masterRes.tags)) {
                masterRes.tags.forEach((t: { name: string }) => { if (t.name) allUniqueTags.add(t.name.toUpperCase()); });
            }
            if (allTagsRes?.ok && Array.isArray(allTagsRes.uniqueTags)) {
                allTagsRes.uniqueTags.forEach((t: string) => { if (t) allUniqueTags.add(t.toUpperCase()); });
            }
            setExistingTags(Array.from(allUniqueTags).sort());
        } catch (error) {
            console.error('Error loading tags:', error);
        } finally {
            setLoadingTags(false);
        }
    };

    useState(() => {
        loadExistingTags();
    });

    const handleAssign = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!currentSystem?.code) return;

        // 1. Parse Input
        const rawTags = textInput.split(/[\n,;\t]+/).map(t => t.trim().toUpperCase()).filter(t => t !== '');

        if (rawTags.length === 0) {
            showToast('Vui lòng nhập ít nhất một mã phụ.', 'warning');
            return;
        }

        setLoading(true);
        setResults(null);

        try {
            // Determine how many LOTs we need
            // If rawTags.length == 1 and mode is sequential, we only need 1 lot.
            // If rawTags.length == 1 and mode is single-to-all, we might need MANY lots.
            const fetchLimit = assignMode === 'single-to-all' ? 100 : rawTags.length;

            // 2. Fetch Untagged Lots
            const targetLots = await fetchUntaggedLots(fetchLimit);

            if (targetLots.length === 0) {
                showToast('Không tìm thấy LOT nào chưa có mã phụ phù hợp với bộ lọc hiện tại.', 'warning');
                setLoading(false);
                return;
            }

            const success: { lot: string, tag: string }[] = [];
            const alreadyTagged: string[] = [];
            const error: string[] = [];

            const historyInserts = [];

            // 3. Logic: Sequential (1-to-1) or Single-to-All (1-to-N)
            const count = assignMode === 'single-to-all' && rawTags.length === 1
                ? targetLots.length
                : Math.min(rawTags.length, targetLots.length);

            for (let i = 0; i < count; i++) {
                const lot = targetLots[i];
                const tag = assignMode === 'single-to-all' && rawTags.length === 1 ? rawTags[0] : rawTags[i];

                if (!tag) continue;

                // Check again to be safe
                if (lot.lot_tags && lot.lot_tags.length > 0) {
                    alreadyTagged.push(lot.code);
                    continue;
                }

                const targetItemId = lot.lot_items && lot.lot_items.length > 0 ? lot.lot_items[0].id : null;

                const { error: insertError } = await supabase.from('lot_tags').insert({
                    lot_id: lot.id,
                    tag: tag,
                    lot_item_id: targetItemId,
                    added_at: new Date().toISOString()
                });

                if (insertError) {
                    console.error(`Error assigning tag ${tag} to lot ${lot.code}:`, insertError);
                    error.push(`${lot.code} (${tag})`);
                } else {
                    success.push({ lot: lot.code, tag });

                    historyInserts.push({
                        system_code: currentSystem.code,
                        action_type: 'assign_tag',
                        entity_type: 'lot',
                        entity_id: lot.id,
                        details: { tag, item_id: targetItemId, bulk_assign: true }
                    });
                }
            }

            if (historyInserts.length > 0) {
                await (supabase as any).from('operation_history').insert(historyInserts);
            }

            setResults({ success, alreadyTagged, error });

            if (error.length > 0) {
                showToast(`Gán hoàn tất với ${error.length} lỗi.`, 'warning');
            } else {
                showToast(`Gán thành công ${success.length} mã phụ!`, 'success');
            }

            onSuccess();
        } catch (err: any) {
            console.error('Error in bulk assign tags:', err);
            showToast('Lỗi khi gán hàng loạt: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    }

    const filteredSuggestions = existingTags.filter(t =>
        t.toLowerCase().includes(tagSearch.toLowerCase())
    ).slice(0, 50);

    const handleAddSuggestion = (tag: string) => {
        setTextInput(prev => {
            const trimmed = prev.trim();
            if (!trimmed) return tag;
            return trimmed + '\n' + tag;
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Tag size={20} className="text-orange-500" />
                        Gán mã phụ hàng loạt
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {!results ? (
                    <form onSubmit={handleAssign} className="flex-1 overflow-hidden flex flex-col">
                        <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                            <div className="bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 p-3 rounded-xl text-sm leading-relaxed border border-orange-100 dark:border-orange-800/50">
                                <p className="font-semibold mb-1">Cách thức hoạt động:</p>
                                <ul className="list-disc pl-5 space-y-1 opacity-90">
                                    <li>Nhập danh sách mã phụ để gán lần lượt cho các LOT chưa có mã.</li>
                                    <li>Nếu chỉ nhập 1 mã, bạn có thể chọn chế độ "Gán 1 mã cho tất cả".</li>
                                </ul>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs text-slate-500 font-medium uppercase tracking-wider block">Ô nhập mã phụ</label>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setAssignMode('sequential')}
                                                className={`px-2 py-1 text-[10px] rounded-md font-bold transition-all ${assignMode === 'sequential' ? 'bg-orange-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
                                            >
                                                GÁN LẦN LƯỢT
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setAssignMode('single-to-all')}
                                                className={`px-2 py-1 text-[10px] rounded-md font-bold transition-all ${assignMode === 'single-to-all' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
                                            >
                                                1 MÃ {"->"} TẤT CẢ
                                            </button>
                                        </div>
                                    </div>
                                    <textarea
                                        value={textInput}
                                        onChange={(e) => setTextInput(e.target.value)}
                                        placeholder="VD:&#10;MP-001&#10;MP-002"
                                        className="w-full h-64 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all resize-none shadow-inner text-sm font-mono placeholder:font-sans uppercase"
                                    />
                                    <div className="mt-1 flex justify-between text-xs text-slate-400">
                                        <span className="font-semibold">{textInput.split(/[\n,;\t]+/).filter(c => c.trim() !== '').length} mã đang nhập</span>
                                    </div>
                                </div>

                                <div className="flex flex-col border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900/50">
                                    <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                                        <label className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center gap-2">
                                            <CheckCircle2 size={14} className="text-orange-500" />
                                            Mã đã tồn tại (Chọn nhanh)
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={tagSearch}
                                                onChange={(e) => setTagSearch(e.target.value)}
                                                placeholder="Tìm kiếm mã phụ..."
                                                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-orange-500/20 outline-none"
                                            />
                                            <Tag size={14} className="absolute left-2.5 top-2 text-slate-400" />
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2 space-y-1 h-64 custom-scrollbar">
                                        {loadingTags ? (
                                            <div className="flex items-center justify-center h-full opacity-50 italic text-xs">Đang tải mã...</div>
                                        ) : filteredSuggestions.length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5 p-1">
                                                {filteredSuggestions.map(tag => (
                                                    <button
                                                        key={tag}
                                                        type="button"
                                                        onClick={() => handleAddSuggestion(tag)}
                                                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-orange-100 dark:bg-slate-800 dark:hover:bg-orange-900/30 text-slate-600 dark:text-slate-400 hover:text-orange-700 dark:hover:text-orange-300 rounded-lg text-xs font-mono transition-all border border-slate-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-800"
                                                    >
                                                        {tag}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-slate-400 text-xs italic">Không tìm thấy mã nào</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
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
                                className={`px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2 ${loading ? 'opacity-75 cursor-wait' : ''}`}
                            >
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                {loading ? 'Đang xử lý...' : 'Thực hiện gán'}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="flex flex-col flex-1 overflow-hidden p-4 space-y-4">
                        <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 rounded-2xl">
                            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-500/20">
                                <CheckCircle2 size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-emerald-900 dark:text-emerald-100">Xử lý hoàn tất</h4>
                                <p className="text-xs text-emerald-700 dark:text-emerald-300 opacity-80">Kết quả gán mã phụ hàng loạt</p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                            {results.success.length > 0 && (
                                <div className="space-y-1.5">
                                    <h5 className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest pl-1">Thành công ({results.success.length})</h5>
                                    <div className="grid grid-cols-1 gap-1">
                                        {results.success.map((res, i) => (
                                            <div key={i} className="px-3 py-1.5 bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100/50 dark:border-emerald-800/20 rounded-lg text-xs font-mono text-emerald-700 dark:text-emerald-300 flex justify-between items-center">
                                                <span>{res.lot}</span>
                                                <span className="opacity-50 font-sans">→</span>
                                                <span className="font-bold">{res.tag}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {results.alreadyTagged.length > 0 && (
                                <div className="space-y-1.5 pt-1">
                                    <h5 className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest pl-1">Đã có mã ({results.alreadyTagged.length})</h5>
                                    <div className="grid grid-cols-2 gap-1">
                                        {results.alreadyTagged.map((code, i) => (
                                            <div key={i} className="px-3 py-1.5 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100/50 dark:border-amber-800/20 rounded-lg text-xs font-mono text-amber-700 dark:text-amber-400">
                                                {code}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {results.error.length > 0 && (
                                <div className="space-y-1.5 pt-1">
                                    <h5 className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest pl-1">Lỗi ({results.error.length})</h5>
                                    <div className="grid grid-cols-1 gap-1">
                                        {results.error.map((err, i) => (
                                            <div key={i} className="px-3 py-1.5 bg-rose-50/50 dark:bg-rose-900/10 border border-rose-100/50 dark:border-rose-800/20 rounded-lg text-xs font-mono text-rose-700 dark:text-rose-400">
                                                {err}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                            <button
                                onClick={onClose}
                                className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl font-bold shadow-lg transition-all"
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
