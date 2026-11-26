'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
    X,
    Plus,
    Trash2,
    Save,
    Loader2,
    RefreshCw,
    ArrowDownToLine,
    Target,
    Layers,
    Sparkles,
    Warehouse,
    Calendar,
    Users,
    Percent,
    Scale,
    FileSpreadsheet,
    CheckCircle2,
    Info
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import {
    OutputType,
    PLAN_MODE_CONFIG,
    PLAN_PRIORITY_CONFIG,
    PlanMode,
    PlanPriority,
    ProductLite,
    ProductionPlan
} from './types'
import { generateProductionPlanCode, resolveUnitWeightKg } from '@/lib/productionPlanService'
import { PlanProductAutocomplete } from './PlanProductAutocomplete'

export interface CreateProductionPlanModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: (planId: string) => void
    systemCode: string
    allowSelectSystem?: boolean
    availableSystems?: Array<{ code: string; name: string }>
    editPlan?: ProductionPlan | null
    defaultRequestedBy?: string
}

interface InputRowDraft {
    key: string
    existingId?: string
    product_id: string
    product: ProductLite | null
    unit: string
    weight_per_unit_kg: number
    required_quantity: number
    is_open_quantity: boolean
    allocated_quantity: number
    issued_quantity: number
    returned_quantity: number
    unit_cost: number
    notes: string
}

interface OutputRowDraft {
    key: string
    existingId?: string
    product_id: string | null
    product: ProductLite | null
    item_name: string
    output_type: OutputType
    unit: string
    weight_per_unit_kg: number
    target_quantity: number
    produced_quantity: number
    target_lot_code: string
    cost_allocation_ratio: number
    notes: string
}

interface UnitRecord {
    id: string
    name: string
    code: string | null
}

interface BomRecord {
    id: string
    code: string | null
    name: string
    quantity: number
    product_id: string
    system_code?: string | null
    products?: {
        id: string
        name: string
        sku: string
        unit: string | null
        weight_kg?: number | null
    } | null
}

interface CustomerRecord {
    id: string
    code?: string | null
    name: string
}

interface ProductionOrderRecord {
    id: string
    code: string
    name: string
    status: string
}

const COMMON_UNIT_SUGGESTIONS = ['Kg', 'Tấn', 'Tạ', 'Thùng', 'Thùng (10kg)', 'Khay', 'Túi', 'Bao', 'Kiện']

