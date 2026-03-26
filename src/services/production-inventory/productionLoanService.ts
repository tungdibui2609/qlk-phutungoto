import { SupabaseClient } from '@supabase/supabase-js'
import { lotService } from '../warehouse/lotService'

export const productionLoanService = {
    async getActiveLoans(supabase: SupabaseClient, systemCode: string) {
        const { data, error } = await supabase
            .from('production_loans')
            .select(`
                *,
                products (
                   id, name, sku, system_type
                ),
                productions (
                   id, code, name
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
                ),
                productions (
                   id, code, name
                )
            `)
            .eq('system_code', systemCode)
            .order('created_at', { ascending: false })
            .limit(200)

        if (error) throw error
        return data || []
    },

    async issueLoan({ supabase, lotItemId, productId, workerName, quantity, unit, systemCode, productionId, notes }: {
        supabase: SupabaseClient,
        lotItemId: string,
        productId: string,
        workerName: string,
        quantity: number,
        unit: string,
        systemCode: string,
        productionId?: string,
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
                system_code: systemCode,
                production_id: productionId
            })
            .select()
            .single()

        if (loanError) throw loanError

        return loan
    },

    async issueLoanFIFO({ supabase, productId, workerName, totalQuantity, unit, systemCode, productionId, notes, tag }: {
        supabase: SupabaseClient,
        productId: string,
        workerName: string,
        totalQuantity: number,
        unit: string,
        systemCode: string,
        productionId?: string,
        notes?: string,
        tag?: string
    }) {
        const { error } = await supabase.rpc('issue_production_loan_fifo', {
            p_product_id: productId,
            p_worker_name: workerName,
            p_total_quantity: totalQuantity,
            p_unit: unit,
            p_system_code: systemCode,
            p_production_id: productionId || null,
            p_notes: notes || null,
            p_tag: tag || null
        })

        if (error) throw error
        return true
    },

    async returnLoan({ supabase, loanId, returnDate, notes, status = 'returned', returnedQuantity }: {
        supabase: SupabaseClient,
        loanId: string,
        returnDate: string,
        notes?: string,
        status?: 'returned' | 'lost' | 'active' | 'consumed',
        returnedQuantity: number // This is the quantity returned in THIS specific session
    }) {
        // 1. Fetch current loan data to calculate total returned
        const { data: loan, error: fetchError } = await (supabase.from('production_loans') as any)
            .select('quantity, returned_quantity, status')
            .eq('id', loanId)
            .single()

        if (fetchError) throw fetchError

        const newTotalReturned = (Number(loan.returned_quantity) || 0) + Number(returnedQuantity)
        
        // Determine new status:
        // If user marked as 'lost', status is 'lost'.
        // If 'consumed', force status to 'returned' (to close it) without necessarily returning all.
        // If 'returned' but total < original quantity, stay 'active'.
        let newStatus = status
        if (status === 'returned') {
            newStatus = (newTotalReturned >= Number(loan.quantity)) ? 'returned' : 'active'
        } else if (status === 'consumed') {
            newStatus = 'returned'
        }

        const { error } = await (supabase.from('production_loans') as any)
            .update({
                status: newStatus,
                return_date: returnDate,
                notes: notes,
                returned_quantity: newTotalReturned
            })
            .eq('id', loanId)

        if (error) throw error
        return true
    },

    async updateLoan({ supabase, loanId, workerName, quantity, unit, notes, productionId }: {
        supabase: SupabaseClient,
        loanId: string,
        workerName: string,
        quantity: number,
        unit: string,
        notes?: string,
        productionId?: string
    }) {
        const { error } = await (supabase.from('production_loans') as any)
            .update({
                worker_name: workerName,
                quantity: quantity,
                unit: unit,
                notes: notes,
                production_id: productionId || null
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
    },

    async getInProgressProductions(supabase: SupabaseClient, companyId: string) {
        const { data, error } = await supabase
            .from('productions')
            .select('id, code, name')
            .eq('company_id', companyId)
            .eq('status', 'IN_PROGRESS')
            .order('code', { ascending: false })

        if (error) throw error
        return data || []
    },

    async getAllocationStatsByProduction(supabase: SupabaseClient, systemCode: string) {
        const { data, error } = await supabase
            .from('production_allocation_statistics')
            .select('*')
            .order('production_code', { ascending: false })

        if (error) throw error
        return data || []
    },

    async getProductUnits(supabase: SupabaseClient, productId: string) {
        // 1. Get base unit from products
        const { data: product } = await supabase.from('products').select('unit').eq('id', productId).single()
        
        // 2. Get conversions
        const { data: conversions, error } = await (supabase.from('product_units') as any)
            .select(`
                conversion_rate,
                units!inner (id, name)
            `)
            .eq('product_id', productId)

        const units: any[] = []
        if (product?.unit) {
            units.push({ name: product.unit, rate: 1 })
        }

        if (conversions) {
            conversions.forEach((c: any) => {
                // Avoid duplicating base unit if it's also in conversions
                if (normalizeUnit(c.units.name) !== normalizeUnit(product?.unit)) {
                    units.push({ name: c.units.name, rate: c.conversion_rate })
                }
            })
        }

        return units
    },

    async deleteLoan(supabase: SupabaseClient, loan: any) {
        // 1. Calculate how much to return (Original quantity - already returned)
        const returnQty = Number(loan.quantity || 0) - Number(loan.returned_quantity || 0)
        
        if (returnQty > 0 && loan.status === 'active') {
            // Find rate
            const units = await this.getProductUnits(supabase, loan.product_id)
            const unitData = units.find((u: any) => normalizeUnit(u.name) === normalizeUnit(loan.unit))
            const rate = unitData?.rate || 1
            const baseReturnQty = returnQty * rate

            // Return to stock
            const { data: item } = await (supabase.from('lot_items') as any).select('quantity').eq('id', loan.lot_item_id).single()
            if (item) {
                await (supabase.from('lot_items') as any).update({ 
                    quantity: (item.quantity || 0) + baseReturnQty 
                }).eq('id', loan.lot_item_id)
                
                // Sync LOT
                const { data: lotItem } = await (supabase.from('lot_items') as any).select('lot_id').eq('id', loan.lot_item_id).single()
                if (lotItem) {
                    await lotService.syncLotStatus({ supabase, lotId: lotItem.lot_id, isSiteIssuance: true })
                }
            }
        }

        // 2. Delete the record
        const { error } = await supabase.from('production_loans').delete().eq('id', loan.id)
        if (error) throw error
        return true
    }
}

const normalizeUnit = (s: string | null | undefined): string => {
    if (!s) return '';
    return s.normalize('NFC').toLowerCase().trim();
};
