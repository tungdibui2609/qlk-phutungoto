/**
 * Checks if a date string falls within a given start and end date range (inclusive).
 * Dates are compared at the day level.
 * 
 * @param dateStr The date string from the database (e.g., "2024-02-01T12:00:00Z")
 * @param startDate The start date string from the input (e.g., "2024-02-01")
 * @param endDate The end date string from the input (e.g., "2024-02-29")
 * @returns boolean
 */
export function matchDateRange(dateStr: string | null | undefined, startDate: string, endDate: string): boolean {
    if (!startDate && !endDate) return true;
    if (!dateStr) return false;

    const targetDate = new Date(dateStr);
    targetDate.setHours(0, 0, 0, 0);

    if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (targetDate < start) return false;
    }

    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (targetDate > end) return false;
    }

    return true;
}

/**
 * Kiểm tra tính hợp lệ của ngày tháng năm và format về chuẩn ISO 'YYYY-MM-DD'.
 * Trả về null nếu ngày/tháng/năm không tồn tại trong thực tế (tránh lỗi PostgreSQL out of range).
 */
export function validateAndFormatDate(y: number, m: number, d: number): string | null {
    // Nếu tháng > 12 nhưng ngày <= 12, hỗ trợ tự đảo giữa MM/DD và DD/MM
    if (m > 12 && d <= 12) {
        const temp = d;
        d = m;
        m = temp;
    }

    // Năm hợp lý (1970 - 2100), tháng từ 1..12, ngày từ 1..31
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1970 || y > 2100) {
        return null;
    }

    // Kiểm tra số ngày tối đa thực tế của tháng (xử lý cả năm nhuận)
    const maxDays = new Date(y, m, 0).getDate();
    if (d > maxDays) {
        return null;
    }

    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Chuẩn hóa các dạng chuỗi ngày (DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY, YYYY-MM-DD) về chuẩn ISO 'YYYY-MM-DD'
 * Tự động loại bỏ các chuỗi ngày không hợp lệ (như tháng 41, ngày 99) để bảo vệ PostgreSQL.
 */
export function parseDateToISO(dateStr?: string | null): string | null {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const clean = dateStr.trim();
    if (!clean) return null;

    // 1. DD/MM/YYYY hoặc DD-MM-YYYY
    const dmyMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
        const [, d, m, y] = dmyMatch;
        return validateAndFormatDate(parseInt(y, 10), parseInt(m, 10), parseInt(d, 10));
    }
    // 2. DD/MM/YY hoặc DD-MM-YY (2 chữ số năm)
    const dmyShortMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
    if (dmyShortMatch) {
        const [, d, m, y] = dmyShortMatch;
        return validateAndFormatDate(2000 + parseInt(y, 10), parseInt(m, 10), parseInt(d, 10));
    }
    // 3. YYYY-MM-DD hoặc YYYY/MM/DD
    const ymdMatch = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (ymdMatch) {
        const [, y, m, d] = ymdMatch;
        return validateAndFormatDate(parseInt(y, 10), parseInt(m, 10), parseInt(d, 10));
    }
    return null;
}
