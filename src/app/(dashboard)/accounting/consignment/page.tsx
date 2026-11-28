'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
    Building2,
    Package,
    ArrowDownToLine,
    ArrowUpFromLine,
    Plus,
    FileSpreadsheet,
    RefreshCw,
    Edit2,
    Trash2,
    CheckCircle2,
    ArrowRightLeft,
    Eye,
    X,
    Link2,
    MapPin,
    Phone,
    User,
    Loader2,
    Printer
} from 'lucide-react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { useToast } from '@/components/ui/ToastProvider'
import { useUnitConversion } from '@/hooks/useUnitConversion'
import { usePrintCompanyInfo } from '@/hooks/usePrintCompanyInfo'
import { exportConsignmentReportToExcel } from '@/lib/consignmentExcelExport'
import { formatQuantityFull } from '@/lib/numberUtils'
import { matchSearch } from '@/lib/searchUtils'
import { ProductSearchInput } from '@/components/shared/ProductSearchInput'
import {
    ConsignmentInventoryRow,
    ConsignmentOrder,
    ConsignmentWarehouse,
    OUTBOUND_PURPOSE_LABELS
} from '@/components/accounting/consignment/types'
import ConsignmentOrderModal from '@/components/accounting/consignment/ConsignmentOrderModal'
import ConsignmentWarehouseModal from '@/components/accounting/consignment/ConsignmentWarehouseModal'
import ImportFromOutboundModal from '@/components/accounting/consignment/ImportFromOutboundModal'
import TransferToInboundModal from '@/components/accounting/consignment/TransferToInboundModal'

type ActiveTab = 'inventory' | 'inbound' | 'outbound' | 'warehouses'

