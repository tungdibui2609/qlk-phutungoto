
// Type definitions for the maps used in conversion
export type UnitNameMap = Map<string, string>; // name (lowercase) -> id
export type ConversionMap = Map<string, Map<string, number>>; // productId -> unitId -> rate

export const normalizeUnit = (s: string | null | undefined): string => {
    if (!s) return '';
    return s.normalize('NFC').toLowerCase().trim();
};

export const canonicalizeUnit = (s: string | null | undefined): string => {
    if (!s) return '';
    return s.normalize('NFC').toLowerCase().replace(/\s+/g, '');
};

/**
 * Returns a unit name suffix-stripped for matching purposes.
 * e.g. "thùng(20kg)" -> "thùng"
 */
export const getMatchingUnitName = (s: string | null | undefined): string => {
    const canonical = canonicalizeUnit(s);
    return canonical.replace(/\(\d+(\.\d+)?k?g\)/g, '');
};

const KG_NAMES = ['kg', 'kilogram', 'ki-lo-gam', 'kgs', 'kilo', 'kg.'];

export const isKg = (name: string | null | undefined): boolean => {
    if (!name) return false;
    return KG_NAMES.includes(normalizeUnit(name));
};

/**
 * Formats a unit name with its weight suffix, ensuring redundant suffixes like "Kg (1kg)" are avoided.
 */
export const formatUnitWeight = (unitName: string | null | undefined, weight: number): string => {
    if (!unitName) return '';
    
    // Strip any existing weight suffix to get the clean base name
    // e.g., "Thùng (20 KG)" -> "Thùng"
    const baseUnitName = unitName.split('(')[0].trim();
    const normBase = normalizeUnit(baseUnitName);
    
    // Avoid redundant (1kg) for Kg unit
    if (isKg(normBase)) return baseUnitName;
    
    if (weight > 0) {
        // Standard format: "Name (10kg)" - no space, lowercase kg
        return `${baseUnitName} (${weight}kg)`;
    }
    return baseUnitName;
};

export const extractWeightFromName = (name: string | null | undefined): number | null => {
    if (!name) return null;
    const match = name.toLowerCase().match(/\(\s*(\d+(\.\d+)?)\s*(k?g|kilogram|ki-lo-gam|kilo|kgs|kg\.)\s*\)/i);
    if (match) {
        const weight = parseFloat(match[1]);
        return isNaN(weight) ? null : weight;
    }
    return null;
};

// Common units that usually represent the main package of a product
export const MAIN_PACKAGE_UNITS = ['thùng', 'bao', 'két', 'sọt', 'túi', 'hộp', 'khay', 'bịch', 'gói', 'lon', 'chai', 'bình'];

/**
 * Converts a quantity from a specific unit to the base unit amount.
 */
export const toBaseAmount = (
    productId: string | null,
    unitName: string | null,
    qty: number,
    baseUnitName: string | null,
    unitNameMap: UnitNameMap,
    conversionMap: ConversionMap
): number => {
    if (!unitName || !qty) return qty;

    const normInput = normalizeUnit(unitName);
    const normBase = normalizeUnit(baseUnitName);

    // If already in base unit (e.g. "kg" -> "kg")
    if (normInput === normBase || (isKg(normInput) && isKg(normBase))) {
        return qty;
    }
    // Shortcut: Use extracted weights if possible (e.g. "Thùng (20kg)")
    const inputWeight = extractWeightFromName(unitName);
    const baseWeight = extractWeightFromName(baseUnitName);
    
    if (inputWeight && isKg(baseUnitName)) {
        return qty * inputWeight;
    }
    if (inputWeight && baseWeight) {
        return qty * (inputWeight / baseWeight);
    }

    // Step 3: Database matching (conversionMap) - Enhanced with name-based fallback
    if (productId) {
        const rates = conversionMap.get(productId);
        if (rates) {
            // Priority 1: Match by direct name (Robust against ID mismatches)
            let rate = rates.get(normInput);
            if (rate !== undefined) return qty * rate;

            // Priority 2: Match by exact UID from unitNameMap
            let uid = unitNameMap.get(normInput);
            if (uid && rates.has(uid)) {
                return qty * rates.get(uid)!;
            }

            // Priority 3: Match by stripped name (e.g. "thùng (20 kg)" -> "thùng")
            const stripped = normInput.replace(/\s*\([^)]*\)/g, '').trim();
            rate = rates.get(stripped);
            if (rate !== undefined) return qty * rate;
            
            // Priority 4: Match by stripped name's UID
            const strippedUid = unitNameMap.get(stripped);
            if (strippedUid && rates.has(strippedUid)) {
                return qty * rates.get(strippedUid)!;
            }
        }
    }

    return qty;
};

