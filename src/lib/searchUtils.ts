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

/**
 * Calculates a relevance score for a search term against a data object or string.
 * Higher score means better match.
 */
export function calculateSearchScore(data: any, term: string): number {
    if (!term) return 0;
    if (!data) return 0;

    const normalizedTerm = normalizeSearchString(term);
    const unaccentedTerm = normalizeSearchString(term, true);

    const stringData = typeof data === 'string' ? data : JSON.stringify(data);
    const normalizedData = stringData.toLowerCase().normalize('NFC');
    const unaccentedData = normalizeSearchString(normalizedData, true);

    let score = 0;

    // 1. Nếu là đối tượng, ưu tiên kiểm tra các trường chính TRƯỚC khi stringify toàn bộ
    if (typeof data === 'object') {
        const priorityFields = ['label', 'name', 'code', 'sku', 'internal_name', 'internal_code'];
        for (const field of priorityFields) {
            const valRaw = data[field];
            if (!valRaw) continue;

            const val = normalizeSearchString(String(valRaw));
            const unaccentedVal = normalizeSearchString(val, true);

            // Exact Match trên trường ưu tiên (Cực cao)
            if (val === normalizedTerm) score += 2000;
            else if (unaccentedVal === unaccentedTerm) score += 1500;

            // Starts With trên trường ưu tiên
            if (val.startsWith(normalizedTerm)) score += 800;
            else if (unaccentedVal.startsWith(unaccentedTerm)) score += 600;

            // Word Starts With
            const fieldWords = val.split(/[\s,._-]+/);
            if (fieldWords.some(w => w.startsWith(normalizedTerm))) score += 400;

            // Contains
            if (val.includes(normalizedTerm)) score += 200;
            else if (unaccentedVal.includes(unaccentedTerm)) score += 100;
        }
    }

    // 2. Fallback sang so sánh chuỗi toàn bộ (đã tính ở trên)
    if (normalizedData === normalizedTerm) score += 1000;
    else if (normalizedData.startsWith(normalizedTerm)) score += 500;
    else if (normalizedData.includes(normalizedTerm)) score += 100;

    // 3. Length Penalty (Bí quyết để "Xoài" thắng "TP Xoài")
    // Nếu điểm bằng nhau, chuỗi ngắn hơn (súc tích hơn) sẽ thắng
    // Chúng ta trừ một lượng điểm nhỏ dựa trên độ dài của dữ liệu
    if (score > 0) {
        // Chỉ áp dụng penalty nếu có khớp
        const lengthPenalty = Math.min(normalizedData.length / 2, 50);
        score -= lengthPenalty;
    }

    return score;
}
