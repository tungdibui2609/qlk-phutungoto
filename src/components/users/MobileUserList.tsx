import Link from 'next/link'
import { Edit, Shield, CheckCircle, XCircle, Mail, Phone, User } from 'lucide-react'
import Protected from '@/components/auth/Protected'

interface Role {
    id: string
    code: string
    name: string
}

interface UserProfile {
    id: string
    employee_code: string | null
    full_name: string
    phone: string | null
    email: string | null
    avatar_url: string | null
    role_id: string | null
    department: string | null
    is_active: boolean | null
    last_login: string | null
    created_at: string | null
    roles?: Role | null
}

interface MobileUserListProps {
    users: UserProfile[]
    onToggleStatus: (id: string, currentStatus: boolean) => void
}

export default function MobileUserList({ users, onToggleStatus }: MobileUserListProps) {
    const getRoleBadgeColor = (code?: string) => {
        switch (code) {
            case 'admin': return 'bg-red-100 text-red-700'
            case 'manager': return 'bg-purple-100 text-purple-700'
            case 'warehouse': return 'bg-blue-100 text-blue-700'
            case 'sales': return 'bg-green-100 text-green-700'
            default: return 'bg-stone-100 text-stone-600'
        }
    }

    if (users.length === 0) {
        return (
            <div className="p-8 text-center text-stone-500 bg-white rounded-2xl border border-stone-200">
                <p>Chưa có người dùng nào</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {users.map((user) => (
                <div key={user.id} className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                                {user.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h3 className="font-bold text-stone-800">{user.full_name}</h3>
                                {user.employee_code && (
                                    <div className="mt-1">
                                        <span className="font-mono text-xs bg-stone-100 px-2 py-0.5 rounded text-stone-600">
                                            {user.employee_code}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        {user.roles ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium shrink-0 ${getRoleBadgeColor(user.roles.code)}`}>
                                <Shield size={10} />
                                {user.roles.name}
                            </span>
                        ) : (
                            <span className="text-stone-400 text-xs shrink-0">Chưa gán</span>
                        )}
                    </div>

                    {/* Details */}
                    <div className="space-y-2 text-sm text-stone-600">
                        {user.email && (
                            <div className="flex items-center gap-2">
                                <Mail size={14} className="text-stone-400" />
                                <span className="truncate">{user.email}</span>
                            </div>
                        )}
                        {user.phone && (
                            <div className="flex items-center gap-2">
                                <Phone size={14} className="text-stone-400" />
                                <span>{user.phone}</span>
                            </div>
                        )}
                        {user.department && (
                            <div className="flex items-center gap-2">
                                <User size={14} className="text-stone-400" />
                                <span>Phòng ban: {user.department}</span>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="pt-3 mt-3 border-t border-stone-100 flex gap-3">
                        <Protected permission="user.manage">
                            <button
                                onClick={() => onToggleStatus(user.id, user.is_active ?? false)}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium transition-colors ${
                                    user.is_active
                                    ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                                }`}
                            >
                                {user.is_active ? <CheckCircle size={16} /> : <XCircle size={16} />}
                                <span>{user.is_active ? 'Đang hoạt động' : 'Vô hiệu hóa'}</span>
                            </button>
                        </Protected>

                        <Protected permission="user.manage">
                            <Link
                                href={`/users/${user.id}`}
                                className="flex items-center justify-center p-2.5 rounded-xl bg-stone-50 text-stone-600 hover:bg-orange-50 hover:text-orange-600 transition-colors border border-stone-100"
                            >
                                <Edit size={20} />
                            </Link>
                        </Protected>
                    </div>
                </div>
            ))}
        </div>
    )
}
