'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
    Plus, Edit, Trash2, Save, X,
    Truck, Package, Factory, BarChart3, Warehouse,
    Building, Archive, Container, Box, ShoppingCart,
    Zap, Anchor, Plane, Shield
} from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'

// Icon Options
const ICON_OPTIONS = [
    { name: 'Truck', icon: Truck },
    { name: 'Package', icon: Package },
    { name: 'Factory', icon: Factory },
    { name: 'BarChart3', icon: BarChart3 },
    { name: 'Warehouse', icon: Warehouse },
    { name: 'Building', icon: Building },
    { name: 'Archive', icon: Archive },
    { name: 'Container', icon: Container },
    { name: 'Box', icon: Box },
    { name: 'ShoppingCart', icon: ShoppingCart },
    { name: 'Zap', icon: Zap },
]

// Color Options (Tailwind classes)
const COLOR_OPTIONS = [
    { name: 'Blue', bg: 'bg-blue-600', text: 'text-blue-100', preview: 'bg-blue-600' },
    { name: 'Amber', bg: 'bg-amber-600', text: 'text-amber-100', preview: 'bg-amber-600' },
    { name: 'Green', bg: 'bg-green-600', text: 'text-green-100', preview: 'bg-green-600' },
    { name: 'Purple', bg: 'bg-purple-600', text: 'text-purple-100', preview: 'bg-purple-600' },
    { name: 'Red', bg: 'bg-red-600', text: 'text-red-100', preview: 'bg-red-600' },
    { name: 'Gray', bg: 'bg-gray-600', text: 'text-gray-100', preview: 'bg-gray-600' },
    { name: 'Orange', bg: 'bg-orange-600', text: 'text-orange-100', preview: 'bg-orange-600' },
    { name: 'Teal', bg: 'bg-teal-600', text: 'text-teal-100', preview: 'bg-teal-600' },
]

interface System {
    code: string
    name: string
    description: string | null
    icon: string | null
    bg_color_class: string | null
    text_color_class: string | null
    is_active: boolean
    created_at: string
}

