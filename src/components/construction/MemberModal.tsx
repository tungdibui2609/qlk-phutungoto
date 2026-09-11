'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useUser } from '@/contexts/UserContext'
import { useSystem } from '@/contexts/SystemContext'
import { X, Save, UserCheck, Shield, Sparkles } from 'lucide-react'
import { ConstructionMember, ConstructionTeam } from '@/app/(dashboard)/members-teams/types'

interface Props {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    initialData: ConstructionMember | null
}

interface SystemUserOption {
    id: string
    full_name: string
    username: string | null
    email: string | null
    phone: string | null
    employee_code: string | null
}

export default function MemberModal({ isOpen, onClose, onSuccess, initialData }: Props) {
    const { profile } = useUser()
    const { currentSystem } = useSystem()
    const { showToast } = useToast()
    const [loading, setLoading] = useState(false)
    const [teams, setTeams] = useState<ConstructionTeam[]>([])
    const [systemUsers, setSystemUsers] = useState<SystemUserOption[]>([])

    const [formData, setFormData] = useState({
        full_name: initialData?.full_name || '',
        phone: initialData?.phone || '',
        role: initialData?.role || '',
        team_id: initialData?.team_id || '',
        user_id: initialData?.user_id || '',
        is_active: initialData?.is_active ?? true
    })

    useEffect(() => {
        if (isOpen) {
            setFormData({
                full_name: initialData?.full_name || '',
                phone: initialData?.phone || '',
                role: initialData?.role || '',
                team_id: initialData?.team_id || '',
                user_id: initialData?.user_id || '',
                is_active: initialData?.is_active ?? true
            })

            if (currentSystem?.code) {
                fetchTeams()
                fetchSystemUsers()
            }
        }
    }, [isOpen, initialData, currentSystem?.code])

    async function fetchTeams() {
        if (!currentSystem?.code) return
        try {
            const { data } = await (supabase.from('construction_teams') as any)
                .select('id, name')
                .eq('system_code', currentSystem.code)
                .order('name')
            if (data) setTeams(data)
        } catch (err) {
            console.error('Error fetching teams:', err)
        }
    }

    async function fetchSystemUsers() {
        try {
            const companyId = currentSystem?.company_id || profile?.company_id
            let query = supabase
                .from('user_profiles')
                .select('id, full_name, username, email, phone, employee_code')
                .eq('is_active', true)

            if (companyId) {
                query = query.eq('company_id', companyId)
            }

            const { data } = await query.order('full_name')
            if (data) setSystemUsers(data as any)
        } catch (err) {
            console.error('Error fetching system users for member link:', err)
        }
    }

    const handleUserSelect = (selectedUserId: string) => {
        const u = systemUsers.find(user => user.id === selectedUserId)
        setFormData(prev => ({
            ...prev,
            user_id: selectedUserId,
            // Auto fill full_name if currently empty
            full_name: (!prev.full_name || prev.full_name.trim() === '') && u ? u.full_name : prev.full_name,
            // Auto fill phone if currently empty
            phone: (!prev.phone || prev.phone.trim() === '') && u?.phone ? u.phone : prev.phone
        }))
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
                full_name: formData.full_name.trim(),
                phone: formData.phone?.trim() || null,
                role: formData.role?.trim() || null,
                team_id: formData.team_id || null,
                user_id: formData.user_id || null,
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
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-stone-200">
                <div className="flex justify-between items-center p-4 border-b border-stone-100 bg-stone-50">
                    <div>
                        <h3 className="font-extrabold text-stone-900 text-base">
                            {initialData ? 'Cập nhật Thành viên' : 'Thêm Thành viên Mới'}
                        </h3>
                        <p className="text-xs text-stone-500 mt-0.5">
                            Quản lý nhân sự đội và liên kết tài khoản hệ thống
                        </p>
                    </div>
                    <button onClick={onClose} className="text-stone-400 hover:text-stone-600 p-1 rounded-lg hover:bg-stone-200/60 transition">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                    {/* 1. LIÊN KẾT TÀI KHOẢN ĐĂNG NHẬP */}
                    <div className="p-3.5 bg-gradient-to-br from-blue-50/70 to-indigo-50/50 border border-blue-200 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-extrabold text-blue-900 flex items-center gap-1.5">
                                <UserCheck className="w-4 h-4 text-blue-600" />
                                <span>Liên kết tài khoản đăng nhập</span>
                            </label>
                            {formData.user_id ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <Shield className="w-3 h-3 text-emerald-600" />
                                    Đã liên kết
                                </span>
                            ) : (
                                <span className="text-[10px] text-stone-400 font-medium italic">
                                    Chưa liên kết
                                </span>
                            )}
                        </div>

                        <select
                            value={formData.user_id}
                            onChange={e => handleUserSelect(e.target.value)}
                            className="w-full p-2.5 border border-blue-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium text-stone-800 shadow-sm"
                        >
                            <option value="">-- Không liên kết (Thành viên thủ công) --</option>
                            {systemUsers.map(u => {
                                const info = [
                                    u.employee_code,
                                    u.username ? `@${u.username}` : null,
                                    u.email
                                ].filter(Boolean).join(' • ')
                                return (
                                    <option key={u.id} value={u.id}>
                                        👤 {u.full_name} {info ? `(${info})` : ''}
                                    </option>
                                )
                            })}
                        </select>

                        <p className="text-[11px] text-blue-700/80 leading-relaxed flex items-start gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                            <span>
                                Khi liên kết, tài khoản này sẽ tự nhận diện đúng Đội phân công khi giao việc,
                                nhận thông báo ca trực và trực tiếp bấm xác nhận tiếp nhận trên hệ thống.
                            </span>
                        </p>
                    </div>

                    {/* 2. HỌ VÀ TÊN */}
                    <div>
                        <label className="block text-xs font-bold text-stone-700 mb-1">
                            Họ và tên thành viên <span className="text-red-500">*</span>
                        </label>
                        <input
                            required
                            value={formData.full_name}
                            onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                            className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="VD: Nguyễn Văn A"
                        />
                    </div>

                    {/* 3. SỐ ĐIỆN THOẠI & VAI TRÒ */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-stone-700 mb-1">Số điện thoại</label>
                            <input
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="09xxxxxxx"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-stone-700 mb-1">Chức vụ / Vai trò</label>
                            <input
                                value={formData.role}
                                onChange={e => setFormData({ ...formData, role: e.target.value })}
                                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="VD: Đội trưởng, Thợ chính..."
                            />
                        </div>
                    </div>

                    {/* 4. THUỘC ĐỘI */}
                    <div>
                        <label className="block text-xs font-bold text-stone-700 mb-1">Thuộc Đội</label>
                        <select
                            value={formData.team_id}
                            onChange={e => setFormData({ ...formData, team_id: e.target.value })}
                            className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium text-stone-700"
                        >
                            <option value="">-- Chưa gán đội --</option>
                            {teams.map(t => (
                                <option key={t.id} value={t.id}>👥 {t.name}</option>
                            ))}
                        </select>
                        <p className="text-[11px] text-stone-500 mt-1">Gán thành viên vào đội để phân nhóm và giao việc theo đội.</p>
                    </div>

                    {/* 5. TRẠNG THÁI HOẠT ĐỘNG */}
                    {initialData && (
                        <div className="flex items-center gap-2 pt-1">
                            <input
                                type="checkbox"
                                id="is_active"
                                checked={formData.is_active}
                                onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                className="w-4 h-4 text-blue-600 rounded border-stone-300 focus:ring-blue-500"
                            />
                            <label htmlFor="is_active" className="text-xs font-semibold text-stone-700 cursor-pointer">
                                Đang hoạt động
                            </label>
                        </div>
                    )}

                    {/* ACTIONS */}
                    <div className="pt-3 border-t border-stone-100 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-stone-200 rounded-xl text-stone-600 text-xs font-semibold hover:bg-stone-50 transition"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-blue-500/25 disabled:opacity-50 transition"
                        >
                            <Save size={14} />
                            <span>{loading ? 'Đang lưu...' : 'Lưu lại'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
