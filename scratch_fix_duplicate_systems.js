const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?[\s\r]*$/);
  if (match) {
    envVars[match[1]] = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
  }
});

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log('=== KIỂM TRA DUPLICATE SYSTEMS ===\n');

    const { data: systems, error } = await supabase
        .from('systems')
        .select('id, code, name, company_id, created_at, sort_order')
        .order('code')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Lỗi khi fetch systems:', error);
        return;
    }

    console.log(`Tổng số systems: ${systems.length}`);
    console.log('\nDanh sách tất cả systems:');
    systems.forEach(s => {
        console.log(`  [${s.id}] code="${s.code}" | name="${s.name}" | company_id=${s.company_id} | created=${s.created_at}`);
    });

    // Tìm duplicates (theo code + company_id)
    const codeCount = {};
    systems.forEach(s => {
        const key = `${s.code}__${s.company_id}`;
        if (!codeCount[key]) codeCount[key] = [];
        codeCount[key].push(s);
    });

    const duplicates = Object.entries(codeCount).filter(([, items]) => items.length > 1);

    if (duplicates.length === 0) {
        console.log('\n✅ Không có duplicate! DB sạch.');
        return;
    }

    console.log('\n⚠️  PHÁT HIỆN DUPLICATE:');
    const idsToDelete = [];
    duplicates.forEach(([key, items]) => {
        console.log(`\n  Key: ${key} (${items.length} bản ghi)`);
        const [keep, ...rest] = items;
        console.log(`    -> GIỮ: [${keep.id}] created=${keep.created_at}`);
        rest.forEach(r => {
            console.log(`    -> XÓA: [${r.id}] created=${r.created_at}`);
            idsToDelete.push(r.id);
        });
    });

    if (idsToDelete.length === 0) return;

    console.log(`\nSẽ xóa ${idsToDelete.length} bản ghi trùng: ${idsToDelete.join(', ')}`);
    console.log('Đang xóa...');

    const { error: deleteError } = await supabase
        .from('systems')
        .delete()
        .in('id', idsToDelete);

    if (deleteError) {
        console.error('Lỗi khi xóa:', deleteError);
    } else {
        console.log('✅ Đã xóa thành công các bản ghi trùng lặp!');
    }
}

main().catch(console.error);
