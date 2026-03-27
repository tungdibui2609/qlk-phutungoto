'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Plus, Save, FileText, Calendar, Info, Activity, Factory, Package, Users, Weight, Hash, Trash2, Wand2, Search, Loader2, Warehouse, ChevronDown, CheckCircle2, X, Scale, Truck, TrendingUp, PieChart, ArrowRight } from 'lucide-react'
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
    const { showToast, showConfirm } = useToast()
    const { profile } = useUser()
    const { systems } = useSystem()
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
    
    // Global Filter for products (Warehouse focus)
    const [targetSystemCode, setTargetSystemCode] = useState('')
    const [customerId, setCustomerId] = useState('')
    
    // Dynamic Product & Lot Lines
    const [lots, setLots] = useState<ProductionLot[]>([])
    const [allocations, setAllocations] = useState<any[]>([])
    const [loadingAllocations, setLoadingAllocations] = useState(false)
    const [activeTab, setActiveTab] = useState<'products' | 'allocations' | 'analysis'>('products')

    // Raw Material Input
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

    // Per-row search states (index -> searchTerm)
    const [rowSearchTerms, setRowSearchTerms] = useState<Record<number, string>>({})
    const [activeRowIdx, setActiveRowIdx] = useState<number | null>(null)

    // Summary calculations
    const summary = useMemo(() => {
        let planned = 0
        let actual = 0
        lots.forEach(l => {
            planned += (l.planned_quantity || 0) * (l.weight_per_unit || 1)
            actual += l.actual_quantity || 0
        })
        const rate = planned > 0 ? (actual / planned) * 100 : 0
        return { planned, actual, rate }
    }, [lots])

    const analysisSummary = useMemo(() => {
        if (!readOnly || !editItem) return null;
        
        // 1. Material aggregation
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

        // 2. Consumption per Ton
        const actualTons = summary.actual / 1000;
        const materials = Object.values(materialStats).map(m => ({
            ...m,
            perTon: actualTons > 0 ? (m.total / actualTons) : 0
        }));

        // 3. Time Progress
        let timeProgress = 0;
        if (startDate && endDate) {
            const start = new Date(startDate).getTime();
            const end = new Date(endDate).getTime();
            const now = new Date().getTime();
            if (end > start) {
                timeProgress = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
            }
        }

        return { materials, timeProgress, actualTons };
    }, [allocations, summary.actual, startDate, endDate, readOnly, editItem])

    useEffect(() => {
        if (editItem) {
            setCode(editItem.code)
            setName(editItem.name)
            setDescription(editItem.description || '')
            setStatus(editItem.status)
            setStartDate(editItem.start_date ? new Date(editItem.start_date).toISOString().split('T')[0] : '')
            setEndDate(editItem.end_date ? new Date(editItem.end_date).toISOString().split('T')[0] : '')
            
            setTargetSystemCode(editItem.target_system_code || '')
            setCustomerId(editItem.customer_id || '')
            
            // Raw Material
            setInputProductId(editItem.input_product_id || null)
            setInputQuantity(editItem.input_quantity || 0)
            setInputUnit(editItem.input_unit || '')
            setInputProductName(editItem.input_products?.name || '')
            setInputSearchTerm(editItem.input_products?.name || '')
            
            // Fetch production lots if editing (now includes product details)
            fetchProductionLots(editItem.id)
            if (readOnly) {
                fetchAllocations(editItem.id)
            }
        } else {
            setCode('')
            setName('')
            setDescription('')
            setStatus('IN_PROGRESS')
            setStartDate('')
            setEndDate('')
            setTargetSystemCode('')
            setCustomerId('')
            setLots([])
            setAllocations([])
            setActiveTab('products')
            setRowSearchTerms({})
            setInputProductId(null)
            setInputQuantity(0)
            setInputUnit('')
            setInputProductName('')
            setInputSearchTerm('')
        }
    }, [editItem, isOpen, readOnly])

    useEffect(() => {
        if (isOpen) {
            fetchCustomers()
            fetchUnits()
            // Fetch product units for conversion logic
            fetchProductUnits()
        }
    }, [isOpen])

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

    const fetchProductionLots = async (prodId: string) => {
        // First get basic lot info & products
        const { data: lotsData } = await supabase
            .from('production_lots')
            .select('*, products(name, sku, unit, weight_kg)') // Added weight_kg here
            .eq('production_id', prodId)
        
        if (lotsData) {
            // Then get stats from view
            const lotIds = (lotsData as any[]).map(l => l.id)
            const { data: statsData } = await supabase
                .from('production_item_statistics' as any)
                .select('production_lot_id, actual_quantity, quantity_by_unit')
                .in('production_lot_id', lotIds) as { data: any[] | null }

            const statsMap: Record<string, { actual: number, by_unit: any[] }> = {}
            statsData?.forEach((s: any) => { 
                statsMap[s.production_lot_id] = {
                    actual: s.actual_quantity,
                    by_unit: s.quantity_by_unit || []
                }
            })

            const formattedLots = lotsData.map((l: any) => ({
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

        newLots[index] = { 
            ...newLots[index], 
            product_id: product.id, 
            product_name: product.name,
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
                input_product_id: inputProductId || null,
                input_quantity: inputQuantity || 0,
                input_unit: inputUnit || null,
                updated_at: new Date().toISOString()
            }

            let productionId = editItem?.id
            let error

            // 1. Save Production Info
            if (productionId) {
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

            // 2. Save Lots (Multi-product per lot)
            if (productionId) {
                await (supabase as any).from('production_lots').delete().eq('production_id', productionId)
                
                const validLots = lots
                    .filter(l => l.lot_code.trim() !== '' && l.product_id)
                    .map(l => ({
                        production_id: productionId,
                        lot_code: l.lot_code,
                        product_id: l.product_id,
                        weight_per_unit: l.weight_per_unit || 0,
                        planned_quantity: l.planned_quantity || null,
                        conversion_rules: l.conversion_rules || [],
                        company_id: profile.company_id
                    }))

                if (validLots.length > 0) {
                    const { error: lotErr } = await (supabase as any).from('production_lots').insert(validLots)
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
                        <div className={`p-3 rounded-2xl ${readOnly ? 'bg-blue-100 dark:bg-blue-950/30' : 'bg-orange-100 dark:bg-orange-950/30'}`}>
                            {readOnly ? <FileText className="text-blue-600" size={24} /> : <Factory className="text-orange-600" size={24} />}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-stone-900 dark:text-white">
                                {readOnly ? 'Báo cáo chi tiết lệnh sản xuất' : editItem ? 'Chỉnh sửa lệnh sản xuất' : 'Tạo mới lệnh sản xuất'}
                            </h2>
                            <p className="text-xs text-stone-500 font-medium">
                                {readOnly ? `Mã lệnh: ${code}` : 'LSX - Quy trình sản xuất đa mặt hàng'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <Plus size={24} className="rotate-45 text-stone-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-stone-50/30 dark:bg-zinc-900">
                    {/* Raw Material Info Summary Bar (If filled) */}
                    {(inputProductId || inputQuantity > 0) && (
                        <div className="flex items-center gap-6 p-6 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-[28px] border border-emerald-200/50 dark:border-emerald-900/20 animate-in slide-in-from-top-4">
                            <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-600/20">
                                <Scale size={20} />
                            </div>
                            <div className="flex-1 flex flex-col md:flex-row md:items-center gap-4 md:gap-12">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1 block">Nguyên liệu tổng</label>
                                    <div className="text-lg font-black text-stone-900 dark:text-white flex items-baseline gap-2">
                                        {Number(inputQuantity).toLocaleString('vi-VN')}
                                        <span className="text-xs font-bold text-stone-400 uppercase">{inputUnit || 'Đơn vị'}</span>
                                    </div>
                                </div>
                                <div className="h-10 w-px bg-emerald-100 dark:bg-emerald-900/50 hidden md:block" />
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1 block">Tên nguyên liệu</label>
                                    <div className="text-sm font-bold text-stone-600 dark:text-stone-300">
                                        {inputProductName || '---'}
                                    </div>
                                </div>
                                {summary.actual > 0 && inputQuantity > 0 && (
                                    <>
                                        <div className="h-10 w-px bg-emerald-100 dark:bg-emerald-900/50 hidden md:block" />
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1 block">Tỉ lệ thành phẩm/nguyên liệu</label>
                                            <div className="text-sm font-black text-orange-600 flex items-center gap-1">
                                                {((summary.actual / (inputQuantity * (extractWeight(inputProductName) || 1))) * 100).toFixed(1)}%
                                                <TrendingUp size={14} />
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                    <form id="prod-form" onSubmit={handleSubmit} className="space-y-8">
                        {readOnly && (
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
                                    <div className="flex items-center gap-2 text-stone-400 font-black text-[10px] uppercase tracking-widest">
                                        <Info size={14} className="text-orange-500" /> Thông tin cơ bản
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {!readOnly && (
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
                                        <div className={readOnly ? 'md:col-span-1 space-y-2' : 'space-y-2'}>
                                            <label className="text-xs font-bold text-stone-500">Đối tác / Khách hàng</label>
                                            {readOnly ? (
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
                                            {readOnly ? (
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
                                {!readOnly && (
                                    <div className="p-6 bg-white dark:bg-zinc-800/40 rounded-[28px] border border-stone-200 dark:border-zinc-800 shadow-sm space-y-6">
                                        <div className="flex items-center gap-2 text-stone-400 font-black text-[10px] uppercase tracking-widest">
                                            <Scale size={14} className="text-emerald-500" /> Định mức nguyên liệu đầu vào
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="md:col-span-2 space-y-2 relative">
                                                <label className="text-xs font-bold text-stone-500">Loại nguyên liệu (Xoài tươi, Chanh dây...)</label>
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
                                )}
                            </div>

                            <div className="space-y-6">
                                <div className="p-6 bg-white dark:bg-zinc-800/40 rounded-[28px] border border-stone-200 dark:border-zinc-800 shadow-sm space-y-6 h-full">
                                    <div className="flex items-center gap-2 text-stone-400 font-black text-[10px] uppercase tracking-widest">
                                        <Activity size={14} className="text-orange-500" /> Trạng thái & Thời gian
                                    </div>
                                    <div className="space-y-4">
                                        {readOnly ? (
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
                                                {readOnly ? (
                                                    <div className="text-xs font-black text-stone-800 dark:text-white px-1">
                                                        {startDate ? new Date(startDate).toLocaleDateString('vi-VN') : '---'}
                                                    </div>
                                                ) : (
                                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 text-xs font-bold" />
                                                )}
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-stone-400 uppercase">Kết thúc</label>
                                                {readOnly ? (
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
                        {!readOnly && (
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
                            {!readOnly && (
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
                            {readOnly && (
                                <div className="flex items-center gap-2 px-2 text-stone-400 font-black text-[10px] uppercase tracking-widest mb-2">
                                    <Package size={14} className="text-orange-500" /> Chi tiết Lệnh sản xuất {activeTab === 'allocations' && '& Cấp phát'}
                                </div>
                            )}
                            
                            {/* Tabs for View Mode */}
                            {readOnly && (
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

                            {readOnly && activeTab === 'analysis' && analysisSummary ? (
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

                                    {/* Material Analysis */}
                                    <div className="p-8 bg-black/5 dark:bg-white/5 rounded-[32px] border border-stone-200 dark:border-zinc-800">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="p-3 bg-white dark:bg-zinc-800 rounded-2xl shadow-sm text-emerald-600">
                                                <TrendingUp size={24} />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-stone-900 dark:text-white uppercase tracking-widest text-sm">Phân tích tỉ lệ tiêu hao</h3>
                                                <p className="text-xs text-stone-500 font-bold italic">Dựa trên {analysisSummary.actualTons.toFixed(2)} tấn thành phẩm thực tế</p>
                                            </div>
                                        </div>

                                        {analysisSummary.materials.length === 0 ? (
                                            <div className="p-12 text-center text-stone-400 font-bold bg-white/50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-stone-300 dark:border-zinc-700">
                                                Chưa có dữ liệu cấp phát để phân tích.
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
                                </div>
                            ) : readOnly && activeTab === 'allocations' ? (
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
                                <div className={readOnly ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-3'}>
                                    {lots.map((lot, idx) => {
                                        const product = products.find(p => p.id === lot.product_id);
                                        // Placeholder for convertUnit, assuming it would be provided by a context or hook
                                        // For now, it's a no-op to avoid runtime errors.
                                        // const convertUnit = (productId: string, fromUnit: string, toUnit: string, quantity: number, baseUnit: string, unitMap: Map<string, string>, convMap: Map<string, Map<string, number>>) => quantity;
                                        // Example usage if `selectedProduct` was defined:
                                        // (qty, from, to) => convertUnit(selectedProduct.id, from, to, qty, selectedProduct.unit, unitNameMap, conversionMap);
                                        
                                        if (readOnly) {
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
                            )}
                        </div>

                        {/* Description */}
                        <div className="space-y-2 px-2">
                             <label className="text-[10px] font-black uppercase tracking-widest text-stone-400">Ghi chú lệnh sản xuất</label>
                             {readOnly ? (
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
                        {readOnly ? 'Đóng lại' : 'Hủy bỏ'}
                    </button>
                    {!readOnly && (
                        <button
                            form="prod-form"
                            type="submit"
                            disabled={isSaving}
                            className="px-10 py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black uppercase tracking-widest shadow-xl shadow-orange-600/30 flex items-center gap-2 transition-all transform active:scale-95 disabled:opacity-70"
                        >
                            {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                            {editItem ? 'LƯU THAY ĐỔI' : 'TẠO LỆNH SẢN XUẤT'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
