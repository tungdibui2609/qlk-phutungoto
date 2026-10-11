import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.INTERNAL_SUPABASE_URL || 'http://127.0.0.1:64321';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const NEW_MODULES = [
    {
        id: 'product_aliases',
        name: 'Tên gõ tắt',
        description: 'Thiết lập danh sách tên viết tắt, từ khóa gõ tắt để tìm kiếm nhanh sản phẩm trên sơ đồ kho và tạo phiếu.',
        category: 'product',
        is_basic: true
    },
    {
        id: 'stamp_rules',
        name: 'Cấu hình Dấu Đóng',
        description: 'Thiết lập quy tắc, khuôn định dạng và phân tích giải mã ký hiệu dấu đóng mực trên bao bì/thùng hàng.',
        category: 'product',
        is_basic: true
    }
];

async function main() {
    console.log('1. Upserting into app_modules...');
    for (const mod of NEW_MODULES) {
        const { error } = await supabase.from('app_modules').upsert({
            id: mod.id,
            name: mod.name,
            description: mod.description,
            category: mod.category,
            is_basic: true
        }, { onConflict: 'id' });
        if (error) console.error(`Error inserting ${mod.id}:`, error);
        else console.log(`✓ Module ${mod.id} upserted as basic`);
    }

    console.log('2. Updating companies.unlocked_modules...');
    const newIds = NEW_MODULES.map(m => m.id);
    const { data: companies, error: compErr } = await supabase.from('companies').select('id, unlocked_modules');
    if (compErr) {
        console.error('Error fetching companies:', compErr);
    } else {
        for (const c of companies) {
            const current = Array.isArray(c.unlocked_modules) ? c.unlocked_modules : [];
            const merged = Array.from(new Set([...current, ...newIds]));
            const { error: updErr } = await supabase.from('companies').update({ unlocked_modules: merged }).eq('id', c.id);
            if (updErr) console.error(`Error updating company ${c.id}:`, updErr);
            else console.log(`✓ Company ${c.id} updated.`);
        }
    }

    console.log('3. Updating systems modules...');
    const { data: systems, error: sysErr } = await supabase.from('systems').select('id, name, modules');
    if (sysErr) {
        console.error('Error fetching systems:', sysErr);
    } else {
        for (const s of systems) {
            let modulesObj = (typeof s.modules === 'object' && s.modules !== null && !Array.isArray(s.modules))
                ? s.modules
                : {};
            let currentProducts = Array.isArray(modulesObj.product_modules) ? modulesObj.product_modules : [];
            const mergedProducts = Array.from(new Set([...currentProducts, ...newIds]));

            modulesObj = {
                ...modulesObj,
                product_modules: mergedProducts
            };

            const { error: updSysErr } = await supabase.from('systems').update({ modules: modulesObj }).eq('id', s.id);
            if (updSysErr) console.error(`Error updating system ${s.name}:`, updSysErr);
            else console.log(`✓ System ${s.name} product_modules updated.`);
        }
    }

    console.log('Done setup product aliases and stamp rules modules!');
}

main().catch(console.error);
