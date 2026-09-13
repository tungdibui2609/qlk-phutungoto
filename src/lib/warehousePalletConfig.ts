/**
 * Quản lý cấu hình quy cách Pallet (1 Pallet = bao nhiêu thùng/đơn vị)
 * Hỗ trợ chế độ Tự Động Thông Minh (suy ra từ các vị trí thực tế trên kệ)
 * và chế độ Cài Đặt Thủ Công (có nút Bật / Tắt kích hoạt theo ý người dùng).
 */

export interface PalletConfig {
    useManualOverride: boolean // false: Tự động thông minh từ vị trí hiện có (Khuyên dùng); true: Cài đặt thủ công
    defaultQuantityPerPallet: number
    overrides: Record<string, number> // Key có thể là productId hoặc SKU
}

const STORAGE_KEY = 'warehouse_pallet_settings_v2'

export const DEFAULT_PALLET_CONFIG: PalletConfig = {
    useManualOverride: false, // Mặc định: Chế độ Tự động thông minh từ vị trí hiện có
    defaultQuantityPerPallet: 24, // Mặc định dự phòng
    overrides: {}
}

export function getStoredPalletConfig(): PalletConfig {
    if (typeof window === 'undefined') return DEFAULT_PALLET_CONFIG
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return DEFAULT_PALLET_CONFIG
        const parsed = JSON.parse(raw)
        return {
            useManualOverride: typeof parsed.useManualOverride === 'boolean' ? parsed.useManualOverride : false,
            defaultQuantityPerPallet: typeof parsed.defaultQuantityPerPallet === 'number' && parsed.defaultQuantityPerPallet > 0
                ? parsed.defaultQuantityPerPallet
                : DEFAULT_PALLET_CONFIG.defaultQuantityPerPallet,
            overrides: parsed.overrides && typeof parsed.overrides === 'object' ? parsed.overrides : {}
        }
    } catch (e) {
        console.error('Failed to parse stored pallet config:', e)
        return DEFAULT_PALLET_CONFIG
    }
}

export function saveStoredPalletConfig(config: PalletConfig): void {
    if (typeof window === 'undefined') return
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    } catch (e) {
        console.error('Failed to save pallet config:', e)
    }
}

export interface ResolvedPalletInfo {
    quantity: number
    source: 'inferred' | 'manual_product' | 'manual_global' | 'db' | 'default'
    sourceLabel: string
}

/**
 * Xác định số thùng/pallet cho một sản phẩm:
 * 1. Nếu người dùng BẬT chế độ thủ công (useManualOverride = true):
 *    -> Ưu tiên cấu hình thủ công theo sản phẩm hoặc mặc định.
 * 2. Nếu chế độ tự động (useManualOverride = false, MẶC ĐỊNH):
 *    -> Tự động suy luận từ số lượng của các pallet hiện có trên ô - tầng (inferredQuantity).
 *    -> Nếu ô chưa có (hoặc không suy ra được), kiểm tra DB sản phẩm hoặc fallback.
 */
export function resolvePalletQuantity(
    productId?: string | null,
    sku?: string | null,
    inferredQuantity?: number | string | null,
    dbQuantity?: number | string | null,
    config?: PalletConfig
): ResolvedPalletInfo {
    const currentConfig = config || getStoredPalletConfig()
    
    // 1. Nếu người dùng BẬT chế độ thủ công (useManualOverride = true):
    if (currentConfig.useManualOverride) {
        if (productId && currentConfig.overrides[productId] && currentConfig.overrides[productId] > 0) {
            return {
                quantity: currentConfig.overrides[productId],
                source: 'manual_product',
                sourceLabel: 'Cài đặt riêng thủ công'
            }
        }
        if (sku && currentConfig.overrides[sku] && currentConfig.overrides[sku] > 0) {
            return {
                quantity: currentConfig.overrides[sku],
                source: 'manual_product',
                sourceLabel: 'Cài đặt riêng thủ công'
            }
        }
        if (currentConfig.defaultQuantityPerPallet > 0) {
            return {
                quantity: currentConfig.defaultQuantityPerPallet,
                source: 'manual_global',
                sourceLabel: 'Cài đặt chung thủ công'
            }
        }
    }

    // 2. CHẾ ĐỘ TỰ ĐỘNG THÔNG MINH (Ưu tiên hàng đầu khi không bật thủ công):
    // Tự động suy luận từ các vị trí thực tế đang có hàng trên kệ!
    // Ví dụ: Kệ đang có các vị trí chứa 30 thùng -> tự động nhận 30 thùng/pallet!
    const numInferred = Number(inferredQuantity)
    if (!isNaN(numInferred) && numInferred > 0) {
        return {
            quantity: Math.round(numInferred),
            source: 'inferred',
            sourceLabel: 'Tự động từ vị trí hiện có trên kệ'
        }
    }

    // 3. Quy cách lưu trong danh mục sản phẩm (Database)
    const numDb = Number(dbQuantity)
    if (!isNaN(numDb) && numDb > 0) {
        return {
            quantity: Math.round(numDb),
            source: 'db',
            sourceLabel: 'Quy cách chuẩn trong dữ liệu sản phẩm'
        }
    }

    // 4. Fallback mặc định
    return {
        quantity: currentConfig.defaultQuantityPerPallet || DEFAULT_PALLET_CONFIG.defaultQuantityPerPallet,
        source: 'default',
        sourceLabel: 'Quy cách mặc định'
    }
}
