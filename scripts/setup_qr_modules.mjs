import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.INTERNAL_SUPABASE_URL || 'http://127.0.0.1:64321';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const QR_MODULES = [
    {
        id: 'qr_pallets',
        name: 'Quản lý Pallet Quét',
        description: 'Quản lý, kiểm đếm và theo dõi danh sách Pallet đã quét tem / mã QR theo thời gian thực.',
        category: 'qr',
        is_basic: true
    },
    {
        id: 'qr_lot_labels',
        name: 'Liên kết Tem Thùng',
        description: 'Quét và gán liên kết mã tem thùng / mã thùng hàng với lô hàng LOT.',
        category: 'qr',
        is_basic: true
    },
    {
        id: 'qr_lot_labels_mobile',
        name: 'Liên kết Tem (Mobile)',
        description: 'Giao diện di động thao tác nhanh quét liên kết tem thùng trực tiếp tại xưởng.',
        category: 'qr',
        is_basic: true
    },
    {
        id: 'qr_stamp_lookup',
        name: 'Tra cứu tem',
        description: 'Công cụ tra cứu thông tin chi tiết nguồn gốc và trạng thái của mã tem thùng, dấu đóng.',
        category: 'qr',
        is_basic: true
    },
    {
        id: 'utility_qr_assign',
        name: 'Gán vị trí (Quét QR)',
        description: 'Quét mã QR để gán nhanh vị trí kho cho Pallet và sản phẩm.',
        category: 'qr',
        is_basic: true
    },
    {
        id: 'qr_export',
        name: 'Xuất kho (Quét QR)',
        description: 'Thao tác quét mã QR thùng/pallet để thực hiện thủ tục xuất kho chính xác.',
        category: 'qr',
        is_basic: true
    },
    {
        id: 'qr_export_order',
        name: 'Lệnh xuất (Quét QR)',
        description: 'Quét mã kiểm tra và xuất kho theo lệnh điều động xuất hàng.',
        category: 'qr',
        is_basic: true
    },
    {
        id: 'qr_print_station',
        name: 'Máy in trạm',
        description: 'Quản lý máy in trạm tại các chốt kiểm soát quét mã và in tem nhãn.',
        category: 'qr',
        is_basic: true
    },
    {
        id: 'qr_mobile_access',
        name: 'Mobile (Quét QR)',
        description: 'Trung tâm điều hướng giao diện quét mã QR trên thiết bị di động / máy quét cầm tay.',
        category: 'qr',
        is_basic: true
    },
    {
        id: 'qr_production_lot',
        name: 'LOT Sản Xuất',
        description: 'Quét kiểm tra và theo dõi tiến độ LOT thành phẩm trong dây chuyền sản xuất.',
        category: 'qr',
        is_basic: true
    }
];

async function main() {
    console.log('1. Upserting into app_modules...');
    for (const mod of QR_MODULES) {
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
    const qrIds = QR_MODULES.map(m => m.id);
    const { data: companies, error: compErr } = await supabase.from('companies').select('id, unlocked_modules');
    if (compErr) {
        console.error('Error fetching companies:', compErr);
    } else {
        for (const c of companies) {
            const current = Array.isArray(c.unlocked_modules) ? c.unlocked_modules : [];
            const merged = Array.from(new Set([...current, ...qrIds]));
            const { error: updErr } = await supabase.from('companies').update({ unlocked_modules: merged }).eq('id', c.id);
            if (updErr) console.error(`Error updating company ${c.id}:`, updErr);
            else console.log(`✓ Company ${c.id} updated.`);
        }
    }

    console.log('3. Updating systems qr_modules...');
    const { data: systems, error: sysErr } = await supabase.from('systems').select('id, name, modules, qr_modules');
    if (sysErr) {
        console.error('Error fetching systems:', sysErr);
    } else {
        for (const s of systems) {
            let modulesObj = (typeof s.modules === 'object' && s.modules !== null && !Array.isArray(s.modules))
                ? s.modules
                : {};
            let currentQr = Array.isArray(modulesObj.qr_modules)
                ? modulesObj.qr_modules
                : (Array.isArray(s.qr_modules) && s.qr_modules.length > 0 ? s.qr_modules : qrIds);

            modulesObj = {
                ...modulesObj,
                qr_modules: currentQr
            };

            const { error: updSysErr } = await supabase.from('systems').update({
                qr_modules: currentQr,
                modules: modulesObj
            }).eq('id', s.id);

            if (updSysErr) console.error(`Error updating system ${s.name}:`, updSysErr);
            else console.log(`✓ System ${s.name} qr_modules updated.`);
        }
    }

    console.log('Done setup QR modules!');
}

main().catch(console.error);
