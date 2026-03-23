'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { User } from '@supabase/supabase-js'
import { APP_ROUTES, RouteItem } from '@/config/routes'

type UserProfile = {
    id: string
    full_name: string
    email: string | null
    avatar_url: string | null
    permissions: string[] | null
    blocked_routes: string[] | null
    hidden_menus: Record<string, string[]> | null
    favorite_menus: string[] | null
    allowed_systems: string[] | null
    company_id: string | null
    company_name: string | null // [NEW]
    department: string | null
    roles: { name: string; code: string } | null
    account_level: number | null // 1=Super Admin, 2=Company Admin, 3=Employee
}

interface UserContextType {
    user: User | null
    profile: UserProfile | null
    isLoading: boolean
    hasPermission: (permissionCode: string) => boolean
    isRouteBlocked: (path: string) => boolean
    refreshProfile: () => Promise<void>
    updateProfileSettings: (updates: Partial<UserProfile>) => Promise<void>
    toggleFavorite: (menuHref: string) => Promise<void>
    checkSubscription: (moduleCode: string) => boolean
    activeModules: string[] // [NEW] Expose raw modules for usage in other contexts
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [activeModules, setActiveModules] = useState<string[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const fetchProfile = async () => {
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser()
            setUser(authUser)

            if (authUser) {
                // 1. Fetch Profile
                const { data, error } = await supabase
                    .from('user_profiles')
                    .select('*, roles(name, code)') // Select all to be safe + roles
                    .eq('id', authUser.id)
                    .single()

                if (!error && data) {
                    const profileData = data as any
                    setProfile(profileData)

                    // 2. Fetch Company Unlocked Modules
                    if (profileData.company_id) {
                        const { data: cData, error: companyError } = await supabase
                            .from('companies')
                            .select('name, unlocked_modules') // Fetch name
                            .eq('id', profileData.company_id)
                            .single()

                        const companyData = cData as any

                        if (!companyError && companyData) {
                            // Update profile with company name
                            setProfile(prev => prev ? { ...prev, company_name: companyData.name } : null)
                            
                            if (authUser.email === 'tungdibui2609@gmail.com') {
                                const allModules = [
                                    'inbound_basic', 'inbound_supplier', 'inbound_type', 'inbound_financials', 'inbound_documents', 'inbound_logistics', 'inbound_images', 'inbound_accounting', 'inbound_ui_compact', 'inbound_conversion',
                                    'outbound_basic', 'outbound_customer', 'outbound_type', 'outbound_financials', 'outbound_images', 'outbound_logistics', 'outbound_documents', 'outbound_accounting', 'outbound_ui_compact', 'outbound_conversion',
                                    'pricing', 'qc_basic', 'qc_advanced', 'variants', 'units', 'stock_v2', 'lots',
                                    'production_code', 'raw_material_date', 'batch_code', 'qc_info', 'supplier_info',
                                    'extra_info', 'peeling_date', 'packaging_date', 'internal_products', 'images', 'warehouse_name'
                                ]
                                setActiveModules(Array.from(new Set([...(companyData.unlocked_modules || []), ...allModules])))
                            } else {
                                setActiveModules(companyData.unlocked_modules || [])
                            }
                        } else {
                            // SUPERUSER BYPASS even if company fetch fails
                            if (authUser.email === 'tungdibui2609@gmail.com') {
                                const allModules = [
                                    'inbound_basic', 'inbound_supplier', 'inbound_type', 'inbound_financials', 'inbound_documents', 'inbound_logistics', 'inbound_images', 'inbound_accounting', 'inbound_ui_compact', 'inbound_conversion',
                                    'outbound_basic', 'outbound_customer', 'outbound_type', 'outbound_financials', 'outbound_images', 'outbound_logistics', 'outbound_documents', 'outbound_accounting', 'outbound_ui_compact', 'outbound_conversion',
                                    'pricing', 'qc_basic', 'qc_advanced', 'variants', 'units', 'stock_v2', 'lots',
                                    'production_code', 'raw_material_date', 'batch_code', 'qc_info', 'supplier_info',
                                    'extra_info', 'peeling_date', 'packaging_date', 'internal_products', 'images', 'warehouse_name'
                                ]
                                setActiveModules(allModules)
                            } else {
                                if (companyError) {
                                    console.error('Error fetching company modules:', companyError.message || companyError)
                                }
                                setActiveModules([])
                            }
                        }
                    }
                } else {
                    setProfile(null)
                    setActiveModules([])
                }
            } else {
                setProfile(null)
                setActiveModules([])
            }
        } catch (error) {
            console.error('Error fetching user profile:', error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchProfile()

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            fetchProfile()
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    const hasPermission = (permissionCode: string): boolean => {
        // SUPERUSER BYPASS
        if (profile?.email === 'tungdibui2609@gmail.com' || user?.email === 'tungdibui2609@gmail.com') {
            return true
        }

        // LEVEL 1 & 2 BYPASS (Super Admin & Company Admin)
        if (profile?.account_level === 1 || profile?.account_level === 2) {
            return true
        }

        if (!profile || !profile.permissions) return false

        // Check for FULL ACCESS wildcard
        if (profile.permissions.includes('system.full_access')) return true

        return profile.permissions.includes(permissionCode)
    }

    const isRouteBlocked = (path: string): boolean => {
        // SUPERUSER BYPASS
        if (profile?.email === 'tungdibui2609@gmail.com' || user?.email === 'tungdibui2609@gmail.com') {
            return false
        }

        // LEVEL 1 & 2 BYPASS (Super Admin & Company Admin)
        if (profile?.account_level === 1 || profile?.account_level === 2) {
            return false
        }

        if (!profile || !profile.blocked_routes) return false

        // 1. Get all explicit routes from config
        const getExplicitPaths = (items: RouteItem[]): string[] => {
            let paths: string[] = []
            items.forEach(item => {
                paths.push(item.path)
                if (item.children) {
                    paths = [...paths, ...getExplicitPaths(item.children)]
                }
            })
            return paths
        }
        const explicitPaths = getExplicitPaths(APP_ROUTES)

        // 2. If the current path is an explicit route, use EXACT match
        if (explicitPaths.includes(path)) {
            return profile.blocked_routes.includes(path)
        }

        // 3. For dynamic/sub-routes, find the LONGEST matching explicit base route
        const baseRoute = explicitPaths
            .filter(rp => path.startsWith(rp + '/'))
            .sort((a, b) => b.length - a.length)[0]

        if (baseRoute) {
            // If the base menu route is blocked, the sub-route is blocked
            return profile.blocked_routes.includes(baseRoute)
        }

        // 4. Default prefix check for any other unexpected patterns
        return profile.blocked_routes.some(blockedPath =>
            path === blockedPath || path.startsWith(blockedPath + '/')
        )
    }

    const updateProfileSettings = async (updates: Partial<UserProfile>) => {
        if (!user) return

        try {
            const { error } = await (supabase.from('user_profiles') as any)
                .update(updates)
                .eq('id', user.id)

            if (!error) {
                setProfile(prev => prev ? { ...prev, ...updates } : null)
                await fetchProfile()
            } else {
                console.error('Error updating profile:', error)
            }
        } catch (error) {
            console.error('Error in updateProfileSettings:', error)
        }
    }

    const toggleFavorite = async (menuHref: string) => {
        if (!profile) return

        const currentFavorites = profile.favorite_menus || []
        let newFavorites: string[]

        if (currentFavorites.includes(menuHref)) {
            newFavorites = currentFavorites.filter(h => h !== menuHref)
        } else {
            newFavorites = [...currentFavorites, menuHref]
        }

        await updateProfileSettings({ favorite_menus: newFavorites })
    }

    const checkSubscription = (moduleCode: string): boolean => {
        // SUPERUSER BYPASS
        if (profile?.email === 'tungdibui2609@gmail.com' || user?.email === 'tungdibui2609@gmail.com') {
            return true
        }
        return activeModules.includes(moduleCode)
    }

    return (
        <UserContext.Provider value={{
            user, profile, isLoading, hasPermission, isRouteBlocked,
            refreshProfile: fetchProfile, updateProfileSettings, toggleFavorite,
            checkSubscription,
            activeModules // [NEW]
        }}>
            {children}
        </UserContext.Provider>
    )
}

export function useUser() {
    const context = useContext(UserContext)
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider')
    }
    return context
}
