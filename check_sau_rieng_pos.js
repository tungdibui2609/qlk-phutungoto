const https = require('https');

const API_URL = 'viqeyhpnevxcowsffueb.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

async function request(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: API_URL,
            port: 443,
            path: '/rest/v1' + path,
            method: 'GET',
            headers: {
                'apikey': API_KEY,
                'Authorization': `Bearer ${API_KEY}`,
                'Range': '0-999'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve(data);
                    }
                } else {
                    reject(new Error(`Status: ${res.statusCode}, Data: ${data}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.end();
    });
}

async function run() {
    try {
        console.log('--- ĐANG KIỂM TRA TẤT CẢ VỊ TRÍ CÓ CHỨA SẦU RIÊNG ---');

        // 1. Tìm tất cả sản phẩm có tên "Sầu riêng"
        const prods = await request('/products?select=id,name');
        const sauRiengProds = prods.filter(p => p.name && p.name.toLowerCase().includes('sầu riêng'));
        console.log(`Tìm thấy ${sauRiengProds.length} sản phẩm liên quan đến Sầu riêng.`);

        const prodMap = {};
        sauRiengProds.forEach(p => prodMap[p.id] = p.name);
        const prodIds = sauRiengProds.map(p => p.id);

        // 2. Tìm tất cả lô hàng (lots) của các sản phẩm này
        let allLots = [];
        for (let i = 0; i < prodIds.length; i += 100) {
            const batch = prodIds.slice(i, i + 100);
            const lots = await request(`/lots?product_id=in.(${batch.join(',')})&select=id,code,product_id`);
            allLots.push(...lots);
        }
        console.log(`Tìm thấy ${allLots.length} lô hàng (trực tiếp).`);

        // 3. Tìm các lô hàng thông qua lot_items
        let lotItems = [];
        for (let i = 0; i < prodIds.length; i += 100) {
            const batch = prodIds.slice(i, i + 100);
            const items = await request(`/lot_items?product_id=in.(${batch.join(',')})&select=lot_id,product_id`);
            lotItems.push(...items);
        }

        const allLotIdSet = new Set(allLots.map(l => l.id));
        lotItems.forEach(li => allLotIdSet.add(li.lot_id));
        console.log(`Tổng cộng có ${allLotIdSet.size} lô hàng duy nhất.`);

        const lotToPName = {};
        allLots.forEach(l => lotToPName[l.id] = prodMap[l.product_id]);
        lotItems.forEach(li => lotToPName[li.lot_id] = prodMap[li.product_id]);

        const lotIdsArray = Array.from(allLotIdSet);

        // 4. Tìm các vị trí (positions) được gán các lô hàng này
        console.log('Đang kiểm tra bảng positions...');
        let assignments = [];
        for (let i = 0; i < lotIdsArray.length; i += 100) {
            const batch = lotIdsArray.slice(i, i + 100);
            const pos = await request(`/positions?lot_id=in.(${batch.join(',')})&select=code,lot_id,system_type`);
            assignments.push(...pos);
        }

        console.log(`\n--- KẾT QUẢ KIỂM TRA VỊ TRÍ ---`);
        if (assignments.length === 0) {
            console.log('Không tìm thấy bất kỳ vị trí nào được gán trong bảng positions cho các lô hàng Sầu riêng.');
        } else {
            console.log(`Tìm thấy ${assignments.length} vị trí được gán:`);
            assignments.sort((a, b) => a.code.localeCompare(b.code));
            assignments.forEach(a => {
                console.log(`- Vị trí: ${a.code} [${a.system_type}] | Sản phẩm: ${lotToPName[a.lot_id]}`);
            });
        }

        // 5. Kiểm tra chéo: Có lô hàng nào thuộc sản phẩm "Dona/Monthong B To (4 túi)" mà chưa được gán?
        const targetProd = sauRiengProds.find(p => p.name.includes('Dona/Monthong B To'));
        if (targetProd) {
            const targetLots = allLots.filter(l => l.product_id === targetProd.id);
            const targetAssigned = assignments.filter(a => targetLots.some(tl => tl.id === a.lot_id));
            console.log(`\nChi tiết sản phẩm "${targetProd.name}":`);
            console.log(`- Tổng số lô hàng: ${targetLots.length}`);
            console.log(`- Số lô đã gán vị trí: ${targetAssigned.length}`);
        }

    } catch (e) {
        console.error('Lỗi:', e.message);
    }
}

run();
