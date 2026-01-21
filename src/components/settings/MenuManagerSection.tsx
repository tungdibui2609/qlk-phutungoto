import { useState, useEffect } from 'react'
import { Check, Save } from 'lucide-react'
import { useUser } from '@/contexts/UserContext'
import { useSystem } from '@/contexts/SystemContext'
import { LayoutDashboard, Package, Settings, Warehouse, BookUser, BarChart3, Shield } from 'lucide-react'

// Define menu structure (should match Sidebar.tsx roughly, or be dynamic)
// Ideally we share this config, but for now copying it or making it static is valid for speed
// To avoid duplication, we might want to export menuItems from Sidebar.tsx, 
// but Sidebar.tsx uses lucide icons which might not be serializable or easy to export/import cleanly if mixed with client code.
// Let's redefine a simple structure here for the settings purpose.

type MenuNode = {
    id: string
    label: string
    icon: any
    children?: MenuNode[]
}

const MENU_STRUCTURE: MenuNode[] = [
    { id: 'Tổng quan', label: 'Tổng quan', icon: LayoutDashboard },
    {
        id: 'Quản lý sản phẩm',
        label: 'Quản lý sản phẩm',
        icon: Package,
        children: [
            { id: 'Sản phẩm', label: 'Sản phẩm', icon: null },
            { id: 'Danh mục', label: 'Danh mục', icon: null },
            { id: 'Đơn vị', label: 'Đơn vị', icon: null },
            { id: 'Xuất xứ', label: 'Xuất xứ', icon: null },
        ]
    },
    {
        id: 'Quản lý thông tin',
        label: 'Quản lý thông tin',
        icon: BookUser,
        children: [
            { id: 'Nhà cung cấp', label: 'Nhà cung cấp', icon: null },
            { id: 'Dòng xe', label: 'Dòng xe', icon: null },
            { id: 'Khách hàng', label: 'Khách hàng', icon: null },
        ]
    },
    {
        id: 'Quản lý Kho',
        label: 'Quản lý Kho',
        icon: Warehouse,
        children: [
            { id: 'Hạ tầng', label: 'Hạ tầng', icon: null },
            { id: 'Sơ đồ kho', label: 'Sơ đồ kho', icon: null },
            { id: 'Quản lý LOT', label: 'Quản lý LOT', icon: null },
            { id: 'Nhập kho (KT)', label: 'Nhập kho (KT)', icon: null },
            { id: 'Xuất kho (KT)', label: 'Xuất kho (KT)', icon: null },
            { id: 'Tồn kho', label: 'Tồn kho', icon: null },
            { id: 'Kiểm kê', label: 'Kiểm kê', icon: null },
        ]
    },
    {
        id: 'Báo cáo',
        label: 'Báo cáo',
        icon: BarChart3,
        children: [
            { id: 'Chứng từ khách hàng', label: 'Chứng từ khách hàng', icon: null },
            { id: 'Công nợ NCC', label: 'Công nợ NCC', icon: null },
        ]
    },
    {
        id: 'Người dùng',
        label: 'Người dùng',
        icon: Shield,
        children: [
            { id: 'Người dùng', label: 'Người dùng', icon: null },
            { id: 'Vai trò', label: 'Vai trò', icon: null },
            { id: 'Phân quyền', label: 'Phân quyền', icon: null },
        ]
    },
    // 'Cài đặt' is usually essential, maybe don't allow hiding it? Or allow it.
    { id: 'Cài đặt', label: 'Cài đặt', icon: Settings },
]

