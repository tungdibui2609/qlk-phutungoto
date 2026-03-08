
// Type definitions for the maps used in conversion
export type UnitNameMap = Map<string, string>; // name (lowercase) -> id
export type ConversionMap = Map<string, Map<string, number>>; // productId -> unitId -> rate

// Helper to normalize and clean unit names for comparison
const normalizeUnit = (s: string | null | undefined) => {
    if (!s) return '';
    return s.normalize('NFC').toLowerCase().trim();
};

/**
 * Converts a quantity from a specific unit to the base unit amount.
 */
export function toBaseAmount(
    productId: string | null,
    unitName: string | null,
    qty: number,
    baseUnitName: string | null,
    unitNameMap: UnitNameMap,
    conversionMap: ConversionMap
): number {
    if (!productId || !unitName || !baseUnitName) return qty;

    const normInput = normalizeUnit(unitName);
    const normBase = normalizeUnit(baseUnitName);

    // If unit is Base Unit, return qty
    if (normInput === normBase) return qty;

    // Look up unit ID
    // Step 1: Exact match (e.g. "thùng")
    let uid = unitNameMap.get(normInput);

    // Step 2: If no exact match, try stripping parentheses (e.g. "thùng (20 kg)" -> "thùng")
    if (!uid) {
        const stripped = normInput.replace(/\s*\([^)]*\)/g, '');
        uid = unitNameMap.get(stripped);
    }

    if (!uid) return qty;

    // Look up rate
    const rates = conversionMap.get(productId);
    if (rates && rates.has(uid)) {
        const result = qty * rates.get(uid)!;
        return Number(result.toFixed(6));
    }

    return Number(qty.toFixed(6));
}

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
        const uid = unitNameMap.get(name);
        if (uid && rates.has(uid)) {
            const rateKgToBase = rates.get(uid)!;
            if (rateKgToBase === 0) return null;
            return 1 / rateKgToBase;
        }
    }

    return null;
}

/**
 * Converts a quantity from one unit to another for a specific product.
 * Both source and target units can be either the base unit or any alternative unit.
 *
 * @param productId - The ID of the product.
 * @param fromUnitName - The name of the source unit.
 * @param toUnitName - The name of the target unit.
 * @param qty - The quantity to convert.
 * @param baseUnitName - The name of the product's base unit.
 * @param unitNameMap - Map of unit names to unit IDs.
 * @param conversionMap - Map of conversion rates (productId -> unitId -> rate).
 * @returns The converted quantity, or original if conversion is not possible.
 */
export function convertUnit(
    productId: string | null,
    fromUnitName: string | null,
    toUnitName: string | null,
    qty: number,
    baseUnitName: string | null,
    unitNameMap: UnitNameMap,
    conversionMap: ConversionMap
): number {
    if (!productId || !fromUnitName || !toUnitName || !baseUnitName) return qty;

    const normFrom = normalizeUnit(fromUnitName);
    const normTo = normalizeUnit(toUnitName);
    const normBase = normalizeUnit(baseUnitName);

    if (normFrom === normTo) return qty;

    // 1. Convert from source unit to base unit
    const qtyBase = toBaseAmount(productId, fromUnitName, qty, baseUnitName, unitNameMap, conversionMap);

    // 2. If target is base unit, we are done
    if (normTo === normBase) return qtyBase;

    // 3. Convert from base unit to target unit
    const toUnitId = unitNameMap.get(normTo);
    if (!toUnitId) return qtyBase; // Fallback to base unit amount if target unit ID unknown

    const rates = conversionMap.get(productId);
    if (rates && rates.has(toUnitId)) {
        const rate = rates.get(toUnitId)!;
        if (rate === 0) return qtyBase;
        const result = qtyBase / rate;
        return Number(result.toFixed(6));
    }

    return qtyBase; // Fallback to base unit amount if no conversion rate found
}
