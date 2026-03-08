'use client'
import { useState, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { LayoutDashboard, Package, LogOut, ChevronRight, ChevronDown, List, FolderTree, Boxes, ShieldAlert, Users, Shield, Tag, PackageSearch, KanbanSquare, FileText, Settings } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { useSidebar } from './SidebarContext'
import { useUser } from '@/contexts/UserContext'

type MenuItem = {
    id: string
    name: string
    href?: string
    icon: any
    children?: MenuItem[]
}

const menuItems: MenuItem[] = [
    { id: 'overview', name: 'Tổng quan', href: '/sanxuat/dashboard', icon: LayoutDashboard },
    {
        id: 'products_cat',
        name: 'Dữ liệu dùng chung',
        icon: Package,
        children: [
            { id: 'products', name: 'Sản phẩm', href: '/sanxuat/products', icon: List },
            { id: 'internal_products', name: 'Sản phẩm nội bộ', href: '/sanxuat/internal-products', icon: PackageSearch },
            { id: 'categories', name: 'Danh mục', href: '/sanxuat/categories', icon: FolderTree },
            { id: 'lot_codes', name: 'Mã phụ', href: '/sanxuat/lot-codes', icon: Tag },
            { id: 'lots', name: 'Quản lý LOT', href: '/sanxuat/lots', icon: Boxes },
        ]
    },
    {
        id: 'core_manufacturing',
        name: 'Hoạt động Sản xuất',
        icon: KanbanSquare,
        children: [
            { id: 'boms', name: 'Định mức (BOM)', href: '/sanxuat/boms', icon: FileText },
            { id: 'manufacturing_orders', name: 'Lệnh sản xuất (MO)', href: '/sanxuat/mo', icon: Settings },
        ]
    },
    {
        id: 'users_cat',
        name: 'Người dùng',
        icon: Shield,
        children: [
            { id: 'users_list', name: 'Danh sách', href: '/sanxuat/users', icon: Users },
        ]
    }
]

type CompanyInfo = {
    name: string
    logo_url: string | null
}

export default function SanxuatSidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const { isCollapsed, setCollapsed, isReady, isMobileMenuOpen, setMobileMenuOpen } = useSidebar()
    const { profile } = useUser()
    const [expandedMenus, setExpandedMenus] = useState<string[]>([])
    const isInitialized = useRef(false)
    const lastExpandedPathRef = useRef<string>('')

    const sidebarRef = useRef<HTMLElement>(null)
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({ name: 'Hệ Thống', logo_url: null })

    const isMenuActive = (item: MenuItem) => {
        if (item.href) {
            return pathname === item.href || (item.href !== '/sanxuat/dashboard' && pathname.startsWith(item.href))
        }
        if (item.children) {
            return item.children.some(child =>
                child.href ? (pathname === child.href || pathname.startsWith(child.href)) : false
            )
        }
        return false
    }

    const showCollapsed = !isReady || (isCollapsed && !isMobileMenuOpen)
    const showExpanded = isReady && (!isCollapsed || isMobileMenuOpen)

    useEffect(() => {
        if (!isReady) return
        const saved = localStorage.getItem('sanxuat_sidebar_expanded')
        if (saved) {
            try {
                setExpandedMenus(JSON.parse(saved))
            } catch (e) {
                console.error('Failed to parse sanxuat_sidebar_expanded', e)
            }
        }
        isInitialized.current = true
    }, [isReady])

    useEffect(() => {
        if (!isReady || pathname === lastExpandedPathRef.current) return

        const activeItem = menuItems.find(item => isMenuActive(item))
        if (activeItem && activeItem.children) {
            setExpandedMenus(prev => {
                if (prev.includes(activeItem.name)) return prev
                return [...prev, activeItem.name]
            })
            lastExpandedPathRef.current = pathname
        }
    }, [pathname, isReady])

    useEffect(() => {
        if (isInitialized.current) {
            localStorage.setItem('sanxuat_sidebar_expanded', JSON.stringify(expandedMenus))
        }
    }, [expandedMenus])

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
    }, [profile?.company_id])

    useEffect(() => {
        if (!isReady) return
        function handleClickOutside(event: MouseEvent) {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
                if (window.innerWidth >= 768) {
                    if (!isCollapsed) {
                        setCollapsed(true)
                    }
                } else {
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
        router.push('/sanxuat/login')
    }

    const toggleMenu = (menuName: string) => {
        setExpandedMenus(prev =>
            prev.includes(menuName)
                ? prev.filter(m => m !== menuName)
                : [...prev, menuName]
        )
    }

    const handleMenuClick = () => {
        if (isCollapsed && window.innerWidth >= 768) {
            setCollapsed(false)
        }
    }

    const handleLinkClick = () => {
        handleMenuClick()
        if (window.innerWidth < 768) {
            setMobileMenuOpen(false)
        }
    }

    const sidebarDesktopWidth = isReady ? (isCollapsed ? 'md:w-16' : 'md:w-56') : 'md:w-16'

    return (
        <>
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
                        background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.03) 0%, transparent 100%)',
                    }}
                    onClick={handleMenuClick}
                >
                    <div className={`relative flex items-center gap-2 ${(!isReady || (isCollapsed && !isMobileMenuOpen)) ? 'justify-center w-full' : ''}`}>
                        <div
                            className="relative w-9 h-9 rounded-lg overflow-hidden flex-shrink-0"
                            style={{
                                background: companyInfo.logo_url ? 'transparent' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
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
                                <p className="text-[10px] font-semibold text-emerald-600">Sản Xuất</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* NAVIGATION */}
                <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
                    {menuItems.map((item) => {
                        const Icon = item.icon
                        const hasChildren = item.children && item.children.length > 0
                        const isExpanded = expandedMenus.includes(item.name) && showExpanded
                        const isActive = isMenuActive(item)

                        if (hasChildren) {
                            return (
                                <div key={item.name}>
                                    <button
                                        onClick={() => {
                                            handleMenuClick()
                                            if (showExpanded) toggleMenu(item.name)
                                        }}
                                        className={`group relative flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all duration-200 w-full ${isActive
                                            ? 'text-emerald-600 bg-emerald-50'
                                            : 'text-stone-600 hover:text-emerald-600 hover:bg-emerald-50'
                                            } ${showCollapsed ? 'justify-center px-2' : ''}`}
                                        title={showCollapsed ? item.name : undefined}
                                    >
                                        <div className={`p-1.5 rounded-md transition-all duration-200 ${isActive
                                            ? 'bg-emerald-100'
                                            : 'bg-stone-100 group-hover:bg-emerald-100'
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

                                    {isExpanded && (
                                        <div className="ml-3 mt-0.5 space-y-0.5 border-l border-stone-100 pl-2">
                                            {item.children!.map((child) => {
                                                const ChildIcon = child.icon
                                                if (!child.href) return null

                                                const isChildActive = pathname === child.href || pathname.startsWith(child.href + '/')

                                                return (
                                                    <Link
                                                        key={child.href}
                                                        href={child.href}
                                                        onClick={handleLinkClick}
                                                        className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-all duration-200 ${isChildActive
                                                            ? 'text-white'
                                                            : 'text-stone-600 hover:text-emerald-600 hover:bg-emerald-50'
                                                            }`}
                                                        style={isChildActive ? {
                                                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                                            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                                                        } : {}}
                                                    >
                                                        <div className={`p-1 rounded transition-all duration-200 ${isChildActive
                                                            ? 'bg-white/20'
                                                            : 'bg-stone-100 group-hover:bg-emerald-100'
                                                            }`}>
                                                            <ChildIcon size={14} strokeWidth={isChildActive ? 2.5 : 2} />
                                                        </div>
                                                        <span className="text-xs font-medium flex-1">{child.name}</span>
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )
                        }

                        if (!item.href) return null

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={handleLinkClick}
                                className={`group relative flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all duration-200 ${isActive
                                    ? 'text-white'
                                    : 'text-stone-600 hover:text-emerald-600 hover:bg-emerald-50'
                                    } ${showCollapsed ? 'justify-center px-2' : ''}`}
                                style={isActive ? {
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                                } : {}}
                                title={showCollapsed ? item.name : undefined}
                            >
                                {isActive && showExpanded && (
                                    <div
                                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full bg-emerald-400"
                                        style={{
                                            boxShadow: '0 0 6px rgba(16, 185, 129, 0.5)',
                                        }}
                                    />
                                )}

                                <div className={`p-1.5 rounded-md transition-all duration-200 ${isActive
                                    ? 'bg-white/20'
                                    : 'bg-stone-100 group-hover:bg-emerald-100'
                                    }`}>
                                    <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                                </div>

                                {showExpanded && (
                                    <span className="text-xs font-medium flex-1">{item.name}</span>
                                )}
                            </Link>
                        )
                    })}
                </nav>

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