/**
 * Calculates the conversion rate from the Base Unit to Kilograms (KG).
 * Returns null if no conversion path to KG exists.
 *
 * Logic:
 * If Base is KG -> Rate is 1.
 * If 1 KG = X Base (defined in DB) -> 1 Base = 1/X KG.
 *
 * @param productId - The ID of the product.
 * @param baseUnitName - The name of the product's base unit.
 * @param unitNameMap - Map of unit names to unit IDs.
 * @param conversionMap - Map of conversion rates (productId -> unitId -> rate).
 * @returns The rate to multiply Base Qty by to get KG, or null if not convertible.
 */
export function getBaseToKgRate(
    productId: string | null,
    baseUnitName: string | null,
    unitNameMap: UnitNameMap,
    conversionMap: ConversionMap
): number | null {
    if (!productId || !baseUnitName) return null;

    const kgNames = ['kg', 'kilogram', 'ki-lo-gam', 'kgs'];
    const normBase = normalizeUnit(baseUnitName);

    // Check Base Unit
    if (kgNames.includes(normBase)) return 1;

    // Check Product Units for a KG entry
    const rates = conversionMap.get(productId);
    if (!rates) return null;

    for (const name of kgNames) {
        // Try by name directly in rates
        const rateByNm = rates.get(name);
        if (rateByNm !== undefined && rateByNm !== 0) return 1 / rateByNm;

        // Try by UID
        const uid = unitNameMap.get(name);
        if (uid && rates.has(uid)) {
            const rateKgToBase = rates.get(uid)!;
            if (rateKgToBase === 0) continue;
            return 1 / rateKgToBase;
        }
    }

    return null;
}

/**
 * Converts a quantity from one unit to another for a specific product.
 */
export const convertUnit = (
    productId: string | null,
    fromUnitName: string | null,
    toUnitName: string | null,
    qty: number,
    baseUnitName: string | null,
    unitNameMap: UnitNameMap,
    conversionMap: ConversionMap
): number => {
    if (!fromUnitName || !toUnitName || !qty) return qty;

    const normFrom = normalizeUnit(fromUnitName);
    const normTo = normalizeUnit(toUnitName);
    const normBase = normalizeUnit(baseUnitName);

    if (normFrom === normTo) return qty;

    // 1. Convert from source unit to base unit
    const qtyBase = toBaseAmount(productId, fromUnitName, qty, baseUnitName, unitNameMap, conversionMap);

    // 2. If target is base unit, we are done
    if (normTo === normBase || (isKg(normTo) && isKg(normBase))) return qtyBase;

    // 3. Try to convert base unit to target unit
    // Shortcut: if target has weight in name (e.g. "Thùng (20kg)")
    const toWeight = extractWeightFromName(toUnitName);
    if (toWeight && toWeight > 0) {
        return qtyBase / toWeight;
    }

    const targetRates = conversionMap.get(productId as string);
    if (targetRates && productId) {
        // Priority 1: Match target by name
        let rate = targetRates.get(normTo);
        if (rate && rate > 0) return qtyBase / rate;

        // Priority 2: Match target by UID
        const targetUid = unitNameMap.get(normTo);
        if (targetUid) {
            rate = targetRates.get(targetUid as string);
            if (rate && rate > 0) return qtyBase / rate;
        }

        // Priority 3: Match target by stripped name
        const strippedTo = normTo.replace(/\s*\([^)]*\)/g, '').trim();
        rate = targetRates.get(strippedTo);
        if (rate && rate > 0) return qtyBase / rate;

        // Priority 4: Match target by stripped UID
        const strippedUid = unitNameMap.get(strippedTo);
        if (strippedUid) {
            rate = targetRates.get(strippedUid);
            if (rate && rate > 0) return qtyBase / rate;
        }
    }

    return qtyBase;
};

/**
 * Enriches a unit name with its weight suffix (e.g., "Thùng" -> "Thùng (20kg)")
 * based on the product's conversion rates.
 */
export const enrichUnitName = (
    productId: string | null,
    unitName: string | null | undefined,
    conversionMap: ConversionMap,
    unitNameMap: UnitNameMap,
    unitIdMap: Map<string, string>
): string => {
    if (!unitName || !productId) return unitName || '';
    
    // If it already has a suffix, return as is
    if (unitName.includes('(')) return unitName;
    
    const normU = normalizeUnit(unitName);
    const productRates = conversionMap.get(productId);
    if (!productRates) return unitName;

    // 1. Try direct ID match for the unit name
    const unitId = unitNameMap.get(normU);
    let rate = unitId ? productRates.get(unitId) : null;
    
    // 2. If no direct rate (or rate is 1), search for any unit of this product that matches the base name
    if (!rate || rate === 1) {
        for (const [key, r] of productRates.entries()) {
            // key can be a unit ID
            const fullName = unitIdMap.get(key);
            if (fullName && normalizeUnit(fullName).replace(/\s*\([^)]*\)/, '').trim() === normU && r > 1) {
                rate = r;
                break;
            }
        }
    }

    if (rate && rate > 1) {
        return `${unitName} (${rate}kg)`;
    }

    return unitName;
};
