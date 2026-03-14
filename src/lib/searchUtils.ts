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

export function matchSearch(data: any, term: string): boolean {
    if (!term) return true;
    if (!data) return false;

    const normalizedTerm = normalizeSearchString(term);
    const unaccentedTerm = normalizeSearchString(term, true);

    // Chuẩn hóa dữ liệu
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    const dynamicSearchString = dataString.toLowerCase().normalize('NFC');
    const unaccentedDataString = normalizeSearchString(dynamicSearchString, true);

    // 1. Kiểm tra khớp chuỗi trực tiếp (Phổ biến nhất)
    if (dynamicSearchString.includes(normalizedTerm) || unaccentedDataString.includes(unaccentedTerm)) {
        return true;
    }

    // 2. Tìm kiếm theo từ khóa (Keywords)
    const keywords = normalizedTerm.split(/\s+/).filter(k => k.length > 1); // Bỏ qua từ 1 ký tự
    const unaccentedKeywords = unaccentedTerm.split(/\s+/).filter(k => k.length > 1);

    if (keywords.length > 0) {
        // Tất cả các từ khóa quan trọng phải xuất hiện trong dữ liệu
        const matchesAccented = keywords.every(k => dynamicSearchString.includes(k));
        const matchesUnaccented = unaccentedKeywords.every(k => unaccentedDataString.includes(k));
        if (matchesAccented || matchesUnaccented) return true;
    }

    // 3. Xử lý trường hợp ngược: chuỗi tìm kiếm CHỨA dữ liệu (Ví dụ: tìm "Sầu riêng 4 túi" khớp với "Sầu riêng")
    // Chỉ áp dụng cho các trường tên hoặc mã nếu data là object, hoặc chính nó nếu là string
    if (typeof data === 'string') {
        const normData = normalizeSearchString(data);
        if (normData.length > 5 && normalizedTerm.includes(normData)) return true;
    } else if (typeof data === 'object') {
        const fieldsToReverseMatch = ['name', 'product_name', 'sku', 'code', 'internal_code'];
        for (const field of fieldsToReverseMatch) {
            const val = data[field];
            if (typeof val === 'string' && val.length > 5) {
                const normVal = normalizeSearchString(val);
                if (normalizedTerm.includes(normVal)) return true;
            }
        }
    }

    return false;
}

/**
 * Bộ máy tìm kiếm nâng cao hỗ trợ toán tử AND (&) và OR (;, ,)
 * Hỗ trợ tìm kiếm chéo trường nếu truyền vào vals là một mảng các chuỗi.
 */
export function advancedMatchSearch(vals: string | string[] | null | undefined, query: string): boolean {
    if (!query) return true;
    if (!vals) return false;

    const normalize = (s: string) => normalizeSearchString(s, true);
    
    // Đảm bảo vals luôn là mảng các chuỗi đã chuẩn hóa
    const normalizedVals = Array.isArray(vals) 
        ? vals.map(v => normalize(String(v || ''))) 
        : [normalize(String(vals || ''))];

    // Tách theo toán tử OR (; hoặc ,)
    const orParts = query.split(/[;,]/).map(p => p.trim()).filter(Boolean);
    
    return orParts.some(orPart => {
        // Tách theo toán tử AND (&)
        const andParts = orPart.split('&').map(p => p.trim()).filter(Boolean);
        
        // Tất cả các phần AND phải được tìm thấy trong tập hợp normalizedVals
        return andParts.every(andPart => {
            const nPart = normalize(andPart);
            return normalizedVals.some(v => v.includes(nPart));
        });
    });
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

        // 1b. Deep search for categories (Special handling for nested objects)
        const checkCategoryMatch = (obj: any) => {
            if (!obj) return 0;
            let catScore = 0;
            const name = normalizeSearchString(String(obj.name || ''));
            const unaccentedName = normalizeSearchString(name, true);

            if (name === normalizedTerm) catScore += 1000;
            else if (name.startsWith(normalizedTerm)) catScore += 400;
            else if (name.includes(normalizedTerm)) catScore += 150;
            
            return catScore;
        }

        // Check primary category
        if (data.categories) {
            score += checkCategoryMatch(data.categories);
        }

        // Check multiple categories in rel
        if (Array.isArray(data.product_category_rel)) {
            data.product_category_rel.forEach((rel: any) => {
                if (rel.categories) {
                    score += checkCategoryMatch(rel.categories);
                }
            });
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
