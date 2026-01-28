import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Initialize Admin Client with Service Role Key
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
)

// Helper to seed data
async function seedMasterData(companyId: string) { // companyId might be needed if RLS uses it implicitly, but tables don't show it.
    // However, we will just insert.
    // 1. Units
    const units = [
        { name: 'Cái', description: 'Đơn vị tính cơ bản' },
        { name: 'Hộp', description: 'Hộp đóng gói' },
        { name: 'Chiếc', description: 'Đơn vị đơn lẻ' },
        { name: 'Bộ', description: 'Bộ sản phẩm' },
        { name: 'Kg', description: 'Kilogram' },
        { name: 'Mét', description: 'Đơn vị đo độ dài' }
    ]

    // We use upsert or ignore if exists. Since no unique constraint is visible on name globally (maybe), 
    // we just insert.
    for (const u of units) {
        // Check if exists (optional but safer)
        // const { data } = await supabaseAdmin.from('units').select('id').eq('name', u.name).maybeSingle()
        // if (!data) ... 
        // Actually, just insert.
        await supabaseAdmin.from('units').insert({
            name: u.name,
            description: u.description,
            is_active: true
        })
    }

    // 2. Order Types
    const orderTypes = [
        { name: 'Nhập mua hàng', code: 'NM', scope: 'Import', description: 'Nhập hàng từ nhà cung cấp' },
        { name: 'Nhập trả hàng', code: 'NTH', scope: 'Import', description: 'Nhập hàng khách trả lại' },
        { name: 'Nhập khác', code: 'NK', scope: 'Import', description: 'Nhập khác' },
        { name: 'Xuất bán hàng', code: 'XB', scope: 'Export', description: 'Xuất bán cho khách hàng' },
        { name: 'Xuất hủy', code: 'XH', scope: 'Export', description: 'Xuất hủy hàng hỏng' },
        { name: 'Xuất khác', code: 'XK', scope: 'Export', description: 'Xuất khác' }
    ]

    for (const ot of orderTypes) {
        await supabaseAdmin.from('order_types').insert({
            name: ot.name,
            code: ot.code,
            scope: ot.scope,
            description: ot.description,
            is_active: true
        })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { name, code, address, phone, email, tax_code, admin_name, admin_email, admin_password } = body

        if (!name || !code || !admin_email || !admin_password) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // 1. Create Company
        const { data: company, error: companyError } = await supabaseAdmin
            .from('companies')
            .insert({
                name,
                code,
                address,
                phone,
                email,
                tax_code
            })
            .select()
            .single()

        if (companyError) {
            console.error('Error creating company:', companyError)
            return NextResponse.json({ error: companyError.message }, { status: 500 })
        }

        // 1.1 Create Company Settings
        const { error: settingsError } = await supabaseAdmin
            .from('company_settings')
            .insert({
                id: company.id,
                name: name,
                short_name: name, // Default short name same as name
                email: email,
                phone: phone,
                address: address,
                tax_code: tax_code
            })

        if (settingsError) {
            console.error('Error creating company settings:', settingsError)
            // Continue even if settings fail? Better to fail.
            return NextResponse.json({ error: 'Failed to create settings: ' + settingsError.message }, { status: 500 })
        }

        // 1.2 Create Default Warehouse
        const { error: branchError } = await supabaseAdmin
            .from('branches')
            .insert({
                name: 'Kho Mặc Định',
                code: 'DEFAULT',
                is_default: true,
                is_active: true,
                system_type: null, // Null means shared/global
                address: address,
                phone: phone
            })

        if (branchError) {
            console.error('Error creating default branch:', branchError)
        }




        // 1.3 Seed Master Data (Units, Order Types)
        // Note: Run async without awaiting to not block response? Or await to ensure?
        // Let's await to be safe.
        await seedMasterData(company.id)

        // 2. Create Admin User (Auth)
        // using admin.createUser prevents signing in the user on the client side
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: admin_email,
            password: admin_password,
            email_confirm: true,
            user_metadata: { full_name: admin_name }
        })

        if (authError) {
            // Rollback company creation if auth fails? 
            // Ideally yes, but for now we just report error.
            console.error('Error creating auth user:', authError)
            return NextResponse.json({
                error: 'Company created but Admin User failed: ' + authError.message,
                company
            }, { status: 500 })
        }

        // 3. Create Admin Profile (Linked to Company)
        if (authData.user) {
            const { error: profileError } = await supabaseAdmin
                .from('user_profiles')
                .insert({
                    id: authData.user.id,
                    full_name: admin_name,
                    email: admin_email,
                    company_id: company.id,
                    permissions: ['system.full_access'],
                    is_active: true,
                    allowed_systems: ['FROZEN', 'OFFICE', 'DRY']
                })

            if (profileError) {
                console.error('Error creating profile:', profileError)
                return NextResponse.json({
                    error: 'Company & User created but Profile failed: ' + profileError.message,
                    company
                }, { status: 500 })
            }
        }

        return NextResponse.json({
            success: true,
            company,
            message: 'Company and Admin created successfully'
        })

    } catch (error: any) {
        console.error('Unexpected error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