export default function MenuManagerSection() {
    const { profile, updateProfileSettings } = useUser()
    const { systems } = useSystem()

    const [selectedSystemCode, setSelectedSystemCode] = useState<string>('')
    // hiddenMenus is now local state for the SELECTED system
    const [hiddenMenus, setHiddenMenus] = useState<string[]>([])
    const [isSaving, setIsSaving] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)

    // Initialize selected system
    useEffect(() => {
        if (systems.length > 0 && !selectedSystemCode) {
            setSelectedSystemCode(systems[0].code)
        }
    }, [systems])

    // Load hidden menus for the selected system from profile
    useEffect(() => {
        if (profile?.hidden_menus && selectedSystemCode) {
            const systemHidden = profile.hidden_menus[selectedSystemCode] || []
            setHiddenMenus(systemHidden)
            setHasChanges(false)
        } else {
            setHiddenMenus([])
            setHasChanges(false)
        }
    }, [profile, selectedSystemCode])

    const toggleMenu = (menuId: string, isParent: boolean, children?: MenuNode[]) => {
        setHasChanges(true)
        setHiddenMenus(prev => {
            const isHidden = prev.includes(menuId)
            let newHidden = [...prev]

            if (isHidden) {
                // Unhide: remove from list
                newHidden = newHidden.filter(id => id !== menuId)
            } else {
                // Hide: add to list
                newHidden.push(menuId)

                // If hiding a parent, hide all children too?
                if (isParent && children) {
                    children.forEach(child => {
                        if (!newHidden.includes(child.id)) {
                            newHidden.push(child.id)
                        }
                    })
                }
            }
            return newHidden
        })
    }

    const handleSave = async () => {
        if (!selectedSystemCode) return
        setIsSaving(true)

        // Prepare update object
        // Deep merge logic: Get valid existing object or empty
        const currentHiddenMenus = profile?.hidden_menus || {}

        const updatedHiddenMenus = {
            ...currentHiddenMenus,
            [selectedSystemCode]: hiddenMenus
        }

        await updateProfileSettings({ hidden_menus: updatedHiddenMenus })
        setIsSaving(false)
        setHasChanges(false)
    }

    return (
        <div className="bg-white dark:bg-stone-900 rounded-lg shadow-sm border border-stone-200 dark:border-stone-800 p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-lg font-semibold text-stone-900 dark:text-white">Quản lý Menu Sidebar</h2>
                    <p className="text-sm text-stone-500 dark:text-stone-400">Chọn phân hệ và các menu bạn muốn hiển thị.</p>
                </div>

                <div className="flex items-center gap-3">
                    <select
                        value={selectedSystemCode}
                        onChange={(e) => setSelectedSystemCode(e.target.value)}
                        className="p-2 border border-stone-300 rounded-lg text-sm bg-white min-w-[200px]"
                    >
                        {systems.map(sys => (
                            <option key={sys.code} value={sys.code}>{sys.name}</option>
                        ))}
                    </select>

                    <button
                        onClick={handleSave}
                        disabled={!hasChanges || isSaving || !selectedSystemCode}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${hasChanges
                            ? 'bg-orange-600 text-white hover:bg-orange-700 shadow-md'
                            : 'bg-stone-100 text-stone-400 cursor-not-allowed'
                            }`}
                    >
                        <Save size={16} />
                        {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {MENU_STRUCTURE.map(menu => {
                    const Icon = menu.icon
                    const isHidden = hiddenMenus.includes(menu.id)

                    return (
                        <div key={menu.id} className="border border-stone-100 rounded-lg p-4 bg-stone-50/50 hover:bg-white hover:shadow-sm transition-all">
                            {/* Parent Item */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-orange-100 text-orange-600 rounded-md">
                                        {Icon && <Icon size={18} />}
                                    </div>
                                    <span className="font-medium text-stone-800">{menu.label}</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={!isHidden}
                                        onChange={() => toggleMenu(menu.id, true, menu.children)}
                                    />
                                    <div className="w-9 h-5 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                                </label>
                            </div>

                            {/* Children Items */}
                            {menu.children && menu.children.length > 0 && (
                                <div className="ml-4 pl-4 border-l-2 border-stone-200 space-y-2 mt-2">
                                    {menu.children.map(child => {
                                        const isChildHidden = hiddenMenus.includes(child.id)
                                        return (
                                            <div key={child.id} className="flex items-center justify-between py-1">
                                                <span className={`text-sm ${isChildHidden ? 'text-stone-400' : 'text-stone-600'}`}>
                                                    {child.label}
                                                </span>
                                                <label className="relative inline-flex items-center cursor-pointer scale-75 origin-right">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={!isChildHidden}
                                                        onChange={() => toggleMenu(child.id, false)}
                                                    />
                                                    <div className="w-9 h-5 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                                                </label>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
