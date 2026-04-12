'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Plus, Save, FileText, Calendar, Info, Activity, Factory, Package, Users, Weight, Hash, Trash2, Wand2, Search, Loader2, Warehouse, ChevronDown, CheckCircle2, X, Scale, Truck, TrendingUp, PieChart, ArrowRight, Leaf, RotateCw, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useUser } from '@/contexts/UserContext'
import { useSystem } from '@/contexts/SystemContext'
import { extractWeightFromName, MAIN_PACKAGE_UNITS, normalizeUnit, convertUnit } from '@/lib/unitConversion'
import { formatQuantityFull } from '@/lib/numberUtils'
import { productionLoanService } from '@/services/production-inventory/productionLoanService'

interface ProductionLot {
    id?: string
    lot_code: string
    product_id: string | null
    weight_per_unit: number
    planned_quantity?: number | null
    actual_quantity?: number // Added for display
    unit?: string // Added for display (Product base unit)
    product_name?: string // UI helper
    conversion_rules?: { factor: number; unit_name: string; ref_unit_name: string }[] // Linked rules
}

interface ProductionModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    editItem?: any | null
    readOnly?: boolean
}

export default function ProductionModal({ isOpen, onClose, onSuccess, editItem, readOnly = false }: ProductionModalProps) {
    const isLocked = readOnly || editItem?.status === 'DONE';
    const { showToast, showConfirm } = useToast()
    const { profile } = useUser()
    const { systems, currentSystem } = useSystem()
    const [isSaving, setIsSaving] = useState(false)

    // Helper to extract weight from name pattern like "(10 Kg)"
    const extractWeight = (name?: string) => {
        if (!name) return 0;
        // Match weight even if there's other text inside parentheses like "(Thùng 10 Kg)"
        const match = name.match(/\(\s*.*?\s*(\d+(\.\d+)?)\s*[kK]?[gG]\s*\)/i);
        return match ? parseFloat(match[1]) : 0;
    };

    // Helper to get safe product name
    const pName = (lot: any, product: any) => {
        return lot.product_name || product?.name || 'Sản phẩm chưa xác định';
    };

    // Calculate final weight from conversion rules (matching ProductUnits logic)
    const calculateFinalWeight = (lot: any) => {
        const rules = lot.conversion_rules || [];
        if (rules.length === 0) return 0;
        
        const getUnitWeight = (unitName: string): number => {
            if (unitName.toLowerCase() === 'kg') return 1;
            
            const rule = rules.find((r: any) => r.unit_name === unitName);
            if (!rule) return 0; 
            
            // Recursive calculation: Factor * Weight of Ref Unit
            return rule.factor * getUnitWeight(rule.ref_unit_name);
        };

        // Usually the first rule defines the primary unit for this lot
        if (rules[0]?.unit_name) {
            return getUnitWeight(rules[0].unit_name);
        }
        return 0;
    };

    // Helper to get Available Reference Units for a given index in a lot's rules
    const getAvailableRefs = (lotIdx: number, ruleIdx: number) => {
        const lot = lots[lotIdx];
        const refs = [];
        const seenNames = new Set<string>();
        
        // Add Product Base Unit
        if (lot.unit) {
            refs.push(lot.unit);
            seenNames.add(lot.unit);
        }
        
        // Add previous rules' unit names for this specific lot
        const rules = lot.conversion_rules || [];
        for (let i = 0; i < ruleIdx; i++) {
            const r = rules[i];
            if (r.unit_name && !seenNames.has(r.unit_name)) {
                seenNames.add(r.unit_name);
                refs.push(r.unit_name);
            }
        }
        return refs;
    };

    // Form states
    const [code, setCode] = useState('')
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [status, setStatus] = useState('IN_PROGRESS')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [productionType, setProductionType] = useState<'NEW' | 'RE_SORT'>('NEW')
    
    // Global Filter for products (Warehouse focus)
    const [targetSystemCode, setTargetSystemCode] = useState('')
    const [customerId, setCustomerId] = useState('')
    
    // Dynamic Product & Lot Lines
    const [lots, setLots] = useState<ProductionLot[]>([])
    const [allocations, setAllocations] = useState<any[]>([])
    const [productionInputs, setProductionInputs] = useState<any[]>([])
    const [loadingAllocations, setLoadingAllocations] = useState(false)
    const [activeTab, setActiveTab] = useState<'products' | 'allocations' | 'analysis'>('products')

    // Raw Material Input
    const [inputSource, setInputSource] = useState<'MANUAL' | 'FRESH_MATERIAL'>('MANUAL')
    const [fmBatchId, setFmBatchId] = useState<string | null>(null)
    const [fmStageId, setFmStageId] = useState<string | null>(null)
    const [fmBatches, setFmBatches] = useState<any[]>([])
    const [fmStages, setFmStages] = useState<any[]>([])

    const [inputProductId, setInputProductId] = useState<string | null>(null)
    const [inputQuantity, setInputQuantity] = useState<number>(0)
    const [inputUnit, setInputUnit] = useState<string>('')
    const [inputProductName, setInputProductName] = useState<string>('')
    const [isInputSearchOpen, setIsInputSearchOpen] = useState(false)
    const [inputSearchTerm, setInputSearchTerm] = useState('')

    // Data lists for selection
    const [products, setProducts] = useState<any[]>([])
    const [customers, setCustomers] = useState<any[]>([])
    const [units, setUnits] = useState<any[]>([])
    const [loadingProducts, setLoadingProducts] = useState(false)
    const [loadingCustomers, setLoadingCustomers] = useState(false)

    const [rowSearchTerms, setRowSearchTerms] = useState<Record<number, string>>({})
    const [activeRowIdx, setActiveRowIdx] = useState<number | null>(null)
    const [isRefreshingFm, setIsRefreshingFm] = useState(false)
    const [isFetchingLots, setIsFetchingLots] = useState(false)
    
    // Stats Date Filters
    const [statsStartDate, setStatsStartDate] = useState<string>('')
    const [statsEndDate, setStatsEndDate] = useState<string>('')
    const [isRefreshingStats, setIsRefreshingStats] = useState(false)
    const [dailyStats, setDailyStats] = useState<{ date: string, quantity: number }[]>([])

    // Summary calculations
    const summary = useMemo(() => {
        let planned = 0
        let actual = 0
        lots.forEach(l => {
            planned += (l.planned_quantity || 0) * (l.weight_per_unit || 1)
            actual += l.actual_quantity || 0
        })
        
        let totalInputWeight = 0
        if (productionType === 'NEW') {
            totalInputWeight = inputQuantity * (extractWeight(inputProductName) || 1)
        } else {
            totalInputWeight = productionInputs.reduce((sum, inp) => sum + (inp.weight_kg || 0), 0)
        }

        const rate = planned > 0 ? (actual / planned) * 100 : 0
        const lossWeight = totalInputWeight > 0 ? Math.max(0, totalInputWeight - actual) : 0
        const lossRate = totalInputWeight > 0 ? (lossWeight / totalInputWeight) * 100 : 0

        return { planned, actual, rate, totalInputWeight, lossWeight, lossRate }
    }, [lots, productionType, inputQuantity, inputProductName, productionInputs])

    const analysisSummary = useMemo(() => {
        if (!isLocked || !editItem) return null;
        
        // 1. Material aggregation (Production Loans)
        const materialStats: Record<string, { name: string, sku: string, total: number, unit: string }> = {};
        allocations.forEach(aln => {
            const pid = aln.product_id;
            if (!materialStats[pid]) {
                materialStats[pid] = { 
                    name: aln.products?.name || 'Vật tư ẩn', 
                    sku: aln.products?.sku || '---', 
                    total: 0, 
                    unit: aln.unit 
                };
            }
            // Tiêu hao = Đã cấp - Đã hoàn trả
            const consumed = (aln.quantity || 0) - (aln.returned_quantity || 0);
            materialStats[pid].total += consumed;
        });

        // 2. Input Material aggregation for RE_SORT (Production Inputs)
        const inputStats: any[] = [];
        if (productionType === 'RE_SORT') {
            const agg: Record<string, any> = {};
            productionInputs.forEach(inp => {
                const pid = inp.product_id;
                if (!agg[pid]) {
                    agg[pid] = {
                        name: inp.products?.name || 'Sản phẩm đầu vào',
                        sku: inp.products?.sku || '---',
                        totalWeight: 0,
                        unit: 'Kg',
                        lotCount: 0
                    };
                }
                agg[pid].totalWeight += inp.weight_kg || 0;
                agg[pid].lotCount += 1;
            });
            inputStats.push(...Object.values(agg));
        }

        // 3. Consumption per Ton
        const actualTons = summary.actual / 1000;
        const materials = Object.values(materialStats).map(m => ({
            ...m,
            perTon: actualTons > 0 ? (m.total / actualTons) : 0
        }));

        // 4. Time Progress
        let timeProgress = 0;
        if (startDate && endDate) {
            const start = new Date(startDate).getTime();
            const end = new Date(endDate).getTime();
            const now = new Date().getTime();
            if (end > start) {
                timeProgress = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
            }
        }

        // 5. Daily Productivity Insights
        const totalDays = dailyStats.length;
        const avgOutput = totalDays > 0 ? dailyStats.reduce((sum, s) => sum + s.quantity, 0) / totalDays : 0;
        const peakDay = dailyStats.length > 0 ? [...dailyStats].sort((a, b) => b.quantity - a.quantity)[0] : null;

        return { materials, timeProgress, actualTons, inputStats, dailyStats, totalDays, avgOutput, peakDay };
    }, [isLocked, editItem, allocations, summary.actual, startDate, endDate, productionType, productionInputs, dailyStats])

    const fetchCustomers = async () => {
        if (!profile?.company_id) return
        setLoadingCustomers(true)
        const { data } = await supabase
            .from('customers')
            .select('id, name')
            .eq('company_id', profile.company_id)
            .order('name')
        if (data) setCustomers(data)
        setLoadingCustomers(false)
    }

    const fetchUnits = async () => {
        const { data } = await supabase
            .from('units')
            .select('*')
            .order('name')
        if (data) setUnits(data)
    }

    const fetchProducts = async (sysCode: string) => {
        setLoadingProducts(true)
        const { data } = await supabase
            .from('products')
            .select('id, name, sku, weight_kg, unit, product_units(unit_id, conversion_rate)')
            .eq('system_type', sysCode)
            .eq('is_active', true)
            .order('name')
        if (data) setProducts(data)
        setLoadingProducts(false)
    }

    const fetchProductionLots = async (prodId: string, startDate?: string, endDate?: string) => {
        if (!prodId) return
        setIsFetchingLots(true)
        setIsRefreshingStats(true)
        try {
            // 1. Get basic lot info
            const { data: lotsData } = await supabase
                .from('production_lots')
                .select('*, products(name, sku, unit, weight_kg)')
                .eq('production_id', prodId)
            
            if (!lotsData) return

            const lotIds = (lotsData as any[]).map(l => l.id)
            if (lotIds.length === 0) {
                setLots(lotsData)
                return
            }

            // 2. Query statistics with optional date filtering
            let statsData: any[] = []
            
            if (startDate || endDate) {
                // 1. Get warehouse lot IDs that match our production lots and date range
                let lotQuery = supabase
                    .from('lots')
                    .select('id, production_lot_id, production_id, product_id, inbound_date')
                    .eq('production_id', prodId)

                if (startDate) lotQuery = lotQuery.gte('inbound_date', startDate)
                
                // Fix Today's data: Use next day for inclusive TIMESTAMP filtering
                if (endDate) {
                    const nextDay = new Date(endDate);
                    nextDay.setDate(nextDay.getDate() + 1);
                    const nextDayStr = nextDay.toISOString().split('T')[0];
                    lotQuery = lotQuery.lt('inbound_date', nextDayStr)
                }

                const { data: matchedLots, error: lotErr } = await lotQuery
                if (lotErr) throw lotErr

                if (!matchedLots || matchedLots.length === 0) {
                    statsData = []
                } else {
                    const warehouseLotIds = (matchedLots as any[]).map(ml => ml.id)
                    
                    // 2. Get items for these warehouse lots
                    const { data: itemsData, error: itemsErr } = await supabase
                        .from('lot_items')
                        .select('quantity, unit, lot_id, product_id')
                        .in('lot_id', warehouseLotIds)
                    
                    if (itemsErr) throw itemsErr

                    if (itemsData) {
                        // SQL Logic: Helper to extract weight from unit string like "(10 Kg)"
                        const extractWeight = (unit: string): number => {
                            try {
                                const match = unit.match(/\(\s*.*?\s*(\d+(\.\d+)?)\s*[kK]?[gG]\s*\)/);
                                return match ? parseFloat(match[1]) : 1.0;
                            } catch (e) { return 1.0; }
                        };

                        const agg: Record<string, any> = {}
                        
                        // Use a products map for faster lookup of weight_kg
                        const { data: prodInfo } = await supabase
                            .from('products')
                            .select('id, weight_kg')
                            .in('id', (itemsData as any[]).map(item => item.product_id))

                        const productMap: Record<string, number> = {}
                        if (prodInfo) {
                            (prodInfo as any[]).forEach(p => { 
                                productMap[p.id] = p.weight_kg || 0 
                            })
                        }

                        (itemsData as any[]).forEach((item: any) => {
                            // SQL Logic: Joins based on production_id AND product_id
                            // This ensures we match the correct production_lot (output definition)
                            const matchedPL = (lotsData as any[]).find(pl => 
                                pl.production_id === prodId && 
                                pl.product_id === item.product_id
                            )
                            
                            if (!matchedPL) return
                            const plId = matchedPL.id

                            // Calculate weight factor using SQL priorities:
                            // 1. product.weight_kg OR 2. extracted weight OR 3. default 1.0
                            const weightFactor = productMap[item.product_id] || extractWeight(item.unit) || 1.0

                            if (!agg[plId]) agg[plId] = { production_lot_id: plId, actual_quantity: 0, quantity_by_unit: [] }
                            
                            // Add to total actual quantity (KG)
                            agg[plId].actual_quantity += (item.quantity * weightFactor)

                            // Add to breakdown by unit
                            const weightSuffix = (weightFactor > 1 && !item.unit.includes('(')) ? ` (${weightFactor}kg)` : ''
                            const displayUnit = item.unit + weightSuffix
                            
                            const unitEntry = agg[plId].quantity_by_unit.find((u: any) => u.unit === displayUnit)
                            if (unitEntry) {
                                unitEntry.qty += item.quantity
                            } else {
                                agg[plId].quantity_by_unit.push({ qty: item.quantity, unit: displayUnit })
                            }
                        })
                        
                        statsData = Object.values(agg)
                    }
                }
            } else {
                // Default: use the optimized view
                const { data } = await supabase
                    .from('production_item_statistics' as any)
                    .select('production_lot_id, actual_quantity, quantity_by_unit')
                    .in('production_lot_id', lotIds) as { data: any[] | null }
                statsData = data || []
            }

            // 3. Map back to enriched lots
            const statsMap: Record<string, { actual: number, by_unit: any[] }> = {}
            statsData.forEach((s: any) => { 
                statsMap[s.production_lot_id] = { 
                    actual: s.actual_quantity, 
                    by_unit: s.quantity_by_unit || [] 
                }
            })

            // 4. Calculate Daily Productivity (for Analysis Tab)
            // We fetch all records for the production order to show the full trend
            const { data: allLots } = await supabase
                .from('lots')
                .select('id, inbound_date')
                .eq('production_id', prodId) as { data: any[] | null }
            
            if (allLots && allLots.length > 0) {
                const { data: allItems } = await supabase
                    .from('lot_items')
                    .select('quantity, unit, lot_id, product_id')
                    .in('lot_id', allLots.map(l => l.id)) as { data: any[] | null }
                
                if (allItems) {
                    const extractWeight = (unit: string): number => {
                        try {
                            const match = unit.match(/\(\s*.*?\s*(\d+(\.\d+)?)\s*[kK]?[gG]\s*\)/);
                            return match ? parseFloat(match[1]) : 1.0;
                        } catch (e) { return 1.0; }
                    };

                    const dailyMap: Record<string, number> = {}
                    const lotDateMap: Record<string, string> = {}
                    allLots.forEach(l => {
                        if (l.inbound_date) {
                            lotDateMap[l.id] = new Date(l.inbound_date).toISOString().split('T')[0]
                        }
                    })

                    // We need product weight_kg map for accurate daily totals
                    const { data: pInfo } = await supabase
                        .from('products')
                        .select('id, weight_kg')
                        .in('id', Array.from(new Set(allItems.map(i => i.product_id)))) as { data: any[] | null }
                    
                    const pMap: Record<string, number> = {}
                    pInfo?.forEach(p => { pMap[p.id] = p.weight_kg || 0 })

                    allItems.forEach((item: any) => {
                        const date = lotDateMap[item.lot_id]
                        if (!date) return
                        
                        const weightFactor = pMap[item.product_id] || extractWeight(item.unit) || 1.0
                        dailyMap[date] = (dailyMap[date] || 0) + (item.quantity * weightFactor)
                    })

                    const formattedDaily = Object.entries(dailyMap)
                        .map(([date, quantity]) => ({ date, quantity }))
                        .sort((a, b) => a.date.localeCompare(b.date))
                    
                    setDailyStats(formattedDaily)
                }
            }

            const formattedLots = (lotsData as any[]).map(l => ({
                id: l.id,
                lot_code: l.lot_code,
                product_id: l.product_id,
                weight_per_unit: l.weight_per_unit || 0,
                planned_quantity: l.planned_quantity,
                actual_quantity: statsMap[l.id]?.actual || 0,
                quantity_by_unit: statsMap[l.id]?.by_unit || [],
                unit: l.products?.unit || '',
                product_name: l.products?.name || '',
                conversion_rules: l.conversion_rules || []
            }))
            setLots(formattedLots)
            
            // Also set row search terms
            const searches: Record<number, string> = {}
            formattedLots.forEach((l, idx) => {
                if (l.product_name) searches[idx] = l.product_name
            })
            setRowSearchTerms(searches)
        } catch (err: any) {
            console.error('Fetch production lots error:', err)
            showToast('Lỗi tải dữ liệu: ' + err.message, 'error')
        } finally {
            setIsRefreshingStats(false)
            setIsFetchingLots(false)
        }
    }

    const fetchAllocations = async (prodId: string) => {
        setLoadingAllocations(true)
        try {
            const { data, error } = await supabase
                .from('production_loans')
                .select(`
                    *,
                    products (
                        id, name, sku
                    )
                `)
                .eq('production_id', prodId)
            
            if (error) throw error
            setAllocations(data || [])
        } catch (err: any) {
            console.error('Fetch allocations error:', err)
        } finally {
            setLoadingAllocations(false)
        }
    }

    const fetchProductionInputs = async (prodId: string) => {
        try {
            const { data, error } = await supabase
                .from('production_inputs')
                .select('*, products(name, sku, unit)')
                .eq('production_id', prodId)
            
            if (error) throw error
            setProductionInputs(data || [])
        } catch (err: any) {
            console.error('Fetch production inputs error:', err)
        }
    }

    useEffect(() => {
        if (isOpen && editItem) {
            // Immediate reset to prevent data mixing between different production orders
            setLots([])
            setAllocations([])
            setProductionInputs([])
            setDailyStats([])
            setRowSearchTerms({})
            setIsFetchingLots(true)

            setCode(editItem.code)
            setName(editItem.name)
            setDescription(editItem.description || '')
            setStatus(editItem.status)
            setStartDate(editItem.start_date ? new Date(editItem.start_date).toISOString().split('T')[0] : '')
            setEndDate(editItem.end_date ? new Date(editItem.end_date).toISOString().split('T')[0] : '')
            
            setTargetSystemCode(editItem.target_system_code || '')
            setCustomerId(editItem.customer_id || '')
            setProductionType(editItem.production_type || 'NEW')
            
            // Raw Material
            setInputSource(editItem.fresh_material_batch_id ? 'FRESH_MATERIAL' : 'MANUAL')
            setFmBatchId(editItem.fresh_material_batch_id || null)
            setFmStageId(editItem.fresh_material_stage_id || null)

            setInputProductId(editItem.input_product_id || null)
            setInputQuantity(editItem.input_quantity || 0)
            setInputUnit(editItem.input_unit || '')
            setInputProductName(editItem.input_products?.name || '')
            setInputSearchTerm(editItem.input_products?.name || '')
            
            if (editItem.production_type === 'RE_SORT' || editItem.id) {
                fetchProductionInputs(editItem.id)
            }
            if (isLocked) {
                fetchAllocations(editItem.id)
                // Only show "Already Done" message if the status is actually DONE
                // If it's just readOnly (User clicked 'View'), don't show the confusing message
                if (editItem.status === 'DONE') {
                    showToast('Lệnh sản xuất đã hoàn thành, không thể chỉnh sửa.', 'warning')
                }
            }
        } else if (isOpen) {
            // Creating NEW
            setCode('')
            setName('')
            setDescription('')
            setStatus('IN_PROGRESS')
            setStartDate('')
            setEndDate('')
            setTargetSystemCode(currentSystem?.code || '')
            setCustomerId('')
            setProductionType('NEW')
            setLots([])
            setAllocations([])
            setProductionInputs([])
            setDailyStats([])
            setActiveTab('products')
            setRowSearchTerms({})
            setIsFetchingLots(false)
            
            setInputSource('MANUAL')
            setFmBatchId(null)
            setFmStageId(null)

            setInputProductId(null)
            setInputQuantity(0)
            setInputUnit('')
            setInputProductName('')
            setInputSearchTerm('')
            setStatsStartDate('')
            setStatsEndDate('')
        }
    }, [editItem, isOpen, isLocked])

    // Effect to refresh production lot statistics when date filters change
    useEffect(() => {
        if (isOpen && editItem?.id) {
            fetchProductionLots(editItem.id, statsStartDate, statsEndDate)
        }
    }, [isOpen, editItem?.id, statsStartDate, statsEndDate])

    useEffect(() => {
        if (isOpen) {
            fetchCustomers()
            fetchUnits()
            // Fetch product units for conversion logic
            fetchProductUnits()
            fetchFmBatches()
        }
    }, [isOpen])

    const fetchFmBatches = async () => {
        const { data, error } = await supabase
            .from('fresh_material_batches')
            .select('id, batch_code, products(name)')
            .neq('status', 'CANCELLED')
            .order('created_at', { ascending: false })
            
        if (error) {
            console.error('Fetch FM Batches error:', error)
        }
        if (data) setFmBatches(data)
    }

    useEffect(() => {
        if (fmBatchId) {
            const fetchStages = async () => {
                const { data } = await supabase
                    .from('fresh_material_stages')
                    .select('id, stage_name, fresh_material_stage_outputs(*)')
                    .eq('batch_id', fmBatchId)
                    .order('stage_order', { ascending: true })
                if (data) setFmStages(data)
            }
            fetchStages()
        } else {
            setFmStages([])
        }
    }, [fmBatchId])

    const handleStageSelect = async (stageId: string) => {
        setFmStageId(stageId)
        if (!stageId) {
            setInputProductId(null)
            setInputQuantity(0)
            setInputUnit('')
            setInputProductName('')
            setInputSearchTerm('')
            return
        }
        
        setIsRefreshingFm(true)
        try {
            // Fetch the latest output for this stage directly from database
            const { data: outputData, error } = await (supabase as any)
                .from('fresh_material_stage_outputs')
                .select('product_id, quantity, unit')
                .eq('stage_id', stageId)
                .eq('output_type', 'PRODUCT')

            if (error && error.code !== 'PGRST116') {
                console.error('Fetch stage output error:', error)
                showToast('Lỗi khi tải dữ liệu giai đoạn', 'error')
                return
            }

            if (outputData && outputData.length > 0) {
                // Sum all PRODUCT outputs for this stage
                const totalQuantity = outputData.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)
                const firstOutput = outputData[0]

                setInputProductId(firstOutput.product_id)
                setInputQuantity(totalQuantity)
                setInputUnit(firstOutput.unit || '')
                
                const { data: productData } = await (supabase as any).from('products').select('name').eq('id', firstOutput.product_id).single()
                if (productData) {
                    setInputProductName(productData.name)
                    setInputSearchTerm(productData.name)
                }
            } else {
                setInputProductId(null)
                setInputQuantity(0)
                setInputUnit('')
                setInputProductName('')
                setInputSearchTerm('')
                showToast('Giai đoạn này chưa có dữ liệu báo cáo "Sản phẩm đầu ra" chính.', 'warning')
            }
        } catch (err) {
            console.error('Handle stage select error:', err)
        } finally {
            setIsRefreshingFm(false)
        }
    }

    const refreshStageData = async () => {
        if (!fmStageId) return;
        await handleStageSelect(fmStageId);
        showToast('Đã cập nhật dữ liệu mới nhất từ Nguyên liệu tươi', 'success')
    }

    const [productUnits, setProductUnits] = useState<any[]>([])

    const fetchProductUnits = async () => {
        const { data } = await supabase.from('product_units').select('*')
        if (data) setProductUnits(data)
    }

    const unitNameMap = useMemo(() => {
        const map = new Map<string, string>()
        units.forEach(u => map.set(normalizeUnit(u.name), u.id))
        return map
    }, [units])

    const conversionMap = useMemo(() => {
        const map = new Map<string, Map<string, number>>()
        productUnits.forEach(pu => {
            if (!map.has(pu.product_id)) map.set(pu.product_id, new Map())
            map.get(pu.product_id)?.set(pu.unit_id, pu.conversion_rate || 1)
        })
        return map
    }, [productUnits])

    useEffect(() => {
        if (targetSystemCode) {
            fetchProducts(targetSystemCode)
        } else {
            setProducts([])
        }
    }, [targetSystemCode])

    // Helper to get unit weight from database or name (if explicitly bracketed)
    const getUnitWeight = useCallback((productId: string | null, unitName: string | null, baseUnitName: string | null) => {
        if (!productId || !unitName || !baseUnitName) return null
        const normIn = normalizeUnit(unitName)
        const normBase = normalizeUnit(baseUnitName)
        if (normIn === normBase || (normIn === 'kg' || normIn === 'kilogram')) return 1
        
        // Use extracted weight if present in unit name (e.g. "Thùng (20kg)")
        const extracted = extractWeightFromName(unitName)
        if (extracted) return extracted

        return null // Removed product name fallback
    }, [])



    const generateAutoCode = () => {
        const now = new Date()
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
        const randomStr = Math.floor(1000 + Math.random() * 9000)
        setCode(`LSX-${dateStr}-${randomStr}`)
    }

    const addLotRow = () => {
        setLots([...lots, { lot_code: '', product_id: null, weight_per_unit: 0, planned_quantity: null, conversion_rules: [] }])
    }

    const removeLotRow = (index: number) => {
        setLots(lots.filter((_, i) => i !== index))
        const newSearches = { ...rowSearchTerms }
        delete newSearches[index]
        setRowSearchTerms(newSearches)
    }

    const updateLotRow = (index: number, field: keyof ProductionLot, val: any) => {
        const newLots = [...lots]
        newLots[index] = { ...newLots[index], [field]: val }
        setLots(newLots)
    }

    const selectProductForRow = (index: number, product: any) => {
        const newLots = [...lots]
        const defaultWeight = product.weight_kg || 0
        const defaultUnit = product.unit || 'Kg'
        
        // Initialize with rule: 1 [Default alternative??] = [Weight] [Base Unit]
        // Actually, if we follow ProductUnits, we start with 0 rules or 1 default
        const initialRules = defaultWeight > 0 
            ? [{ factor: defaultWeight, unit_name: `Thùng (${defaultWeight}kg)`, ref_unit_name: defaultUnit }] 
            : []

        const suggestedLotCode = newLots[index].lot_code || (code ? `${code}-L${index + 1}` : `LOT-${Date.now().toString().slice(-4)}-${index + 1}`)

        newLots[index] = { 
            ...newLots[index], 
            product_id: product.id, 
            product_name: product.name,
            lot_code: suggestedLotCode, // Auto-fill lot code
            unit: defaultUnit,
            weight_per_unit: defaultWeight,
            conversion_rules: initialRules
        }
        setLots(newLots)
        setRowSearchTerms(prev => ({ ...prev, [index]: product.name }))
        setActiveRowIdx(null)
    }

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!profile?.company_id) return
        
        // CRITICAL: Block saving if data is still being fetched from the database
        // This prevents accidental data loss/overwriting due to incomplete state
        if (isFetchingLots) {
            showToast('Đang tải dữ liệu lô sản xuất, vui lòng đợi trong giây lát...', 'warning')
            return
        }

        // Check if any product is selected but LOT code is missing
        const incompleteLots = lots.filter(l => l.product_id && !l.lot_code.trim())
        if (incompleteLots.length > 0) {
            showToast(`Sản phẩm "${incompleteLots[0].product_name}" chưa có mã LOT. Vui lòng nhập để lưu.`, 'error')
            return
        }

        if (!lots.length) {
            showToast('Lệnh sản xuất phải có ít nhất một sản phẩm và mã lot', 'error')
            return
        }

        // Check if weight_per_unit is 0 for products that are likely to need conversion (non-kg units)
        const missingWeight = lots.find(l => (!l.weight_per_unit || l.weight_per_unit <= 0) && l.unit?.toLowerCase() !== 'kg')
        if (missingWeight) {
            if (!await showConfirm(`Sản phẩm "${missingWeight.product_name}" đang có trọng lượng quy cách là 0. Hệ thống sẽ dùng mặc định 1.0 kg/đv. Bạn có chắc muốn lưu?`)) {
                return
            }
        }

        setIsSaving(true)
        try {
            const productionPayload = {
                code,
                name,
                description,
                status,
                start_date: startDate ? new Date(startDate).toISOString() : null,
                end_date: endDate ? new Date(endDate).toISOString() : null,
                company_id: profile.company_id,
                customer_id: customerId || null,
                target_system_code: targetSystemCode || null,
                fresh_material_batch_id: inputSource === 'FRESH_MATERIAL' ? fmBatchId : null,
                fresh_material_stage_id: inputSource === 'FRESH_MATERIAL' ? fmStageId : null,
                input_product_id: inputProductId || null,
                input_quantity: inputQuantity || 0,
                input_unit: inputUnit || null,
                production_type: productionType,
                updated_at: new Date().toISOString()
            }

            let productionId = editItem?.id
            let error

            // 1. Save Production Info
            if (productionId) {
                // Update production: last_sheet_index is NOT in the payload, so it's preserved
                const { error: err } = await (supabase as any)
                    .from('productions')
                    .update(productionPayload)
                    .eq('id', productionId)
                error = err
            } else {
                const { data, error: err } = await (supabase as any)
                    .from('productions')
                    .insert([productionPayload])
                    .select()
                error = err
                if (data?.[0]) productionId = data[0].id
            }

            if (error) throw error

            // 2. Save Lots (Multi-product per lot) - Surgical update to preserve statistics
            if (productionId) {
                // Only identify and delete removed lots if we successfully fetched existing ones
                // This is a safety measure to prevent "delete-all" if state was somehow corrupted
                const { data: existingLotsFromDB } = await (supabase as any)
                    .from('production_lots')
                    .select('id')
                    .eq('production_id', productionId)
                
                const existingIDs: string[] = (existingLotsFromDB || []).map((l: any) => l.id)
                const currentIDs = lots.map(l => l.id).filter(Boolean) as string[]
                const idsToDelete = existingIDs.filter((id: string) => !currentIDs.includes(id))

                // Delete removed lots
                if (idsToDelete.length > 0) {
                    const { error: delError } = await (supabase as any)
                        .from('production_lots')
                        .delete()
                        .in('id', idsToDelete)
                    if (delError) throw delError
                }
                
                // Prepare lots for UPSERT (Update existing, Insert new)
                // IMPORTANT: We ONLY include business fields. 
                // Printing counters (total_printed_labels, last_printed_index, etc.) 
                // are NOT in this payload, ensuring they are PRESERVED in the database.
                const lotsToUpsert = lots
                    .filter(l => l.lot_code.trim() !== '' && l.product_id)
                    .map(l => ({
                        ...(l.id ? { id: l.id } : {}), // Include ID for update behavior
                        production_id: productionId,
                        lot_code: l.lot_code,
                        product_id: l.product_id,
                        weight_per_unit: l.weight_per_unit || 0,
                        planned_quantity: l.planned_quantity || null,
                        conversion_rules: l.conversion_rules || [],
                        company_id: profile.company_id
                    }))

                if (lotsToUpsert.length > 0) {
                    const { error: lotErr } = await (supabase as any).from('production_lots').upsert(lotsToUpsert)
                    if (lotErr) throw lotErr
                }
            }

            showToast(editItem ? 'Cập nhật thành công' : 'Tạo mới thành công', 'success')
            onSuccess()
            onClose()
        } catch (error: any) {
            showToast('Lỗi: ' + error.message, 'error')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] w-full max-w-5xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[95vh]">
                {/* Header */}
                <div className="px-8 py-6 border-b border-stone-100 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-800/50 shadow-sm shrink-0">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${isLocked ? 'bg-blue-100 dark:bg-blue-950/30' : 'bg-orange-100 dark:bg-orange-950/30'}`}>
                            {isLocked ? <FileText className="text-blue-600" size={24} /> : <Factory className="text-orange-600" size={24} />}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-stone-900 dark:text-white">
                                {isLocked 
                                    ? (editItem?.status === 'DONE' ? 'Chi tiết lệnh đã hoàn thành' : 'Xem chi tiết lệnh đang chạy') 
                                    : (editItem ? 'Chỉnh sửa lệnh sản xuất' : 'Tạo mới lệnh sản xuất')}
                            </h2>
                            <p className="text-xs text-stone-500 font-medium">
                                {isLocked ? `Mã lệnh: ${code}` : 'LSX - Quy trình sản xuất đa mặt hàng'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <Plus size={24} className="rotate-45 text-stone-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-stone-50/30 dark:bg-zinc-900">
                    {isLocked && editItem?.status === 'DONE' && (
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl flex items-center gap-3 text-blue-700 dark:text-blue-400">
                            <Lock size={18} />
                            <span className="text-sm font-bold">Lệnh sản xuất này đã hoàn thành và đang được khóa. Muốn chỉnh sửa vui lòng chuyển trạng thái về Đang sản xuất.</span>
                        </div>
                    )}
                    {/* Raw Material Info Summary Bar (If filled) */}
                    {(productionType === 'NEW' ? (inputProductId || inputQuantity > 0) : summary.totalInputWeight > 0) && (
                        <div className="flex items-center gap-6 p-6 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-[28px] border border-emerald-200/50 dark:border-emerald-900/20 animate-in slide-in-from-top-4">
                            <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-600/20">
                                <Scale size={20} />
                            </div>
                            <div className="flex-1 flex flex-col md:flex-row md:items-center gap-4 md:gap-12">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1 block">Nguyên liệu tổng</label>
                                    <div className="text-lg font-black text-stone-900 dark:text-white flex items-baseline gap-2">
                                        {formatQuantityFull(summary.totalInputWeight)}
                                        <span className="text-xs font-bold text-stone-400 uppercase">Kg</span>
                                    </div>
                                </div>
                                <div className="h-10 w-px bg-emerald-100 dark:bg-emerald-900/50 hidden md:block" />
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1 block">
                                        {productionType === 'NEW' ? 'Tên nguyên liệu' : 'Số mã LOT đầu vào'}
                                    </label>
                                    <div className="text-sm font-bold text-stone-600 dark:text-stone-300">
                                        {productionType === 'NEW' ? (inputProductName || '---') : `${productionInputs.length} mã LOT`}
                                    </div>
                                </div>
                                {summary.actual > 0 && summary.totalInputWeight > 0 && (
                                    <>
                                        <div className="h-10 w-px bg-emerald-100 dark:bg-emerald-900/50 hidden md:block" />
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1 block">Hao hụt sản xuất</label>
                                            <div className="text-sm font-black text-orange-600 flex items-center gap-1">
                                                {formatQuantityFull(summary.lossWeight)} Kg
                                                <span className="text-[10px] opacity-60">({summary.lossRate.toFixed(1)}%)</span>
                                                <TrendingUp size={14} />
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                    <form id="prod-form" onSubmit={handleSubmit} className="space-y-8">
                        {isLocked && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-6 bg-white dark:bg-zinc-800/40 rounded-[28px] border border-stone-200 dark:border-zinc-800 shadow-sm flex flex-col items-center justify-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Tổng kế hoạch</span>
                                    <div className="text-2xl font-black text-stone-800 dark:text-white flex items-baseline gap-1">
                                        {summary.planned.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
                                        <span className="text-xs font-bold text-stone-400 uppercase">Kg</span>
                                    </div>
                                </div>
                                <div className="p-6 bg-blue-500/5 dark:bg-blue-500/10 rounded-[28px] border border-blue-100 dark:border-blue-900/20 shadow-sm flex flex-col items-center justify-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Tổng thực tế</span>
                                    <div className="text-2xl font-black text-blue-600 dark:text-blue-400 flex items-baseline gap-1">
                                        {summary.actual.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
                                        <span className="text-xs font-bold text-blue-400/60 uppercase">Kg</span>
                                    </div>
                                </div>
                                <div className="p-6 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-[28px] border border-emerald-100 dark:border-emerald-900/20 shadow-sm flex flex-col items-center justify-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Tỉ lệ hoàn thành</span>
                                    <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 flex items-baseline gap-1">
                                        {summary.rate.toFixed(1)}
                                        <span className="text-xs font-bold text-emerald-400/60 uppercase">%</span>
                                    </div>
                                    <div className="w-full bg-stone-200 dark:bg-zinc-700 h-1.5 rounded-full mt-1 overflow-hidden">
                                        <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${Math.min(100, summary.rate)}%` }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Section 1: General Info */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-6">
                                <div className="p-6 bg-white dark:bg-zinc-800/40 rounded-[28px] border border-stone-200 dark:border-zinc-800 shadow-sm space-y-6">
                                    <div className="flex items-center justify-between text-stone-400 font-black text-[10px] uppercase tracking-widest">
                                        <div className="flex items-center gap-2">
                                            <Info size={14} className="text-orange-500" /> Thông tin cơ bản
                                        </div>
                                        {!isLocked && (
                                            <div className="flex bg-stone-100 dark:bg-zinc-800 p-1 rounded-xl">
                                                <button
                                                    type="button"
                                                    onClick={() => setProductionType('NEW')}
                                                    className={`px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all ${productionType === 'NEW' ? 'bg-white dark:bg-zinc-700 text-stone-900 dark:text-white shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                                                >
                                                    Sản xuất mới
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setProductionType('RE_SORT')}
                                                    className={`px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 ${productionType === 'RE_SORT' ? 'bg-orange-500 text-white shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                                                >
                                                    Phân loại / Lựa lại
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {!isLocked && (
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-stone-500 flex items-center justify-between">
                                                    <span>Mã sản xuất</span>
                                                    <button type="button" onClick={generateAutoCode} className="text-orange-600 hover:underline flex items-center gap-1 text-[10px]">
                                                        <Wand2 size={12} /> Tự tạo
                                                    </button>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={code}
                                                    onChange={e => setCode(e.target.value.toUpperCase())}
                                                    className="w-full px-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 font-bold focus:ring-4 focus:ring-orange-100 outline-none transition-all"
                                                    required
                                                />
                                            </div>
                                        )}
                                        <div className={isLocked ? 'md:col-span-1 space-y-2' : 'space-y-2'}>
                                            <label className="text-xs font-bold text-stone-500">Đối tác / Khách hàng</label>
                                            {isLocked ? (
                                                <div className="px-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 font-bold text-sm text-stone-800 dark:text-white border border-stone-100 dark:border-zinc-700">
                                                    {customers.find(c => c.id === customerId)?.name || 'Chưa xác định'}
                                                </div>
                                            ) : (
                                                <select
                                                    value={customerId}
                                                    onChange={e => setCustomerId(e.target.value)}
                                                    className="w-full px-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 font-bold focus:ring-4 focus:ring-orange-100 outline-none transition-all appearance-none"
                                                >
                                                    <option value="">-- Chọn khách hàng --</option>
                                                    {customers.map(c => (
                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                        <div className="md:col-span-2 space-y-2">
                                            <label className="text-xs font-bold text-stone-500">Nội dung sản xuất</label>
                                            {isLocked ? (
                                                <div className="px-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 font-black text-lg text-stone-900 dark:text-white border border-stone-100 dark:border-zinc-700">
                                                    {name}
                                                </div>
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={name}
                                                    onChange={e => setName(e.target.value)}
                                                    placeholder="VD: Sản xuất đơn hàng tháng 3..."
                                                    className="w-full px-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 font-bold focus:ring-4 focus:ring-orange-100 outline-none transition-all"
                                                    required
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Raw Material Selection - NEW SECTION */}
                                {!isLocked && (
                                    <div className="p-6 bg-white dark:bg-zinc-800/40 rounded-[28px] border border-stone-200 dark:border-zinc-800 shadow-sm space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-stone-400 font-black text-[10px] uppercase tracking-widest">
                                                <Scale size={14} className="text-emerald-500" /> Định mức nguyên liệu đầu vào
                                            </div>
                                            
                                            <div className="flex bg-stone-100 dark:bg-zinc-800 p-1 rounded-xl">
                                                <button
                                                    type="button"
                                                    onClick={() => setInputSource('MANUAL')}
                                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${inputSource === 'MANUAL' ? 'bg-white dark:bg-zinc-700 text-stone-900 dark:text-white shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                                                >
                                                    Tự do
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setInputSource('FRESH_MATERIAL')}
                                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${inputSource === 'FRESH_MATERIAL' ? 'bg-emerald-500 text-white shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                                                >
                                                    <Leaf size={12} /> Từ lô NLT
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {inputSource === 'FRESH_MATERIAL' && (
                                                <>
                                                    <div className="space-y-2 relative md:col-span-1 lg:col-span-1">
                                                        <label className="text-xs font-bold text-stone-500">Chỉ định Lô NLT</label>
                                                        <select
                                                            value={fmBatchId || ''}
                                                            onChange={e => { setFmBatchId(e.target.value || null); setFmStageId(null); }}
                                                            className="w-full px-4 py-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 font-bold focus:ring-4 focus:ring-emerald-100 outline-none transition-all appearance-none text-emerald-800 dark:text-emerald-400"
                                                        >
                                                            <option value="">
                                                                {fmBatches.length > 0 ? '-- Chọn lô --' : '-- Không có lô nào đang mở --'}
                                                            </option>
                                                            {fmBatches.map(b => (
                                                                <option key={b.id} value={b.id}>{b.batch_code} ({b.products?.name})</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    
                                                    <div className="space-y-2 relative md:col-span-1 lg:col-span-1">
                                                        <label className="text-xs font-bold text-stone-500 flex items-center justify-between">
                                                            <span>Chọn Giai đoạn lấy kết quả</span>
                                                            {fmStageId && (
                                                                <button
                                                                    type="button"
                                                                    onClick={refreshStageData}
                                                                    disabled={isRefreshingFm}
                                                                    className="text-emerald-600 hover:text-emerald-700 p-1 rounded-lg hover:bg-emerald-50 transition-all flex items-center gap-1 group"
                                                                    title="Làm mới số lượng từ NLT"
                                                                >
                                                                    <RotateCw size={12} className={`${isRefreshingFm ? 'animate-spin' : 'group-active:rotate-180 transition-transform duration-500'}`} />
                                                                    <span className="text-[10px] font-bold">Làm mới</span>
                                                                </button>
                                                            )}
                                                        </label>
                                                        <div className="relative">
                                                            <select
                                                                value={fmStageId || ''}
                                                                onChange={e => handleStageSelect(e.target.value)}
                                                                disabled={!fmBatchId || isRefreshingFm}
                                                                className="w-full px-4 py-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 font-bold focus:ring-4 focus:ring-emerald-100 outline-none transition-all appearance-none text-emerald-800 dark:text-emerald-400 disabled:opacity-50"
                                                            >
                                                                <option value="">-- Chọn giai đoạn --</option>
                                                                {fmStages.map(s => (
                                                                    <option key={s.id} value={s.id}>{s.stage_name}</option>
                                                                ))}
                                                            </select>
                                                            {isRefreshingFm && (
                                                                <div className="absolute right-10 top-1/2 -translate-y-1/2">
                                                                    <Loader2 size={16} className="animate-spin text-emerald-500" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                            
                                            <div className={`${inputSource === 'FRESH_MATERIAL' ? 'md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-stone-100 dark:border-zinc-800' : 'md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6'} relative`}>
                                                <div className="md:col-span-2 space-y-2 relative">
                                                    <label className="text-xs font-bold text-stone-500">Loại nguyên liệu tiêu hao</label>
                                                <div className="relative">
                                                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                                                    <input
                                                        type="text"
                                                        value={inputSearchTerm}
                                                        onChange={(e) => {
                                                            setInputSearchTerm(e.target.value)
                                                            setIsInputSearchOpen(true)
                                                        }}
                                                        onFocus={() => setIsInputSearchOpen(true)}
                                                        placeholder="Tìm sản phẩm nguyên liệu..."
                                                        className="w-full pl-12 pr-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 font-bold focus:ring-4 focus:ring-emerald-100 outline-none transition-all"
                                                    />
                                                </div>
                                                
                                                {isInputSearchOpen && inputSearchTerm && (
                                                    <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-zinc-800 rounded-2xl shadow-xl border border-stone-100 dark:border-zinc-700 z-[110] max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                                                        {products
                                                            .filter(p => p.name.toLowerCase().includes(inputSearchTerm.toLowerCase()) || p.sku?.toLowerCase().includes(inputSearchTerm.toLowerCase()))
                                                            .map(p => (
                                                                <button
                                                                    key={p.id}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setInputProductId(p.id)
                                                                        setInputProductName(p.name)
                                                                        setInputSearchTerm(p.name)
                                                                        setInputUnit(p.unit || 'Kg')
                                                                        setIsInputSearchOpen(false)
                                                                    }}
                                                                    className="w-full text-left px-5 py-3 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex flex-col"
                                                                >
                                                                    <span className="font-bold text-sm text-stone-800 dark:text-white">{p.name}</span>
                                                                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">{p.sku} • {p.unit}</span>
                                                                </button>
                                                            ))}
                                                        {products.length === 0 && (
                                                            <div className="px-5 py-4 text-center text-xs text-stone-400 font-medium italic">
                                                                Không tìm thấy sản phẩm nào. Vui lòng chọn kho đích trước.
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-stone-500">Số lượng ({inputUnit || '---'})</label>
                                                <input
                                                    type="number"
                                                    value={inputQuantity || ''}
                                                    onChange={e => setInputQuantity(parseFloat(e.target.value) || 0)}
                                                    className="w-full px-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 font-black text-lg focus:ring-4 focus:ring-emerald-100 outline-none transition-all"
                                                    placeholder="VD: 10000"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-6">
                                <div className="p-6 bg-white dark:bg-zinc-800/40 rounded-[28px] border border-stone-200 dark:border-zinc-800 shadow-sm space-y-6 h-full">
                                    <div className="flex items-center gap-2 text-stone-400 font-black text-[10px] uppercase tracking-widest">
                                        <Activity size={14} className="text-orange-500" /> Trạng thái & Thời gian
                                    </div>
                                    <div className="space-y-4">
                                        {isLocked ? (
                                            <div className={`px-6 py-4 rounded-2xl font-black text-center uppercase tracking-widest text-sm border-2 ${status === 'DONE' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600' : 'bg-orange-500/10 border-orange-500 text-orange-600'}`}>
                                                {status === 'DONE' ? 'Đã hoàn thành' : 'Đang triển khai'}
                                            </div>
                                        ) : (
                                            <div className="flex p-1 bg-stone-100 dark:bg-zinc-800 rounded-2xl">
                                                <button
                                                    type="button"
                                                    onClick={() => setStatus('IN_PROGRESS')}
                                                    className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${status === 'IN_PROGRESS' ? 'bg-white dark:bg-zinc-700 text-orange-600 shadow-sm' : 'text-stone-400'}`}
                                                >
                                                    Đang làm
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setStatus('DONE')}
                                                    className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${status === 'DONE' ? 'bg-white dark:bg-zinc-700 text-emerald-600 shadow-sm' : 'text-stone-400'}`}
                                                >
                                                    Hoàn thành
                                                </button>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-stone-400 uppercase">Bắt đầu</label>
                                                {isLocked ? (
                                                    <div className="text-xs font-black text-stone-800 dark:text-white px-1">
                                                        {startDate ? new Date(startDate).toLocaleDateString('vi-VN') : '---'}
                                                    </div>
                                                ) : (
                                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 text-xs font-bold" />
                                                )}
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-stone-400 uppercase">Kết thúc</label>
                                                {isLocked ? (
                                                    <div className="text-xs font-black text-stone-800 dark:text-white px-1">
                                                        {endDate ? new Date(endDate).toLocaleDateString('vi-VN') : '---'}
                                                    </div>
                                                ) : (
                                                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 text-xs font-bold" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Warehouse Filter (Global for items) */}
                        {!isLocked && (
                            <div className="flex items-center gap-6 p-6 bg-orange-500/5 dark:bg-orange-500/5 rounded-[28px] border border-orange-200/50 dark:border-orange-900/20">
                                <div className="p-3 bg-orange-600 text-white rounded-2xl shadow-lg shadow-orange-600/20">
                                    <Warehouse size={20} />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-black uppercase tracking-widest text-orange-600 dark:text-orange-400 mb-2 block">Cung cấp sản phẩm từ kho</label>
                                    <div className="flex gap-4">
                                        {systems.map(sys => (
                                            <button
                                                key={sys.code}
                                                type="button"
                                                onClick={() => setTargetSystemCode(sys.code)}
                                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${targetSystemCode === sys.code ? 'bg-orange-600 border-orange-600 text-white shadow-md shadow-orange-600/20' : 'bg-white dark:bg-zinc-800 border-stone-200 dark:border-zinc-700 text-stone-500 hover:border-orange-300'}`}
                                            >
                                                {sys.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Section 3: Product & Lot List (DYNAMIC) */}
                        <div className="space-y-4">
                            {!isLocked && (
                                <div className="flex items-center justify-between px-2">
                                    <div className="flex items-center gap-2 text-stone-400 font-black text-[10px] uppercase tracking-widest">
                                        <Package size={14} className="text-orange-500" /> Danh sách sản phẩm & Lot
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addLotRow}
                                        disabled={!targetSystemCode}
                                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-orange-600/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        <Plus size={16} /> Thêm sản phẩm
                                    </button>
                                </div>
                            )}

                            {/* Section Header for ReadOnly Mode */}
                            {isLocked && (
                                <div className="flex items-center gap-2 px-2 text-stone-400 font-black text-[10px] uppercase tracking-widest mb-2">
                                    <Package size={14} className="text-orange-500" /> Chi tiết Lệnh sản xuất {activeTab === 'allocations' && '& Cấp phát'}
                                </div>
                            )}
                            
                            {/* Tabs for View Mode */}
                            {isLocked && (
                                <div className="flex p-1 bg-stone-100 dark:bg-zinc-800 rounded-2xl w-fit mb-6">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('products')}
                                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'products' ? 'bg-white dark:bg-zinc-700 text-orange-600 shadow-sm' : 'text-stone-400'}`}
                                    >
                                        <Package size={14} />
                                        Sản phẩm đầu ra
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('allocations')}
                                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'allocations' ? 'bg-white dark:bg-zinc-700 text-blue-600 shadow-sm' : 'text-stone-400'}`}
                                    >
                                        <Truck className={activeTab === 'allocations' ? 'text-blue-600' : 'text-stone-400'} size={14} />
                                        Vật tư đã cấp phát
                                        {allocations.length > 0 && (
                                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === 'allocations' ? 'bg-blue-100 text-blue-600' : 'bg-stone-200 text-stone-500'}`}>
                                                {allocations.length}
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('analysis')}
                                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'analysis' ? 'bg-white dark:bg-zinc-700 text-emerald-600 shadow-sm' : 'text-stone-400'}`}
                                    >
                                        <TrendingUp className={activeTab === 'analysis' ? 'text-emerald-600' : 'text-stone-400'} size={14} />
                                        Phân tích hiệu suất
                                    </button>
                                </div>
                            )}

                            {isLocked && activeTab === 'analysis' && analysisSummary ? (
                                <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                                    {/* Progress Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="p-6 bg-white dark:bg-zinc-800/40 rounded-[32px] border border-stone-200 dark:border-zinc-800 shadow-sm space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                                                        <PieChart size={18} className="text-emerald-600" />
                                                    </div>
                                                    <span className="text-xs font-black uppercase tracking-widest text-stone-500">Tiến độ sản xuất</span>
                                                </div>
                                                <span className="text-lg font-black text-emerald-600">{summary.rate.toFixed(1)}%</span>
                                            </div>
                                            <div className="w-full bg-stone-100 dark:bg-zinc-700 h-3 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${Math.min(100, summary.rate)}%` }} />
                                            </div>
                                            <div className="flex justify-between text-[10px] font-bold text-stone-400">
                                                <span>THỰC TẾ: {summary.actual.toLocaleString('vi-VN')} KG</span>
                                                <span>KẾ HOẠCH: {summary.planned.toLocaleString('vi-VN')} KG</span>
                                            </div>
                                        </div>

                                        <div className="p-6 bg-white dark:bg-zinc-800/40 rounded-[32px] border border-stone-200 dark:border-zinc-800 shadow-sm space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-2 bg-blue-500/10 rounded-lg">
                                                        <Calendar size={18} className="text-blue-600" />
                                                    </div>
                                                    <span className="text-xs font-black uppercase tracking-widest text-stone-500">Tiến độ thời gian</span>
                                                </div>
                                                <span className="text-lg font-black text-blue-600">{analysisSummary.timeProgress.toFixed(1)}%</span>
                                            </div>
                                            <div className="w-full bg-stone-100 dark:bg-zinc-700 h-3 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${analysisSummary.timeProgress}%` }} />
                                            </div>
                                            <div className="flex justify-between text-[10px] font-bold text-stone-400">
                                                <span>BẮT ĐẦU: {startDate ? new Date(startDate).toLocaleDateString('vi-VN') : '---'}</span>
                                                <span>KẾ THÚC: {endDate ? new Date(endDate).toLocaleDateString('vi-VN') : '---'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Material Analysis (Production Loans) */}
                                    <div className="p-8 bg-black/5 dark:bg-white/5 rounded-[32px] border border-stone-200 dark:border-zinc-800">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="p-3 bg-white dark:bg-zinc-800 rounded-2xl shadow-sm text-emerald-600">
                                                <TrendingUp size={24} />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-stone-900 dark:text-white uppercase tracking-widest text-sm">Phân tích tỉ lệ tiêu hao Vật tư</h3>
                                                <p className="text-xs text-stone-500 font-bold italic">Dựa trên {analysisSummary?.actualTons.toFixed(2)} tấn thành phẩm thực tế</p>
                                            </div>
                                        </div>

                                        {!analysisSummary || analysisSummary.materials.length === 0 ? (
                                            <div className="p-12 text-center text-stone-400 font-bold bg-white/50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-stone-300 dark:border-zinc-700">
                                                Chưa có dữ liệu cấp phát vật tư để phân tích.
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {analysisSummary.materials.map((m, idx) => (
                                                    <div key={idx} className="bg-white dark:bg-zinc-800 p-6 rounded-2xl border border-stone-100 dark:border-zinc-700 shadow-sm flex flex-col gap-3 relative overflow-hidden group">
                                                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                                            <Package size={48} />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-black text-stone-400 uppercase tracking-tighter truncate">{m.name}</span>
                                                            <span className="text-[9px] font-mono text-stone-300">{m.sku}</span>
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-4 mt-2">
                                                            <div className="flex-1 flex flex-col items-center">
                                                                <span className="text-[10px] font-bold text-stone-400 uppercase">TIÊU THỤ</span>
                                                                <span className="text-sm font-black text-stone-700 dark:text-stone-200">{formatQuantityFull(m.total)} <span className="text-[10px]">{m.unit}</span></span>
                                                            </div>
                                                            <ArrowRight size={16} className="text-stone-200" />
                                                            <div className="flex-1 flex flex-col items-center">
                                                                <span className="text-[10px] font-black text-emerald-600 uppercase">TỈ LỆ / TẤN</span>
                                                                <span className="text-lg font-black text-emerald-600">
                                                                    {m.perTon.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
                                                                    <span className="text-[10px] ml-1 font-bold">{m.unit}</span>
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Daily Productivity Analysis */}
                                    <div className="p-8 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-[32px] border border-emerald-100 dark:border-emerald-900/20">
                                        <div className="flex items-center justify-between mb-8">
                                            <div className="flex items-center gap-3">
                                                <div className="p-3 bg-white dark:bg-zinc-800 rounded-2xl shadow-sm text-emerald-600">
                                                    <Activity size={24} />
                                                </div>
                                                <div>
                                                    <h3 className="font-black text-stone-900 dark:text-white uppercase tracking-widest text-sm">Năng suất sản xuất hàng ngày</h3>
                                                    <p className="text-xs text-stone-500 font-bold italic">Thống kê sản lượng thực tế theo ngày nhập kho</p>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <div className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Trung bình/Ngày</div>
                                                    <div className="text-sm font-black text-emerald-600">
                                                        {analysisSummary.avgOutput.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} Kg
                                                    </div>
                                                </div>
                                                <div className="w-px h-8 bg-stone-200 dark:bg-zinc-800" />
                                                <div className="text-right">
                                                    <div className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Ngày cao điểm</div>
                                                    <div className="text-sm font-black text-orange-600">
                                                        {analysisSummary.peakDay ? formatQuantityFull(analysisSummary.peakDay.quantity) : 0} Kg
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {dailyStats.length === 0 ? (
                                            <div className="p-12 text-center text-stone-400 font-bold bg-white/50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-stone-300 dark:border-zinc-700">
                                                Chưa có dữ liệu sản lượng hàng ngày.
                                            </div>
                                        ) : (
                                            <div className="flex flex-col lg:flex-row gap-8">
                                                {/* Daily Bar Chart with Grid */}
                                                <div className="flex-1 bg-white dark:bg-zinc-900 p-8 rounded-[32px] border border-stone-100 dark:border-zinc-800 shadow-sm relative overflow-hidden">
                                                    {/* Background Grid Lines */}
                                                    <div className="absolute inset-x-8 inset-y-8 flex flex-col justify-between pointer-events-none">
                                                        {[0, 1, 2, 3, 4].map((i) => (
                                                            <div key={i} className="w-full h-px bg-stone-50 dark:bg-zinc-800/50" />
                                                        ))}
                                                    </div>

                                                    <div className="h-64 w-full flex items-end gap-3 px-2 relative z-10">
                                                        {dailyStats.map((s, idx) => {
                                                            const height = analysisSummary.peakDay ? (s.quantity / analysisSummary.peakDay.quantity) * 100 : 0;
                                                            return (
                                                                <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                                                                    {/* Tooltip */}
                                                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[10px] font-black px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-20 shadow-xl scale-90 group-hover:scale-100">
                                                                        {formatQuantityFull(s.quantity)} Kg
                                                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-900 rotate-45" />
                                                                    </div>

                                                                    {/* Bar with gradient and shadow */}
                                                                    <div 
                                                                        className="w-full max-w-[40px] bg-gradient-to-t from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 rounded-t-xl transition-all duration-700 cursor-help shadow-[0_-4px_12px_rgba(16,185,129,0.2)]"
                                                                        style={{ height: `${Math.max(8, height)}%` }}
                                                                    />
                                                                    
                                                                    {/* Date Label */}
                                                                    <div className="absolute -bottom-10 flex flex-col items-center">
                                                                        <div className="text-[9px] font-black text-stone-400 uppercase tracking-tighter">
                                                                            {new Date(s.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                    {/* Legend spacing */}
                                                    <div className="h-8" /> 
                                                </div>

                                                {/* Daily List */}
                                                <div className="w-full lg:w-72 flex flex-col gap-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                                    {dailyStats.map((s, idx) => (
                                                        <div key={idx} className="bg-white/50 dark:bg-zinc-800/40 p-3 rounded-xl border border-stone-100 dark:border-zinc-800 flex items-center justify-between">
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-black text-stone-500 uppercase tracking-tight">
                                                                    {new Date(s.date).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                                                                </span>
                                                                <span className="text-[9px] text-stone-400 font-bold">{s.date}</span>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-xs font-black text-stone-800 dark:text-gray-200">{formatQuantityFull(s.quantity)} <span className="text-[9px] text-stone-400">Kg</span></div>
                                                                {analysisSummary.peakDay?.date === s.date && (
                                                                    <div className="text-[8px] text-orange-500 font-bold uppercase tracking-tighter">Cao điểm 🏆</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Raw Material Input Analysis (Only for RE_SORT) */}
                                    {productionType === 'RE_SORT' && analysisSummary && (
                                        <div className="p-8 bg-orange-500/5 dark:bg-orange-500/10 rounded-[32px] border border-orange-200 dark:border-orange-900/20">
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="p-3 bg-white dark:bg-zinc-800 rounded-2xl shadow-sm text-orange-600">
                                                    <Warehouse size={24} />
                                                </div>
                                                <div>
                                                    <h3 className="font-black text-stone-900 dark:text-white uppercase tracking-widest text-sm">Phân tích nguyên liệu đầu vào (Từ Kho)</h3>
                                                    <p className="text-xs text-stone-500 font-bold italic">Tổng cộng {formatQuantityFull(summary.totalInputWeight)} Kg nguyên liệu</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {(analysisSummary.inputStats || []).map((s: any, idx: number) => (
                                                    <div key={idx} className="bg-white dark:bg-zinc-800 p-6 rounded-2xl border border-stone-100 dark:border-zinc-700 shadow-sm flex flex-col gap-3 relative overflow-hidden group">
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-black text-stone-400 uppercase tracking-tighter truncate">{s.name}</span>
                                                            <div className="flex items-center justify-between mt-1">
                                                                <span className="text-[14px] font-black text-stone-800 dark:text-gray-100">
                                                                    {formatQuantityFull(s.totalWeight)} Kg
                                                                </span>
                                                                <span className="text-[10px] bg-orange-100/50 dark:bg-orange-950/30 text-orange-600 px-2 py-0.5 rounded-lg font-bold">
                                                                    {s.lotCount} LOT
                                                                </span>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="h-px bg-stone-50 dark:bg-zinc-800 w-full" />
                                                        
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[10px] font-black text-stone-400 uppercase">Tỉ lệ so với thành phẩm</span>
                                                            <span className="text-sm font-black text-stone-800 dark:text-white">
                                                                {summary.actual > 0 ? ((s.totalWeight / summary.actual) * 100).toFixed(1) : 0}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* Summary Card for RE_SORT */}
                                                <div className="bg-gradient-to-br from-orange-600 to-orange-700 p-6 rounded-2xl shadow-lg text-white flex flex-col justify-between relative overflow-hidden">
                                                    <div className="absolute -right-4 -bottom-4 opacity-10">
                                                        <Scale size={86} />
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Hao hụt sản xuất</span>
                                                    <div className="mt-2">
                                                        <div className="text-2xl font-black">{formatQuantityFull(summary.lossWeight)} Kg</div>
                                                        <div className="text-xs font-bold opacity-80">Tương đương {summary.lossRate.toFixed(1)}%</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : isLocked && activeTab === 'allocations' ? (
                                <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                                    {loadingAllocations ? (
                                        <div className="p-12 text-center bg-white dark:bg-zinc-800/40 rounded-[32px] border border-stone-200 dark:border-zinc-800 border-dashed">
                                            <Loader2 className="animate-spin mx-auto text-stone-300 mb-4" size={32} />
                                            <p className="text-stone-400 font-bold text-sm uppercase tracking-widest">Đang tải dữ liệu cấp phát...</p>
                                        </div>
                                    ) : allocations.length === 0 ? (
                                        <div className="p-20 text-center bg-white dark:bg-zinc-800/40 rounded-[32px] border border-stone-200 dark:border-zinc-800 border-dashed">
                                            <Package className="mx-auto text-stone-200 mb-4" size={48} />
                                            <p className="text-stone-400 font-bold text-sm uppercase tracking-widest">Chưa có vật tư nào được cấp phát cho lệnh này.</p>
                                        </div>
                                    ) : (
                                        <div className="bg-white dark:bg-zinc-800/40 rounded-[32px] border border-stone-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-stone-50/50 dark:bg-zinc-800/50 border-b border-stone-100 dark:border-zinc-800">
                                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Vật tư / Nguyên liệu</th>
                                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Đã cấp</th>
                                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-emerald-500">Đã dùng (Tiêu hao)</th>
                                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Người nhận</th>
                                                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400 text-right">Ngày cấp</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                                    {allocations.map((aln, aIdx) => (
                                                        <tr key={aln.id || aIdx} className="hover:bg-stone-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                                            <td className="px-6 py-4">
                                                                <div className="font-bold text-stone-900 dark:text-white text-sm">{aln.products?.name}</div>
                                                                <div className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-tighter">{aln.products?.sku || '---'}</div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="font-black text-blue-600 dark:text-blue-400 flex items-baseline gap-1">
                                                                    {formatQuantityFull(aln.quantity)}
                                                                    <span className="text-[10px] font-bold text-stone-400 uppercase">{aln.unit}</span>
                                                                </div>
                                                                {Number(aln.returned_quantity) > 0 && (
                                                                    <div className="text-[9px] text-emerald-500 font-bold mt-0.5">Đã trả: {formatQuantityFull(aln.returned_quantity)}</div>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="font-black text-orange-600 dark:text-orange-400 flex items-baseline gap-1">
                                                                    {formatQuantityFull((aln.quantity || 0) - (aln.returned_quantity || 0))}
                                                                    <span className="text-[10px] font-bold text-stone-400 uppercase">{aln.unit}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="text-sm font-medium text-stone-600 dark:text-stone-400 flex items-center gap-2">
                                                                    <Users size={14} className="text-stone-300" />
                                                                    {aln.worker_name || 'N/A'}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="text-xs font-bold text-stone-500">
                                                                    {new Date(aln.loan_date || aln.created_at).toLocaleDateString('vi-VN')}
                                                                </div>
                                                                <div className="text-[9px] text-stone-400 italic">
                                                                    {new Date(aln.loan_date || aln.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {isLocked && (
                                        <div className="flex flex-wrap items-center justify-between gap-4 bg-blue-50/50 dark:bg-blue-500/5 p-4 rounded-[28px] border border-blue-100/50 dark:border-blue-900/20">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 bg-blue-500/10 rounded-xl">
                                                    <Calendar size={20} className="text-blue-600" />
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest leading-none mb-1">Lọc sản lượng thực tế</div>
                                                    <div className="text-[11px] font-bold text-stone-500 uppercase tracking-tight">Dựa trên ngày nhập kho của lô hàng</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 px-4 py-2 rounded-2xl border border-stone-100 dark:border-zinc-700 shadow-sm">
                                                    <div className="flex items-center gap-2 text-xs font-bold text-stone-600 dark:text-stone-300">
                                                        <input 
                                                            type="date" 
                                                            value={statsStartDate}
                                                            onChange={e => setStatsStartDate(e.target.value)}
                                                            className="bg-transparent border-none focus:ring-0 outline-none w-32"
                                                        />
                                                        <ArrowRight size={14} className="text-stone-300" />
                                                        <input 
                                                            type="date" 
                                                            value={statsEndDate}
                                                            onChange={e => setStatsEndDate(e.target.value)}
                                                            className="bg-transparent border-none focus:ring-0 outline-none w-32"
                                                        />
                                                    </div>
                                                </div>
                                                <button 
                                                    type="button" 
                                                    onClick={() => {
                                                        setStatsStartDate('')
                                                        setStatsEndDate('')
                                                    }}
                                                    className="p-2 text-stone-400 hover:text-stone-600 transition-colors"
                                                    title="Xóa bộ lọc"
                                                >
                                                    <X size={18} />
                                                </button>
                                                {isRefreshingStats && <Loader2 size={18} className="animate-spin text-blue-500 ml-2" />}
                                            </div>
                                        </div>
                                    )}

                                    <div className={isLocked ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-3'}>
                                    {lots.map((lot, idx) => {
                                        const product = products.find(p => p.id === lot.product_id);
                                        // Placeholder for convertUnit, assuming it would be provided by a context or hook
                                        // For now, it's a no-op to avoid runtime errors.
                                        // const convertUnit = (productId: string, fromUnit: string, toUnit: string, quantity: number, baseUnit: string, unitMap: Map<string, string>, convMap: Map<string, Map<string, number>>) => quantity;
                                        // Example usage if `selectedProduct` was defined:
                                        // (qty, from, to) => convertUnit(selectedProduct.id, from, to, qty, selectedProduct.unit, unitNameMap, conversionMap);
                                        
                                        if (isLocked) {
                                            return (
                                                <div key={idx} className="bg-white dark:bg-zinc-800/60 p-6 rounded-[28px] border border-stone-200 dark:border-zinc-800 shadow-sm flex flex-col gap-4 relative overflow-hidden group hover:border-blue-400 transition-all duration-300">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex gap-3">
                                                            <div className="p-2.5 bg-blue-500/10 rounded-xl">
                                                                <Package size={20} className="text-blue-600" />
                                                            </div>
                                                            <div>
                                                                <div className="font-black text-stone-900 dark:text-white leading-tight">{pName(lot, product)}</div>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <div className="text-[10px] font-mono font-bold text-stone-400 tracking-tighter uppercase leading-none">{lot.lot_code}</div>
                                                                    <div className="text-[9px] text-orange-600 font-bold bg-orange-100/50 dark:bg-orange-950/30 px-2 py-0.5 rounded-md leading-none flex items-center gap-1">
                                                                        Quy cách:
                                                                        {lot.conversion_rules && (lot.conversion_rules as any[]).length > 0 ? (
                                                                            (lot.conversion_rules as any[]).map((r: any, i: number) => (
                                                                                <span key={i} className="flex items-center gap-1">
                                                                                    1 {r.unit_name || '?'} = {r.factor} {r.ref_unit_name}
                                                                                    {i < (lot.conversion_rules?.length || 0) - 1 && <span className="mx-1 text-orange-200">|</span>}
                                                                                </span>
                                                                            ))
                                                                        ) : (
                                                                            <span> 1 {lot.unit || 'đv'} = {lot.weight_per_unit || 0} Kg</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Kế hoạch</div>
                                                            <div className="font-black text-stone-800 dark:text-white text-sm">
                                                                {(lot.planned_quantity || 0).toLocaleString('vi-VN')}
                                                                <span className="text-[10px] ml-1 text-stone-400 italic">{(lot.unit || product?.unit || 'Kg')}</span>
                                                            </div>
                                                            <div className="text-[8px] text-zinc-400 font-bold block mt-1">~ {((lot.planned_quantity || 0) * (lot.weight_per_unit || product?.weight_kg || 1)).toLocaleString('vi-VN')} kg</div>
                                                        </div>
                                                    </div>

                                                    <div className="h-px bg-stone-100 dark:bg-zinc-800 w-full" />

                                                    <div className="flex items-center justify-between">
                                                        <div className="flex flex-col">
                                                            <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Đã sản xuất (Thực tế)</div>
                                                            <div className="font-black text-blue-600 dark:text-blue-400 text-lg flex items-baseline gap-1">
                                                                {(lot as any).quantity_by_unit && (lot as any).quantity_by_unit.length > 0 ? (
                                                                    <div className="flex flex-wrap gap-1 items-center">
                                                                        {(lot as any).quantity_by_unit.map((q: any, i: number) => (
                                                                            <span key={i} className="flex items-baseline gap-0.5 whitespace-nowrap">
                                                                                {Number(q.qty).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
                                                                                <span className="text-[10px] font-normal text-stone-500 uppercase tracking-wider">{q.unit}</span>
                                                                                {i < (lot as any).quantity_by_unit.length - 1 && <span className="mx-0.5 text-stone-300">•</span>}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <span>{(lot.actual_quantity || 0).toLocaleString('vi-VN')} <span className="text-xs">{lot.unit || 'Kg'}</span></span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Circular Progress (Mini) */}
                                                        {(() => {
                                                             const pk = (lot.planned_quantity || 0) * (lot.weight_per_unit || product?.weight_kg || 1)
                                                             const ak = lot.actual_quantity || 0
                                                             const percent = pk > 0 ? Math.min(100, (ak / pk) * 100) : 0
                                                             return (
                                                                <div className="flex items-center gap-2">
                                                                    <div className="text-right">
                                                                        <div className="text-[14px] font-black text-stone-800 dark:text-white leading-none">{percent.toFixed(0)}%</div>
                                                                        <div className="text-[8px] text-zinc-400 font-bold uppercase tracking-tighter">Hoàn thành</div>
                                                                    </div>
                                                                    <div className="relative w-10 h-10">
                                                                        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                                                            <path
                                                                                className="stroke-stone-100 dark:stroke-zinc-800 fill-none"
                                                                                strokeWidth="4"
                                                                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                                            />
                                                                            <path
                                                                                className="stroke-blue-500 fill-none transition-all duration-1000"
                                                                                strokeWidth="4"
                                                                                strokeDasharray={`${percent}, 100`}
                                                                                strokeLinecap="round"
                                                                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                                            />
                                                                        </svg>
                                                                    </div>
                                                                </div>
                                                             )
                                                        })()}
                                                    </div>
                                                    
                                                    {/* Converted total for the card */}
                                                    <div className="mt-1 text-[10px] font-bold text-stone-400 italic">
                                                        Quy đổi tổng cộng: {(lot.actual_quantity || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} kg
                                                    </div>
                                                </div>
                                            )
                                        }

                                        return (
                                        <div key={idx} className="bg-white dark:bg-zinc-800/40 p-5 rounded-[32px] border border-stone-200 dark:border-zinc-800 shadow-sm relative animate-in slide-in-from-right-2 duration-200 flex flex-col gap-4">
                                            {/* Row 1: Product Selection (Full Width) */}
                                            <div className="relative">
                                                <label className="text-[10px] font-bold text-stone-400 uppercase mb-1.5 block px-1 tracking-widest">Sản phẩm sản xuất</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder="Tìm và chọn sản phẩm từ kho..."
                                                        value={rowSearchTerms[idx] || ''}
                                                        onFocus={() => {
                                                            setActiveRowIdx(idx)
                                                            if (!rowSearchTerms[idx]) setRowSearchTerms(p => ({ ...p, [idx]: '' }))
                                                        }}
                                                        onChange={e => {
                                                            setRowSearchTerms(p => ({ ...p, [idx]: e.target.value }))
                                                            setActiveRowIdx(idx)
                                                        }}
                                                        className="w-full px-5 py-4 pl-12 rounded-2xl bg-stone-50 dark:bg-zinc-900 border border-stone-100 dark:border-zinc-800 font-black focus:ring-4 focus:ring-orange-100 outline-none transition-all text-sm text-stone-800 dark:text-white"
                                                    />
                                                    <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-orange-500" />
                                                </div>

                                                {/* Line Product Results */}
                                                {activeRowIdx === idx && (
                                                    <div className="absolute z-[120] top-full mt-2 w-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-2xl shadow-2xl max-h-[250px] overflow-y-auto">
                                                        {products
                                                            .filter(p => p.name.toLowerCase().includes((rowSearchTerms[idx] || '').toLowerCase()) || (p.sku && p.sku.toLowerCase().includes((rowSearchTerms[idx] || '').toLowerCase())))
                                                            .map(p => (
                                                                <button
                                                                    key={p.id}
                                                                    type="button"
                                                                    onClick={() => selectProductForRow(idx, p)}
                                                                    className="w-full text-left px-5 py-3 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors border-b border-stone-50 dark:border-zinc-800 last:border-0"
                                                                >
                                                                    <div className="font-bold text-sm text-stone-800 dark:text-gray-200">{p.name}</div>
                                                                    <div className="text-[10px] font-mono text-stone-400">{p.sku || 'N/A'}</div>
                                                                </button>
                                                            ))
                                                        }
                                                    </div>
                                                )}
                                                {activeRowIdx === idx && <div className="fixed inset-0 z-[115]" onClick={() => setActiveRowIdx(null)} />}
                                            </div>

                                            {/* Row 2: Lot Details & Numbers */}
                                            <div className="grid grid-cols-12 gap-4 items-end bg-stone-50/50 dark:bg-zinc-900/30 p-4 rounded-2xl border border-stone-100 dark:border-zinc-800/50">
                                                {/* Details Section: Lot Code & Conversion Rules */}
                                                <div className="col-span-12 bg-white dark:bg-zinc-900/50 p-6 space-y-6 border border-stone-200 dark:border-zinc-800 rounded-2xl mt-1">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        {/* Lot Code Input */}
                                                        <div>
                                                            <label className="block text-xs font-bold text-stone-500 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                                                                <Hash size={14} className="text-orange-500" />
                                                                Mã LOT Sản xuất
                                                            </label>
                                                            <input
                                                                type="text"
                                                                placeholder="L003CC260-TN..."
                                                                value={lot.lot_code}
                                                                onChange={e => updateLotRow(idx, 'lot_code', e.target.value.toUpperCase())}
                                                                className="w-full px-4 py-2.5 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 font-black focus:ring-4 focus:ring-orange-100 outline-none transition-all text-sm uppercase text-stone-900 dark:text-white"
                                                            />
                                                        </div>

                                                        {/* Base Unit Display */}
                                                        <div>
                                                            <label className="block text-xs font-bold text-stone-500 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                                                                <Weight size={14} className="text-orange-500" />
                                                                Đơn vị cơ bản
                                                            </label>
                                                            <div className="px-4 py-2.5 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-stone-500 dark:text-stone-400 italic">
                                                                {lot.unit || 'Kg'} (Mặc định)
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="pt-4 border-t border-stone-100 dark:border-zinc-800 space-y-4">
                                                        <div className="flex items-center gap-2">
                                                            <Scale size={18} className="text-orange-500" />
                                                            <h3 className="font-semibold text-stone-800 dark:text-stone-200 text-sm">Đơn vị quy đổi khác</h3>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider">Đơn vị quy đổi khác</label>
                                                        {(lot.conversion_rules || []).map((rule, rIdx) => (
                                                            <div key={rIdx} className="flex items-center gap-3 p-3 bg-stone-50 dark:bg-zinc-800/50 rounded-xl border border-stone-200 dark:border-zinc-800">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm font-black text-stone-400 w-4 text-center">1</span>
                                                                </div>

                                                                <div className="flex-1">
                                                                    <select
                                                                        value={rule.unit_name}
                                                                        onChange={e => {
                                                                            const newLots = [...lots];
                                                                            const rules = [...(newLots[idx].conversion_rules || [])];
                                                                            rules[rIdx].unit_name = e.target.value;
                                                                            newLots[idx].conversion_rules = rules;
                                                                            newLots[idx].weight_per_unit = calculateFinalWeight(newLots[idx]);
                                                                            setLots(newLots);
                                                                        }}
                                                                        className="w-full bg-white dark:bg-zinc-900 border border-stone-300 dark:border-zinc-700 text-stone-800 dark:text-stone-200 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block p-2.5 outline-none"
                                                                    >
                                                                        <option value="">-- Chọn Đơn vị --</option>
                                                                        {units.filter(u => u.name !== lot.unit).map(u => {
                                                                            const hasWeightInName = u.name.includes('(') && (u.name.toLowerCase().includes('kg') || u.name.toLowerCase().includes('g'))
                                                                            let label = u.name
                                                                            
                                                                            if (!hasWeightInName) {
                                                                                const product = products.find(p => p.id === lot.product_id)
                                                                                const pUnit = (product as any)?.product_units?.find((pu: any) => pu.unit_id === u.id)
                                                                                
                                                                                // Prefer conversion_rate from DB, fallback to current lot weight if it's "Thùng"
                                                                                const factor = pUnit ? pUnit.conversion_rate : (u.name === 'Thùng' ? lot.weight_per_unit : 0)
                                                                                
                                                                                if (factor > 0) {
                                                                                    label = `${u.name} (${factor}kg)`
                                                                                }
                                                                            }

                                                                            return <option key={u.id} value={label}>{label}</option>
                                                                        })}
                                                                    </select>
                                                                </div>

                                                                <span className="text-stone-400 font-bold">=</span>

                                                                <div className="w-24">
                                                                    <input 
                                                                        type="number"
                                                                        step="0.01"
                                                                        value={rule.factor}
                                                                        onChange={e => {
                                                                            const newLots = [...lots];
                                                                            const rules = [...(newLots[idx].conversion_rules || [])];
                                                                            rules[rIdx].factor = parseFloat(e.target.value) || 0;
                                                                            newLots[idx].conversion_rules = rules;
                                                                            newLots[idx].weight_per_unit = calculateFinalWeight(newLots[idx]);
                                                                            setLots(newLots);
                                                                        }}
                                                                        className="w-full bg-white dark:bg-zinc-900 border border-stone-300 dark:border-zinc-700 text-stone-800 dark:text-stone-200 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block p-2.5 text-center font-black outline-none"
                                                                        placeholder="Tỉ lệ"
                                                                    />
                                                                </div>

                                                                <div className="flex-1">
                                                                    <select
                                                                        value={rule.ref_unit_name}
                                                                        onChange={e => {
                                                                            const newLots = [...lots];
                                                                            const rules = [...(newLots[idx].conversion_rules || [])];
                                                                            rules[rIdx].ref_unit_name = e.target.value;
                                                                            newLots[idx].conversion_rules = rules;
                                                                            newLots[idx].weight_per_unit = calculateFinalWeight(newLots[idx]);
                                                                            setLots(newLots);
                                                                        }}
                                                                        className="w-full bg-white dark:bg-zinc-900 border border-stone-300 dark:border-zinc-700 text-stone-800 dark:text-stone-200 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block p-2.5 outline-none"
                                                                    >
                                                                        {getAvailableRefs(idx, rIdx).map(refName => (
                                                                            <option key={refName} value={refName}>
                                                                                {refName} {refName === lot.unit ? '(Cơ bản)' : ''}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </div>

                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newLots = [...lots];
                                                                        const rules = (newLots[idx].conversion_rules || []).filter((_, i) => i !== rIdx);
                                                                        newLots[idx].conversion_rules = rules;
                                                                        newLots[idx].weight_per_unit = calculateFinalWeight(newLots[idx]);
                                                                        setLots(newLots);
                                                                    }}
                                                                    className="p-2 text-stone-400 hover:text-red-500 hover:bg-stone-100 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                                                                >
                                                                    <X size={18} />
                                                                </button>
                                                            </div>
                                                        ))}

                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const newLots = [...lots];
                                                                const rules = [...(newLots[idx].conversion_rules || [])];
                                                                const lastRef = rules.length > 0 ? rules[rules.length - 1].unit_name : (newLots[idx].unit || 'Kg');
                                                                rules.push({ factor: 1, unit_name: '', ref_unit_name: lastRef });
                                                                newLots[idx].conversion_rules = rules;
                                                                setLots(newLots);
                                                            }}
                                                            className="flex items-center gap-2 text-sm text-orange-600 font-bold hover:text-orange-700 px-2 py-1 transition-colors"
                                                        >
                                                            <Plus size={16} />
                                                            Thêm đơn vị quy đổi
                                                        </button>
                                                    </div>

                                                    {(lot.conversion_rules || []).length > 0 && (
                                                        <div className="pt-4 border-t border-stone-100 dark:border-zinc-800 flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-black text-stone-400 uppercase">Chuỗi quy đổi:</span>
                                                                <span className="text-[10px] font-bold text-orange-600 flex items-center gap-1 italic">
                                                                    {lot.conversion_rules?.map((r, i) => (
                                                                        <span key={i} className="flex items-center gap-1">
                                                                            1 {r.unit_name || '?'} = {r.factor} {r.ref_unit_name}
                                                                            {i < (lot.conversion_rules?.length || 0) - 1 && <span className="mx-1 text-stone-300">|</span>}
                                                                        </span>
                                                                    ))}
                                                                </span>
                                                            </div>
                                                            <div className="text-xs font-black text-stone-800 dark:text-stone-200">
                                                                QUY CÁCH CUỐI: <span className="text-orange-600">{(lot.weight_per_unit || 0).toLocaleString('vi-VN')} KG</span> /{lot.conversion_rules![0]?.unit_name || lot.unit}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Actual Quantity Display */}
                                                <div className="col-span-12 lg:col-span-4 relative mt-2">
                                                    <label className="text-[10px] font-bold text-blue-500 uppercase mb-1.5 block tracking-widest">Đã sản xuất (Thực tế)</label>
                                                    <div className="bg-blue-50/50 dark:bg-blue-500/5 px-4 py-2.5 rounded-xl border border-blue-100/50 dark:border-blue-900/20 overflow-hidden min-h-[46px] flex flex-col justify-center">
                                                        <div className="font-black text-stone-900 dark:text-stone-100 text-xs truncate">
                                                            {(lot as any).quantity_by_unit && (lot as any).quantity_by_unit.length > 0 ? (
                                                                <div className="flex flex-wrap gap-1 items-center">
                                                                    {(lot as any).quantity_by_unit.map((q: any, i: number) => (
                                                                        <span key={i} className="flex items-baseline gap-0.5 whitespace-nowrap">
                                                                            {Number(q.qty).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
                                                                            <span className="text-[9px] font-normal text-stone-500 uppercase tracking-wider">{q.unit}</span>
                                                                            {i < (lot as any).quantity_by_unit.length - 1 && <span className="mx-0.5 text-stone-300">•</span>}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span className="flex items-baseline gap-1">
                                                                    {(lot.actual_quantity || 0).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
                                                                    <span className="text-[9px] font-normal text-stone-500 uppercase tracking-wider">
                                                                        {lot.unit || product?.unit || 'Kg'}
                                                                    </span>
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-[8px] text-zinc-400 font-bold italic line-clamp-1">~ {(lot.actual_quantity || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} kg</span>
                                                    </div>
                                                </div>

                                                {/* Planned Quantity Input */}
                                                <div className="col-span-12 lg:col-span-4 relative mt-2">
                                                    <label className="text-[10px] font-bold text-orange-500 uppercase mb-1.5 block tracking-widest">Kế hoạch sản xuất</label>
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            placeholder="0"
                                                            value={lot.planned_quantity || ''}
                                                            onChange={e => updateLotRow(idx, 'planned_quantity', e.target.value ? parseFloat(e.target.value) : null)}
                                                            className="w-full px-5 py-3 pl-12 rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/20 font-black text-orange-600 focus:ring-4 focus:ring-orange-100 outline-none transition-all text-sm"
                                                        />
                                                        <Activity size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-400" />
                                                    </div>
                                                </div>

                                                {/* Action Row for Item */}
                                                <div className="col-span-12 lg:col-span-4 flex items-end justify-between px-2 pb-1 mt-2">
                                                    <div className="flex items-center gap-4">
                                                        {/* Status info or extra fields could go here */}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeLotRow(idx)}
                                                        className="flex items-center gap-2 px-6 py-3 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all font-bold text-xs uppercase tracking-widest active:scale-95"
                                                    >
                                                        <Trash2 size={16} /> Gỡ bỏ sản phẩm
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        )
                                    })}
                                </div>
                            </div>
                            )}
                        </div>

                        {/* Description */}
                        <div className="space-y-2 px-2">
                             <label className="text-[10px] font-black uppercase tracking-widest text-stone-400">Ghi chú lệnh sản xuất</label>
                             {isLocked ? (
                                <div className="p-6 rounded-[24px] bg-white dark:bg-zinc-800/40 border border-stone-100 dark:border-zinc-800 text-stone-600 dark:text-gray-400 text-sm italic">
                                    {description || 'Không có ghi chú.'}
                                </div>
                             ) : (
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    rows={2}
                                    className="w-full px-6 py-4 rounded-[24px] bg-white dark:bg-zinc-800/40 border border-stone-100 dark:border-zinc-800 focus:outline-none focus:ring-4 focus:ring-orange-100 outline-none transition-all font-medium text-stone-800 dark:text-gray-200"
                                />
                             )}
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="px-8 py-6 border-t border-stone-100 dark:border-zinc-800 bg-white dark:bg-zinc-800 flex items-center justify-end gap-3 shrink-0 shadow-lg">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-3 rounded-2xl border border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-gray-300 font-bold hover:bg-stone-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                        {isLocked ? 'Đóng lại' : 'Hủy bỏ'}
                    </button>
                    {!isLocked && (
                        <button
                            form="prod-form"
                            type="submit"
                            disabled={isSaving || isFetchingLots}
                            className="px-10 py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black uppercase tracking-widest shadow-xl shadow-orange-600/30 flex items-center gap-2 transition-all transform active:scale-95 disabled:opacity-70"
                        >
                            {(isSaving || isFetchingLots) ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                            {isFetchingLots ? 'ĐANG TẢI DỮ LIỆU...' : (editItem ? 'LƯU THAY ĐỔI' : 'TẠO LỆNH SẢN XUẤT')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
