'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

interface MobileState {
    zones: any[]
    localLots: any[]
    localPositions: any[]
    selection: {
        warehouseId: string | null
        aisleId: string | null
        slotId: string | null
        tierId: string | null
        step: 'setup' | 'working'
        mode: 'scan' | 'suggest'
        selectionStep: 'warehouse' | 'aisle' | 'slot' | 'tier'
    }
    assignments: any[]
    lastDownloadTime: string | null
}

interface MobileContextType {
    state: MobileState
    updateData: (data: Partial<Pick<MobileState, 'zones' | 'localLots' | 'localPositions' | 'assignments'>>) => void
    updateSelection: (selection: Partial<MobileState['selection']>) => void
    addAssignment: (assignment: any) => void
    removeAssignment: (positionId: string) => void
    resetData: () => void
    clearAssignments: () => void
}

const STORAGE_KEY = 'MOBILE_APP_STATE'

const initialState: MobileState = {
    zones: [],
    localLots: [],
    localPositions: [],
    selection: {
        warehouseId: null,
        aisleId: null,
        slotId: null,
        tierId: null,
        step: 'setup',
        mode: 'suggest',
        selectionStep: 'warehouse'
    },
    assignments: [],
    lastDownloadTime: null
}

const MobileContext = createContext<MobileContextType | undefined>(undefined)

export function MobileProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<MobileState>(initialState)
    const [isInitialized, setIsInitialized] = useState(false)

    // Load from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                setState(prev => ({ 
                    ...prev, 
                    ...parsed,
                    selection: {
                        ...prev.selection,
                        ...(parsed.selection || {})
                    }
                }))
            } catch (e) {
                console.error('Failed to load mobile state:', e)
            }
        }
        setIsInitialized(true)
    }, [])

    // Sync to localStorage on change
    useEffect(() => {
        if (isInitialized) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
        }
    }, [state, isInitialized])

    const updateData = (data: Partial<Pick<MobileState, 'zones' | 'localLots' | 'localPositions' | 'assignments'>>) => {
        setState(prev => ({
            ...prev,
            ...data,
            lastDownloadTime: new Date().toISOString()
        }))
    }

    const updateSelection = (selection: Partial<MobileState['selection']>) => {
        setState(prev => ({
            ...prev,
            selection: { ...prev.selection, ...selection }
        }))
    }

    const addAssignment = (assignment: any) => {
        setState(prev => ({
            ...prev,
            assignments: [assignment, ...prev.assignments]
        }))
    }

    const removeAssignment = (positionId: string) => {
        setState(prev => ({
            ...prev,
            assignments: prev.assignments.filter(a => a.positionId !== positionId)
        }))
    }

    const clearAssignments = () => {
        setState(prev => ({
            ...prev,
            assignments: []
        }))
    }

    const resetData = () => {
        setState(initialState)
        localStorage.removeItem(STORAGE_KEY)
    }

    return (
        <MobileContext.Provider value={{ state, updateData, updateSelection, addAssignment, removeAssignment, clearAssignments, resetData }}>
            {children}
        </MobileContext.Provider>
    )
}

export function useMobile() {
    const context = useContext(MobileContext)
    if (context === undefined) {
        throw new Error('useMobile must be used within a MobileProvider')
    }
    return context
}
