'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useUser } from '@/contexts/UserContext'
import { X, Save } from 'lucide-react'
import { ConstructionTeam } from '@/app/(dashboard)/construction/members/page'

interface Props {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    initialData: ConstructionTeam | null
}

export default function TeamModal({ isOpen, onClose, onSuccess, initialData }: Props) {
    const { profile } = useUser()
    const { showToast } = useToast()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        code: initialData?.code || '',
        description: initialData?.description || ''
    })

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            // Determine company_id: Use profile if available, otherwise try to fetch it or rely on RLS default
            // Note: RLS 'INSERT' usually requires the column to be present if it's NOT NULL.
            // Our migration says: company_id uuid REFERENCES ...
            // If we don't send it, and default is not set, it might fail.
            // However, the policies use `WITH CHECK (company_id = ...)` which implies we MUST send the correct ID.

            let companyId = profile?.company_id

            // Fallback: If profile context is missing but user is authenticated,
            // try to get company_id from user_profiles directly
            if (!companyId) {
                const { data: userData } = await supabase
                    .from('user_profiles')
                    .select('company_id')
                    .single()
                if (userData) {
                    companyId = userData.company_id
                }
            }

            if (!companyId && !initialData) {
               // Only strictly required for CREATE. For UPDATE, we might not touch it.
               // But RLS often checks existing row.
               // If we still don't have it, we might be in trouble, but let's try proceeding.
               // Worst case: RLS policy violation.
            }

            if (initialData) {
                // Update
                const { error } = await (supabase.from('construction_teams') as any)
                    .update({
                        name: formData.name,
                        code: formData.code,
                        description: formData.description,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', initialData.id)

                if (error) throw error
                showToast('Cập nhật đội thành công', 'success')
            } else {
                // Create
                const { error } = await (supabase.from('construction_teams') as any)
                    .insert({
                        company_id: companyId,
                        name: formData.name,
                        code: formData.code,
                        description: formData.description,
                        created_by: profile?.id // Optional FK
                    })

                if (error) throw error
                showToast('Tạo đội mới thành công', 'success')
            }
            onSuccess()
        } catch (error: any) {
            showToast('Lỗi: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="font-bold text-lg">{initialData ? 'Cập nhật Đội thi công' : 'Thêm Đội mới'}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tên đội <span className="text-red-500">*</span></label>
                        <input
                            required
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="VD: Đội Xây Dựng 1"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mã đội (Tùy chọn)</label>
                        <input
                            value={formData.code}
                            onChange={e => setFormData({ ...formData, code: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="VD: TEAM01"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                        <textarea
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            rows={3}
                            placeholder="Ghi chú về đội này..."
                        />
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                        >
                            <Save size={16} />
                            {loading ? 'Đang lưu...' : 'Lưu lại'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