export default function SystemManagerSection() {
    const [systems, setSystems] = useState<System[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingSystem, setEditingSystem] = useState<System | null>(null)
    const { showToast } = useToast()

    // Form State
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        description: '',
        icon: 'Warehouse',
        colorIdx: 0
    })

    useEffect(() => {
        fetchSystems()
    }, [])

    async function fetchSystems() {
        setLoading(true)
        const { data, error } = await (supabase.from('systems') as any).select('*').order('created_at')
        if (error) {
            showToast('Lỗi tải danh sách kho: ' + error.message, 'error')
        } else {
            setSystems(data || [])
        }
        setLoading(false)
    }

    // Helper to generate code from name
    const generateCode = (name: string) => {
        return name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd').replace(/Đ/g, 'D')
            .replace(/[^a-zA-Z0-9 ]/g, '')
            .trim()
            .replace(/\s+/g, '_')
            .toUpperCase()
    }

    const handleCreate = () => {
        setEditingSystem(null)
        setFormData({
            code: '',
            name: '',
            description: '',
            icon: 'Warehouse',
            colorIdx: 0
        })
        setIsModalOpen(true)
    }

    const handleEdit = (sys: System) => {
        setEditingSystem(sys)
        // Find color index
        const cIdx = COLOR_OPTIONS.findIndex(c => c.bg === sys.bg_color_class)
        setFormData({
            code: sys.code,
            name: sys.name,
            description: sys.description || '',
            icon: sys.icon || 'Warehouse',
            colorIdx: cIdx >= 0 ? cIdx : 0
        })
        setIsModalOpen(true)
    }

    const handleDelete = async (code: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa kho này? Hành động này có thể gây lỗi nếu đang có dữ liệu liên kết.')) return

        const { error } = await (supabase.from('systems') as any).delete().eq('code', code)
        if (error) {
            showToast('Không thể xóa: ' + error.message, 'error')
        } else {
            showToast('Đã xóa thành công', 'success')
            fetchSystems()
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        const color = COLOR_OPTIONS[formData.colorIdx]
        const payload = {
            code: formData.code.toUpperCase(), // Ensure uppercase code
            name: formData.name,
            description: formData.description,
            icon: formData.icon,
            bg_color_class: color.bg,
            text_color_class: color.text,
            is_active: true
        }

        try {
            if (editingSystem) {
                // Update
                const { error } = await (supabase
                    .from('systems') as any)
                    .update({
                        name: payload.name,
                        description: payload.description,
                        icon: payload.icon,
                        bg_color_class: payload.bg_color_class,
                        text_color_class: payload.text_color_class
                    })
                    .eq('code', editingSystem.code)

                if (error) throw error
                showToast('Cập nhật thành công', 'success')
            } else {
                // Create
                const { error } = await (supabase
                    .from('systems') as any)
                    .insert([payload])

                if (error) throw error
                showToast('Tạo mới thành công', 'success')
            }
            setIsModalOpen(false)
            fetchSystems()
        } catch (error: any) {
            showToast('Lỗi: ' + error.message, 'error')
        }
    }

    // Helper to render icon
    const renderIcon = (iconName: string | null) => {
        const item = ICON_OPTIONS.find(i => i.name === iconName)
        const Icon = item ? item.icon : Warehouse
        return <Icon size={24} />
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-900">Danh sách Các Phân Hệ Kho</h2>
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                    <Plus size={18} />
                    Thêm Kho Mới
                </button>
            </div>

            {loading ? (
                <div className="text-center py-10 text-gray-400">Đang tải...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {systems.map((sys) => {
                        const IconComponent = ICON_OPTIONS.find(i => i.name === sys.icon)?.icon || Warehouse

                        return (
                            <div key={sys.code} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative group">
                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleEdit(sys)}
                                        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(sys.code)}
                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-md"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-lg ${sys.bg_color_class?.replace('bg-', 'bg-opacity-10 text-') || 'bg-gray-100 text-gray-600'}`}>
                                        <IconComponent size={32} className={sys.bg_color_class?.replace('bg-', 'text-') || 'text-gray-600'} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-800">{sys.name}</h3>
                                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{sys.code}</code>
                                        <p className="text-sm text-gray-500 mt-2 line-clamp-2">{sys.description}</p>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0">
                            <h3 className="font-bold text-lg text-gray-800">
                                {editingSystem ? 'Cập nhật Kho' : 'Thêm Kho Mới'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
                            {!editingSystem && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Mã Kho (Tự động tạo)</label>
                                    <input
                                        readOnly
                                        value={formData.code}
                                        className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 outline-none uppercase font-mono cursor-not-allowed"
                                        placeholder="Mã sẽ được tạo từ tên kho..."
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tên Kho</label>
                                <input
                                    required
                                    value={formData.name}
                                    onChange={e => {
                                        const val = e.target.value
                                        setFormData({
                                            ...formData,
                                            name: val,
                                            code: generateCode(val)  // Auto-generate code
                                        })
                                    }}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                    placeholder="VD: Kho Mới"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                    rows={2}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Biểu tượng</label>
                                    <div className="grid grid-cols-4 gap-2 h-32 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                                        {ICON_OPTIONS.map((opt) => {
                                            const Icon = opt.icon
                                            return (
                                                <button
                                                    key={opt.name}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, icon: opt.name })}
                                                    className={`p-2 rounded-lg flex items-center justify-center hover:bg-gray-100 ${formData.icon === opt.name ? 'bg-orange-100 text-orange-600 ring-1 ring-orange-500' : 'text-gray-500'}`}
                                                    title={opt.name}
                                                >
                                                    <Icon size={20} />
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Màu chủ đạo</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {COLOR_OPTIONS.map((opt, idx) => (
                                            <button
                                                key={opt.name}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, colorIdx: idx })}
                                                className={`flex items-center gap-2 p-2 rounded-lg border text-sm ${formData.colorIdx === idx ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500' : 'border-gray-200 hover:bg-gray-50'}`}
                                            >
                                                <div className={`w-4 h-4 rounded-full ${opt.preview}`}></div>
                                                {opt.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium flex items-center justify-center gap-2"
                                >
                                    <Save size={18} />
                                    {editingSystem ? 'Lưu thay đổi' : 'Tạo mới'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
