
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
    const s = name.trim();
    // Pattern 1: In parentheses, with or without unit e.g. "Thùng (13kg)", "Thùng (12.5 kg)", "Thùng (13)", "Thùng (12,5kg)"
    const matchParen = s.match(/\(\s*(\d+(?:[.,]\d+)?)\s*(k?g|kilogram|ki-lo-gam|kilo|kgs|kg\.)?\s*\)/i);
    if (matchParen) {
        const val = parseFloat(matchParen[1].replace(',', '.'));
        return isNaN(val) ? null : val;
    }
    // Pattern 2: Without parentheses, with weight unit e.g. "Thùng 12kg", "Thùng 12 kg", "Thùng/12kg"
    const matchNoParen = s.match(/(?:^|\s|\/)(\d+(?:[.,]\d+)?)\s*(k?g|kilogram|ki-lo-gam|kilo|kgs|kg\.)(?:\s|$)/i);
    if (matchNoParen) {
        const val = parseFloat(matchNoParen[1].replace(',', '.'));
        return isNaN(val) ? null : val;
    }
    return null;
};

export interface SpecificationResult {
    quyCach: string;
    conversionRate: number;
    convertedQty: number;
    cleanUnitName: string;
}

/**
 * Calculates accurate item specification (Quy cách) and converted quantity based on the chosen unit.
 * Automatically handles weight suffixes (e.g. "Thùng (13kg)", "Thùng (12kg)", "Thùng 12kg")
 * and maps to product units configuration when needed.
 */
export const calculateItemSpecification = (
    itemUnit: string | null | undefined,
    itemQuantity: number | string | null | undefined,
    product: {
        unit?: string | null;
        product_units?: Array<{
            unit_id?: string;
            unit_name?: string;
            conversion_rate: number;
        }>;
    } | null | undefined,
    unitsMap?: Record<string, string> | Map<string, string>
): SpecificationResult => {
    const rawUnit = (itemUnit || '').trim();
    const qty = typeof itemQuantity === 'string' ? parseFloat(itemQuantity.replace(/,/g, '')) || 0 : Number(itemQuantity) || 0;
    const baseUnit = (product?.unit || 'Kg').trim();
    const formattedBaseUnit = isKg(baseUnit) ? 'Kg' : (baseUnit || 'Kg');

    if (!rawUnit) {
        return {
            quyCach: '',
            conversionRate: 1,
            convertedQty: qty,
            cleanUnitName: baseUnit
        };
    }

    const normRaw = normalizeUnit(rawUnit);
    const normBase = normalizeUnit(baseUnit);

    // 1. Check if unit has weight/rate in name (e.g. "Thùng (13kg)", "Thùng (12kg)", "Thùng 12kg")
    const extractedRate = extractWeightFromName(rawUnit);
    if (extractedRate !== null && extractedRate > 0) {
        // Strip the weight part to get clean unit name, e.g. "Thùng (13kg)" -> "Thùng"
        const cleanName = rawUnit
            .replace(/\s*\([^)]*\)/g, '')
            .replace(/(?:\s+|\/)\d+(?:[.,]\d+)?\s*(k?g|kilogram|ki-lo-gam|kilo|kgs|kg\.)?/gi, '')
            .trim() || rawUnit;
        
        // If clean name is same as base unit (e.g. "Kg (1kg)"), no specification string needed
        const normClean = normalizeUnit(cleanName);
        if (normClean === normBase || (isKg(normClean) && isKg(normBase))) {
            return {
                quyCach: '',
                conversionRate: extractedRate,
                convertedQty: qty * extractedRate,
                cleanUnitName: cleanName
            };
        }

        return {
            quyCach: `${cleanName}/${extractedRate}${formattedBaseUnit}`,
            conversionRate: extractedRate,
            convertedQty: qty * extractedRate,
            cleanUnitName: cleanName
        };
    }

    // 2. If unit matches base unit directly
    if (normRaw === normBase || (isKg(normRaw) && isKg(normBase))) {
        return {
            quyCach: '',
            conversionRate: 1,
            convertedQty: qty,
            cleanUnitName: rawUnit
        };
    }

    // 3. Search in product_units
    if (product?.product_units && product.product_units.length > 0) {
        const getUnitNameById = (id?: string): string => {
            if (!id) return '';
            if (unitsMap instanceof Map) return unitsMap.get(id) || '';
            if (unitsMap && typeof unitsMap === 'object') return unitsMap[id] || '';
            return '';
        };

        const getCleanDisplayName = (pu: any): string => {
            const raw = pu.unit_name || getUnitNameById(pu.unit_id) || '';
            return raw.split('(')[0].trim() || raw;
        };

        // Try exact match
        const uConfig = product.product_units.find((pu: any) => {
            const uName = pu.unit_name || getUnitNameById(pu.unit_id);
            return normalizeUnit(uName) === normRaw;
        });

        if (uConfig && uConfig.conversion_rate) {
            const cleanName = getCleanDisplayName(uConfig) || rawUnit;
            return {
                quyCach: `${cleanName}/${uConfig.conversion_rate}${formattedBaseUnit}`,
                conversionRate: uConfig.conversion_rate,
                convertedQty: qty * uConfig.conversion_rate,
                cleanUnitName: cleanName
            };
        }

        // Try stripped match (e.g. "Thùng" vs "Thùng (20kg)")
        const strippedRaw = normRaw.replace(/\s*\([^)]*\)/g, '').trim();
        const uConfigStripped = product.product_units.find((pu: any) => {
            const uName = normalizeUnit(pu.unit_name || getUnitNameById(pu.unit_id)).replace(/\s*\([^)]*\)/g, '').trim();
            return uName === strippedRaw;
        });

        if (uConfigStripped && uConfigStripped.conversion_rate) {
            const cleanName = getCleanDisplayName(uConfigStripped) || rawUnit;
            return {
                quyCach: `${cleanName}/${uConfigStripped.conversion_rate}${formattedBaseUnit}`,
                conversionRate: uConfigStripped.conversion_rate,
                convertedQty: qty * uConfigStripped.conversion_rate,
                cleanUnitName: cleanName
            };
        }
    }

    // 4. Default fallback: unit differs from base unit
    return {
        quyCach: `${rawUnit}/1${formattedBaseUnit}`,
        conversionRate: 1,
        convertedQty: qty,
        cleanUnitName: rawUnit
    };
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
