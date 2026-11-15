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
