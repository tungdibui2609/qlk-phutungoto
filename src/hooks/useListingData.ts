'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { matchSearch } from '@/lib/searchUtils'

interface UseListingDataOptions<T> {
    orderBy?: { column: keyof T; ascending?: boolean }
    select?: string
    includeSystemCode?: boolean
}

export function useListingData<T extends { id: string; is_active?: boolean | null }>(
    tableName: string,
    options: UseListingDataOptions<T> = {}
) {
    const { systemType } = useSystem()
    const [data, setData] = useState<T[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

    const select = options.select || '*'
    const orderByColumn = options.orderBy?.column as string | undefined
    const orderByAscending = options.orderBy?.ascending ?? true
    const includeSystemCode = options.includeSystemCode !== false

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            let query = (supabase.from(tableName as any) as any).select(select)

            if (includeSystemCode) {
                const column = tableName === 'products' ? 'system_type' : 'system_code'
                query = query.eq(column, systemType)
            }

            if (orderByColumn) {
                query = query.order(orderByColumn, {
                    ascending: orderByAscending
                })
            }

            const { data: result, error } = await query
            if (error) throw error
            setData(result as unknown as T[])
        } catch (error) {
            console.error(`Error fetching ${tableName}:`, error)
        } finally {
            setLoading(false)
        }
    }, [tableName, systemType, select, orderByColumn, orderByAscending, includeSystemCode])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const filteredData = useMemo(() => {
        return data.filter(item => {
            // Search filter
            const matchesSearch = matchSearch(item, searchTerm)

            // Status filter
            const matchesStatus = statusFilter === 'all' ||
                (statusFilter === 'active' && item.is_active === true) ||
                (statusFilter === 'inactive' && item.is_active === false)

            return matchesSearch && matchesStatus
        })
    }, [data, searchTerm, statusFilter])

    return {
        data,
        filteredData,
        loading,
        searchTerm,
        setSearchTerm,
        statusFilter,
        setStatusFilter,
        refresh: fetchData,
        setData // Allow manual updates (e.g., after delete)
    }
}
