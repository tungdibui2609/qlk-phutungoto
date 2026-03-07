/**
 * Chuẩn hóa chuỗi để tìm kiếm tiếng Việt tốt hơn:
 * 1. Chuyển về chữ thường
 * 2. Chuẩn hóa Unicode NFC (tránh lỗi gõ dấu tổ hợp)
 * 3. Loại bỏ dấu tiếng Việt (tùy chọn so sánh rộng)
 */
export function normalizeSearchString(text: string, removeAccents = false): string {
    if (!text) return '';
    let normalized = text.toLowerCase().normalize('NFC');

    if (removeAccents) {
        normalized = normalized
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'd');
    }

    return normalized.trim();
}

/**
 * Truly dynamic "Search Anything" utility.
 * Stringifies any object/data and checks if it contains the search term (case-insensitive).
 */
export function matchSearch(data: any, term: string): boolean {
    if (!term) return true;
    if (!data) return false;

    const normalizedTerm = normalizeSearchString(term);
    const unaccentedTerm = normalizeSearchString(term, true);

    // We stringify the entire object to catch all fields (present and future)
    const dynamicSearchString = JSON.stringify(data).toLowerCase().normalize('NFC');
    const unaccentedDataString = normalizeSearchString(dynamicSearchString, true);

    // Kiểm tra khớp có dấu hoặc không dấu (để tăng độ linh hoạt)
    return dynamicSearchString.includes(normalizedTerm) || unaccentedDataString.includes(unaccentedTerm);
}
