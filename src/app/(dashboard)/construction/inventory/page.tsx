export default function ConstructionInventoryPage() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Kho Công Trình</h2>
                    <p className="text-sm text-gray-500">Quản lý nhập xuất và tồn kho tại các công trình</p>
                </div>
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                        Xuất Kho (Trả về)
                    </button>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                        Nhập Kho (Cấp phát)
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 text-center">
                <div className="max-w-md mx-auto">
                    <p className="text-gray-500 mb-4">
                        Module này tích hợp các chức năng Nhập/Xuất kho nhưng chỉ lọc riêng cho Công Trình.
                    </p>
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-400">
                        Danh sách vật tư tồn công trình sẽ hiển thị ở đây
                    </div>
                </div>
            </div>
        </div>
    )
}
