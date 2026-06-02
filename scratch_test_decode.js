const extractBoxCode = (input) => {
    let clean = input.trim()
    
    // 1. Nếu là URL, lấy phần path cuối cùng
    if (clean.includes('/') && (clean.startsWith('http://') || clean.startsWith('https://') || clean.includes('/scan/'))) {
        const parts = clean.split('/')
        const lastPart = parts[parts.length - 1]
        if (lastPart.toUpperCase().startsWith('BOX-')) {
            clean = lastPart
        }
    }
    
    // 2. Loại bỏ các tiền tố đầu quét barcode tự động thêm vào (như ]C1, ]Q1, ]d1)
    if (clean.startsWith(']C1') || clean.startsWith(']Q1') || clean.startsWith(']d1')) {
        clean = clean.substring(3)
    }
    
    // 3. Tìm chuỗi có dạng BOX-... trong chuỗi quét được
    const boxMatch = clean.match(/BOX-[A-Z0-9_-]+/i)
    if (boxMatch) {
        return boxMatch[0].toUpperCase()
    }
    
    return clean.toUpperCase()
}

// BỘ DỮ LIỆU KIỂM THỬ (TEST CASE)
const testCases = [
    {
        name: "Mã tem chuẩn",
        input: "BOX-CCCCCCCC-VVVVVV-HH11201090200402-013",
        expected: "BOX-CCCCCCCC-VVVVVV-HH11201090200402-013"
    },
    {
        name: "Mã tem có khoảng trắng và viết thường",
        input: "  box-cccccccc-vvvvvv-hh11201090200402-013  ",
        expected: "BOX-CCCCCCCC-VVVVVV-HH11201090200402-013"
    },
    {
        name: "Mã tem dạng URL từ camera điện thoại",
        input: "https://phutungoto.vercel.app/scan/BOX-CCCCCCCC-VVVVVV-HH11201090200402-013",
        expected: "BOX-CCCCCCCC-VVVVVV-HH11201090200402-013"
    },
    {
        name: "Mã tem có tiền tố GS1 ]C1 từ đầu quét",
        input: "]C1BOX-CCCCCCCC-VVVVVV-HH11201090200402-013",
        expected: "BOX-CCCCCCCC-VVVVVV-HH11201090200402-013"
    },
    {
        name: "Mã tem URL kèm port localhost",
        input: "http://localhost:3000/scan/BOX-CCCCCCCC-VVVVVV-HH11201090200402-013",
        expected: "BOX-CCCCCCCC-VVVVVV-HH11201090200402-013"
    },
    {
        name: "Mã quét không hợp lệ (mã Pallet)",
        input: "DL-LOT-300526-078",
        expected: "DL-LOT-300526-078"
    }
];

console.log("=== BẮT ĐẦU CHẠY KIỂM THỬ HÀM EXTRACTBOXCODE ===");
let passed = 0;
testCases.forEach((tc, idx) => {
    const result = extractBoxCode(tc.input);
    const isOk = result === tc.expected;
    if (isOk) passed++;
    console.log(`[Test #${idx + 1}] ${tc.name}:`);
    console.log(`  - Input:    "${tc.input}"`);
    console.log(`  - Expected: "${tc.expected}"`);
    console.log(`  - Result:   "${result}"`);
    console.log(`  - Status:   ${isOk ? '🟢 PASS' : '🔴 FAIL'}`);
});

console.log(`\nKết quả: ${passed}/${testCases.length} bài test thành công!`);