function toDatetimeLocalValue(iso?: string | null): string {
    if (!iso) return ''
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function createEmptyInputRow(defaultOpenQty: boolean): InputRowDraft {
    return {
        key: crypto.randomUUID(),
        product_id: '',
        product: null,
        unit: 'Kg',
        weight_per_unit_kg: 1,
        required_quantity: 0,
        is_open_quantity: defaultOpenQty,
        allocated_quantity: 0,
        issued_quantity: 0,
        returned_quantity: 0,
        unit_cost: 0,
        notes: ''
    }
}

function createEmptyOutputRow(type: OutputType = 'PRIMARY'): OutputRowDraft {
    return {
        key: crypto.randomUUID(),
        product_id: null,
        product: null,
        item_name: '',
        output_type: type,
        unit: type === 'PRIMARY' ? 'Thùng' : 'Kg',
        weight_per_unit_kg: 1,
        target_quantity: 0,
        produced_quantity: 0,
        target_lot_code: '',
        cost_allocation_ratio: type === 'PRIMARY' ? 100 : type === 'BYPRODUCT' ? 15 : 0,
        notes: ''
    }
}

export function CreateProductionPlanModal({
    isOpen,
    onClose,
    onSuccess,
    systemCode,
    allowSelectSystem = false,
    availableSystems = [],
    editPlan = null,
    defaultRequestedBy = ''
}: CreateProductionPlanModalProps) {
    const { showToast } = useToast()
    const isEdit = !!editPlan

    // Phân hệ kho đang thao tác
    const [activeSystemCode, setActiveSystemCode] = useState<string>(editPlan?.system_code || systemCode)

    // Master data của phân hệ
    const [loadingMaster, setLoadingMaster] = useState(false)
    const [products, setProducts] = useState<ProductLite[]>([])
    const [units, setUnits] = useState<UnitRecord[]>([])
    const [boms, setBoms] = useState<BomRecord[]>([])
    const [customers, setCustomers] = useState<CustomerRecord[]>([])
    const [productions, setProductions] = useState<ProductionOrderRecord[]>([])

    // Form header states
    const [code, setCode] = useState('')
    const [generatingCode, setGeneratingCode] = useState(false)
    const [name, setName] = useState('')
    const [planMode, setPlanMode] = useState<PlanMode>('INPUT_DRIVEN')
    const [priority, setPriority] = useState<PlanPriority>('NORMAL')
    const [workAreaName, setWorkAreaName] = useState('')
    const [requestedByName, setRequestedByName] = useState('')
    const [plannedStartAt, setPlannedStartAt] = useState('')
    const [plannedEndAt, setPlannedEndAt] = useState('')
    const [workerCount, setWorkerCount] = useState<string>('')
    const [allowedLossPercent, setAllowedLossPercent] = useState<number>(5)
    const [expectedYieldPercent, setExpectedYieldPercent] = useState<string>('')
    const [productionId, setProductionId] = useState<string>('')
    const [customerId, setCustomerId] = useState<string>('')
    const [bomId, setBomId] = useState<string>('')
    const [bomTargetQty, setBomTargetQty] = useState<number>(1)
    const [loadingBom, setLoadingBom] = useState(false)
    const [notes, setNotes] = useState('')

    // Dòng nguyên liệu đầu vào & thành phẩm đầu ra
    const [inputRows, setInputRows] = useState<InputRowDraft[]>([createEmptyInputRow(false)])
    const [outputRows, setOutputRows] = useState<OutputRowDraft[]>([createEmptyOutputRow('PRIMARY')])
    const [saving, setSaving] = useState(false)

    // Map đơn vị tính id -> name phục vụ quy đổi tự động Kg/ĐVT
    const unitsMap = useMemo(() => {
        const m = new Map<string, string>()
        for (const u of units) {
            m.set(u.id, u.name)
        }
        return m
    }, [units])

    // Danh sách tên đơn vị gợi ý tổng hợp (không trùng lặp)
    const allUnitNames = useMemo(() => {
        const set = new Set<string>(COMMON_UNIT_SUGGESTIONS)
        for (const u of units) {
            if (u.name?.trim()) set.add(u.name.trim())
        }
        return Array.from(set)
    }, [units])

    // Gộp cả sản phẩm đính kèm trên các dòng cũ (nếu sửa kế hoạch) để Autocomplete luôn hiển thị trọn vẹn
    const mergedProducts = useMemo(() => {
        const map = new Map<string, ProductLite>()
        for (const p of products) {
            map.set(p.id, p)
        }
        for (const row of inputRows) {
            if (row.product && !map.has(row.product.id)) {
                map.set(row.product.id, row.product)
            }
        }
        for (const row of outputRows) {
            if (row.product && !map.has(row.product.id)) {
                map.set(row.product.id, row.product)
            }
        }
        return Array.from(map.values())
    }, [products, inputRows, outputRows])

    const handleRegenerateCode = useCallback(async (targetSys: string) => {
        if (!targetSys) return
        setGeneratingCode(true)
        try {
            const nextCode = await generateProductionPlanCode(targetSys)
            setCode(nextCode)
        } catch (err) {
            console.error('Lỗi sinh mã KHSX:', err)
        } finally {
            setGeneratingCode(false)
        }
    }, [])

    // Tải dữ liệu danh mục theo phân hệ kho đang chọn
    const loadMasterDataForSystem = useCallback(async (targetSys: string) => {
        if (!targetSys) return
        setLoadingMaster(true)
        try {
            const [prodRes, unitRes, bomRes, custRes, moRes] = await Promise.all([
                supabase
                    .from('products')
                    .select(
                        'id, name, sku, unit, internal_code, internal_name, aliases, weight_kg, cost_price, price, category_id, system_type, system_code, product_units(unit_id, conversion_rate)'
                    )
                    .or(`system_type.eq.${targetSys},system_code.eq.${targetSys}`)
                    .order('name', { ascending: true })
                    .limit(2000),
                supabase
                    .from('units')
                    .select('id, name, code')
                    .or(`system_code.eq.${targetSys},system_code.is.null`)
                    .order('name', { ascending: true }),
                (supabase.from('boms' as any) as any)
                    .select('id, code, name, quantity, product_id, system_code, products!boms_product_id_fkey(id, name, sku, unit, weight_kg)')
                    .or(`system_code.eq.${targetSys},system_code.eq.SANXUAT,system_code.is.null`)
                    .order('created_at', { ascending: false })
                    .limit(200),
                supabase
                    .from('customers')
                    .select('id, code, name')
                    .or(`system_code.eq.${targetSys},system_type.eq.${targetSys},system_code.is.null`)
                    .order('name', { ascending: true })
                    .limit(500),
                (supabase.from('productions' as any) as any)
                    .select('id, code, name, status')
                    .neq('status', 'CANCELED')
                    .order('created_at', { ascending: false })
                    .limit(150)
            ])

            const loadedUnits: UnitRecord[] = (unitRes.data || []) as UnitRecord[]
            const localUnitMap = new Map<string, string>()
            for (const u of loadedUnits) {
                localUnitMap.set(u.id, u.name)
            }

            const enrichedProducts: ProductLite[] = ((prodRes.data || []) as any[]).map(p => ({
                ...p,
                product_units: Array.isArray(p.product_units)
                    ? p.product_units.map((pu: any) => ({
                          unit_id: pu.unit_id,
                          conversion_rate: Number(pu.conversion_rate) || 1,
                          unit_name: localUnitMap.get(pu.unit_id) || undefined
                      }))
                    : []
            }))

            setUnits(loadedUnits)
            setProducts(enrichedProducts)
            setBoms((bomRes.data || []) as BomRecord[])
            setCustomers((custRes.data || []) as CustomerRecord[])
            setProductions((moRes.data || []) as ProductionOrderRecord[])
        } catch (err: any) {
            console.error('Lỗi tải danh mục phân hệ:', err)
            showToast('Không thể tải đầy đủ danh mục: ' + (err?.message || 'Lỗi kết nối'), 'warning')
        } finally {
            setLoadingMaster(false)
        }
    }, [showToast])

    // Khởi tạo dữ liệu khi mở Modal (Tạo mới vs Chỉnh sửa)
    useEffect(() => {
        if (!isOpen) return

        const initialSys = editPlan?.system_code || systemCode
        setActiveSystemCode(initialSys)
        loadMasterDataForSystem(initialSys)

        if (editPlan) {
            setCode(editPlan.code)
            setName(editPlan.name)
            setPlanMode(editPlan.plan_mode)
            setPriority(editPlan.priority)
            setWorkAreaName(editPlan.work_area_name || '')
            setRequestedByName(editPlan.requested_by_name || '')
            setPlannedStartAt(toDatetimeLocalValue(editPlan.planned_start_at))
            setPlannedEndAt(toDatetimeLocalValue(editPlan.planned_end_at))
            setWorkerCount(editPlan.worker_count ? String(editPlan.worker_count) : '')
            setAllowedLossPercent(Number(editPlan.allowed_loss_percent ?? 5))
            setExpectedYieldPercent(
                editPlan.expected_yield_percent !== null && editPlan.expected_yield_percent !== undefined
                    ? String(editPlan.expected_yield_percent)
                    : ''
            )
            setProductionId(editPlan.production_id || '')
            setCustomerId(editPlan.customer_id || '')
            setBomId(editPlan.bom_id || '')
            setBomTargetQty(editPlan.boms?.quantity ? Number(editPlan.boms.quantity) : 1)
            setNotes(editPlan.notes || '')

            const mapInputsToDrafts = (rows: any[]): InputRowDraft[] =>
                rows
                    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                    .map(inp => ({
                        key: inp.id || crypto.randomUUID(),
                        existingId: inp.id,
                        product_id: inp.product_id,
                        product: inp.products || null,
                        unit: inp.unit || 'Kg',
                        weight_per_unit_kg: Number(inp.weight_per_unit_kg) || 1,
                        required_quantity: Number(inp.required_quantity) || 0,
                        is_open_quantity: Boolean(inp.is_open_quantity),
                        allocated_quantity: Number(inp.allocated_quantity) || 0,
                        issued_quantity: Number(inp.issued_quantity) || 0,
                        returned_quantity: Number(inp.returned_quantity) || 0,
                        unit_cost: Number(inp.unit_cost) || 0,
                        notes: inp.notes || ''
                    }))

            const mapOutputsToDrafts = (rows: any[]): OutputRowDraft[] =>
                rows
                    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                    .map(out => ({
                        key: out.id || crypto.randomUUID(),
                        existingId: out.id,
                        product_id: out.product_id || null,
                        product: out.products || null,
                        item_name: out.item_name || out.products?.name || '',
                        output_type: out.output_type || 'PRIMARY',
                        unit: out.unit || 'Kg',
                        weight_per_unit_kg: Number(out.weight_per_unit_kg) || 1,
                        target_quantity: Number(out.target_quantity) || 0,
                        produced_quantity: Number(out.produced_quantity) || 0,
                        target_lot_code: out.target_lot_code || '',
                        cost_allocation_ratio: Number(out.cost_allocation_ratio ?? 100),
                        notes: out.notes || ''
                    }))

            if (editPlan.production_plan_inputs && editPlan.production_plan_inputs.length > 0) {
                setInputRows(mapInputsToDrafts(editPlan.production_plan_inputs))
            } else {
                // Tải bổ sung từ DB nếu editPlan chưa kèm chi tiết inputs
                ;(supabase.from('production_plan_inputs' as any) as any)
                    .select('*, products(id, name, sku, unit, internal_code, aliases, weight_kg, cost_price, price)')
                    .eq('plan_id', editPlan.id)
                    .then(({ data }: any) => {
                        if (data && data.length > 0) {
                            setInputRows(mapInputsToDrafts(data))
                        } else {
                            setInputRows([createEmptyInputRow(editPlan.plan_mode === 'OUTPUT_DRIVEN')])
                        }
                    })
            }

            if (editPlan.production_plan_outputs && editPlan.production_plan_outputs.length > 0) {
                setOutputRows(mapOutputsToDrafts(editPlan.production_plan_outputs))
            } else {
                ;(supabase.from('production_plan_outputs' as any) as any)
                    .select('*, products(id, name, sku, unit, internal_code, aliases, weight_kg, cost_price, price)')
                    .eq('plan_id', editPlan.id)
                    .then(({ data }: any) => {
                        if (data && data.length > 0) {
                            setOutputRows(mapOutputsToDrafts(data))
                        } else {
                            setOutputRows([createEmptyOutputRow('PRIMARY')])
                        }
                    })
            }
        } else {
            // Reset form tạo mới
            const nowLocal = new Date()
            const startDefault = toDatetimeLocalValue(nowLocal.toISOString())
            setName('')
            setPlanMode('INPUT_DRIVEN')
            setPriority('NORMAL')
            setWorkAreaName('')
            setRequestedByName(defaultRequestedBy || '')
            setPlannedStartAt(startDefault)
            setPlannedEndAt('')
            setWorkerCount('')
            setAllowedLossPercent(5)
            setExpectedYieldPercent('')
            setProductionId('')
            setCustomerId('')
            setBomId('')
            setBomTargetQty(1)
            setNotes('')
            setInputRows([createEmptyInputRow(false)])
            setOutputRows([createEmptyOutputRow('PRIMARY')])
            handleRegenerateCode(initialSys)
        }
    }, [isOpen, editPlan, systemCode, defaultRequestedBy, loadMasterDataForSystem, handleRegenerateCode])

    // Đổi phân hệ kho khi mở từ cổng trung tâm (/sanxuat/production-plans)
    const handleSystemChange = (nextSys: string) => {
        if (nextSys === activeSystemCode) return
        setActiveSystemCode(nextSys)
        loadMasterDataForSystem(nextSys)
        if (!isEdit) {
            handleRegenerateCode(nextSys)
            setInputRows([createEmptyInputRow(planMode === 'OUTPUT_DRIVEN')])
            setOutputRows([createEmptyOutputRow('PRIMARY')])
            setBomId('')
            setCustomerId('')
        }
    }

    // Đổi loại kế hoạch (plan_mode)
    const handlePlanModeChange = (nextMode: PlanMode) => {
        setPlanMode(nextMode)
        if (nextMode === 'OUTPUT_DRIVEN') {
            // Tự động bật Xuất mở theo thực tế chạy cho các dòng đầu vào chưa chốt cứng
            setInputRows(prev =>
                prev.map(r => ({
                    ...r,
                    is_open_quantity: r.existingId ? r.is_open_quantity : true
                }))
            )
            // Đảm bảo có ít nhất 1 dòng thành phẩm chính PRIMARY
            setOutputRows(prev =>
                prev.some(o => o.output_type === 'PRIMARY') ? prev : [createEmptyOutputRow('PRIMARY'), ...prev]
            )
        } else if (nextMode === 'INPUT_DRIVEN' && !isEdit) {
            setInputRows(prev =>
                prev.map(r => ({
                    ...r,
                    is_open_quantity: false
                }))
            )
        }
    }

    // Nạp nhanh Thành phẩm đầu ra + Nguyên liệu đầu vào từ Định mức BOM
    const handleApplyBom = async () => {
        if (!bomId) {
            showToast('Vui lòng chọn Định mức BOM trước khi nạp nhanh.', 'warning')
            return
        }
        const selectedBom = boms.find(b => b.id === bomId)
        if (!selectedBom) return

        const targetQty = Number(bomTargetQty) > 0 ? Number(bomTargetQty) : Number(selectedBom.quantity) || 1
        const baseQty = Number(selectedBom.quantity) > 0 ? Number(selectedBom.quantity) : 1
        const scale = targetQty / baseQty

        setLoadingBom(true)
        try {
            const { data: lines, error } = await (supabase.from('bom_lines' as any) as any)
                .select(
                    'id, material_id, quantity, unit, scrap_percentage, notes, products!bom_lines_material_id_fkey(id, name, sku, unit, internal_code, aliases, weight_kg, cost_price, price)'
                )
                .eq('bom_id', bomId)

            if (error) throw error

            if (!lines || lines.length === 0) {
                showToast('Định mức BOM này chưa có chi tiết nguyên vật liệu.', 'warning')
                return
            }

            // 1. Điền dòng Nguyên liệu đầu vào từ BOM lines
            const newInputs: InputRowDraft[] = lines.map((line: any) => {
                const prodInSystem = products.find(p => p.id === line.material_id) || (line.products as ProductLite | null)
                const unitStr = line.unit || prodInSystem?.unit || 'Kg'
                const wKg = resolveUnitWeightKg(unitStr, prodInSystem, unitsMap)
                const scrapFactor = 1 + (Number(line.scrap_percentage) || 0) / 100
                const calcQty = Math.round(Number(line.quantity || 0) * scale * scrapFactor * 1000) / 1000
                const defaultCost = Number(prodInSystem?.cost_price || prodInSystem?.price || 0)

                return {
                    key: crypto.randomUUID(),
                    product_id: line.material_id,
                    product: prodInSystem,
                    unit: unitStr,
                    weight_per_unit_kg: wKg,
                    required_quantity: calcQty,
                    is_open_quantity: planMode === 'OUTPUT_DRIVEN',
                    allocated_quantity: 0,
                    issued_quantity: 0,
                    returned_quantity: 0,
                    unit_cost: defaultCost,
                    notes: line.notes || ''
                }
            })

            // Giữ lại các dòng đã có phân bổ/xuất kho nếu đang ở chế độ Sửa
            setInputRows(prev => {
                const lockedExisting = prev.filter(
                    r => r.existingId && (r.allocated_quantity > 0 || r.issued_quantity > 0)
                )
                return [...lockedExisting, ...newInputs]
            })

            // 2. Điền dòng Thành phẩm chính đầu ra từ sản phẩm của BOM
            const outProd =
                products.find(p => p.id === selectedBom.product_id) ||
                (selectedBom.products
                    ? ({
                          id: selectedBom.products.id,
                          name: selectedBom.products.name,
                          sku: selectedBom.products.sku,
                          unit: selectedBom.products.unit,
                          weight_kg: selectedBom.products.weight_kg
                      } as ProductLite)
                    : null)

            const outUnit = outProd?.unit || 'Thùng'
            const outWeightKg = resolveUnitWeightKg(outUnit, outProd, unitsMap)

            const primaryDraft: OutputRowDraft = {
                key: crypto.randomUUID(),
                product_id: outProd?.id || selectedBom.product_id || null,
                product: outProd,
                item_name: outProd?.name || selectedBom.name,
                output_type: 'PRIMARY',
                unit: outUnit,
                weight_per_unit_kg: outWeightKg,
                target_quantity: targetQty,
                produced_quantity: 0,
                target_lot_code: '',
                cost_allocation_ratio: 100,
                notes: `Theo BOM: ${selectedBom.code || selectedBom.name}`
            }

            setOutputRows(prev => {
                const lockedOutputs = prev.filter(o => o.existingId && o.produced_quantity > 0)
                const otherNonEmpty = prev.filter(
                    o => !o.existingId && o.output_type !== 'PRIMARY' && o.item_name.trim()
                )
                return [...lockedOutputs, primaryDraft, ...otherNonEmpty]
            })

            if (!name.trim()) {
                setName(`SX ${outProd?.name || selectedBom.name} (${targetQty.toLocaleString('vi-VN')} ${outUnit})`)
            }

            showToast(`Đã nạp ${newInputs.length} nguyên liệu & thành phẩm mục tiêu từ BOM!`, 'success')
        } catch (err: any) {
            console.error('Lỗi nạp BOM:', err)
            showToast('Lỗi khi nạp từ BOM: ' + (err?.message || 'Không xác định'), 'error')
        } finally {
            setLoadingBom(false)
        }
    }

    // Các hàm cập nhật dòng Nguyên liệu Đầu vào
    const updateInputRow = (key: string, updater: (row: InputRowDraft) => InputRowDraft) => {
        setInputRows(prev => prev.map(r => (r.key === key ? updater(r) : r)))
    }

    const handleSelectInputProduct = (key: string, prod: ProductLite | null) => {
        updateInputRow(key, row => {
            if (!prod) {
                return { ...row, product_id: '', product: null }
            }
            const nextUnit = prod.unit || row.unit || 'Kg'
            const autoWeight = resolveUnitWeightKg(nextUnit, prod, unitsMap)
            const autoCost = Number(prod.cost_price || prod.price || 0)
            return {
                ...row,
                product_id: prod.id,
                product: prod,
                unit: nextUnit,
                weight_per_unit_kg: autoWeight,
                unit_cost: row.unit_cost > 0 ? row.unit_cost : autoCost
            }
        })
    }

    const handleChangeInputUnit = (key: string, nextUnit: string) => {
        updateInputRow(key, row => {
            const autoWeight = resolveUnitWeightKg(nextUnit, row.product, unitsMap)
            return {
                ...row,
                unit: nextUnit,
                weight_per_unit_kg: autoWeight
            }
        })
    }

    const handleRemoveInputRow = (row: InputRowDraft) => {
        if (row.allocated_quantity > 0 || row.issued_quantity > 0) {
            showToast(
                'Dòng nguyên liệu này đã có số lượng soạn/xuất kho thực tế, không thể xóa để bảo toàn lịch sử.',
                'warning'
            )
            return
        }
        setInputRows(prev => (prev.length <= 1 ? [createEmptyInputRow(planMode === 'OUTPUT_DRIVEN')] : prev.filter(r => r.key !== row.key)))
    }

    // Các hàm cập nhật dòng Thành phẩm & Phụ phẩm Đầu ra
    const updateOutputRow = (key: string, updater: (row: OutputRowDraft) => OutputRowDraft) => {
        setOutputRows(prev => prev.map(r => (r.key === key ? updater(r) : r)))
    }

    const handleSelectOutputProduct = (key: string, prod: ProductLite | null) => {
        updateOutputRow(key, row => {
            if (!prod) {
                return { ...row, product_id: null, product: null }
            }
            const nextUnit = prod.unit || row.unit || 'Kg'
            const autoWeight = resolveUnitWeightKg(nextUnit, prod, unitsMap)
            return {
                ...row,
                product_id: prod.id,
                product: prod,
                item_name: prod.name,
                unit: nextUnit,
                weight_per_unit_kg: autoWeight
            }
        })
    }

    const handleChangeOutputUnit = (key: string, nextUnit: string) => {
        updateOutputRow(key, row => {
            const autoWeight = resolveUnitWeightKg(nextUnit, row.product, unitsMap)
            return {
                ...row,
                unit: nextUnit,
                weight_per_unit_kg: autoWeight
            }
        })
    }

    const handleRemoveOutputRow = (row: OutputRowDraft) => {
        if (row.produced_quantity > 0) {
            showToast('Dòng đầu ra này đã ghi nhận sản lượng thực tế, không thể xóa.', 'warning')
            return
        }
        setOutputRows(prev => prev.filter(r => r.key !== row.key))
    }

    // Tổng hợp nhanh khối lượng dự kiến trên Footer
    const previewSummary = useMemo(() => {
        const validInputs = inputRows.filter(r => !!r.product_id)
        const totalInputKg = validInputs.reduce(
            (sum, r) => sum + (Number(r.required_quantity) || 0) * (Number(r.weight_per_unit_kg) || 1),
            0
        )
        const totalEstimatedCost = validInputs.reduce(
            (sum, r) => sum + (Number(r.required_quantity) || 0) * (Number(r.unit_cost) || 0),
            0
        )
        const openInputCount = validInputs.filter(r => r.is_open_quantity).length

        const validOutputs = outputRows.filter(o => o.item_name.trim().length > 0)
        const primaryOutputKg = validOutputs
            .filter(o => o.output_type === 'PRIMARY')
            .reduce((sum, o) => sum + (Number(o.target_quantity) || 0) * (Number(o.weight_per_unit_kg) || 1), 0)

        return {
            validInputCount: validInputs.length,
            totalInputKg: Math.round(totalInputKg * 100) / 100,
            totalEstimatedCost: Math.round(totalEstimatedCost),
            openInputCount,
            validOutputCount: validOutputs.length,
            primaryOutputKg: Math.round(primaryOutputKg * 100) / 100
        }
    }, [inputRows, outputRows])

    // Kiểm tra hợp lệ & Lưu dữ liệu
    const handleSave = async () => {
        if (!activeSystemCode) {
            showToast('Vui lòng chọn phân hệ kho cần lấy hàng tồn.', 'error')
            return
        }
        if (!code.trim()) {
            showToast('Mã kế hoạch sản xuất không được để trống.', 'error')
            return
        }
        if (!name.trim()) {
            showToast('Vui lòng nhập Tên kế hoạch sản xuất.', 'error')
            return
        }
        if (allowedLossPercent < 0 || allowedLossPercent > 100) {
            showToast('Định mức hao hụt cho phép (%) phải nằm trong khoảng 0 - 100%.', 'error')
            return
        }

        const validInputs = inputRows.filter(r => !!r.product_id)
        if (validInputs.length === 0) {
            showToast('Vui lòng chọn ít nhất 1 dòng Nguyên liệu đầu vào cần lấy từ tồn kho.', 'error')
            return
        }

        for (let i = 0; i < validInputs.length; i++) {
            const r = validInputs[i]
            if (!r.unit.trim()) {
                showToast(`Nguyên liệu dòng #${i + 1}: Vui lòng nhập Đơn vị tính.`, 'error')
                return
            }
            if ((Number(r.weight_per_unit_kg) || 0) <= 0) {
                showToast(`Nguyên liệu dòng #${i + 1}: Hệ số quy đổi Kg/ĐVT phải lớn hơn 0.`, 'error')
                return
            }
            if (!r.is_open_quantity && (Number(r.required_quantity) || 0) <= 0) {
                showToast(
                    `Nguyên liệu "${r.product?.name || `#${i + 1}`}": Vui lòng nhập số lượng yêu cầu > 0 hoặc bật "Xuất mở theo thực tế chạy".`,
                    'error'
                )
                return
            }
        }

        const validOutputs = outputRows.filter(o => o.item_name.trim().length > 0)
        if (planMode === 'OUTPUT_DRIVEN' || planMode === 'HYBRID') {
            const hasPrimaryTarget = validOutputs.some(
                o => o.output_type === 'PRIMARY' && (Number(o.target_quantity) || 0) > 0
            )
            if (!hasPrimaryTarget) {
                showToast(
                    'Với chế độ Mục tiêu Đầu ra / Kết hợp, vui lòng khai báo ít nhất 1 Thành phẩm chính có Số lượng mục tiêu > 0.',
                    'error'
                )
                return
            }
        }

        for (let i = 0; i < validOutputs.length; i++) {
            const o = validOutputs[i]
            if (!o.unit.trim()) {
                showToast(`Đầu ra "${o.item_name}": Vui lòng nhập Đơn vị tính.`, 'error')
                return
            }
            if ((Number(o.weight_per_unit_kg) || 0) <= 0) {
                showToast(`Đầu ra "${o.item_name}": Hệ số quy đổi Kg/ĐVT phải lớn hơn 0.`, 'error')
                return
            }
        }

        setSaving(true)
        try {
            const parsedWorkers = workerCount.trim() ? parseInt(workerCount, 10) : null
            const parsedExpectedYield = expectedYieldPercent.trim() ? parseFloat(expectedYieldPercent) : null

            const planPayload: Record<string, any> = {
                system_code: activeSystemCode,
                code: code.trim().toUpperCase(),
                name: name.trim(),
                plan_mode: planMode,
                priority,
                production_id: productionId || null,
                bom_id: bomId || null,
                customer_id: customerId || null,
                work_area_name: workAreaName.trim() || null,
                requested_by_name: requestedByName.trim() || null,
                planned_start_at: plannedStartAt ? new Date(plannedStartAt).toISOString() : null,
                planned_end_at: plannedEndAt ? new Date(plannedEndAt).toISOString() : null,
                worker_count: parsedWorkers && !isNaN(parsedWorkers) && parsedWorkers > 0 ? parsedWorkers : null,
                allowed_loss_percent: Number(allowedLossPercent) || 0,
                expected_yield_percent:
                    parsedExpectedYield !== null && !isNaN(parsedExpectedYield) ? parsedExpectedYield : null,
                notes: notes.trim() || null,
                updated_at: new Date().toISOString()
            }

            let savedPlanId = editPlan?.id || ''

            if (isEdit && editPlan) {
                // 1. Cập nhật Kế hoạch gốc
                const { error: updErr } = await (supabase.from('production_plans' as any) as any)
                    .update(planPayload)
                    .eq('id', editPlan.id)
                if (updErr) throw updErr
                savedPlanId = editPlan.id

                // 2. Đồng bộ production_plan_inputs (bảo toàn 100% allocated/issued/returned của các dòng cũ)
                const { data: dbInputs } = await (supabase.from('production_plan_inputs' as any) as any)
                    .select('id')
                    .eq('plan_id', savedPlanId)
                const existingInputIds = new Set<string>((dbInputs || []).map((x: any) => x.id))
                const keptInputIds = new Set<string>(
                    validInputs.map(r => r.existingId).filter((id): id is string => Boolean(id))
                )
                const removedInputIds = Array.from(existingInputIds).filter(id => !keptInputIds.has(id))

                if (removedInputIds.length > 0) {
                    const { error: delInErr } = await (supabase.from('production_plan_inputs' as any) as any)
                        .delete()
                        .in('id', removedInputIds)
                    if (delInErr) throw delInErr
                }

                for (let idx = 0; idx < validInputs.length; idx++) {
                    const r = validInputs[idx]
                    if (r.existingId && existingInputIds.has(r.existingId)) {
                        const { error: uInErr } = await (supabase.from('production_plan_inputs' as any) as any)
                            .update({
                                product_id: r.product_id,
                                unit: r.unit.trim(),
                                weight_per_unit_kg: Number(r.weight_per_unit_kg) || 1,
                                required_quantity: Number(r.required_quantity) || 0,
                                is_open_quantity: Boolean(r.is_open_quantity),
                                unit_cost: Number(r.unit_cost) || 0,
                                notes: r.notes.trim() || null,
                                sort_order: idx
                            })
                            .eq('id', r.existingId)
                        if (uInErr) throw uInErr
                    } else {
                        const { error: iInErr } = await (supabase.from('production_plan_inputs' as any) as any).insert({
                            system_code: activeSystemCode,
                            plan_id: savedPlanId,
                            product_id: r.product_id,
                            unit: r.unit.trim(),
                            weight_per_unit_kg: Number(r.weight_per_unit_kg) || 1,
                            required_quantity: Number(r.required_quantity) || 0,
                            is_open_quantity: Boolean(r.is_open_quantity),
                            allocated_quantity: 0,
                            issued_quantity: 0,
                            returned_quantity: 0,
                            unit_cost: Number(r.unit_cost) || 0,
                            notes: r.notes.trim() || null,
                            sort_order: idx
                        })
                        if (iInErr) throw iInErr
                    }
                }

                // 3. Đồng bộ production_plan_outputs (bảo toàn 100% produced_quantity của các dòng cũ)
                const { data: dbOutputs } = await (supabase.from('production_plan_outputs' as any) as any)
                    .select('id')
                    .eq('plan_id', savedPlanId)
                const existingOutputIds = new Set<string>((dbOutputs || []).map((x: any) => x.id))
                const keptOutputIds = new Set<string>(
                    validOutputs.map(o => o.existingId).filter((id): id is string => Boolean(id))
                )
                const removedOutputIds = Array.from(existingOutputIds).filter(id => !keptOutputIds.has(id))

                if (removedOutputIds.length > 0) {
                    const { error: delOutErr } = await (supabase.from('production_plan_outputs' as any) as any)
                        .delete()
                        .in('id', removedOutputIds)
                    if (delOutErr) throw delOutErr
                }

                for (let idx = 0; idx < validOutputs.length; idx++) {
                    const o = validOutputs[idx]
                    if (o.existingId && existingOutputIds.has(o.existingId)) {
                        const { error: uOutErr } = await (supabase.from('production_plan_outputs' as any) as any)
                            .update({
                                product_id: o.product_id || null,
                                item_name: o.item_name.trim(),
                                output_type: o.output_type,
                                unit: o.unit.trim(),
                                weight_per_unit_kg: Number(o.weight_per_unit_kg) || 1,
                                target_quantity: Number(o.target_quantity) || 0,
                                target_lot_code: o.target_lot_code.trim() || null,
                                cost_allocation_ratio: Number(o.cost_allocation_ratio) || 0,
                                notes: o.notes.trim() || null,
                                sort_order: idx
                            })
                            .eq('id', o.existingId)
                        if (uOutErr) throw uOutErr
                    } else {
                        const { error: iOutErr } = await (supabase.from('production_plan_outputs' as any) as any).insert(
                            {
                                system_code: activeSystemCode,
                                plan_id: savedPlanId,
                                product_id: o.product_id || null,
                                item_name: o.item_name.trim(),
                                output_type: o.output_type,
                                unit: o.unit.trim(),
                                weight_per_unit_kg: Number(o.weight_per_unit_kg) || 1,
                                target_quantity: Number(o.target_quantity) || 0,
                                produced_quantity: 0,
                                target_lot_code: o.target_lot_code.trim() || null,
                                cost_allocation_ratio: Number(o.cost_allocation_ratio) || 0,
                                notes: o.notes.trim() || null,
                                sort_order: idx
                            }
                        )
                        if (iOutErr) throw iOutErr
                    }
                }

                showToast(`Đã cập nhật kế hoạch ${planPayload.code} thành công!`, 'success')
            } else {
                // Tạo mới kế hoạch
                let insertRes = await (supabase.from('production_plans' as any) as any)
                    .insert({
                        ...planPayload,
                        status: 'DRAFT'
                    })
                    .select('id, code')
                    .single()

                // Nếu trùng mã code (23505), tự sinh mã kế tiếp và thử lại 1 lần
                if (insertRes.error && insertRes.error.code === '23505') {
                    const freshCode = await generateProductionPlanCode(activeSystemCode)
                    setCode(freshCode)
                    insertRes = await (supabase.from('production_plans' as any) as any)
                        .insert({
                            ...planPayload,
                            code: freshCode,
                            status: 'DRAFT'
                        })
                        .select('id, code')
                        .single()
                }

                if (insertRes.error) throw insertRes.error
                savedPlanId = insertRes.data.id

                const inputsPayload = validInputs.map((r, idx) => ({
                    system_code: activeSystemCode,
                    plan_id: savedPlanId,
                    product_id: r.product_id,
                    unit: r.unit.trim(),
                    weight_per_unit_kg: Number(r.weight_per_unit_kg) || 1,
                    required_quantity: Number(r.required_quantity) || 0,
                    is_open_quantity: Boolean(r.is_open_quantity),
                    allocated_quantity: 0,
                    issued_quantity: 0,
                    returned_quantity: 0,
                    unit_cost: Number(r.unit_cost) || 0,
                    notes: r.notes.trim() || null,
                    sort_order: idx
                }))

                const { error: inErr } = await (supabase.from('production_plan_inputs' as any) as any).insert(
                    inputsPayload
                )
                if (inErr) {
                    await (supabase.from('production_plans' as any) as any).delete().eq('id', savedPlanId)
                    throw inErr
                }

                if (validOutputs.length > 0) {
                    const outputsPayload = validOutputs.map((o, idx) => ({
                        system_code: activeSystemCode,
                        plan_id: savedPlanId,
                        product_id: o.product_id || null,
                        item_name: o.item_name.trim(),
                        output_type: o.output_type,
                        unit: o.unit.trim(),
                        weight_per_unit_kg: Number(o.weight_per_unit_kg) || 1,
                        target_quantity: Number(o.target_quantity) || 0,
                        produced_quantity: 0,
                        target_lot_code: o.target_lot_code.trim() || null,
                        cost_allocation_ratio: Number(o.cost_allocation_ratio) || 0,
                        notes: o.notes.trim() || null,
                        sort_order: idx
                    }))

                    const { error: outErr } = await (supabase.from('production_plan_outputs' as any) as any).insert(
                        outputsPayload
                    )
                    if (outErr) {
                        await (supabase.from('production_plans' as any) as any).delete().eq('id', savedPlanId)
                        throw outErr
                    }
                }

                showToast(`Đã khởi tạo Kế hoạch Sản xuất ${insertRes.data.code}!`, 'success')
            }

            onSuccess(savedPlanId)
            onClose()
        } catch (err: any) {
            console.error('Lỗi lưu Kế hoạch Sản xuất:', err)
            showToast('Không thể lưu kế hoạch: ' + (err?.message || 'Lỗi không xác định'), 'error')
        } finally {
            setSaving(false)
        }
    }

    if (!isOpen) return null

    const modeCards: Array<{
        mode: PlanMode
        icon: React.ReactNode
        accentBorder: string
        accentBg: string
        accentIcon: string
        shortDesc: string
    }> = [
        {
            mode: 'INPUT_DRIVEN',
            icon: <ArrowDownToLine size={18} />,
            accentBorder: 'border-blue-500 ring-2 ring-blue-500/20',
            accentBg: 'bg-blue-50/70 dark:bg-blue-950/30',
            accentIcon: 'bg-blue-600 text-white',
            shortDesc:
                'VD: SX yêu cầu lấy Sầu riêng A: 5 tấn, C: 6 tấn... Kho soạn sẵn pallet, SX rút làm từ từ đến khi hết khối lượng yêu cầu.'
        },
        {
            mode: 'OUTPUT_DRIVEN',
            icon: <Target size={18} />,
            accentBorder: 'border-emerald-500 ring-2 ring-emerald-500/20',
            accentBg: 'bg-emerald-50/70 dark:bg-emerald-950/30',
            accentIcon: 'bg-emerald-600 text-white',
            shortDesc:
                'VD: SX cần làm đủ 500 thùng khay từ hàng Ri A — nguyên liệu bật "Xuất mở theo thực tế chạy", đủ 500 thùng thì chốt quyết toán tiêu hao & hao hụt.'
        },
        {
            mode: 'HYBRID',
            icon: <Layers size={18} />,
            accentBorder: 'border-purple-500 ring-2 ring-purple-500/20',
            accentBg: 'bg-purple-50/70 dark:bg-purple-950/30',
            accentIcon: 'bg-purple-600 text-white',
            shortDesc:
                'Đặt chỉ tiêu song song cả định mức khối lượng nguyên liệu đầu vào cần cấp và sản lượng thành phẩm đầu ra cần đạt.'
        }
    ]

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-stone-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-6xl max-h-[94vh] flex flex-col bg-stone-50 dark:bg-zinc-950 rounded-3xl border border-stone-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
                {/* Datalist gợi ý đơn vị tính toàn cục cho Modal */}
                <datalist id="production-plan-units-list">
                    {allUnitNames.map(uName => (
                        <option key={uName} value={uName} />
                    ))}
                </datalist>

                {/* HEADER */}
                <div className="shrink-0 px-5 sm:px-7 py-4 bg-white dark:bg-zinc-900 border-b border-stone-200 dark:border-zinc-800 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-orange-500/25 shrink-0">
                            <Scale size={22} />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-base sm:text-lg font-black text-stone-900 dark:text-zinc-100 truncate">
                                    {isEdit
                                        ? `Chỉnh sửa Kế hoạch Sản xuất • ${editPlan?.code}`
                                        : 'Khởi tạo Kế hoạch Sản xuất & Yêu cầu Lấy Tồn Kho'}
                                </h2>
                                {loadingMaster && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                                        <Loader2 size={11} className="animate-spin" /> Đang tải danh mục...
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-stone-500 dark:text-zinc-400 truncate">
                                Thiết lập yêu cầu lấy hàng tồn đi gia công/đóng gói lại, tự động quy đổi Kg, giữ LOT & kiểm soát định mức hao hụt kế toán
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="p-2 rounded-xl text-stone-400 hover:text-stone-800 dark:hover:text-zinc-100 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
                        title="Đóng cửa sổ"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* BODY SCROLLABLE */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-6">
                    {/* CHỌN PHÂN HỆ KHO (Khi mở từ cổng /sanxuat/production-plans) */}
                    {allowSelectSystem && (
                        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-orange-200/80 dark:border-orange-900/40 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="p-2.5 rounded-xl bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-300 shrink-0">
                                    <Warehouse size={18} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-black uppercase tracking-wider text-orange-700 dark:text-orange-300">
                                        Phân hệ Kho cần yêu cầu xuất tồn
                                    </p>
                                    <p className="text-[11px] text-stone-500 dark:text-zinc-400">
                                        Toàn bộ danh mục sản phẩm, tồn kho LOT soạn giữ & lệnh xuất sẽ cô lập theo phân hệ kho này
                                    </p>
                                </div>
                            </div>
                            <select
                                disabled={isEdit}
                                value={activeSystemCode}
                                onChange={e => handleSystemChange(e.target.value)}
                                className="w-full sm:w-72 px-3.5 py-2.5 text-xs font-bold rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-800 dark:text-zinc-100 focus:outline-none focus:border-orange-500 disabled:opacity-60"
                            >
                                {availableSystems.length > 0 ? (
                                    availableSystems.map(sys => (
                                        <option key={sys.code} value={sys.code}>
                                            {sys.name} ({sys.code})
                                        </option>
                                    ))
                                ) : (
                                    <option value={activeSystemCode}>{activeSystemCode}</option>
                                )}
                            </select>
                        </div>
                    )}

                    {/* BƯỚC 1: LOẠI KẾ HOẠCH (PLAN MODE) */}
                    <section className="space-y-2.5">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <label className="text-xs font-black uppercase tracking-wider text-stone-600 dark:text-zinc-300 flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[11px] inline-flex items-center justify-center">
                                    1
                                </span>
                                Chọn Phương thức Điều hành Kế hoạch Sản xuất
                            </label>
                            <span className="text-[11px] text-stone-500 dark:text-zinc-400">
                                Quyết định cách Kho soạn giữ LOT và tiêu chí dừng để Quyết toán cuối kỳ
                            </span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                            {modeCards.map(card => {
                                const selected = planMode === card.mode
                                const cfg = PLAN_MODE_CONFIG[card.mode]
                                return (
                                    <button
                                        key={card.mode}
                                        type="button"
                                        onClick={() => handlePlanModeChange(card.mode)}
                                        className={`text-left p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                                            selected
                                                ? `${card.accentBorder} ${card.accentBg} shadow-sm`
                                                : 'bg-white dark:bg-zinc-900 border-stone-200 dark:border-zinc-800 hover:border-stone-300 dark:hover:border-zinc-700'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div
                                                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                                        selected
                                                            ? card.accentIcon
                                                            : 'bg-stone-100 dark:bg-zinc-800 text-stone-500 dark:text-zinc-400'
                                                    }`}
                                                >
                                                    {card.icon}
                                                </div>
                                                <div className="min-w-0">
                                                    <span className="block text-xs font-black text-stone-900 dark:text-zinc-100 leading-snug">
                                                        {cfg.shortLabel}
                                                    </span>
                                                    <span className="block text-[10px] font-semibold text-stone-500 dark:text-zinc-400">
                                                        {cfg.label}
                                                    </span>
                                                </div>
                                            </div>
                                            <div
                                                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-1 ${
                                                    selected
                                                        ? 'border-orange-500 bg-orange-500 text-white'
                                                        : 'border-stone-300 dark:border-zinc-600'
                                                }`}
                                            >
                                                {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                            </div>
                                        </div>

                                        <p className="text-[11px] leading-relaxed text-stone-600 dark:text-zinc-400">
                                            {card.shortDesc}
                                        </p>
                                    </button>
                                )
                            })}
                        </div>
                    </section>

                    {/* BƯỚC 2: THÔNG TIN CHUNG & ĐỊNH MỨC HAO HỤT / NẠP NHANH TỪ BOM */}
                    <section className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-sm space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <h3 className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-zinc-200 flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[11px] inline-flex items-center justify-center">
                                    2
                                </span>
                                Thông tin Chung, Nhân sự & Định mức Kiểm soát Hao hụt
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5">
                            {/* Mã kế hoạch */}
                            <div className="lg:col-span-3 space-y-1">
                                <label className="text-[11px] font-bold text-stone-600 dark:text-zinc-300">
                                    Mã Kế hoạch <span className="text-rose-500">*</span>
                                </label>
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="text"
                                        value={code}
                                        onChange={e => setCode(e.target.value.toUpperCase())}
                                        placeholder="KHSX-..."
                                        className="w-full min-w-0 px-3 py-2 text-xs font-mono font-bold rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-900 dark:text-zinc-100 focus:outline-none focus:border-orange-500"
                                    />
                                    {!isEdit && (
                                        <button
                                            type="button"
                                            onClick={() => handleRegenerateCode(activeSystemCode)}
                                            disabled={generatingCode}
                                            className="p-2 rounded-xl bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 text-stone-600 dark:text-zinc-300 transition-colors shrink-0"
                                            title="Sinh lại mã kế hoạch tự động"
                                        >
                                            <RefreshCw size={14} className={generatingCode ? 'animate-spin' : ''} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Tên kế hoạch */}
                            <div className="lg:col-span-6 space-y-1">
                                <label className="text-[11px] font-bold text-stone-600 dark:text-zinc-300">
                                    Tên / Nội dung Kế hoạch Sản xuất <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="VD: Đóng khay Sầu riêng Ri6 500g xuất cont 02 / Lựa hạ cấp lô hàng tháng 10..."
                                    className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-900 dark:text-zinc-100 focus:outline-none focus:border-orange-500"
                                />
                            </div>

                            {/* Độ ưu tiên */}
                            <div className="lg:col-span-3 space-y-1">
                                <label className="text-[11px] font-bold text-stone-600 dark:text-zinc-300">
                                    Mức độ Ưu tiên
                                </label>
                                <select
                                    value={priority}
                                    onChange={e => setPriority(e.target.value as PlanPriority)}
                                    className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-800 dark:text-zinc-100 focus:outline-none focus:border-orange-500"
                                >
                                    {(Object.keys(PLAN_PRIORITY_CONFIG) as PlanPriority[]).map(pKey => (
                                        <option key={pKey} value={pKey}>
                                            {PLAN_PRIORITY_CONFIG[pKey].label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Chuyền / Khu vực */}
                            <div className="lg:col-span-3 space-y-1">
                                <label className="text-[11px] font-bold text-stone-600 dark:text-zinc-300">
                                    Chuyền / Khu vực thực hiện
                                </label>
                                <input
                                    type="text"
                                    value={workAreaName}
                                    onChange={e => setWorkAreaName(e.target.value)}
                                    placeholder="VD: Chuyền đóng khay 01, Phòng lạnh 2..."
                                    className="w-full px-3 py-2 text-xs font-medium rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-800 dark:text-zinc-100 focus:outline-none focus:border-orange-500"
                                />
                            </div>

                            {/* Người / Tổ yêu cầu */}
                            <div className="lg:col-span-3 space-y-1">
                                <label className="text-[11px] font-bold text-stone-600 dark:text-zinc-300">
                                    Người / Tổ SX yêu cầu
                                </label>
                                <input
                                    type="text"
                                    value={requestedByName}
                                    onChange={e => setRequestedByName(e.target.value)}
                                    placeholder="VD: Quản đốc Hùng / Tổ chế biến..."
                                    className="w-full px-3 py-2 text-xs font-medium rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-800 dark:text-zinc-100 focus:outline-none focus:border-orange-500"
                                />
                            </div>

                            {/* Dự kiến bắt đầu */}
                            <div className="lg:col-span-3 space-y-1">
                                <label className="text-[11px] font-bold text-stone-600 dark:text-zinc-300 flex items-center gap-1">
                                    <Calendar size={12} className="text-stone-400" /> Dự kiến bắt đầu
                                </label>
                                <input
                                    type="datetime-local"
                                    value={plannedStartAt}
                                    onChange={e => setPlannedStartAt(e.target.value)}
                                    className="w-full px-3 py-2 text-xs font-medium rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-800 dark:text-zinc-100 focus:outline-none focus:border-orange-500"
                                />
                            </div>

                            {/* Dự kiến hoàn thành */}
                            <div className="lg:col-span-3 space-y-1">
                                <label className="text-[11px] font-bold text-stone-600 dark:text-zinc-300 flex items-center gap-1">
                                    <Calendar size={12} className="text-stone-400" /> Dự kiến kết thúc
                                </label>
                                <input
                                    type="datetime-local"
                                    value={plannedEndAt}
                                    onChange={e => setPlannedEndAt(e.target.value)}
                                    className="w-full px-3 py-2 text-xs font-medium rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-800 dark:text-zinc-100 focus:outline-none focus:border-orange-500"
                                />
                            </div>

                            {/* Số nhân sự */}
                            <div className="lg:col-span-2 space-y-1">
                                <label className="text-[11px] font-bold text-stone-600 dark:text-zinc-300 flex items-center gap-1">
                                    <Users size={12} className="text-stone-400" /> Nhân sự (người)
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    value={workerCount}
                                    onChange={e => setWorkerCount(e.target.value)}
                                    placeholder="VD: 15"
                                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-800 dark:text-zinc-100 focus:outline-none focus:border-orange-500"
                                />
                            </div>

                            {/* Định mức hao hụt cho phép % */}
                            <div className="lg:col-span-2 space-y-1">
                                <label className="text-[11px] font-bold text-orange-700 dark:text-orange-300 flex items-center gap-1">
                                    <Percent size={12} /> Trần hao hụt (%)
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step="0.1"
                                    value={allowedLossPercent}
                                    onChange={e => setAllowedLossPercent(parseFloat(e.target.value) || 0)}
                                    className="w-full px-3 py-2 text-xs font-black rounded-xl bg-orange-50/70 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-200 focus:outline-none focus:border-orange-500"
                                />
                            </div>

                            {/* Tỷ lệ thu hồi kỳ vọng % */}
                            <div className="lg:col-span-2 space-y-1">
                                <label className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                                    <Percent size={12} /> Thu hồi kỳ vọng (%)
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step="0.1"
                                    value={expectedYieldPercent}
                                    onChange={e => setExpectedYieldPercent(e.target.value)}
                                    placeholder="VD: 92"
                                    className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200 focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            {/* Liên kết Lệnh SX */}
                            <div className="lg:col-span-3 space-y-1">
                                <label className="text-[11px] font-bold text-stone-600 dark:text-zinc-300">
                                    Liên kết Lệnh SX (Tùy chọn)
                                </label>
                                <select
                                    value={productionId}
                                    onChange={e => setProductionId(e.target.value)}
                                    className="w-full px-3 py-2 text-xs font-medium rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-800 dark:text-zinc-100 focus:outline-none focus:border-orange-500"
                                >
                                    <option value="">-- Không gắn Lệnh SX --</option>
                                    {productions.map(mo => (
                                        <option key={mo.id} value={mo.id}>
                                            [{mo.code}] {mo.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Khách hàng / Đơn hàng */}
                            <div className="lg:col-span-3 space-y-1">
                                <label className="text-[11px] font-bold text-stone-600 dark:text-zinc-300">
                                    Khách hàng / Đơn đích (Tùy chọn)
                                </label>
                                <select
                                    value={customerId}
                                    onChange={e => setCustomerId(e.target.value)}
                                    className="w-full px-3 py-2 text-xs font-medium rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-800 dark:text-zinc-100 focus:outline-none focus:border-orange-500"
                                >
                                    <option value="">-- Sản xuất dự trữ nội bộ --</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.code ? `[${c.code}] ` : ''}
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* THANH NẠP NHANH TỪ ĐỊNH MỨC BOM */}
                        <div className="pt-2 border-t border-stone-100 dark:border-zinc-800">
                            <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-stone-50 dark:from-emerald-950/25 dark:via-zinc-900 dark:to-zinc-900 border border-emerald-200/70 dark:border-emerald-900/40 flex flex-col lg:flex-row lg:items-center gap-3">
                                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 shrink-0">
                                    <Sparkles size={16} className="text-emerald-600 dark:text-emerald-400" />
                                    <span>Nạp nhanh Công thức BOM:</span>
                                </div>

                                <select
                                    value={bomId}
                                    onChange={e => {
                                        const val = e.target.value
                                        setBomId(val)
                                        const found = boms.find(b => b.id === val)
                                        if (found && Number(found.quantity) > 0) {
                                            setBomTargetQty(Number(found.quantity))
                                        }
                                    }}
                                    className="flex-1 min-w-0 px-3 py-2 text-xs font-medium rounded-xl bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800/60 text-stone-800 dark:text-zinc-100 focus:outline-none focus:border-emerald-500"
                                >
                                    <option value="">-- Chọn Định mức Vật tư (BOM) để tự động tính nguyên liệu --</option>
                                    {boms.map(b => (
                                        <option key={b.id} value={b.id}>
                                            {b.code ? `[${b.code}] ` : ''}
                                            {b.name} (Gốc: {b.quantity} {b.products?.unit || 'đvt'}{' '}
                                            {b.products?.name ? `• ${b.products.name}` : ''})
                                        </option>
                                    ))}
                                </select>

                                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
                                    <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 px-2.5 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
                                        <span className="text-[11px] font-semibold text-stone-500 dark:text-zinc-400 whitespace-nowrap">
                                            SL Mục tiêu:
                                        </span>
                                        <input
                                            type="number"
                                            min={0.01}
                                            step="any"
                                            value={bomTargetQty}
                                            onChange={e => setBomTargetQty(parseFloat(e.target.value) || 0)}
                                            className="w-20 text-xs font-black text-emerald-700 dark:text-emerald-300 bg-transparent focus:outline-none text-right"
                                        />
                                        <span className="text-[11px] font-bold text-stone-500">
                                            {boms.find(b => b.id === bomId)?.products?.unit || 'ĐVT'}
                                        </span>
                                    </div>

                                    <button
                                        type="button"
                                        disabled={!bomId || loadingBom}
                                        onClick={handleApplyBom}
                                        className="px-3.5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                                    >
                                        {loadingBom ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                            <FileSpreadsheet size={14} />
                                        )}
                                        Nạp nhanh từ BOM
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* BƯỚC 3: BẢNG NGUYÊN LIỆU ĐẦU VÀO CẦN LẤY TỪ TỒN KHO */}
                    <section className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-blue-200/80 dark:border-blue-900/40 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <h3 className="text-xs font-black uppercase tracking-wider text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] inline-flex items-center justify-center">
                                        3
                                    </span>
                                    Nguyên liệu Đầu vào cần lấy từ Tồn Kho ({inputRows.length} dòng)
                                </h3>
                                <p className="text-[11px] text-stone-500 dark:text-zinc-400 mt-0.5">
                                    Hỗ trợ gõ tắt <span className="font-bold text-orange-600">⚡ aliases</span>, mã SKU, tự động quy đổi hệ số{' '}
                                    <span className="font-bold">Kg/ĐVT</span> (VD: Tấn = 1,000 Kg; Thùng 10kg = 10 Kg) hoặc chỉnh tay linh hoạt
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setInputRows(prev => [...prev, createEmptyInputRow(planMode === 'OUTPUT_DRIVEN')])
                                }
                                className="self-start sm:self-auto px-3.5 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                                <Plus size={14} /> Thêm Nguyên liệu Đầu vào
                            </button>
                        </div>

                        <div className="space-y-3">
                            {inputRows.map((row, idx) => {
                                const rowKg =
                                    (Number(row.required_quantity) || 0) * (Number(row.weight_per_unit_kg) || 1)
                                const isLocked = row.allocated_quantity > 0 || row.issued_quantity > 0

                                return (
                                    <div
                                        key={row.key}
                                        className="p-3.5 rounded-2xl bg-stone-50/90 dark:bg-zinc-800/50 border border-stone-200 dark:border-zinc-700/80 space-y-3"
                                    >
                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
                                            {/* Sản phẩm đầu vào */}
                                            <div className="lg:col-span-4 space-y-1 min-w-0">
                                                <label className="text-[10px] font-black uppercase tracking-wider text-stone-500 dark:text-zinc-400 flex items-center justify-between">
                                                    <span>#{idx + 1}. Mặt hàng Tồn kho cần lấy *</span>
                                                    {isLocked && (
                                                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                                                            Đã soạn {row.allocated_quantity.toLocaleString('vi-VN')} {row.unit}
                                                        </span>
                                                    )}
                                                </label>
                                                <PlanProductAutocomplete
                                                    products={mergedProducts}
                                                    selectedProductId={row.product_id}
                                                    disabled={isLocked}
                                                    onSelect={prod => handleSelectInputProduct(row.key, prod)}
                                                    placeholder="Gõ tên viết tắt (VD: Ri A), SKU..."
                                                />
                                            </div>

                                            {/* Đơn vị tính */}
                                            <div className="lg:col-span-2 space-y-1 min-w-0">
                                                <label className="text-[10px] font-black uppercase tracking-wider text-stone-500 dark:text-zinc-400">
                                                    Đơn vị tính *
                                                </label>
                                                <input
                                                    type="text"
                                                    list="production-plan-units-list"
                                                    value={row.unit}
                                                    onChange={e => handleChangeInputUnit(row.key, e.target.value)}
                                                    placeholder="Kg, Tấn, Thùng..."
                                                    className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-stone-800 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                                                />
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    {['Kg', 'Tấn', 'Thùng'].map(quickU => (
                                                        <button
                                                            key={quickU}
                                                            type="button"
                                                            onClick={() => handleChangeInputUnit(row.key, quickU)}
                                                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                                                                row.unit.toLowerCase() === quickU.toLowerCase()
                                                                    ? 'bg-blue-600 text-white'
                                                                    : 'bg-stone-200/70 dark:bg-zinc-700 text-stone-600 dark:text-zinc-300 hover:bg-stone-300'
                                                            }`}
                                                        >
                                                            {quickU}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Hệ số Kg / ĐVT */}
                                            <div className="lg:col-span-2 space-y-1 min-w-0">
                                                <label className="text-[10px] font-black uppercase tracking-wider text-stone-500 dark:text-zinc-400">
                                                    Hệ số Kg / 1 ĐVT
                                                </label>
                                                <input
                                                    type="number"
                                                    min={0.001}
                                                    step="any"
                                                    value={row.weight_per_unit_kg}
                                                    onChange={e =>
                                                        updateInputRow(row.key, r => ({
                                                            ...r,
                                                            weight_per_unit_kg: parseFloat(e.target.value) || 0
                                                        }))
                                                    }
                                                    className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-stone-800 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                                                />
                                                <span className="block text-[10px] text-stone-400">
                                                    1 {row.unit || 'ĐVT'} = {Number(row.weight_per_unit_kg || 0).toLocaleString('vi-VN')} Kg
                                                </span>
                                            </div>

                                            {/* Số lượng yêu cầu + Quy đổi Kg */}
                                            <div className="lg:col-span-2 space-y-1 min-w-0">
                                                <label className="text-[10px] font-black uppercase tracking-wider text-stone-500 dark:text-zinc-400">
                                                    {row.is_open_quantity ? 'SL Dự kiến (Tùy chọn)' : 'SL Yêu cầu *'}
                                                </label>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    step="any"
                                                    value={row.required_quantity || ''}
                                                    placeholder={row.is_open_quantity ? 'Không giới hạn' : '0'}
                                                    onChange={e =>
                                                        updateInputRow(row.key, r => ({
                                                            ...r,
                                                            required_quantity: parseFloat(e.target.value) || 0
                                                        }))
                                                    }
                                                    className="w-full px-3 py-2 text-xs font-black rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-blue-700 dark:text-blue-300 focus:outline-none focus:border-blue-500"
                                                />
                                                <div className="text-[10px] font-black text-blue-600 dark:text-blue-400">
                                                    {rowKg > 0
                                                        ? `= ${rowKg.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} Kg`
                                                        : row.is_open_quantity
                                                        ? '⚡ Rút mở theo thực tế'
                                                        : '= 0 Kg'}
                                                </div>
                                            </div>

                                            {/* Đơn giá vốn tham chiếu + Xóa */}
                                            <div className="lg:col-span-2 space-y-1 min-w-0">
                                                <label className="text-[10px] font-black uppercase tracking-wider text-stone-500 dark:text-zinc-400">
                                                    Giá vốn / ĐVT (VNĐ)
                                                </label>
                                                <div className="flex items-center gap-1.5">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        step="any"
                                                        value={row.unit_cost || ''}
                                                        placeholder="0"
                                                        onChange={e =>
                                                            updateInputRow(row.key, r => ({
                                                                ...r,
                                                                unit_cost: parseFloat(e.target.value) || 0
                                                            }))
                                                        }
                                                        className="w-full min-w-0 px-2.5 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-stone-800 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveInputRow(row)}
                                                        className="p-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0 cursor-pointer"
                                                        title="Xóa dòng nguyên liệu"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Hàng phụ: Checkbox Xuất mở theo thực tế chạy + Ghi chú */}
                                        <div className="pt-2 border-t border-stone-200/70 dark:border-zinc-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={row.is_open_quantity}
                                                    onChange={e =>
                                                        updateInputRow(row.key, r => ({
                                                            ...r,
                                                            is_open_quantity: e.target.checked
                                                        }))
                                                    }
                                                    className="w-4 h-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                                                />
                                                <span className="text-xs font-bold text-stone-700 dark:text-zinc-300">
                                                    Xuất theo thực tế chạy / Không giới hạn cứng ban đầu
                                                </span>
                                            </label>

                                            <input
                                                type="text"
                                                value={row.notes}
                                                onChange={e =>
                                                    updateInputRow(row.key, r => ({ ...r, notes: e.target.value }))
                                                }
                                                placeholder="Ghi chú riêng cho nguyên liệu này (VD: Ưu tiên xuất FIFO pallet kho Lạnh 1)..."
                                                className="w-full sm:max-w-md px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-zinc-200 placeholder:text-stone-400 focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </section>

                    {/* BƯỚC 4: BẢNG THÀNH PHẨM MỤC TIÊU & PHỤ PHẨM ĐẦU RA */}
                    <section className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/40 shadow-sm space-y-4">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                            <div>
                                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] inline-flex items-center justify-center">
                                        4
                                    </span>
                                    Thành phẩm Mục tiêu, Phụ phẩm Thu hồi & Phế phẩm Đầu ra ({outputRows.length} dòng)
                                </h3>
                                <p className="text-[11px] text-stone-500 dark:text-zinc-400 mt-0.5">
                                    Chọn sản phẩm trong danh mục hoặc gõ tên tự do cho phụ phẩm rớt cấp (VD: Hàng rớt cấp C) / vỏ hạt phế phẩm
                                </p>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => setOutputRows(prev => [...prev, createEmptyOutputRow('PRIMARY')])}
                                    className="px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                    <Plus size={13} /> Thành phẩm chính
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setOutputRows(prev => [...prev, createEmptyOutputRow('BYPRODUCT')])}
                                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                    <Plus size={13} /> Phụ phẩm thu hồi
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setOutputRows(prev => [...prev, createEmptyOutputRow('SCRAP')])}
                                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 text-stone-700 dark:text-zinc-300 border border-stone-200 dark:border-zinc-700 flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                    <Plus size={13} /> Phế phẩm
                                </button>
                            </div>
                        </div>

                        {outputRows.length === 0 ? (
                            <div className="p-5 rounded-2xl border border-dashed border-stone-300 dark:border-zinc-700 text-center text-xs text-stone-500 dark:text-zinc-400">
                                Chưa khai báo dòng đầu ra dự kiến. Bạn vẫn có thể ghi nhận trực tiếp thành phẩm/phụ phẩm phát sinh trong quá trình chạy thực tế, hoặc bấm các nút phía trên để đặt chỉ tiêu.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {outputRows.map(row => {
                                    const outKg =
                                        (Number(row.target_quantity) || 0) * (Number(row.weight_per_unit_kg) || 1)
                                    const typeStyle =
                                        row.output_type === 'PRIMARY'
                                            ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50'
                                            : row.output_type === 'BYPRODUCT'
                                            ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/50'
                                            : 'bg-stone-50 dark:bg-zinc-800/50 border-stone-200 dark:border-zinc-700'

                                    return (
                                        <div
                                            key={row.key}
                                            className={`p-3.5 rounded-2xl border space-y-2.5 ${typeStyle}`}
                                        >
                                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
                                                {/* Phân loại đầu ra */}
                                                <div className="lg:col-span-2 space-y-1 min-w-0">
                                                    <label className="text-[10px] font-black uppercase tracking-wider text-stone-500 dark:text-zinc-400">
                                                        Phân loại Đầu ra
                                                    </label>
                                                    <select
                                                        value={row.output_type}
                                                        onChange={e =>
                                                            updateOutputRow(row.key, r => ({
                                                                ...r,
                                                                output_type: e.target.value as OutputType,
                                                                cost_allocation_ratio:
                                                                    e.target.value === 'PRIMARY'
                                                                        ? 100
                                                                        : e.target.value === 'BYPRODUCT'
                                                                        ? 15
                                                                        : 0
                                                            }))
                                                        }
                                                        className="w-full px-2.5 py-2 text-xs font-black rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-stone-800 dark:text-zinc-100 focus:outline-none focus:border-emerald-500"
                                                    >
                                                        <option value="PRIMARY">🎯 Thành phẩm chính</option>
                                                        <option value="BYPRODUCT">♻️ Phụ phẩm thu hồi</option>
                                                        <option value="SCRAP">🗑️ Phế phẩm (Vỏ/Hạt)</option>
                                                    </select>
                                                </div>

                                                {/* Tên thành phẩm / phụ phẩm (hỗ trợ cả danh mục & gõ tự do) */}
                                                <div className="lg:col-span-4 space-y-1 min-w-0">
                                                    <label className="text-[10px] font-black uppercase tracking-wider text-stone-500 dark:text-zinc-400">
                                                        Sản phẩm hoặc Tên tự nhập *
                                                    </label>
                                                    <PlanProductAutocomplete
                                                        products={mergedProducts}
                                                        selectedProductId={row.product_id}
                                                        allowCustomFreeText={true}
                                                        customTextValue={row.item_name}
                                                        onCustomTextChange={txt =>
                                                            updateOutputRow(row.key, r => ({ ...r, item_name: txt }))
                                                        }
                                                        onSelect={prod => handleSelectOutputProduct(row.key, prod)}
                                                        placeholder="Chọn SP hoặc gõ tự do (VD: Sầu riêng khay 500g / Hàng rớt C)..."
                                                    />
                                                </div>

                                                {/* SL Mục tiêu */}
                                                <div className="lg:col-span-2 space-y-1 min-w-0">
                                                    <label className="text-[10px] font-black uppercase tracking-wider text-stone-500 dark:text-zinc-400">
                                                        {row.output_type === 'PRIMARY' ? 'SL Mục tiêu *' : 'SL Dự kiến'}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        step="any"
                                                        value={row.target_quantity || ''}
                                                        placeholder="VD: 500"
                                                        onChange={e =>
                                                            updateOutputRow(row.key, r => ({
                                                                ...r,
                                                                target_quantity: parseFloat(e.target.value) || 0
                                                            }))
                                                        }
                                                        className="w-full px-3 py-2 text-xs font-black rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-emerald-700 dark:text-emerald-300 focus:outline-none focus:border-emerald-500"
                                                    />
                                                    <span className="block text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                                                        {outKg > 0
                                                            ? `= ${outKg.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} Kg`
                                                            : 'Thu theo thực tế'}
                                                    </span>
                                                </div>

                                                {/* Đơn vị & Hệ số Kg/ĐVT */}
                                                <div className="lg:col-span-2 space-y-1 min-w-0">
                                                    <label className="text-[10px] font-black uppercase tracking-wider text-stone-500 dark:text-zinc-400">
                                                        ĐVT & Kg/ĐVT
                                                    </label>
                                                    <div className="grid grid-cols-2 gap-1.5">
                                                        <input
                                                            type="text"
                                                            list="production-plan-units-list"
                                                            value={row.unit}
                                                            onChange={e =>
                                                                handleChangeOutputUnit(row.key, e.target.value)
                                                            }
                                                            placeholder="Thùng"
                                                            className="w-full min-w-0 px-2 py-2 text-xs font-bold rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-stone-800 dark:text-zinc-100 focus:outline-none focus:border-emerald-500"
                                                        />
                                                        <input
                                                            type="number"
                                                            min={0.001}
                                                            step="any"
                                                            value={row.weight_per_unit_kg}
                                                            onChange={e =>
                                                                updateOutputRow(row.key, r => ({
                                                                    ...r,
                                                                    weight_per_unit_kg:
                                                                        parseFloat(e.target.value) || 0
                                                                }))
                                                            }
                                                            title="Số Kg trên 1 đơn vị"
                                                            className="w-full min-w-0 px-2 py-2 text-xs font-bold rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-stone-800 dark:text-zinc-100 focus:outline-none focus:border-emerald-500"
                                                        />
                                                    </div>
                                                    <span className="block text-[10px] text-stone-400">
                                                        {row.weight_per_unit_kg} Kg / {row.unit || 'ĐVT'}
                                                    </span>
                                                </div>

                                                {/* Mã LOT thành phẩm dự kiến + Xóa */}
                                                <div className="lg:col-span-2 space-y-1 min-w-0">
                                                    <label className="text-[10px] font-black uppercase tracking-wider text-stone-500 dark:text-zinc-400">
                                                        Mã LOT SX Dự kiến
                                                    </label>
                                                    <div className="flex items-center gap-1.5">
                                                        <input
                                                            type="text"
                                                            value={row.target_lot_code}
                                                            onChange={e =>
                                                                updateOutputRow(row.key, r => ({
                                                                    ...r,
                                                                    target_lot_code: e.target.value.toUpperCase()
                                                                }))
                                                            }
                                                            placeholder="VD: L015DD260"
                                                            className="w-full min-w-0 px-2.5 py-2 text-xs font-mono font-bold rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-stone-800 dark:text-zinc-100 focus:outline-none focus:border-emerald-500"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveOutputRow(row)}
                                                            className="p-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0 cursor-pointer"
                                                            title="Xóa dòng đầu ra"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </section>

                    {/* GHI CHÚ ĐIỀU HÀNH */}
                    <section className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-sm space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-wider text-stone-600 dark:text-zinc-300 flex items-center gap-1.5">
                            <Info size={14} className="text-stone-400" /> Ghi chú Chỉ đạo Sản xuất & Kho Soạn Hàng
                        </label>
                        <textarea
                            rows={2}
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="VD: Yêu cầu kho hạ nhiệt sảnh soạn trước 6h30 sáng, cuối ca cân kiểm phần hàng rớt cấp C nhập trả lại kho..."
                            className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-800 dark:text-zinc-100 focus:outline-none focus:border-orange-500 resize-none"
                        />
                    </section>
                </div>

                {/* FOOTER SUMMARY & ACTION BUTTONS */}
                <div className="shrink-0 px-5 sm:px-7 py-4 bg-white dark:bg-zinc-900 border-t border-stone-200 dark:border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-wrap text-xs">
                        <span className="px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold border border-blue-200/70 dark:border-blue-800">
                            Đầu vào: {previewSummary.validInputCount} mặt hàng •{' '}
                            {previewSummary.totalInputKg > 0
                                ? `${previewSummary.totalInputKg.toLocaleString('vi-VN')} Kg`
                                : previewSummary.openInputCount > 0
                                ? 'Xuất mở theo thực tế'
                                : '0 Kg'}
                        </span>
                        <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200/70 dark:border-emerald-800">
                            Mục tiêu TP chính: {previewSummary.primaryOutputKg.toLocaleString('vi-VN')} Kg
                        </span>
                        <span className="px-2.5 py-1 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 font-bold border border-orange-200/70 dark:border-orange-800">
                            Trần hao hụt: {allowedLossPercent}%
                        </span>
                        {previewSummary.totalEstimatedCost > 0 && (
                            <span className="text-[11px] font-semibold text-stone-500 dark:text-zinc-400">
                                Vốn NL ước tính: {previewSummary.totalEstimatedCost.toLocaleString('vi-VN')} đ
                            </span>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 text-stone-700 dark:text-zinc-200 transition-colors cursor-pointer"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-lg shadow-orange-500/25 flex items-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
                        >
                            {saving ? (
                                <>
                                    <Loader2 size={15} className="animate-spin" /> Đang lưu kế hoạch...
                                </>
                            ) : isEdit ? (
                                <>
                                    <CheckCircle2 size={15} /> Lưu Cập nhật Kế hoạch
                                </>
                            ) : (
                                <>
                                    <Save size={15} /> Khởi tạo Kế hoạch SX
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
