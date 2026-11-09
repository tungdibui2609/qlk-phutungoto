'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
    Plus,
    Search,
    Tag,
    AlertCircle,
    Check,
    Trash2,
    Edit3,
    ArrowRight,
    BookmarkPlus,
    Layers,
    Sparkles,
    CheckCircle2,
    RotateCcw,
    SlidersHorizontal,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import {
    WorkPlanPriority,
    WORK_CATEGORIES,
    PRIORITY_CONFIG,
    getWarehouseBadge,
} from './types'

export interface WorkTaskTemplate {
    id: string
    company_id?: string | null
    title: string
    category: string
    default_priority: WorkPlanPriority
    target_system_code?: string | null
    target_system_name?: string | null
    default_area?: string | null
    description?: string | null
    created_at: string
}

const DEFAULT_PRESET_TEMPLATES: Omit<WorkTaskTemplate, 'id' | 'created_at'>[] = [
    {
        title: 'Hạ hàng xuất cont kiểm đếm & kiểm hóa',
        category: 'Xuất / Nhập cont',
        default_priority: 'important',
        description: 'Đưa pallet từ kho ra sảnh cont, kiểm tra ngoại quan tem nhãn và số lượng thùng',
    },
    {
        title: 'Duyệt & Đưa hàng thành phẩm lên kệ xe nâng',
        category: 'Vận hành kho',
        default_priority: 'normal',
        description: 'Vận chuyển pallet từ khu đóng gói/sản xuất lên đúng vị trí kệ đã chỉ định',
    },
    {
        title: 'Dán tem phụ và quấn màng co pallet xuất khẩu',
        category: 'Hàng sản xuất / Khay',
        default_priority: 'important',
        description: 'Kiểm tra mã LOT thành phẩm, dán tem thùng và quấn màng co bảo vệ',
    },
    {
        title: 'Vệ sinh 5S sàn kho, quét dọn & đập đá tuyết dàn lạnh',
        category: 'Vệ sinh & 5S',
        default_priority: 'normal',
        description: 'Dọn dẹp lối đi xe nâng, làm sạch tuyết bám quạt dàn lạnh và thu gom rác bao bì',
    },
    {
        title: 'Sắp xếp, đảo chuyển kệ & gom ghép LOT tồn lẻ',
        category: 'Sắp xếp & Ghép hàng',
        default_priority: 'normal',
        description: 'Tối ưu không gian chứa hàng, gom các lô tồn ít vị trí về khu vực tập trung',
    },
    {
        title: 'Kiểm tra an toàn bình điện & bảo trì xe nâng đầu ca',
        category: 'Bảo trì / Thiết bị',
        default_priority: 'urgent',
        description: 'Châm nước cất bình ắc quy, kiểm tra phanh, đèn chiếu sáng và còi cảnh báo xe nâng',
    },
    {
        title: 'Soạn hàng lẻ & giao xe tải giao nội địa',
        category: 'Vận hành kho',
        default_priority: 'normal',
        description: 'Kiểm đếm theo phiếu xuất kho nội địa, xếp hàng cẩn thận lên thùng xe tải',
    },
]

interface TaskLibraryTabProps {
    systemCode: string
    systemName: string
    onAddTemplateToPlan: (template: WorkTaskTemplate) => void
    onAddMultipleTemplatesToPlan?: (templates: WorkTaskTemplate[]) => void
}

