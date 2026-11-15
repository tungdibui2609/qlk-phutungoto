// @ts-nocheck
'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { X, FileText, Download, Printer, Loader2, Calendar, LayoutList } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { formatQuantityFull, decodeSTT } from '@/lib/numberUtils'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { saveAs } from 'file-saver'
import { usePrintCompanyInfo } from '@/hooks/usePrintCompanyInfo'
import { LotReportContent } from './report-modal/LotReportContent'

interface LotReportModalProps {
    onClose: () => void
}

export function LotReportModal({ onClose }: LotReportModalProps) {
    const { currentSystem } = useSystem()
    const { showToast } = useToast()
    const { companyInfo } = usePrintCompanyInfo()

    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState<'inward' | 'outward' | 'unassigned'>('inward')
    const [reportDataInward, setReportDataInward] = useState<any[]>([])
    const [reportDataOutward, setReportDataOutward] = useState<any[]>([])
    const [reportDataUnassigned, setReportDataUnassigned] = useState<any[]>([])
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
    const [productionLotsMap, setProductionLotsMap] = useState<Record<string, string>>({})

    useEffect(() => {
        if (currentSystem?.code) {
            fetchReportData()
        }
    }, [startDate, endDate, currentSystem?.code])

    async function fetchReportData() {
        if (!currentSystem?.code) return
        setLoading(true)

        try {
            const start = new Date(startDate)
            const end = new Date(endDate)

            // Kiểm tra tính hợp lệ của ngày trước khi xử lý tiếp
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                console.warn('[LOT Report] Invalid date provided:', { startDate, endDate })
                return
            }

            start.setHours(0, 0, 0, 0)
            end.setHours(23, 59, 59, 999)

            const startStr = format(start, "yyyy-MM-dd")
            const endStr = format(end, "yyyy-MM-dd")

            // Helper để lấy toàn bộ dữ liệu không bị giới hạn 1000 dòng của Supabase
            const fetchLargeData = async (table: string, select: string, filter: (q: any) => any) => {
                let allData: any[] = []
                let from = 0
                const PAGE_SIZE = 1000
                while (true) {
                    let query = supabase.from(table).select(select).range(from, from + PAGE_SIZE - 1)
                    query = filter(query)
                    const { data, error } = await query
                    if (error) throw error
                    if (!data || data.length === 0) break
                    allData = [...allData, ...data]
                    if (data.length < PAGE_SIZE) break
                    from += PAGE_SIZE
                }
                return allData
            }

            // Query 1: Lấy tất cả lot có ngày nhập hoặc ngày tạo trong khoảng thời gian
            const allLots = await fetchLargeData('lots', `
                    *,
                    productions(code, name),
                    lot_items(
                        id,
                        product_id,
                        quantity,
                        unit,
                        products(name, sku, unit)
                    ),
                    positions!positions_lot_id_fkey(id, code),
                    products(name, sku, unit)
                `, q => q.eq('system_code', currentSystem?.code)
                        .or(`inbound_date.gte.${startStr},created_at.gte.${format(start, "yyyy-MM-dd'T'00:00:00")}`)
                        .order('inbound_date', { ascending: false })
            )

            // Query 1b: Lấy thêm các lot đã xuất CŨ (tạo trước khoảng ngày đang xem)
            const oneYearBefore = new Date(start)
            oneYearBefore.setFullYear(oneYearBefore.getFullYear() - 1)
            const exportedLots = await fetchLargeData('lots', `
                    *,
                    productions(code, name),
                    lot_items(
                        id,
                        product_id,
                        quantity,
                        unit,
                        products(name, sku, unit)
                    ),
                    positions!positions_lot_id_fkey(id, code),
                    products(name, sku, unit)
                `, q => q.eq('system_code', currentSystem?.code)
                        .eq('status', 'exported')
                        .lt('created_at', format(start, "yyyy-MM-dd'T'00:00:00"))
                        .gte('created_at', format(oneYearBefore, "yyyy-MM-dd'T'00:00:00"))
            )


            // Merge 2 danh sách, loại trùng bằng id
            const allLotsIds = new Set((allLots || []).map((l: any) => l.id))
            const mergedLots = [
                ...(allLots || []),
                ...((exportedLots || []).filter((l: any) => !allLotsIds.has(l.id)))
            ]
            const rawLots = mergedLots as any[]

            // Step 2: Separate Inward and Outward
            const inward: any[] = []
            const outwardTransactions: any[] = []

            rawLots.forEach(lot => {
                // 2a. Check if inward (using inbound_date if available, else created_at)
                const effectiveDateStr = lot.inbound_date || lot.created_at;
                const effectiveDate = new Date(effectiveDateStr);
                
                // Kiểm tra ngày nằm trong khoảng lọc
                const isDateInRange = effectiveDate >= start && effectiveDate <= end;
                
                if (isDateInRange) {
                    // Bỏ qua các lot "ma" - đã xuất hết, không có hàng hóa, 
                    // và ngày tạo thực tế nằm ngoài khoảng (inbound_date bị đổi thủ công)
                    const createdAt = new Date(lot.created_at);
                    const isCreatedInRange = createdAt >= start && createdAt <= end;
                    const hasInventoryData = (lot.lot_items && lot.lot_items.length > 0) || 
                                             lot.products || 
                                             (lot.metadata?.system_history?.merged_out?.length > 0);
                    const isExported = lot.status === 'exported';
                    
                    // Nếu lot đã xuất + không có dữ liệu hàng hóa + ngày tạo không nằm trong khoảng
                    // → Đây là lot cũ bị đổi inbound_date → không hiển thị trong danh sách nhập
                    if (isExported && !hasInventoryData && !isCreatedInRange) {
                        // Skip - lot "ma" (ghost lot)
                    } else {
                        let validItems = lot.lot_items || []
                        // Không lọc bỏ hàng gộp/tách nữa để người dùng có thể theo dõi nguồn gốc hàng hóa
                        // Thay vào đó chúng ta sẽ hiển thị nhãn phân biệt trong UI
                        
                        if (lot.lot_items && lot.lot_items.length > 0) {
                            inward.push({ ...lot, lot_items: validItems })
                        } else {
                            inward.push(lot)
                        }
                    }
                }

                // 2b. Check if has exports in range (metadata path - from QuickBulkExport)
                const exports = lot.metadata?.system_history?.exports || []
                if (Array.isArray(exports)) {
                    exports.forEach((exp: any) => {
                        const exportDate = new Date(exp.date)
                        if (exportDate >= start && exportDate <= end) {
                            const items = exp.items || {}
                            Object.entries(items).forEach(([itemId, itemData]: [string, any]) => {
                                outwardTransactions.push({
                                    id: exp.id + '_' + itemId,
                                    source: 'metadata',
                                    lot_id: lot.id,
                                    lot_code: lot.code,
                                    daily_seq: lot.daily_seq || null,
                                    date: exp.date,
                                    customer: exp.customer || 'Khách lẻ',
                                    description: exp.description || '',
                                    product_id: itemData.product_id,
                                    product_name: itemData.product_name || 'Sản phẩm không tên',
                                    product_sku: itemData.product_sku || '-',
                                    quantity: itemData.exported_quantity || 0,
                                    unit: itemData.unit || '-',
                                    production_id: itemData.production_id || lot.production_id,
                                    production_code: lot.productions?.code || lot.production_code || '-',
                                    production_name: lot.productions?.name || '-',
                                    location_code: exp.location_code,
                                    export_order_code: null
                                })
                            })
                        }
                    })
                }
            })

            // Step 2c: Fetch export data from export_tasks / export_task_items (export-order page path)
            const exportTasksData = await fetchLargeData('export_tasks', `
                    id,
                    code,
                    status,
                    created_at,
                    system_code,
                    export_task_items(
                        id,
                        product_id,
                        quantity,
                        unit,
                        status,
                        lots(
                            id,
                            code,
                            daily_seq,
                            production_id,
                            productions(code, name)
                        ),
                        products(name, sku)
                    )
                `, q => q.eq('system_code', currentSystem?.code)
                        .gte('created_at', startStr)
                        .lte('created_at', endStr)
                        .order('created_at', { ascending: false })
            )


            console.log('[LOT Report] Export Tasks query result:', exportTasksData?.length, 'tasks found', exportTasksData)

            if (exportTasksData && exportTasksData.length > 0) {
                // Track lot IDs already captured via metadata to avoid duplicates
                const metadataLotIds = new Set(outwardTransactions.filter((t: any) => t.source === 'metadata').map((t: any) => t.lot_id))

                exportTasksData.forEach((task: any) => {
                    const items = task.export_task_items || []
                    items.forEach((item: any) => {
                        if (!item.lots) return
                        const lotId = item.lots?.id
                        // Skip if this lot already recorded via metadata (avoid duplicates)
                        if (metadataLotIds.has(lotId)) return

                        // Chỉ lấy những item đã thực sự được xuất
                        if (item.status !== 'Exported' && item.status !== 'Completed') return

                        outwardTransactions.push({
                            id: `task_${task.id}_item_${item.id}`,
                            source: 'export_task',
                            lot_id: lotId,
                            lot_code: item.lots?.code || '-',
                            daily_seq: item.lots?.daily_seq || null,
                            date: task.created_at,
                            customer: '-',
                            description: `Lệnh xuất: ${task.code}`,
                            product_id: item.product_id,
                            product_name: item.products?.name || 'Sản phẩm không tên',
                            product_sku: item.products?.sku || '-',
                            quantity: item.quantity || 0,
                            unit: item.unit || '-',
                            production_id: item.lots?.production_id,
                            production_code: item.lots?.productions?.code || '-',
                            production_name: item.lots?.productions?.name || '-',
                            location_code: null,
                            export_order_code: task.code
                        })
                    })
                })
            }

            // Step 3: Fetch Production info (Tên và Mã) cho TẤT CẢ các ID liên quan
            const allProdIds = Array.from(new Set([
                ...inward.map(r => r.production_id),
                ...outwardTransactions.map(r => r.production_id),
                ...rawLots.flatMap(lot => (lot.metadata?.system_history?.exports || []).flatMap((e: any) => Object.values(e.items || {}).map((i: any) => i.production_id)))
            ].filter(id => !!id)))

            const productionsDataMap: Record<string, { code: string, name: string }> = {}
            if (allProdIds.length > 0) {
                const { data: prodData } = await supabase
                    .from('productions')
                    .select('id, code, name')
                    .in('id', allProdIds) as { data: { id: string, code: string, name: string }[] | null }
                
                if (prodData) {
                    prodData.forEach(p => {
                        productionsDataMap[p.id] = { code: p.code, name: p.name }
                    })
                }
            }

            // Step 4: Map production info back to transactions
            const mappedOutward = outwardTransactions.map(tx => {
                const info = productionsDataMap[tx.production_id]
                return {
                    ...tx,
                    production_code: info?.code || tx.production_code,
                    production_name: info?.name || tx.production_name
                }
            })

            // Step 5: Fetch Production LOT codes (Số lô) if any
            if (allProdIds.length > 0) {
                const { data: prodLots } = await supabase
                    .from('production_lots')
                    .select('production_id, product_id, lot_code')
                    .in('production_id', allProdIds)

                if (prodLots) {
                    const map: Record<string, string> = {}
                    prodLots.forEach((pl: any) => {
                        map[`${pl.production_id}_${pl.product_id}`] = pl.lot_code
                    })
                    setProductionLotsMap(map)
                }
            } else {
                setProductionLotsMap({})
            }

            // Step 6: Reconstruct missing lot_items for fully exported/empty lots
            const emptyInwardLots = inward.filter(lot => 
                (!lot.lot_items || lot.lot_items.length === 0) && 
                !lot.products && 
                !(lot.metadata?.system_history?.merged_out?.length > 0)
            );

            if (emptyInwardLots.length > 0) {
                const emptyLotIds = emptyInwardLots.map(l => l.id);
                const { data: missingExportItems } = await supabase
                    .from('export_task_items')
                    .select(`
                        lot_id,
                        product_id,
                        quantity,
                        unit,
                        products(name, sku, unit)
                    `)
                    .in('lot_id', emptyLotIds)
                    .in('status', ['Exported', 'Completed']);

                if (missingExportItems && missingExportItems.length > 0) {
                    const reconstructedMap: Record<string, any[]> = {};
                    
                    missingExportItems.forEach((item: any) => {
                        if (!reconstructedMap[item.lot_id]) reconstructedMap[item.lot_id] = [];
                        
                        // Aggregate quantities for same product/unit
                        const existing = reconstructedMap[item.lot_id].find(i => i.product_id === item.product_id && i.unit === item.unit);
                        if (existing) {
                            existing.quantity += (Number(item.quantity) || 0);
                        } else {
                            reconstructedMap[item.lot_id].push({
                                id: `reconstructed_${item.product_id}`,
                                product_id: item.product_id,
                                quantity: Number(item.quantity) || 0,
                                unit: item.unit || item.products?.unit,
                                products: item.products,
                                is_reconstructed: true
                            });
                        }
                    });

                    inward.forEach(lot => {
                        if (reconstructedMap[lot.id]) {
                            lot.lot_items = reconstructedMap[lot.id];
                        }
                    });
                }
            }

            // Step 7: Fetch Product info for merged_out products that don't have it
            const mergedOutPids = new Set<string>();
            inward.forEach(lot => {
                const mo = lot.metadata?.system_history?.merged_out || [];
                if (Array.isArray(mo)) {
                    mo.forEach((m: any) => {
                        if (m.product_id && !m.product_name) {
                            mergedOutPids.add(m.product_id);
                        }
                    });
                }
            });

            const mergedProductInfoMap: Record<string, any> = {};
            if (mergedOutPids.size > 0) {
                const { data: pData } = await supabase
                    .from('products')
                    .select('id, name, sku, unit')
                    .in('id', Array.from(mergedOutPids));
                
                if (pData) {
                    pData.forEach((p: any) => {
                        mergedProductInfoMap[p.id] = p;
                    });
                }
            }

            // Step 8: Truy xuất unit chính xác từ lot đích cho merged_out cũ không có product_unit
            // Khi gộp, item được insert vào lot đích (target_lot_id) với unit đúng
            // → Query lot_items của target lot để lấy unit thực tế
            const targetLotUnitLookups: { target_lot_id: string, product_id: string }[] = [];
            inward.forEach(lot => {
                const mo = lot.metadata?.system_history?.merged_out || [];
                if (Array.isArray(mo)) {
                    mo.forEach((m: any) => {
                        if (m.target_lot_id && (m.product_id || lot.product_id) && !m.product_unit) {
                            targetLotUnitLookups.push({
                                target_lot_id: m.target_lot_id,
                                product_id: m.product_id || lot.product_id
                            });
                        }
                    });
                }
            });

            const targetUnitMap: Record<string, string> = {};
            if (targetLotUnitLookups.length > 0) {
                // Lấy unique target_lot_ids
                const uniqueTargetLotIds = Array.from(new Set(targetLotUnitLookups.map(l => l.target_lot_id)));
                
                const { data: targetLotItems } = await supabase
                    .from('lot_items')
                    .select('lot_id, product_id, unit')
                    .in('lot_id', uniqueTargetLotIds);

                if (targetLotItems && targetLotItems.length > 0) {
                    // Tạo map: lot_id_product_id → unit
                    (targetLotItems as any[]).forEach((ti: any) => {
                        const key = `${ti.lot_id}_${ti.product_id}`;
                        if (ti.unit && !targetUnitMap[key]) {
                            targetUnitMap[key] = ti.unit;
                        }
                    });
                }
            }

            // Map back to inward data for easier access (Kết hợp Step 7 và kết quả Step 8)
            inward.forEach(lot => {
                const mo = lot.metadata?.system_history?.merged_out || [];
                if (Array.isArray(mo)) {
                    mo.forEach((m: any) => {
                        // Cố gắng gán product_unit từ Step 8 trước
                        if (!m.product_unit && m.target_lot_id) {
                            const pid = m.product_id || lot.product_id;
                            const lookupKey = `${m.target_lot_id}_${pid}`;
                            if (targetUnitMap[lookupKey]) {
                                m.product_unit = targetUnitMap[lookupKey];
                            }
                        }

                        // Map thông tin Product từ Step 7 (name, sku, và fallback unit)
                        if (m.product_id && !m.product_name && mergedProductInfoMap[m.product_id]) {
                            const p = mergedProductInfoMap[m.product_id];
                            m.product_name = p.name;
                            m.product_sku = p.sku;
                            // Fallback cuối cùng nếu cả DB cũ và target lot đều không có
                            if (!m.product_unit) m.product_unit = p.unit;
                        }
                    });
                }
            });

            // Step 9: Truy vấn các LOT chưa gán vị trí (unassigned lots)
            const unassignedLots = await fetchLargeData('lots', `
                    *,
                    productions(code, name),
                    lot_items(
                        id,
                        product_id,
                        quantity,
                        unit,
                        products(name, sku, unit)
                    ),
                    positions!positions_lot_id_fkey(id, code),
                    products(name, sku, unit)
                `, q => q.eq('system_code', currentSystem?.code)
                        .neq('status', 'exported')
                        .neq('status', 'hidden')
            )
            const filteredUnassigned = unassignedLots.filter((lot: any) => !lot.positions || lot.positions.length === 0)

            setReportDataInward(inward)
            setReportDataOutward(mappedOutward)
            setReportDataUnassigned(filteredUnassigned)
        } catch (err: any) {
            console.error('Error fetching report data:', err)
            const errMsg = err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err))
            showToast('Lỗi tải dữ liệu báo cáo: ' + errMsg, 'error')
        } finally {
            setLoading(false)
        }
    }

    const groupedInwardData = useMemo(() => {
        if (!reportDataInward.length) return []
        
        const groups: Record<string, { production_code: string, production_name?: string, lots: any[] }> = {}
        
        reportDataInward.forEach(lot => {
            const prodCode = lot.production_code || lot.productions?.code || 'NO_PROD'
            const prodName = lot.productions?.name || ''
            
            if (!groups[prodCode]) {
                groups[prodCode] = {
                    production_code: prodCode === 'NO_PROD' ? 'Không xác định' : prodCode,
                    production_name: prodName,
                    lots: []
                }
            }
            groups[prodCode].lots.push(lot)
        })
        
        return Object.values(groups)
    }, [reportDataInward])

    const summaryInward = useMemo(() => {
        const stats: Record<string, { 
            productName: string, 
            sku: string, 
            totalQty: number, 
            newInQty: number,
            mergedInQty: number,
            mergedOutQty: number,
            unit: string, 
            lotCount: number,
            productions: Record<string, number>
        }> = {}
        
        reportDataInward.forEach(lot => {
            const items = lot.lot_items || []
            const mergedOut = lot.metadata?.system_history?.merged_out || []
            const processedPids = new Set<string>();

            // Pre-process merged_out: tính tổng qty theo product_id (CHỈ TÍNH 1 LẦN cho mỗi lot)
            // Tránh bug nhân bội khi nhiều items cùng product_id
            const mergedOutByPid: Record<string, number> = {};
            const mergedOutUnitByPid: Record<string, string> = {};
            if (Array.isArray(mergedOut)) {
                mergedOut.forEach((mo: any) => {
                    // Dùng product_id nếu có, fallback sang lot.product_id cho merged_out cũ
                    const moPid = mo.product_id || lot.product_id;
                    if (moPid) {
                        mergedOutByPid[moPid] = (mergedOutByPid[moPid] || 0) + (Number(mo.quantity) || 0);
                        // Lấy unit từ merged_out (đã được backfill từ target lot ở Step 8)
                        if (!mergedOutUnitByPid[moPid] && (mo.product_unit || mo.unit)) {
                            mergedOutUnitByPid[moPid] = mo.product_unit || mo.unit;
                        }
                    }
                });
            }

            // Track which product_ids already had their mergedOut accounted for in this lot
            const mergedOutAccountedPids = new Set<string>();

            // 1. Xử lý hàng hiện có
            items.forEach((item: any) => {
                // Ưu tiên unit từ merged_out (chính xác từ target lot) nếu có
                const baseUnit = item.unit || item.products?.unit || '-';
                const unit = mergedOutUnitByPid[item.product_id] || baseUnit;
                const key = `${item.product_id}_${unit}`
                if (!stats[key]) {
                    stats[key] = {
                        productName: item.products?.name || 'Sản phẩm không tên',
                        sku: item.products?.sku || '-',
                        totalQty: 0,
                        newInQty: 0,
                        mergedInQty: 0,
                        mergedOutQty: 0,
                        unit: unit,
                        lotCount: 0,
                        productions: {}
                    }
                }

                // Lấy nhãn lệnh sản xuất (Mã | Tên)
                const prodCode = lot.productions?.code || lot.production_code || 'NO_CODE'
                const prodName = lot.productions?.name || ''
                const prodLabel = prodName ? `${prodCode} | ${prodName}` : prodCode
                
                // Phân tích nguồn gốc item
                const hist = lot.metadata?.system_history?.item_history?.[item.id];
                const isMergedIn = hist?.type === 'merge' || hist?.type === 'split';
                
                const currentQty = Number(item.quantity) || 0;
                
                // Chỉ tính mergedOutQty MỘT LẦN cho mỗi product_id trong mỗi lot
                // (tránh nhân bội khi nhiều items cùng product_id)
                let itemMergedOutQty = 0;
                if (!mergedOutAccountedPids.has(item.product_id) && mergedOutByPid[item.product_id]) {
                    itemMergedOutQty = mergedOutByPid[item.product_id];
                    mergedOutAccountedPids.add(item.product_id);
                }

                if (isMergedIn) {
                    stats[key].mergedInQty += currentQty;
                } else {
                    stats[key].newInQty += currentQty;
                }
                
                stats[key].mergedOutQty += itemMergedOutQty;
                stats[key].totalQty += (currentQty + itemMergedOutQty);
                stats[key].lotCount += 1;
                processedPids.add(item.product_id);

                // Tích lũy vào productions - CHỈ tính hàng MỚI thực tế của ngày đó (không tính hàng gộp vào từ nơi khác)
                const actualNewQty = isMergedIn ? 0 : currentQty;
                const qtyForProd = actualNewQty + itemMergedOutQty;
                if (qtyForProd > 0) {
                    stats[key].productions[prodLabel] = (stats[key].productions[prodLabel] || 0) + qtyForProd;
                }
            })

            // 2. Xử lý hàng đã gộp hết đi (không còn item nào trong lot cho product_id đó)
            if (Array.isArray(mergedOut)) {
                // Lấy tất cả product_id trong merged_out (kể cả những cái không có product_id thì fallback)
                const allMergedPids: string[] = [];
                mergedOut.forEach((mo: any) => {
                    const moPid = mo.product_id || lot.product_id;
                    if (moPid && !allMergedPids.includes(moPid)) {
                        allMergedPids.push(moPid);
                    }
                });
                
                allMergedPids.forEach((pid: string) => {
                    if (!processedPids.has(pid)) {
                        const productMergedInfo = mergedOut.filter((mo: any) => (mo.product_id || lot.product_id) === pid);
                        const totalMergedQty = productMergedInfo.reduce((acc: number, cur: any) => acc + (Number(cur.quantity) || 0), 0);
                        
                        const productSample = lot.products?.id === pid ? lot.products : null;
                        const unit = productSample?.unit || productMergedInfo[0]?.product_unit || productMergedInfo[0]?.unit || '-';
                        const key = `${pid}_${unit}`;
                        
                        if (!stats[key]) {
                            stats[key] = {
                                productName: productSample?.name || productMergedInfo[0]?.product_name || 'Sản phẩm đã gộp hết',
                                sku: productSample?.sku || productMergedInfo[0]?.product_sku || '-',
                                totalQty: 0,
                                newInQty: 0,
                                mergedInQty: 0,
                                mergedOutQty: 0,
                                unit: unit,
                                lotCount: 0,
                                productions: {}
                            }
                        }

                        const prodCode = lot.productions?.code || lot.production_code || 'NO_CODE'
                        const prodName = lot.productions?.name || ''
                        const prodLabel = prodName ? `${prodCode} | ${prodName}` : prodCode
                        
                        stats[key].newInQty += totalMergedQty;
                        stats[key].mergedOutQty += totalMergedQty;
                        stats[key].totalQty += totalMergedQty;
                        stats[key].lotCount += 1;
                        stats[key].productions[prodLabel] = (stats[key].productions[prodLabel] || 0) + totalMergedQty;
                        processedPids.add(pid);
                    }
                });
            }

            // 3. Fallback cho trường hợp lot cũ (lot.products)
            if (processedPids.size === 0 && lot.products) {
                const unit = (lot as any).unit || lot.products.unit || '-'
                const key = `${lot.product_id}_${unit}`
                if (!stats[key]) {
                    stats[key] = {
                        productName: lot.products.name || 'Sản phẩm không tên',
                        sku: lot.products.sku || '-',
                        totalQty: 0,
                        newInQty: 0,
                        mergedInQty: 0,
                        mergedOutQty: 0,
                        unit: unit,
                        lotCount: 0,
                        productions: {}
                    }
                }
                const qty = Number((lot as any).quantity) || 0;
                stats[key].newInQty += qty;
                stats[key].totalQty += qty;
                stats[key].lotCount += 1;
                const prodCode = lot.productions?.code || lot.production_code || 'NO_CODE'
                const prodName = lot.productions?.name || ''
                const prodLabel = prodName ? `${prodCode} | ${prodName}` : prodCode
                stats[key].productions[prodLabel] = (stats[key].productions[prodLabel] || 0) + qty;
            }
        })
        
        return Object.values(stats).sort((a: any, b: any) => b.totalQty - a.totalQty)
    }, [reportDataInward])

    const summaryOutward = useMemo(() => {
        const stats: Record<string, { 
            productName: string, 
            sku: string, 
            totalQty: number, 
            unit: string, 
            lotCount: number,
            productions: Record<string, number>
        }> = {}
        
        reportDataOutward.forEach(row => {
            const unit = row.unit || '-'
            const key = `${row.product_id}_${unit}`
            if (!stats[key]) {
                stats[key] = {
                    productName: row.product_name,
                    sku: row.product_sku,
                    totalQty: 0,
                    unit: unit,
                    lotCount: 0,
                    productions: {}
                }
            }
            const qty = (Number(row.quantity) || 0)
            stats[key].totalQty += qty
            stats[key].lotCount += 1

            const prodCode = row.production_code || 'NO_CODE'
            const prodName = row.production_name || ''
            const prodLabel = prodName ? `${prodCode} | ${prodName}` : prodCode
            stats[key].productions[prodLabel] = (stats[key].productions[prodLabel] || 0) + qty
        })
        
        return Object.values(stats).sort((a, b) => b.totalQty - a.totalQty)
    }, [reportDataOutward])

    const summaryUnassigned = useMemo(() => {
        const statsMap = {}
        reportDataUnassigned.forEach(lot => {
            const items = lot.lot_items || []
            items.forEach((item) => {
                const unit = item.unit || item.products?.unit || '-'
                const key = `${item.product_id}_${unit}`
                if (!statsMap[key]) {
                    statsMap[key] = { productName: item.products?.name || 'Sản phẩm không tên', sku: item.products?.sku || '-', totalQty: 0, unit: unit, lotCount: 0 }
                }
                statsMap[key].totalQty += (Number(item.quantity) || 0)
                statsMap[key].lotCount += 1
            })
            if (items.length === 0 && lot.products) {
                const unit = lot.unit || lot.products.unit || '-'
                const key = `${lot.product_id}_${unit}`
                if (!statsMap[key]) {
                    statsMap[key] = { productName: lot.products.name || 'Sản phẩm không tên', sku: lot.products.sku || '-', totalQty: 0, unit: unit, lotCount: 0 }
                }
                statsMap[key].totalQty += (Number(lot.quantity) || 0)
                statsMap[key].lotCount += 1
            }
        })
        return Object.values(statsMap).sort((a, b) => b.totalQty - a.totalQty)
    }, [reportDataUnassigned])

    const handleExportExcel = async () => {
        const currentData = activeTab === 'inward' ? reportDataInward : activeTab === 'outward' ? reportDataOutward : reportDataUnassigned
        if (currentData.length === 0) {
            showToast('Không có dữ liệu để xuất Excel', 'warning')
            return
        }

        try {
            const ExcelJS = (await import('exceljs')).default
            const workbook = new ExcelJS.Workbook()
            const worksheet = workbook.addWorksheet(
                activeTab === 'inward' 
                    ? 'Báo cáo Nhập LOT' 
                    : activeTab === 'outward' 
                        ? 'Báo cáo Xuất LOT' 
                        : 'LOT Chưa Có Vị Trí'
            )

            // Header definition based on tab
            if (activeTab === 'inward') {
                worksheet.columns = [
                    { header: 'STT', key: 'stt', width: 5 },
                    { header: 'STT LOT', key: 'daily_seq', width: 10 },
                    { header: 'NGÀY NHẬP', key: 'date', width: 15 },
                    { header: 'MÃ LOT SX', key: 'prod_code', width: 25 },
                    { header: 'SẢN PHẨM', key: 'product', width: 40 },
                    { header: 'SỐ LƯỢNG', key: 'qty', width: 12 },
                    { header: 'ĐƠN VỊ', key: 'unit', width: 10 },
                    { header: 'VỊ TRÍ', key: 'position', width: 15 }
                ]
            } else if (activeTab === 'outward') {
                worksheet.columns = [
                    { header: 'STT', key: 'stt', width: 5 },
                    { header: 'STT LOT', key: 'daily_seq', width: 10 },
                    { header: 'NGÀY XUẤT', key: 'date', width: 15 },
                    { header: 'MÃ LOT SX', key: 'prod_code', width: 25 },
                    { header: 'SẢN PHẨM', key: 'product', width: 40 },
                    { header: 'SỐ LƯỢNG', key: 'qty', width: 12 },
                    { header: 'ĐƠN VỊ', key: 'unit', width: 10 },
                    { header: 'MÃ LỆNH SX', key: 'customer', width: 25 },
                    { header: 'GHI CHÚ', key: 'description', width: 25 }
                ]
            } else {
                worksheet.columns = [
                    { header: 'STT', key: 'stt', width: 5 },
                    { header: 'STT LOT', key: 'daily_seq', width: 10 },
                    { header: 'NGÀY TẠO', key: 'date', width: 15 },
                    { header: 'MÃ LOT SX', key: 'prod_code', width: 25 },
                    { header: 'SẢN PHẨM', key: 'product', width: 40 },
                    { header: 'SỐ LƯỢNG', key: 'qty', width: 12 },
                    { header: 'ĐƠN VỊ', key: 'unit', width: 10 },
                    { header: 'TRẠNG THÁI', key: 'position', width: 15 }
                ]
            }

            // Xóa hàng header mặc định tự động tạo bởi ExcelJS
            worksheet.getRow(1).values = []

            // Header Styling
            let currentRow = 1

            // 1. Company Info
            if (companyInfo) {
                const lastCellChar = String.fromCharCode(65 + worksheet.columns.length - 1)
                
                worksheet.mergeCells(`A${currentRow}:${lastCellChar}${currentRow}`)
                const nameCell = worksheet.getCell(`A${currentRow}`)
                nameCell.value = companyInfo.name?.toUpperCase()
                nameCell.font = { bold: true, size: 10 }
                currentRow++

                worksheet.mergeCells(`A${currentRow}:${lastCellChar}${currentRow}`)
                const addrCell = worksheet.getCell(`A${currentRow}`)
                addrCell.value = `Địa chỉ: ${companyInfo.address || ''}`
                addrCell.font = { size: 9 }
                currentRow++

                worksheet.mergeCells(`A${currentRow}:${lastCellChar}${currentRow}`)
                const contactCell = worksheet.getCell(`A${currentRow}`)
                contactCell.value = `ĐT: ${companyInfo.phone || ''} ${companyInfo.email ? `| Email: ${companyInfo.email}` : ''}`
                contactCell.font = { size: 9 }
                currentRow++
            }

            currentRow++ // Spacer

            // 2. Report Title
            const lastColChar = String.fromCharCode(65 + worksheet.columns.length - 1)
            worksheet.mergeCells(`A${currentRow}:${lastColChar}${currentRow}`)
            const titleCell = worksheet.getCell(`A${currentRow}`)
            titleCell.value = activeTab === 'inward' ? 'BÁO CÁO NHẬP KHO LOT' : activeTab === 'outward' ? 'BÁO CÁO XUẤT KHO LOT' : 'BÁO CÁO LOT CHƯA GÁN VỊ TRÍ'
            titleCell.font = { bold: true, size: 16 }
            titleCell.alignment = { horizontal: 'center' }
            currentRow++

            // 3. Date Range Info
            worksheet.mergeCells(`A${currentRow}:${lastColChar}${currentRow}`)
            const dateRangeCell = worksheet.getCell(`A${currentRow}`)
            dateRangeCell.value = activeTab !== 'unassigned'
                ? `Từ ngày: ${format(new Date(startDate), 'dd/MM/yyyy')} đến ngày: ${format(new Date(endDate), 'dd/MM/yyyy')}`
                : `Thời điểm xuất báo cáo: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`
            dateRangeCell.alignment = { horizontal: 'center' }
            dateRangeCell.font = { italic: true }
            currentRow++

            // 4. Warehouse system info
            if (currentSystem) {
                const whCell = worksheet.getCell(`A${currentRow}`)
                whCell.value = `Hệ thống/Kho: ${currentSystem.name || currentSystem.code}`
                whCell.font = { bold: true }
                currentRow++
            }

            currentRow++ // Spacer before table header

            // 5. Build Table Header manually at currentRow
            const headerRow = worksheet.getRow(currentRow)
            headerRow.values = worksheet.columns.map(c => String(c.header || ''))
            headerRow.eachCell((cell) => {
                cell.font = { bold: true }
                cell.alignment = { vertical: 'middle', horizontal: 'center' }
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                }
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'F2F2F2' }
                }
            })
            currentRow++

            // Add rows based on tab
            if (activeTab === 'inward') {
                const dateGroups: Record<string, Record<string, { production_code: string, production_name?: string, lots: any[] }>> = {}
                
                reportDataInward.forEach(lot => {
                    const dateStr = format(new Date(lot.inbound_date || lot.created_at), 'dd/MM/yyyy')
                    const prodCode = lot.production_code || lot.productions?.code || 'NO_PROD'
                    const prodName = lot.productions?.name || ''
                    
                    if (!dateGroups[dateStr]) dateGroups[dateStr] = {}
                    if (!dateGroups[dateStr][prodCode]) {
                        dateGroups[dateStr][prodCode] = {
                            production_code: prodCode === 'NO_PROD' ? 'Không xác định' : prodCode,
                            production_name: prodName,
                            lots: []
                        }
                    }
                    dateGroups[dateStr][prodCode].lots.push(lot)
                })

                // Sort dates (ascending for Excel)
                const sortedDates = Object.keys(dateGroups).sort((a, b) => {
                    const [d1, m1, y1] = a.split('/')
                    const [d2, m2, y2] = b.split('/')
                    return new Date(`${y1}-${m1}-${d1}`).getTime() - new Date(`${y2}-${m2}-${d2}`).getTime()
                })

                sortedDates.forEach(dateStr => {
                    // Add Date Header Row
                    const dateHeaderRow = worksheet.addRow([`NGÀY: ${dateStr}`])
                    worksheet.mergeCells(`A${dateHeaderRow.number}:H${dateHeaderRow.number}`)
                    dateHeaderRow.eachCell((cell) => {
                        cell.font = { bold: true, size: 12, color: { argb: 'FFFFFF' } }
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4F81BD' } } // Blue background
                        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
                    })

                    Object.values(dateGroups[dateStr]).forEach((group: any) => {
                        // Add Group Header Row
                        const productionLabel = group.production_name || group.production_code || 'Không xác định'
                        const groupHeaderRow = worksheet.addRow([`  LỆNH SẢN XUẤT: ${productionLabel}`])
                        worksheet.mergeCells(`A${groupHeaderRow.number}:H${groupHeaderRow.number}`)
                        groupHeaderRow.eachCell((cell) => {
                            cell.font = { bold: true, size: 11, color: { argb: '000000' } }
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2CC' } }
                            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
                        })

                        let itemIndex = 1
                        group.lots.forEach((lot: any) => {
                            const posStr = lot.positions?.map((p: any) => p.code).join(', ') || '-'
                            
                            if (lot.lot_items && lot.lot_items.length > 0) {
                                lot.lot_items.forEach((item: any, itemIdx: number) => {
                                    const sxLotCode = productionLotsMap[`${lot.production_id}_${item.product_id}`] || lot.batch_code || lot.production_code || lot.productions?.code || '-'
                                    const itemHist = lot.metadata?.system_history?.item_history?.[item.id];
                                    let productDisplay = item.products?.name || '-';
                                    if (itemHist?.type === 'merge' || itemHist?.type === 'split') {
                                        const oDate = itemHist.snapshot?.inbound_date || itemHist.snapshot?.created_at || itemHist.merge_date;
                                        const typeLabel = itemHist.type === 'merge' ? 'GỘP' : 'TÁCH';
                                        const dateLabel = oDate ? ` (${format(new Date(oDate), 'dd/MM')})` : '';
                                        const sourceLabel = itemHist.source_code ? ` từ ${itemHist.source_code}` : '';
                                        productDisplay += ` [${typeLabel}${dateLabel}${sourceLabel}]`;
                                    }

                                    const row = worksheet.addRow({
                                        stt: itemIdx === 0 ? itemIndex++ : '',
                                        daily_seq: itemIdx === 0 ? (decodeSTT(lot.daily_seq) || '-') : '',
                                        date: itemIdx === 0 ? dateStr : '',
                                        prod_code: itemIdx === 0 ? `${sxLotCode}${lot.code ? ` (${lot.code})` : ''}` : '',
                                        product: productDisplay,
                                        qty: item.quantity,
                                        unit: item.unit || item.products?.unit || '-',
                                        position: itemIdx === 0 ? posStr : ''
                                    })
                                    row.eachCell((cell, colNumber) => {
                                        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
                                        if (colNumber === 6) {
                                            cell.alignment = { horizontal: 'right' }
                                            cell.numFmt = '#,##0'
                                        }
                                    })
                                })
                            } else if (lot.products) {
                                const sxLotCode = productionLotsMap[`${lot.production_id}_${lot.product_id}`] || lot.batch_code || lot.production_code || lot.productions?.code || '-'
                                const row = worksheet.addRow({
                                    stt: itemIndex++,
                                    daily_seq: decodeSTT(lot.daily_seq) || '-',
                                    date: dateStr,
                                    prod_code: `${sxLotCode}${lot.code ? ` (${lot.code})` : ''}`,
                                    product: lot.products.name || '-',
                                    qty: (lot as any).quantity || 0,
                                    unit: (lot as any).unit || lot.products.unit || '-',
                                    position: posStr
                                })
                                row.eachCell((cell, colNumber) => {
                                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
                                    if (colNumber === 6) {
                                        cell.alignment = { horizontal: 'right' }
                                        cell.numFmt = '#,##0'
                                    }
                                })
                            }
                        })
                    })
                })
            } else if (activeTab === 'outward') {
                // Outward export
                const dateGroups: Record<string, Record<string, { production_code: string, production_name?: string, rows: any[] }>> = {}

                reportDataOutward.forEach(row => {
                    const dateStr = format(new Date(row.date), 'dd/MM/yyyy')
                    const prodCode = row.production_code || 'NO_PROD'
                    const prodName = row.production_name || ''

                    if (!dateGroups[dateStr]) dateGroups[dateStr] = {}
                    if (!dateGroups[dateStr][prodCode]) {
                        dateGroups[dateStr][prodCode] = {
                            production_code: prodCode === 'NO_PROD' ? 'Không xác định' : prodCode,
                            production_name: prodName,
                            rows: []
                        }
                    }
                    dateGroups[dateStr][prodCode].rows.push(row)
                })

                // Sort dates
                const sortedDates = Object.keys(dateGroups).sort((a, b) => {
                    const [d1, m1, y1] = a.split('/')
                    const [d2, m2, y2] = b.split('/')
                    return new Date(`${y1}-${m1}-${d1}`).getTime() - new Date(`${y2}-${m2}-${d2}`).getTime()
                })

                sortedDates.forEach(dateStr => {
                    // Add Date Header Row
                    const dateHeaderRow = worksheet.addRow([`NGÀY: ${dateStr}`])
                    worksheet.mergeCells(`A${dateHeaderRow.number}:I${dateHeaderRow.number}`) // 9 columns for outward
                    dateHeaderRow.eachCell((cell) => {
                        cell.font = { bold: true, size: 12, color: { argb: 'FFFFFF' } }
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4F81BD' } }
                        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
                    })

                    Object.values(dateGroups[dateStr]).forEach((group: any) => {
                        const productionLabel = group.production_name || group.production_code || 'Không xác định'
                        const groupHeaderRow = worksheet.addRow([`  LỆNH SẢN XUẤT: ${productionLabel}`])
                        worksheet.mergeCells(`A${groupHeaderRow.number}:I${groupHeaderRow.number}`)
                        groupHeaderRow.eachCell((cell) => {
                            cell.font = { bold: true, size: 11, color: { argb: '000000' } }
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2CC' } }
                            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
                        })

                        let itemIndex = 1
                        group.rows.forEach((row: any) => {
                            const sxLotCode = productionLotsMap[`${row.production_id}_${row.product_id}`] || '-'
                            const excelRow = worksheet.addRow({
                                stt: itemIndex++,
                                daily_seq: decodeSTT(row.daily_seq) || '-',
                                date: dateStr,
                                prod_code: `${sxLotCode}${row.lot_code ? ` (${row.lot_code})` : ''}`,
                                product: row.product_name,
                                qty: row.quantity,
                                unit: row.unit,
                                customer: `${row.production_code || ''} - ${row.production_name || ''}`.trim().replace(/^ - | - $/, '') || '-',
                                description: row.description
                            })
                            excelRow.eachCell((cell, colNumber) => {
                                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
                                if (colNumber === 6) {
                                    cell.alignment = { horizontal: 'right' }
                                    cell.numFmt = '#,##0'
                                }
                            })
                        })
                    })
                })
            } else {
                // unassigned lots mapping
                let itemIndex = 1
                reportDataUnassigned.forEach((lot: any) => {
                    const dateStr = format(new Date(lot.created_at), 'dd/MM/yyyy')
                    if (lot.lot_items && lot.lot_items.length > 0) {
                        lot.lot_items.forEach((item, itemIdx) => {
                            const sxLotCode = productionLotsMap[`${lot.production_id}_${item.product_id}`] || lot.batch_code || lot.production_code || lot.productions?.code || '-'
                            const row = worksheet.addRow({
                                stt: itemIdx === 0 ? itemIndex++ : '',
                                daily_seq: itemIdx === 0 ? (decodeSTT(lot.daily_seq) || '-') : '',
                                date: itemIdx === 0 ? dateStr : '',
                                prod_code: itemIdx === 0 ? `${sxLotCode}${lot.code ? ` (${lot.code})` : ''}` : '',
                                product: item.products?.name || '-',
                                qty: item.quantity,
                                unit: item.unit || item.products?.unit || '-',
                                position: itemIdx === 0 ? 'Chưa gán vị trí' : ''
                            })
                            row.eachCell((cell, colNumber) => {
                                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
                                if (colNumber === 6) {
                                    cell.alignment = { horizontal: 'right' }
                                    cell.numFmt = '#,##0'
                                }
                                if (colNumber === 8 && cell.value === 'Chưa gán vị trí') {
                                    cell.font = { color: { argb: 'FF0000' }, bold: true }
                                }
                            })
                        })
                    } else if (lot.products) {
                        const sxLotCode = productionLotsMap[`${lot.production_id}_${lot.product_id}`] || lot.batch_code || lot.production_code || lot.productions?.code || '-'
                        const row = worksheet.addRow({
                            stt: itemIndex++,
                            daily_seq: decodeSTT(lot.daily_seq) || '-',
                            date: dateStr,
                            prod_code: `${sxLotCode}${lot.code ? ` (${lot.code})` : ''}`,
                            product: lot.products.name || '-',
                            qty: lot.quantity || 0,
                            unit: lot.unit || lot.products.unit || '-',
                            position: 'Chưa gán vị trí'
                        })
                        row.eachCell((cell, colNumber) => {
                            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
                            if (colNumber === 6) {
                                cell.alignment = { horizontal: 'right' }
                                cell.numFmt = '#,##0'
                            }
                            if (colNumber === 8) {
                                cell.font = { color: { argb: 'FF0000' }, bold: true }
                            }
                        })
                    }
                })
            }
            
            // Add Statistics Sheet
            const statsSheet = workbook.addWorksheet(
                activeTab === 'inward' 
                    ? 'Thống kê Nhập' 
                    : activeTab === 'outward' 
                        ? 'Thống kê Xuất' 
                        : 'Thống kê Chưa Vị Trí'
            )
            if (activeTab === 'inward') {
                statsSheet.columns = [
                    { header: 'STT', key: 'stt', width: 5 },
                    { header: 'SẢN PHẨM', key: 'product', width: 40 },
                    { header: 'TỔNG SẢN LƯỢNG', key: 'totalQty', width: 20 },
                    { header: 'ĐƠN VỊ', key: 'unit', width: 10 },
                    { header: 'NHẬP MỚI', key: 'newIn', width: 15 },
                    { header: 'GỘP VÀO', key: 'mergedIn', width: 15 },
                    { header: 'GỘP ĐI', key: 'mergedOut', width: 15 }
                ]
                statsSheet.getRow(1).eachCell(cell => {
                    cell.font = { bold: true }
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F2F2F2' } }
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
                    cell.alignment = { horizontal: 'center' }
                })

                const statsByDate: Record<string, Record<string, Record<string, any>>> = {}

                reportDataInward.forEach(lot => {
                    const dateStr = format(new Date(lot.inbound_date || lot.created_at), 'dd/MM/yyyy')
                    if (!statsByDate[dateStr]) statsByDate[dateStr] = {}

                    const items = lot.lot_items || []
                    const mergedOut = lot.metadata?.system_history?.merged_out || []
                    const processedPids = new Set<string>()

                    const mergedOutByPid: Record<string, number> = {}
                    const mergedOutUnitByPid: Record<string, string> = {}
                    if (Array.isArray(mergedOut)) {
                        mergedOut.forEach((mo: any) => {
                            const moPid = mo.product_id || lot.product_id
                            if (moPid) {
                                mergedOutByPid[moPid] = (mergedOutByPid[moPid] || 0) + (Number(mo.quantity) || 0)
                                if (!mergedOutUnitByPid[moPid] && (mo.product_unit || mo.unit)) {
                                    mergedOutUnitByPid[moPid] = mo.product_unit || mo.unit
                                }
                            }
                        })
                    }

                    const mergedOutAccountedPids = new Set<string>()
                    const prodCode = lot.productions?.code || lot.production_code || 'NO_CODE'
                    const prodName = lot.productions?.name || ''
                    const prodLabel = prodName ? `${prodCode} | ${prodName}` : prodCode
                    if (!statsByDate[dateStr][prodLabel]) statsByDate[dateStr][prodLabel] = {}
                    
                    const prodStats = statsByDate[dateStr][prodLabel]

                    items.forEach((item: any) => {
                        const baseUnit = item.unit || item.products?.unit || '-'
                        const unit = mergedOutUnitByPid[item.product_id] || baseUnit
                        const key = `${item.product_id}_${unit}`
                        
                        if (!prodStats[key]) {
                            prodStats[key] = { productName: item.products?.name || 'Sản phẩm không tên', totalQty: 0, newInQty: 0, mergedInQty: 0, mergedOutQty: 0, unit: unit }
                        }

                        const hist = lot.metadata?.system_history?.item_history?.[item.id]
                        const isMergedIn = hist?.type === 'merge' || hist?.type === 'split'
                        const currentQty = Number(item.quantity) || 0
                        
                        let itemMergedOutQty = 0
                        if (!mergedOutAccountedPids.has(item.product_id) && mergedOutByPid[item.product_id]) {
                            itemMergedOutQty = mergedOutByPid[item.product_id]
                            mergedOutAccountedPids.add(item.product_id)
                        }

                        if (isMergedIn) {
                            prodStats[key].mergedInQty += currentQty
                        } else {
                            prodStats[key].newInQty += currentQty
                        }
                        
                        prodStats[key].mergedOutQty += itemMergedOutQty
                        prodStats[key].totalQty += (currentQty + itemMergedOutQty)
                        processedPids.add(item.product_id)
                    })

                    if (Array.isArray(mergedOut)) {
                        const allMergedPids: string[] = []
                        mergedOut.forEach((mo: any) => {
                            const moPid = mo.product_id || lot.product_id
                            if (moPid && !allMergedPids.includes(moPid)) allMergedPids.push(moPid)
                        })
                        
                        allMergedPids.forEach((pid: string) => {
                            if (!processedPids.has(pid)) {
                                const productMergedInfo = mergedOut.filter((mo: any) => (mo.product_id || lot.product_id) === pid)
                                const totalMergedQty = productMergedInfo.reduce((acc: number, cur: any) => acc + (Number(cur.quantity) || 0), 0)
                                const productSample = lot.products?.id === pid ? lot.products : null
                                const unit = productSample?.unit || productMergedInfo[0]?.product_unit || productMergedInfo[0]?.unit || '-'
                                const key = `${pid}_${unit}`
                                
                                if (!prodStats[key]) {
                                    prodStats[key] = { productName: productSample?.name || productMergedInfo[0]?.product_name || 'Sản phẩm đã gộp hết', totalQty: 0, newInQty: 0, mergedInQty: 0, mergedOutQty: 0, unit: unit }
                                }
                                
                                prodStats[key].newInQty += totalMergedQty
                                prodStats[key].mergedOutQty += totalMergedQty
                                prodStats[key].totalQty += totalMergedQty
                                processedPids.add(pid)
                            }
                        })
                    }

                    if (processedPids.size === 0 && lot.products) {
                        const unit = (lot as any).unit || lot.products.unit || '-'
                        const key = `${lot.product_id}_${unit}`
                        if (!prodStats[key]) {
                            prodStats[key] = { productName: lot.products.name || 'Sản phẩm không tên', totalQty: 0, newInQty: 0, mergedInQty: 0, mergedOutQty: 0, unit: unit }
                        }
                        const qty = Number((lot as any).quantity) || 0
                        prodStats[key].newInQty += qty
                        prodStats[key].totalQty += qty
                    }
                })

                // Fill stats sheet inward
                const sortedDates = Object.keys(statsByDate).sort((a, b) => {
                    const [d1, m1, y1] = a.split('/')
                    const [d2, m2, y2] = b.split('/')
                    return new Date(`${y1}-${m1}-${d1}`).getTime() - new Date(`${y2}-${m2}-${d2}`).getTime()
                })

                sortedDates.forEach(dateStr => {
                    const dateHeaderRow = statsSheet.addRow([`NGÀY: ${dateStr}`])
                    statsSheet.mergeCells(`A${dateHeaderRow.number}:G${dateHeaderRow.number}`) // 7 columns
                    dateHeaderRow.eachCell((cell) => {
                        cell.font = { bold: true, size: 12, color: { argb: 'FFFFFF' } }
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4F81BD' } }
                        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
                    })

                    Object.keys(statsByDate[dateStr]).sort().forEach(prodLabel => {
                        const prodHeaderRow = statsSheet.addRow([`  LỆNH SẢN XUẤT: ${prodLabel === 'NO_CODE' ? 'Không xác định' : prodLabel}`])
                        statsSheet.mergeCells(`A${prodHeaderRow.number}:G${prodHeaderRow.number}`)
                        prodHeaderRow.eachCell((cell) => {
                            cell.font = { bold: true, size: 11, color: { argb: '000000' } }
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2CC' } }
                            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
                        })

                        let stt = 1
                        const products = Object.values(statsByDate[dateStr][prodLabel]) as any[]
                        products.sort((a, b) => b.totalQty - a.totalQty).forEach((p: any) => {
                            const row = statsSheet.addRow({
                                stt: stt++,
                                product: p.productName,
                                totalQty: p.totalQty,
                                unit: p.unit,
                                newIn: p.newInQty,
                                mergedIn: p.mergedInQty,
                                mergedOut: p.mergedOutQty
                            })
                            row.eachCell((cell, colNum) => {
                                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
                                if ([3, 5, 6, 7].includes(colNum)) {
                                    cell.alignment = { horizontal: 'right' }
                                    cell.numFmt = '#,##0'
                                    if (colNum === 3) cell.font = { bold: true, color: { argb: 'FF6600' } }
                                    if (colNum === 5 && p.newInQty > 0) cell.font = { color: { argb: '008000' } }
                                    if (colNum === 6 && p.mergedInQty > 0) cell.font = { color: { argb: '0000FF' } }
                                    if (colNum === 7 && p.mergedOutQty > 0) cell.font = { color: { argb: 'FF0000' } }
                                }
                            })
                        })
                    })
                })
            } else if (activeTab === 'outward') {
                // Outward Stats
                statsSheet.columns = [
                    { header: 'STT', key: 'stt', width: 5 },
                    { header: 'SẢN PHẨM', key: 'product', width: 40 },
                    { header: 'TỔNG SẢN LƯỢNG', key: 'totalQty', width: 20 },
                    { header: 'ĐƠN VỊ', key: 'unit', width: 10 }
                ]
                statsSheet.getRow(1).eachCell(cell => {
                    cell.font = { bold: true }
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F2F2F2' } }
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
                    cell.alignment = { horizontal: 'center' }
                })

                const statsByDate: Record<string, Record<string, Record<string, any>>> = {}

                reportDataOutward.forEach(row => {
                    const dateStr = format(new Date(row.date), 'dd/MM/yyyy')
                    if (!statsByDate[dateStr]) statsByDate[dateStr] = {}

                    const prodCode = row.production_code || 'NO_CODE'
                    const prodName = row.production_name || ''
                    const prodLabel = prodName ? `${prodCode} | ${prodName}` : prodCode
                    
                    if (!statsByDate[dateStr][prodLabel]) statsByDate[dateStr][prodLabel] = {}
                    const prodStats = statsByDate[dateStr][prodLabel]

                    const unit = row.unit || '-'
                    const key = `${row.product_id}_${unit}`
                    if (!prodStats[key]) {
                        prodStats[key] = { productName: row.product_name, totalQty: 0, unit: unit }
                    }
                    prodStats[key].totalQty += (Number(row.quantity) || 0)
                })

                // Fill stats sheet outward
                const sortedDates = Object.keys(statsByDate).sort((a, b) => {
                    const [d1, m1, y1] = a.split('/')
                    const [d2, m2, y2] = b.split('/')
                    return new Date(`${y1}-${m1}-${d1}`).getTime() - new Date(`${y2}-${m2}-${d2}`).getTime()
                })

                sortedDates.forEach(dateStr => {
                    const dateHeaderRow = statsSheet.addRow([`NGÀY: ${dateStr}`])
                    statsSheet.mergeCells(`A${dateHeaderRow.number}:D${dateHeaderRow.number}`) // 4 columns
                    dateHeaderRow.eachCell((cell) => {
                        cell.font = { bold: true, size: 12, color: { argb: 'FFFFFF' } }
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4F81BD' } }
                        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
                    })

                    Object.keys(statsByDate[dateStr]).sort().forEach(prodLabel => {
                        const prodHeaderRow = statsSheet.addRow([`  LỆNH SẢN XUẤT: ${prodLabel === 'NO_CODE' ? 'Không xác định' : prodLabel}`])
                        statsSheet.mergeCells(`A${prodHeaderRow.number}:D${prodHeaderRow.number}`)
                        prodHeaderRow.eachCell((cell) => {
                            cell.font = { bold: true, size: 11, color: { argb: '000000' } }
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2CC' } }
                            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
                        })

                        let stt = 1
                        const products = Object.values(statsByDate[dateStr][prodLabel]) as any[]
                        products.sort((a, b) => b.totalQty - a.totalQty).forEach((p: any) => {
                            const row = statsSheet.addRow({
                                stt: stt++,
                                product: p.productName,
                                totalQty: p.totalQty,
                                unit: p.unit
                            })
                                                        row.eachCell((cell, colNum) => {
                                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
                                if (colNum === 3) {
                                    cell.alignment = { horizontal: 'right' }
                                    cell.numFmt = '#,##0'
                                    cell.font = { bold: true, color: { argb: '008000' } }
                                }
                            })
                        })
                    })
                })
            } else {
                // unassigned stats
                statsSheet.columns = [
                    { header: 'STT', key: 'stt', width: 5 },
                    { header: 'SẢN PHẨM', key: 'product', width: 40 },
                    { header: 'TỔNG SẢN LƯỢNG', key: 'totalQty', width: 20 },
                    { header: 'ĐƠN VỊ', key: 'unit', width: 10 }
                ]
                statsSheet.getRow(1).eachCell(cell => {
                    cell.font = { bold: true }
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F2F2F2' } }
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
                    cell.alignment = { horizontal: 'center' }
                })

                const stats = {}
                reportDataUnassigned.forEach(lot => {
                    const items = lot.lot_items || []
                    items.forEach((item) => {
                        const unit = item.unit || item.products?.unit || '-'
                        const key = `${item.product_id}_${unit}`
                        if (!stats[key]) {
                            stats[key] = { productName: item.products?.name || 'Sản phẩm không tên', totalQty: 0, unit: unit }
                        }
                        stats[key].totalQty += (Number(item.quantity) || 0)
                    })
                    if (items.length === 0 && lot.products) {
                        const unit = lot.unit || lot.products.unit || '-'
                        const key = `${lot.product_id}_${unit}`
                        if (!stats[key]) {
                            stats[key] = { productName: lot.products.name || 'Sản phẩm không tên', totalQty: 0, unit: unit }
                        }
                        stats[key].totalQty += (Number(lot.quantity) || 0)
                    }
                })

                let stt = 1
                Object.values(stats).sort((a, b) => b.totalQty - a.totalQty).forEach((p) => {
                    const row = statsSheet.addRow({
                        stt: stt++,
                        product: p.productName,
                        totalQty: p.totalQty,
                        unit: p.unit
                    })
                    row.eachCell((cell, colNum) => {
                        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
                        if (colNum === 3) {
                            cell.alignment = { horizontal: 'right' }
                            cell.numFmt = '#,##0'
                            cell.font = { bold: true, color: { argb: 'FF0000' } }
                        }
                    })
                })
            }

            // 6. Signature section
            let lastRowNumber = worksheet.lastRow ? worksheet.lastRow.number : currentRow
            currentRow = lastRowNumber + 3
            
            const signDateRow = worksheet.getRow(currentRow)
            const lastColIdx = worksheet.columns.length
            signDateRow.getCell(lastColIdx - 1).value = `Ngày ...... tháng ...... năm ......`
            signDateRow.getCell(lastColIdx - 1).font = { italic: true }
            currentRow++

            const signTitleRow = worksheet.getRow(currentRow)
            signTitleRow.getCell(2).value = 'Người Lập Biểu'
            signTitleRow.getCell(Math.floor(lastColIdx / 2) + 1).value = 'Thủ Kho'
            signTitleRow.getCell(lastColIdx - 1).value = 'Giám Đốc'
            signTitleRow.eachCell(cell => { 
                cell.font = { bold: true }
                cell.alignment = { horizontal: 'center' }
            })

            const buffer = await workbook.xlsx.writeBuffer()
            const fileName = `Bao_cao_${activeTab === 'inward' ? 'Nhap' : activeTab === 'outward' ? 'Xuat' : 'Chua_Vi_Tri'}_LOT_${startDate}_to_${endDate}.xlsx`
            saveAs(new Blob([buffer]), fileName)
            showToast('Đã xuất file Excel thành công', 'success')
        } catch (err: any) {
            console.error('Excel export error:', err)
            showToast('Lỗi xuất Excel: ' + err.message, 'error')
        }
    }

    const handlePrint = (orientation: 'portrait' | 'landscape' = 'portrait') => {
        const currentData = activeTab === 'inward' ? reportDataInward : activeTab === 'outward' ? reportDataOutward : reportDataUnassigned
        if (currentData.length === 0) {
            showToast('Không có dữ liệu để in', 'warning')
            return
        }
        
        const printContent = document.getElementById('printable-report-area');
        if (!printContent) return;

        // Trích xuất toàn bộ CSS hiện hành của Tailwind để bảo toàn định dạng
        const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
            .map(node => node.outerHTML)
            .join('\n');

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            showToast('Trình duyệt đã chặn cửa sổ Popup. Vui lòng cho phép hiện Popup để tiến hành in.', 'warning');
            return;
        }

        const htmlData = `
            <!DOCTYPE html>
            <html lang="vi">
                <head>
                    <meta charset="utf-8">
                    <title>In Báo Cáo Tổng Hợp LOT</title>
                    ${styles}
                    <style>
                        @media print {
                            @page { size: A4 ${orientation}; margin: 15mm; }
                            body { font-family: "Times New Roman", Times, serif !important; background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; padding: 0 !important; margin: 0 !important; }
                            .no-print { display: none !important; }
                            
                            /* Force table styles for absolute safety */
                            table { width: 100% !important; border-collapse: collapse !important; table-layout: auto !important; margin-bottom: 2rem !important; }
                            th, td { border: 1px solid #000 !important; padding: 8px 6px !important; font-size: 11pt !important; color: black !important; font-family: "Times New Roman", Times, serif !important; }
                            th { background-color: #f2f2f2 !important; font-weight: bold !important; }
                            tr { page-break-inside: avoid !important; }
                            thead { display: table-header-group !important; }
                            
                            .print-only { display: block !important; visibility: visible !important; }
                        }
                        /* Base screen styles for the popup window before printing starts */
                        body { background: white; padding: 40px; color: black; font-family: "Times New Roman", Times, serif !important; }
                        .print-only { display: block !important; }
                        .no-print { display: none !important; }
                        table { width: 100%; border-collapse: collapse; font-family: "Times New Roman", Times, serif; }
                        th, td { border: 1px solid #000; padding: 8px; font-size: 14pt; }
                        th { background: #f8fafc; font-weight: bold; }
                    </style>
                </head>
                <body class="bg-white text-black h-auto overflow-visible" style="font-family: 'Times New Roman', Times, serif;">
                    ${printContent.innerHTML}
                    <script>
                        setTimeout(() => {
                            window.focus();
                            window.print();
                        }, 500);
                    </script>
                </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(htmlData);
        printWindow.document.close();
    }

    return (
        <div id="lot-report-modal-wrapper" className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-[32px] max-w-6xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 pb-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 no-print">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                            <FileText size={24} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                Báo cáo tổng hợp LOT
                            </h3>
                            <p className="text-sm font-medium mt-1 text-slate-500">
                                Kết xuất danh sách biến động LOT trong khoảng ngày đã chọn
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors no-print">
                        <X size={24} className="text-slate-500" />
                    </button>
                </div>

                {/* Tabs & Date Filters */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 space-y-4 no-print border-b border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center p-1 bg-slate-200 dark:bg-slate-800 rounded-2xl w-fit shadow-inner">
                            <button
                                onClick={() => setActiveTab('inward')}
                                className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'inward' 
                                    ? 'bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-md scale-100' 
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 scale-95 opacity-70'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${activeTab === 'inward' ? 'bg-orange-500' : 'bg-slate-400'}`}></div>
                                    DANH SÁCH NHẬP
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab('outward')}
                                className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'outward' 
                                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-md scale-100' 
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 scale-95 opacity-70'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${activeTab === 'outward' ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                                    DANH SÁCH XUẤT
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab('unassigned')}
                                className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'unassigned' 
                                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-md scale-100' 
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 scale-95 opacity-70'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${activeTab === 'unassigned' ? 'bg-indigo-500' : 'bg-slate-400'}`}></div>
                                    LOT CHƯA CÓ VỊ TRÍ
                                </div>
                            </button>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            {activeTab !== 'unassigned' ? (
                                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative">
                                    <Calendar size={16} className="text-orange-500 shrink-0" />
                                    <div className="flex items-center gap-1 sm:gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="bg-transparent border-none p-0 focus:ring-0 outline-none w-[110px] sm:w-[130px] md:w-[145px] text-center"
                                        />
                                        <span className="text-slate-400">→</span>
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="bg-transparent border-none p-0 focus:ring-0 outline-none w-[110px] sm:w-[130px] md:w-[145px] text-center"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/30 px-4 py-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/30 shadow-inner">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400">Hiện trạng thực tế chưa gán vị trí</span>
                                </div>
                            )}
                            <div className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/50 w-fit">
                                {activeTab === 'inward' ? 'Nhập kho: ' : activeTab === 'outward' ? 'Xuất kho: ' : 'Chưa vị trí: '}
                                <span className={`${activeTab === 'inward' ? 'text-orange-600' : 'text-emerald-600'} text-sm sm:text-base ml-1`}>
                                    {activeTab === 'inward' ? reportDataInward.length : activeTab === 'outward' ? reportDataOutward.length : reportDataUnassigned.length}
                                </span> 
                                <span className="ml-0.5">{activeTab === 'inward' ? 'LOT' : activeTab === 'outward' ? 'Dòng' : 'LOT'}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-2 w-full md:w-auto">
                            <button
                                onClick={handleExportExcel}
                                disabled={loading || (activeTab === 'inward' ? reportDataInward.length === 0 : activeTab === 'outward' ? reportDataOutward.length === 0 : reportDataUnassigned.length === 0)}
                                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-black shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:grayscale ${activeTab === 'inward' ? 'bg-orange-600 shadow-orange-600/20' : activeTab === 'outward' ? 'bg-emerald-600 shadow-emerald-600/20' : 'bg-indigo-600 shadow-indigo-600/20'}`}
                            >
                                <Download size={18} />
                                <span className="sm:inline">Excel</span>
                            </button>
                            <div className="flex-1 sm:flex-none flex items-center bg-slate-800 dark:bg-slate-700 rounded-xl overflow-hidden p-0.5 shadow-lg shadow-slate-900/20">
                                <button
                                    onClick={() => handlePrint('portrait')}
                                    disabled={loading || (activeTab === 'inward' ? reportDataInward.length === 0 : activeTab === 'outward' ? reportDataOutward.length === 0 : reportDataUnassigned.length === 0)}
                                    title="In dọc (Portrait)"
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-transparent hover:bg-black text-white text-sm font-bold transition-all disabled:opacity-50"
                                >
                                    <Printer size={16} />
                                    <span className="hidden sm:inline">In dọc</span>
                                </button>
                                <div className="w-px h-5 bg-slate-600 mx-0.5 opacity-50"></div>
                                <button
                                    onClick={() => handlePrint('landscape')}
                                    disabled={loading || (activeTab === 'inward' ? reportDataInward.length === 0 : activeTab === 'outward' ? reportDataOutward.length === 0 : reportDataUnassigned.length === 0)}
                                    title="In ngang (Landscape)"
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-transparent hover:bg-black text-white text-sm font-bold transition-all disabled:opacity-50"
                                >
                                    <Printer size={16} className="rotate-90" />
                                    <span className="hidden sm:inline">In ngang</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <LotReportContent
                    loading={loading}
                    activeTab={activeTab}
                    startDate={startDate}
                    endDate={endDate}
                    reportDataInward={reportDataInward}
                    reportDataOutward={reportDataOutward}
                    reportDataUnassigned={reportDataUnassigned}
                    groupedInwardData={groupedInwardData}
                    productionLotsMap={productionLotsMap}
                    summaryInward={summaryInward}
                    summaryOutward={summaryOutward}
                    summaryUnassigned={summaryUnassigned}
                    companyInfo={companyInfo}
                />
            </div>
        </div>
    )
}
