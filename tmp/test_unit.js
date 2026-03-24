
const { normalizeUnit, isKg, extractWeightFromName, toBaseAmount, convertUnit } = require('d:/chanh thu/web/src/lib/unitConversion.ts');

// Mock data
const unitNameMap = new Map([
    ['thùng', 'uid_thung'],
    ['kg', 'uid_kg']
]);

const conversionMap = new Map([
    ['pid1', new Map([
        ['uid_thung', 20],
        ['uid_kg', 1]
    ])]
]);

function runTest(from, to, qty, base) {
    console.log(`Convert ${qty} ${from} to ${to} (Base: ${base})`);
    const result = convertUnit('pid1', from, to, qty, base, unitNameMap, conversionMap);
    console.log(`Result: ${result}`);
}

try {
    runTest('Thùng', 'Kg', 422.4, 'Kg');
    runTest('Thùng (20kg)', 'Kg', 1, 'Kg');
    runTest('Kg', 'Thùng (20kg)', 20, 'Kg');
} catch (e) {
    console.error(e);
}
