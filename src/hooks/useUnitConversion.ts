import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { 
    toBaseAmount as toBaseAmountLogic, 
    getBaseToKgRate as getBaseToKgRateLogic, 
    convertUnit as convertUnitLogic, 
    normalizeUnit,
    UnitNameMap, 
    ConversionMap 
} from '@/lib/unitConversion'

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
    const [units, setUnits] = useState<Unit[]>([])
    const [productUnits, setProductUnits] = useState<ProductUnit[]>([])

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            try {
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

                setUnits(unitsData || [])
                setProductUnits(prodUnitsData || [])
            } catch (error) {
                console.error('Error fetching conversion data', error)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    const unitNameMap = useMemo(() => {
        const m = new Map<string, string>()
        units.forEach(u => {
            const normalized = normalizeUnit(u.name)
            m.set(normalized, u.id)
            // Also map the name without weight suffix if present (e.g. "Thùng" for "Thùng (20kg)")
            const withoutWeight = normalized.replace(/\s*\([^)]*\)/, '').trim()
            if (!m.has(withoutWeight)) {
                m.set(withoutWeight, u.id)
            }
        })
        return m
    }, [units])

    const unitIdMap = useMemo(() => {
        const m = new Map<string, string>()
        units.forEach(u => m.set(u.id, normalizeUnit(u.name)))
        return m
    }, [units])

    const conversionMap = useMemo(() => {
        const cMap = new Map<string, Map<string, number>>()
        productUnits.forEach((pu: ProductUnit) => {
            if (!cMap.has(pu.product_id)) {
                cMap.set(pu.product_id, new Map())
            }
            const innerMap = cMap.get(pu.product_id)!
            // Map by ID
            innerMap.set(pu.unit_id, pu.conversion_rate)
            
            // Also map by Name (Normalized)
            const normName = unitIdMap.get(pu.unit_id)
            if (normName) {
                innerMap.set(normName, pu.conversion_rate)
            }
        })
        return cMap
    }, [productUnits, unitIdMap])

    const getBaseAmount = useCallback((
        productId: string | null, 
        unitName: string | null, 
        qty: number, 
        baseUnitName: string | null
    ): number => {
        return toBaseAmountLogic(productId, unitName, qty, baseUnitName, unitNameMap, conversionMap)
    }, [unitNameMap, conversionMap])

    const getBaseToKgRate = useCallback((
        productId: string | null, 
        baseUnitName: string | null
    ): number | null => {
        return getBaseToKgRateLogic(productId, baseUnitName, unitNameMap, conversionMap)
    }, [unitNameMap, conversionMap])

    const getConvertedUnit = useCallback((
        productId: string | null, 
        fromUnit: string | null, 
        toUnit: string | null, 
        qty: number, 
        baseUnit: string | null
    ): number => {
        return convertUnitLogic(productId, fromUnit, toUnit, qty, baseUnit, unitNameMap, conversionMap)
    }, [unitNameMap, conversionMap])

    return {
        loading,
        units,
        getBaseAmount,
        getBaseToKgRate,
        convertUnit: getConvertedUnit, // Maintain internal naming consistency
        unitNameMap,
        conversionMap
    }
}
