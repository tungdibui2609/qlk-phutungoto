const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    envVars[match[1]] = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
  }
});

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("=== DANH SÁCH TẤT CẢ MÃ SẢN XUẤT THỰC TẾ GỐC (production_code) TRONG DB ===");
  const { data: lots, error } = await supabase
    .from('lots')
    .select('production_code, production_id, productions(code, name)')
    .not('production_code', 'is', null);

  if (error) {
    console.error("Lỗi:", error);
    return;
  }

  // Nhóm và đếm tần suất xuất hiện
  const codeGroups = {};
  lots.forEach(l => {
    const code = l.production_code;
    const prodCode = l.productions?.code || 'Không rõ';
    const prodName = l.productions?.name || 'Không rõ';
    const key = `${code}_${prodCode}`;
    
    if (!codeGroups[key]) {
      codeGroups[key] = {
        production_code: code,
        production_id: l.production_id,
        production_code_display: prodCode,
        production_name: prodName,
        count: 0
      };
    }
    codeGroups[key].count++;
  });

  console.log(`Tìm thấy tất cả ${Object.keys(codeGroups).length} mã sản xuất gốc khác nhau:`);
  Object.keys(codeGroups).forEach((k, idx) => {
    const g = codeGroups[k];
    console.log(`${idx + 1}. Mã LOT SX gốc: "${g.production_code}"`);
    console.log(`   - Thuộc Lệnh sản xuất: ${g.production_code_display} ("${g.production_name}")`);
    console.log(`   - Số lượng pallet thực tế đang gắn mã này: ${g.count}`);
  });
}

main();
