export default function ConstructionMembersPage() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Thành viên & Đội nhóm</h2>
                    <p className="text-sm text-gray-500">Quản lý danh sách nhân sự, chỉ huy trưởng và các đội thi công</p>
                </div>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                    + Thêm thành viên
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 text-center">
                <div className="max-w-md mx-auto">
                    <p className="text-gray-500 mb-4">
                        Đây là nơi bạn quản lý thông tin nhân sự công trình (thay vì phải vào mục Cài đặt chung).
                    </p>
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-400">
                        Danh sách thành viên sẽ được hiển thị ở đây
                    </div>
                </div>
            </div>
        </div>
    )
}
