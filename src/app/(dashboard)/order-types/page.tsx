'use client'

import { useState, useEffect } from 'react'
import { FileText, Plus, Search, Edit, Trash2, X, Filter } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'

type OrderType = {
    id: string
    name: string
    code: string
    scope: 'inbound' | 'outbound' | 'both'
    description: string
    system_code?: string
    company_id?: string
    is_active: boolean
    created_at: string
}

export default function OrderTypesPage() {
    const { showToast, showConfirm } = useToast()
    const { currentSystem } = useSystem()
    const { profile } = useUser()
    const [types, setTypes] = useState<OrderType[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterScope, setFilterScope] = useState<string>('all')

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingType, setEditingType] = useState<OrderType | null>(null)
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        scope: 'inbound',
        description: ''
    })

    useEffect(() => {
        if (currentSystem) {
            fetchTypes()
        }
    }, [currentSystem])

    async function fetchTypes() {
        try {
            setLoading(true)

            // Fetch types for current system OR global types (system_code is null)
            // Also filter by company if possible, though RLS should handle it
            const { data, error } = await (supabase
                .from('order_types') as any)
                .select('*')
                .or(`system_code.eq.${currentSystem?.code},system_code.is.null`)
                .order('created_at', { ascending: false })

            if (error) throw error
            setTypes(data || [])
        } catch (error: any) {
            console.error('Error fetching types:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredTypes = types.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.code.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesScope = filterScope === 'all' || t.scope === filterScope
        return matchesSearch && matchesScope
    })

    function getInitials(name: string) {
        const cleanName = name.replace(/kho/gi, '').trim()
        return cleanName
            .split(' ')
            .filter(Boolean)
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    }

    function generateAutoCode() {
        if (!currentSystem) return ''

        // 1. Get Initials
        const initials = getInitials(currentSystem.name)

        // 2. Count existing types for this system
        const systemTypesCount = types.filter(t => t.system_code === currentSystem.code).length
        const nextIndex = systemTypesCount + 1

        // 3. Format: KH-ML01 (Example)
        return `${initials}-ML${nextIndex.toString().padStart(2, '0')}`
    }

    function handleOpenModal(type?: OrderType) {
        if (type) {
            setEditingType(type)
            setFormData({
                name: type.name,
                code: type.code,
                scope: type.scope,
                description: type.description || ''
            })
        } else {
            setEditingType(null)
            const autoCode = generateAutoCode()
            setFormData({
                name: '',
                code: autoCode,
                scope: 'inbound',
                description: ''
            })
        }
        setIsModalOpen(true)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        try {
            if (!formData.name || !formData.code) {
                showToast('Vui lòng điền đủ thông tin', 'error')
                return
            }

            const payload: any = {
                name: formData.name,
                code: formData.code,
                scope: formData.scope,
                description: formData.description,
                company_id: profile?.company_id || null
            }

            if (editingType) {
                const { error } = await (supabase
                    .from('order_types') as any)
                    .update(payload)
                    .eq('id', editingType.id)
                if (error) throw error
                showToast('Cập nhật thành công', 'success')
            } else {
                // Attach current system code for new types
                payload.system_code = currentSystem?.code

                const { error } = await (supabase
                    .from('order_types') as any)
                    .insert([payload])
                if (error) throw error
                showToast('Tạo mới thành công', 'success')
            }

            setIsModalOpen(false)
            fetchTypes()
        } catch (error: any) {
            showToast(error.message, 'error')
        }
    }

    async function handleDelete(id: string) {
        if (!await showConfirm('Bạn có chắc muốn xóa loại phiếu này?')) return

        try {
            const { error } = await (supabase
                .from('order_types') as any)
                .delete()
                .eq('id', id)

            if (error) throw error
            showToast('Xóa thành công', 'success')
            fetchTypes()
        } catch (error: any) {
            showToast(error.message, 'error')
        }
    }

    return (
        <div className="h-screen flex flex-col bg-stone-50 dark:bg-zinc-900">
            {/* Header */}
            <div className="h-14 border-b border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between px-6">
                <div className="flex items-center gap-2">
                    <FileText className="text-orange-600" size={20} />
                    <div>
                        <h1 className="font-bold text-stone-800 dark:text-gray-100">Quản lý Loại phiếu</h1>
                        <p className="text-xs text-stone-500">Phân hệ: {currentSystem?.name}</p>
                    </div>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                    <Plus size={16} />
                    <span>Thêm mới</span>
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-hidden flex flex-col gap-4">
                {/* Information Note */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 shadow-sm shadow-amber-100">
                    <div className="p-2 bg-amber-500 text-white rounded-lg">
                        <Filter size={18} />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-amber-900">Tính năng Bẻ gói Kế toán (PNK/PXK)</h4>
                        <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                            Để tính năng tự động bẻ đơn vị (ví dụ: bẻ Bao thành Gói) hoạt động, bạn cần duy trì ít nhất một loại phiếu có tên gọi chứa cụm từ <span className="font-black underline italic">"Chuyển đổi"</span> hoặc có mã là <span className="font-black underline">"CONV"</span>.
                        </p>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                        <input
                            type="text"
                            placeholder="Tìm kiếm theo tên hoặc mã..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                        />
                    </div>
                    <select
                        value={filterScope}
                        onChange={e => setFilterScope(e.target.value)}
                        className="px-4 py-2 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                    >
                        <option value="all">Tất cả loại</option>
                        <option value="inbound">Phiếu Nhập</option>
                        <option value="outbound">Phiếu Xuất</option>
                        <option value="both">Cả hai</option>
                    </select>
                </div>

                {/* Table */}
                <div className="flex-1 bg-white dark:bg-zinc-800 rounded-xl border border-stone-200 dark:border-zinc-700 overflow-hidden flex flex-col">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-stone-50 dark:bg-zinc-900/50 border-b border-stone-200 dark:border-zinc-700">
                                <tr>
                                    <th className="px-6 py-3 font-medium text-stone-500">Mã</th>
                                    <th className="px-6 py-3 font-medium text-stone-500">Tên loại phiếu</th>
                                    <th className="px-6 py-3 font-medium text-stone-500">Phạm vi</th>
                                    <th className="px-6 py-3 font-medium text-stone-500">Mô tả</th>
                                    <th className="px-6 py-3 font-medium text-stone-500 w-24"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 dark:divide-zinc-700">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-stone-500">Đang tải...</td>
                                    </tr>
                                ) : filteredTypes.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-stone-500">Chưa có dữ liệu cho {currentSystem?.name}</td>
                                    </tr>
                                ) : (
                                    filteredTypes.map(type => (
                                        <tr key={type.id} className="group hover:bg-stone-50 dark:hover:bg-zinc-800/50">
                                            <td className="px-6 py-3 font-mono text-xs font-semibold text-stone-600 dark:text-stone-400">
                                                {type.code}
                                            </td>
                                            <td className="px-6 py-3 font-medium text-stone-900 dark:text-white">
                                                {type.name}
                                                {!type.system_code && (
                                                    <span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded border border-gray-200">Global</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-3">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${type.scope === 'inbound'
                                                    ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900'
                                                    : type.scope === 'outbound'
                                                        ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-900'
                                                        : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-900'
                                                    }`}>
                                                    {type.scope === 'inbound' ? 'Nhập kho' : type.scope === 'outbound' ? 'Xuất kho' : 'Dùng chung'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-stone-500 truncate max-w-xs" title={type.description}>
                                                {type.description}
                                            </td>
                                            <td className="px-6 py-3">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleOpenModal(type)}
                                                        className="p-1.5 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(type.id)}
                                                        className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-4 border-b border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900/50">
                            <h3 className="font-bold text-stone-800 dark:text-white">
                                {editingType ? 'Cập nhật loại phiếu' : 'Thêm loại phiếu mới'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-stone-200 dark:hover:bg-zinc-800 rounded">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-stone-600 dark:text-stone-300">Tên loại phiếu <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                    placeholder="VD: Nhập từ sản xuất"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-stone-600 dark:text-stone-300">Mã loại (Code) <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.code}
                                        onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                        className="w-full px-3 py-2 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg font-mono focus:ring-2 focus:ring-orange-500 outline-none"
                                        placeholder="VD: INCOME_PROD"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-stone-600 dark:text-stone-300">Phạm vi áp dụng</label>
                                    <select
                                        value={formData.scope}
                                        onChange={e => setFormData({ ...formData, scope: e.target.value })}
                                        className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                    >
                                        <option value="inbound">Phiếu Nhập</option>
                                        <option value="outbound">Phiếu Xuất</option>
                                        <option value="both">Cả hai</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-stone-600 dark:text-stone-300">Mô tả</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg h-20 resize-none focus:ring-2 focus:ring-orange-500 outline-none"
                                    placeholder="Mô tả chi tiết về loại phiếu này"
                                />
                            </div>

                            <div className="pt-2 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-zinc-800 rounded-lg"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium"
                                >
                                    {editingType ? 'Lưu thay đổi' : 'Tạo mới'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
