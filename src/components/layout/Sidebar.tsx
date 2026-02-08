'use client'
import { useState, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { LayoutDashboard, Package, Settings, LogOut, Warehouse, ChevronRight, ChevronDown, Building2, Car, List, FolderTree, Map, MapPin, ArrowDownToLine, ArrowUpFromLine, Boxes, ClipboardCheck, Users, BookUser, Shield, BarChart3, History, FileText, TrendingUp, AlertTriangle, PackageSearch, DollarSign, PieChart, Globe, Key, ShieldCheck, Tag, ArrowRightLeft, Activity, Star, StickyNote, HardHat, ShieldAlert, QrCode } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { useSidebar } from './SidebarContext'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'

type MenuItem = {
    id: string // [NEW] Mandatory unique ID
    name: string
    href?: string
    icon: any
    requiredPermission?: string // [NEW] Permissions key
    requiredModule?: string // [NEW] Commercial Module Code
    children?: MenuItem[] // Recursive support
}

const menuItems: MenuItem[] = [
    { id: 'overview', name: 'Tổng quan', href: '/', icon: LayoutDashboard },
    {
        id: 'products_cat',
        name: 'Quản lý sản phẩm',
        icon: Package,
        children: [
            { id: 'products', name: 'Sản phẩm', href: '/products', icon: List, requiredPermission: 'product.view' },
            { id: 'categories', name: 'Danh mục', href: '/categories', icon: FolderTree, requiredPermission: 'product.view' },
            { id: 'units', name: 'Đơn vị', href: '/units', icon: Boxes, requiredPermission: 'product.view' },
            { id: 'origins', name: 'Xuất xứ', href: '/origins', icon: Globe, requiredPermission: 'product.view' },
            { id: 'lot_codes', name: 'Mã phụ', href: '/warehouses/lot-codes', icon: Tag, requiredPermission: 'product.view' },
        ]
    },
    {
        id: 'info_cat',
        name: 'Quản lý thông tin',
        icon: BookUser,
        children: [
            { id: 'suppliers', name: 'Nhà cung cấp', href: '/suppliers', icon: Building2, requiredPermission: 'partner.view' },
            { id: 'vehicles', name: 'Dòng xe', href: '/vehicles', icon: Car, requiredPermission: 'vehicle.view' },
            { id: 'customers', name: 'Khách hàng', href: '/customers', icon: Users, requiredPermission: 'partner.view' },
            { id: 'order_types', name: 'Loại phiếu', href: '/order-types', icon: FileText, requiredPermission: 'warehouse.manage' },
            { id: 'qc', name: 'QC', href: '/qc', icon: ShieldCheck, requiredPermission: 'qc.view' },
            { id: 'members_teams', name: 'Thành viên & Đội', href: '/members-teams', icon: Users, requiredModule: 'member_team_manager' },
        ]
    },
    {
        id: 'warehouse_cat',
        name: 'Quản lý Kho',
        icon: Warehouse,
        children: [
            { id: 'infrastructure', name: 'Hạ tầng', href: '/warehouses', icon: Warehouse, requiredPermission: 'warehouse.view' },
            { id: 'warehouse_map', name: 'Sơ đồ kho', href: '/warehouses/map', icon: Map, requiredPermission: 'warehousemap.manage' },
            { id: 'warehouse_status', name: 'Trạng thái kho', href: '/warehouses/status', icon: BarChart3, requiredPermission: 'warehouse.view' },
            { id: 'lots', name: 'Quản lý LOT', href: '/warehouses/lots', icon: Boxes, requiredPermission: 'inventory.view' },
            { id: 'audit', name: 'Kiểm kê', href: '/operations/audit', icon: ClipboardCheck, requiredPermission: 'inventory.manage' },
            { id: 'notes', name: 'Ghi chú vận hành', href: '/operations/notes', icon: StickyNote, requiredPermission: 'warehouse.view' },
        ]
    },
    {
        id: 'qr_scan_parent',
        name: 'Quét mã QR',
        icon: QrCode,
        requiredModule: 'utility_qr_assign',
        children: [
            { id: 'qr_assign', name: 'Gán vị trí', href: '/warehouses/scan/assign', icon: MapPin, requiredPermission: 'utility.view' },
            { id: 'qr_export', name: 'Xuất kho', href: '/warehouses/scan/export', icon: ArrowUpFromLine, requiredPermission: 'utility.view' },
        ]
    },
    {
        id: 'construction_cat',
        name: 'Cấp phát hàng hóa',
        icon: HardHat,
        requiredModule: 'site_inventory_manager', // Matches Utility Module ID
        children: [
            { id: 'construction_overview', name: 'Tổng quan', href: '/construction', icon: LayoutDashboard, requiredPermission: 'site_inventory.view' },
            { id: 'site_inventory', name: 'Cấp phát', href: '/site-inventory', icon: ClipboardCheck, requiredPermission: 'site_inventory.view' },
        ]
    },
    {
        id: 'accounting_cat',
        name: 'Kế toán',
        icon: FileText,
        children: [
            { id: 'inbound', name: 'Nhập kho', href: '/inbound', icon: ArrowDownToLine, requiredPermission: 'inventory.manage' },
            { id: 'outbound', name: 'Xuất kho', href: '/outbound', icon: ArrowUpFromLine, requiredPermission: 'inventory.manage' },
        ]
    },
    {
        id: 'reports_cat',
        name: 'Báo cáo',
        icon: BarChart3,
        children: [
            { id: 'inventory_report', name: 'Tồn kho', href: '/inventory', icon: Package, requiredPermission: 'inventory.view' },
            { id: 'history', name: 'Lịch sử thao tác', href: '/operation-history', icon: Activity, requiredPermission: 'report.view' },
            { id: 'customer_docs', name: 'Chứng từ khách hàng', href: '/reports/customer-docs', icon: FileText, requiredPermission: 'report.view' },
            { id: 'supplier_debts', name: 'Công nợ NCC', href: '/reports/supplier-debts', icon: DollarSign, requiredPermission: 'report.view' },
            { id: 'accounting_history', name: 'Nhật ký xuất nhập', href: '/reports/accounting-history', icon: ArrowRightLeft, requiredPermission: 'report.view' },
            { id: 'lot_history', name: 'Nhật ký xuất nhập LOT', href: '/reports/lot-history', icon: History, requiredPermission: 'report.view' },
            { id: 'linked_journal', name: 'Nhật ký liên kết', href: '/reports/linked-journal', icon: ArrowRightLeft, requiredPermission: 'report.view' },
        ]
    },
    {
        id: 'users_cat',
        name: 'Người dùng',
        icon: Shield,
        children: [
            { id: 'users_list', name: 'Người dùng', href: '/users', icon: Shield },
            { id: 'roles', name: 'Vai trò', href: '/users/roles', icon: BookUser },
            { id: 'permissions', name: 'Phân quyền', href: '/users/permissions', icon: Key },
        ]
    },
    { id: 'settings', name: 'Cài đặt', href: '/settings', icon: Settings },
]

type CompanyInfo = {
    name: string
    logo_url: string | null
}

export default function Sidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const { isCollapsed, setCollapsed, isReady, isMobileMenuOpen, setMobileMenuOpen } = useSidebar()
    const { currentSystem, systemType } = useSystem()
    const { profile, toggleFavorite, checkSubscription } = useUser() // Get checkSubscription
    const [expandedMenus, setExpandedMenus] = useState<string[]>([])
    const isInitialized = useRef(false)
    const lastExpandedPathRef = useRef<string>('')

    const [openSubMenus, setOpenSubMenus] = useState<string[]>([])
    const sidebarRef = useRef<HTMLElement>(null)
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({ name: 'Toàn Thắng', logo_url: null })

    // Utility helper
    const isUtilityEnabled = (utilityId: string) => {
        if (!currentSystem?.modules) return false
        const modules = typeof currentSystem.modules === 'string'
            ? JSON.parse(currentSystem.modules)
            : currentSystem.modules
        return Array.isArray(modules?.utility_modules) && modules.utility_modules.includes(utilityId)
    }

    const isLotSyncEnabled = isUtilityEnabled('lot_accounting_sync')

    // Filter menu items based on hidden_menus from profile (System Specific) and Utility Modules
    const visibleMenuItems = useMemo(() => {
        // Use account_level for simple role checking
        // Level 1 = Super Admin, Level 2 = Company Admin, Level 3 = Employee
        const accountLevel = profile?.account_level ?? 3
        const isSuperUser = profile?.email === 'tungdibui2609@gmail.com'
        const userPermissions = profile?.permissions || []

        // Level 1 (Super Admin) and Level 2 (Company Admin) can see admin menus
        const canAccessAdminMenus = isSuperUser || accountLevel <= 2

        // Helper: Check if user has specific permission (or is Admin)
        const hasPermission = (code?: string) => {
            if (canAccessAdminMenus) return true // Admins have broad access
            if (!code) return true // No permission required
            return userPermissions.includes(code) || userPermissions.includes('system.full_access')
        }

        return menuItems.map(item => {
            // 1. Check Commercial Subscription
            if (item.requiredModule && !checkSubscription(item.requiredModule)) {
                return null
            }

            // Check Admin Menu Restriction
            if ((item.name === 'Người dùng' || item.name === 'Cài đặt') && !canAccessAdminMenus) {
                return null
            }
            if (item.id === 'construction_cat' && !isUtilityEnabled('site_inventory_manager')) {
                return null
            }
            // Check Item Permission
            if (item.requiredPermission && !hasPermission(item.requiredPermission)) {
                return null
            }

            // Merge System-wide hidden menus AND User-specific hidden menus
            const systemHidden = currentSystem?.hidden_menus || []
            const userHidden = profile?.hidden_menus?.[systemType] || []
            const allHidden = [...new Set([...systemHidden, ...userHidden])]

            // If parent is hidden, don't show
            if (allHidden.includes(item.id) || allHidden.includes(item.name)) return null

            // Filter children
            if (item.children) {
                const visibleChildren = item.children.filter(child => {
                    // Check subscription for child
                    if (child.requiredModule && !checkSubscription(child.requiredModule)) return false

                    // Check Utility Module Gating for children with requiredModule
                    if (child.requiredModule && !isUtilityEnabled(child.requiredModule)) return false

                    // Check all hidden menus (both system and user)
                    if (allHidden.includes(child.id) || allHidden.includes(child.name)) return false

                    // Check Permission
                    if (child.requiredPermission && !hasPermission(child.requiredPermission)) return false

                    // Check Utility Module Gating
                    if (child.name === 'Nhật ký liên kết' && !isLotSyncEnabled) return false

                    return true
                })
                if (visibleChildren.length === 0) return null // Hide parent if all children hidden
                return { ...item, children: visibleChildren }
            }

            return item
        }).filter(Boolean) as MenuItem[] // Remove nulls
    }, [profile, systemType, currentSystem, isLotSyncEnabled, checkSubscription])

    // Favorites Logic
    const favoriteItems = useMemo(() => {
        const favHrefs = profile?.favorite_menus || []
        if (favHrefs.length === 0) return []

        const allFlatItems: { name: string; href: string; icon: any }[] = []
        visibleMenuItems.forEach(item => {
            if (item.href) {
                allFlatItems.push({ name: item.name, href: item.href, icon: item.icon })
            }
            if (item.children) {
                item.children.forEach(child => {
                    if (child.href) {
                        allFlatItems.push({ name: child.name, href: child.href, icon: child.icon })
                    }
                })
            }
        })

        return allFlatItems.filter(item => favHrefs.includes(item.href))
    }, [profile?.favorite_menus, visibleMenuItems])


    const isMenuActive = (item: MenuItem) => {
        if (item.href) {
            return pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
        }
        if (item.children) {
            return item.children.some(child =>
                child.href ? (pathname === child.href || pathname.startsWith(child.href)) : false
            )
        }
        return false
    }

    // Collapsed state logic for rendering
    const showCollapsed = !isReady || (isCollapsed && !isMobileMenuOpen)
    const showExpanded = isReady && (!isCollapsed || isMobileMenuOpen)

    // Load expanded menus from localStorage on mount
    useEffect(() => {
        if (!isReady) return
        const saved = localStorage.getItem('sidebar_expanded_menus')
        if (saved) {
            try {
                setExpandedMenus(JSON.parse(saved))
            } catch (e) {
                console.error('Failed to parse sidebar_expanded_menus', e)
            }
        }
        isInitialized.current = true
    }, [isReady])

    // Auto-expand the menu containing the active page on navigation
    useEffect(() => {
        if (!isReady || pathname === lastExpandedPathRef.current) return

        const activeItem = visibleMenuItems.find(item => isMenuActive(item))
        if (activeItem && activeItem.children) {
            setExpandedMenus(prev => {
                if (prev.includes(activeItem.name)) return prev
                return [...prev, activeItem.name]
            })
            // Update ref to avoid expansion on same path
            lastExpandedPathRef.current = pathname
        }
    }, [pathname, isReady, visibleMenuItems])

    // Save expanded menus to localStorage when they change
    useEffect(() => {
        if (isInitialized.current) {
            localStorage.setItem('sidebar_expanded_menus', JSON.stringify(expandedMenus))
        }
    }, [expandedMenus])

    // Fetch company info
    useEffect(() => {
        const companyId = profile?.company_id
        if (!companyId) return

        async function fetchCompanyInfo() {
            const { data } = await supabase
                .from('company_settings')
                .select('name, short_name, logo_url')
                .eq('id', companyId!)
                .single()

            if (data) {
                const info = data as any
                setCompanyInfo({
                    name: info.short_name || info.name,
                    logo_url: info.logo_url ? `${info.logo_url}?t=${new Date().getTime()}` : null
                })
            }
        }
        fetchCompanyInfo()

        // Subscribe to changes
        const channel = supabase
            .channel(`company_settings_${companyId}`)
            .on('postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'company_settings',
                    filter: `id=eq.${companyId}`
                },
                payload => {
                    const newData = payload.new as any
                    setCompanyInfo({
                        name: newData.short_name || newData.name,
                        logo_url: newData.logo_url ? `${newData.logo_url}?t=${new Date().getTime()}` : null
                    })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [profile?.company_id])

    // Click outside to collapse (Desktop) or close (Mobile)
    useEffect(() => {
        if (!isReady) return

        function handleClickOutside(event: MouseEvent) {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
                // Desktop: Auto collapse if expanded (optional, keeping existing behavior)
                // Actually, existing behavior was to collapse on click outside.
                if (window.innerWidth >= 768) {
                    if (!isCollapsed) {
                        setCollapsed(true)
                    }
                } else {
                    // Mobile: Close menu if open (handled by backdrop usually, but good fallback)
                    if (isMobileMenuOpen) {
                        setMobileMenuOpen(false)
                    }
                }
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isCollapsed, setCollapsed, isReady, isMobileMenuOpen, setMobileMenuOpen])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    const toggleMenu = (menuName: string) => {
        setExpandedMenus(prev =>
            prev.includes(menuName)
                ? prev.filter(m => m !== menuName)
                : [...prev, menuName]
        )
    }

    const handleMenuClick = () => {
        // Desktop: Expand if collapsed
        if (isCollapsed && window.innerWidth >= 768) {
            setCollapsed(false)
        }
    }

    const handleLinkClick = () => {
        handleMenuClick()
        // Mobile: Close menu on link click
        if (window.innerWidth < 768) {
            setMobileMenuOpen(false)
        }
    }


    // Use consistent initial width for SSR.
    // Desktop: md:w-16 or md:w-56
    // Mobile: w-[280px] fixed
    const sidebarDesktopWidth = isReady ? (isCollapsed ? 'md:w-16' : 'md:w-56') : 'md:w-16'

    return (
        <>
            {/* Mobile Backdrop */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden animate-fade-in"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            <aside
                ref={sidebarRef}
                className={`fixed left-0 top-0 z-50 h-screen flex flex-col bg-white border-r border-stone-200 transition-all duration-300
                    w-[280px] ${sidebarDesktopWidth}
                    ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
                `}
                style={{
                    boxShadow: '4px 0 15px rgba(0, 0, 0, 0.03)',
                }}
            >
                {/* LOGO AREA */}
                <div
                    className="h-14 flex items-center justify-between px-3 border-b border-stone-100 cursor-pointer"
                    style={{
                        background: 'linear-gradient(180deg, rgba(249, 115, 22, 0.03) 0%, transparent 100%)',
                    }}
                    onClick={handleMenuClick}
                >
                    <div className={`relative flex items-center gap-2 ${(!isReady || (isCollapsed && !isMobileMenuOpen)) ? 'justify-center w-full' : ''}`}>
                        <div
                            className="relative w-9 h-9 rounded-lg overflow-hidden flex-shrink-0"
                            style={{
                                background: companyInfo.logo_url ? 'transparent' : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                                boxShadow: '0 2px 8px rgba(249, 115, 22, 0.3)',
                            }}
                        >
                            <Image
                                src={companyInfo.logo_url || "/logoanywarehouse.png"}
                                alt={companyInfo.name}
                                fill
                                sizes="36px"
                                className="object-contain p-1"
                            />
                        </div>
                        {isReady && (!isCollapsed || isMobileMenuOpen) && (
                            <div>
                                <h1 className="font-bold text-sm text-stone-800 tracking-tight truncate max-w-[150px]">{companyInfo.name}</h1>
                                <p className="text-[10px] font-semibold text-orange-600">{currentSystem?.name || '...'}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* NAVIGATION */}
                <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
                    {/* Quick Access Section */}
                    {favoriteItems.length > 0 && (
                        <div className="mb-4">
                            <div className={`px-3 mb-1 flex items-center gap-2 ${showCollapsed ? 'hidden' : ''}`}>
                                <Star size={12} className="text-orange-500 fill-orange-500" />
                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Quick Access</span>
                            </div>
                            <div className="space-y-0.5">
                                {favoriteItems.map((item) => {
                                    const Icon = item.icon
                                    const isActive = item.href ? pathname === item.href : false

                                    if (!item.href) return null

                                    return (
                                        <Link
                                            key={`fav-${item.href}`}
                                            href={item.href}
                                            onClick={handleLinkClick}
                                            className={`group relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all duration-200 ${isActive
                                                ? 'text-white'
                                                : 'text-stone-600 hover:text-orange-600 hover:bg-orange-50'
                                                } ${showCollapsed ? 'justify-center px-2' : ''}`}
                                            style={isActive ? {
                                                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                                                boxShadow: '0 2px 8px rgba(249, 115, 22, 0.3)',
                                            } : {}}
                                            title={showCollapsed ? item.name : undefined}
                                        >
                                            <div className={`p-1 rounded transition-all duration-200 ${isActive
                                                ? 'bg-white/20'
                                                : 'bg-stone-100 group-hover:bg-orange-100'
                                                }`}>
                                                <Icon size={14} strokeWidth={isActive ? 2.5 : 2} />
                                            </div>
                                            {!showCollapsed && <span className="text-xs font-medium truncate flex-1">{item.name}</span>}
                                        </Link>
                                    )
                                })}
                            </div>
                            {!showCollapsed && <div className="mx-3 mt-2 border-b border-stone-100" />}
                        </div>
                    )}

                    {visibleMenuItems.map((item) => {
                        const Icon = item.icon
                        const hasChildren = item.children && item.children.length > 0
                        const isExpanded = expandedMenus.includes(item.name) && showExpanded
                        const isActive = isMenuActive(item)

                        // Parent menu with children
                        if (hasChildren) {
                            return (
                                <div key={item.name}>
                                    <button
                                        onClick={() => {
                                            handleMenuClick()
                                            if (showExpanded) toggleMenu(item.name)
                                        }}
                                        className={`group relative flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all duration-200 w-full ${isActive
                                            ? 'text-orange-600 bg-orange-50'
                                            : 'text-stone-600 hover:text-orange-600 hover:bg-orange-50'
                                            } ${showCollapsed ? 'justify-center px-2' : ''}`}
                                        title={showCollapsed ? item.name : undefined}
                                    >
                                        <div className={`p-1.5 rounded-md transition-all duration-200 ${isActive
                                            ? 'bg-orange-100'
                                            : 'bg-stone-100 group-hover:bg-orange-100'
                                            }`}>
                                            <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                                        </div>

                                        {showExpanded && (
                                            <>
                                                <span className="text-xs font-medium flex-1 text-left">{item.name}</span>
                                                {isExpanded ? (
                                                    <ChevronDown size={14} className="text-stone-400" />
                                                ) : (
                                                    <ChevronRight size={14} className="text-stone-400" />
                                                )}
                                            </>
                                        )}
                                    </button>

                                    {/* Sub-menu */}
                                    {isExpanded && (
                                        <div className="ml-3 mt-0.5 space-y-0.5 border-l border-stone-100 pl-2">
                                            {item.children!.map((child) => {
                                                const ChildIcon = child.icon
                                                // Ensure href exists before using it
                                                if (!child.href) return null

                                                const isChildActive = pathname === child.href || (child.href !== '/warehouses' && pathname.startsWith(child.href + '/'))

                                                return (
                                                    <Link
                                                        key={child.href}
                                                        href={child.href}
                                                        onClick={handleLinkClick}
                                                        className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-all duration-200 ${isChildActive
                                                            ? 'text-white'
                                                            : 'text-stone-600 hover:text-orange-600 hover:bg-orange-50'
                                                            }`}
                                                        style={isChildActive ? {
                                                            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                                                            boxShadow: '0 2px 8px rgba(249, 115, 22, 0.3)',
                                                        } : {}}
                                                    >
                                                        <div className={`p-1 rounded transition-all duration-200 ${isChildActive
                                                            ? 'bg-white/20'
                                                            : 'bg-stone-100 group-hover:bg-orange-100'
                                                            }`}>
                                                            <ChildIcon size={14} strokeWidth={isChildActive ? 2.5 : 2} />
                                                        </div>
                                                        <span className="text-xs font-medium flex-1">{child.name}</span>
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault()
                                                                e.stopPropagation()
                                                                toggleFavorite(child.href!)
                                                            }}
                                                            className={`p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity ${profile?.favorite_menus?.includes(child.href)
                                                                ? 'text-yellow-500 opacity-100'
                                                                : 'text-stone-300 hover:text-orange-400'
                                                                }`}
                                                        >
                                                            <Star size={12} fill={profile?.favorite_menus?.includes(child.href) ? "currentColor" : "none"} />
                                                        </button>
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )
                        }

                        // Regular menu item
                        if (!item.href) return null // Skip if no href for leaf item

                        const isItemActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={handleLinkClick}
                                className={`group relative flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all duration-200 ${isItemActive
                                    ? 'text-white'
                                    : 'text-stone-600 hover:text-orange-600 hover:bg-orange-50'
                                    } ${showCollapsed ? 'justify-center px-2' : ''}`}
                                style={isItemActive ? {
                                    background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                                    boxShadow: '0 2px 8px rgba(249, 115, 22, 0.3)',
                                } : {}}
                                title={showCollapsed ? item.name : undefined}
                            >
                                {/* Active indicator bar */}
                                {isItemActive && showExpanded && (
                                    <div
                                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full bg-orange-400"
                                        style={{
                                            boxShadow: '0 0 6px rgba(249, 115, 22, 0.5)',
                                        }}
                                    />
                                )}

                                <div className={`p-1.5 rounded-md transition-all duration-200 ${isItemActive
                                    ? 'bg-white/20'
                                    : 'bg-stone-100 group-hover:bg-orange-100'
                                    }`}>
                                    <Icon size={16} strokeWidth={isItemActive ? 2.5 : 2} />
                                </div>

                                {showExpanded && (
                                    <>
                                        <span className="text-xs font-medium flex-1">{item.name}</span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault()
                                                    e.stopPropagation()
                                                    toggleFavorite(item.href!)
                                                }}
                                                className={`p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity ${profile?.favorite_menus?.includes(item.href)
                                                    ? 'text-yellow-500 opacity-100'
                                                    : 'text-stone-300 hover:text-orange-400'
                                                    }`}
                                            >
                                                <Star size={12} fill={profile?.favorite_menus?.includes(item.href) ? "currentColor" : "none"} />
                                            </button>
                                            <ChevronRight
                                                size={14}
                                                className={`transition-all duration-200 ${isItemActive
                                                    ? 'opacity-100 text-white/70'
                                                    : 'opacity-0 group-hover:opacity-50 -translate-x-2 group-hover:translate-x-0'
                                                    }`}
                                            />
                                        </div>
                                    </>
                                )}
                            </Link>
                        )
                    })}
                    {/* SUPER ADMIN LINK */}
                    {profile?.email === 'tungdibui2609@gmail.com' && (
                        <div className="mt-4 pt-4 border-t border-stone-100 dark:border-zinc-800">
                            <Link
                                href="/admin/companies"
                                onClick={handleLinkClick}
                                className={`group relative flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all duration-200 text-stone-600 hover:text-orange-600 hover:bg-orange-50 ${showCollapsed ? 'justify-center px-2' : ''}`}
                                title={showCollapsed ? 'Super Admin' : undefined}
                            >
                                <div className="p-1.5 rounded-md bg-stone-100 group-hover:bg-orange-100 transition-colors">
                                    <ShieldAlert size={16} />
                                </div>
                                {showExpanded && <span className="text-xs font-bold text-orange-600 flex-1">Super Admin</span>}
                            </Link>
                        </div>
                    )}

                </nav>

                {/* FOOTER / LOGOUT */}
                <div className="p-2 border-t border-stone-100">
                    <button
                        onClick={handleLogout}
                        className={`group flex items-center gap-2 w-full px-2.5 py-2 rounded-lg transition-all duration-200 text-stone-500 hover:text-red-600 hover:bg-red-50 ${(!isReady || (isCollapsed && !isMobileMenuOpen)) ? 'justify-center px-2' : ''
                            }`}
                        title={(!isReady || (isCollapsed && !isMobileMenuOpen)) ? 'Đăng xuất' : undefined}
                    >
                        <div className="p-1.5 rounded-md bg-stone-100 group-hover:bg-red-100 transition-colors">
                            <LogOut size={16} />
                        </div>
                        {isReady && (!isCollapsed || isMobileMenuOpen) && <span className="text-xs font-medium">Đăng xuất</span>}
                    </button>
                </div>
            </aside>
        </>
    )
}
