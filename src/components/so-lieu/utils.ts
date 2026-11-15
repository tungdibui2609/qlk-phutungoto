// Hàm helper định dạng ngày giờ cho input datetime-local (theo múi giờ địa phương)
export const formatDateTimeLocal = (d: Date = new Date()) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const y = d.getFullYear()
    const m = pad(d.getMonth() + 1)
    const day = pad(d.getDate())
    const hh = pad(d.getHours())
    const mm = pad(d.getMinutes())
    return `${y}-${m}-${day}T${hh}:${mm}`
}

// Helper làm sạch sai số số thực trong tên đơn vị (ví dụ: "Thùng (9.600000000000001kg)" -> "Thùng (9.6kg)")
export const cleanUnitLabel = (u?: string | null): string => {
    if (!u) return ''
    return u.replace(/\((\d+(?:\.\d+)?)kg\)/gi, (_, numStr) => {
        const cleaned = Number(Number(numStr).toFixed(4))
        return `(${cleaned}kg)`
    })
}

// Helper kiểm tra đơn vị có phải là Thùng không
export const isBoxUnit = (u?: string | null) => {
    if (!u) return false
    const lower = u.trim().toLowerCase()
    return lower.includes('thùng') || lower.startsWith('thung')
}

// Hàm lọc sạch các tag kỹ thuật hệ thống ([CV_ID: ...], [PID: ...], [SKU: ...], [Đợt ...], Nhập/Xuất kho)
// chỉ giữ lại ghi chú thực tế do người dùng tự gõ thêm
export const cleanUserNotes = (notes: string | null | undefined) => {
    if (!notes) return ''
    const cleaned = notes
        .replace(/\[CV_ID:\s*[^\]]+\]\s*/gi, '')
        .replace(/\[PID:\s*[^\]]+\]\s*/gi, '')
        .replace(/\[SKU:\s*[^\]]*\]\s*/gi, '')
        .replace(/\[CV:\s*[^\]]+\]\s*/gi, '')
        .replace(/\[Đợt\s*[^\]]*\]\s*/gi, '')
        .replace(/\[[^\]]+\]\s*/gi, '')
        .replace(/\b(nhập kho|xuất kho)\b\s*/gi, '')
        .trim()
    if (!cleaned || /^(nhập kho|xuất kho)$/i.test(cleaned)) return ''
    return cleaned
}

export const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    const date = d.toLocaleDateString('vi-VN')
    return `${time} ${date}`
}

export const formatTimeOnly = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

export const formatCompactRange = (fromStr: string | null | undefined, toStr: string | null | undefined, isOngoing?: boolean) => {
    if (!fromStr) return '-'
    const d1 = new Date(fromStr)
    const t1 = d1.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    const date1 = d1.toLocaleDateString('vi-VN')
    if (isOngoing || !toStr) {
        return `${t1} → Hiện tại (${date1})`
    }
    const d2 = new Date(toStr)
    const t2 = d2.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    const date2 = d2.toLocaleDateString('vi-VN')
    if (date1 === date2) {
        return `${t1} → ${t2} (${date1})`
    }
    return `${t1} ${date1} → ${t2} ${date2}`
}

