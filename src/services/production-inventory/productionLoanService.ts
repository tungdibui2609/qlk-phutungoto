import { SupabaseClient } from '@supabase/supabase-js'

export const productionLoanService = {
    async getActiveLoans(supabase: SupabaseClient, systemCode: string) {
        const { data, error } = await supabase
            .from('production_loans')
            .select(`
                *,
                products (
                   id, name, sku, system_type
                )
            `)
            .eq('system_code', systemCode)
            .eq('status', 'active')
            .order('created_at', { ascending: false })

        if (error) throw error
        return data || []
    },

    async getHistory(supabase: SupabaseClient, systemCode: string) {
        const { data, error } = await supabase
            .from('production_loans')
            .select(`
                *,
                products (
                   id, name, sku, system_type
                )
            `)
            .eq('system_code', systemCode)
            .neq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(100)

        if (error) throw error
        return data || []
    },

    async issueLoan({ supabase, lotItemId, productId, workerName, quantity, unit, systemCode, notes }: {
        supabase: SupabaseClient,
        lotItemId: string,
        productId: string,
        workerName: string,
        quantity: number,
        unit: string,
        systemCode: string,
        notes?: string
    }) {
        const { data: loan, error: loanError } = await (supabase.from('production_loans') as any)
            .insert({
                lot_item_id: lotItemId,
                product_id: productId,
                worker_name: workerName,
                quantity,
                unit,
                notes,
                status: 'active',
                system_code: systemCode
            })
            .select()
            .single()

        if (loanError) throw loanError

        return loan
    },

    async returnLoan({ supabase, loanId, returnDate, notes, status = 'returned' }: {
        supabase: SupabaseClient,
        loanId: string,
        returnDate: string,
        notes?: string,
        status?: 'returned' | 'lost'
    }) {
        const { error } = await (supabase.from('production_loans') as any)
            .update({
                status: status,
                return_date: returnDate,
                notes: notes 
            })
            .eq('id', loanId)

        if (error) throw error
        return true
    },

    async getLoanStats(supabase: SupabaseClient, systemCode: string) {
        const { count: activeLoans, error: loanError } = await supabase
            .from('production_loans')
            .select('*', { count: 'exact', head: true })
            .eq('system_code', systemCode)
            .eq('status', 'active')

        if (loanError) throw loanError

        const { data: activeLoanData, error: sumError } = await supabase
            .from('production_loans')
            .select('quantity')
            .eq('system_code', systemCode)
            .eq('status', 'active')

        if (sumError) throw sumError

        const totalIssuedItems = activeLoanData?.reduce((acc, curr) => acc + Number(curr.quantity), 0) || 0

        return {
            activeLoans: activeLoans || 0,
            totalIssuedItems
        }
    },

    async getRecentActivities(supabase: SupabaseClient, systemCode: string, limit = 10) {
        const { data, error } = await supabase
            .from('production_loans')
            .select(`
                *,
                products (
                   id, name, sku, system_type
                )
            `)
            .eq('system_code', systemCode)
            .order('created_at', { ascending: false })
            .limit(limit)

        if (error) throw error
        return data || []
    },

    async getSiteInventorySummary(supabase: SupabaseClient, systemCode: string) {
        // 1. Lấy tồn kho "Sẵn sàng" từ lot_items
        const { data: stockData, error: stockError } = await supabase
            .from('lot_items')
            .select(`
                quantity,
                unit,
                products!inner (id, name, sku, system_type)
            `)
            .eq('products.system_type', systemCode)
            .gt('quantity', 0)

        if (stockError) throw stockError

        // 2. Lấy hàng "Đang cấp phát" từ production_loans
        const { data: loanData, error: loanError } = await supabase
            .from('production_loans')
            .select(`
                quantity,
                unit,
                products!inner (id, name, sku, system_type)
            `)
            .eq('system_code', systemCode)
            .eq('status', 'active')

        if (loanError) throw loanError

        const summaryMap: Record<string, any> = {}

        stockData?.forEach(item => {
            const p = item.products as any
            if (!summaryMap[p.id]) {
                summaryMap[p.id] = { productId: p.id, name: p.name, sku: p.sku, unit: item.unit, inStock: 0, inUse: 0 }
            }
            summaryMap[p.id].inStock += Number(item.quantity)
        })

        loanData?.forEach(item => {
            const p = item.products as any
            if (!summaryMap[p.id]) {
                summaryMap[p.id] = { productId: p.id, name: p.name, sku: p.sku, unit: item.unit, inStock: 0, inUse: 0 }
            }
            summaryMap[p.id].inUse += Number(item.quantity)
        })

        return Object.values(summaryMap).sort((a: any, b: any) => a.name.localeCompare(b.name))
    },

    async getInboundHistory(supabase: SupabaseClient, systemCode: string) {
        const { data, error } = await supabase
            .from('lots')
            .select(`
                *,
                suppliers(name),
                lot_items(
                    quantity,
                    unit,
                    products(name, sku)
                )
            `)
            .eq('system_code', systemCode)
            .ilike('code', 'PROD-%') // Changed from SITE- to PROD-
            .order('created_at', { ascending: false })
            .limit(50)

        if (error) throw error
        return data
    }
}
