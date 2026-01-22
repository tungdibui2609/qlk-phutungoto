'use client'

import { useState, useEffect } from 'react'
import { ShieldCheck, Plus, Search, Edit, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'

type QCInfo = {
    id: string
    name: string
    code: string
    description: string
    system_code?: string
    is_active: boolean
    created_at: string
}

export default function QCPage() {
    const { showToast } = useToast()
    const { currentSystem } = useSystem()
    const [qcList, setQCList] = useState<QCInfo[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingQC, setEditingQC] = useState<QCInfo | null>(null)
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        description: ''
    })

    useEffect(() => {
        if (currentSystem) {
            fetchQCList()
        }
    }, [currentSystem])

    async function fetchQCList() {
        try {
            setLoading(true)

            // Fetch QC info for current system OR global (system_code is null)
            const { data, error } = await (supabase as any)
                .from('qc_info')
                .select('*')
                .or(`system_code.eq.${currentSystem?.code},system_code.is.null`)
                .order('created_at', { ascending: false })

            if (error) throw error
            setQCList(data || [])
        } catch (error: any) {
            console.error('Error fetching QC list:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredQCList = qcList.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.code.toLowerCase().includes(searchTerm.toLowerCase())
        return matchesSearch
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

        // 2. Count existing items for this system
        const systemCount = qcList.filter(t => t.system_code === currentSystem.code).length
        const nextIndex = systemCount + 1

        // 3. Format: KH-QC01 (Example)
        return `${initials}-QC${nextIndex.toString().padStart(2, '0')}`
    }

    function handleOpenModal(qc?: QCInfo) {
        if (qc) {
            setEditingQC(qc)
            setFormData({
                name: qc.name,
                code: qc.code,
                description: qc.description || ''
            })
        } else {
            setEditingQC(null)
            const autoCode = generateAutoCode()
            setFormData({
                name: '',
                code: autoCode,
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
                description: formData.description
            }

            if (editingQC) {
                const { error } = await (supabase as any)
                    .from('qc_info')
                    .update(payload)
                    .eq('id', editingQC.id)
                if (error) throw error
                showToast('Cập nhật thành công', 'success')
            } else {
                // Attach current system code for new items
                payload.system_code = currentSystem?.code

                const { error } = await (supabase as any)
                    .from('qc_info')
                    .insert([payload])
                if (error) throw error
                showToast('Tạo mới thành công', 'success')
            }

            setIsModalOpen(false)
            fetchQCList()
        } catch (error: any) {
            showToast(error.message, 'error')
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Bạn có chắc muốn xóa nhân viên QC này?')) return

        try {
            const { error } = await (supabase as any)
                .from('qc_info')
                .delete()
                .eq('id', id)

            if (error) throw error
            showToast('Xóa thành công', 'success')
            fetchQCList()
        } catch (error: any) {
            showToast(error.message, 'error')
        }
    }

    return (
        <div className="h-screen flex flex-col bg-stone-50 dark:bg-zinc-900">
            {/* Header */}
            <div className="h-14 border-b border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between px-6">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="text-orange-600" size={20} />
                    <div>
                        <h1 className="font-bold text-stone-800 dark:text-gray-100">Quản lý nhân viên QC</h1>
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
                </div>

                {/* Table */}
                <div className="flex-1 bg-white dark:bg-zinc-800 rounded-xl border border-stone-200 dark:border-zinc-700 overflow-hidden flex flex-col">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-stone-50 dark:bg-zinc-900/50 border-b border-stone-200 dark:border-zinc-700">
                                <tr>
                                    <th className="px-6 py-3 font-medium text-stone-500">Mã QC</th>
                                    <th className="px-6 py-3 font-medium text-stone-500">Tên nhân viên</th>
                                    <th className="px-6 py-3 font-medium text-stone-500">Mô tả</th>
                                    <th className="px-6 py-3 font-medium text-stone-500 w-24"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 dark:divide-zinc-700">
                                {loading ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-stone-500">Đang tải...</td>
                                    </tr>
                                ) : filteredQCList.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-stone-500">Chưa có dữ liệu cho {currentSystem?.name}</td>
                                    </tr>
                                ) : (
                                    filteredQCList.map(item => (
                                        <tr key={item.id} className="group hover:bg-stone-50 dark:hover:bg-zinc-800/50">
                                            <td className="px-6 py-3 font-mono text-xs font-semibold text-stone-600 dark:text-stone-400">
                                                {item.code}
                                            </td>
                                            <td className="px-6 py-3 font-medium text-stone-900 dark:text-white">
                                                {item.name}
                                                {!item.system_code && (
                                                    <span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded border border-gray-200">Global</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-3 text-stone-500 truncate max-w-xs" title={item.description}>
                                                {item.description}
                                            </td>
                                            <td className="px-6 py-3">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleOpenModal(item)}
                                                        className="p-1.5 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(item.id)}
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
                                {editingQC ? 'Cập nhật thông tin QC' : 'Thêm nhân viên QC mới'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-stone-200 dark:hover:bg-zinc-800 rounded">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-stone-600 dark:text-stone-300">Tên nhân viên QC <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                    placeholder="VD: Nguyễn Văn A"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-stone-600 dark:text-stone-300">Mã QC (Code) <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={formData.code}
                                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    className="w-full px-3 py-2 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg font-mono focus:ring-2 focus:ring-orange-500 outline-none"
                                    placeholder="VD: KH-QC01"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-stone-600 dark:text-stone-300">Mô tả</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg h-20 resize-none focus:ring-2 focus:ring-orange-500 outline-none"
                                    placeholder="Ghi chú thêm..."
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
                                    {editingQC ? 'Lưu thay đổi' : 'Tạo mới'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
