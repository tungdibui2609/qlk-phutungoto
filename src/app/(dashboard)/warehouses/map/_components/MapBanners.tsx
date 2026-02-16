'use client'

import { MapPin } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface MapBannersProps {
    isDesignMode: boolean
    assignLot: { id: string, code: string } | null
}

export function MapBanners({ isDesignMode, assignLot }: MapBannersProps) {
    const router = useRouter()

    return (
        <>
            {/* Design mode hint */}
            {isDesignMode && (
                <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300 animate-in fade-in slide-in-from-top-2">
                    💡 Bấm nút <strong>"Cấu hình"</strong> trên mỗi zone để điều chỉnh số cột và cách bố trí.
                </div>
            )}

            {/* LOT Assignment Mode Banner */}
            {assignLot && (
                <div className="sticky top-4 z-40 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-xl p-4 shadow-lg animate-in slide-in-from-top-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-300 shrink-0">
                            <MapPin size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-purple-900 dark:text-purple-100">
                                Đang gán: <span className="font-mono text-lg">{assignLot.code}</span>
                            </h3>
                            <p className="text-sm text-purple-700 dark:text-purple-300">
                                Chọn vị trí để gán/bỏ gán.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => router.push('/warehouses/lots')}
                            className="hidden sm:block px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors shadow-sm"
                        >
                            Quay lại
                        </button>
                        <button
                            onClick={() => router.push('/warehouses/lots')}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-colors shadow-md shadow-purple-500/20 whitespace-nowrap"
                        >
                            Hoàn tất
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}
