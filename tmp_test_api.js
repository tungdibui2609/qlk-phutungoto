
const http = require('http');

http.get('http://localhost:3000/api/inventory/by-tag?systemType=FROZEN', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const j = JSON.parse(data);
            const coconut = j.items.filter(i => i.tag.toLowerCase().includes('coconut'));
            console.log(JSON.stringify(coconut, null, 2));
        } catch (e) {
            console.error("Parse error:", e.message);
            console.log("Raw data:", data.substring(0, 500));
        }
    });
}).on("error", (err) => {
    console.log("Error: " + err.message);
});
