import { SupabaseClient } from '@supabase/supabase-js'

export const loanService = {
    async getActiveLoans(supabase: SupabaseClient, systemCode: string) {
        // Assuming site_loans is linked to products, and products are linked to system_code
        // But site_loans doesn't have system_code directly. 
        // We might need to filter by product's system_code or add system_code to site_loans.
        // For now, let's assume we filter by filtering products or just fetch all if it's a single system tenant.
        // Better: Join with products.

        const { data, error } = await supabase
            .from('site_loans')
            .select(`
                *,
                products (
                   id, name, sku, system_type
                )
            `)
            .eq('status', 'active')
            .order('created_at', { ascending: false })

        if (error) throw error
        // Client-side filter for system_code if needed
        return data?.filter((loan: any) => loan.products?.system_type === systemCode)
    },

    async getHistory(supabase: SupabaseClient, systemCode: string) {
        const { data, error } = await supabase
            .from('site_loans')
            .select(`
                *,
                products (
                   id, name, sku, system_type
                )
            `)
            .neq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(100)

        if (error) throw error
        return data?.filter((loan: any) => loan.products?.system_type === systemCode)
    },

    async issueLoan({ supabase, lotItemId, productId, workerName, quantity, unit, notes }: {
        supabase: SupabaseClient,
        lotItemId: string,
        productId: string,
        workerName: string,
        quantity: number,
        unit: string,
        notes?: string
    }) {
        // 1. Check stock (optional but recommended)
        // 2. Decrement Stock (This is complex because we need to know WHICH Lot Item to decrement from)
        // For simplicity, we assume the UI passes the specific lot_item_id.

        // Decrement logic is usually handled by `lotService` or direct update. 
        // We need to implement a "consumed" logic here.

        // A. Insert Loan Record
        const { data: loan, error: loanError } = await (supabase.from('site_loans') as any)
            .insert({
                lot_item_id: lotItemId,
                product_id: productId,
                worker_name: workerName,
                quantity,
                unit,
                notes,
                status: 'active'
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
        const { error } = await (supabase.from('site_loans') as any)
            .update({
                status: status,
                return_date: returnDate,
                notes: notes // Append or overwrite? Using overwrite for simplicity now
            })
            .eq('id', loanId)

        if (error) throw error
        return true
    }
}
