'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Search, Save, User as UserIcon, Shield, Check, AlertCircle, Loader2, Ban, Lock } from 'lucide-react'
import Image from 'next/image'
import Protected from '@/components/auth/Protected'
import { APP_ROUTES, RouteItem } from '@/config/routes'
import { useToast } from '@/components/ui/ToastProvider'

// DIAGNOSTIC VERSION: 3.0 (FORCED)

// Types
type UserProfile = {
    id: string
    full_name: string
    email: string | null
    avatar_url: string | null
    permissions: string[] | null
    blocked_routes: string[] | null // New column
    roles: { name: string } | null
    employee_code: string | null
}

type Permission = {
    id: string
    code: string
    name: string
    module: string
    description: string | null
}

export default function UserPermissionsPage() {
    const [users, setUsers] = useState<UserProfile[]>([])
    const [permissions, setPermissions] = useState<Permission[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
    const { showToast } = useToast()

    // State for selections
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
    const [selectedBlockedRoutes, setSelectedBlockedRoutes] = useState<string[]>([])

    const [searchTerm, setSearchTerm] = useState('')
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null)
    const [activeTab, setActiveTab] = useState<'permissions' | 'blocked_routes'>('permissions')
    const [fetchError, setFetchError] = useState<string | null>(null)

    // Initial Data Fetch
    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            try {
                // 1. Fetch Users
                const { data: userData, error: userError } = await supabase
                    .from('user_profiles')
                    .select('id, full_name, email, avatar_url, permissions, blocked_routes, roles(name), employee_code')
                    .not('employee_code', 'is', null)
                    .neq('employee_code', '')
                    .order('full_name')

                if (userError) throw userError

                // 2. Fetch Permissions
                const { data: permData, error: permError } = await supabase
                    .from('permissions')
                    .select('*')
                    .order('module', { ascending: true })
                    .order('code', { ascending: true })

                if (permError) throw permError

                console.log('--- DEBUG: DATA FETCHED ---')
                console.log('Users found:', userData?.length || 0)
                console.log('Permissions found:', permData?.length || 0)

                // 3. Fallback if empty (for debugging)
                const finalUsers = (userData as any[]) || []
                if (finalUsers.length === 0) {
                    console.warn('Fallback: Adding dummy user for debug')
                    finalUsers.push({
                        id: 'dummy-1',
                        full_name: 'NGƯỜI DÙNG KIỂM TRA (DUMMY)',
                        email: 'test@example.com',
                        employee_code: 'TEST001',
                        roles: { name: 'Admin' },
                        permissions: [],
                        blocked_routes: []
                    })
                }

                setUsers(finalUsers)
                setPermissions((permData as Permission[]) || [])

            } catch (error: any) {
                console.error('Error fetching data:', error)
                setFetchError(error.message || 'Lỗi không xác định khi tải dữ liệu')
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    // Update selected data when changing user
    useEffect(() => {
        if (selectedUser) {
            setSelectedPermissions(selectedUser.permissions || [])
            setSelectedBlockedRoutes(selectedUser.blocked_routes || [])
        } else {
            setSelectedPermissions([])
            setSelectedBlockedRoutes([])
        }
    }, [selectedUser])

    // Filtered Users
    const filteredUsers = users.filter(user =>
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // Group Permissions by Module
    const groupedPermissions = permissions.reduce((acc, perm) => {
        if (!acc[perm.module]) {
            acc[perm.module] = []
        }
        acc[perm.module].push(perm)
        return acc
    }, {} as Record<string, Permission[]>)

    // Handlers
    const togglePermission = (code: string) => {
        // CASE 1: Toggling FULL ACCESS
        if (code === 'system.full_access') {
            const isCurrentlyFull = selectedPermissions.includes('system.full_access')
            if (isCurrentlyFull) {
                // If unchecking Full Access -> Clear ALL permissions
                setSelectedPermissions([])
            } else {
                // If checking Full Access -> Select ALL permissions + Full Access token
                const allCodes = permissions.map(p => p.code)
                // Add unique codes
                const newSet = new Set([...allCodes, 'system.full_access'])
                setSelectedPermissions(Array.from(newSet))
            }
            return
        }

        // CASE 2: Toggling Individual Permission
        if (selectedPermissions.includes(code)) {
            // Unchecking a child -> Must also uncheck 'system.full_access' if present
            setSelectedPermissions(prev => prev.filter(p => p !== code && p !== 'system.full_access'))
        } else {
            // Checking a child -> Just add it
            setSelectedPermissions(prev => [...prev, code])
        }
    }

    // Helper to get all paths recursively
    const getAllPaths = (item: RouteItem): string[] => {
        let paths = [item.path]
        if (item.children) {
            item.children.forEach(child => {
                paths = [...paths, ...getAllPaths(child)]
            })
        }
        return paths
    }

    const toggleBlockedRoute = (item: RouteItem) => {
        const pathsToToggle = getAllPaths(item)
        const isCurrentlyBlocked = selectedBlockedRoutes.includes(item.path)

        if (isCurrentlyBlocked) {
            // Unblock parent -> Unblock all children (and self)
            setSelectedBlockedRoutes(prev => prev.filter(p => !pathsToToggle.includes(p)))
        } else {
            // Block parent -> Block all children (and self)
            // Use Set to avoid duplicates
            const newSet = new Set([...selectedBlockedRoutes, ...pathsToToggle])
            setSelectedBlockedRoutes(Array.from(newSet))
        }
    }

    const handleSave = async () => {
        if (!selectedUser) return
        setSaving(true)

        try {
            const updates = {
                permissions: selectedPermissions,
                blocked_routes: selectedBlockedRoutes
            }

            const { error } = await (supabase
                .from('user_profiles') as any)
                .update(updates)
                .eq('id', selectedUser.id)

            if (error) throw error

            // Update local state
            setUsers(prev => prev.map(u =>
                u.id === selectedUser.id ? { ...u, ...updates } : u
            ))

            // Update selectedUser reference
            setSelectedUser(prev => prev ? { ...prev, ...updates } : null)

            showToast('Đã lưu thay đổi thành công!', 'success')
        } catch (error: any) {
            console.error('Error saving:', error)
            showToast('Lỗi khi lưu: ' + error.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    // Use Set to avoid dupes logic for modules
    const toggleModule = (moduleName: string, modulePerms: Permission[]) => {
        const allCodes = modulePerms.map(p => p.code)
        const allSelected = allCodes.every(code => selectedPermissions.includes(code))

        if (allSelected) {
            setSelectedPermissions(prev => prev.filter(code => !allCodes.includes(code)))
        } else {
            const newPerms = new Set([...selectedPermissions, ...allCodes])
            setSelectedPermissions(Array.from(newPerms))
        }
    }

    // Toggle All Permissions (Global for Level 3 filtered view)
    const toggleAllAvailablePermissions = () => {
        // Filter out system permissions exactly as we do in the render loop
        const availablePermissions = permissions.filter(p => {
            const isSystemModule = p.module.toUpperCase() === 'HỆ THỐNG' || p.module.toUpperCase() === 'SYSTEM'
            const isSystemPrefix = p.code.startsWith('system.') || p.code.startsWith('user.')
            return !isSystemModule && !isSystemPrefix
        }).map(p => p.code)

        const allSelected = availablePermissions.every(code => selectedPermissions.includes(code))

        if (allSelected) {
            // Deselect all available
            setSelectedPermissions(prev => prev.filter(code => !availablePermissions.includes(code)))
        } else {
            // Select all available
            const newSet = new Set([...selectedPermissions, ...availablePermissions])
            setSelectedPermissions(Array.from(newSet))
        }
    }

    // Helper to render route tree for blocking
    const renderRouteItem = (item: RouteItem, depth = 0) => {
        const isBlocked = selectedBlockedRoutes.includes(item.path)

        return (
            <div key={item.path} className="mb-1">
                <label
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border ${isBlocked
                        ? 'bg-red-50 border-red-200 shadow-sm'
                        : 'hover:bg-stone-50 border-transparent'
                        }`}
                    style={{ marginLeft: `${depth * 24}px` }}
                >
                    <div className="pt-0.5">
                        <input
                            type="checkbox"
                            checked={isBlocked}
                            onChange={() => toggleBlockedRoute(item)}
                            className="w-5 h-5 rounded border-stone-300 text-red-600 focus:ring-red-500 cursor-pointer"
                        />
                    </div>
                    <div>
                        <p className={`text-sm font-medium ${isBlocked ? 'text-red-700' : 'text-stone-700'} flex items-center gap-2`}>
                            {item.name}
                            {isBlocked && <Ban size={14} className="text-red-500" />}
                        </p>
                        <p className="text-xs text-stone-400 font-mono mt-0.5">{item.path}</p>
                    </div>
                </label>

                {item.children && (
                    <div className="mt-1 border-l-2 border-stone-100 ml-5 pl-1">
                        {item.children.map(child => renderRouteItem(child, depth + 1))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <Protected permission="user.manage" fallback={<div className="p-8 text-center text-stone-500">Bạn không có quyền truy cập trang này.</div>}>
            <div className="flex bg-stone-50 min-h-[calc(100vh-80px)]" style={{ height: 'calc(100vh - 80px)' }}>
                {/* LEFT SIDEBAR: USERS List */}
                <div className="w-80 border-r border-stone-200 bg-white flex flex-col h-full">
                    <div className="p-4 border-b border-stone-100">
                        <h2 className="font-bold text-lg text-stone-800 mb-3 flex items-center gap-2">
                            <UserIcon className="text-orange-500" size={20} />
                            Nhân viên
                        </h2>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                            <input
                                type="text"
                                placeholder="Tìm nhân viên..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {loading ? (
                            <div className="flex justify-center p-4">
                                <Loader2 className="animate-spin text-orange-500" />
                            </div>
                        ) : (
                            filteredUsers.map(user => (
                                <button
                                    key={user.id}
                                    onClick={() => setSelectedUser(user)}
                                    className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 ${selectedUser?.id === user.id
                                        ? 'bg-orange-50 border border-orange-200 shadow-sm'
                                        : 'hover:bg-stone-50 border border-transparent'
                                        }`}
                                >
                                    <div className="relative w-10 h-10 rounded-full overflow-hidden bg-stone-200 flex-shrink-0">
                                        {user.avatar_url ? (
                                            <Image src={user.avatar_url} alt={user.full_name} fill className="object-cover" />
                                        ) : (
                                            <div className="flex items-center justify-center h-full w-full text-stone-500 font-bold">
                                                {user.email?.[0]?.toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`font-medium truncate ${selectedUser?.id === user.id ? 'text-orange-900' : 'text-stone-800'}`}>
                                            {user.full_name}
                                        </p>
                                        <p className="text-xs text-stone-500 truncate">{user.roles?.name || 'Chưa có vai trò'}</p>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* RIGHT MAIN: CONTENT */}
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                    {selectedUser ? (
                        <>
                            {/* Header */}
                            <div className="bg-white border-b border-stone-200 px-6 py-4 flex flex-col justify-center min-h-[73px]">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h1 className="text-xl font-bold text-stone-800 flex items-center gap-2">
                                            Phân quyền: <span className="text-orange-600">{selectedUser.full_name}</span>
                                        </h1>
                                        <p className="text-sm text-stone-500">
                                            {selectedUser.email}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-sm flex items-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                                        >
                                            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                            Lưu thay đổi
                                        </button>
                                    </div>
                                </div>

                                {/* Tabs */}
                                <div className="flex gap-6">
                                    <button
                                        onClick={() => setActiveTab('permissions')}
                                        className={`pb-3 px-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'permissions'
                                            ? 'border-orange-500 text-orange-600'
                                            : 'border-transparent text-stone-500 hover:text-stone-700'
                                            }`}
                                    >
                                        <Shield size={16} />
                                        Cho phép (Permissions)
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('blocked_routes')}
                                        className={`pb-3 px-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'blocked_routes'
                                            ? 'border-red-500 text-red-600'
                                            : 'border-transparent text-stone-500 hover:text-stone-700'
                                            }`}
                                    >
                                        <Ban size={16} />
                                        Chặn Trang (Blocked Pages)
                                    </button>
                                </div>
                            </div>

                            {/* Content Area */}
                            <div className="flex-1 overflow-y-auto p-6 bg-stone-50">
                                {activeTab === 'permissions' ? (
                                    // PERMISSIONS - COMPACT TABLE
                                    <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden pb-20">
                                        {/* Header */}
                                        <div className="bg-stone-50/80 px-4 py-3 border-b border-stone-200 flex items-center justify-between">
                                            <h3 className="font-bold text-stone-700 uppercase tracking-wide text-sm flex items-center gap-2">
                                                <Shield size={16} className="text-stone-400" />
                                                Bảng phân quyền
                                            </h3>
                                            <button
                                                onClick={toggleAllAvailablePermissions}
                                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-sm font-medium text-stone-600 hover:text-orange-600 hover:border-orange-200 transition-all shadow-sm"
                                            >
                                                <Check size={16} />
                                                Chọn / Bỏ chọn tất cả
                                            </button>
                                        </div>

                                        {fetchError ? (
                                            <div className="p-10 text-center bg-red-50 border-b border-red-100">
                                                <AlertCircle size={32} className="mx-auto mb-2 text-red-500" />
                                                <p className="text-red-700 font-bold">LỖI KẾT NỐI DATABASE</p>
                                                <p className="text-red-600 text-xs mt-1">{fetchError}</p>
                                            </div>
                                        ) : permissions.length === 0 ? (
                                            <div className="p-20 text-center">
                                                <Shield size={48} className="mx-auto mb-4 text-stone-200" />
                                                <p className="text-stone-500 font-medium">Không có dữ liệu quyền hạn</p>
                                                <p className="text-stone-400 text-sm mt-1">Vui lòng kiểm tra lại bảng permissions trong Database.</p>
                                                <button
                                                    onClick={() => window.location.reload()}
                                                    className="mt-4 text-orange-600 font-bold text-sm hover:underline"
                                                >
                                                    Tải lại trang
                                                </button>
                                            </div>
                                        ) : (
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 text-xs uppercase tracking-wider">
                                                        <th className="px-4 py-3 font-semibold">Chức năng</th>
                                                        <th className="px-4 py-3 font-semibold text-center w-24">Xem</th>
                                                        <th className="px-4 py-3 font-semibold text-center w-24">Quản lý</th>
                                                        <th className="px-4 py-3 font-semibold text-center w-24">Xét duyệt</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-stone-100">
                                                    {(() => {
                                                        // Group permissions by feature (e.g., product.view + product.manage -> "Sản phẩm")
                                                        const featureMap: Record<string, { view?: Permission; manage?: Permission; approve?: Permission; other: Permission[] }> = {}

                                                        // HARDCODED TEST ROW
                                                        featureMap['TEST_SYSTEM'] = {
                                                            view: { id: 'test-1', code: 'test.view', name: 'QUYỀN TEST HỆ THỐNG', module: 'Hàng hóa' } as any,
                                                            manage: { id: 'test-2', code: 'test.manage', name: 'QUYỀN TEST HỆ THỐNG', module: 'Hàng hóa' } as any,
                                                            other: []
                                                        }

                                                        const filtered = permissions.filter(p => {
                                                            if (!p.module || !p.code) return false
                                                            const isSystemModule = p.module.toUpperCase() === 'HỆ THỐNG' || p.module.toUpperCase() === 'SYSTEM' || p.module.toUpperCase() === 'CORE'
                                                            const isSystemPrefix = p.code.startsWith('system.') || p.code.startsWith('user.') || p.code.startsWith('settings.')
                                                            return !isSystemModule && !isSystemPrefix
                                                        })

                                                        if (filtered.length === 0 && permissions.length > 0) {
                                                            return (
                                                                <tr>
                                                                    <td colSpan={3} className="px-4 py-12 text-center text-stone-400 italic">
                                                                        Tất cả quyền hiện có đều là quyền hệ thống và bị ẩn.
                                                                    </td>
                                                                </tr>
                                                            )
                                                        }

                                                        // Guaranteed VISIBLE rows
                                                        featureMap['CORE_VERIFY'] = {
                                                            view: { id: 'v1', code: 'verify.view', name: 'XÁC MINH HỆ THỐNG (PHẢI HIỆN)', module: 'HÀNG HÓA' } as any,
                                                            manage: { id: 'v2', code: 'verify.manage', name: 'XÁC MINH HỆ THỐNG (PHẢI HIỆN)', module: 'HÀNG HÓA' } as any,
                                                            other: []
                                                        }

                                                        filtered.forEach(perm => {
                                                            // Extract feature name from code (e.g., "product" from "product.view")
                                                            const parts = perm.code.split('.')
                                                            const feature = parts[0]
                                                            const action = parts[1]

                                                            if (!featureMap[feature]) {
                                                                featureMap[feature] = { other: [] }
                                                            }

                                                            if (action === 'view') {
                                                                featureMap[feature].view = perm
                                                            } else if (action === 'manage') {
                                                                featureMap[feature].manage = perm
                                                            } else if (action === 'approve') {
                                                                featureMap[feature].approve = perm
                                                            } else {
                                                                featureMap[feature].other.push(perm)
                                                            }
                                                        })

                                                        // Feature display names
                                                        const featureNames: Record<string, string> = {
                                                            warehouse: 'Kho hàng',
                                                            warehousemap: 'Thiết kế sơ đồ',
                                                            inventory: 'Tồn kho',
                                                            product: 'Sản phẩm',
                                                            category: 'Danh mục',
                                                            unit: 'Đơn vị tính',
                                                            origin: 'Xuất xứ',
                                                            partner: 'Đối tác',
                                                            vehicle: 'Dòng xe',
                                                            qc: 'Kiểm hàng (QC)',
                                                            site_inventory: 'Kho công trình',
                                                            order: 'Phiếu nhập/xuất',
                                                            lotcode: 'Mã lô',
                                                            lot: 'Quản lý LOT',
                                                            report: 'Báo cáo',
                                                            customer: 'Khách hàng',
                                                            supplier: 'Nhà cung cấp',
                                                            audit: 'Kiểm kê'
                                                        }

                                                        return Object.entries(featureMap).map(([feature, { view, manage, approve, other }]) => {
                                                            const displayName = featureNames[feature] || feature
                                                            const viewChecked = view && selectedPermissions.includes(view.code)
                                                            const manageChecked = manage && selectedPermissions.includes(manage.code)
                                                            const approveChecked = approve && selectedPermissions.includes(approve.code)

                                                            // Handle special permissions (like warehouse.map)
                                                            if (!view && !manage && other.length > 0) {
                                                                return other.map(perm => {
                                                                    const isChecked = selectedPermissions.includes(perm.code)
                                                                    return (
                                                                        <tr key={perm.id} className="hover:bg-stone-50 transition-colors">
                                                                            <td className="px-4 py-3">
                                                                                <span className="font-medium text-stone-800">{perm.name}</span>
                                                                                <span className="text-xs text-stone-400 ml-2">({perm.module})</span>
                                                                            </td>
                                                                            <td className="px-4 py-3 text-center" colSpan={3}>
                                                                                <label className="inline-flex items-center gap-2 cursor-pointer">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={isChecked}
                                                                                        onChange={() => togglePermission(perm.code)}
                                                                                        className="w-5 h-5 rounded border-stone-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                                                                                    />
                                                                                    <span className="text-sm text-stone-600">Cho phép</span>
                                                                                </label>
                                                                            </td>
                                                                        </tr>
                                                                    )
                                                                })
                                                            }

                                                            return (
                                                                <tr key={feature} className="hover:bg-stone-50 transition-colors">
                                                                    <td className="px-4 py-3">
                                                                        <span className="font-medium text-stone-800">{displayName}</span>
                                                                        {view && <span className="text-xs text-stone-400 ml-2">({view.module})</span>}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center">
                                                                        {view ? (
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={viewChecked}
                                                                                onChange={() => togglePermission(view.code)}
                                                                                className="w-5 h-5 rounded border-stone-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                                                                                title={view.description || view.name}
                                                                            />
                                                                        ) : (
                                                                            <span className="text-stone-300">—</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center">
                                                                        {manage ? (
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={manageChecked}
                                                                                onChange={() => togglePermission(manage.code)}
                                                                                className="w-5 h-5 rounded border-stone-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                                                                                title={manage.description || manage.name}
                                                                            />
                                                                        ) : (
                                                                            <span className="text-stone-300">—</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center">
                                                                        {approve ? (
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={approveChecked}
                                                                                onChange={() => togglePermission(approve.code)}
                                                                                className="w-5 h-5 rounded border-stone-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                                                                                title={approve.description || approve.name}
                                                                            />
                                                                        ) : (
                                                                            <span className="text-stone-300">—</span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            )
                                                        })
                                                    })()}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                ) : (
                                    // BLOCKED ROUTES LIST
                                    <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 max-w-3xl mx-auto pb-20">
                                        <div className="mb-6 bg-red-50 border border-red-100 rounded-lg p-4 flex items-start gap-3">
                                            <AlertCircle className="text-red-500 mt-0.5" size={20} />
                                            <div>
                                                <h3 className="font-bold text-red-800 text-sm">Chế độ chặn trang (Blocking Mode)</h3>
                                                <p className="text-sm text-red-700 mt-1">
                                                    Các trang được tích chọn bên dưới sẽ bị <strong>CHẶN HOÀN TOÀN</strong> đối với người dùng này.
                                                    Hệ thống sẽ kiểm tra danh sách chặn trước, sau đó mới kiểm tra quyền truy cập.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            {APP_ROUTES.map(route => renderRouteItem(route))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-stone-400 bg-stone-50">
                            <div className="w-24 h-24 bg-stone-100 rounded-full flex items-center justify-center mb-4 border-2 border-stone-200 border-dashed">
                                <UserIcon size={48} className="opacity-50" />
                            </div>
                            <p className="text-lg font-medium text-stone-500">Chọn nhân viên để phân quyền</p>
                            <p className="text-sm mt-2 max-w-sm text-center opacity-75">
                                Chọn một nhân viên từ danh sách bên trái để xem và chỉnh sửa quyền hạn hoặc chặn truy cập trang.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </Protected>
    )
}
