'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Plus, Save, FileText, Calendar, Info, Activity, Factory, Package, Users, Weight, Hash, Trash2, Wand2, Search, Loader2, Warehouse, ChevronDown, CheckCircle2, X, Scale, Truck, TrendingUp, PieChart, ArrowRight, Leaf, RotateCw, Lock, Unlock, QrCode, Copy, Edit } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useUser } from '@/contexts/UserContext'
import { useSystem } from '@/contexts/SystemContext'
import { extractWeightFromName, MAIN_PACKAGE_UNITS, normalizeUnit, convertUnit } from '@/lib/unitConversion'
import { formatQuantityFull } from '@/lib/numberUtils'
import { productionLoanService } from '@/services/production-inventory/productionLoanService'

import type { ProductionLot, ProductionModalProps } from './production-modal/types'
import { ProductionGeneralInfoSection } from './production-modal/ProductionGeneralInfoSection'
import { ProductionAnalysisTab } from './production-modal/ProductionAnalysisTab'
import { EditChildLotModal } from './production-modal/EditChildLotModal'


export default function ProductionModal({ isOpen, onClose, onSuccess, editItem, readOnly = false }: ProductionModalProps) {
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
    const isLocked = readOnly || editItem?.status === 'DONE';
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
    const [mainTab, setMainTab] = useState<'LOTS' | 'STATS'>('LOTS')
    const [lotStatusFilter, setLotStatusFilter] = useState<'ALL' | 'ACTIVE' | 'LOCKED'>('ACTIVE')

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
    
    // States for inline add lot (under readOnly/isLocked mode for IN_PROGRESS orders)
    const [showInlineAddLot, setShowInlineAddLot] = useState(false)
    const [inlineProductId, setInlineProductId] = useState('')
    const [inlineLotCode, setInlineLotCode] = useState('')
    const [inlinePlannedQty, setInlinePlannedQty] = useState(0)
    const [inlineWeightPerUnit, setInlineWeightPerUnit] = useState(0)
    const [inlineSearchTerm, setInlineSearchTerm] = useState('')
    const [inlineShowSuggestions, setInlineShowSuggestions] = useState(false)
    const [inlineProductionDate, setInlineProductionDate] = useState(new Date().toISOString().split('T')[0])

    // States for editing a lot directly under readOnly mode
    const [editingLot, setEditingLot] = useState<any | null>(null)
    const [editLotProductId, setEditLotProductId] = useState('')
    const [editLotLotCode, setEditLotLotCode] = useState('')
    const [editLotPlannedQty, setEditLotPlannedQty] = useState(0)
    const [editLotWeightPerUnit, setEditLotWeightPerUnit] = useState(0)
    const [editLotSearchTerm, setEditLotSearchTerm] = useState('')
    const [editLotShowSuggestions, setEditLotShowSuggestions] = useState(false)
    const [editLotProductionDate, setEditLotProductionDate] = useState('')
    
    // Stats Date Filters
    const [statsStartDate, setStatsStartDate] = useState<string>('')
    const [statsEndDate, setStatsEndDate] = useState<string>('')
    const [isRefreshingStats, setIsRefreshingStats] = useState(false)
    const [dailyStats, setDailyStats] = useState<{ date: string, quantity: number }[]>([])

    // Summary calculations
    const summary = useMemo(() => {
        let planned = 0
        let actual = 0
        let inventory = 0
        lots.forEach(l => {
            planned += (l.planned_quantity || 0) * (l.weight_per_unit || 1)
            actual += l.actual_quantity || 0
            inventory += l.inventory_quantity || 0
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

        return { planned, actual, inventory, rate, totalInputWeight, lossWeight, lossRate }
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

    const fetchUnits = async (sysCode: string) => {
        const { data } = await (supabase.from('units') as any)
            .select('*')
            .eq('system_code', sysCode)
            .eq('is_active', true)
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
                    // Dùng initial_quantity (số gốc khi SX) để không bị ảnh hưởng bởi xuất kho
                    const { data: itemsData, error: itemsErr } = await supabase
                        .from('lot_items')
                        .select('quantity, initial_quantity, unit, lot_id, product_id')
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

                        // Create a lookup map for warehouse lots to their production_lot_id
                        const lotToPLMap: Record<string, string> = {}
                        matchedLots.forEach((ml: any) => {
                            if (ml.production_lot_id) {
                                lotToPLMap[ml.id] = ml.production_lot_id
                            }
                        })
                        
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
                            // Link item to production slot via its parent lot''s production_lot_id
                            const plId = lotToPLMap[item.lot_id]
                            
                            if (!plId) return
                            
                            // Calculate weight factor
                            const weightFactor = productMap[item.product_id] || extractWeight(item.unit) || 1.0

                            if (!agg[plId]) agg[plId] = { production_lot_id: plId, actual_quantity: 0, inventory_quantity: 0, quantity_by_unit: [] }
                            
                            const itemQty = item.initial_quantity || item.quantity
                            agg[plId].actual_quantity += (itemQty * weightFactor)
                            agg[plId].inventory_quantity += (item.quantity * weightFactor)

                            const weightSuffix = (weightFactor > 1 && !item.unit.includes('(')) ? ` (${weightFactor}kg)` : ''
                            const displayUnit = item.unit + weightSuffix
                            
                            const unitEntry = agg[plId].quantity_by_unit.find((u: any) => u.unit === displayUnit)
                            if (unitEntry) {
                                unitEntry.qty += itemQty
                                unitEntry.current_qty = (unitEntry.current_qty || 0) + item.quantity
                            } else {
                                agg[plId].quantity_by_unit.push({ qty: itemQty, current_qty: item.quantity, unit: displayUnit })
                            }
                        })
                        
                        statsData = Object.values(agg)
                    }
                }
            } else {
                // Default: use the optimized view
                const { data } = await supabase
                    .from('production_item_statistics' as any)
                    .select('production_lot_id, actual_quantity, current_inventory, quantity_by_unit')
                    .in('production_lot_id', lotIds) as { data: any[] | null }
                statsData = data || []
            }

            // 3. Map back to enriched lots
            const statsMap: Record<string, { actual: number, inventory: number, by_unit: any[] }> = {}
            statsData.forEach((s: any) => { 
                statsMap[s.production_lot_id] = { 
                    actual: s.actual_quantity, 
                    inventory: s.current_inventory || s.inventory_quantity || 0,
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
                    .select('quantity, initial_quantity, unit, lot_id, product_id')
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
                        const dailyQty = item.initial_quantity || item.quantity
                        dailyMap[date] = (dailyMap[date] || 0) + (dailyQty * weightFactor)
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
                inventory_quantity: statsMap[l.id]?.inventory || 0,
                quantity_by_unit: statsMap[l.id]?.by_unit || [],
                unit: l.products?.unit || '',
                product_name: l.products?.name || '',
                conversion_rules: l.conversion_rules || [],
                is_locked: l.is_locked,
                production_date: l.production_date
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
            setLotStatusFilter('ACTIVE')

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
            setMainTab('LOTS')
            setLotStatusFilter('ACTIVE')
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
            fetchUnits(targetSystemCode)
        } else {
            setProducts([])
            setUnits([])
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
        setLots([...lots, { 
            id: crypto.randomUUID(),
            lot_code: '', 
            product_id: null, 
            weight_per_unit: 0, 
            planned_quantity: null, 
            conversion_rules: [] 
        }])
    }

    const cloneLotRow = (index: number) => {
        const lotToClone = lots[index];
        // Create a new version of the lot WITH a new ID to ensure it''s treated as a new insert during upsert
        const newLotCode = lotToClone.lot_code ? `${lotToClone.lot_code}-COPY` : '';
        
        const clonedLot = {
            ...lotToClone,
            id: crypto.randomUUID(), // Generate new UUID
            lot_code: newLotCode,
            // Reset statistics for the new clone
            actual_quantity: 0,
            inventory_quantity: 0,
            quantity_by_unit: []
        };
        
        const newLots = [...lots];
        newLots.splice(index + 1, 0, clonedLot);
        setLots(newLots);
        
        // Copy search term if exists
        if (rowSearchTerms[index]) {
            setRowSearchTerms(prev => ({ ...prev, [index + 1]: rowSearchTerms[index] }));
        }
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

    const toggleLotLock = async (lotId: string, currentLocked: boolean) => {
        const { error } = await (supabase.from('production_lots') as any).update({ is_locked: !currentLocked }).eq('id', lotId)
        
        if (error) {
            showToast('Lỗi: ' + error.message, 'error')
        } else {
            showToast(`Đã ${!currentLocked ? 'khóa' : 'mở khóa'} mã lot thành công`, 'success')
            setLots(prev => prev.map(l => l.id === lotId ? { ...l, is_locked: !currentLocked } : l))
            onSuccess()
        }
    }

    const handleDuplicateLot = async (lot: any) => {
        if (!editItem?.id) return
        
        let nextIndex = lots.length + 1
        const codePrefix = code || 'LOT'
        let newLotCode = `${codePrefix}-L${nextIndex}`
        
        const checkDup = async (codeStr: string) => {
            const { data } = await supabase
                .from('production_lots')
                .select('id')
                .eq('lot_code', codeStr.trim().toUpperCase())
                .maybeSingle()
            return !!data
        }

        let isDup = await checkDup(newLotCode)
        while (isDup) {
            nextIndex++
            newLotCode = `${codePrefix}-L${nextIndex}`
            isDup = await checkDup(newLotCode)
        }

        const newLotData = {
            production_id: editItem.id,
            lot_code: newLotCode,
            product_id: lot.product_id,
            weight_per_unit: lot.weight_per_unit || 0,
            planned_quantity: lot.planned_quantity || null,
            conversion_rules: lot.conversion_rules || [],
            company_id: profile?.company_id,
            is_locked: false
        }

        if (!await showConfirm(`Bạn có muốn nhân bản mã Lot "${lot.lot_code}" thành mã Lot mới "${newLotCode}"?`)) return

        const { error } = await (supabase.from('production_lots') as any)
            .insert(newLotData)

        if (error) {
            showToast('Lỗi nhân bản mã Lot: ' + error.message, 'error')
        } else {
            showToast('Nhân bản mã Lot thành công!', 'success')
            fetchProductionLots(editItem.id)
            if (onSuccess) onSuccess()
        }
    }

    const handleSaveInlineLot = async () => {
        if (!editItem?.id) return
        if (!inlineProductId) {
            showToast('Vui lòng chọn sản phẩm!', 'warning')
            return
        }
        if (!inlineLotCode.trim()) {
            showToast('Vui lòng nhập mã Lot!', 'warning')
            return
        }
        
        const { data: dupLot } = await supabase
            .from('production_lots')
            .select('id')
            .eq('lot_code', inlineLotCode.trim().toUpperCase())
            .maybeSingle()
            
        if (dupLot) {
            showToast(`Mã Lot "${inlineLotCode.trim()}" đã tồn tại trên hệ thống!`, 'warning')
            return
        }

        const product = products.find(p => p.id === inlineProductId)
        const defaultWeight = inlineWeightPerUnit || product?.weight_kg || 0
        const defaultUnit = product?.unit || 'Kg'
        const initialRules = defaultWeight > 0 
            ? [{ factor: defaultWeight, unit_name: `Thùng (${defaultWeight}kg)`, ref_unit_name: defaultUnit }] 
            : []

        const newLotData = {
            production_id: editItem.id,
            lot_code: inlineLotCode.trim().toUpperCase(),
            product_id: inlineProductId,
            weight_per_unit: defaultWeight,
            planned_quantity: inlinePlannedQty || null,
            conversion_rules: initialRules,
            company_id: profile?.company_id,
            is_locked: false,
            production_date: inlineProductionDate || null
        }

        const { error } = await (supabase.from('production_lots') as any)
            .insert(newLotData)

        if (error) {
            showToast('Lỗi tạo mã Lot: ' + error.message, 'error')
        } else {
            showToast('Tạo mã Lot thành công!', 'success')
            setShowInlineAddLot(false)
            setInlineProductId('')
            setInlineLotCode('')
            setInlinePlannedQty(0)
            setInlineSearchTerm('')
            setInlineProductionDate(new Date().toISOString().split('T')[0])
            
            fetchProductionLots(editItem.id)
            if (onSuccess) onSuccess()
        }
    }

    const handleStartEditLot = (lot: any) => {
        const product = products.find(p => p.id === lot.product_id)
        setEditingLot(lot)
        setEditLotProductId(lot.product_id)
        setEditLotLotCode(lot.lot_code)
        setEditLotPlannedQty(lot.planned_quantity || 0)
        setEditLotWeightPerUnit(lot.weight_per_unit || 0)
        setEditLotSearchTerm(product?.name || '')
        setEditLotShowSuggestions(false)
        setEditLotProductionDate(lot.production_date || '')
    }

    const handleSaveEditedLot = async () => {
        if (!editingLot?.id || !editItem?.id) return
        if (!editLotProductId) {
            showToast('Vui lòng chọn sản phẩm!', 'warning')
            return
        }
        if (!editLotLotCode.trim()) {
            showToast('Vui lòng nhập mã Lot!', 'warning')
            return
        }

        // Kiểm tra xem mã Lot mới có bị trùng trên hệ thống hay không (chỉ check nếu người dùng đổi mã Lot)
        if (editLotLotCode.trim().toUpperCase() !== editingLot.lot_code.toUpperCase()) {
            const { data: dupLot } = await supabase
                .from('production_lots')
                .select('id')
                .eq('lot_code', editLotLotCode.trim().toUpperCase())
                .maybeSingle()
                
            if (dupLot) {
                showToast(`Mã Lot "${editLotLotCode.trim()}" đã tồn tại trên hệ thống!`, 'warning')
                return
            }
        }

        const product = products.find(p => p.id === editLotProductId)
        const defaultWeight = editLotWeightPerUnit || product?.weight_kg || 0
        const defaultUnit = product?.unit || 'Kg'
        
        // Cập nhật quy tắc quy đổi mới nếu trọng lượng thay đổi
        const initialRules = defaultWeight > 0 
            ? [{ factor: defaultWeight, unit_name: `Thùng (${defaultWeight}kg)`, ref_unit_name: defaultUnit }] 
            : []

        const { error } = await (supabase.from('production_lots') as any)
            .update({
                product_id: editLotProductId,
                lot_code: editLotLotCode.trim().toUpperCase(),
                planned_quantity: editLotPlannedQty || null,
                weight_per_unit: defaultWeight,
                conversion_rules: initialRules,
                production_date: editLotProductionDate || null
            })
            .eq('id', editingLot.id)

        if (error) {
            showToast('Lỗi cập nhật mã Lot: ' + error.message, 'error')
        } else {
            showToast('Cập nhật mã Lot thành công!', 'success')
            setEditingLot(null)
            fetchProductionLots(editItem.id)
            if (onSuccess) onSuccess()
        }
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

    const handleReopen = async () => {
        if (!editItem?.id) return
        if (!await showConfirm('Bạn có chắc chắn muốn mở lại lệnh sản xuất này? Trạng thái sẽ chuyển về "Đang làm" và cho phép chỉnh sửa.')) return
        
        setIsSaving(true)
        const { error } = await (supabase as any)
            .from('productions')
            .update({ status: 'IN_PROGRESS', updated_at: new Date().toISOString() })
            .eq('id', editItem.id)
            
        setIsSaving(false)
        if (error) {
            showToast('Lỗi: ' + error.message, 'error')
        } else {
            showToast('Đã mở lại lệnh sản xuất thành công', 'success')
            setStatus('IN_PROGRESS')
            if (editItem) {
                editItem.status = 'IN_PROGRESS'
            }
            onSuccess()
        }
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
                        company_id: profile.company_id,
                        is_locked: l.is_locked || false,
                        production_date: l.production_date || null
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh] border border-stone-200 dark:border-zinc-800">
                {/* Compact Header */}
                <div className="px-5 py-3.5 border-b border-stone-200/80 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-lg ${isLocked ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600' : 'bg-orange-50 dark:bg-orange-950/40 text-orange-600'}`}>
                            {isLocked ? <FileText size={18} /> : <Factory size={18} />}
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-stone-900 dark:text-white leading-tight">
                                {isLocked 
                                    ? (editItem?.status === 'DONE' ? 'Chi tiết lệnh đã hoàn thành' : 'Chi tiết lệnh đang chạy') 
                                    : (editItem ? 'Chỉnh sửa lệnh sản xuất' : 'Tạo mới lệnh sản xuất')}
                            </h2>
                            <p className="text-[11px] text-stone-500">
                                {isLocked ? `Mã lệnh: ${code}` : 'LSX - Quy trình sản xuất đa mặt hàng'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer">
                        <X size={18} className="text-stone-400" />
                    </button>
                </div>

                {/* Compact Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-stone-50/40 dark:bg-zinc-950/40">
                    {isLocked && editItem?.status === 'DONE' && (
                        <div className="px-3.5 py-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between gap-3 text-blue-700 dark:text-blue-400">
                            <div className="flex items-center gap-2">
                                <Lock size={15} className="shrink-0" />
                                <span className="text-xs font-medium">Lệnh sản xuất này đã hoàn thành và đang khóa. Muốn chỉnh sửa vui lòng mở lại lệnh.</span>
                            </div>
                            <button
                                type="button"
                                onClick={handleReopen}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
                            >
                                <Unlock size={13} />
                                Mở lại lệnh
                            </button>
                        </div>
                    )}
                    {/* Raw Material Info Summary Bar (If filled) */}
                    {(productionType === 'NEW' ? (inputProductId || inputQuantity > 0) : summary.totalInputWeight > 0) && (
                        <div className="flex items-center gap-3.5 p-3.5 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/70 dark:border-emerald-900/40">
                            <div className="p-2 bg-emerald-600 text-white rounded-lg shrink-0">
                                <Scale size={16} />
                            </div>
                            <div className="flex-1 flex flex-wrap items-center gap-x-6 gap-y-2">
                                <div>
                                    <label className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">Nguyên liệu tổng</label>
                                    <div className="text-sm font-bold text-stone-900 dark:text-white flex items-baseline gap-1">
                                        {formatQuantityFull(summary.totalInputWeight)}
                                        <span className="text-[10px] font-medium text-stone-400 uppercase">kg</span>
                                    </div>
                                </div>
                                <div className="h-7 w-px bg-emerald-200/70 dark:bg-emerald-900/50 hidden sm:block" />
                                <div>
                                    <label className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                                        {productionType === 'NEW' ? 'Tên nguyên liệu' : 'Số mã LOT đầu vào'}
                                    </label>
                                    <div className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                                        {productionType === 'NEW' ? (inputProductName || '---') : `${productionInputs.length} mã LOT`}
                                    </div>
                                </div>
                                {summary.actual > 0 && summary.totalInputWeight > 0 && (
                                    <>
                                        <div className="h-7 w-px bg-emerald-200/70 dark:bg-emerald-900/50 hidden sm:block" />
                                        <div>
                                            <label className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">Hao hụt sản xuất</label>
                                            <div className="text-xs font-bold text-orange-600 flex items-center gap-1">
                                                {formatQuantityFull(summary.lossWeight)} kg
                                                <span className="text-[10px] opacity-75">({summary.lossRate.toFixed(1)}%)</span>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                    <form id="prod-form" onSubmit={handleSubmit} className="space-y-4">
                        {/* --- TOP-LEVEL MAIN TABS --- */}
                        {isLocked && (
                            <div className="flex p-0.5 bg-stone-100 dark:bg-zinc-800 rounded-lg w-fit border border-stone-200/70 dark:border-zinc-700/50">
                                <button
                                    type="button"
                                    onClick={() => setMainTab('LOTS')}
                                    className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${mainTab === 'LOTS' ? 'bg-white dark:bg-zinc-700 text-orange-600 shadow-xs' : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'}`}
                                >
                                    <Package size={13} />
                                    Quản lý mã Lot
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setMainTab('STATS'); if (activeTab === 'products') setActiveTab('allocations'); }}
                                    className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${mainTab === 'STATS' ? 'bg-white dark:bg-zinc-700 text-blue-600 shadow-xs' : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'}`}
                                >
                                    <TrendingUp size={13} />
                                    Thống kê
                                </button>
                            </div>
                        )}

                        {isLocked && mainTab === 'STATS' && (
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                <div className="p-3.5 bg-white dark:bg-zinc-800/40 rounded-xl border border-stone-200 dark:border-zinc-800 shadow-xs flex flex-col items-center justify-center gap-1">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Tổng kế hoạch</span>
                                    <div className="text-lg font-bold text-stone-800 dark:text-white flex items-baseline gap-1">
                                        {summary.planned.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
                                        <span className="text-[10px] font-medium text-stone-400">kg</span>
                                    </div>
                                </div>
                                <div className="p-3.5 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-200/60 dark:border-blue-900/30 shadow-xs flex flex-col items-center justify-center gap-1">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-500">Sản lượng gốc</span>
                                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400 flex items-baseline gap-1">
                                        {summary.actual.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
                                        <span className="text-[10px] font-medium text-blue-400">kg</span>
                                    </div>
                                </div>
                                <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-200/60 dark:border-indigo-900/30 shadow-xs flex flex-col items-center justify-center gap-1">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500">Tồn kho hiện có</span>
                                    <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400 flex items-baseline gap-1">
                                        {summary.inventory.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
                                        <span className="text-[10px] font-medium text-indigo-400">kg</span>
                                    </div>
                                </div>
                                <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/60 dark:border-emerald-900/30 shadow-xs flex flex-col items-center justify-center gap-1 col-span-2 lg:col-span-1">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Tỉ lệ hoàn thành</span>
                                    <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 flex items-baseline gap-0.5">
                                        {summary.rate.toFixed(1)}
                                        <span className="text-[10px] font-medium text-emerald-500">%</span>
                                    </div>
                                    <div className="w-full bg-stone-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-emerald-500 h-full transition-all duration-700" style={{ width: `${Math.min(100, summary.rate)}%` }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {!isLocked && (
                            <>
                                {/* Section 1: General Info */}
                                <ProductionGeneralInfoSection
                                    isLocked={isLocked}
                                    code={code}
                                    setCode={setCode}
                                    generateAutoCode={generateAutoCode}
                                    name={name}
                                    setName={setName}
                                    productionType={productionType}
                                    setProductionType={setProductionType}
                                    status={status}
                                    setStatus={setStatus}
                                    customerId={customerId}
                                    setCustomerId={setCustomerId}
                                    customers={customers}
                                    startDate={startDate}
                                    setStartDate={setStartDate}
                                    endDate={endDate}
                                    setEndDate={setEndDate}
                                    inputSource={inputSource}
                                    setInputSource={setInputSource}
                                    inputSearchTerm={inputSearchTerm}
                                    setInputSearchTerm={setInputSearchTerm}
                                    isInputSearchOpen={isInputSearchOpen}
                                    setIsInputSearchOpen={setIsInputSearchOpen}
                                    products={products}
                                    setInputProductId={setInputProductId}
                                    setInputProductName={setInputProductName}
                                    inputQuantity={inputQuantity}
                                    setInputQuantity={setInputQuantity}
                                    inputUnit={inputUnit}
                                    setInputUnit={setInputUnit}
                                    fmStages={fmStages}
                                    fmStageId={fmStageId}
                                    setFmStageId={setFmStageId}
                                    fmBatches={fmBatches}
                                    fmBatchId={fmBatchId}
                                    setFmBatchId={setFmBatchId}
                                    isRefreshingFm={isRefreshingFm}
                                    refreshStageData={refreshStageData}
                                    handleStageSelect={handleStageSelect}
                                />

                        {/* Section 2: Warehouse Filter (Global for items) */}
                        {!isLocked && (
                            <div className="flex items-center gap-3.5 p-3.5 bg-orange-50/50 dark:bg-orange-950/15 rounded-xl border border-orange-200/60 dark:border-orange-900/30">
                                <div className="p-2 bg-orange-600 text-white rounded-lg shrink-0">
                                    <Warehouse size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 mb-1.5 block">Cung cấp sản phẩm từ kho</label>
                                    <div className="flex flex-wrap gap-2">
                                        {systems.map(sys => (
                                            <button
                                                key={sys.code}
                                                type="button"
                                                onClick={() => setTargetSystemCode(sys.code)}
                                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${targetSystemCode === sys.code ? 'bg-orange-600 border-orange-600 text-white shadow-xs' : 'bg-white dark:bg-zinc-800 border-stone-200 dark:border-zinc-700 text-stone-600 hover:border-orange-300'}`}
                                            >
                                                {sys.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                            </>
                        )}

                        {/* Section 3: Product & Lot List (DYNAMIC) */}
                        <div className="space-y-3">
                            {!isLocked && mainTab === 'LOTS' && (
                                <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center gap-1.5 text-stone-500 font-semibold text-[11px] uppercase tracking-wider">
                                        <Package size={13} className="text-orange-500" /> Danh sách sản phẩm & Lot
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addLotRow}
                                        disabled={!targetSystemCode}
                                        className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                                    >
                                        <Plus size={14} /> Thêm sản phẩm
                                    </button>
                                </div>
                            )}

                            {/* Section Header for ReadOnly Mode */}
                            {isLocked && (
                                <div className="flex items-center gap-1.5 px-1 text-stone-500 font-semibold text-[11px] uppercase tracking-wider">
                                    <Package size={13} className="text-orange-500" /> 
                                    {mainTab === 'LOTS' ? 'Chi tiết Lệnh sản xuất' : 'Thống kê & Cấp phát chi tiết'}
                                </div>
                            )}
                            
                            {/* Tabs for View Mode */}
                            {isLocked && mainTab === 'STATS' && (
                                <div className="flex p-0.5 bg-stone-100 dark:bg-zinc-800 rounded-lg w-fit border border-stone-200/70 dark:border-zinc-700/50">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('allocations')}
                                        className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'allocations' ? 'bg-white dark:bg-zinc-700 text-blue-600 shadow-xs' : 'text-stone-500'}`}
                                    >
                                        <Truck className={activeTab === 'allocations' ? 'text-blue-600' : 'text-stone-400'} size={13} />
                                        Vật tư đã cấp phát
                                        {allocations.length > 0 && (
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${activeTab === 'allocations' ? 'bg-blue-100 text-blue-600' : 'bg-stone-200 text-stone-500'}`}>
                                                {allocations.length}
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('analysis')}
                                        className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'analysis' ? 'bg-white dark:bg-zinc-700 text-emerald-600 shadow-xs' : 'text-stone-500'}`}
                                    >
                                        <TrendingUp className={activeTab === 'analysis' ? 'text-emerald-600' : 'text-stone-400'} size={13} />
                                        Phân tích hiệu suất
                                    </button>
                                </div>
                            )}

                            {isLocked && mainTab === 'STATS' && activeTab === 'analysis' && analysisSummary ? (
                                <ProductionAnalysisTab
                                    analysisSummary={analysisSummary}
                                    summary={summary}
                                    dailyStats={dailyStats}
                                    productionType={productionType}
                                    name={name}
                                    startDate={startDate}
                                    endDate={endDate}
                                />
                            ) : isLocked && mainTab === 'STATS' && activeTab === 'allocations' ? (
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
                                        <div className="bg-white dark:bg-zinc-800/40 rounded-xl border border-stone-200 dark:border-zinc-800 overflow-hidden shadow-xs">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-stone-50/80 dark:bg-zinc-800/60 border-b border-stone-200 dark:border-zinc-800">
                                                        <th className="px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">Vật tư / Nguyên liệu</th>
                                                        <th className="px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">Đã cấp</th>
                                                        <th className="px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Tiêu hao</th>
                                                        <th className="px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500">Người nhận</th>
                                                        <th className="px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500 text-right">Ngày cấp</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                                    {allocations.map((aln, aIdx) => (
                                                        <tr key={aln.id || aIdx} className="hover:bg-stone-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                                            <td className="px-3.5 py-2.5">
                                                                <div className="font-semibold text-stone-900 dark:text-white text-xs">{aln.products?.name}</div>
                                                                <div className="text-[10px] font-mono text-stone-400">{aln.products?.sku || '---'}</div>
                                                            </td>
                                                            <td className="px-3.5 py-2.5">
                                                                <div className="font-bold text-blue-600 dark:text-blue-400 text-xs flex items-baseline gap-1">
                                                                    {formatQuantityFull(aln.quantity)}
                                                                    <span className="text-[10px] font-normal text-stone-400">{aln.unit}</span>
                                                                </div>
                                                                {Number(aln.returned_quantity) > 0 && (
                                                                    <div className="text-[10px] text-emerald-600">Đã trả: {formatQuantityFull(aln.returned_quantity)}</div>
                                                                )}
                                                            </td>
                                                            <td className="px-3.5 py-2.5">
                                                                <div className="font-bold text-orange-600 dark:text-orange-400 text-xs flex items-baseline gap-1">
                                                                    {formatQuantityFull((aln.quantity || 0) - (aln.returned_quantity || 0))}
                                                                    <span className="text-[10px] font-normal text-stone-400">{aln.unit}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-3.5 py-2.5">
                                                                <div className="text-xs text-stone-600 dark:text-stone-400 flex items-center gap-1.5">
                                                                    <Users size={13} className="text-stone-400" />
                                                                    {aln.worker_name || 'N/A'}
                                                                </div>
                                                            </td>
                                                            <td className="px-3.5 py-2.5 text-right">
                                                                <div className="text-xs font-medium text-stone-600 dark:text-stone-300">
                                                                    {new Date(aln.loan_date || aln.created_at).toLocaleDateString('vi-VN')}
                                                                </div>
                                                                <div className="text-[10px] text-stone-400">
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
                                        <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white dark:bg-zinc-800/40 p-3 rounded-xl border border-stone-200 dark:border-zinc-800 shadow-xs w-full">
                                            <div className="flex flex-wrap items-center gap-2.5">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={14} className="text-blue-600" />
                                                    <span className="text-[11px] font-semibold text-stone-500">Ngày nhập kho:</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 bg-stone-50 dark:bg-zinc-800 px-2.5 py-1 rounded-lg border border-stone-200 dark:border-zinc-700">
                                                    <input 
                                                        type="date" 
                                                        value={statsStartDate}
                                                        onChange={e => setStatsStartDate(e.target.value)}
                                                        className="bg-transparent border-none focus:ring-0 outline-none w-28 text-xs font-medium text-stone-800 dark:text-stone-100"
                                                    />
                                                    <ArrowRight size={12} className="text-stone-400" />
                                                    <input 
                                                        type="date" 
                                                        value={statsEndDate}
                                                        onChange={e => setStatsEndDate(e.target.value)}
                                                        className="bg-transparent border-none focus:ring-0 outline-none w-28 text-xs font-medium text-stone-800 dark:text-stone-100"
                                                    />
                                                </div>
                                                {(statsStartDate || statsEndDate) && (
                                                    <button 
                                                        type="button" 
                                                        onClick={() => {
                                                            setStatsStartDate('')
                                                            setStatsEndDate('')
                                                        }}
                                                        className="p-1 text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
                                                        title="Xóa bộ lọc"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                )}
                                                {isRefreshingStats && <Loader2 size={14} className="animate-spin text-blue-500" />}
                                            </div>

                                            {/* Bộ lọc trạng thái mã Lot & Thao tác nhanh */}
                                            <div className="flex flex-wrap items-center gap-2">
                                                <div className="flex p-0.5 bg-stone-100 dark:bg-zinc-800 rounded-lg border border-stone-200/70 dark:border-zinc-700">
                                                <button
                                                    type="button"
                                                    onClick={() => setLotStatusFilter('ALL')}
                                                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${lotStatusFilter === 'ALL' ? 'bg-orange-600 text-white shadow-xs' : 'text-stone-500 hover:text-stone-700'}`}
                                                >
                                                    Tất cả ({lots.length})
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setLotStatusFilter('ACTIVE')}
                                                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${lotStatusFilter === 'ACTIVE' ? 'bg-emerald-600 text-white shadow-xs' : 'text-stone-500 hover:text-stone-700'}`}
                                                >
                                                    Đang chạy ({lots.filter(l => !l.is_locked).length})
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setLotStatusFilter('LOCKED')}
                                                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${lotStatusFilter === 'LOCKED' ? 'bg-rose-600 text-white shadow-xs' : 'text-stone-500 hover:text-stone-700'}`}
                                                >
                                                    Đã khóa ({lots.filter(l => l.is_locked).length})
                                                </button>
                                                </div>

                                                {editItem?.status === 'IN_PROGRESS' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowInlineAddLot(true)}
                                                        className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-[11px] font-semibold transition-colors shadow-xs flex items-center gap-1 cursor-pointer"
                                                    >
                                                        <Plus size={13} />
                                                        Tạo mã Lot mới
                                                    </button>
                                                )}
                                            </div>

                                            {/* Inline Form để thêm Lot trực tiếp */}
                                            {showInlineAddLot && editItem?.status === 'IN_PROGRESS' && (
                                                <div className="bg-stone-50 dark:bg-zinc-800/40 p-5 rounded-[24px] border border-orange-200 dark:border-zinc-800/80 shadow-inner space-y-4 animate-in slide-in-from-top duration-200 w-full mb-4">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400 flex items-center gap-1.5">
                                                            <Plus size={14} className="text-orange-500" />
                                                            Tạo mã Lot mới trực tiếp
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setShowInlineAddLot(false)
                                                                setInlineProductId('')
                                                                setInlineLotCode('')
                                                                setInlinePlannedQty(0)
                                                                setInlineSearchTerm('')
                                                                setInlineProductionDate(new Date().toISOString().split('T')[0])
                                                            }}
                                                            className="text-stone-400 hover:text-stone-600 p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-700/50"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                        {/* 1. Chọn sản phẩm */}
                                                        <div className="relative">
                                                            <label className="text-[9px] font-black text-stone-400 dark:text-zinc-500 uppercase mb-1 block px-1 tracking-wider">Sản phẩm sản xuất</label>
                                                            <input
                                                                type="text"
                                                                placeholder="Tìm sản phẩm..."
                                                                value={inlineSearchTerm}
                                                                onChange={(e) => {
                                                                    setInlineSearchTerm(e.target.value)
                                                                    setInlineShowSuggestions(true)
                                                                }}
                                                                onFocus={() => setInlineShowSuggestions(true)}
                                                                className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs font-bold text-stone-800 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                                                            />
                                                            
                                                            {inlineShowSuggestions && inlineSearchTerm.trim() !== '' && (
                                                                <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl shadow-lg max-h-48 overflow-y-auto z-50">
                                                                    {products
                                                                        .filter(p => p.name.toLowerCase().includes(inlineSearchTerm.toLowerCase()) || p.sku.toLowerCase().includes(inlineSearchTerm.toLowerCase()))
                                                                        .map(p => (
                                                                            <button
                                                                                key={p.id}
                                                                                type="button"
                                                                                onClick={async () => {
                                                                                    setInlineProductId(p.id)
                                                                                    setInlineSearchTerm(p.name)
                                                                                    setInlineShowSuggestions(false)
                                                                                    
                                                                                    let nextIndex = lots.length + 1;
                                                                                    const codePrefix = code || 'LOT';
                                                                                    let newLotCode = `${codePrefix}-L${nextIndex}`;
                                                                                    
                                                                                    const checkDup = async (codeStr: string) => {
                                                                                        const { data } = await supabase
                                                                                            .from('production_lots')
                                                                                            .select('id')
                                                                                            .eq('lot_code', codeStr.trim().toUpperCase())
                                                                                            .maybeSingle()
                                                                                        return !!data
                                                                                    }

                                                                                    let isDup = await checkDup(newLotCode)
                                                                                    while (isDup) {
                                                                                        nextIndex++;
                                                                                        newLotCode = `${codePrefix}-L${nextIndex}`;
                                                                                        isDup = await checkDup(newLotCode)
                                                                                    }
                                                                                    setInlineLotCode(newLotCode)
                                                                                    setInlineWeightPerUnit(p.weight_kg || 0)
                                                                                }}
                                                                                className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-stone-50 dark:hover:bg-zinc-700 text-stone-800 dark:text-stone-200 border-b border-stone-100 dark:border-zinc-700 last:border-0"
                                                                            >
                                                                                <div className="font-bold">{p.name}</div>
                                                                                <div className="text-[9px] text-stone-400">SKU: {p.sku} | Trọng lượng: {p.weight_kg}kg</div>
                                                                            </button>
                                                                        ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        
                                                        {/* 2. Mã Lot */}
                                                        <div>
                                                            <label className="text-[9px] font-black text-stone-400 dark:text-zinc-500 uppercase mb-1 block px-1 tracking-wider">Mã Lot</label>
                                                            <input
                                                                type="text"
                                                                placeholder="Mã Lot sản xuất..."
                                                                value={inlineLotCode}
                                                                onChange={(e) => setInlineLotCode(e.target.value)}
                                                                className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs font-bold uppercase text-stone-800 dark:text-stone-100 focus:outline-none focus:border-orange-500"
                                                            />
                                                        </div>
                                                        
                                                        {/* Ngày sản xuất Inline */}
                                                        <div>
                                                            <label className="text-[9px] font-black text-stone-400 dark:text-zinc-500 uppercase mb-1 block px-1 tracking-wider">Ngày sản xuất</label>
                                                            <input
                                                                type="date"
                                                                value={inlineProductionDate}
                                                                onChange={(e) => setInlineProductionDate(e.target.value)}
                                                                className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs font-bold text-stone-800 dark:text-stone-100 focus:outline-none focus:border-orange-500"
                                                            />
                                                        </div>
                                                        
                                                        {/* 3. Số lượng kế hoạch */}
                                                        <div>
                                                            <label className="text-[9px] font-black text-stone-400 dark:text-zinc-500 uppercase mb-1 block px-1 tracking-wider">Kế hoạch (Số Thùng / Bao)</label>
                                                            <div className="flex gap-2">
                                                                <input
                                                                    type="number"
                                                                    placeholder="Kế hoạch..."
                                                                    value={inlinePlannedQty || ''}
                                                                    onChange={(e) => setInlinePlannedQty(parseFloat(e.target.value) || 0)}
                                                                    className="flex-1 px-3 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs font-bold text-stone-800 dark:text-stone-100 focus:outline-none focus:border-orange-500"
                                                                />
                                                                
                                                                <button
                                                                    type="button"
                                                                    onClick={handleSaveInlineLot}
                                                                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95"
                                                                >
                                                                    Lưu Lot
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {(() => {
                                        const displayLots = lots.filter(lot => {
                                            if (lotStatusFilter === 'ACTIVE') return !lot.is_locked;
                                            if (lotStatusFilter === 'LOCKED') return lot.is_locked;
                                            return true;
                                        });

                                        if (isLocked && displayLots.length === 0) {
                                            return (
                                                <div className="p-16 text-center bg-white dark:bg-zinc-800/40 rounded-[32px] border border-stone-200 dark:border-zinc-800 border-dashed text-stone-400 font-bold uppercase tracking-widest text-xs flex flex-col items-center justify-center gap-3 w-full">
                                                    <Package size={32} className="text-stone-300 animate-bounce" />
                                                    Không có mã lot nào {lotStatusFilter === 'ACTIVE' ? 'đang chạy' : 'đã khóa'}.
                                                </div>
                                            );
                                        }

                                         if (isLocked) {
                                             return (
                                                 <div className="space-y-2 animate-in fade-in duration-150">
                                                     {displayLots.map((lot, idx) => {
                                                         const product = products.find(p => p.id === lot.product_id);
                                                         const pk = (lot.planned_quantity || 0) * (lot.weight_per_unit || product?.weight_kg || 1);
                                                         const ak = lot.actual_quantity || 0;
                                                         const percent = pk > 0 ? Math.min(100, (ak / pk) * 100) : 0;

                                                         return (
                                                             <div key={lot.id || idx} className="bg-white dark:bg-zinc-800/40 px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-zinc-800 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:border-blue-300 transition-colors">
                                                                 {/* Left: Package icon + Product Name + Lot code */}
                                                                 <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                                                     <div className={`p-2 rounded-lg shrink-0 ${lot.is_locked ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600' : 'bg-blue-50 dark:bg-blue-950/30 text-blue-600'}`}>
                                                                         <Package size={15} />
                                                                     </div>
                                                                     <div className="min-w-0">
                                                                         <div className="font-semibold text-stone-900 dark:text-white text-xs truncate">{pName(lot, product)}</div>
                                                                         <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                                                             <span className="text-[10px] font-mono font-bold text-stone-600 dark:text-zinc-300 bg-stone-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded uppercase">{lot.lot_code}</span>
                                                                             <span className="text-[10px] text-orange-600 font-medium bg-orange-50 dark:bg-orange-950/30 px-1.5 py-0.5 rounded">
                                                                                 {lot.conversion_rules && (lot.conversion_rules as any[]).length > 0 ? (
                                                                                     (lot.conversion_rules as any[]).map((r, i) => (
                                                                                         <span key={i}>
                                                                                             1 {r.unit_name || '?'} = {r.factor} {r.ref_unit_name}
                                                                                         </span>
                                                                                     ))
                                                                                 ) : (
                                                                                     <span>1 {lot.unit || 'đv'} = {lot.weight_per_unit || 0} kg</span>
                                                                                 )}
                                                                             </span>
                                                                             {lot.is_locked && (
                                                                                 <span className="text-[9px] bg-rose-100 text-rose-600 font-bold px-1.5 py-0.5 rounded">ĐÃ KHÓA</span>
                                                                             )}
                                                                         </div>
                                                                     </div>
                                                                 </div>

                                                                 {/* Middle: planning, actual, remaining, progress */}
                                                                 <div className="flex flex-wrap items-center gap-4 lg:gap-5">
                                                                     <div>
                                                                         <div className="text-[10px] font-semibold text-stone-400">Kế hoạch</div>
                                                                         <div className="font-bold text-stone-800 dark:text-white text-xs">
                                                                             {(lot.planned_quantity || 0).toLocaleString('vi-VN')}
                                                                             <span className="text-[10px] ml-0.5 text-stone-400 font-normal">{(lot.unit || product?.unit || 'kg')}</span>
                                                                         </div>
                                                                         <div className="text-[10px] text-zinc-400">~ {((lot.planned_quantity || 0) * (lot.weight_per_unit || product?.weight_kg || 1)).toLocaleString('vi-VN')} kg</div>
                                                                     </div>

                                                                     <div>
                                                                         <div className="text-[10px] font-semibold text-blue-500">Sản lượng gốc</div>
                                                                         <div className="font-bold text-blue-600 dark:text-blue-400 text-xs">
                                                                             {(lot as any).quantity_by_unit && (lot as any).quantity_by_unit.length > 0 ? (
                                                                                 <div className="flex flex-wrap items-center gap-x-1.5">
                                                                                     {(lot as any).quantity_by_unit.map((q: any, i: number) => (
                                                                                         <span key={i} className={q.current_qty === 0 ? 'text-rose-500 line-through opacity-60' : 'text-blue-600'}>
                                                                                             {Number(q.qty).toLocaleString('vi-VN')} {q.unit}
                                                                                         </span>
                                                                                     ))}
                                                                                 </div>
                                                                             ) : (
                                                                                 <span>{(lot.actual_quantity || 0).toLocaleString('vi-VN')} {lot.unit || 'kg'}</span>
                                                                             )}
                                                                         </div>
                                                                         <div className="text-[10px] text-stone-400">~ {(lot.actual_quantity || 0).toLocaleString('vi-VN')} kg</div>
                                                                     </div>

                                                                     <div>
                                                                         <div className="text-[10px] font-semibold text-indigo-500">Tồn hiện tại</div>
                                                                         <div className="font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                                                                             {(lot as any).quantity_by_unit && (lot as any).quantity_by_unit.length > 0 ? (
                                                                                 <div className="flex flex-wrap items-center gap-x-1.5">
                                                                                     {(lot as any).quantity_by_unit.map((q: any, i: number) => {
                                                                                         const isOutOfStock = q.current_qty === 0;
                                                                                         return (
                                                                                             <span key={i} className={isOutOfStock ? 'text-rose-500 line-through opacity-60' : 'text-indigo-600 dark:text-indigo-400'}>
                                                                                                 {Number(q.current_qty || 0).toLocaleString('vi-VN')} {q.unit}
                                                                                             </span>
                                                                                         );
                                                                                     })}
                                                                                 </div>
                                                                             ) : (
                                                                                 <span>{((lot as any).inventory_quantity || 0).toLocaleString('vi-VN')} {lot.unit || 'kg'}</span>
                                                                             )}
                                                                         </div>
                                                                         <div className="text-[10px] text-stone-400">~ {((lot as any).inventory_quantity || 0).toLocaleString('vi-VN')} kg</div>
                                                                     </div>

                                                                     <div className="flex items-center gap-1.5">
                                                                         <div className="w-10 bg-stone-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                                                                             <div className="bg-blue-500 h-full rounded-full" style={{ width: `${percent}%` }} />
                                                                         </div>
                                                                         <span className="text-[11px] font-bold text-stone-700 dark:text-zinc-300">{percent.toFixed(0)}%</span>
                                                                     </div>
                                                                 </div>

                                                                 {/* Right: Print / Lock options */}
                                                                 <div className="flex items-center gap-1 justify-end border-t lg:border-t-0 border-stone-100 dark:border-zinc-800 pt-2 lg:pt-0">
                                                                     {editItem?.status === 'IN_PROGRESS' && (
                                                                         <>
                                                                             <button
                                                                                 type="button"
                                                                                 onClick={(e) => { e.stopPropagation(); handleStartEditLot(lot) }}
                                                                                 className="p-1.5 bg-amber-50 text-amber-600 border border-amber-200/60 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer dark:bg-amber-950/20 dark:text-amber-400"
                                                                                 title="Chỉnh sửa Lot"
                                                                             >
                                                                                 <Edit size={13} />
                                                                             </button>
                                                                             <button
                                                                                 type="button"
                                                                                 onClick={(e) => { e.stopPropagation(); handleDuplicateLot(lot) }}
                                                                                 className="p-1.5 bg-blue-50 text-blue-600 border border-blue-200/60 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer dark:bg-blue-950/20 dark:text-blue-400"
                                                                                 title="Nhân bản Lot"
                                                                             >
                                                                                 <Copy size={13} />
                                                                             </button>
                                                                         </>
                                                                     )}
                                                                     <button
                                                                         type="button"
                                                                         onClick={(e) => { e.stopPropagation(); if (lot.id) toggleLotLock(lot.id, !!lot.is_locked) }}
                                                                         className={`p-1.5 rounded-lg transition-colors cursor-pointer ${lot.is_locked ? 'bg-rose-50 text-rose-600 border border-rose-200/60 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-400' : 'bg-stone-50 text-stone-600 border border-stone-200 hover:bg-stone-100 dark:bg-zinc-800 dark:text-stone-300 dark:border-zinc-700'}`}
                                                                         title={lot.is_locked ? 'Mở khóa Lot' : 'Khóa Lot'}
                                                                     >
                                                                          {lot.is_locked ? <Lock size={13} /> : <Unlock size={13} />}
                                                                     </button>
                                                                     <button
                                                                         type="button"
                                                                         onClick={(e) => { e.stopPropagation(); window.open(`/print/production-lot?id=${lot.id}&type=label`, '_blank') }}
                                                                         className="p-1.5 bg-orange-50 text-orange-600 border border-orange-200/60 hover:bg-orange-100 rounded-lg transition-colors cursor-pointer dark:bg-orange-950/20 dark:text-orange-400"
                                                                         title="In tem nhãn QR"
                                                                     >
                                                                         <QrCode size={13} />
                                                                     </button>
                                                                     <button
                                                                         type="button"
                                                                         onClick={(e) => { e.stopPropagation(); window.open(`/print/production-lot?id=${lot.id}&type=sheet`, '_blank') }}
                                                                         className="p-1.5 bg-blue-50 text-blue-600 border border-blue-200/60 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer dark:bg-blue-950/20 dark:text-blue-400"
                                                                         title="In phiếu nhận hàng"
                                                                     >
                                                                         <FileText size={13} />
                                                                     </button>
                                                                 </div>
                                                             </div>
                                                         );
                                                     })}
                                                 </div>
                                             );
                                         }

                                         return (
                                             <div className="space-y-3">
                                                 {displayLots.map((lot, idx) => {
                                                     const product = products.find(p => p.id === lot.product_id);
                                                     return (
                                                         <div key={idx} className="bg-white dark:bg-zinc-800/40 p-3.5 rounded-xl border border-stone-200 dark:border-zinc-800 shadow-xs relative flex flex-col gap-3">
                                            {/* Row 1: Product Selection (Full Width) */}
                                            <div className="relative">
                                                <label className="text-[11px] font-semibold text-stone-500 mb-1 block">Sản phẩm sản xuất</label>
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
                                                        className="w-full h-8 pl-8 pr-3 rounded-lg bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 font-semibold focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all text-xs text-stone-800 dark:text-white"
                                                    />
                                                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-orange-500" />
                                                </div>

                                                {/* Line Product Results */}
                                                {activeRowIdx === idx && (
                                                    <div className="absolute z-[120] top-full mt-1 w-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl shadow-lg max-h-[220px] overflow-y-auto">
                                                        {products
                                                            .filter(p => p.name.toLowerCase().includes((rowSearchTerms[idx] || '').toLowerCase()) || (p.sku && p.sku.toLowerCase().includes((rowSearchTerms[idx] || '').toLowerCase())))
                                                            .map(p => (
                                                                <button
                                                                    key={p.id}
                                                                    type="button"
                                                                    onClick={() => selectProductForRow(idx, p)}
                                                                    className="w-full text-left px-3 py-2 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors border-b border-stone-100 dark:border-zinc-800 last:border-0"
                                                                >
                                                                    <div className="font-semibold text-xs text-stone-800 dark:text-gray-200">{p.name}</div>
                                                                    <div className="text-[10px] font-mono text-stone-400">{p.sku || 'N/A'}</div>
                                                                </button>
                                                            ))
                                                        }
                                                    </div>
                                                )}
                                                {activeRowIdx === idx && <div className="fixed inset-0 z-[115]" onClick={() => setActiveRowIdx(null)} />}
                                            </div>

                                            {/* Row 2: Lot Details & Numbers */}
                                            <div className="grid grid-cols-12 gap-3 items-end bg-stone-50/60 dark:bg-zinc-900/30 p-3 rounded-xl border border-stone-200/70 dark:border-zinc-800/60">
                                                {/* Details Section: Lot Code & Conversion Rules */}
                                                <div className="col-span-12 bg-white dark:bg-zinc-900/50 p-3.5 space-y-3 border border-stone-200 dark:border-zinc-800 rounded-xl">
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                        {/* Lot Code Input */}
                                                        <div>
                                                            <label className="text-[11px] font-semibold text-stone-500 mb-1 flex items-center gap-1">
                                                                <Hash size={12} className="text-orange-500" />
                                                                Mã LOT Sản xuất
                                                            </label>
                                                            <input
                                                                type="text"
                                                                placeholder="L003CC260-TN..."
                                                                value={lot.lot_code}
                                                                onChange={e => updateLotRow(idx, 'lot_code', e.target.value.toUpperCase())}
                                                                className="w-full h-8 px-2.5 rounded-lg bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 font-semibold font-mono focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-xs uppercase text-stone-900 dark:text-white"
                                                            />
                                                        </div>

                                                        {/* Production Date Input */}
                                                        <div>
                                                            <label className="text-[11px] font-semibold text-stone-500 mb-1 flex items-center gap-1">
                                                                <Calendar size={12} className="text-orange-500" />
                                                                Ngày sản xuất
                                                            </label>
                                                            <input
                                                                type="date"
                                                                value={lot.production_date || ''}
                                                                onChange={e => updateLotRow(idx, 'production_date', e.target.value || null)}
                                                                className="w-full h-8 px-2.5 rounded-lg bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 font-medium focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-xs text-stone-900 dark:text-white"
                                                            />
                                                        </div>

                                                        {/* Base Unit Display */}
                                                        <div>
                                                            <label className="text-[11px] font-semibold text-stone-500 mb-1 flex items-center gap-1">
                                                                <Weight size={12} className="text-orange-500" />
                                                                Đơn vị cơ bản
                                                            </label>
                                                            <div className="h-8 px-2.5 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-stone-500 dark:text-stone-400 flex items-center">
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
                                                 <div className="col-span-12 lg:col-span-4 flex items-end justify-end gap-2 pb-0.5 mt-1">
                                                     <button
                                                         type="button"
                                                         onClick={() => cloneLotRow(idx)}
                                                         className="flex items-center gap-1.5 px-3 py-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition-colors font-semibold text-xs cursor-pointer"
                                                     >
                                                         <Copy size={13} /> Nhân bản
                                                     </button>
                                                     <button
                                                         type="button"
                                                         onClick={() => removeLotRow(idx)}
                                                         className="flex items-center gap-1.5 px-3 py-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors font-semibold text-xs cursor-pointer"
                                                     >
                                                         <Trash2 size={13} /> Gỡ bỏ
                                                     </button>
                                                 </div>
                                             </div>
                                         </div>
                                                 )
                                             })}
                                         </div>
                                     );
                                 })()}
                             </div>
                             )}
                         </div>

                         {/* Description */}
                         {(!isLocked || mainTab === 'LOTS') && (
                             <div className="space-y-1">
                                  <label className="text-[11px] font-semibold text-stone-500">Ghi chú lệnh sản xuất</label>
                                  {isLocked ? (
                                     <div className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-800/40 border border-stone-200 dark:border-zinc-800 text-stone-600 dark:text-gray-400 text-xs italic">
                                         {description || 'Không có ghi chú.'}
                                     </div>
                                  ) : (
                                     <textarea
                                         value={description}
                                         onChange={e => setDescription(e.target.value)}
                                         rows={2}
                                         className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-800/40 border border-stone-200 dark:border-zinc-800 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 text-xs text-stone-800 dark:text-gray-200"
                                     />
                                  )}
                             </div>
                         )}
                     </form>
                 </div>

                 {/* Compact Footer */}
                 <div className="px-5 py-3 border-t border-stone-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-end gap-2 shrink-0">
                     <button
                         type="button"
                         onClick={onClose}
                         className="px-4 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-gray-300 text-xs font-semibold hover:bg-stone-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                     >
                         {isLocked ? 'Đóng lại' : 'Hủy bỏ'}
                     </button>
                     {!isLocked && (
                         <button
                             form="prod-form"
                             type="submit"
                             disabled={isSaving || isFetchingLots}
                             className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-60 cursor-pointer"
                         >
                             {(isSaving || isFetchingLots) ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                             {isFetchingLots ? 'Đang tải...' : (editItem ? 'Lưu thay đổi' : 'Tạo lệnh sản xuất')}
                         </button>
                     )}
                 </div>
            </div>

            {/* Modal chỉnh sửa Lot con */}
            <EditChildLotModal
                editingLot={editingLot}
                setEditingLot={setEditingLot}
                products={products}
                editLotSearchTerm={editLotSearchTerm}
                setEditLotSearchTerm={setEditLotSearchTerm}
                editLotShowSuggestions={editLotShowSuggestions}
                setEditLotShowSuggestions={setEditLotShowSuggestions}
                setEditLotProductId={setEditLotProductId}
                setEditLotWeightPerUnit={setEditLotWeightPerUnit}
                editLotLotCode={editLotLotCode}
                setEditLotLotCode={setEditLotLotCode}
                editLotProductionDate={editLotProductionDate}
                setEditLotProductionDate={setEditLotProductionDate}
                editLotPlannedQty={editLotPlannedQty}
                setEditLotPlannedQty={setEditLotPlannedQty}
                handleSaveEditedLot={handleSaveEditedLot}
            />
        </div>
    )
}
