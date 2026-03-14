'use client'

import React from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/Dialog'
import { HelpCircle, Search, Info, CheckCircle2, Tag, Package, Hash, MapPin, Layers, LayoutGrid } from 'lucide-react'

interface SearchHelpModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
}

export function SearchHelpModal({ isOpen, onOpenChange }: SearchHelpModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh] rounded-3xl">
                <DialogHeader className="space-y-3">
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900/40 rounded-xl text-orange-600 dark:text-orange-400">
                            <HelpCircle size={24} />
                        </div>
                        Hướng dẫn tìm kiếm
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 dark:text-slate-400 text-base">
                        Hệ thống hỗ trợ các tính năng tìm kiếm thông minh và chọn lọc theo phân loại để có kết quả chính xác nhất.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Giới thiệu chế độ */}
                    <div>
                        <p className="text-sm dark:text-slate-300">
                            Khi bạn chọn một chế độ (như Tên, Mã, hoặc Vị trí), việc tìm kiếm sẽ chỉ tập trung vào phần đó, giúp kết quả chính xác và nhanh hơn.
                        </p>
                    </div>

                    {/* Các chế độ */}
                    <div className="space-y-4">
                        <h4 className="font-semibold text-primary flex items-center gap-2">
                            <Layers className="h-4 w-4" /> Các chế độ tìm kiếm
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
                                <div className="flex items-center gap-2 mb-1 font-medium text-blue-600 dark:text-blue-400">
                                    <LayoutGrid className="h-4 w-4" /> Tổng hợp
                                </div>
                                <p className="text-sm text-muted-foreground italic">Chế độ mặc định. Tìm kiếm trên tất cả các trường dữ liệu (Tên, Mã, Ghi chú, Tag...).</p>
                            </div>
                            <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
                                <div className="flex items-center gap-2 mb-1 font-medium text-green-600 dark:text-green-400">
                                    <Package className="h-4 w-4" /> Theo Tên
                                </div>
                                <p className="text-sm text-muted-foreground italic">Chỉ tìm theo Tên sản phẩm, Tên nội bộ. Ví dụ: "Xoài Cat", "Chanh dây".</p>
                            </div>
                            <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
                                <div className="flex items-center gap-2 mb-1 font-medium text-amber-600 dark:text-amber-400">
                                    <Hash className="h-4 w-4" /> Theo Mã
                                </div>
                                <p className="text-sm text-muted-foreground italic">Tìm theo Mã Lot, SKU, Mã nội bộ. Ví dụ: "LOT2403", "SKU123".</p>
                            </div>
                            <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
                                <div className="flex items-center gap-2 mb-1 font-medium text-purple-600 dark:text-purple-400">
                                    <Tag className="h-4 w-4" /> Theo Mã phụ (Tag)
                                </div>
                                <p className="text-sm text-muted-foreground italic">Tìm chính xác trong các thẻ tag đã gắn. Ví dụ: "Hàng loại A", "Ưu tiên".</p>
                            </div>
                            <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
                                <div className="flex items-center gap-2 mb-1 font-medium text-red-600 dark:text-red-400">
                                    <MapPin className="h-4 w-4" /> Theo Vị trí
                                </div>
                                <p className="text-sm text-muted-foreground italic">Tìm theo mã vị trí (ngay cả vị trí sâu trong kho). Ví dụ: "A01", "K1D1".</p>
                            </div>
                            <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
                                <div className="flex items-center gap-2 mb-1 font-medium text-teal-600 dark:text-teal-400">
                                    <Layers className="h-4 w-4" /> Theo Danh mục
                                </div>
                                <p className="text-sm text-muted-foreground italic">Tìm sản phẩm thuộc danh mục. Hỗ trợ tìm đa danh mục. Ví dụ: "Trái cây", "Điện tử".</p>
                            </div>
                        </div>
                    </div>

                    {/* Cú pháp nâng cao */}
                    <div className="space-y-4">
                        <h4 className="font-semibold text-primary">Cú pháp nâng cao (Áp dụng cho TẤT CẢ các chế độ)</h4>
                        <div className="space-y-3">
                            <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/50 rounded-xl">
                                <div className="flex items-start gap-3">
                                    <div className="mt-1 p-2 bg-orange-100 dark:bg-orange-900/40 rounded-full text-orange-600">
                                        <Info className="h-4 w-4" />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium">Bạn có thể kết hợp nhiều điều kiện tìm kiếm:</p>
                                        <ul className="text-sm space-y-2 text-muted-foreground">
                                            <li className="flex gap-2">
                                                <span className="font-mono text-orange-600 font-bold">;</span>
                                                <span>Dùng dấu chấm phẩy để tìm <b>HOẶC</b> (Nhiều kết quả cùng lúc). <br/>Ví dụ chế độ Mã: <code className="bg-muted px-1 rounded">LOT1 ; LOT2</code></span>
                                            </li>
                                            <li className="flex gap-2">
                                                <span className="font-mono text-orange-600 font-bold">&</span>
                                                <span>Dùng dấu và để tìm <b>VÀ</b> (Bắt buộc thỏa mãn cả hai). <br/>Ví dụ chế độ Tên: <code className="bg-muted px-1 rounded">Xoài & Cửa hàng</code></span>
                                            </li>
                                            <li className="flex gap-2">
                                                <span className="font-mono text-orange-600 font-bold">Dấu cách</span>
                                                <span>Trong chế độ Tổng hợp, dấu cách dùng để tìm nhanh nhiều mã vị trí. <br/>Ví dụ: <code className="bg-muted px-1 rounded">A01 B02 C03</code></span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Mẹo FIFO */}
                    <div className="space-y-3">
                        <h4 className="font-semibold text-primary">Mẹo tìm kiếm</h4>
                        <div className="bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/50">
                            <p className="text-sm dark:text-slate-300 leading-relaxed">
                                Khi bật chế độ <strong>FIFO</strong>, các lô hàng có ngày nhập kho <strong>cũ nhất</strong> sẽ luôn được đẩy lên đầu kết quả tìm kiếm.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="pt-2">
                    <button
                        onClick={() => onOpenChange(false)}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-2xl transition-all shadow-lg active:scale-95"
                    >
                        Tôi đã hiểu
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
