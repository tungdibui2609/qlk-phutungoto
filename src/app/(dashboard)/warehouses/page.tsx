import ZoneManager from '@/components/warehouse/ZoneManager'

type TabType = 'positions' | 'zones' | 'assignment'

export default function InfrastructurePage() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Quản lý Cấu trúc Kho</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Thiết kế sơ đồ kho, tạo khu vực và vị trí lưu trữ
                </p>
            </div>

            {/* Main Content */}
            <ZoneManager />
        </div>
    )
}
