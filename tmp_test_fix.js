
// Mock types and functions to test the logic
function normalizeUnit(s) {
    if (!s) return '';
    return s.normalize('NFC').toLowerCase().trim();
}

function toBaseAmount(
    productId,
    unitName,
    qty,
    baseUnitName,
    unitNameMap,
    conversionMap
) {
    if (!productId || !unitName || !baseUnitName) return qty;

    const normInput = normalizeUnit(unitName);
    const normBase = normalizeUnit(baseUnitName);

    if (normInput === normBase) return qty;

    let uid = unitNameMap.get(normInput);

    // NEW LOGIC
    const kgNames = ['kg', 'kilogram', 'ki-lo-gam', 'kgs'];
    if (kgNames.includes(normBase)) {
        const weightMatch = normInput.match(/\(\s*(\d+(\.\d+)?)\s*k?g\s*\)/i);
        if (weightMatch) {
            const weight = parseFloat(weightMatch[1]);
            if (!isNaN(weight)) {
                return Number((qty * weight).toFixed(6));
            }
        }
    }

    if (!uid) {
        const stripped = normInput.replace(/\s*\([^)]*\)/g, '');
        uid = unitNameMap.get(stripped);
    }

    if (!uid) return qty;

    const rates = conversionMap.get(productId);
    if (rates && rates.has(uid)) {
        const result = qty * rates.get(uid);
        return Number(result.toFixed(6));
    }

    return Number(qty.toFixed(6));
}

// Test cases
const unitNameMap = new Map([
    ['thùng', 'u-thung'],
    ['kg', 'u-kg']
]);
const conversionMap = new Map([
    ['prod-1', new Map([['u-thung', 12]])]
]);

const tests = [
    { name: 'Thùng (13 Kg) -> 13kg', input: 'Thùng (13 Kg)', base: 'Kg', expected: 13 },
    { name: 'thùng (12 kg) -> 12kg', input: 'thùng (12 kg)', base: 'Kg', expected: 12 },
    { name: 'Thùng (no weight specified) -> uses DB rate (12)', input: 'Thùng', base: 'Kg', expected: 12 },
    { name: 'Gói (not in DB, no weight) -> returns qty (1)', input: 'Gói', base: 'Kg', expected: 1 },
    { name: 'Thùng (13 Kg) with base Thùng -> returns qty (1)', input: 'Thùng (13 Kg)', base: 'Thùng (13 Kg)', expected: 1 },
];

console.log('Running tests for unit conversion fix...');
let passed = 0;
tests.forEach(t => {
    const result = toBaseAmount('prod-1', t.input, 1, t.base, unitNameMap, conversionMap);
    if (result === t.expected) {
        console.log(`✅ [PASS] ${t.name}: Got ${result}`);
        passed++;
    } else {
        console.log(`❌ [FAIL] ${t.name}: Expected ${t.expected}, but got ${result}`);
    }
});

console.log(`\nResult: ${passed}/${tests.length} tests passed.`);
if (passed === tests.length) process.exit(0);
else process.exit(1);
