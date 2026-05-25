import LotReconciliationTable from '@/components/accounting/LotReconciliationTable'

export const metadata = {
    title: 'Đối chiếu Kế toán & Lot | AnyWarehouse',
    description: 'Đối chiếu số liệu nhập kho kế toán và quản lý lot',
}

export default function AccountingReconciliationPage() {
    return (
        <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-stone-50 overflow-hidden">
            <LotReconciliationTable />
        </div>
    )
}
