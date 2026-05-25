/**
 * Hàm tính tổng hợp sản lượng Nhập Mới từ danh sách Lot.
 * Logic CHÍNH XÁC giống summaryInward trong LotReportModal.
 * 
 * Dùng chung cho:
 * - LotReportModal (Báo cáo Lot)
 * - LotReconciliationTable (Đối chiếu Kế toán)
 */

export type ProductNewInSummary = {
    product_id: string
    product_name: string
    newInQty: number          // Số lượng MỚI (chỉ hàng mới, không tính gộp vào)
    mergedInQty: number       // Số lượng gộp vào
    mergedOutQty: number      // Số lượng gộp đi
    totalQty: number          // Tổng = tồn + gộp đi
    unit: string
    lotCodes: string[]        // Các mã lot liên quan
}

/**
 * Tính tổng sản lượng NHẬP MỚI (newInQty) cho mỗi sản phẩm từ danh sách lots.
 * 
 * Logic:
 * 1. Duyệt lot_items: nếu item KHÔNG bị gộp vào (isMergedIn = false) → cộng vào newInQty
 * 2. Sản phẩm đã bị gộp đi HOÀN TOÀN (không còn trong lot_items) → cộng số merged_out vào newInQty
 * 3. Fallback: lot cũ không có lot_items → dùng lot.quantity
 * 
 * Kết quả: Map<product_id, ProductNewInSummary>
 */
export function calculateNewInQtyByProduct(lots: any[]): Map<string, ProductNewInSummary> {
    const resultMap = new Map<string, ProductNewInSummary>()

    lots.forEach(lot => {
        const items = lot.lot_items || []
        const mergedOut = lot.metadata?.system_history?.merged_out || []
        const itemHistory = lot.metadata?.system_history?.item_history || {}
        const processedPids = new Set<string>()

        // Pre-process merged_out: tính tổng qty theo product_id
        const mergedOutByPid: Record<string, number> = {}
        if (Array.isArray(mergedOut)) {
            mergedOut.forEach((mo: any) => {
                const moPid = mo.product_id || lot.product_id
                if (moPid) {
                    mergedOutByPid[moPid] = (mergedOutByPid[moPid] || 0) + (Number(mo.quantity) || 0)
                }
            })
        }

        const mergedOutAccountedPids = new Set<string>()

        // === PHẦN 1: Xử lý hàng hiện có trong lot_items ===
        items.forEach((item: any) => {
            const pid = item.product_id
            if (!pid) return
            processedPids.add(pid)

            const unit = item.unit || item.products?.unit || '-'
            const currentQty = Number(item.quantity) || 0

            // Phân tích nguồn gốc item
            const hist = itemHistory[item.id]
            const isMergedIn = hist?.type === 'merge' || hist?.type === 'split'

            // Tính mergedOutQty MỘT LẦN cho mỗi product_id trong mỗi lot
            let itemMergedOutQty = 0
            if (!mergedOutAccountedPids.has(pid) && mergedOutByPid[pid]) {
                itemMergedOutQty = mergedOutByPid[pid]
                mergedOutAccountedPids.add(pid)
            }

            // Phân loại
            const newIn = isMergedIn ? 0 : currentQty
            const mergedIn = isMergedIn ? currentQty : 0

            // Cộng dồn vào kết quả
            if (!resultMap.has(pid)) {
                resultMap.set(pid, {
                    product_id: pid,
                    product_name: item.products?.name || 'Sản phẩm không tên',
                    newInQty: 0,
                    mergedInQty: 0,
                    mergedOutQty: 0,
                    totalQty: 0,
                    unit: unit,
                    lotCodes: []
                })
            }

            const entry = resultMap.get(pid)!
            entry.newInQty += newIn
            entry.mergedInQty += mergedIn
            entry.mergedOutQty += itemMergedOutQty
            entry.totalQty += (currentQty + itemMergedOutQty)

            if (lot.code && !entry.lotCodes.includes(lot.code)) {
                entry.lotCodes.push(lot.code)
            }
        })

        // === PHẦN 2: Sản phẩm đã bị gộp đi HOÀN TOÀN (không còn item nào cho pid đó) ===
        if (Array.isArray(mergedOut)) {
            const allMergedPids: string[] = []
            mergedOut.forEach((mo: any) => {
                const moPid = mo.product_id || lot.product_id
                if (moPid && !allMergedPids.includes(moPid)) {
                    allMergedPids.push(moPid)
                }
            })

            allMergedPids.forEach((pid: string) => {
                if (!processedPids.has(pid)) {
                    const productMergedInfo = mergedOut.filter((mo: any) => (mo.product_id || lot.product_id) === pid)
                    const totalMergedQty = productMergedInfo.reduce((acc: number, cur: any) => acc + (Number(cur.quantity) || 0), 0)

                    if (totalMergedQty > 0) {
                        const productSample = lot.products?.id === pid ? lot.products : null
                        const unit = productSample?.unit || productMergedInfo[0]?.product_unit || productMergedInfo[0]?.unit || '-'

                        if (!resultMap.has(pid)) {
                            resultMap.set(pid, {
                                product_id: pid,
                                product_name: productSample?.name || productMergedInfo[0]?.product_name || 'Sản phẩm đã gộp hết',
                                newInQty: 0,
                                mergedInQty: 0,
                                mergedOutQty: 0,
                                totalQty: 0,
                                unit: unit,
                                lotCodes: []
                            })
                        }

                        const entry = resultMap.get(pid)!
                        // Giống LotReportModal: cộng vào CẢ newInQty VÀ mergedOutQty
                        entry.newInQty += totalMergedQty
                        entry.mergedOutQty += totalMergedQty
                        entry.totalQty += totalMergedQty

                        if (lot.code && !entry.lotCodes.includes(lot.code)) {
                            entry.lotCodes.push(lot.code)
                        }
                    }
                    processedPids.add(pid)
                }
            })
        }

        // === PHẦN 3: Fallback cho lot cũ (lot.products, không có lot_items) ===
        if (processedPids.size === 0 && lot.products) {
            const pid = lot.product_id
            const unit = (lot as any).unit || lot.products.unit || '-'
            const qty = Number((lot as any).quantity) || 0

            if (pid) {
                if (!resultMap.has(pid)) {
                    resultMap.set(pid, {
                        product_id: pid,
                        product_name: lot.products.name || 'Sản phẩm không tên',
                        newInQty: 0,
                        mergedInQty: 0,
                        mergedOutQty: 0,
                        totalQty: 0,
                        unit: unit,
                        lotCodes: []
                    })
                }

                const entry = resultMap.get(pid)!
                entry.newInQty += qty
                entry.totalQty += qty

                if (lot.code && !entry.lotCodes.includes(lot.code)) {
                    entry.lotCodes.push(lot.code)
                }
            }
        }
    })

    return resultMap
}
