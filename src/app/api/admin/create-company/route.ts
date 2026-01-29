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
            code: 'DEFAULT',
            name: 'Kho Mặc Định',
            description: 'Hệ thống kho mặc định',
            icon: 'Warehouse',
            bg_color_class: 'bg-blue-600',
            text_color_class: 'text-blue-100',
            sort_order: 1,
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

        // 0. Pre-check: Verify if Admin Email already acts to prevent "Ghost Company" creation
        // Note: listUsers is admin-only.
        const { data: { users: existingUsers }, error: checkError } = await supabaseAdmin.auth.admin.listUsers()
        if (!checkError && existingUsers) {
            const existingUser = existingUsers.find(u => u.email?.toLowerCase() === admin_email.toLowerCase())

            if (existingUser) {
                // Check if this is a "Zombie/Orphan" user (exists in Auth but no Profile or Company)
                // This happens if Company was deleted but Auth User remained.
                const { data: profile } = await supabaseAdmin
                    .from('user_profiles')
                    .select('id, company_id')
                    .eq('id', existingUser.id)
                    .maybeSingle()

                if (!profile) {
                    // Scenario A: Auth User exists, but NO Profile. -> Zombie.
                    console.log(`Found Zombie User ${admin_email} (No Profile). Cleaning up...`)
                    await supabaseAdmin.auth.admin.deleteUser(existingUser.id)
                    // Proceed to create new user...
                } else {
                    // Scenario B: Profile exists. Check if Company exists.
                    // If company was deleted with cascade, profile should be gone. 
                    // But if profile remains with null company_id?
                    if (!profile.company_id) {
                        console.log(`Found Zombie User ${admin_email} (Profile with no Company). Cleaning up...`)
                        // Delete profile first to be safe (though deleteUser cascades usually)
                        await supabaseAdmin.from('user_profiles').delete().eq('id', existingUser.id)
                        await supabaseAdmin.auth.admin.deleteUser(existingUser.id)
                    } else {
                        // Scenario C: User is valid and belongs to a company.
                        return NextResponse.json({ error: 'Email quản trị viên đã tồn tại và đang thuộc về một công ty khác.' }, { status: 400 })
                    }
                }
            }
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
                // company_id is not in the schema, id is the link
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
                    account_level: 2, // Company Admin level
                    // Grant full access to all current and future systems
                    allowed_systems: ['ALL']
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
