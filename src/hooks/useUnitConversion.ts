import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { toBaseAmount as toBaseAmountLogic, getBaseToKgRate as getBaseToKgRateLogic, convertUnit as convertUnitLogic, UnitNameMap, ConversionMap } from '@/lib/unitConversion'

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
    const [unitNameMap, setUnitNameMap] = useState<UnitNameMap>(new Map()) // Name (lower) -> ID
    const [conversionMap, setConversionMap] = useState<ConversionMap>(new Map()) // ProductID -> UnitID -> Rate

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            try {
                // Fetch all with pagination to bypass 1000 limit
                const fetchAll = async (tableName: string, query: any) => {
                    let allResults: any[] = [];
                    let from = 0;
                    const LIMIT = 1000;
                    while (true) {
                        const { data, error } = await query.range(from, from + LIMIT - 1);
                        if (error) throw error;
                        if (!data || data.length === 0) break;
                        allResults = [...allResults, ...data];
                        if (data.length < LIMIT) break;
                        from += LIMIT;
                    }
                    return allResults;
                };

                const [unitsData, prodUnitsData] = await Promise.all([
                    fetchAll('units', supabase.from('units').select('id, name')),
                    fetchAll('product_units', supabase.from('product_units').select('product_id, unit_id, conversion_rate'))
                ]);

                if (unitsData) {
                    const uMap = new Map<string, string>()
                    unitsData.forEach((u: Unit) => uMap.set(u.name.toLowerCase(), u.id))
                    setUnitNameMap(uMap)
                }

                if (prodUnitsData) {
                    const cMap = new Map<string, Map<string, number>>()
                    prodUnitsData.forEach((pu: ProductUnit) => {
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

    // Wrapper: Convert any unit to Base Unit amount
    const toBaseAmount = useCallback((productId: string | null, unitName: string | null, qty: number, baseUnitName: string | null): number => {
        return toBaseAmountLogic(productId, unitName, qty, baseUnitName, unitNameMap, conversionMap)
    }, [unitNameMap, conversionMap])

    // Wrapper: Get Product's KG conversion rate
    const getBaseToKgRate = useCallback((productId: string | null, baseUnitName: string | null): number | null => {
        return getBaseToKgRateLogic(productId, baseUnitName, unitNameMap, conversionMap)
    }, [unitNameMap, conversionMap])

    const convertUnit = useCallback((productId: string | null, fromUnit: string | null, toUnit: string | null, qty: number, baseUnit: string | null): number => {
        return convertUnitLogic(productId, fromUnit, toUnit, qty, baseUnit, unitNameMap, conversionMap)
    }, [unitNameMap, conversionMap])

    return {
        loading,
        toBaseAmount,
        getBaseToKgRate,
        convertUnit,
        unitNameMap, // Export maps if needed for memoization dependencies
        conversionMap
    }
}
