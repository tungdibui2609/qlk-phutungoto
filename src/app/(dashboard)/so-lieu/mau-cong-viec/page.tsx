'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
    Briefcase,
    Plus,
    Pencil,
    Trash2,
    Copy,
    ArrowLeft,
    Check,
    Search,
    Pin,
    X,
    RotateCcw,
    Sparkles,
    Tag,
    FileText,
    Boxes
} from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'
import { supabase } from '@/lib/supabaseClient'
import {
    JobTemplate,
    DEFAULT_JOB_TEMPLATES,
    getJobTemplates,
    saveJobTemplates,
    deleteJobTemplateSQL
} from '@/lib/jobTemplates'

interface ProductOption {
    id: string
    name: string
    sku?: string | null
    unit?: string | null
}

export default function JobTemplatesPage() {
    const { currentSystem } = useSystem()
    const systemCode = currentSystem?.code || 'COLD'

    const [templates, setTemplates] = useState<JobTemplate[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    // Danh sách sản phẩm khả dụng trong kho để gán vào mẫu
    const [allProducts, setAllProducts] = useState<ProductOption[]>([])
    const [loadingProducts, setLoadingProducts] = useState(false)

    // Modal Thêm / Sửa
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingTemplate, setEditingTemplate] = useState<JobTemplate | null>(null)
    const [modalName, setModalName] = useState('')
    const [modalNotes, setModalNotes] = useState('')
    const [modalPinnedIds, setModalPinnedIds] = useState<string[]>([])
    const [productSearch, setProductSearch] = useState('')

    // Thông báo Toast
    const [toastMessage, setToastMessage] = useState<string | null>(null)

    const showToast = (msg: string) => {
        setToastMessage(msg)
        setTimeout(() => setToastMessage(null), 3000)
    }

    // 1. Nạp danh sách mẫu công việc
    useEffect(() => {
        let mounted = true
        async function loadData() {
            setLoading(true)
            try {
                const list = await getJobTemplates(systemCode)
                if (mounted) setTemplates(list)
            } catch (err) {
                console.error('Lỗi tải mẫu công việc:', err)
                if (mounted) setTemplates(DEFAULT_JOB_TEMPLATES)
            } finally {
                if (mounted) setLoading(false)
            }
        }
        loadData()
        return () => { mounted = false }
    }, [systemCode])

    // 2. Nạp danh sách sản phẩm trong kho
    useEffect(() => {
        let mounted = true
        async function loadProducts() {
            if (!systemCode) return
            setLoadingProducts(true)
            try {
                let query = (supabase as any)
                    .from('products')
                    .select('id, name, sku, unit')
                    .order('name', { ascending: true })

                query = query.or(`system_code.eq.${systemCode},system_type.eq.${systemCode}`)
                const { data, error } = await query
                if (!error && data && mounted) {
                    setAllProducts(data)
                }
            } catch (e) {
                console.error('Lỗi tải danh mục sản phẩm:', e)
            } finally {
                if (mounted) setLoadingProducts(false)
            }
        }
        loadProducts()
        return () => { mounted = false }
    }, [systemCode])

    // Lọc danh sách mẫu theo tìm kiếm
    const filteredTemplates = useMemo(() => {
        if (!searchQuery.trim()) return templates
        const q = searchQuery.toLowerCase().trim()
        return templates.filter(t =>
            t.name.toLowerCase().includes(q) ||
            (t.notes && t.notes.toLowerCase().includes(q))
        )
    }, [templates, searchQuery])

    // Mở modal tạo mới
    const handleOpenCreate = () => {
        setEditingTemplate(null)
        setModalName('')
        setModalNotes('')
        setModalPinnedIds([])
        setProductSearch('')
        setIsModalOpen(true)
    }

    // Mở modal chỉnh sửa
    const handleOpenEdit = (tpl: JobTemplate) => {
        setEditingTemplate(tpl)
        setModalName(tpl.name)
        setModalNotes(tpl.notes || '')
        setModalPinnedIds(tpl.pinned_product_ids || [])
        setProductSearch('')
        setIsModalOpen(true)
    }

    // Nhân bản mẫu
    const handleDuplicate = async (tpl: JobTemplate) => {
        const newTpl: JobTemplate = {
            id: 'tpl_' + Date.now(),
            name: `${tpl.name} (Bản sao)`,
            notes: tpl.notes || '',
            pinned_product_ids: [...(tpl.pinned_product_ids || [])],
            created_at: new Date().toISOString()
        }
        const updated = [newTpl, ...templates]
        setTemplates(updated)
        await saveJobTemplates(systemCode, updated)
        showToast(`Đã nhân bản "${newTpl.name}"`)
    }

    // Xóa mẫu
    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Bạn có chắc chắn muốn xóa mẫu công việc "${name}"?`)) return
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        if (isUuid) {
            await deleteJobTemplateSQL(id)
        }
        const updated = templates.filter(t => t.id !== id)
        setTemplates(updated)
        await saveJobTemplates(systemCode, updated, currentSystem?.company_id)
        showToast(`Đã xóa mẫu công việc "${name}"`)
    }

    // Khôi phục về danh sách mẫu mặc định
    const handleResetDefaults = async () => {
        if (!confirm('Khôi phục danh sách mẫu về 5 công việc mặc định ban đầu?')) return
        setTemplates(DEFAULT_JOB_TEMPLATES)
        await saveJobTemplates(systemCode, DEFAULT_JOB_TEMPLATES, currentSystem?.company_id)
        showToast('Đã khôi phục các mẫu công việc mặc định!')
    }

    // Lưu modal (Tạo mới hoặc Sửa)
    const handleSaveModal = async () => {
        const trimmedName = modalName.trim()
        if (!trimmedName) {
            alert('Vui lòng nhập Tên công việc mẫu!')
            return
        }

        setSaving(true)
        try {
            let updated: JobTemplate[]
            if (editingTemplate) {
                updated = templates.map(t =>
                    t.id === editingTemplate.id
                        ? {
                              ...t,
                              name: trimmedName,
                              notes: modalNotes.trim() || null,
                              pinned_product_ids: modalPinnedIds,
                              updated_at: new Date().toISOString()
                          }
                        : t
                )
                showToast(`Đã cập nhật mẫu "${trimmedName}"`)
            } else {
                const newTpl: JobTemplate = {
                    id: 'tpl_' + Date.now(),
                    name: trimmedName,
                    notes: modalNotes.trim() || null,
                    pinned_product_ids: modalPinnedIds,
                    system_code: systemCode,
                    company_id: currentSystem?.company_id || null,
                    created_at: new Date().toISOString()
                }
                updated = [newTpl, ...templates]
                showToast(`Đã tạo mẫu công việc "${trimmedName}"`)
            }

            setTemplates(updated)
            await saveJobTemplates(systemCode, updated, currentSystem?.company_id)
            setIsModalOpen(false)
        } catch (err: any) {
            alert('Lỗi lưu mẫu công việc: ' + (err?.message || err))
        } finally {
            setSaving(false)
        }
    }

    // Toggle ghim sản phẩm trong modal
    const toggleModalProduct = (productId: string) => {
        setModalPinnedIds(prev =>
            prev.includes(productId)
                ? prev.filter(id => id !== productId)
                : [...prev, productId]
        )
    }

    // Danh sách sản phẩm lọc khi tìm kiếm trong modal
    const modalFilteredProducts = useMemo(() => {
        if (!productSearch.trim()) return allProducts.slice(0, 15)
        const q = productSearch.toLowerCase().trim()
        return allProducts.filter(p =>
            p.name.toLowerCase().includes(q) ||
            (p.sku && p.sku.toLowerCase().includes(q))
        ).slice(0, 20)
    }, [allProducts, productSearch])

    return (
        <div className="min-h-screen bg-stone-50/50 dark:bg-zinc-950 p-3 sm:p-6 space-y-4 sm:space-y-6">
            {/* TOAST THÔNG BÁO */}
            {toastMessage && (
                <div className="fixed top-5 right-5 z-50 bg-indigo-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
                    <Check className="w-4 h-4" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* HEADER */}
            <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/so-lieu"
                            className="p-2 sm:p-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 text-stone-600 dark:text-stone-300 transition"
                            title="Quay lại Bàn Số Liệu"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-base sm:text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
                                    <Briefcase className="w-5 h-5 text-indigo-600" />
                                    <span>Quản Lý Công Việc Mẫu</span>
                                </h1>
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                    {currentSystem?.name || systemCode}
                                </span>
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                                    {templates.length} mẫu
                                </span>
                            </div>
                            <p className="text-xs text-stone-500 mt-0.5">
                                Tạo trước các mẫu công việc kèm ghi chú và sản phẩm thường dùng riêng cho từng phân hệ kho
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={handleOpenCreate}
                            className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition"
                        >
                            <Plus className="w-4 h-4" /> Thêm công việc mẫu
                        </button>
                    </div>
                </div>

                {/* THANH TÌM KIẾM */}
                <div className="mt-4 pt-3.5 border-t border-stone-100 dark:border-zinc-800">
                    <div className="relative max-w-md">
                        <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Tìm kiếm công việc mẫu theo tên hoặc ghi chú..."
                            className="w-full text-xs font-medium pl-9 pr-3 py-2 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>
            </div>

            {/* DANH SÁCH THẺ CÔNG VIỆC MẪU */}
            {loading ? (
                <div className="p-12 text-center text-xs text-stone-400">Đang tải danh sách công việc mẫu...</div>
            ) : filteredTemplates.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 border border-dashed border-stone-200 dark:border-zinc-800 rounded-2xl p-10 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 mx-auto flex items-center justify-center">
                        <Briefcase className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200">
                        {searchQuery ? 'Không tìm thấy công việc mẫu phù hợp' : 'Chưa có công việc mẫu nào'}
                    </h3>
                    <p className="text-xs text-stone-500 max-w-sm mx-auto">
                        Tạo các công việc mẫu như "Đóng gói sầu riêng xuất khẩu", "Rút ruột sầu riêng"... để khi mở ca nhân viên chỉ cần bấm chọn nhanh.
                    </p>
                    <button
                        type="button"
                        onClick={handleOpenCreate}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
                    >
                        <Plus className="w-3.5 h-3.5" /> Tạo mẫu đầu tiên
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                    {filteredTemplates.map(tpl => {
                        const pinnedCount = tpl.pinned_product_ids?.length || 0
                        const pinnedProducts = allProducts.filter(p => tpl.pinned_product_ids?.includes(p.id))

                        return (
                            <div
                                key={tpl.id}
                                className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-800 transition flex flex-col justify-between space-y-3"
                            >
                                <div className="space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                                                <Briefcase className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-stone-900 dark:text-white line-clamp-1">
                                                    {tpl.name}
                                                </h3>
                                                {tpl.notes ? (
                                                    <p className="text-[11px] text-stone-500 line-clamp-1">
                                                        {tpl.notes}
                                                    </p>
                                                ) : (
                                                    <p className="text-[11px] text-stone-400 italic">
                                                        Chưa có ghi chú
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Danh sách sản phẩm ghim sẵn */}
                                    <div className="pt-2 border-t border-stone-100 dark:border-zinc-800 text-[11px]">
                                        <div className="flex items-center justify-between text-stone-500 mb-1.5">
                                            <span className="flex items-center gap-1 font-semibold text-[10px] uppercase text-stone-400">
                                                <Pin className="w-3 h-3 text-indigo-500" /> Sản phẩm ghim sẵn:
                                            </span>
                                            <span className="font-bold text-indigo-600 dark:text-indigo-400 text-[10px]">
                                                {pinnedCount} SP
                                            </span>
                                        </div>

                                        {pinnedCount === 0 ? (
                                            <p className="text-stone-400 text-[10px] italic">
                                                Chưa gán sản phẩm (sẽ mở bàn trống để tự ghim)
                                            </p>
                                        ) : (
                                            <div className="flex flex-wrap gap-1">
                                                {pinnedProducts.slice(0, 3).map(p => (
                                                    <span
                                                        key={p.id}
                                                        className="text-[10px] px-2 py-0.5 rounded-md bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-stone-300 font-medium truncate max-w-[150px]"
                                                        title={p.name}
                                                    >
                                                        {p.name}
                                                    </span>
                                                ))}
                                                {pinnedCount > 3 && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold">
                                                        +{pinnedCount - 3} nữa
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Nút thao tác dưới chân thẻ */}
                                <div className="pt-3 border-t border-stone-100 dark:border-zinc-800 flex items-center justify-between gap-1.5">
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => handleOpenEdit(tpl)}
                                            className="h-7 px-2.5 rounded-lg text-[11px] font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center gap-1"
                                            title="Chỉnh sửa mẫu"
                                        >
                                            <Pencil className="w-3 h-3" /> Sửa
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDuplicate(tpl)}
                                            className="h-7 px-2.5 rounded-lg text-[11px] font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center gap-1"
                                            title="Nhân bản mẫu này"
                                        >
                                            <Copy className="w-3 h-3" /> Bản sao
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(tpl.id, tpl.name)}
                                            className="h-7 w-7 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center"
                                            title="Xóa mẫu này"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>

                                    <Link
                                        href={`/so-lieu?applyTemplate=${encodeURIComponent(tpl.id)}`}
                                        className="h-7 px-2.5 rounded-lg text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center gap-1"
                                        title="Bắt đầu công việc với mẫu này ngay tại Bàn Số Liệu"
                                    >
                                        <span>Dùng mẫu</span> →
                                    </Link>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* MODAL THÊM / SỬA CÔNG VIỆC MẪU */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border-t sm:border border-stone-200 dark:border-zinc-800 max-h-[92vh] flex flex-col animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
                        {/* Mobile handle */}
                        <div className="w-12 h-1.5 bg-stone-300 dark:bg-zinc-700 rounded-full mx-auto mb-3 sm:hidden shrink-0" />

                        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-zinc-800 mb-4 shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 rounded-xl">
                                    <Briefcase className="w-4 h-4" />
                                </div>
                                <h3 className="font-bold text-base text-stone-900 dark:text-white">
                                    {editingTemplate ? 'Chỉnh Sửa Công Việc Mẫu' : 'Thêm Mới Công Việc Mẫu'}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 pr-0.5 space-y-4">
                            {/* Tên mẫu */}
                            <div>
                                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                                    Tên công việc mẫu <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    autoFocus
                                    value={modalName}
                                    onChange={e => setModalName(e.target.value)}
                                    placeholder="Ví dụ: Đóng gói sầu riêng xuất khẩu, Sơ chế mít..."
                                    className="w-full text-xs font-semibold p-2.5 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-stone-900 dark:text-white"
                                />
                            </div>

                            {/* Ghi chú mặc định */}
                            <div>
                                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                                    Ghi chú mặc định (tùy chọn):
                                </label>
                                <textarea
                                    value={modalNotes}
                                    onChange={e => setModalNotes(e.target.value)}
                                    placeholder="Ghi chú về tổ làm việc, vị trí xưởng, ca trực..."
                                    rows={2}
                                    className="w-full text-xs p-2.5 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-stone-900 dark:text-white"
                                />
                            </div>

                            {/* Chọn sản phẩm ghim sẵn */}
                            <div className="pt-2 border-t border-stone-100 dark:border-zinc-800">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                                        <Pin className="w-3.5 h-3.5 text-indigo-500" />
                                        <span>Sản phẩm ghim sẵn khi mở ca:</span>
                                    </label>
                                    <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                                        Đã chọn {modalPinnedIds.length} SP
                                    </span>
                                </div>
                                <p className="text-[11px] text-stone-400 mb-2">
                                    Khi nhân viên bấm chọn mẫu này, hệ thống sẽ tự động ghim sẵn các sản phẩm này lên bàn nhập số liệu.
                                </p>

                                {/* Ô tìm kiếm sản phẩm */}
                                <div className="relative mb-2">
                                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        value={productSearch}
                                        onChange={e => setProductSearch(e.target.value)}
                                        placeholder="Tìm sản phẩm theo tên để gán..."
                                        className="w-full text-xs pl-8 pr-2.5 py-1.5 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>

                                {/* Danh sách sản phẩm để chọn */}
                                <div className="max-h-48 overflow-y-auto border border-stone-200 dark:border-zinc-800 rounded-xl divide-y divide-stone-100 dark:divide-zinc-800 text-xs">
                                    {loadingProducts ? (
                                        <div className="p-3 text-center text-stone-400">Đang tải sản phẩm...</div>
                                    ) : modalFilteredProducts.length === 0 ? (
                                        <div className="p-3 text-center text-stone-400">Không tìm thấy sản phẩm phù hợp</div>
                                    ) : (
                                        modalFilteredProducts.map(prod => {
                                            const isSelected = modalPinnedIds.includes(prod.id)
                                            return (
                                                <button
                                                    key={prod.id}
                                                    type="button"
                                                    onClick={() => toggleModalProduct(prod.id)}
                                                    className={`w-full p-2 text-left flex items-center justify-between hover:bg-stone-50 dark:hover:bg-zinc-800/60 transition ${
                                                        isSelected ? 'bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold' : 'text-stone-700 dark:text-stone-300'
                                                    }`}
                                                >
                                                    <div className="min-w-0 pr-2">
                                                        <div className="truncate">{prod.name}</div>
                                                        <div className="text-[10px] text-stone-400">
                                                            {prod.sku ? `SKU: ${prod.sku} • ` : ''}ĐVT: {prod.unit || 'Kg'}
                                                        </div>
                                                    </div>
                                                    <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${
                                                        isSelected
                                                            ? 'bg-indigo-600 border-indigo-600 text-white'
                                                            : 'border-stone-300 dark:border-zinc-600 text-transparent'
                                                    }`}>
                                                        <Check className="w-3.5 h-3.5" />
                                                    </div>
                                                </button>
                                            )
                                        })
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* NÚT THAO TÁC MODAL */}
                        <div className="grid grid-cols-2 gap-2 pt-4 mt-3 border-t border-stone-100 dark:border-zinc-800 shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="h-10 sm:h-9 px-4 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-xl flex items-center justify-center transition"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveModal}
                                disabled={saving || !modalName.trim()}
                                className="h-10 sm:h-9 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                            >
                                <Check className="w-4 h-4" />
                                <span>{saving ? 'Đang lưu...' : 'Lưu công việc mẫu'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

