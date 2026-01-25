
// Type definitions for the maps used in conversion
export type UnitNameMap = Map<string, string>; // name (lowercase) -> id
export type ConversionMap = Map<string, Map<string, number>>; // productId -> unitId -> rate

/**
 * Converts a quantity from a specific unit to the base unit amount.
 *
 * @param productId - The ID of the product.
 * @param unitName - The name of the current unit.
 * @param qty - The quantity to convert.
 * @param baseUnitName - The name of the product's base unit.
 * @param unitNameMap - Map of unit names to unit IDs.
 * @param conversionMap - Map of conversion rates (productId -> unitId -> rate).
 * @returns The quantity converted to the base unit.
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

    // If unit is Base Unit, return qty
    if (unitName.toLowerCase() === baseUnitName.toLowerCase()) return qty;

    // Look up unit ID
    const uid = unitNameMap.get(unitName.toLowerCase());
    if (!uid) return qty;

    // Look up rate
    const rates = conversionMap.get(productId);
    if (rates && rates.has(uid)) {
        return qty * rates.get(uid)!;
    }

    return qty;
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

    // Check Base Unit
    if (kgNames.includes(baseUnitName.toLowerCase())) return 1;

    // Check Product Units for a KG entry
    // Table stores: 1 Alt = rate * Base.
    // So if Alt is KG: 1 KG = rate * Base. -> 1 Base = 1/rate KG.
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
