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
    roles: { name: string } | null
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
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const fetchProfile = async () => {
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser()
            setUser(authUser)

            if (authUser) {
                const { data, error } = await supabase
                    .from('user_profiles')
                    .select('id, full_name, email, avatar_url, permissions, blocked_routes, hidden_menus, favorite_menus, allowed_systems, company_id, roles(name)')
                    .eq('id', authUser.id)
                    .eq('id', authUser.id)
                    .limit(1)

                if (!error && data && data.length > 0) {
                    setProfile(data[0] as any)
                } else {
                    setProfile(null)
                }
            } else {
                setProfile(null)
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
        // Check both profile email and auth user email to be sure
        if (profile?.email === 'tungdibui2609@gmail.com' || user?.email === 'tungdibui2609@gmail.com') {
            return true
        }

        // PERMISSION LOGIC:
        // 1. If no profile, false
        // 2. If permissions array contains specific code, true.
        if (!profile || !profile.permissions) return false

        // Check for FULL ACCESS wildcard
        if (profile.permissions.includes('system.full_access')) return true

        // Check exact match
        return profile.permissions.includes(permissionCode)
    }

    const isRouteBlocked = (path: string): boolean => {
        // SUPERUSER BYPASS
        if (profile?.email === 'tungdibui2609@gmail.com' || user?.email === 'tungdibui2609@gmail.com') {
            return false
        }

        if (!profile || !profile.blocked_routes) return false

        // Exact match or sub-path match?
        // User asked to block "Page". Usually blocking '/products' should block '/products/new' too.
        // Let's implement prefix checking for better security.
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
                // Optimistic update
                setProfile(prev => prev ? { ...prev, ...updates } : null)
                // Or re-fetch
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

    return (
        <UserContext.Provider value={{
            user, profile, isLoading, hasPermission, isRouteBlocked,
            refreshProfile: fetchProfile, updateProfileSettings, toggleFavorite
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
