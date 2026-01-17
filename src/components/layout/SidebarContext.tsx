'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface SidebarContextType {
    isCollapsed: boolean
    toggleSidebar: () => void
    setCollapsed: (value: boolean) => void
    isReady: boolean
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function SidebarProvider({ children }: { children: ReactNode }) {
    const [isCollapsed, setIsCollapsed] = useState(true)
    const [isReady, setIsReady] = useState(false)

    // Wait for client-side mount
    useEffect(() => {
        setIsReady(true)
    }, [])

    const toggleSidebar = () => setIsCollapsed(prev => !prev)
    const setCollapsed = (value: boolean) => setIsCollapsed(value)

    return (
        <SidebarContext.Provider value={{ isCollapsed, toggleSidebar, setCollapsed, isReady }}>
            {children}
        </SidebarContext.Provider>
    )
}

export function useSidebar() {
    const context = useContext(SidebarContext)
    if (!context) {
        throw new Error('useSidebar must be used within a SidebarProvider')
    }
    return context
}
