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
                'Authorization': `Bearer ${API_KEY}`
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
        const productName = 'Sầu riêng cấp đông múi Dona/Monthong B To';
        const prods = await request(`/products?name=ilike.*${encodeURIComponent(productName)}*&select=id,name`);

        console.log(`Tìm thấy ${prods.length} sản phẩm tương ứng.`);

        for (const p of prods) {
            console.log(`\nSản phẩm: "${p.name}" (ID: ${p.id})`);

            // Tìm tất cả lô hàng
            const lots = await request(`/lots?product_id=eq.${p.id}&select=id,code,warehouse_name,system_code`);
            const lotItems = await request(`/lot_items?product_id=eq.${p.id}&select=lot_id`);
            const allLotIds = Array.from(new Set([...lots.map(l => l.id), ...lotItems.map(li => li.lot_id)]));

            console.log(`- Tổng số lô hàng: ${allLotIds.length}`);

            if (allLotIds.length > 0) {
                // Kiểm tra gán vị trí trong bảng positions
                const positions = await request(`/positions?lot_id=in.(${allLotIds.join(',')})&select=code,lot_id,system_type`);
                console.log(`- Số lô được gán vị trí (bảng positions): ${positions.length}`);

                positions.forEach(pos => {
                    console.log(`  + Vị trí: ${pos.code} [Hệ thống: ${pos.system_type}] (Lô: ${lots.find(l => l.id === pos.lot_id)?.code || pos.lot_id})`);
                });

                // Kiểm tra các lô chưa gán vị trí trong bảng positions
                const assignedIds = new Set(positions.map(p => p.lot_id));
                const unassignedIds = allLotIds.filter(id => !assignedIds.has(id));

                if (unassignedIds.length > 0) {
                    console.log(`- Có ${unassignedIds.length} lô chưa gán vị trí trong bảng positions. Đang kiểm tra chi tiết:`);
                    const unassignedLots = await request(`/lots?id=in.(${unassignedIds.slice(0, 20).join(',')})&select=code,warehouse_name,system_code`);
                    unassignedLots.forEach(l => {
                        console.log(`  + Lô: ${l.code} | Kho (trong lots): ${l.warehouse_name} | System: ${l.system_code}`);
                    });
                }
            }
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
