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
 * Chuẩn hóa các dạng chuỗi ngày (DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY, YYYY-MM-DD) về chuẩn ISO 'YYYY-MM-DD'
 */
export function parseDateToISO(dateStr?: string | null): string | null {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const clean = dateStr.trim();
    // 1. DD/MM/YYYY hoặc DD-MM-YYYY
    const dmyMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
        const [, d, m, y] = dmyMatch;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    // 2. DD/MM/YY hoặc DD-MM-YY (2 chữ số năm)
    const dmyShortMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
    if (dmyShortMatch) {
        const [, d, m, y] = dmyShortMatch;
        return `20${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    // 3. YYYY-MM-DD
    const ymdMatch = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (ymdMatch) {
        const [, y, m, d] = ymdMatch;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return null;
}
