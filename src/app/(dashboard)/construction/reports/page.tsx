export default function ConstructionReportsPage() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Báo Cáo Công Trình</h2>
                    <p className="text-sm text-gray-500">Tổng hợp số liệu hoạt động và chi phí theo công trình</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 h-64 flex items-center justify-center">
                    <span className="text-gray-400">Báo cáo Xuất/Nhập tồn theo Công trình</span>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 h-64 flex items-center justify-center">
                    <span className="text-gray-400">Báo cáo hao hụt / hư hỏng thiết bị</span>
                </div>
            </div>
        </div>
    )
}
