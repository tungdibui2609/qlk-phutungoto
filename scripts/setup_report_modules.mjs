import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.INTERNAL_SUPABASE_URL || 'http://127.0.0.1:64321';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const REPORT_MODULES = [
    {
        id: 'report_hall_summary',
        name: 'Thống kê sảnh',
        description: 'Báo cáo tổng hợp số lượng, trạng thái hàng hóa và vị trí tại các khu vực sảnh',
        category: 'report',
        is_basic: true
    },
    {
        id: 'report_floor_1',
        name: 'Báo cáo tầng 1',
        description: 'Báo cáo chi tiết hoạt động xuất nhập và tồn kho tại khu vực tầng 1',
        category: 'report',
        is_basic: true
    },
    {
        id: 'report_warehouse_map_log',
        name: 'Nhật ký sơ đồ kho',
        description: 'Theo dõi lịch sử thay đổi vị trí, sơ đồ mặt bằng và cấu trúc kho',
        category: 'report',
        is_basic: true
    },
    {
        id: 'report_warehouse_movements',
        name: 'Diễn biến kho (Sạch)',
        description: 'Thống kê luồng luân chuyển hàng hóa sạch và diễn biến xuất nhập tồn',
        category: 'report',
        is_basic: true
    },
    {
        id: 'report_picking_productivity',
        name: 'Năng suất lấy hàng',
        description: 'Báo cáo hiệu suất, tốc độ lấy hàng và năng suất làm việc của nhân sự',
        category: 'report',
        is_basic: true
    }
]

async function run() {
    console.log('Connecting to Supabase at:', SUPABASE_URL)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 1. Upsert into app_modules
    console.log('Upserting modules into app_modules...')
    for (const mod of REPORT_MODULES) {
        const { error } = await supabase.from('app_modules').upsert({
            id: mod.id,
            name: mod.name,
            description: mod.description,
            category: mod.category,
            is_basic: mod.is_basic
        }, { onConflict: 'id' })

        if (error) {
            console.error(`Error upserting ${mod.id}:`, error.message)
        } else {
            console.log(`✓ Upserted ${mod.id}`)
        }
    }

    const reportIds = REPORT_MODULES.map(m => m.id)

    // 2. Add to companies.unlocked_modules
    console.log('Updating companies unlocked_modules...')
    const { data: companies, error: compErr } = await supabase.from('companies').select('id, name, unlocked_modules')
    if (compErr) {
        console.error('Error fetching companies:', compErr.message)
    } else if (companies) {
        for (const comp of companies) {
            const currentUnlocked = Array.isArray(comp.unlocked_modules) ? comp.unlocked_modules : []
            const newUnlocked = Array.from(new Set([...currentUnlocked, ...reportIds]))
            const { error: updErr } = await supabase.from('companies').update({
                unlocked_modules: newUnlocked
            }).eq('id', comp.id)
            if (updErr) {
                console.error(`Error updating company ${comp.name}:`, updErr.message)
            } else {
                console.log(`✓ Updated unlocked_modules for company: ${comp.name}`)
            }
        }
    }

    // 3. Add to systems.report_modules
    console.log('Updating systems report_modules...')
    const { data: systems, error: sysErr } = await supabase.from('systems').select('id, code, name, report_modules, modules')
    if (sysErr) {
        console.error('Error fetching systems:', sysErr.message)
    } else if (systems) {
        for (const sys of systems) {
            const currentRep = Array.isArray(sys.report_modules) ? sys.report_modules : []
            const newRep = Array.from(new Set([...currentRep, ...reportIds]))
            
            let modulesJson = sys.modules || {}
            if (typeof modulesJson === 'object' && !Array.isArray(modulesJson)) {
                modulesJson.report_modules = newRep
            }

            const { error: updErr } = await supabase.from('systems').update({
                report_modules: newRep,
                modules: modulesJson
            }).eq('id', sys.id)

            if (updErr) {
                console.error(`Error updating system ${sys.name || sys.code}:`, updErr.message)
            } else {
                console.log(`✓ Updated report_modules for warehouse: ${sys.name || sys.code}`)
            }
        }
    }

    console.log('Done setup report modules!')
}

run().catch(console.error)