export default function TaskLibraryTab({
    systemCode,
    systemName,
    onAddTemplateToPlan,
    onAddMultipleTemplatesToPlan,
}: TaskLibraryTabProps) {
    const { systems, currentSystem } = useSystem()
    const { profile } = useUser()
    const companyId = profile?.company_id || null

    // Lưu trữ tập trung để các phân hệ kho cùng dùng chung thư viện
    const storageKey = `wms_task_library_all`

    const [templates, setTemplates] = useState<WorkTaskTemplate[]>([])
    const [search, setSearch] = useState<string>('')
    const [selectedCategory, setSelectedCategory] = useState<string>('all')
    const [selectedSystemFilter, setSelectedSystemFilter] = useState<string>('all')
    const [loading, setLoading] = useState<boolean>(true)
    const [dbMissing, setDbMissing] = useState<boolean>(false)
    const [copiedSql, setCopiedSql] = useState<boolean>(false)

    // Selection state for adding multiple tasks
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    // Modal Create / Edit
    const [showEditModal, setShowEditModal] = useState<boolean>(false)
    const [editingTemplate, setEditingTemplate] = useState<WorkTaskTemplate | null>(null)
    const [formTitle, setFormTitle] = useState<string>('')
    const [formCategory, setFormCategory] = useState<string>('Vận hành kho')
    const [formPriority, setFormPriority] = useState<WorkPlanPriority>('normal')
    const [formTargetSystem, setFormTargetSystem] = useState<string>('ALL')
    const [formDescription, setFormDescription] = useState<string>('')
    const [saving, setSaving] = useState<boolean>(false)

    // Helper lưu local backup
    const saveTemplatesLocal = (next: WorkTaskTemplate[]) => {
        setTemplates(next)
        try {
            localStorage.setItem(storageKey, JSON.stringify(next))
        } catch {
            // ignore
        }
    }

    // Load templates từ Supabase Database (với fallback localStorage)
    useEffect(() => {
        const loadData = async () => {
            setLoading(true)
            let loadedFromDb: WorkTaskTemplate[] | null = null

            try {
                const { data, error } = await (supabase as any)
                    .from('work_task_templates')
                    .select('*')
                    .order('created_at', { ascending: false })

                if (error) {
                    if (
                        error.code === 'PGRST205' ||
                        error.message?.includes('schema cache') ||
                        error.message?.includes('does not exist')
                    ) {
                        setDbMissing(true)
                    }
                } else if (Array.isArray(data)) {
                    loadedFromDb = data
                    setDbMissing(false)
                }
            } catch {
                // ignore
            }

            // Đọc local backup nếu có
            let localList: WorkTaskTemplate[] = []
            try {
                const raw =
                    localStorage.getItem(storageKey) ||
                    localStorage.getItem(`wms_task_library_${systemCode}`)
                if (raw) {
                    const parsed = JSON.parse(raw)
                    if (Array.isArray(parsed)) localList = parsed
                }
            } catch {}

            // 1. Nếu Database đã có dữ liệu -> Ưu tiên dùng dữ liệu từ Database
            if (loadedFromDb && loadedFromDb.length > 0) {
                setTemplates(loadedFromDb)
                try {
                    localStorage.setItem(storageKey, JSON.stringify(loadedFromDb))
                } catch {}
                setLoading(false)
                return
            }

            // 2. Nếu Database có bảng nhưng chưa có dòng nào, mà localStorage đã có mẫu người dùng tạo -> Tự động Sync lên Database
            if (loadedFromDb && loadedFromDb.length === 0 && localList.length > 0) {
                try {
                    const rowsToInsert = localList.map(item => ({
                        company_id: companyId,
                        target_system_code: item.target_system_code || 'ALL',
                        target_system_name: item.target_system_name || 'Dùng chung',
                        title: item.title,
                        category: item.category || 'Vận hành kho',
                        default_priority: item.default_priority || 'normal',
                        description: item.description || null,
                    }))
                    const { data: inserted } = await (supabase as any)
                        .from('work_task_templates')
                        .insert(rowsToInsert)
                        .select('*')
                    if (Array.isArray(inserted) && inserted.length > 0) {
                        setTemplates(inserted)
                        try {
                            localStorage.setItem(storageKey, JSON.stringify(inserted))
                        } catch {}
                        setLoading(false)
                        return
                    }
                } catch {}
            }

            // 3. Fallback dùng localList
            if (localList.length > 0) {
                setTemplates(localList)
                setLoading(false)
                return
            }

            // 4. Default presets ban đầu
            const initial: WorkTaskTemplate[] = DEFAULT_PRESET_TEMPLATES.map((item, idx) => ({
                ...item,
                id: `tpl_default_${idx + 1}`,
                target_system_code: 'ALL',
                target_system_name: 'Dùng chung',
                created_at: new Date().toISOString(),
            }))
            setTemplates(initial)
            try {
                localStorage.setItem(storageKey, JSON.stringify(initial))
            } catch {}
            setLoading(false)
        }

        loadData()
    }, [storageKey, systemCode, companyId])

    const filteredTemplates = useMemo(() => {
        return templates.filter(t => {
            if (selectedCategory !== 'all' && t.category !== selectedCategory) return false
            if (selectedSystemFilter !== 'all') {
                const tCode = t.target_system_code || 'ALL'
                if (selectedSystemFilter === 'ALL' && tCode !== 'ALL') return false
                if (selectedSystemFilter !== 'ALL' && tCode !== selectedSystemFilter && tCode !== 'ALL')
                    return false
            }
            if (search.trim()) {
                const q = search.trim().toLowerCase()
                const matchTitle = t.title.toLowerCase().includes(q)
                const matchDesc = (t.description || '').toLowerCase().includes(q)
                const matchSystem = (t.target_system_name || '').toLowerCase().includes(q)
                if (!matchTitle && !matchDesc && !matchSystem) return false
            }
            return true
        })
    }, [templates, selectedCategory, selectedSystemFilter, search])

    const handleOpenCreate = () => {
        setEditingTemplate(null)
        setFormTitle('')
        setFormCategory('Vận hành kho')
        setFormPriority('normal')
        setFormTargetSystem(currentSystem?.code || 'ALL')
        setFormDescription('')
        setShowEditModal(true)
    }

    const handleOpenEdit = (t: WorkTaskTemplate) => {
        setEditingTemplate(t)
        setFormTitle(t.title)
        setFormCategory(t.category || 'Vận hành kho')
        setFormPriority(t.default_priority || 'normal')
        setFormTargetSystem(t.target_system_code || 'ALL')
        setFormDescription(t.description || '')
        setShowEditModal(true)
    }

    const handleSaveForm = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formTitle.trim()) return

        setSaving(true)
        // Xác định tên hiển thị của phân hệ kho
        let sysName = 'Dùng chung'
        if (formTargetSystem !== 'ALL') {
            const found = systems.find(s => s.code === formTargetSystem)
            sysName = found ? found.name : formTargetSystem
        }

        if (editingTemplate) {
            // Update in Supabase Database
            try {
                await (supabase as any)
                    .from('work_task_templates')
                    .update({
                        target_system_code: formTargetSystem,
                        target_system_name: sysName,
                        title: formTitle.trim(),
                        category: formCategory,
                        default_priority: formPriority,
                        description: formDescription.trim() || null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', editingTemplate.id)
            } catch (err) {
                console.error('Update template in DB error:', err)
            }

            const next = templates.map(t =>
                t.id === editingTemplate.id
                    ? {
                          ...t,
                          title: formTitle.trim(),
                          category: formCategory,
                          default_priority: formPriority,
                          target_system_code: formTargetSystem,
                          target_system_name: sysName,
                          default_area: null,
                          description: formDescription.trim() || null,
                      }
                    : t
            )
            saveTemplatesLocal(next)
        } else {
            // Insert into Supabase Database
            let createdId = `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
            try {
                const { data, error } = await (supabase as any)
                    .from('work_task_templates')
                    .insert({
                        company_id: companyId,
                        target_system_code: formTargetSystem,
                        target_system_name: sysName,
                        title: formTitle.trim(),
                        category: formCategory,
                        default_priority: formPriority,
                        description: formDescription.trim() || null,
                    })
                    .select('*')
                    .single()

                if (data && !error) {
                    createdId = data.id
                }
            } catch (err) {
                console.error('Insert template to DB error:', err)
            }

            const newTpl: WorkTaskTemplate = {
                id: createdId,
                company_id: companyId,
                title: formTitle.trim(),
                category: formCategory,
                default_priority: formPriority,
                target_system_code: formTargetSystem,
                target_system_name: sysName,
                default_area: null,
                description: formDescription.trim() || null,
                created_at: new Date().toISOString(),
            }
            saveTemplatesLocal([newTpl, ...templates])
        }

        setSaving(false)
        setShowEditModal(false)
    }

    const handleDeleteTemplate = async (id: string, title: string) => {
        if (!window.confirm(`Bạn có chắc muốn xóa công việc mẫu "${title}" khỏi thư viện?`)) return
        try {
            await (supabase as any).from('work_task_templates').delete().eq('id', id)
        } catch (err) {
            console.error('Delete template in DB error:', err)
        }
        const next = templates.filter(t => t.id !== id)
        saveTemplatesLocal(next)
        setSelectedIds(prev => {
            const s = new Set(prev)
            s.delete(id)
            return s
        })
    }

    const handleResetDefaults = () => {
        if (!window.confirm('Khôi phục danh sách công việc mẫu mặc định của kho?')) return
        const initial = DEFAULT_PRESET_TEMPLATES.map((item, idx) => ({
            ...item,
            id: `tpl_default_${idx + 1}`,
            created_at: new Date().toISOString(),
        }))
        saveTemplatesLocal(initial)
    }

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const handleAddSelectedToPlan = () => {
        const toAdd = templates.filter(t => selectedIds.has(t.id))
        if (toAdd.length === 0) return
        if (onAddMultipleTemplatesToPlan) {
            onAddMultipleTemplatesToPlan(toAdd)
        } else {
            toAdd.forEach(t => onAddTemplateToPlan(t))
        }
        setSelectedIds(new Set())
    }

    const CREATE_TABLE_SQL = `-- Tạo bảng work_task_templates trên Supabase
CREATE TABLE IF NOT EXISTS public.work_task_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    target_system_code TEXT NOT NULL DEFAULT 'ALL',
    target_system_name TEXT NOT NULL DEFAULT 'Dùng chung',
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Vận hành kho',
    default_priority TEXT NOT NULL DEFAULT 'normal' CHECK (default_priority IN ('urgent', 'important', 'normal')),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.work_task_templates ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'work_task_templates' AND policyname = 'Enable all access for authenticated and anon users'
    ) THEN
        CREATE POLICY "Enable all access for authenticated and anon users" ON public.work_task_templates FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
    END IF;
END $$;`

    const handleCopySql = () => {
        navigator.clipboard.writeText(CREATE_TABLE_SQL)
        setCopiedSql(true)
        setTimeout(() => setCopiedSql(false), 3000)
    }

    return (
        <div className="space-y-4">
            {/* Banner nếu bảng work_task_templates chưa tồn tại trên Supabase */}
            {dbMissing && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-start gap-2.5">
                        <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <div className="font-extrabold text-sm text-amber-950">
                                Bảng Thư viện mẫu (`work_task_templates`) chưa có trên Database Supabase
                            </div>
                            <p className="text-amber-800 mt-0.5 leading-relaxed">
                                Hiện tại hệ thống đang lưu tạm trên trình duyệt để bạn không bị gián đoạn. Hãy dán câu lệnh SQL vào <b>Supabase SQL Editor</b> và bấm <b>Run</b> để lưu vĩnh viễn trên cơ sở dữ liệu.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleCopySql}
                        className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shrink-0 transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                        {copiedSql ? <Check size={14} /> : <Layers size={14} />}
                        {copiedSql ? 'Đã sao chép SQL!' : 'Sao chép mã SQL'}
                    </button>
                </div>
            )}

            {/* Top Toolbar */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                            <BookmarkPlus size={20} />
                        </div>
                        <div>
                            <h2 className="text-base font-extrabold text-stone-900 flex items-center gap-2">
                                <span>Thư Viện & Quản Lý Công Việc Mẫu</span>
                                <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-black">
                                    {templates.length} công việc
                                </span>
                            </h2>
                            <p className="text-xs text-stone-500">
                                Định nghĩa sẵn các đầu việc định kỳ hoặc tiêu chuẩn của phân hệ {systemName} để liên kết nhanh vào kế hoạch ca hàng ngày
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {selectedIds.size > 0 && (
                            <button
                                type="button"
                                onClick={handleAddSelectedToPlan}
                                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
                            >
                                <Check size={14} />
                                Đưa {selectedIds.size} việc đã chọn vào ca làm việc
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={handleOpenCreate}
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
                        >
                            <Plus size={15} />
                            + Thêm Công Việc Mới
                        </button>

                        <button
                            type="button"
                            onClick={handleResetDefaults}
                            className="p-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-600 text-xs font-bold transition-all"
                            title="Khôi phục mẫu mặc định"
                        >
                            <RotateCcw size={15} />
                        </button>
                    </div>
                </div>

                {/* Filters & Search */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-100">
                    <div className="relative flex-1 min-w-[220px]">
                        <Search
                            size={14}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                        />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Tìm kiếm công việc mẫu theo tên, khu vực, mô tả..."
                            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-200 text-xs font-medium text-stone-800 outline-hidden focus:border-indigo-500 bg-white"
                        />
                    </div>

                    {/* Filter by System / Warehouse */}
                    <select
                        value={selectedSystemFilter}
                        onChange={e => setSelectedSystemFilter(e.target.value)}
                        className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-700 outline-hidden focus:border-indigo-500 bg-white"
                    >
                        <option value="all">🏢 Tất cả phân hệ kho</option>
                        <option value="ALL">🌐 Dùng chung mọi kho</option>
                        {systems.map(s => (
                            <option key={s.code} value={s.code}>
                                {s.name}
                            </option>
                        ))}
                    </select>

                    {/* Filter by Category */}
                    <select
                        value={selectedCategory}
                        onChange={e => setSelectedCategory(e.target.value)}
                        className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-700 outline-hidden focus:border-indigo-500 bg-white"
                    >
                        <option value="all">Tất cả danh mục</option>
                        {WORK_CATEGORIES.map(c => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Template Cards Grid */}
            {filteredTemplates.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-2xl border border-stone-200 space-y-2">
                    <p className="text-sm font-bold text-stone-700">
                        Không tìm thấy công việc nào phù hợp với bộ lọc.
                    </p>
                    <p className="text-xs text-stone-400">
                        Hãy thử đổi từ khóa tìm kiếm hoặc bấm &ldquo;+ Thêm Công Việc Mới&rdquo; để tạo thêm.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredTemplates.map(tpl => {
                        const isSelected = selectedIds.has(tpl.id)
                        const pri = PRIORITY_CONFIG[tpl.default_priority || 'normal']
                        const sysBadge = getWarehouseBadge(
                            tpl.target_system_name || tpl.target_system_code
                        )

                        return (
                            <div
                                key={tpl.id}
                                className={`p-4 rounded-2xl border bg-white transition-all shadow-2xs flex flex-col justify-between gap-3 hover:shadow-md ${
                                    isSelected
                                        ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/10'
                                        : 'border-stone-200 hover:border-indigo-200'
                                }`}
                            >
                                <div className="space-y-2.5">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelect(tpl.id)}
                                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-stone-300 cursor-pointer mr-1"
                                                title="Chọn việc này để thêm hàng loạt"
                                            />
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                            <span
                                                className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${pri.bgClass} ${pri.textClass}`}
                                            >
                                                {pri.label}
                                            </span>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center flex-wrap gap-1.5">
                                            <h3 className="font-bold text-stone-900 text-sm leading-snug">
                                                {tpl.title}
                                            </h3>
                                            {/* Chip Phân Hệ Kho hiển thị ngay liền sau tiêu đề */}
                                            {tpl.target_system_code && tpl.target_system_code !== 'ALL' ? (
                                                <span
                                                    className={`px-2 py-0.5 rounded-full border text-[10px] font-extrabold inline-flex items-center gap-1 shadow-2xs ${sysBadge.badgeClass}`}
                                                    title={`Phân hệ áp dụng: ${sysBadge.label}`}
                                                >
                                                    <span>{sysBadge.icon}</span>
                                                    <span>{sysBadge.label}</span>
                                                </span>
                                            ) : (
                                                <span
                                                    className="px-2 py-0.5 rounded-full border border-stone-200 bg-stone-50 text-stone-500 text-[10px] font-bold inline-flex items-center gap-1"
                                                    title="Dùng chung cho tất cả các kho"
                                                >
                                                    <span>🌐</span>
                                                    <span>Dùng chung</span>
                                                </span>
                                            )}

                                            {/* Danh mục công việc (Vận hành kho, Bảo trì...) đưa lên cùng hàng tiêu đề */}
                                            <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200 text-[10px] font-semibold">
                                                {tpl.category}
                                            </span>
                                        </div>
                                        {tpl.description && (
                                            <p className="text-xs text-stone-500 mt-1 line-clamp-2 leading-relaxed">
                                                {tpl.description}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => handleOpenEdit(tpl)}
                                            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                                            title="Chỉnh sửa công việc mẫu"
                                        >
                                            <Edit3 size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteTemplate(tpl.id, tpl.title)}
                                            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                            title="Xóa công việc mẫu"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>

                                    {/* Action to add this template to today's plan */}
                                    <button
                                        type="button"
                                        onClick={() => onAddTemplateToPlan(tpl)}
                                        className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-extrabold text-xs transition-all flex items-center gap-1 shadow-2xs"
                                    >
                                        <span>Giao việc này</span>
                                        <ArrowRight size={13} />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Create / Edit Template Modal */}
            {showEditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-3">
                    <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-5 py-4 bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex items-center justify-between">
                            <h3 className="text-sm font-extrabold">
                                {editingTemplate ? 'Chỉnh Sửa Công Việc Mẫu' : 'Tạo Công Việc Mới Vào Thư Viện'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowEditModal(false)}
                                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveForm} className="p-5 space-y-3.5 text-xs">
                            <div>
                                <label className="font-bold text-stone-700 block mb-1">
                                    Tên / Nội dung công việc <span className="text-rose-500">*</span>
                                </label>
                                <textarea
                                    required
                                    rows={2}
                                    value={formTitle}
                                    onChange={e => setFormTitle(e.target.value)}
                                    placeholder="VD: Hạ hàng xuất cont kiểm đếm & dán tem..."
                                    className="w-full px-3 py-2 rounded-xl border border-stone-200 font-medium text-stone-800 outline-hidden focus:border-indigo-500"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                <div>
                                    <label className="font-bold text-stone-700 block mb-1">
                                        Kho / Phân hệ thực hiện
                                    </label>
                                    <select
                                        value={formTargetSystem}
                                        onChange={e => setFormTargetSystem(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-stone-200 font-bold text-stone-800 outline-hidden focus:border-indigo-500 bg-white"
                                    >
                                        <option value="ALL">🌐 Dùng chung mọi kho</option>
                                        {systems.map(s => (
                                            <option key={s.code} value={s.code}>
                                                {s.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="font-bold text-stone-700 block mb-1">
                                        Danh mục công việc
                                    </label>
                                    <select
                                        value={formCategory}
                                        onChange={e => setFormCategory(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-stone-200 font-bold text-stone-800 outline-hidden focus:border-indigo-500 bg-white"
                                    >
                                        {WORK_CATEGORIES.map(c => (
                                            <option key={c} value={c}>
                                                {c}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="font-bold text-stone-700 block mb-1">
                                        Mức ưu tiên mặc định
                                    </label>
                                    <select
                                        value={formPriority}
                                        onChange={e =>
                                            setFormPriority(e.target.value as WorkPlanPriority)
                                        }
                                        className="w-full px-3 py-2 rounded-xl border border-stone-200 font-bold text-stone-800 outline-hidden focus:border-indigo-500 bg-white"
                                    >
                                        <option value="normal">Ưu tiên: Thường</option>
                                        <option value="important">Ưu tiên: Quan trọng</option>
                                        <option value="urgent">Ưu tiên: Khẩn cấp</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="font-bold text-stone-700 block mb-1">
                                    Mô tả chi tiết / Tiêu chuẩn hướng dẫn
                                </label>
                                <textarea
                                    rows={2}
                                    value={formDescription}
                                    onChange={e => setFormDescription(e.target.value)}
                                    placeholder="Hướng dẫn thực hiện, các bước an toàn cần chú ý..."
                                    className="w-full px-3 py-2 rounded-xl border border-stone-200 font-medium text-stone-800 outline-hidden focus:border-indigo-500"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="px-4 py-2 rounded-xl border border-stone-200 text-stone-600 font-semibold hover:bg-stone-50"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs flex items-center gap-1.5"
                                >
                                    <CheckCircle2 size={15} />
                                    {editingTemplate ? 'Lưu Thay Đổi' : 'Thêm Vào Thư Viện'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

