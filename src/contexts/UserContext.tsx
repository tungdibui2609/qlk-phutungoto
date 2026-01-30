'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { User } from '@supabase/supabase-js'

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
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    setProfile(data as any)

                    // 2. Fetch Company Unlocked Modules
                    if (data.company_id) {
                        const { data: companyData, error: companyError } = await supabase
                            .from('companies')
                            .select('unlocked_modules')
                            .eq('id', data.company_id)
                            .single()

                        if (!companyError && companyData) {
                            setActiveModules(companyData.unlocked_modules || [])
                        } else {
                            console.error('Error fetching company modules:', companyError)
                            setActiveModules([])
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
        if (!profile || !profile.blocked_routes) return false

        return profile.blocked_routes.some(blockedPath =>
            path === blockedPath || path.startsWith(blockedPath + '/')
        )
    }

    const updateProfileSettings = async (updates: Partial<UserProfile>) => {
        if (!user) return

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
