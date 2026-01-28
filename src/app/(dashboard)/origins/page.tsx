'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { Plus, Search, Globe, Edit, Trash2, Save, X, Loader2, AlertCircle } from 'lucide-react'

type Origin = {
    id: string
    created_at: string
    name: string
    code: string | null
    description: string | null
    system_code: string | null
    is_active: boolean
}

export default function OriginsPage() {
    const { currentSystem } = useSystem()

    const [origins, setOrigins] = useState<Origin[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState('')
    const [editCode, setEditCode] = useState('')
    const [editDescription, setEditDescription] = useState('')
    const [showAddForm, setShowAddForm] = useState(false)
    const [newName, setNewName] = useState('')
    const [newCode, setNewCode] = useState('')
    const [newDescription, setNewDescription] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (currentSystem?.code) {
            fetchOrigins()
        }
    }, [currentSystem?.code])

    async function fetchOrigins() {
        if (!currentSystem?.code) return
        setLoading(true)
        const { data } = await (supabase
            .from('origins') as any)
            .select('*')
            .or(`system_code.eq.${currentSystem.code},system_code.is.null`)
            .order('name')

        if (data) setOrigins(data as Origin[])
        setLoading(false)
    }

    async function addOrigin() {
        if (!newName.trim() || !currentSystem?.code) return
        setSaving(true)

        const { error } = await (supabase.from('origins') as any).insert([{
            name: newName.trim(),
            code: newCode.trim() || null,
            description: newDescription.trim() || null,
            system_code: currentSystem.code,
            is_active: true
        }])

        if (error) {
            alert('Lỗi: ' + error.message)
        } else {
            setNewName('')
            setNewCode('')
            setNewDescription('')
            setShowAddForm(false)
            fetchOrigins()
        }
        setSaving(false)
    }

    async function updateOrigin(id: string) {
        if (!editName.trim() || !currentSystem?.code) return
        setSaving(true)

        const { error } = await (supabase.from('origins') as any).update({
            name: editName.trim(),
            code: editCode.trim() || null,
            description: editDescription.trim() || null,
            system_code: currentSystem.code
        }).eq('id', id)

        if (error) {
            alert('Lỗi: ' + error.message)
        } else {
            setEditingId(null)
            fetchOrigins()
        }
        setSaving(false)
    }

    async function deleteOrigin(id: string) {
        if (!confirm('Bạn có chắc muốn xóa xuất xứ này?')) return

        const { error } = await (supabase.from('origins') as any).delete().eq('id', id)
        if (error) {
            alert('Lỗi: ' + error.message)
        } else {
            fetchOrigins()
        }
    }

    const startEdit = (origin: Origin) => {
        setEditingId(origin.id)
        setEditName(origin.name)
        setEditCode(origin.code || '')
        setEditDescription(origin.description || '')
    }

    const filteredOrigins = origins.filter(o =>
        o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.code && o.code.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    const inputClass = "w-full p-2.5 rounded-lg border border-stone-200 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"

    return (
        <div className="space-y-6">
            {/* HEADER */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-stone-800 tracking-tight flex items-center gap-2">
                        Quản lý Xuất xứ
                        {currentSystem && (
                            <span className="text-orange-500 bg-orange-50 px-3 py-1 rounded-full text-sm font-medium border border-orange-100">
                                {currentSystem.name}
                            </span>
                        )}
                    </h1>
                    <p className="text-stone-500 text-sm mt-1">Danh sách quốc gia/nơi sản xuất cho hệ thống {currentSystem?.name}</p>
                </div>
                <button
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white transition-all duration-200 hover:-translate-y-0.5"
                    style={{
                        background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                        boxShadow: '0 4px 15px rgba(249, 115, 22, 0.3)',
                    }}
                >
                    <Plus size={20} />
                    Thêm xuất xứ
                </button>
            </div>

            {/* ADD FORM */}
            {showAddForm && (
                <div className="bg-orange-50 rounded-2xl p-5 border border-orange-200 shadow-sm animate-in fade-in slide-in-from-top-2">
                    <h3 className="font-semibold text-stone-800 mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Plus size={18} className="text-orange-600" />
                            Thêm xuất xứ mới cho {currentSystem?.name}
                        </div>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase">
                                Tên xuất xứ <span className="text-red-500">*</span>
                            </label>
                            <input
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className={inputClass}
                                placeholder="VD: Nhật Bản"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase">
                                Mã (Tùy chọn)
                            </label>
                            <input
                                value={newCode}
                                onChange={(e) => setNewCode(e.target.value)}
                                className={inputClass}
                                placeholder="VD: JP"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase">Mô tả</label>
                            <input
                                value={newDescription}
                                onChange={(e) => setNewDescription(e.target.value)}
                                className={inputClass}
                                placeholder="Mô tả thêm..."
                            />
                        </div>
                    </div>
                    <div className="flex gap-3 mt-5 justify-end border-t border-orange-200/50 pt-4">
                        <button
                            onClick={() => { setShowAddForm(false); setNewName(''); setNewCode(''); setNewDescription('') }}
                            className="px-4 py-2 rounded-lg bg-white text-stone-600 font-medium hover:bg-stone-50 border border-stone-200 transition-colors"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            onClick={addOrigin}
                            disabled={saving || !newName.trim()}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors shadow-sm"
                        >
                            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            Lưu xuất xứ
                        </button>
                    </div>
                </div>
            )}

            {/* SEARCH */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm xuất xứ..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                    />
                </div>
            </div>

            {/* ORIGINS LIST */}
            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
                {loading ? (
                    <div className="flex items-center justify-center p-12 text-stone-500 gap-3">
                        <Loader2 className="animate-spin" size={24} />
                        <span>Đang tải dữ liệu...</span>
                    </div>
                ) : filteredOrigins.length === 0 ? (
                    <div className="p-12 text-center text-stone-500">
                        <Globe className="mx-auto mb-3 opacity-20" size={64} />
                        <p className="text-lg font-medium">Chưa có dữ liệu</p>
                        <p className="text-sm">Hãy thêm xuất xứ đầu tiên của bạn</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-stone-50 border-b border-stone-200">
                            <tr>
                                <th className="text-left px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Tên xuất xứ</th>
                                <th className="text-left px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Mã</th>
                                <th className="text-left px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider">Mô tả</th>
                                <th className="text-center px-6 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider w-32">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                            {filteredOrigins.map((origin) => (
                                <tr key={origin.id} className="hover:bg-orange-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        {editingId === origin.id ? (
                                            <input
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className={inputClass}
                                                autoFocus
                                            />
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 group-hover:bg-white group-hover:text-orange-500 transition-colors">
                                                    <Globe size={16} />
                                                </div>
                                                <div>
                                                    <span className="font-semibold text-stone-800">{origin.name}</span>
                                                    {!origin.system_code && (
                                                        <div className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded mt-0.5 border border-amber-100 w-fit">
                                                            <AlertCircle size={10} />
                                                            Chưa phân loại
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {editingId === origin.id ? (
                                            <input
                                                value={editCode}
                                                onChange={(e) => setEditCode(e.target.value)}
                                                className={inputClass}
                                            />
                                        ) : (
                                            origin.code ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-stone-100 text-stone-800 border border-stone-200">
                                                    {origin.code}
                                                </span>
                                            ) : <span className="text-stone-400">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-stone-600">
                                        {editingId === origin.id ? (
                                            <input
                                                value={editDescription}
                                                onChange={(e) => setEditDescription(e.target.value)}
                                                className={inputClass}
                                            />
                                        ) : (
                                            origin.description || <span className="text-stone-300 italic">Không có mô tả</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {editingId === origin.id ? (
                                                <>
                                                    <button
                                                        onClick={() => updateOrigin(origin.id)}
                                                        disabled={saving}
                                                        className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors shadow-sm"
                                                        title="Lưu"
                                                    >
                                                        {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingId(null)}
                                                        className="p-2 rounded-lg bg-white text-stone-500 hover:bg-stone-100 border border-stone-200 transition-colors shadow-sm"
                                                        title="Hủy"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => startEdit(origin)}
                                                        className="p-2 rounded-lg text-stone-500 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                                                        title="Sửa"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteOrigin(origin.id)}
                                                        className="p-2 rounded-lg text-stone-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                                                        title="Xóa"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
