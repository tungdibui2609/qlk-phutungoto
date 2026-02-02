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
