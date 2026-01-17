'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { LayoutDashboard, Package, Settings, LogOut, Warehouse, ChevronRight, ChevronDown, Building2, Car, List, FolderTree, Map, ArrowDownToLine, ArrowUpFromLine, Boxes, ClipboardCheck, Users, BookUser, Shield, BarChart3, History, FileText, TrendingUp, AlertTriangle, PackageSearch, DollarSign, PieChart } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { useSidebar } from './SidebarContext'

type MenuItem = {
    name: string
    href?: string
    icon: any
    children?: { name: string; href: string; icon: any }[]
}

const menuItems: MenuItem[] = [
    { name: 'Tổng quan', href: '/', icon: LayoutDashboard },
    {
        name: 'Quản lý sản phẩm',
        icon: Package,
        children: [
            { name: 'Sản phẩm', href: '/products', icon: List },
            { name: 'Danh mục', href: '/categories', icon: FolderTree },
        ]
    },
    {
        name: 'Quản lý thông tin',
        icon: BookUser,
        children: [
            { name: 'Nhà cung cấp', href: '/suppliers', icon: Building2 },
            { name: 'Dòng xe', href: '/vehicles', icon: Car },
            { name: 'Khách hàng', href: '/customers', icon: Users },
        ]
    },
    {
        name: 'Quản lý Kho',
        icon: Warehouse,
        children: [
            { name: 'Hạ tầng', href: '/warehouses', icon: Warehouse },
            { name: 'Sơ đồ kho', href: '/warehouses/map', icon: Map },
            { name: 'Quản lý LOT', href: '/warehouses/lots', icon: Boxes }, // Using Boxes or Barcode/Tags if imported
            { name: 'Nhập kho (KT)', href: '/inbound', icon: ArrowDownToLine },
            { name: 'Xuất kho (KT)', href: '/outbound', icon: ArrowUpFromLine },
            { name: 'Tồn kho', href: '/inventory', icon: Package },
            { name: 'Kiểm kê', href: '/operations/audit', icon: ClipboardCheck },
        ]
    },
    {
        name: 'Báo cáo',
        icon: BarChart3,
        children: [
            { name: 'Chứng từ khách hàng', href: '/reports/customer-docs', icon: FileText },
            { name: 'Công nợ NCC', href: '/reports/supplier-debts', icon: DollarSign },
        ]
    },
    { name: 'Người dùng', href: '/users', icon: Shield },
    { name: 'Cài đặt', href: '/settings', icon: Settings },
]

type CompanyInfo = {
    name: string
    logo_url: string | null
}

export default function Sidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const { isCollapsed, setCollapsed, isReady } = useSidebar()
    const [expandedMenus, setExpandedMenus] = useState<string[]>(['Quản lý sản phẩm'])
    const sidebarRef = useRef<HTMLElement>(null)
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({ name: 'Toàn Thắng', logo_url: null })

    // Fetch company info
    useEffect(() => {
        async function fetchCompanyInfo() {
            const { data } = await supabase
                .from('company_settings')
                .select('name, short_name, logo_url')
                .limit(1)
                .single()

            if (data) {
                const info = data as any
                setCompanyInfo({
                    name: info.short_name || info.name,
                    logo_url: info.logo_url
                })
            }
        }
        fetchCompanyInfo()

        // Subscribe to changes (optional, but good for immediate updates)
        const channel = supabase
            .channel('company_settings_changes')
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'company_settings' },
                payload => {
                    const newData = payload.new as any
                    setCompanyInfo({
                        name: newData.short_name || newData.name,
                        logo_url: newData.logo_url
                    })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    // Click outside to collapse
    useEffect(() => {
        if (!isReady) return

        function handleClickOutside(event: MouseEvent) {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
                if (!isCollapsed) {
                    setCollapsed(true)
                }
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isCollapsed, setCollapsed, isReady])

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
        if (isCollapsed) {
            setCollapsed(false)
        }
    }

    const isMenuActive = (item: MenuItem) => {
        if (item.href) {
            return pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
        }
        if (item.children) {
            return item.children.some(child =>
                pathname === child.href || pathname.startsWith(child.href)
            )
        }
        return false
    }

    // Use consistent initial width for SSR
    const sidebarWidth = isReady ? (isCollapsed ? 'w-16' : 'w-56') : 'w-16'

    return (
        <aside
            ref={sidebarRef}
            className={`fixed left-0 top-0 z-50 h-screen flex flex-col bg-white border-r border-stone-200 transition-all duration-300 ${sidebarWidth}`}
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
                <div className={`relative flex items-center gap-2 ${(!isReady || isCollapsed) ? 'justify-center w-full' : ''}`}>
                    <div
                        className="relative w-9 h-9 rounded-lg overflow-hidden flex-shrink-0"
                        style={{
                            background: companyInfo.logo_url ? 'transparent' : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                            boxShadow: '0 2px 8px rgba(249, 115, 22, 0.3)',
                        }}
                    >
                        <Image
                            src={companyInfo.logo_url || "/logotoanthang.png"}
                            alt={companyInfo.name}
                            fill
                            className="object-contain p-1"
                        />
                    </div>
                    {isReady && !isCollapsed && (
                        <div>
                            <h1 className="font-bold text-sm text-stone-800 tracking-tight truncate max-w-[150px]">{companyInfo.name}</h1>
                            <p className="text-[10px] text-stone-500">Quản lý Kho</p>
                        </div>
                    )}
                </div>
            </div>

            {/* NAVIGATION */}
            <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
                {menuItems.map((item) => {
                    const Icon = item.icon
                    const hasChildren = item.children && item.children.length > 0
                    const showExpanded = isReady && !isCollapsed
                    const isExpanded = expandedMenus.includes(item.name) && showExpanded
                    const isActive = isMenuActive(item)
                    const showCollapsed = !isReady || isCollapsed

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
                                            const isChildActive = pathname === child.href || (child.href !== '/warehouses' && pathname.startsWith(child.href + '/'))

                                            return (
                                                <Link
                                                    key={child.href}
                                                    href={child.href}
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
                                                    <span className="text-xs font-medium">{child.name}</span>
                                                </Link>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )
                    }

                    // Regular menu item
                    const isItemActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href!))
                    return (
                        <Link
                            key={item.href}
                            href={item.href!}
                            onClick={handleMenuClick}
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
                                    <ChevronRight
                                        size={14}
                                        className={`transition-all duration-200 ${isItemActive
                                            ? 'opacity-100 text-white/70'
                                            : 'opacity-0 group-hover:opacity-50 -translate-x-2 group-hover:translate-x-0'
                                            }`}
                                    />
                                </>
                            )}
                        </Link>
                    )
                })}
            </nav>

            {/* FOOTER / LOGOUT */}
            <div className="p-2 border-t border-stone-100">
                <button
                    onClick={handleLogout}
                    className={`group flex items-center gap-2 w-full px-2.5 py-2 rounded-lg transition-all duration-200 text-stone-500 hover:text-red-600 hover:bg-red-50 ${(!isReady || isCollapsed) ? 'justify-center px-2' : ''
                        }`}
                    title={(!isReady || isCollapsed) ? 'Đăng xuất' : undefined}
                >
                    <div className="p-1.5 rounded-md bg-stone-100 group-hover:bg-red-100 transition-colors">
                        <LogOut size={16} />
                    </div>
                    {isReady && !isCollapsed && <span className="text-xs font-medium">Đăng xuất</span>}
                </button>
            </div>
        </aside>
    )
}
