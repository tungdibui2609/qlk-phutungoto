const url = 'https://viqeyhpnevxcowsffueb.supabase.co/rest/v1';
const headers = {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U',
    'Content-Type': 'application/json'
};

async function run() {
    const searchTerm = 'Sầu riêng';
    console.log(`Searching for products containing "${searchTerm}"...`);

    try {
        const pRes = await fetch(`${url}/products?name=ilike.*${encodeURIComponent(searchTerm)}*&select=*`, { headers });
        const products = await pRes.json();

        console.log(`Found ${products.length} products:`);
        products.forEach(p => {
            console.log(`- ID: ${p.id}, Code: ${p.code}, Name: "${p.name}", SKU: ${p.sku}`);
        });

        if (products.length > 0) {
            const productIds = products.map(p => p.id);
            const idList = `(${productIds.join(',')})`;

            console.log('\nSearching for lots containing these products...');
            const lRes = await fetch(`${url}/lots?product_id=in.${idList}&select=id,code,product_id,positions(code,system_type)`, { headers });
            const lots = await lRes.json();

            console.log(`Found ${lots.length} lots in lots table:`);
            lots.forEach(l => {
                console.log(`- Lot ID: ${l.id}, Code: ${l.code}, Position: ${l.positions?.code}, System: ${l.positions?.system_type}`);
            });

            console.log('\nSearching for lots via lot_items...');
            const liRes = await fetch(`${url}/lot_items?product_id=in.${idList}&select=lot_id,product_id,quantity,lots(id,code,positions(code,system_type))`, { headers });
            const lotItems = await liRes.json();

            console.log(`Found ${lotItems.length} lot items:`);
            lotItems.forEach(li => {
                console.log(`- Lot ID: ${li.lot_id}, Code: ${li.lots?.code}, Qty: ${li.quantity}, Position: ${li.lots?.positions?.code}, System: ${li.lots?.positions?.system_type}`);
            });
        }
    } catch (e) {
        console.error(e);
    }
}
run();
