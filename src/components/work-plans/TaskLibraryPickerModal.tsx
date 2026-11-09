'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
    X,
    Search,
    Check,
    BookmarkPlus,
    Plus,
    ArrowRight,
} from 'lucide-react'
import { WorkTaskTemplate } from './TaskLibraryTab'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import {
    WORK_CATEGORIES,
    PRIORITY_CONFIG,
    getWarehouseBadge,
} from './types'

interface TaskLibraryPickerModalProps {
    isOpen: boolean
    onClose: () => void
    systemCode: string
    onSelectTemplates: (templates: WorkTaskTemplate[]) => void
}

export default function TaskLibraryPickerModal({
    isOpen,
    onClose,
    systemCode,
    onSelectTemplates,
}: TaskLibraryPickerModalProps) {
    const { systems } = useSystem()
    const storageKey = `wms_task_library_all`

    const [templates, setTemplates] = useState<WorkTaskTemplate[]>([])
    const [search, setSearch] = useState<string>('')
    const [selectedCategory, setSelectedCategory] = useState<string>('all')
    const [selectedSystemFilter, setSelectedSystemFilter] = useState<string>('all')
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    useEffect(() => {
        if (!isOpen) return
        const load = async () => {
            let fromDb: WorkTaskTemplate[] | null = null
            try {
                const { data, error } = await (supabase as any)
                    .from('work_task_templates')
                    .select('*')
                    .order('created_at', { ascending: false })
                if (!error && Array.isArray(data) && data.length > 0) {
                    fromDb = data
                }
            } catch {
                // ignore
            }

            if (fromDb && fromDb.length > 0) {
                setTemplates(fromDb)
            } else {
                try {
                    let loaded: WorkTaskTemplate[] = []
                    const rawAll = localStorage.getItem(storageKey)
                    if (rawAll) {
                        const parsed = JSON.parse(rawAll)
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            loaded = parsed
                        }
                    }
                    if (loaded.length === 0) {
                        const rawLegacy = localStorage.getItem(`wms_task_library_${systemCode}`)
                        if (rawLegacy) {
                            const parsedLegacy = JSON.parse(rawLegacy)
                            if (Array.isArray(parsedLegacy)) loaded = parsedLegacy
                        }
                    }
                    setTemplates(loaded)
                } catch {
                    // ignore
                }
            }
            setSelectedIds(new Set())
        }
        load()
    }, [isOpen, storageKey, systemCode])

    const filteredTemplates = useMemo(() => {
        return templates.filter(t => {
            if (selectedCategory !== 'all' && t.category !== selectedCategory) return false
            if (selectedSystemFilter !== 'all') {
                const tCode = t.target_system_code || 'ALL'
                if (selectedSystemFilter === 'ALL' && tCode !== 'ALL') return false
                if (selectedSystemFilter !== 'ALL' && tCode !== selectedSystemFilter && tCode !== 'ALL') return false
            }
            if (search.trim()) {
                const q = search.trim().toLowerCase()
                const matchTitle = t.title.toLowerCase().includes(q)
                const matchDesc = (t.description || '').toLowerCase().includes(q)
                const matchSys = (t.target_system_name || '').toLowerCase().includes(q)
                if (!matchTitle && !matchDesc && !matchSys) return false
            }
            return true
        })
    }, [templates, selectedCategory, selectedSystemFilter, search])

    if (!isOpen) return null

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const handleConfirm = () => {
        const chosen = templates.filter(t => selectedIds.has(t.id))
        if (chosen.length > 0) {
            onSelectTemplates(chosen)
        }
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-3">
            <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="px-5 py-4 bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                            <BookmarkPlus size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-extrabold tracking-tight">
                                Chọn Công Việc Từ Thư Viện Mẫu
                            </h3>
                            <p className="text-[11px] text-stone-300">
                                Tích chọn các công việc để liên kết nhanh vào ca làm việc hôm nay
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Filters */}
                <div className="p-3.5 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center gap-2 shrink-0">
                    <div className="relative flex-1 min-w-[180px]">
                        <Search
                            size={14}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                        />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Tìm kiếm công việc mẫu..."
                            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-200 text-xs font-medium text-stone-800 outline-hidden focus:border-indigo-500 bg-white"
                        />
                    </div>

                    {/* System Filter */}
                    <select
                        value={selectedSystemFilter}
                        onChange={e => setSelectedSystemFilter(e.target.value)}
                        className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-700 outline-hidden focus:border-indigo-500 bg-white"
                    >
                        <option value="all">🏢 Tất cả kho</option>
                        <option value="ALL">🌐 Dùng chung</option>
                        {systems.map(s => (
                            <option key={s.code} value={s.code}>
                                {s.name}
                            </option>
                        ))}
                    </select>

                    <select
                        value={selectedCategory}
                        onChange={e => setSelectedCategory(e.target.value)}
                        className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-700 outline-hidden focus:border-indigo-500 bg-white"
                    >
                        <option value="all">Tất cả danh mục ({templates.length})</option>
                        {WORK_CATEGORIES.map(c => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Body List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {filteredTemplates.length === 0 ? (
                        <div className="p-8 text-center text-xs text-stone-500">
                            Không tìm thấy công việc mẫu nào.
                        </div>
                    ) : (
                        filteredTemplates.map(tpl => {
                            const isSelected = selectedIds.has(tpl.id)
                            const pri = PRIORITY_CONFIG[tpl.default_priority || 'normal']
                            const sysBadge = getWarehouseBadge(
                                tpl.target_system_name || tpl.target_system_code
                            )

                            return (
                                <div
                                    key={tpl.id}
                                    onClick={() => toggleSelect(tpl.id)}
                                    className={`p-3 rounded-2xl border transition-all flex items-start justify-between gap-3 cursor-pointer ${
                                        isSelected
                                            ? 'bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-400/30'
                                            : 'bg-white hover:bg-stone-50 border-stone-200'
                                    }`}
                                >
                                    <div className="flex items-start gap-2.5 min-w-0">
                                        <div
                                            className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                                isSelected
                                                    ? 'bg-indigo-600 border-indigo-600 text-white'
                                                    : 'border-stone-300 bg-white'
                                            }`}
                                        >
                                            {isSelected && <Check size={13} />}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center flex-wrap gap-1.5">
                                                <span className="font-bold text-xs text-stone-900 leading-snug">
                                                    {tpl.title}
                                                </span>
                                                {/* Chip Phân Hệ Kho hiển thị ngay liền sau tiêu đề */}
                                                {tpl.target_system_code && tpl.target_system_code !== 'ALL' ? (
                                                    <span
                                                        className={`px-1.5 py-0.2 rounded-full border text-[9px] font-extrabold inline-flex items-center gap-1 shadow-2xs ${sysBadge.badgeClass}`}
                                                    >
                                                        <span>{sysBadge.icon}</span>
                                                        <span>{sysBadge.label}</span>
                                                    </span>
                                                ) : (
                                                    <span className="px-1.5 py-0.2 rounded-full border border-stone-200 bg-stone-50 text-stone-500 text-[9px] font-bold inline-flex items-center gap-0.5">
                                                        <span>🌐</span>
                                                        <span>Dùng chung</span>
                                                    </span>
                                                )}
                                                {/* Danh mục công việc */}
                                                <span className="px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 text-[9px] font-semibold">
                                                    {tpl.category}
                                                </span>
                                            </div>
                                            {tpl.description && (
                                                <div className="text-[11px] text-stone-500 mt-0.5 line-clamp-1">
                                                    {tpl.description}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="shrink-0 flex flex-col items-end gap-1">
                                        <span
                                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${pri.bgClass} ${pri.textClass}`}
                                        >
                                            {pri.label}
                                        </span>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-2 shrink-0">
                    <span className="text-xs font-bold text-stone-600">
                        Đã chọn: <b className="text-indigo-600">{selectedIds.size}</b> công việc
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl border border-stone-200 text-stone-600 text-xs font-semibold hover:bg-stone-100"
                        >
                            Đóng
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={selectedIds.size === 0}
                            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
                        >
                            <Plus size={14} />
                            Thêm {selectedIds.size > 0 ? selectedIds.size : ''} việc vào kế hoạch
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