export default function ConsignmentPage() {
    const { systemType, hasModule } = useSystem()
    const { profile } = useUser()
    const { companyInfo } = usePrintCompanyInfo({ orderCompanyId: profile?.company_id })
    const { showToast, showConfirm } = useToast()
    const { convertUnit } = useUnitConversion()

    const [activeTab, setActiveTab] = useState<ActiveTab>('inventory')
    const [loading, setLoading] = useState(true)

    const [warehouses, setWarehouses] = useState<ConsignmentWarehouse[]>([])
    const [orders, setOrders] = useState<ConsignmentOrder[]>([])
    const [products, setProducts] = useState<any[]>([])
    const [units, setUnits] = useState<any[]>([])

    // Filters
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('ALL')
    const [searchQuery, setSearchQuery] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [targetUnitName, setTargetUnitName] = useState<string>('')
    const [onlyInStock, setOnlyInStock] = useState(false)

    // Modals
    const [orderModal, setOrderModal] = useState<{ open: boolean; direction: 'INBOUND' | 'OUTBOUND'; editOrder: ConsignmentOrder | null }>({
        open: false,
        direction: 'INBOUND',
        editOrder: null
    })
    const [warehouseModal, setWarehouseModal] = useState<{ open: boolean; editWarehouse: ConsignmentWarehouse | null }>({
        open: false,
        editWarehouse: null
    })
    const [importOutboundOpen, setImportOutboundOpen] = useState(false)
    const [transferInboundOrder, setTransferInboundOrder] = useState<ConsignmentOrder | null>(null)
    const [detailOrder, setDetailOrder] = useState<ConsignmentOrder | null>(null)

    const fetchAll = useCallback(async () => {
        if (!systemType) return
        setLoading(true)
        try {
            const [whRes, ordRes, prodRes, unitRes] = await Promise.all([
                (supabase.from('consignment_warehouses') as any)
                    .select('*')
                    .eq('system_code', systemType)
                    .order('is_active', { ascending: false })
                    .order('name'),
                (supabase.from('consignment_orders') as any)
                    .select('*, consignment_warehouses(id, code, name), items:consignment_order_items(*, products(id, sku, name, unit, internal_code, internal_name, aliases))')
                    .eq('system_code', systemType)
                    .order('order_date', { ascending: false })
                    .limit(1000),
                supabase
                    .from('products')
                    .select('id, sku, name, unit, weight_kg, category_id, internal_code, internal_name, aliases, categories(name), product_units(unit_id, conversion_rate)')
                    .eq('system_type', systemType)
                    .order('name'),
                (supabase.from('units') as any)
                    .select('*')
                    .eq('system_code', systemType)
                    .eq('is_active', true)
                    .order('name')
            ])

            if (whRes.data) setWarehouses(whRes.data)
            if (ordRes.data) setOrders(ordRes.data)
            if (prodRes.data) setProducts(prodRes.data)
            if (unitRes.data) setUnits(unitRes.data)
        } catch (err: any) {
            showToast('Lỗi tải dữ liệu ký gửi: ' + (err.message || 'Không xác định'), 'error')
        } finally {
            setLoading(false)
        }
    }, [systemType, showToast])

    useEffect(() => {
        if (hasModule('consignment_manager') && systemType) {
            fetchAll()
        }
    }, [systemType, hasModule, fetchAll])

    // Tính Nhập - Xuất - Tồn Kho ký gửi (chỉ tính trên phiếu Completed)
    const inventoryRows = useMemo<ConsignmentInventoryRow[]>(() => {
        const startTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null
        const endTs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null

        const map = new Map<string, ConsignmentInventoryRow>()

        for (const order of orders) {
            if (order.status !== 'Completed') continue
            if (selectedWarehouseId !== 'ALL' && order.consignment_warehouse_id !== selectedWarehouseId) continue

            const orderTs = new Date(order.order_date).getTime()
            if (endTs !== null && orderTs > endTs) continue

            const isBeforePeriod = startTs !== null && orderTs < startTs
            const whName = order.consignment_warehouses?.name || 'Kho ký gửi'

            for (const item of order.items || []) {
                const rawQty = Number(item.quantity) || 0
                if (rawQty === 0) continue

                const baseUnit = item.products?.unit || item.unit
                let displayUnit = item.unit
                let qty = rawQty

                if (targetUnitName && item.product_id) {
                    const converted = convertUnit(item.product_id, item.unit, targetUnitName, rawQty, baseUnit)
                    if (Number.isFinite(converted) && converted > 0) {
                        qty = converted
                        displayUnit = targetUnitName
                    }
                }

                const key = `${order.consignment_warehouse_id}::${item.product_id || item.product_name}::${displayUnit}`
                let row = map.get(key)
                if (!row) {
                    row = {
                        key,
                        warehouseId: order.consignment_warehouse_id,
                        warehouseName: whName,
                        productId: item.product_id,
                        sku: item.sku || item.products?.sku || '',
                        productName: item.product_name || item.products?.name || 'Hàng hóa',
                        internalCode: item.products?.internal_code || null,
                        internalName: item.products?.internal_name || null,
                        aliases: item.products?.aliases || null,
                        unit: displayUnit,
                        opening: 0,
                        qtyIn: 0,
                        qtyOutReturn: 0,
                        qtyOutDirect: 0,
                        qtyOutTotal: 0,
                        balance: 0
                    }
                    map.set(key, row)
                }

                if (isBeforePeriod) {
                    if (order.direction === 'INBOUND') row.opening += qty
                    else row.opening -= qty
                } else {
                    if (order.direction === 'INBOUND') {
                        row.qtyIn += qty
                    } else {
                        row.qtyOutTotal += qty
                        if (order.outbound_purpose === 'RETURN_TO_MAIN') {
                            row.qtyOutReturn += qty
                        } else {
                            row.qtyOutDirect += qty
                        }
                    }
                }
            }
        }

        const list = Array.from(map.values()).map(r => ({
            ...r,
            opening: Number(r.opening.toFixed(4)),
            qtyIn: Number(r.qtyIn.toFixed(4)),
            qtyOutReturn: Number(r.qtyOutReturn.toFixed(4)),
            qtyOutDirect: Number(r.qtyOutDirect.toFixed(4)),
            qtyOutTotal: Number(r.qtyOutTotal.toFixed(4)),
            balance: Number((r.opening + r.qtyIn - r.qtyOutTotal).toFixed(4))
        }))

        return list.sort((a, b) => a.warehouseName.localeCompare(b.warehouseName) || a.productName.localeCompare(b.productName))
    }, [orders, selectedWarehouseId, dateFrom, dateTo, targetUnitName, convertUnit])

    // Toàn bộ tồn kho không lọc ngày/kho (truyền cho modal xuất ký gửi để kiểm tra tồn hiện tại)
    const allCurrentStockRows = useMemo<ConsignmentInventoryRow[]>(() => {
        const map = new Map<string, ConsignmentInventoryRow>()
        for (const order of orders) {
            if (order.status !== 'Completed') continue
            const whName = order.consignment_warehouses?.name || 'Kho ký gửi'
            for (const item of order.items || []) {
                const qty = Number(item.quantity) || 0
                const key = `${order.consignment_warehouse_id}::${item.product_id || item.product_name}::${item.unit}`
                let row = map.get(key)
                if (!row) {
                    row = {
                        key,
                        warehouseId: order.consignment_warehouse_id,
                        warehouseName: whName,
                        productId: item.product_id,
                        sku: item.sku || item.products?.sku || '',
                        productName: item.product_name || item.products?.name || 'Hàng hóa',
                        internalCode: item.products?.internal_code || null,
                        internalName: item.products?.internal_name || null,
                        aliases: item.products?.aliases || null,
                        unit: item.unit,
                        opening: 0,
                        qtyIn: 0,
                        qtyOutReturn: 0,
                        qtyOutDirect: 0,
                        qtyOutTotal: 0,
                        balance: 0
                    }
                    map.set(key, row)
                }
                if (order.direction === 'INBOUND') row.balance += qty
                else row.balance -= qty
            }
        }
        return Array.from(map.values()).map(r => ({ ...r, balance: Number(r.balance.toFixed(4)) }))
    }, [orders])

    const filteredInventory = useMemo(() => {
        return inventoryRows.filter(row => {
            if (onlyInStock && row.balance <= 0) return false
            if (!searchQuery.trim()) return true
            return matchSearch(
                {
                    name: row.productName,
                    sku: row.sku,
                    internal_code: row.internalCode,
                    internal_name: row.internalName,
                    aliases: row.aliases,
                    description: row.warehouseName
                },
                searchQuery
            )
        })
    }, [inventoryRows, searchQuery, onlyInStock])

    const filterOrdersByDirection = (direction: 'INBOUND' | 'OUTBOUND') => {
        const startTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null
        const endTs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null

        return orders.filter(o => {
            if (o.direction !== direction) return false
            if (selectedWarehouseId !== 'ALL' && o.consignment_warehouse_id !== selectedWarehouseId) return false
            const ts = new Date(o.order_date).getTime()
            if (startTs !== null && ts < startTs) return false
            if (endTs !== null && ts > endTs) return false
            if (!searchQuery.trim()) return true
            const matchOrder = matchSearch(
                {
                    code: o.code,
                    name: o.consignment_warehouses?.name,
                    description: `${o.description || ''} ${o.partner_name || ''} ${o.source_outbound_order_code || ''} ${o.linked_inbound_order_code || ''}`
                },
                searchQuery
            )
            if (matchOrder) return true
            return (o.items || []).some(it =>
                matchSearch(
                    {
                        name: it.product_name,
                        sku: it.sku || it.products?.sku,
                        internal_code: it.products?.internal_code,
                        internal_name: it.products?.internal_name,
                        aliases: it.products?.aliases
                    },
                    searchQuery
                )
            )
        })
    }

    const inboundOrders = useMemo(() => filterOrdersByDirection('INBOUND'), [orders, selectedWarehouseId, dateFrom, dateTo, searchQuery])
    const outboundOrders = useMemo(() => filterOrdersByDirection('OUTBOUND'), [orders, selectedWarehouseId, dateFrom, dateTo, searchQuery])

    const summaryStats = useMemo(() => {
        const prodById = new Map<string, any>()
        products.forEach(p => prodById.set(p.id, p))

        let totalOpening = 0
        let totalIn = 0
        let totalOutReturn = 0
        let totalOutDirect = 0
        let totalOut = 0
        let totalBalance = 0
        let totalKg = 0
        let activeSkus = 0

        for (const r of filteredInventory) {
            totalOpening += r.opening
            totalIn += r.qtyIn
            totalOutReturn += r.qtyOutReturn
            totalOutDirect += r.qtyOutDirect
            totalOut += r.qtyOutTotal
            totalBalance += r.balance
            if (r.balance > 0) activeSkus++

            const prod = r.productId ? prodById.get(r.productId) : null
            const baseUnit = prod?.unit || r.unit
            if (r.productId && r.balance !== 0) {
                const conv = convertUnit(r.productId, r.unit, 'Kg', r.balance, baseUnit)
                if (Number.isFinite(conv)) totalKg += conv
            } else if (r.unit.toLowerCase() === 'kg') {
                totalKg += r.balance
            }
        }

        return { totalOpening, totalIn, totalOutReturn, totalOutDirect, totalOut, totalBalance, totalKg, activeSkus }
    }, [filteredInventory, products, convertUnit])

    const hasActiveFilters = Boolean(searchQuery.trim() || selectedWarehouseId !== 'ALL' || dateFrom || dateTo || targetUnitName || onlyInStock)

    function clearFilters() {
        setSearchQuery('')
        setSelectedWarehouseId('ALL')
        setDateFrom('')
        setDateTo('')
        setTargetUnitName('')
        setOnlyInStock(false)
    }

    async function handleApproveOrder(order: ConsignmentOrder) {
        const ok = await showConfirm(`Xác nhận hoàn thành phiếu ${order.code}? Số lượng sẽ được ghi nhận vào tồn kho ký gửi.`)
        if (!ok) return
        const { error } = await (supabase.from('consignment_orders') as any)
            .update({ status: 'Completed', updated_at: new Date().toISOString() })
            .eq('id', order.id)
        if (error) {
            showToast('Lỗi duyệt phiếu: ' + error.message, 'error')
        } else {
            showToast(`Đã hoàn thành phiếu ${order.code}`, 'success')
            fetchAll()
        }
    }

    async function handleDeleteOrder(order: ConsignmentOrder) {
        if (order.linked_inbound_order_id) {
            showToast(`Phiếu này đã liên kết với Phiếu nhập Kế toán ${order.linked_inbound_order_code}, không thể xóa trực tiếp.`, 'warning')
            return
        }
        const ok = await showConfirm(`Bạn có chắc muốn xóa phiếu ký gửi ${order.code}?`)
        if (!ok) return
        const { error } = await (supabase.from('consignment_orders') as any).delete().eq('id', order.id)
        if (error) {
            showToast('Lỗi xóa phiếu: ' + error.message, 'error')
        } else {
            showToast(`Đã xóa phiếu ${order.code}`, 'success')
            fetchAll()
        }
    }

    async function handleExportExcel() {
        const formatViDate = (d: string) => {
            const [y, m, day] = d.split('-')
            return `${day}/${m}/${y}`
        }

        const dateTitle =
            dateFrom && dateTo
                ? `Từ ngày ${formatViDate(dateFrom)} đến ngày ${formatViDate(dateTo)}`
                : dateFrom
                ? `Từ ngày ${formatViDate(dateFrom)} đến ngày ${format(new Date(), 'dd/MM/yyyy')}`
                : dateTo
                ? `Tính đến ngày ${formatViDate(dateTo)}`
                : `Tính đến ngày ${format(new Date(), 'dd/MM/yyyy')}`

        const selectedWh = warehouses.find(w => w.id === selectedWarehouseId)
        const warehouseLabel = selectedWh ? selectedWh.name : 'Tất cả kho ký gửi'

        const prodById = new Map<string, any>()
        products.forEach(p => prodById.set(p.id, p))

        const excelItems = filteredInventory.map(row => {
            const prod = row.productId ? prodById.get(row.productId) : null
            const baseUnit = prod?.unit || row.unit
            let kg = 0
            if (row.productId && row.balance !== 0) {
                const conv = convertUnit(row.productId, row.unit, 'Kg', row.balance, baseUnit)
                if (Number.isFinite(conv)) kg = conv
            } else if (row.unit.toLowerCase() === 'kg') {
                kg = row.balance
            }

            const catName = Array.isArray(prod?.categories)
                ? prod.categories[0]?.name
                : prod?.categories?.name

            return {
                warehouseName: row.warehouseName,
                categoryName: catName || 'Chưa phân loại',
                productName: row.productName,
                productCode: row.sku || '',
                unit: row.unit,
                opening: row.opening,
                qtyIn: row.qtyIn,
                qtyOut: row.qtyOutTotal,
                balance: row.balance,
                kg
            }
        })

        await exportConsignmentReportToExcel({
            dateTitle,
            warehouseLabel,
            groupByWarehouse: selectedWarehouseId === 'ALL',
            items: excelItems,
            companyInfo
        })
    }

    if (!hasModule('consignment_manager')) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="w-20 h-20 bg-amber-50 dark:bg-amber-950/30 rounded-3xl flex items-center justify-center mb-6">
                    <Building2 size={40} className="text-amber-500" />
                </div>
                <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-2">
                    Quản lý Hàng hóa Ký gửi
                </h2>
                <p className="text-stone-500 max-w-md text-sm">
                    Module <strong>Quản lý Hàng hóa Ký gửi</strong> chưa được bật cho phân hệ kho này.
                    Vui lòng vào <strong>Cài đặt &gt; Phân hệ</strong> để kích hoạt.
                </p>
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-6 space-y-5 max-w-[1600px] mx-auto">
            {/* Header gọn 1 hàng, không rớt dòng nút */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200/80 dark:border-zinc-800 px-5 py-4 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
                        <Building2 size={22} />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100 tracking-tight truncate">
                            Quản lý Hàng hóa Ký gửi
                        </h1>
                        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 truncate">
                            Nhập, xuất, tồn kho gửi bên ngoài & chuyển phiếu 2 chiều với Kế toán gốc
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => setImportOutboundOpen(true)}
                        className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800 transition-all whitespace-nowrap cursor-pointer active:scale-95"
                    >
                        <ArrowRightLeft size={14} />
                        Lấy từ PXK Kế toán
                    </button>
                    <button
                        type="button"
                        onClick={() => setOrderModal({ open: true, direction: 'INBOUND', editOrder: null })}
                        className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold rounded-xl bg-orange-600 hover:bg-orange-700 text-white shadow-sm shadow-orange-600/20 transition-all whitespace-nowrap cursor-pointer active:scale-95"
                    >
                        <ArrowDownToLine size={14} />
                        Nhập ký gửi
                    </button>
                    <button
                        type="button"
                        onClick={() => setOrderModal({ open: true, direction: 'OUTBOUND', editOrder: null })}
                        className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/20 transition-all whitespace-nowrap cursor-pointer active:scale-95"
                    >
                        <ArrowUpFromLine size={14} />
                        Xuất ký gửi
                    </button>
                    <button
                        type="button"
                        onClick={fetchAll}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-stone-500 hover:text-stone-800 hover:bg-stone-50 transition-colors cursor-pointer"
                        title="Tải lại dữ liệu"
                    >
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* 4 KPI Cards có icon pastel tinh tế */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-stone-200/80 dark:border-zinc-800 shadow-xs flex items-center justify-between gap-3">
                    <div>
                        <div className="text-xs font-medium text-stone-500">Kho ký gửi đang dùng</div>
                        <div className="text-2xl font-bold text-stone-900 dark:text-stone-100 mt-1 tabular-nums">
                            {warehouses.filter(w => w.is_active).length}
                        </div>
                        <div className="text-[11px] text-stone-400 mt-0.5">
                            Tổng {warehouses.length} kho đối tác
                        </div>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-stone-300 flex items-center justify-center shrink-0">
                        <Building2 size={20} />
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-stone-200/80 dark:border-zinc-800 shadow-xs flex items-center justify-between gap-3">
                    <div>
                        <div className="text-xs font-medium text-stone-500">Mặt hàng đang gửi</div>
                        <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1 tabular-nums">
                            {summaryStats.activeSkus}
                        </div>
                        <div className="text-[11px] text-stone-400 mt-0.5">
                            Đang còn tồn &gt; 0
                        </div>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                        <Package size={20} />
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-stone-200/80 dark:border-zinc-800 shadow-xs flex items-center justify-between gap-3">
                    <div>
                        <div className="text-xs font-medium text-stone-500">Nhập / Xuất trong kỳ</div>
                        <div className="text-lg font-bold mt-1.5 flex items-center gap-1.5 tabular-nums">
                            <span className="text-emerald-600">+{formatQuantityFull(summaryStats.totalIn)}</span>
                            <span className="text-stone-300 font-normal">/</span>
                            <span className="text-indigo-600">-{formatQuantityFull(summaryStats.totalOut)}</span>
                        </div>
                        <div className="text-[11px] text-stone-400 mt-0.5">
                            {inboundOrders.length} phiếu nhập · {outboundOrders.length} phiếu xuất
                        </div>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <ArrowRightLeft size={20} />
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-stone-200/80 dark:border-zinc-800 shadow-xs flex items-center justify-between gap-3">
                    <div>
                        <div className="text-xs font-medium text-stone-500">Tổng tồn cuối kỳ</div>
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1 tabular-nums">
                            {formatQuantityFull(summaryStats.totalBalance)}
                        </div>
                        <div className="text-[11px] text-stone-400 mt-0.5 tabular-nums">
                            {summaryStats.totalKg > 0 ? `Quy đổi ≈ ${formatQuantityFull(summaryStats.totalKg)} Kg` : 'Theo ĐVT hiển thị'}
                        </div>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <CheckCircle2 size={20} />
                    </div>
                </div>
            </div>

            {/* Segmented Tab Bar + Action bên phải */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-stone-100/90 dark:bg-zinc-900 border border-stone-200/70 dark:border-zinc-800 overflow-x-auto max-w-full">
                    {[
                        { id: 'inventory', label: 'Tồn kho ký gửi', icon: Package, count: filteredInventory.length },
                        { id: 'inbound', label: 'Nhập kho ký gửi', icon: ArrowDownToLine, count: inboundOrders.length },
                        { id: 'outbound', label: 'Xuất kho ký gửi', icon: ArrowUpFromLine, count: outboundOrders.length },
                        { id: 'warehouses', label: 'Danh sách kho gửi', icon: Building2, count: warehouses.length }
                    ].map(tab => {
                        const Icon = tab.icon
                        const active = activeTab === tab.id
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id as ActiveTab)}
                                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                                    active
                                        ? 'bg-white dark:bg-zinc-800 text-orange-700 dark:text-orange-400 shadow-xs'
                                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                                }`}
                            >
                                <Icon size={15} />
                                {tab.label}
                                <span
                                    className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold tabular-nums ${
                                        active
                                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                                            : 'bg-stone-200/70 text-stone-500 dark:bg-zinc-800'
                                    }`}
                                >
                                    {tab.count}
                                </span>
                            </button>
                        )
                    })}
                </div>

                <div className="flex items-center gap-2">
                    {activeTab === 'inventory' && (
                        <button
                            type="button"
                            onClick={handleExportExcel}
                            className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer active:scale-95"
                        >
                            <FileSpreadsheet size={15} />
                            Xuất Excel (Mẫu Kế toán)
                        </button>
                    )}

                    {activeTab === 'warehouses' && (
                        <button
                            type="button"
                            onClick={() => setWarehouseModal({ open: true, editWarehouse: null })}
                            className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold rounded-xl bg-orange-600 hover:bg-orange-700 text-white shadow-xs transition-all cursor-pointer active:scale-95"
                        >
                            <Plus size={15} />
                            Thêm kho ký gửi
                        </button>
                    )}
                </div>
            </div>

            {/* Filter bar gọn đẹp */}
            {activeTab !== 'warehouses' && (
                <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-stone-200/80 dark:border-zinc-800 shadow-xs flex flex-wrap items-center gap-2.5">
                    <div className="flex-1 min-w-[240px]">
                        <ProductSearchInput
                            value={searchQuery}
                            onChange={setSearchQuery}
                            products={products}
                            placeholder="Tìm sản phẩm (tên viết tắt, SKU, mã NB) hoặc mã phiếu..."
                            theme="orange"
                        />
                    </div>

                    <select
                        value={selectedWarehouseId}
                        onChange={e => setSelectedWarehouseId(e.target.value)}
                        className="h-9 px-3 text-xs font-medium rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/60 dark:bg-zinc-800 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    >
                        <option value="ALL">Tất cả Kho ký gửi</option>
                        {warehouses.map(wh => (
                            <option key={wh.id} value={wh.id}>
                                [{wh.code}] {wh.name}
                            </option>
                        ))}
                    </select>

                    <div className="flex items-center gap-1.5 bg-stone-50/60 dark:bg-zinc-800 px-2.5 h-9 rounded-xl border border-stone-200 dark:border-zinc-700">
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="text-xs bg-transparent text-stone-700 dark:text-stone-200 focus:outline-none"
                        />
                        <span className="text-stone-400 text-xs">→</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="text-xs bg-transparent text-stone-700 dark:text-stone-200 focus:outline-none"
                        />
                    </div>

                    {activeTab === 'inventory' && (
                        <>
                            <select
                                value={targetUnitName}
                                onChange={e => setTargetUnitName(e.target.value)}
                                className="h-9 px-3 text-xs font-medium rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/60 dark:bg-zinc-800 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                title="Quy đổi sang đơn vị"
                            >
                                <option value="">ĐVT gốc trên phiếu</option>
                                {units.map(u => (
                                    <option key={u.id} value={u.name}>Quy đổi: {u.name}</option>
                                ))}
                            </select>

                            <label className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/60 dark:bg-zinc-800 text-xs font-medium text-stone-600 dark:text-stone-300 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={onlyInStock}
                                    onChange={e => setOnlyInStock(e.target.checked)}
                                    className="rounded border-stone-300 text-orange-600 focus:ring-orange-500"
                                />
                                Còn tồn
                            </label>
                        </>
                    )}

                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="inline-flex items-center gap-1 h-9 px-2.5 text-xs font-semibold text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                            title="Xóa bộ lọc"
                        >
                            <X size={14} />
                            Xóa lọc
                        </button>
                    )}
                </div>
            )}

            {/* TAB 1: TỒN KHO KÝ GỬI */}
            {activeTab === 'inventory' && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200/80 dark:border-zinc-800 overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-stone-50/90 dark:bg-zinc-800/70 text-[11px] font-bold uppercase tracking-wider text-stone-500 border-b border-stone-200 dark:border-zinc-800">
                                <tr>
                                    <th className="px-4 py-3.5 text-left">Kho ký gửi</th>
                                    <th className="px-4 py-3.5 text-left">Hàng hóa</th>
                                    <th className="px-3 py-3.5 text-center">ĐVT</th>
                                    <th className="px-3 py-3.5 text-right">Tồn đầu</th>
                                    <th className="px-3 py-3.5 text-right text-emerald-700">Nhập ký gửi</th>
                                    <th className="px-3 py-3.5 text-right text-indigo-700">Xuất lấy về</th>
                                    <th className="px-3 py-3.5 text-right text-amber-700">Xuất khác</th>
                                    <th className="px-4 py-3.5 text-right text-blue-700">Tồn cuối</th>
                                    <th className="px-4 py-3.5 text-right text-stone-600">Quy đổi (Kg)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                {loading ? (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-14 text-center text-stone-400">
                                            <Loader2 size={20} className="animate-spin inline mr-2" />
                                            Đang tính tồn kho ký gửi...
                                        </td>
                                    </tr>
                                ) : filteredInventory.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-14 text-center text-stone-400">
                                            Chưa có dữ liệu tồn kho ký gửi. Hãy tạo Kho ký gửi và chuyển phiếu xuất Kế toán sang hoặc tạo phiếu nhập ký gửi.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredInventory.map(row => {
                                        const prod = row.productId ? products.find(p => p.id === row.productId) : null
                                        const baseUnit = prod?.unit || row.unit
                                        let kg = 0
                                        if (row.productId && row.balance !== 0) {
                                            const conv = convertUnit(row.productId, row.unit, 'Kg', row.balance, baseUnit)
                                            if (Number.isFinite(conv)) kg = conv
                                        } else if (row.unit.toLowerCase() === 'kg') {
                                            kg = row.balance
                                        }

                                        return (
                                            <tr key={row.key} className="hover:bg-orange-50/30 dark:hover:bg-zinc-800/40 transition-colors">
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-zinc-800 text-xs font-semibold text-stone-700 dark:text-stone-200">
                                                        <Building2 size={12} className="text-stone-400" />
                                                        {row.warehouseName}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="font-semibold text-stone-900 dark:text-stone-100 leading-snug">{row.productName}</div>
                                                    <div className="text-xs text-stone-500 flex flex-wrap items-center gap-2 mt-0.5">
                                                        {row.sku && <span className="font-mono text-[11px]">{row.sku}</span>}
                                                        {row.aliases && (
                                                            <span className="px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[11px] font-medium">
                                                                ⚡ {row.aliases}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-center whitespace-nowrap">
                                                    <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-zinc-800 text-xs font-medium text-stone-600 dark:text-stone-300">
                                                        {row.unit}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right font-mono tabular-nums text-stone-600">{formatQuantityFull(row.opening)}</td>
                                                <td className="px-3 py-3 text-right font-mono tabular-nums font-semibold text-emerald-600">
                                                    {row.qtyIn > 0 ? `+${formatQuantityFull(row.qtyIn)}` : '0'}
                                                </td>
                                                <td className="px-3 py-3 text-right font-mono tabular-nums text-indigo-600">
                                                    {row.qtyOutReturn > 0 ? `-${formatQuantityFull(row.qtyOutReturn)}` : '0'}
                                                </td>
                                                <td className="px-3 py-3 text-right font-mono tabular-nums text-amber-600">
                                                    {row.qtyOutDirect > 0 ? `-${formatQuantityFull(row.qtyOutDirect)}` : '0'}
                                                </td>
                                                <td className={`px-4 py-3 text-right font-mono tabular-nums font-bold ${row.balance > 0 ? 'text-blue-600 dark:text-blue-400' : row.balance < 0 ? 'text-red-600' : 'text-stone-400'}`}>
                                                    {formatQuantityFull(row.balance)}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono tabular-nums text-xs font-semibold text-stone-600 dark:text-stone-300">
                                                    {kg > 0 ? formatQuantityFull(kg) : '—'}
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                            {!loading && filteredInventory.length > 0 && (
                                <tfoot className="bg-stone-50/90 dark:bg-zinc-800/80 border-t-2 border-stone-200 dark:border-zinc-700 font-bold text-xs">
                                    <tr>
                                        <td colSpan={3} className="px-4 py-3 text-stone-700 dark:text-stone-200 uppercase tracking-wide">
                                            Tổng cộng ({filteredInventory.length} dòng)
                                        </td>
                                        <td className="px-3 py-3 text-right font-mono tabular-nums text-stone-700">
                                            {formatQuantityFull(summaryStats.totalOpening)}
                                        </td>
                                        <td className="px-3 py-3 text-right font-mono tabular-nums text-emerald-700">
                                            +{formatQuantityFull(summaryStats.totalIn)}
                                        </td>
                                        <td className="px-3 py-3 text-right font-mono tabular-nums text-indigo-700">
                                            -{formatQuantityFull(summaryStats.totalOutReturn)}
                                        </td>
                                        <td className="px-3 py-3 text-right font-mono tabular-nums text-amber-700">
                                            -{formatQuantityFull(summaryStats.totalOutDirect)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono tabular-nums text-blue-700 text-sm">
                                            {formatQuantityFull(summaryStats.totalBalance)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono tabular-nums text-stone-800 dark:text-stone-200">
                                            {summaryStats.totalKg > 0 ? `${formatQuantityFull(summaryStats.totalKg)} Kg` : '—'}
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 2 & TAB 3: NHẬP / XUẤT KHO KÝ GỬI */}
            {(activeTab === 'inbound' || activeTab === 'outbound') && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200/80 dark:border-zinc-800 overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-stone-50/90 dark:bg-zinc-800/70 text-[11px] font-bold uppercase tracking-wider text-stone-500 border-b border-stone-200 dark:border-zinc-800">
                                <tr>
                                    <th className="px-4 py-3.5 text-left">Mã phiếu / Ngày</th>
                                    <th className="px-4 py-3.5 text-left">Kho ký gửi</th>
                                    <th className="px-4 py-3.5 text-left">
                                        {activeTab === 'inbound' ? 'Nguồn chuyển phiếu' : 'Mục đích & Liên kết Kế toán'}
                                    </th>
                                    <th className="px-4 py-3.5 text-left">Hàng hóa</th>
                                    <th className="px-3 py-3.5 text-center">Trạng thái</th>
                                    <th className="px-4 py-3.5 text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                {(activeTab === 'inbound' ? inboundOrders : outboundOrders).length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-14 text-center text-stone-400">
                                            Chưa có phiếu {activeTab === 'inbound' ? 'nhập' : 'xuất'} ký gửi nào.
                                        </td>
                                    </tr>
                                ) : (
                                    (activeTab === 'inbound' ? inboundOrders : outboundOrders).map(order => {
                                        const totalQty = (order.items || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0)
                                        const canTransferToInbound =
                                            activeTab === 'outbound' &&
                                            order.outbound_purpose === 'RETURN_TO_MAIN' &&
                                            !order.linked_inbound_order_id &&
                                            order.status !== 'Cancelled'

                                        return (
                                            <tr key={order.id} className="hover:bg-orange-50/30 dark:hover:bg-zinc-800/40 transition-colors">
                                                <td className="px-4 py-3.5 whitespace-nowrap">
                                                    <div className="font-bold font-mono text-stone-900 dark:text-stone-100">{order.code}</div>
                                                    <div className="text-[11px] text-stone-500 mt-0.5 tabular-nums">
                                                        {format(new Date(order.order_date), 'dd/MM/yyyy HH:mm')}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="font-semibold text-stone-800 dark:text-stone-200">
                                                        {order.consignment_warehouses?.name || '---'}
                                                    </div>
                                                    {order.description && (
                                                        <div className="text-xs text-stone-500 line-clamp-1 max-w-[260px] mt-0.5">
                                                            {order.description}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5 whitespace-nowrap">
                                                    {activeTab === 'inbound' ? (
                                                        order.source_outbound_order_code ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 whitespace-nowrap">
                                                                <Link2 size={12} className="shrink-0" />
                                                                Từ PXK: {order.source_outbound_order_code}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-600 dark:bg-zinc-800 dark:text-stone-400">
                                                                Tạo thủ công
                                                            </span>
                                                        )
                                                    ) : (
                                                        <div className="flex flex-col items-start gap-1">
                                                            <span
                                                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                                                                    order.outbound_purpose === 'RETURN_TO_MAIN'
                                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                        : order.outbound_purpose === 'DIRECT_DELIVERY'
                                                                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                                                        : 'bg-stone-100 text-stone-700'
                                                                }`}
                                                            >
                                                                {order.outbound_purpose ? OUTBOUND_PURPOSE_LABELS[order.outbound_purpose] : 'Xuất ký gửi'}
                                                            </span>
                                                            {order.linked_inbound_order_code && (
                                                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 whitespace-nowrap">
                                                                    <Link2 size={11} />
                                                                    Đã nhập KT: {order.linked_inbound_order_code}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => setDetailOrder(order)}
                                                        className="text-left group cursor-pointer"
                                                    >
                                                        <div className="text-xs font-semibold text-stone-800 dark:text-stone-200 group-hover:text-orange-600 transition-colors tabular-nums">
                                                            {order.items?.length || 0} mặt hàng · Tổng {formatQuantityFull(totalQty)}
                                                        </div>
                                                        <div className="text-xs text-stone-500 truncate max-w-[240px] mt-0.5">
                                                            {(order.items || []).map(i => i.product_name).join(', ')}
                                                        </div>
                                                    </button>
                                                </td>
                                                <td className="px-3 py-3.5 text-center whitespace-nowrap">
                                                    <span
                                                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                                                            order.status === 'Completed'
                                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                                                                : order.status === 'Pending'
                                                                ? 'bg-amber-50 text-amber-700 border border-amber-200/70'
                                                                : 'bg-red-50 text-red-700 border border-red-200/70'
                                                        }`}
                                                    >
                                                        {order.status === 'Completed' ? 'Hoàn thành' : order.status === 'Pending' ? 'Chờ duyệt' : 'Đã hủy'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                                    <div className="inline-flex items-center gap-1">
                                                        {canTransferToInbound && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setTransferInboundOrder(order)}
                                                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1 mr-1 shadow-xs cursor-pointer"
                                                                title="Chuyển thành Phiếu nhập Kế toán gốc"
                                                            >
                                                                <ArrowDownToLine size={13} />
                                                                Nhập về KT gốc
                                                            </button>
                                                        )}
                                                        {order.status === 'Pending' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleApproveOrder(order)}
                                                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                                                                title="Duyệt hoàn thành"
                                                            >
                                                                <CheckCircle2 size={16} />
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => window.open(`/print/consignment?id=${order.id}`, '_blank')}
                                                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 cursor-pointer"
                                                            title="In phiếu ký gửi"
                                                        >
                                                            <Printer size={16} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setDetailOrder(order)}
                                                            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 cursor-pointer"
                                                            title="Xem chi tiết"
                                                        >
                                                            <Eye size={16} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setOrderModal({ open: true, direction: order.direction, editOrder: order })}
                                                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 cursor-pointer"
                                                            title="Sửa phiếu"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteOrder(order)}
                                                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 cursor-pointer"
                                                            title="Xóa phiếu"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 4: DANH SÁCH KHO KÝ GỬI */}
            {activeTab === 'warehouses' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {warehouses.length === 0 ? (
                        <div className="col-span-full bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-stone-300 dark:border-zinc-700 p-12 text-center">
                            <Building2 size={36} className="mx-auto text-stone-300 mb-3" />
                            <p className="text-sm text-stone-500 mb-4">Chưa có Kho ký gửi nào được tạo.</p>
                            <button
                                type="button"
                                onClick={() => setWarehouseModal({ open: true, editWarehouse: null })}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 text-white"
                            >
                                <Plus size={16} />
                                Thêm Kho ký gửi đầu tiên
                            </button>
                        </div>
                    ) : (
                        warehouses.map(wh => {
                            const skuCount = allCurrentStockRows.filter(r => r.warehouseId === wh.id && r.balance > 0).length
                            return (
                                <div
                                    key={wh.id}
                                    className="bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200/80 dark:border-zinc-800 p-5 shadow-xs flex flex-col justify-between gap-3"
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                                    {wh.code}
                                                </span>
                                                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 mt-1.5">
                                                    {wh.name}
                                                </h3>
                                            </div>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${wh.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                                                {wh.is_active ? 'Hoạt động' : 'Tạm ngưng'}
                                            </span>
                                        </div>

                                        <div className="mt-3 space-y-1.5 text-xs text-stone-600 dark:text-stone-400">
                                            {wh.address && (
                                                <div className="flex items-start gap-1.5">
                                                    <MapPin size={13} className="mt-0.5 shrink-0 text-stone-400" />
                                                    <span>{wh.address}</span>
                                                </div>
                                            )}
                                            {wh.contact_name && (
                                                <div className="flex items-center gap-1.5">
                                                    <User size={13} className="shrink-0 text-stone-400" />
                                                    <span>{wh.contact_name}</span>
                                                </div>
                                            )}
                                            {wh.contact_phone && (
                                                <div className="flex items-center gap-1.5">
                                                    <Phone size={13} className="shrink-0 text-stone-400" />
                                                    <span>{wh.contact_phone}</span>
                                                </div>
                                            )}
                                            {wh.notes && <p className="text-stone-500 italic pt-1">{wh.notes}</p>}
                                        </div>
                                    </div>

                                    <div className="pt-3 border-t border-stone-100 dark:border-zinc-800 flex items-center justify-between">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedWarehouseId(wh.id)
                                                setActiveTab('inventory')
                                            }}
                                            className="text-xs font-semibold text-blue-600 hover:underline"
                                        >
                                            Đang gửi {skuCount} mặt hàng →
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setWarehouseModal({ open: true, editWarehouse: wh })}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-stone-200 dark:border-zinc-700 hover:bg-stone-50"
                                        >
                                            <Edit2 size={13} /> Sửa
                                        </button>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            )}

            {/* Modal xem nhanh chi tiết phiếu ký gửi */}
            {detailOrder && (
                <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-zinc-800 w-full max-w-2xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-stone-200 dark:border-zinc-800 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-stone-900 dark:text-stone-100">
                                    Chi tiết phiếu {detailOrder.code}
                                </h3>
                                <p className="text-xs text-stone-500">
                                    {detailOrder.consignment_warehouses?.name} • {format(new Date(detailOrder.order_date), 'dd/MM/yyyy HH:mm')}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDetailOrder(null)}
                                className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">
                            {detailOrder.description && (
                                <p className="text-xs text-stone-600 bg-stone-50 dark:bg-zinc-800 p-3 rounded-xl">
                                    {detailOrder.description}
                                </p>
                            )}
                            <table className="w-full text-sm">
                                <thead className="text-xs uppercase text-stone-500 border-b border-stone-200 dark:border-zinc-800">
                                    <tr>
                                        <th className="py-2 text-left">Hàng hóa</th>
                                        <th className="py-2 text-left">Số lô</th>
                                        <th className="py-2 text-right">Số lượng</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                    {(detailOrder.items || []).map((it, idx) => (
                                        <tr key={it.id || idx}>
                                            <td className="py-2.5">
                                                <div className="font-medium text-stone-800 dark:text-stone-100">{it.product_name}</div>
                                                {it.sku && <div className="text-xs text-stone-400 font-mono">{it.sku}</div>}
                                            </td>
                                            <td className="py-2.5 text-xs text-stone-500">{it.batch_code || '—'}</td>
                                            <td className="py-2.5 text-right font-semibold text-indigo-600 whitespace-nowrap">
                                                {formatQuantityFull(it.quantity)} {it.unit}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-5 py-3 border-t border-stone-100 dark:border-zinc-800 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => window.open(`/print/consignment?id=${detailOrder.id}`, '_blank')}
                                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-lg bg-orange-600 hover:bg-orange-700 text-white cursor-pointer"
                            >
                                <Printer size={15} />
                                In phiếu
                            </button>
                            <button
                                type="button"
                                onClick={() => setDetailOrder(null)}
                                className="px-4 py-1.5 text-sm font-medium rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 cursor-pointer"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Các Modal nghiệp vụ */}
            <ConsignmentOrderModal
                isOpen={orderModal.open}
                direction={orderModal.direction}
                editOrder={orderModal.editOrder}
                warehouses={warehouses}
                products={products}
                units={units}
                inventoryRows={allCurrentStockRows}
                onClose={() => setOrderModal(prev => ({ ...prev, open: false, editOrder: null }))}
                onSuccess={fetchAll}
            />

            <ConsignmentWarehouseModal
                isOpen={warehouseModal.open}
                editWarehouse={warehouseModal.editWarehouse}
                onClose={() => setWarehouseModal({ open: false, editWarehouse: null })}
                onSuccess={fetchAll}
            />

            <ImportFromOutboundModal
                isOpen={importOutboundOpen}
                warehouses={warehouses}
                onClose={() => setImportOutboundOpen(false)}
                onSuccess={fetchAll}
            />

            <TransferToInboundModal
                isOpen={Boolean(transferInboundOrder)}
                consignmentOrder={transferInboundOrder}
                onClose={() => setTransferInboundOrder(null)}
                onSuccess={fetchAll}
            />
        </div>
    )
}
