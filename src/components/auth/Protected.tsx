'use client'

import React from 'react'
import { useUser } from '@/contexts/UserContext'

interface ProtectedProps {
    permission: string
    children: React.ReactNode
    fallback?: React.ReactNode // What to show if permission denied (default: nothing)
}

export default function Protected({ permission, children, fallback = null }: ProtectedProps) {
    const { hasPermission, isLoading } = useUser()

    // While loading, we might want to show nothing or a skeleton. 
    // For now, let's show nothing to avoid layout shifts or just wait.
    // If you want strict security, don't show until loaded.
    if (isLoading) return null

    if (hasPermission(permission)) {
        return <>{children}</>
    }

    return <>{fallback}</>
}
