'use client'

import React, { useState, useMemo } from 'react'
import { X, Calendar, Loader2, Save, AlertCircle, Info, Check, Sparkles, Box, Clock, CalendarDays, Lock, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { logActivity } from '@/lib/audit'
import { Lot } from '@/app/(dashboard)/warehouses/lots/_hooks/useLotManagement'

interface LotBulkEditDatesModalProps {
    lotIds: string[]
    selectedLots?: Lot[]
    onClose: () => void
    onSuccess: () => void
}

interface DateFieldConfig {
    key: 'inbound_date' | 'packaging_date' | 'peeling_date' | 'raw_material_date'
    label: string
    description: string
    icon: any
    color: string
    bgColor: string
    borderColor: string
}

const DATE_FIELDS: DateFieldConfig[] = [
    {
        key: 'inbound_date',
        label: 'Ngày nhập kho',
        description: 'Thời điểm lô hàng chính thức nhập vào kho',
        icon: Clock,
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-950/30',
        borderColor: 'border-blue-200 dark:border-blue-800/60'
    },
    {
        key: 'packaging_date',
        label: 'Ngày đóng bao bì',
        description: 'Thời điểm đóng gói sản phẩm / bao bì thành phẩm',
        icon: Box,
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-50 dark:bg-purple-950/30',
        borderColor: 'border-purple-200 dark:border-purple-800/60'
    },
    {
        key: 'peeling_date',
        label: 'Ngày bóc múi',
        description: 'Thời điểm thực hiện công đoạn bóc tách múi',
        icon: Sparkles,
        color: 'text-amber-600 dark:text-amber-400',
        bgColor: 'bg-amber-50 dark:bg-amber-950/30',
        borderColor: 'border-amber-200 dark:border-amber-800/60'
    },
    {
        key: 'raw_material_date',
        label: 'Ngày nhập nguyên liệu',
        description: 'Thời điểm nhập nguyên liệu thô đầu vào',
        icon: CalendarDays,
        color: 'text-emerald-600 dark:text-emerald-400',
        bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
        borderColor: 'border-emerald-200 dark:border-emerald-800/60'
    }
]

export function LotBulkEditDatesModal({
    lotIds,
    selectedLots = [],
    onClose,
    onSuccess
}: LotBulkEditDatesModalProps) {
    const { currentSystem } = useSystem()
    const { showToast } = useToast()
    const [loading, setLoading] = useState(false)
    const [showCodesList, setShowCodesList] = useState(false)

    // Master date for quick applying to all enabled fields
    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])
    const [masterDate, setMasterDate] = useState<string>(todayStr)

    // Fields state: enabled (whether to update), value (YYYY-MM-DD), isClear (set to null)
    const [fieldStates, setFieldStates] = useState<Record<string, { enabled: boolean; value: string; isClear: boolean }>>({
        inbound_date: { enabled: false, value: todayStr, isClear: false },
        packaging_date: { enabled: false, value: todayStr, isClear: false },
        peeling_date: { enabled: false, value: todayStr, isClear: false },
        raw_material_date: { enabled: false, value: todayStr, isClear: false }
    })

    // Separate locked and unlocked lots
    const { unlockedLots, lockedLots, unlockedIds } = useMemo(() => {
        const locked: Lot[] = []
        const unlocked: Lot[] = []
        const uIds: string[] = []

        // If selectedLots is passed and matches lotIds
        if (selectedLots.length > 0) {
            selectedLots.forEach(lot => {
                if (lot.is_locked) {
                    locked.push(lot)
                } else {
                    unlocked.push(lot)
                    uIds.push(lot.id)
                }
            })
        } else {
            // Default: assume all lotIds are targets
            uIds.push(...lotIds)
        }

        return { unlockedLots: unlocked, lockedLots: locked, unlockedIds: uIds }
    }, [lotIds, selectedLots])

    // Toggle field enable
    const toggleField = (key: string) => {
        setFieldStates(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                enabled: !prev[key].enabled
            }
        }))
    }

    // Set field date value
    const setFieldValue = (key: string, value: string) => {
        setFieldStates(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                value,
                isClear: false,
                enabled: true
            }
        }))
    }

    // Set field clear flag (set to null in DB)
    const toggleFieldClear = (key: string) => {
        setFieldStates(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                isClear: !prev[key].isClear,
                enabled: true
            }
        }))
    }

    // Quick action: Apply master date to all currently enabled fields
    const handleApplyMasterDate = () => {
        if (!masterDate) {
            showToast('Vui lòng chọn ngày để áp dụng', 'warning')
            return
        }

        const anyEnabled = Object.values(fieldStates).some(f => f.enabled)
        setFieldStates(prev => {
            const next = { ...prev }
            DATE_FIELDS.forEach(f => {
                // If any are enabled, update enabled ones. Otherwise enable and update all.
                if (anyEnabled ? prev[f.key].enabled : true) {
                    next[f.key] = {
                        enabled: true,
                        value: masterDate,
                        isClear: false
                    }
                }
            })
            return next
        })

        showToast(`Đã áp dụng ngày ${masterDate.split('-').reverse().join('/')}`, 'info')
    }

    // Quick action: Select today for a single field
    const handleSetToday = (key: string) => {
        setFieldValue(key, todayStr)
    }

    // Check count of active updates
    const enabledFieldsCount = Object.values(fieldStates).filter(f => f.enabled).length

    // Handle submit
    const handleSubmit = async () => {
        if (enabledFieldsCount === 0) {
            showToast('Vui lòng tích chọn ít nhất một trường ngày để cập nhật', 'warning')
            return
        }

        const targetIds = unlockedIds.length > 0 ? unlockedIds : lotIds
        if (targetIds.length === 0) {
            showToast('Tất cả LOT đã chọn đều đang bị khóa, không thể cập nhật ngày', 'warning')
            return
        }

        // Validate that fields with isClear = false have a non-empty date value
        for (const f of DATE_FIELDS) {
            const state = fieldStates[f.key]
            if (state.enabled && !state.isClear && !state.value) {
                showToast(`Vui lòng chọn ngày hợp lệ cho trường "${f.label}"`, 'warning')
                return
            }
        }

        setLoading(true)
        try {
            // Build update payload
            const updatePayload: Record<string, any> = {}
            DATE_FIELDS.forEach(f => {
                const state = fieldStates[f.key]
                if (state.enabled) {
                    updatePayload[f.key] = state.isClear ? null : state.value
                }
            })

            // Query existing data to log before/after in audit_logs
            const { data: oldLotsData, error: fetchErr } = await (supabase
                .from('lots')
                .select('id, code, inbound_date, packaging_date, peeling_date, raw_material_date')
                .in('id', targetIds) as any)

            if (fetchErr) {
                console.warn('Could not fetch old lots data for audit, proceeding with update:', fetchErr)
            }

            // Update in Supabase
            let query = (supabase.from('lots') as any)
                .update(updatePayload)
                .in('id', targetIds)

            if (currentSystem?.code) {
                query = query.eq('system_code', currentSystem.code)
            }

            const { error: updateErr } = await query

            if (updateErr) throw updateErr

            // Asynchronously record audit logs without blocking the user
            try {
                const oldList = (oldLotsData as any[]) || []
                await Promise.all(
                    targetIds.map(id => {
                        const oldLot = oldList.find(l => l.id === id)
                        return logActivity({
                            supabase: supabase as any,
                            tableName: 'lots',
                            recordId: id,
                            action: 'UPDATE',
                            oldData: oldLot ? {
                                inbound_date: oldLot.inbound_date,
                                packaging_date: oldLot.packaging_date,
                                peeling_date: oldLot.peeling_date,
                                raw_material_date: oldLot.raw_material_date
                            } : null,
                            newData: updatePayload,
                            systemCode: currentSystem?.code
                        })
                    })
                )
            } catch (auditErr) {
                console.warn('Audit log recording error:', auditErr)
            }

            const skipMsg = lockedLots.length > 0 ? ` (đã bỏ qua ${lockedLots.length} LOT bị khóa)` : ''
            showToast(`Cập nhật ngày thành công cho ${targetIds.length} LOT${skipMsg}`, 'success')
            onSuccess()
        } catch (err: any) {
            console.error('Error updating lot dates:', err)
            showToast('Lỗi cập nhật ngày: ' + (err.message || 'Vui lòng thử lại'), 'error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="p-5 sm:p-6 pb-4 flex items-start justify-between border-b border-slate-100 dark:border-slate-800 bg-linear-to-r from-blue-50/50 to-indigo-50/50 dark:from-slate-900 dark:to-slate-800/80">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0">
                            <Calendar size={22} />
                        </div>
                        <div>
                            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                Đổi ngày tháng hàng loạt
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Cập nhật cho <span className="font-bold text-blue-600 dark:text-blue-400">{unlockedIds.length > 0 ? unlockedIds.length : lotIds.length}</span> LOT đã chọn
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Đóng"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">

                    {/* Locked Lots Notice if any */}
                    {lockedLots.length > 0 && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
                            <Lock className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" size={16} />
                            <div>
                                <span className="font-bold">Lưu ý:</span> Có <span className="font-bold">{lockedLots.length}</span> LOT đang bị khóa sẽ được giữ nguyên (không chỉnh sửa). Chỉ áp dụng cho <span className="font-bold">{unlockedLots.length}</span> LOT chưa khóa.
                            </div>
                        </div>
                    )}

                    {/* Quick collapsible affected LOTs badge list */}
                    {selectedLots.length > 0 && (
                        <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-3">
                            <div
                                onClick={() => setShowCodesList(!showCodesList)}
                                className="flex items-center justify-between cursor-pointer select-none text-xs font-semibold text-slate-700 dark:text-slate-300"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                                    <span>Danh sách mã LOT ảnh hưởng ({selectedLots.length})</span>
                                </div>
                                {showCodesList ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            </div>

                            {showCodesList && (
                                <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 max-h-28 overflow-y-auto pr-1">
                                    {selectedLots.map((lot) => (
                                        <span
                                            key={lot.id}
                                            className={`px-2 py-0.5 text-[11px] font-mono font-bold rounded-lg border flex items-center gap-1 ${lot.is_locked
                                                ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 line-through opacity-70'
                                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                                }`}
                                            title={lot.is_locked ? 'LOT đang bị khóa (bỏ qua)' : lot.code}
                                        >
                                            {lot.code}
                                            {lot.is_locked && <Lock size={10} />}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Master Date Quick Fill Bar */}
                    <div className="bg-linear-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-100 dark:border-blue-900/40 rounded-2xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                            <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
                                <Sparkles size={14} />
                                Công cụ gán ngày nhanh:
                            </span>
                            <button
                                type="button"
                                onClick={() => setMasterDate(todayStr)}
                                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                            >
                                Chọn hôm nay
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={masterDate}
                                onChange={(e) => setMasterDate(e.target.value)}
                                className="flex-1 px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                            <button
                                type="button"
                                onClick={handleApplyMasterDate}
                                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                                title="Điền ngày này vào các mục ngày được tích chọn"
                            >
                                <RefreshCw size={13} />
                                <span>Áp dụng</span>
                            </button>
                        </div>
                    </div>

                    {/* Date Fields List */}
                    <div className="space-y-3 pt-1">
                        <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-1">
                            Chọn các trường ngày cần cập nhật:
                        </div>

                        {DATE_FIELDS.map((field) => {
                            const state = fieldStates[field.key]
                            const IconComponent = field.icon

                            return (
                                <div
                                    key={field.key}
                                    className={`p-3.5 rounded-2xl border transition-all duration-150 ${state.enabled
                                        ? `${field.bgColor} ${field.borderColor} shadow-xs ring-1 ring-blue-500/20`
                                        : 'bg-white dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        {/* Checkbox & Field Label */}
                                        <label className="flex items-start gap-3 cursor-pointer select-none flex-1">
                                            <input
                                                type="checkbox"
                                                checked={state.enabled}
                                                onChange={() => toggleField(field.key)}
                                                className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 cursor-pointer"
                                            />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`p-1 rounded-lg ${state.enabled ? 'bg-white dark:bg-slate-800 shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'} ${field.color}`}>
                                                        <IconComponent size={14} />
                                                    </span>
                                                    <span className={`text-sm font-bold ${state.enabled ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                                                        {field.label}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 ml-7">
                                                    {field.description}
                                                </p>
                                            </div>
                                        </label>

                                        {/* Quick Clear Toggle when enabled */}
                                        {state.enabled && (
                                            <button
                                                type="button"
                                                onClick={() => toggleFieldClear(field.key)}
                                                className={`px-2 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer shrink-0 ${state.isClear
                                                    ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                                    : 'text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                                                    }`}
                                                title={state.isClear ? 'Nhấn để hủy xóa ngày' : 'Nhấn để xóa ngày (để trống dữ liệu)'}
                                            >
                                                {state.isClear ? '✓ Đang xóa (để trống)' : 'Xóa ngày'}
                                            </button>
                                        )}
                                    </div>

                                    {/* Date input (when enabled and not cleared) */}
                                    {state.enabled && !state.isClear && (
                                        <div className="mt-3 ml-7 flex items-center gap-2 animate-in fade-in duration-150">
                                            <input
                                                type="date"
                                                value={state.value}
                                                onChange={(e) => setFieldValue(field.key, e.target.value)}
                                                className="flex-1 px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleSetToday(field.key)}
                                                className="px-2.5 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors cursor-pointer shrink-0"
                                            >
                                                Hôm nay
                                            </button>
                                        </div>
                                    )}

                                    {/* Info if cleared */}
                                    {state.enabled && state.isClear && (
                                        <div className="mt-2.5 ml-7 text-[11px] text-rose-600 dark:text-rose-400 font-medium italic animate-in fade-in duration-150">
                                            * Ngày này sẽ được xóa về trống (null) cho tất cả các LOT đã chọn.
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                        {enabledFieldsCount > 0 ? (
                            <span className="text-blue-600 dark:text-blue-400 font-semibold">
                                Đang chọn {enabledFieldsCount} trường ngày
                            </span>
                        ) : (
                            <span>Chưa chọn trường ngày nào</span>
                        )}
                    </div>

                    <div className="flex items-center gap-2.5 ml-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                        >
                            Hủy
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={loading || enabledFieldsCount === 0 || (unlockedIds.length === 0 && lotIds.length > 0 && lockedLots.length === lotIds.length)}
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2 cursor-pointer"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>Đang cập nhật...</span>
                                </>
                            ) : (
                                <>
                                    <Save size={16} />
                                    <span>Lưu thay đổi</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    )
}