// Helper lấy chuỗi YYYY-MM-DD theo giờ địa phương
export const getShiftLocalDateString = (isoString?: string) => {
    if (!isoString) return ''
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return ''
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

// Helper lấy đơn vị ưu tiên (ưu tiên đơn vị Thùng trước)
export const getPreferredUnit = (units: string[], fallbackUnit?: string | null): string => {
    const cleanFallback = cleanUnitLabel(fallbackUnit)
    if (!units || units.length === 0) return cleanFallback || 'Kg'
    const thungUnit = units.find(u => isBoxUnit(u))
    if (thungUnit) return thungUnit
    if (cleanFallback && units.includes(cleanFallback)) return cleanFallback
    return units[0] || cleanFallback || 'Kg'
}

// Ghép danh sách các lần chốt ca tạm (tự động gom thêm đợt cuối nếu sau lần chốt tạm cuối cùng vẫn còn nhập liệu rồi bấm Hoàn thành CV luôn)
export const buildEffectiveSubShifts = (subShiftList: any[], lines: any[], shift: any) => {
    if (!subShiftList || subShiftList.length === 0) return []
    const result = subShiftList.map((ss, idx) => {
        const prevToTime = idx > 0 ? subShiftList[idx - 1].to_time : ss.from_time
        const subLines = lines.filter(l =>
            idx === 0
                ? (l.sent_at >= ss.from_time && l.sent_at <= ss.to_time)
                : (l.sent_at > prevToTime && l.sent_at <= ss.to_time)
        )
        return {
            ...ss,
            _subLines: subLines,
            is_auto_final: false,
        }
    })

    const lastSS = subShiftList[subShiftList.length - 1]
    const remainingLines = lines.filter(l => l.sent_at > lastSS.to_time)
    if (remainingLines.length > 0) {
        const lastLine = remainingLines[remainingLines.length - 1]
        const prodsMap: Record<string, { product_name: string; unit: string; in_qty: number; out_qty: number }> = {}
        remainingLines.forEach(l => {
            const u = l.unit || 'Thùng'
            const pName = l.item_name || 'Hàng hóa'
            const isImp = l.to_department === 'Kho'
            const q = Number(l.quantity_sent) || 0
            const key = `${pName}_${u}`
            if (!prodsMap[key]) prodsMap[key] = { product_name: pName, unit: u, in_qty: 0, out_qty: 0 }
            if (isImp) prodsMap[key].in_qty += q
            else prodsMap[key].out_qty += q
        })
        result.push({
            id: `auto_final_${shift?.id || 'shift'}`,
            shift_id: shift?.id,
            sub_shift_number: subShiftList.length + 1,
            from_time: lastSS.to_time,
            to_time: shift?.closed_at || lastLine.sent_at,
            closed_by_name: shift?.closed_by_name || lastLine.sent_by_name || 'Nhân viên',
            notes: shift?.status === 'closed'
                ? 'Đợt cuối ca (tự động tính khi bấm Hoàn thành CV)'
                : 'Đợt đang nhập (chưa bấm Chốt tạm)',
            summary_data: {
                job_name: shift?.summary_data?.job_name || '',
                total_records: remainingLines.length,
                products_summary: prodsMap,
            },
            _subLines: remainingLines,
            is_auto_final: true,
        })
    }
    return result
}

// Chuẩn bị dữ liệu phiếu kết toán Nhập / Xuất từ công việc đã chọn (Dựa trực tiếp vào MÃ SẢN PHẨM / ID đã ghim)
export const buildSettlementDataForShift = (shift: any, rows: any[], type: 'in' | 'out', allProducts: any[]) => {
    const jobTitle = shift.summary_data?.job_name || shift.notes || 'Công việc'
    const isImport = type === 'in'
    const relevantRows = rows.filter(r => (Number(isImport ? r.in_qty : r.out_qty) || 0) > 0)
    const pinnedList: any[] = shift?.summary_data?.pinned_products || []

    const items = relevantRows.map((r, idx) => {
        const qty = Number(isImport ? r.in_qty : r.out_qty) || 0
        const rName = (r.product_name || '').trim().toLowerCase()
        const cleanUnit = cleanUnitLabel(r.unit) || r.unit

        let foundProd: any = r.product_id
            ? (pinnedList.find(p => p.id === r.product_id) || allProducts.find(p => p.id === r.product_id))
            : undefined

        if (!foundProd && r.sku) {
            foundProd = pinnedList.find(p => p.sku === r.sku) || allProducts.find(p => p.sku === r.sku)
        }

        if (!foundProd) {
            foundProd = pinnedList.find(p => (p.name || '').trim().toLowerCase() === rName)
        }

        if (!foundProd) {
            foundProd = allProducts.find(p => (p.name || '').trim().toLowerCase() === rName) ||
                        allProducts.find(p => p.sku && p.sku.trim().toLowerCase() === rName)
        }

        if (!foundProd) {
            const candidates = allProducts.filter(p => {
                const pName = (p.name || '').trim().toLowerCase()
                return pName.length > 3 && (rName.includes(pName) || pName.includes(rName))
            })
            if (candidates.length > 0) {
                candidates.sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0))
                foundProd = candidates[0]
            }
        }

        return {
            id: `settle_${type}_${Date.now()}_${idx}`,
            productId: foundProd?.id || r.product_id || '',
            productName: foundProd?.name || r.product_name,
            unit: cleanUnit || foundProd?.unit || 'Kg',
            quantity: qty,
            document_quantity: qty,
            price: 0,
            note: '',
            categoryId: (foundProd as any)?.category_id || undefined,
        }
    })

    return {
        items,
        description: jobTitle,
        orderTypeName: shift?.summary_data?.order_type_name || 'Sản Xuất',
        orderTypeId: shift?.summary_data?.order_type_id || undefined,
        orderTypeCode: shift?.summary_data?.order_type_code || undefined,
        shiftId: shift.id,
        jobName: jobTitle,
        settlementType: type,
        targetUnit: 'Kg',
    }
}

