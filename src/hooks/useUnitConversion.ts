import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface Unit {
    id: string
    name: string
}

interface ProductUnit {
    product_id: string
    unit_id: string
    conversion_rate: number
}

export function useUnitConversion() {
    const [loading, setLoading] = useState(true)

    // Maps for O(1) access
    const [unitNameMap, setUnitNameMap] = useState<Map<string, string>>(new Map()) // Name (lower) -> ID
    const [conversionMap, setConversionMap] = useState<Map<string, Map<string, number>>>(new Map()) // ProductID -> UnitID -> Rate

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            try {
                const [unitsRes, prodUnitsRes] = await Promise.all([
                    supabase.from('units').select('id, name'),
                    supabase.from('product_units').select('product_id, unit_id, conversion_rate')
                ])

                if (unitsRes.data) {
                    const uMap = new Map<string, string>()
                    unitsRes.data.forEach((u: Unit) => uMap.set(u.name.toLowerCase(), u.id))
                    setUnitNameMap(uMap)
                }

                if (prodUnitsRes.data) {
                    const cMap = new Map<string, Map<string, number>>()
                    prodUnitsRes.data.forEach((pu: ProductUnit) => {
                        if (!cMap.has(pu.product_id)) {
                            cMap.set(pu.product_id, new Map())
                        }
                        cMap.get(pu.product_id)!.set(pu.unit_id, pu.conversion_rate)
                    })
                    setConversionMap(cMap)
                }
            } catch (error) {
                console.error('Error fetching conversion data', error)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    // Helper: Convert any unit to Base Unit amount
    const toBaseAmount = useCallback((productId: string, unitName: string | null, qty: number, baseUnitName: string | null): number => {
        if (!productId || !unitName || !baseUnitName) return qty

        // If unit is Base Unit, return qty
        if (unitName.toLowerCase() === baseUnitName.toLowerCase()) return qty

        // Look up unit ID
        const uid = unitNameMap.get(unitName.toLowerCase())
        if (!uid) return qty

        // Look up rate
        const rates = conversionMap.get(productId)
        if (rates && rates.has(uid)) {
            return qty * rates.get(uid)!
        }

        return qty
    }, [unitNameMap, conversionMap])

    // Helper: Get Product's KG conversion rate (How many KG in 1 Base Unit?)
    const getBaseToKgRate = useCallback((productId: string, baseUnitName: string | null): number | null => {
        if (!productId || !baseUnitName) return null

        const kgNames = ['kg', 'kilogram', 'ki-lo-gam', 'kgs']

        // Check Base Unit
        if (kgNames.includes(baseUnitName.toLowerCase())) return 1

        // Check Product Units for a KG entry
        // 1 Alt(KG) = rate * Base. -> 1 Base = 1/rate KG.
        const rates = conversionMap.get(productId)
        if (!rates) return null

        for (const name of kgNames) {
            const uid = unitNameMap.get(name)
            if (uid && rates.has(uid)) {
                const rateKgToBase = rates.get(uid)!
                if (rateKgToBase === 0) return null
                return 1 / rateKgToBase
            }
        }

        return null
    }, [unitNameMap, conversionMap])

    return {
        loading,
        toBaseAmount,
        getBaseToKgRate,
        unitNameMap, // Export maps if needed for memoization dependencies
        conversionMap
    }
}
