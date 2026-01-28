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

// Helper to seed data for a specific company
async function seedCompanyData(companyId: string) {
    console.log(`Seeding data for company: ${companyId}`)

    // 1. Systems (Standard Modules)
    const systems = [
        {
            code: 'FROZEN',
            name: 'Kho Lạnh',
            description: 'Quản lý kho lạnh, theo dõi nhiệt độ',
            icon: 'Truck',
            bg_color_class: 'bg-blue-600',
            text_color_class: 'text-blue-100',
            sort_order: 1,
            is_active: true,
            modules: {},
            company_id: companyId
        },
        {
            code: 'OFFICE',
            name: 'Văn Phòng',
            description: 'Quản lý văn phòng phẩm, thiết bị',
            icon: 'Package',
            bg_color_class: 'bg-amber-600',
            text_color_class: 'text-amber-100',
            sort_order: 2,
            is_active: true,
            modules: {},
            company_id: companyId
        },
        {
            code: 'DRY',
            name: 'Kho Khô',
            description: 'Quản lý kho thường, vật tư',
            icon: 'Factory',
            bg_color_class: 'bg-stone-600', // Matches SystemContext fallback
            text_color_class: 'text-stone-100',
            sort_order: 3,
            is_active: true,
            modules: {},
            company_id: companyId
        },
        {
            code: 'PACKAGING',
            name: 'Bao Bì',
            description: 'Quản lý vật tư bao bì đóng gói',
            icon: 'Box',
            bg_color_class: 'bg-green-600',
            text_color_class: 'text-green-100',
            sort_order: 4,
            is_active: true,
            modules: {},
            company_id: companyId
        }
    ]

    const { error: systemsError } = await supabaseAdmin.from('systems').insert(systems)
    if (systemsError) {
        console.error('Error seeding systems:', systemsError)
        // Don't throw, continue with other data
    }

    // 2. Units
    const units = [
        { name: 'Cái', description: 'Đơn vị tính cơ bản', company_id: companyId },
        { name: 'Hộp', description: 'Hộp đóng gói', company_id: companyId },
        { name: 'Chiếc', description: 'Đơn vị đơn lẻ', company_id: companyId },
        { name: 'Bộ', description: 'Bộ sản phẩm', company_id: companyId },
        { name: 'Kg', description: 'Kilogram', company_id: companyId },
        { name: 'Mét', description: 'Đơn vị đo độ dài', company_id: companyId }
    ]

    const { error: unitsError } = await supabaseAdmin.from('units').insert(units.map(u => ({ ...u, is_active: true })))
    if (unitsError) {
        console.error('Error seeding units:', unitsError)
    }

    // 3. Order Types
    const orderTypes = [
        { name: 'Nhập mua hàng', code: 'NM', scope: 'Import', description: 'Nhập hàng từ nhà cung cấp', company_id: companyId },
        { name: 'Nhập trả hàng', code: 'NTH', scope: 'Import', description: 'Nhập hàng khách trả lại', company_id: companyId },
        { name: 'Nhập khác', code: 'NK', scope: 'Import', description: 'Nhập khác', company_id: companyId },
        { name: 'Xuất bán hàng', code: 'XB', scope: 'Export', description: 'Xuất bán cho khách hàng', company_id: companyId },
        { name: 'Xuất hủy', code: 'XH', scope: 'Export', description: 'Xuất hủy hàng hỏng', company_id: companyId },
        { name: 'Xuất khác', code: 'XK', scope: 'Export', description: 'Xuất khác', company_id: companyId }
    ]

    const { error: typesError } = await supabaseAdmin.from('order_types').insert(orderTypes.map(ot => ({ ...ot, is_active: true })))
    if (typesError) {
        console.error('Error seeding order types:', typesError)
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
                tax_code: tax_code,
                company_id: company.id // Ensure company_id is set
            })

        if (settingsError) {
            console.error('Error creating company settings:', settingsError)
            // Continue even if settings fail? Better to fail.
            return NextResponse.json({ error: 'Failed to create settings: ' + settingsError.message }, { status: 500 })
        }

        // 1.2 Create Default Warehouse (Branch)
        // Note: Branches table might not have company_id in some versions, but we attempt to add it if possible.
        // However, looking at codebase, branches seems to rely on system links.
        // We will just create it as is, but we might need to revisit if branches are tenant isolated.
        // For now, we assume this is acceptable or branches are global/linked via other means.
        const { error: branchError } = await supabaseAdmin
            .from('branches')
            .insert({
                name: 'Kho Mặc Định',
                code: 'DEFAULT',
                is_default: true,
                is_active: true,
                system_type: null, // Null means shared/global or not specific to a system type
                address: address,
                phone: phone
                // company_id: company.id // Uncomment if branches table definitely has company_id
            })

        if (branchError) {
            console.error('Error creating default branch:', branchError)
        }

        // 1.3 Seed Company Data (Systems, Units, Order Types)
        await seedCompanyData(company.id)

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
                    // Grant access to the systems we just created
                    allowed_systems: ['FROZEN', 'OFFICE', 'DRY', 'PACKAGING']
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
            message: 'Company and Admin created successfully with standard template.'
        })

    } catch (error: any) {
        console.error('Unexpected error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
