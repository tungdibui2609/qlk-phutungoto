/**
 * Utility hỗ trợ lấy màu sắc và hiển thị badge cho các loại phiếu nhập / xuất
 */

export function getOrderTypeBadgeColor(typeName: string): string {
    const norm = (typeName || '').toLowerCase().trim()

    // Bán hàng / Xuất bán
    if (norm.includes('bán') || norm.includes('sale')) {
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
    }
    // Nhập mới / Mua hàng
    if (norm.includes('nhập mới') || norm.includes('mua hàng') || norm.includes('purchase')) {
        return 'bg-sky-50 text-sky-700 border-sky-200/80 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800'
    }
    // Sản xuất
    if (norm.includes('sản xuất')) {
        return 'bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800'
    }
    // Phân loại / Rework
    if (norm.includes('phân loại') || norm.includes('rework')) {
        return 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
    }
    // Điều chỉnh / Kiểm kê
    if (norm.includes('điều chỉnh') || norm.includes('kiểm kê')) {
        return 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
    }
    // Chuyển đổi / Gộp tách
    if (norm.includes('chuyển đổi') || norm.includes('unbundle')) {
        return 'bg-indigo-50 text-indigo-700 border-indigo-200/80 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800'
    }
    // Nhập trả / Trả hàng
    if (norm.includes('nhập trả') || norm.includes('trả hàng') || norm.includes('return')) {
        return 'bg-red-50 text-red-700 border-red-200/80 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800'
    }
    // Xuất mượn / Dùng nội bộ
    if (norm.includes('mượn') || norm.includes('nội bộ') || norm.includes('internal')) {
        return 'bg-teal-50 text-teal-700 border-teal-200/80 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800'
    }
    // Mẫu
    if (norm.includes('mẫu') || norm.includes('sample')) {
        return 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
    }
    // Dán tem
    if (norm.includes('dán tem')) {
        return 'bg-cyan-50 text-cyan-700 border-cyan-200/80 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800'
    }
    // Ký gửi / Hàng tạm
    if (norm.includes('ký gửi') || norm.includes('tạm')) {
        return 'bg-yellow-50 text-yellow-800 border-yellow-200/80 dark:bg-yellow-950/50 dark:text-yellow-300 dark:border-yellow-800'
    }

    // Mặc định
    return 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700'
}
