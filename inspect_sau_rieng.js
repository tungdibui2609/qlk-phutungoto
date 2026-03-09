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
        console.log('--- KHÁM PHÁ VỊ TRÍ THỰC TẾ ---');

        // 1. Lấy tất cả vị trí có gán lot_id
        const positions = await request('/positions?lot_id=not.is.null&select=code,lot_id,system_type');
        console.log(`Tìm thấy ${positions.length} vị trí có gán lô hàng.`);

        if (positions.length === 0) return;

        // 2. Lấy thông tin chi tiết của các lô hàng này (bao gồm cả sản phẩm)
        const lotIds = positions.map(p => p.lot_id);
        const lotMap = {};

        for (let i = 0; i < lotIds.length; i += 100) {
            const batch = lotIds.slice(i, i + 100);
            const lots = await request(`/lots?id=in.(${batch.join(',')})&select=id,code,products(id,name),lot_items(id,products(id,name))`);
            lots.forEach(l => {
                lotMap[l.id] = l;
            });
        }

        console.log('--- KẾT QUẢ PHÂN TÍCH ---');
        const sauRiengPositions = [];

        positions.forEach(pos => {
            const lot = lotMap[pos.lot_id];
            if (!lot) return;

            let productName = '';
            let isSauRieng = false;

            if (lot.products && lot.products.name && lot.products.name.toLowerCase().includes('sầu riêng')) {
                isSauRieng = true;
                productName = lot.products.name;
            } else if (lot.lot_items) {
                const item = lot.lot_items.find(li => li.products && li.products.name && li.products.name.toLowerCase().includes('sầu riêng'));
                if (item) {
                    isSauRieng = true;
                    productName = item.products.name;
                }
            }

            if (isSauRieng) {
                sauRiengPositions.push({
                    pos: pos.code,
                    system: pos.system_type,
                    product: productName,
                    lotCode: lot.code
                });
            }
        });

        if (sauRiengPositions.length > 0) {
            console.log(`Tìm thấy ${sauRiengPositions.length} vị trí đang chứa "Sầu riêng":`);
            sauRiengPositions.sort((a, b) => a.pos.localeCompare(b.pos));
            sauRiengPositions.forEach(r => {
                console.log(`- [${r.system}] ${r.pos}: ${r.product} (Lô: ${r.lotCode})`);
            });
        } else {
            console.log('Không tìm thấy vị trí nào chứa "Sầu riêng".');
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
