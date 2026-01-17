'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { Loader2, Plus, Edit, Trash2, MapPin, Phone, Building, MoreHorizontal, CheckCircle, XCircle, Star } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'

type Branch = Database['public']['Tables']['branches']['Row']

export default function BranchManagerSection() {
    const { showToast } = useToast()
    const [branches, setBranches] = useState<Branch[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        fetchBranches()
    }, [])

    async function fetchBranches() {
        setLoading(true)
        const { data, error } = await supabase
            .from('branches')
            .select('*')
            .order('is_default', { ascending: false }) // Default first
            .order('created_at', { ascending: true })

        if (error) {
            showToast('Lỗi tải danh sách chi nhánh', 'error')
        } else {
            setBranches(data || [])
        }
        setLoading(false)
    }

    async function handleDelete(id: string) {
        if (!confirm('Bạn có chắc chắn muốn xóa chi nhánh này?')) return

        const { error } = await supabase
            .from('branches')
            .delete()
            .eq('id', id)

        if (error) {
            showToast('Không thể xóa: ' + error.message, 'error')
        } else {
            showToast('Đã xóa chi nhánh', 'success')
            fetchBranches()
        }
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        const form = e.target as HTMLFormElement
        const formData = new FormData(form)

        const isDefault = formData.get('is_default') === 'on'

        const payload = {
            code: formData.get('code') as string,
            name: formData.get('name') as string,
            address: formData.get('address') as string,
            phone: formData.get('phone') as string,
            is_active: formData.get('is_active') === 'on',
            is_default: isDefault
        }

        try {
            // If setting as default, we might need to handle it in UI/Client side if trigger isn't ready,
            // but we rely on the trigger on DB side ideally. 
            // However, for immediate UI feedback, let's assume the DB trigger handles standardizing 'is_default'.

            if (editingBranch) {
                const { error } = await (supabase
                    .from('branches') as any)
                    .update(payload)
                    .eq('id', editingBranch.id)
                if (error) throw error
            } else {
                const { error } = await (supabase
                    .from('branches') as any)
                    .insert(payload)
                if (error) throw error
            }

            showToast('Đã lưu chi nhánh', 'success')
            setIsModalOpen(false)
            fetchBranches()
        } catch (err: any) {
            showToast('Lỗi: ' + err.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    const openModal = (branch: Branch | null = null) => {
        setEditingBranch(branch)
        setIsModalOpen(true)
    }

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-orange-500" /></div>

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="font-bold text-lg text-stone-800 flex items-center gap-2">
                    <Building className="text-orange-500" size={20} />
                    Danh sách Chi nhánh
                </h2>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-lg text-sm font-medium transition-colors"
                >
                    <Plus size={16} /> Thêm chi nhánh
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {branches.map(branch => (
                    <div key={branch.id} className={`bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition-shadow relative group ${branch.is_default ? 'border-orange-200 ring-1 ring-orange-100' : 'border-stone-200'}`}>
                        {branch.is_default && (
                            <div className="absolute top-2 right-2">
                                <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-600 text-[10px] font-bold uppercase rounded-full">
                                    <Star size={10} className="fill-orange-600" /> Mặc định
                                </span>
                            </div>
                        )}

                        <div className="flex justify-between items-start mb-2 pr-8">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-stone-800">{branch.name}</h3>
                                    <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded-full ${branch.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {branch.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <span className="text-xs font-mono text-stone-400 bg-stone-50 px-1.5 rounded">{branch.code}</span>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openModal(branch)} className="p-1.5 text-stone-500 hover:bg-orange-50 hover:text-orange-600 rounded">
                                    <Edit size={16} />
                                </button>
                                <button onClick={() => handleDelete(branch.id)} className="p-1.5 text-stone-500 hover:bg-red-50 hover:text-red-600 rounded">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1 text-sm text-stone-600 mt-3">
                            {branch.address && (
                                <div className="flex items-start gap-2">
                                    <MapPin size={14} className="mt-0.5 text-stone-400 shrink-0" />
                                    <span className="line-clamp-2">{branch.address}</span>
                                </div>
                            )}
                            {branch.phone && (
                                <div className="flex items-center gap-2">
                                    <Phone size={14} className="text-stone-400 shrink-0" />
                                    <span>{branch.phone}</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {branches.length === 0 && (
                <div className="text-center py-12 bg-stone-50 rounded-xl border border-dashed border-stone-300">
                    <Building className="mx-auto text-stone-300 mb-2" size={40} />
                    <p className="text-stone-500 text-sm">Chưa có chi nhánh nào được tạo</p>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-stone-800">
                                {editingBranch ? 'Cập nhật chi nhánh' : 'Thêm chi nhánh mới'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-stone-600">
                                <XCircle size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-1">Mã chi nhánh <span className="text-red-500">*</span></label>
                                <input
                                    name="code"
                                    defaultValue={editingBranch?.code}
                                    required
                                    placeholder="TD01"
                                    className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-1">Tên chi nhánh <span className="text-red-500">*</span></label>
                                <input
                                    name="name"
                                    defaultValue={editingBranch?.name}
                                    required
                                    placeholder="Chi nhánh Hà Nội"
                                    className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-1">Địa chỉ</label>
                                <input
                                    name="address"
                                    defaultValue={editingBranch?.address || ''}
                                    className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-1">Điện thoại</label>
                                <input
                                    name="phone"
                                    defaultValue={editingBranch?.phone || ''}
                                    className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
                                />
                            </div>
                            <div className="flex items-center gap-4 mt-4">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        name="is_active"
                                        id="is_active"
                                        defaultChecked={editingBranch ? editingBranch.is_active : true}
                                        className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500"
                                    />
                                    <label htmlFor="is_active" className="text-sm font-medium text-stone-700 select-none">Đang hoạt động</label>
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        name="is_default"
                                        id="is_default"
                                        defaultChecked={editingBranch ? editingBranch.is_default : false}
                                        className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500"
                                    />
                                    <label htmlFor="is_default" className="text-sm font-medium text-stone-700 select-none flex items-center gap-1">
                                        <Star size={14} className="text-orange-500" /> Đặt làm mặc định
                                    </label>
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg text-sm font-medium"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium shadow-md shadow-orange-200 transition-all disabled:opacity-70"
                                >
                                    {saving ? 'Lưu...' : 'Lưu thông tin'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
