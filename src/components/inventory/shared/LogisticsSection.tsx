import { OrderSection } from './OrderSection'

interface LogisticsSectionProps {
    vehicleNumber: string
    setVehicleNumber: (v: string) => void
    driverName: string
    setDriverName: (v: string) => void
    containerNumber: string
    setContainerNumber: (v: string) => void
    title?: string
}

export function LogisticsSection({
    vehicleNumber, setVehicleNumber,
    driverName, setDriverName,
    containerNumber, setContainerNumber,
    title = "Vận chuyển & Kho bãi"
}: LogisticsSectionProps) {
    return (
        <OrderSection title={title} color="bg-teal-500">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-stone-500 dark:text-gray-400">Biển số xe</label>
                    <input
                        type="text"
                        value={vehicleNumber}
                        onChange={e => setVehicleNumber(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="VD: 29C-123.45"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-stone-500 dark:text-gray-400">Tài xế/Người giao nhận</label>
                    <input
                        type="text"
                        value={driverName}
                        onChange={e => setDriverName(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="Tên người giao/nhận"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-stone-500 dark:text-gray-400">Container / Số chuyến</label>
                    <input
                        type="text"
                        value={containerNumber}
                        onChange={e => setContainerNumber(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="Số container..."
                    />
                </div>
            </div>
        </OrderSection>
    )
}
