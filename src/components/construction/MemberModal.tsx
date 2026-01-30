'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useUser } from '@/contexts/UserContext'
import { useSystem } from '@/contexts/SystemContext'
import { X, Save } from 'lucide-react'
import { ConstructionMember, ConstructionTeam } from '@/app/(dashboard)/construction/members/page'

interface Props {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    initialData: ConstructionMember | null
}

export default function MemberModal({ isOpen, onClose, onSuccess, initialData }: Props) {
    const { profile } = useUser()
    const { currentSystem } = useSystem()
    const { showToast } = useToast()
    const [loading, setLoading] = useState(false)
    const [teams, setTeams] = useState<ConstructionTeam[]>([])

    const [formData, setFormData] = useState({
        full_name: initialData?.full_name || '',
        phone: initialData?.phone || '',
        role: initialData?.role || '',
        team_id: initialData?.team_id || '',
        is_active: initialData?.is_active ?? true
    })

    useEffect(() => {
        if (isOpen && currentSystem?.code) {
            fetchTeams()
        }
    }, [isOpen, currentSystem?.code])

    async function fetchTeams() {
        if (!currentSystem?.code) return
        const { data } = await (supabase.from('construction_teams') as any)
            .select('id, name')
            .eq('system_code', currentSystem.code)
            .order('name')
        if (data) setTeams(data)
    }

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            let companyId = profile?.company_id

            if (!companyId) {
                const { data: userData } = await supabase
                    .from('user_profiles')
                    .select('company_id')
                    .single()
                if (userData) companyId = userData.company_id
            }

            const payload = {
                full_name: formData.full_name,
                phone: formData.phone || null,
                role: formData.role || null,
                team_id: formData.team_id || null,
                is_active: formData.is_active,
                updated_at: new Date().toISOString()
            }

            if (initialData) {
                // Update
                const { error } = await (supabase.from('construction_members') as any)
                    .update(payload)
                    .eq('id', initialData.id)

                if (error) throw error
                showToast('Cập nhật thành viên thành công', 'success')
            } else {
                // Create
                const { error } = await (supabase.from('construction_members') as any)
                    .insert({
                        ...payload,
                        company_id: companyId,
                        system_code: currentSystem?.code,
                        created_by: profile?.id
                    })

                if (error) throw error
                showToast('Thêm thành viên mới thành công', 'success')
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
                    <h3 className="font-bold text-lg">{initialData ? 'Cập nhật Thành viên' : 'Thêm Thành viên Mới'}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên <span className="text-red-500">*</span></label>
                        <input
                            required
                            value={formData.full_name}
                            onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="VD: Nguyễn Văn A"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                            <input
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="09xxxxxxx"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Chức vụ / Vai trò</label>
                            <input
                                value={formData.role}
                                onChange={e => setFormData({ ...formData, role: e.target.value })}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="VD: Thợ hồ, Giám sát"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Thuộc Đội</label>
                        <select
                            value={formData.team_id}
                            onChange={e => setFormData({ ...formData, team_id: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        >
                            <option value="">-- Chọn đội --</option>
                            {teams.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Gán thành viên vào đội để quản lý nhóm dễ dàng hơn.</p>
                    </div>

                    {initialData && (
                        <div className="flex items-center gap-2 pt-2">
                            <input
                                type="checkbox"
                                id="is_active"
                                checked={formData.is_active}
                                onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                className="w-4 h-4 text-blue-600 rounded"
                            />
                            <label htmlFor="is_active" className="text-sm text-gray-700">Đang hoạt động</label>
                        </div>
                    )}

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
