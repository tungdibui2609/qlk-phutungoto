
function parsePositionCodeFallback(code) {
    if (!code) return null;
    
    const match = code.match(/^K(\d+)D(\d+)([A-Z]\d+|[\u00C0-\u1EF9A-Z]+\d+)T(\d+)/i);
    if (!match) return null;

    const [_, k, d, bin, t] = match;
    const levelDigit = t.charAt(0);

    return {
        warehouse: `Kho ${k}`,
        row: `Dãy ${d}`,
        bin: `Ô ${bin.toUpperCase()}`,
        level: `Tầng ${levelDigit}`
    };
}

const testCodes = ["K1D1A10T101", "K1D1A01T101", "K1D1A02T101", "K1D1B10T101", "K1D1B01T101"];
console.log("Original:", testCodes);
const sorted = [...testCodes].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
console.log("Sorted  :", sorted);
