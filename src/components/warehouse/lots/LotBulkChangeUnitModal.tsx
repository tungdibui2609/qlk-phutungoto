'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { X, Save, Loader2, CheckCircle2, AlertTriangle, Scale, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { canonicalizeUnit, extractWeightFromName } from '@/lib/unitConversion'
import {
    collectAllUnitOptions,
    groupLotItemsForUnitChange,
    type UnitEditLotItemRow,
    type UnitEditProductRef,
    type UnitEditProductUnitRef,
    type UnitEditUnitRef,
    type UnitGroupDraft,
} from '@/lib/lotUnitBulkEdit'

interface LotPositionStat {
    selected: number
    total: number
}

interface LotBulkChangeUnitModalProps {
    onClose: () => void
    onSuccess: () => void
    lotIds: string[]
    /** Số vị trí đã chọn / tổng số vị trí của từng LOT, dùng để cảnh báo khi chọn 1 phần LOT */
    lotPositionStats?: Record<string, LotPositionStat>
}

interface LotItemRow extends UnitEditLotItemRow {
    lots?: { code: string } | null
}

const chunk = <T,>(arr: T[], size: number): T[][] => {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
}

export function LotBulkChangeUnitModal({ onClose, onSuccess, lotIds, lotPositionStats }: LotBulkChangeUnitModalProps) {
    const { showToast } = useToast()
    const { currentSystem } = useSystem()
    const { user } = useUser()

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [groups, setGroups] = useState<UnitGroupDraft[]>([])
    const [skippedLegacyLots, setSkippedLegacyLots] = useState<string[]>([])
    const [lotCodesById, setLotCodesById] = useState<Record<string, string>>({})
    const [selections, setSelections] = useState<Record<string, string>>({})
    const [result, setResult] = useState<{ updatedRows: number; updatedLots: number; failed: string[] } | null>(null)

    const uniqueLotIds = useMemo(() => Array.from(new Set(lotIds.filter(Boolean))), [lotIds])

    const loadData = useCallback(async () => {
        const systemCode = currentSystem?.code
        if (!systemCode || uniqueLotIds.length === 0) {
            setGroups([])
            setLoading(false)
            return
        }
        setLoading(true)
        try {
            const rows: LotItemRow[] = []
            for (const part of chunk(uniqueLotIds, 200)) {
                const { data, error } = await supabase
                    .from('lot_items')
                    .select('id, lot_id, product_id, quantity, unit, lots!inner(code, system_code)')
                    .in('lot_id', part)
                    .eq('lots.system_code', systemCode)
                if (error) throw error
                rows.push(...((data || []) as unknown as LotItemRow[]))
            }

            const productIds = Array.from(new Set(rows.map(r => r.product_id).filter(Boolean)))
            let products: UnitEditProductRef[] = []
            let productUnits: UnitEditProductUnitRef[] = []
            let units: UnitEditUnitRef[] = []

            if (productIds.length > 0) {
                const prodParts = chunk(productIds, 200)
                const [prodRes, puRes, unitRes] = await Promise.all([
                    Promise.all(prodParts.map(p => (supabase.from('products') as any).select('id, sku, name, unit, weight_kg').in('id', p))),
                    Promise.all(prodParts.map(p => (supabase.from('product_units') as any).select('product_id, unit_id, conversion_rate').in('product_id', p))),
                    (supabase.from('units') as any).select('id, name').eq('is_active', true),
                ])
                products = prodRes.flatMap((res: any) => (res?.data || []) as UnitEditProductRef[])
                productUnits = puRes.flatMap((res: any) => (res?.data || []) as UnitEditProductUnitRef[])
                units = (unitRes?.data || []) as UnitEditUnitRef[]
            }

            const sorted = groupLotItemsForUnitChange(
                rows.map(r => ({ ...r, lot_code: r.lots?.code })),
                products,
                productUnits,
                units
            )

            const lotIdsWithItems = new Set(rows.map(r => r.lot_id))
            const codesById: Record<string, string> = {}
            rows.forEach(r => {
                if (r.lots?.code) codesById[r.lot_id] = r.lots.code
            })
            const legacyCodes: string[] = []
            const missing = uniqueLotIds.filter(id => !lotIdsWithItems.has(id))
            if (missing.length > 0) {
                const { data } = await (supabase.from('lots') as any).select('id, code').in('id', missing)
                ;(data || []).forEach((l: { id: string; code: string }) => {
                    legacyCodes.push(l.code)
                    codesById[l.id] = l.code
                })
            }

            setGroups(sorted)
            setSkippedLegacyLots(legacyCodes)
            setLotCodesById(codesById)
            setSelections({})
        } catch (err) {
            console.error('Lỗi khi tải dữ liệu đơn vị của LOT:', err)
            showToast('Không tải được danh sách sản phẩm / đơn vị của các LOT đã chọn.', 'error')
            setGroups([])
        } finally {
            setLoading(false)
        }
    }, [currentSystem?.code, uniqueLotIds, showToast])

    useEffect(() => {
        loadData()
    }, [loadData])

    const changedGroups = useMemo(
        () => groups.filter(g => {
            const next = selections[g.key]
            return !!next && canonicalizeUnit(next) !== canonicalizeUnit(g.currentUnit)
        }),
        [groups, selections]
    )

    const partialLots = useMemo(() => {
        if (!lotPositionStats) return []
        return uniqueLotIds
            .map(id => ({ id, stat: lotPositionStats[id] }))
            .filter(x => x.stat && x.stat.total > x.stat.selected)
    }, [lotPositionStats, uniqueLotIds])

    const handleApplyAll = (unit: string) => {
        if (!unit) return
        const next: Record<string, string> = { ...selections }
        groups.forEach(g => {
            if (g.options.some(o => canonicalizeUnit(o) === canonicalizeUnit(unit))) next[g.key] = unit
        })
        setSelections(next)
    }

    const handleSubmit = async () => {
        if (!currentSystem?.code) {
            showToast('Không tìm thấy mã phân hệ kho hiện tại.', 'error')
            return
        }
        if (changedGroups.length === 0) {
            showToast('Chưa có sản phẩm nào được chọn đơn vị mới khác hiện tại.', 'warning')
            return
        }

        setSaving(true)
        const failed: string[] = []
        let updatedRows = 0
        const affectedLotCodes = new Set<string>()

        try {
            for (const g of changedGroups) {
                const newUnit = selections[g.key]
                let groupFailed = false
                for (const part of chunk(g.itemIds, 200)) {
                    const { error } = await (supabase
                        .from('lot_items') as any)
                        .update({ unit: newUnit })
                        .in('id', part)
                    if (error) {
                        console.error(`Lỗi cập nhật lot_items cho ${g.productName}:`, error)
                        failed.push(`${g.letter}. ${g.productName}: ${g.currentUnit} → ${newUnit}`)
                        groupFailed = true
                        break
                    }
                    updatedRows += part.length
                }
                if (!groupFailed) g.lotCodes.forEach(c => affectedLotCodes.add(c))
            }

            await (supabase.from('audit_logs') as any).insert({
                action: 'UPDATE',
                table_name: 'lot_items',
                record_id: uniqueLotIds[0] || 'unknown',
                changed_by: user?.email || 'system_bulk_unit',
                old_data: {
                    lot_ids: uniqueLotIds,
                    from: changedGroups.map(g => ({ product_id: g.productId, unit: g.currentUnit, rows: g.itemIds.length })),
                },
                new_data: {
                    to: changedGroups.map(g => ({ product_id: g.productId, unit: selections[g.key], rows: g.itemIds.length })),
                    updatedRows,
                },
                system_code: currentSystem.code,
            })

            setResult({ updatedRows, updatedLots: affectedLotCodes.size, failed })
            if (failed.length === 0) {
                showToast(`Đã đổi đơn vị cho ${updatedRows} dòng sản phẩm (giữ nguyên số lượng).`, 'success')
            } else {
                showToast(`Đổi được ${updatedRows} dòng, ${failed.length} nhóm bị lỗi.`, 'warning')
            }
        } catch (err) {
            console.error('Lỗi khi đổi đơn vị hàng loạt:', err)
            showToast('Đã xảy ra lỗi hệ thống khi đổi đơn vị.', 'error')
        } finally {
            setSaving(false)
        }
    }

    const allUnitOptions = useMemo(() => collectAllUnitOptions(groups), [groups])

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="w-full max-w-3xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-amber-600 dark:text-amber-400">
                            <Scale size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Đổi đơn vị tính hàng loạt</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Áp dụng cho {uniqueLotIds.length} LOT đã chọn · Chỉ đổi đơn vị, <span className="font-bold text-slate-700 dark:text-slate-200">giữ nguyên số lượng</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {result ? (
                        <div className="space-y-5 text-center py-4">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 size={30} />
                            </div>
                            <div>
                                <h4 className="text-lg font-bold text-slate-900 dark:text-white">Đã đổi đơn vị thành công</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    Số lượng của tất cả dòng sản phẩm được giữ nguyên như trước khi đổi.
                                </p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 text-left border border-slate-200 dark:border-slate-800 space-y-2">
                                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-300">
                                    <span>Dòng sản phẩm đã đổi đơn vị:</span>
                                    <span className="font-bold text-slate-900 dark:text-white">{result.updatedRows}</span>
                                </div>
                                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-300">
                                    <span>LOT bị ảnh hưởng:</span>
                                    <span className="font-bold text-slate-900 dark:text-white">{result.updatedLots}</span>
                                </div>
                                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-300">
                                    <span>Nhóm sản phẩm bị lỗi:</span>
                                    <span className="font-bold text-slate-900 dark:text-white">{result.failed.length}</span>
                                </div>
                                {result.failed.length > 0 && (
                                    <ul className="text-xs text-rose-600 dark:text-rose-400 list-disc pl-5 space-y-0.5">
                                        {result.failed.map(f => <li key={f}>{f}</li>)}
                                    </ul>
                                )}
                            </div>
                            <button
                                onClick={onSuccess}
                                className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all cursor-pointer"
                            >
                                Đóng và cập nhật sơ đồ
                            </button>
                        </div>
                    ) : loading ? (
                        <div className="flex items-center justify-center gap-2 py-16 text-slate-500 text-sm">
                            <Loader2 size={18} className="animate-spin text-amber-600" />
                            Đang tải sản phẩm và đơn vị của các LOT đã chọn...
                        </div>
                    ) : groups.length === 0 ? (
                        <div className="py-16 text-center text-sm text-slate-500">
                            Các LOT đã chọn không có dòng sản phẩm chi tiết (lot_items) để đổi đơn vị.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Cảnh báo phạm vi LOT */}
                            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl flex gap-3 text-amber-800 dark:text-amber-300 text-xs">
                                <AlertTriangle size={18} className="shrink-0 text-amber-500 mt-0.5" />
                                <div className="space-y-1">
                                    <p>
                                        Đơn vị tính lưu theo <span className="font-bold">dòng sản phẩm của LOT</span>, không lưu theo từng ô vị trí.
                                        Đổi đơn vị ở đây sẽ áp dụng cho <span className="font-bold">toàn bộ LOT</span> và mọi ô đang chứa LOT đó.
                                    </p>
                                    {partialLots.length > 0 && (
                                        <p className="font-semibold text-amber-900 dark:text-amber-200">
                                            {partialLots.length} LOT mới được chọn 1 phần vị trí nhưng vẫn đổi toàn bộ LOT:{' '}
                                            {partialLots.slice(0, 3).map(p =>
                                                `${lotCodesById[p.id] || p.id.slice(0, 8)} (${p.stat?.selected}/${p.stat?.total} ô)`
                                            ).join(', ')}
                                            {partialLots.length > 3 ? ` và ${partialLots.length - 3} LOT khác` : ''}
                                        </p>
                                    )}
                                    {skippedLegacyLots.length > 0 && (
                                        <p className="text-slate-600 dark:text-slate-400">
                                            {skippedLegacyLots.length} LOT cũ chỉ gắn sản phẩm trực tiếp (không có dòng chi tiết) nên không đổi được đơn vị riêng: {skippedLegacyLots.slice(0, 5).join(', ')}{skippedLegacyLots.length > 5 ? '…' : ''}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Áp dụng nhanh */}
                            {groups.length > 1 && allUnitOptions.length > 0 && (
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="font-bold text-slate-500 uppercase tracking-wider shrink-0">Áp dụng nhanh:</span>
                                    <select
                                        defaultValue=""
                                        onChange={e => { handleApplyAll(e.target.value); e.currentTarget.value = '' }}
                                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-semibold"
                                    >
                                        <option value="">— Chọn đơn vị cho mọi nhóm có đơn vị này —</option>
                                        {allUnitOptions.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                </div>
                            )}

                            {/* Danh sách nhóm sản phẩm */}
                            <div className="space-y-2.5">
                                {groups.map(g => {
                                    const chosen = selections[g.key] || ''
                                    const isChanged = !!chosen && canonicalizeUnit(chosen) !== canonicalizeUnit(g.currentUnit)
                                    const oldWeight = extractWeightFromName(g.currentUnit)
                                    const newWeight = extractWeightFromName(chosen)
                                    const showWeightImpact = isChanged && oldWeight && newWeight && oldWeight !== newWeight
                                    return (
                                        <div
                                            key={g.key}
                                            className={`rounded-xl border p-3 transition-colors ${isChanged
                                                ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-950/20'
                                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                                                }`}
                                        >
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                                                <span className="shrink-0 w-7 h-7 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-sm flex items-center justify-center">
                                                    {g.letter}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate" title={g.productName}>
                                                        {g.productName}
                                                    </p>
                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                        {g.sku && <span className="font-mono font-bold mr-1.5">{g.sku}</span>}
                                                        Đang là: <span className="font-bold">{g.currentUnit || '(trống)'}</span>
                                                        {' · '}{g.quantity} {g.currentUnit} · {g.lotCodes.length} LOT
                                                        {g.lotCodes.length <= 3 ? ` (${g.lotCodes.join(', ')})` : ''}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <ArrowRight size={15} className="text-slate-400" />
                                                    <select
                                                        value={chosen}
                                                        onChange={e => setSelections(prev => ({ ...prev, [g.key]: e.target.value }))}
                                                        disabled={saving}
                                                        className={`px-2.5 py-1.5 rounded-lg border text-sm font-bold max-w-[190px] focus:outline-none focus:ring-2 focus:ring-amber-500/40 ${isChanged
                                                            ? 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'
                                                            }`}
                                                    >
                                                        <option value="">— Giữ nguyên —</option>
                                                        {g.options.map(o => (
                                                            <option key={o} value={o}>
                                                                {o}{canonicalizeUnit(o) === canonicalizeUnit(g.currentUnit) ? ' (hiện tại)' : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            {showWeightImpact && (
                                                <p className="mt-2 ml-10 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                                                    Số lượng {g.quantity} {g.currentUnit} giữ nguyên, khối lượng quy đổi thay đổi:
                                                    {' '}{Number((g.quantity * oldWeight).toFixed(2)).toLocaleString('vi-VN')} kg → {Number((g.quantity * newWeight).toFixed(2)).toLocaleString('vi-VN')} kg
                                                </p>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {!result && (
                    <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 shrink-0">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                            {changedGroups.length > 0
                                ? `${changedGroups.length} nhóm sẽ đổi đơn vị · tổng ${changedGroups.reduce((s, g) => s + g.itemIds.length, 0)} dòng sản phẩm`
                                : 'Chọn đơn vị mới cho ít nhất một nhóm sản phẩm'}
                        </span>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={saving}
                                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-sm cursor-pointer disabled:opacity-50"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={saving || loading || changedGroups.length === 0}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-all text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-600/10"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Đang đổi đơn vị...
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        Xác nhận đổi đơn vị
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
