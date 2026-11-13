'use client'

import React, { useState } from 'react'
import { BookOpen, AlertTriangle, Printer } from 'lucide-react'
import {
    INCIDENT_GROUPS,
    type IncidentGroupTemplate,
    type IncidentTemplateItem,
} from './types'

const INCIDENT_GROUP_PILLAR: Record<
    IncidentGroupTemplate['group'],
    { label: string; className: string }
> = {
    safety_forklift: {
        label: '🛡️ An toàn (việc lao động)',
        className: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    },
    quality_goods: {
        label: '⭐ Chất lượng',
        className: 'bg-amber-100 text-amber-800 border-amber-300',
    },
    inventory_statistics: {
        label: '⭐ Chất lượng (việc thống kê)',
        className: 'bg-amber-100 text-amber-800 border-amber-300',
    },
    operations: {
        label: '⭐ Chất lượng (tồn đọng) • 📋 Kỷ luật',
        className: 'bg-stone-100 text-stone-700 border-stone-300',
    },
    discipline_5s: {
        label: '📋 Kỷ luật & 5S',
        className: 'bg-purple-100 text-purple-800 border-purple-300',
    },
    other: {
        label: '📋 Kỷ luật & 5S',
        className: 'bg-purple-100 text-purple-800 border-purple-300',
    },
}

interface KpiRulesHandbookTabProps {
    systemName?: string
    onNavigateTab?: (tab: 'library' | 'dispatch' | 'evaluate' | 'reports') => void
}

export default function KpiRulesHandbookTab({
    systemName = 'Kho Đông Lạnh',
    onNavigateTab,
}: KpiRulesHandbookTabProps) {
    const [activeSection, setActiveSection] = useState<
        'overview' | 'pillars' | 'task_types' | 'incidents' | 'ranking' | 'faq'
    >('overview')

    const handlePrint = () => {
        window.print()
    }

    return (
        <div className="space-y-6">
            {/* Header Cẩm Nang */}
            <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-700/40 relative overflow-hidden print:p-4 print:bg-white print:text-stone-900 print:border print:border-stone-300">
                <div className="relative z-10 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-indigo-200 text-xs font-bold backdrop-blur-xs border border-white/10 print:border-stone-300 print:text-stone-600 print:bg-stone-100">
                            <BookOpen size={14} className="text-amber-400" />
                            <span>CẨM NANG & QUY CHẾ VẬN HÀNH • {systemName}</span>
                        </div>
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-xs border border-white/20 flex items-center gap-1.5 transition-all print:hidden"
                            title="In hoặc lưu PDF bộ quy chế để dán tại bảng tin nhà xưởng"
                        >
                            <Printer size={15} />
                            <span>In Bộ Quy Chế (A4)</span>
                        </button>
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                        Bộ Quy Tắc Chấm Điểm & Xếp Hạng KPI Nhân Sự Kho
                    </h1>
                    <p className="text-xs sm:text-sm text-indigo-200 max-w-3xl leading-relaxed print:text-stone-600">
                        Tài liệu quy định minh bạch về cách thức hệ thống tính toán năng suất, chất lượng, kỷ luật, thưởng phạt vi phạm và xếp hạng thi đua hằng ngày cho toàn thể nhân sự kho.
                    </p>

                    {/* Quick navigation chips (ẩn khi in) */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 print:hidden">
                        {[
                            { id: 'overview', label: '1. Tôn Chỉ & 2 Loại Việc', icon: '🎯' },
                            { id: 'pillars', label: '2. Thang Điểm Theo Loại Việc', icon: '⚖️' },
                            { id: 'task_types', label: '3. Việc Chính vs Hỗ Trợ', icon: '➕' },
                            { id: 'incidents', label: '4. Bảng Lỗi & Trừ Điểm', icon: '⚠️' },
                            { id: 'ranking', label: '5. Thang Bậc Xếp Loại', icon: '🏆' },
                            { id: 'faq', label: '6. Hỏi Đáp (FAQ)', icon: '❓' },
                        ].map(sec => (
                            <button
                                key={sec.id}
                                type="button"
                                onClick={() => setActiveSection(sec.id as any)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                                    activeSection === sec.id
                                        ? 'bg-white text-indigo-900 shadow-md scale-102'
                                        : 'bg-white/10 text-white hover:bg-white/20'
                                }`}
                            >
                                <span>{sec.icon}</span>
                                <span>{sec.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* PHẦN 1: TÔN CHỈ & NGUYÊN TẮC CỐT LÕI */}
            {(activeSection === 'overview' || activeSection === 'faq') && (
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-4">
                    <div className="flex items-center gap-2.5 border-b border-stone-200 pb-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                            🎯
                        </div>
                        <h2 className="text-base sm:text-lg font-black text-stone-900">
                            1. Tôn Chỉ & Nguyên Tắc Chấm Điểm Minh Bạch
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-2">
                            <div className="font-extrabold text-indigo-900 flex items-center gap-1.5 text-sm">
                                <span>📊</span>
                                <span>Sản Lượng Thật Từ Hệ Thống</span>
                            </div>
                            <p className="text-stone-600 leading-relaxed">
                                Điểm năng suất không dựa trên cảm tính. Mọi số liệu vị trí kệ hạ xếp, khối lượng hàng (kg/tấn), số LOT, số cont xuất nhập đều được liên kết trực tiếp từ Lệnh xuất / Nhập kho thực tế của nhà máy.
                            </p>
                        </div>

                        <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 space-y-2">
                            <div className="font-extrabold text-emerald-900 flex items-center gap-1.5 text-sm">
                                <span>🤝</span>
                                <span>Đánh Giá Theo Thực Tế Cống Hiến</span>
                            </div>
                            <p className="text-stone-600 leading-relaxed">
                                Khi làm việc theo đội nhóm (lái xe nâng, bốc vác xếp dỡ, đai kiện hàng, thống kê kiểm đếm hàng khay...), hệ thống phân bổ theo % đóng góp thực tế. Người hoàn thành việc chính đạt 90–100đ tùy độ nặng. Người tăng cường hỗ trợ việc phụ được ghi nhận <b>điểm hỗ trợ riêng</b>, tích lũy theo tuần/tháng/năm để đánh giá mức độ tích cực hỗ trợ — không cộng vào điểm ngày và không kéo hạng thi đua ngày.
                            </p>
                        </div>

                        <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-100 space-y-2">
                            <div className="font-extrabold text-amber-900 flex items-center gap-1.5 text-sm">
                                <span>🛡️</span>
                                <span>An Toàn & Kỷ Luật Tuyệt Đối</span>
                            </div>
                            <p className="text-stone-600 leading-relaxed">
                                Trong môi trường kho bãi và nhà máy (vận hành xe nâng, bốc xếp hàng hóa, kiểm kê số liệu, làm việc phòng lạnh), mỗi nhóm lỗi chỉ trừ đúng một nhóm điểm và chỉ thuộc loại việc phù hợp: lỗi xe nâng → <b>An toàn</b> (chỉ việc lao động); lỗi hàng hóa → <b>Chất lượng</b> (cả hai loại việc); lỗi số liệu &amp; ghi chép → <b>Chất lượng</b> (chỉ việc thống kê); lỗi vận hành, 5S → <b>Kỷ luật</b>. Sự cố nghiêm trọng sẽ hạ danh hiệu xuống Hạng C.
                            </p>
                        </div>
                    </div>

                    {/* Hai loại công việc — gốc của mọi tiêu chí */}
                    <div className="space-y-3 border-t border-stone-200 pt-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="font-black text-stone-900 text-sm sm:text-base flex items-center gap-1.5">
                                <span>🧭</span>
                                <span>Hai Loại Công Việc — Gốc Của Mọi Tiêu Chí</span>
                            </h3>
                            <span className="text-[11px] font-bold text-stone-500">
                                Mọi thang điểm và cách trừ lỗi bên dưới đều suy ra từ 2 loại này
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            {/* Loại 1: Lao động */}
                            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-black text-emerald-900 text-sm">🌱 CÔNG VIỆC LAO ĐỘNG</span>
                                    <span className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white text-[10px] font-black shrink-0">
                                        4 nhóm điểm
                                    </span>
                                </div>
                                <p className="text-stone-700 leading-relaxed">
                                    Bốc xếp, dỡ cont, lái xe nâng, đai kiện, xếp hàng lên kệ… — <b>có lao động tay chân và vận hành thiết bị</b>.
                                </p>
                                <div className="bg-white rounded-xl border border-emerald-100 p-2.5 space-y-1 text-[11px] text-stone-700">
                                    <div>• ⚡ Năng suất: <b>35 – 45 / 45đ</b> (theo độ nặng)</div>
                                    <div>• ⭐ Chất lượng: <b>20đ</b> (trừ lỗi hàng hóa / việc tồn đọng)</div>
                                    <div>• 🛡️ An toàn: <b>20đ</b> (chỉ loại việc này mới có)</div>
                                    <div>• 📋 Kỷ luật &amp; 5S: <b>15đ</b></div>
                                    <div className="text-emerald-800 font-bold pt-1 border-t border-emerald-100">
                                        Tổng ngày: 90 / 92 / 95 / 100đ
                                    </div>
                                </div>
                            </div>

                            {/* Loại 2: Thống kê */}
                            <div className="p-4 rounded-2xl bg-sky-50/60 border border-sky-200 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-black text-sky-900 text-sm">📊 CÔNG VIỆC THỐNG KÊ</span>
                                    <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white text-[10px] font-black shrink-0">
                                        3 nhóm điểm
                                    </span>
                                </div>
                                <p className="text-stone-700 leading-relaxed">
                                    Kiểm đếm, ghi chép sổ sách, nhập liệu, đối chiếu số liệu… — <b>không vận hành xe nâng</b>, sản phẩm chính là <b>con số chính xác</b>.
                                </p>
                                <div className="bg-white rounded-xl border border-sky-100 p-2.5 space-y-1 text-[11px] text-stone-700">
                                    <div>• ⚡ Năng suất: <b>30 – 40 / 40đ</b> (đã gồm 20đ của nhóm An toàn)</div>
                                    <div>• ⭐ Chất lượng: <b>40đ</b> (số liệu đúng tuyệt đối)</div>
                                    <div>• 🛡️ An toàn: <b>không có</b></div>
                                    <div>• 📋 Kỷ luật &amp; 5S: <b>20đ</b></div>
                                    <div className="text-sky-800 font-bold pt-1 border-t border-sky-100">
                                        Tổng ngày: 90 / 92 / 95 / 100đ
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-[11px] text-stone-700 leading-relaxed">
                            <b>Từ 2 loại việc này suy ra cách trừ lỗi:</b> lỗi hàng hóa trừ <b>Chất lượng</b> ở cả hai loại việc; <b>việc tồn đọng trong ngày</b> (chưa xong việc) cũng trừ <b>Chất lượng</b> ở cả hai loại; lỗi số liệu &amp; ghi chép <b>chỉ có ở việc thống kê</b> và trừ <b>Chất lượng</b> (việc lao động không hiện nhóm lỗi này); lỗi vận hành &amp; 5S trừ <b>Kỷ luật</b>; riêng lỗi xe nâng trừ <b>An toàn</b> ở việc lao động và trừ <b>Kỷ luật</b> ở việc thống kê (vì thống kê không có nhóm An toàn). Bước 3 (Việc chính / việc hỗ trợ) chỉ quyết định <b>điểm được ghi vào đâu</b> — việc chính vào điểm ngày, việc phụ vào điểm hỗ trợ tích lũy — không đổi loại việc.
                        </div>
                    </div>
                </div>
            )}

            {/* PHẦN 2: THANG ĐIỂM CA THEO TỪNG LOẠI CÔNG VIỆC */}
            {(activeSection === 'overview' || activeSection === 'pillars') && (
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-5">
                    <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                                ⚖️
                            </div>
                            <div>
                                <h2 className="text-base sm:text-lg font-black text-stone-900">
                                    2. Thang Điểm Ca Chuẩn (Lao Động 4 Nhóm Điểm • Thống Kê 3 Nhóm Điểm)
                                </h2>
                                <p className="text-xs text-stone-500">
                                    Áp dụng cho công việc chính trong ca; việc thống kê dùng thang riêng bên dưới
                                </p>
                            </div>
                        </div>
                        <span className="px-3 py-1 rounded-xl bg-indigo-50 text-indigo-700 font-black text-xs border border-indigo-200">
                            Việc chính tối đa: 100 Điểm
                        </span>
                    </div>

                    {/* A. Việc lao động — 4 nhóm điểm */}
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="font-black text-emerald-900 text-sm flex items-center gap-1.5">
                                <span>🌱</span>
                                <span>A. VIỆC LAO ĐỘNG — 4 NHÓM ĐIỂM</span>
                            </h3>
                            <span className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white font-black text-[10px]">
                                Tổng ngày 90 / 92 / 95 / 100đ
                            </span>
                        </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Nhóm điểm 1: Năng Suất */}
                        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2 relative overflow-hidden">
                            <div className="flex items-center justify-between">
                                <span className="text-xl">⚡</span>
                                <span className="px-2 py-0.5 rounded-lg bg-indigo-600 text-white font-black text-xs">
                                    35 – 45 Điểm
                                </span>
                            </div>
                            <h3 className="font-black text-stone-900 text-sm">I. NĂNG SUẤT THỰC HIỆN</h3>
                            <p className="text-[11px] text-stone-600 leading-relaxed">
                                Mức tối đa 45đ. Điểm theo độ nặng khối lượng, hạ mốc để tổng ngày cân bằng với việc Thống kê:
                            </p>
                            <div className="text-[10px] bg-white p-2.5 rounded-xl border border-stone-200 space-y-1 text-stone-600">
                                <div>• <b>🌱 Nhẹ:</b> <span className="text-emerald-700 font-bold">35 điểm</span> (Dán tem, 5S, việc nhẹ &rarr; Tổng ca <b>90đ - Hạng A</b>)</div>
                                <div>• <b>⚡ Vừa:</b> <span className="text-blue-700 font-bold">37 điểm</span> (1 – 3 Cont / 45 – 179 vị trí / bốc dỡ vừa &rarr; Tổng ca <b>92đ - Hạng A</b>)</div>
                                <div>• <b>💪 Nặng:</b> <span className="text-amber-700 font-bold">40 điểm</span> (4 – 7 Cont / 180 – 359 vị trí / bốc vác nhiều &rarr; Tổng ca <b>95đ - Hạng A</b>)</div>
                                <div>• <b>🔥 Rất nặng:</b> <span className="text-rose-700 font-bold">45 điểm</span> (≥ 8 Cont / ≥ 360 vị trí / cont lạnh gấp &rarr; Tổng ca <b>100đ - Hạng A+</b>)</div>
                            </div>
                        </div>

                        {/* Nhóm điểm 2: Chất Lượng */}
                        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2 relative overflow-hidden">
                            <div className="flex items-center justify-between">
                                <span className="text-xl">⭐</span>
                                <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-white font-black text-xs">
                                    Tối Đa 20 Điểm
                                </span>
                            </div>
                            <h3 className="font-black text-stone-900 text-sm">II. CHẤT LƯỢNG THỰC HIỆN</h3>
                            <p className="text-[11px] text-stone-600 leading-relaxed">
                                <b>Chất lượng là tuyệt đối:</b> hàng hóa nguyên vẹn, giao nhận đúng chủng loại và <b>hoàn thành 100% việc trong ca</b> = 20/20đ. Trừ theo lỗi thực tế và theo việc còn tồn:
                            </p>
                            <div className="text-[10px] bg-white p-2.5 rounded-xl border border-stone-200 space-y-1 text-stone-600">
                                <div>• <b>Hoàn thành 100% việc &amp; không lỗi hàng hóa:</b> 20/20 điểm</div>
                                <div>• <b>Để việc tồn đọng trong ca:</b> Trừ theo % việc còn lại (còn 30% việc → trừ 6đ)</div>
                                <div>• <b>Bốc xếp sai quy cách / nghiêng lệch kiện hàng:</b> Trừ 10đ/lỗi</div>
                                <div>• <b>Xếp lẫn LOT trên pallet không phân tách:</b> Trừ 15đ/lỗi</div>
                                <div>• <b>Lấy hàng không đúng, tự ý, không theo chỉ dẫn:</b> Trừ 15đ/lỗi</div>
                                <div>• <b>Nĩa xe đâm rách thùng / bao bì:</b> Trừ 20đ/lỗi</div>
                                <div>• <b>Để hàng ngoài nhiệt độ lạnh quá giờ:</b> Mất nhóm Chất lượng (0đ), khóa <b>Hạng C</b></div>
                                <div>• <b>Làm đổ / rơi kiện, pallet:</b> Mất nhóm Chất lượng (0đ), khóa <b>Hạng C</b></div>
                                <div className="text-stone-500 border-t border-stone-200 pt-1">
                                    Việc tồn đọng chỉ trừ <b>Chất lượng</b>, không trừ lại Kỷ luật. Còn bao nhiêu % việc chưa xong thì trừ đúng bấy nhiêu % <b>điểm tối đa của nhóm</b> — <b>hoàn thành 100% mới đạt mức tối đa 20đ</b>. Nếu Quản lý đã ghi lỗi “Chưa xong việc trong ca” thì lấy đúng mức phạt của lỗi đó, <b>không cộng dồn</b> với phần tự trừ; lỗi lớn hơn mức tối đa chỉ làm <b>điểm của nhóm đó về 0đ</b> (không trừ âm).
                                </div>
                            </div>
                        </div>

                        {/* Nhóm điểm 3: An Toàn */}
                        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2 relative overflow-hidden">
                            <div className="flex items-center justify-between">
                                <span className="text-xl">🛡️</span>
                                <span className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white font-black text-xs">
                                    20 Điểm
                                </span>
                            </div>
                            <h3 className="font-black text-stone-900 text-sm">III. AN TOÀN LAO ĐỘNG</h3>
                            <p className="text-[11px] text-stone-600 leading-relaxed">
                                Áp dụng cho <b>việc lao động</b> (có vận hành xe nâng). Điểm gốc 20đ, bảo toàn tuyệt đối nếu không xảy ra sự cố an toàn / xe nâng.
                                Việc thống kê không có nhóm này. Lỗi hàng hóa và lỗi ghi chép đã trừ ở Chất lượng nên không trừ trùng tại đây.
                            </p>
                            <div className="text-[10px] bg-white p-2.5 rounded-xl border border-stone-200 space-y-1 text-stone-600">
                                <div>• <b>Không có sự cố:</b> 20/20 điểm</div>
                                <div>• <b>Không còi góc khuất, chạy quá tốc độ:</b> Trừ 5–15đ</div>
                                <div>• <b>Va quẹt chân kệ / nâng quá tải:</b> Trừ 25–30đ (0đ, khóa Hạng C)</div>
                            </div>
                        </div>

                        {/* Nhóm điểm 4: Kỷ Luật & 5S */}
                        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2 relative overflow-hidden">
                            <div className="flex items-center justify-between">
                                <span className="text-xl">📋</span>
                                <span className="px-2 py-0.5 rounded-lg bg-purple-600 text-white font-black text-xs">
                                    15 Điểm
                                </span>
                            </div>
                            <h3 className="font-black text-stone-900 text-sm">IV. KỶ LUẬT & 5S VỆ SINH</h3>
                            <p className="text-[11px] text-stone-600 leading-relaxed">
                                Điểm gốc ban đầu là 15 điểm. Đánh giá tính chuyên cần và vệ sinh khu vực kho.
                            </p>
                            <div className="text-[10px] bg-white p-2.5 rounded-xl border border-stone-200 space-y-1 text-stone-600">
                                <div>• <b>Đúng giờ, vệ sinh 5S sạch sẽ:</b> 15/15 điểm</div>
                                <div>• <b>Đi muộn, về sớm:</b> Trừ 15đ</div>
                                <div>• <b>Không dọn kho sau ca:</b> Trừ 10đ</div>
                                <div>• <b>Làm việc riêng / chậm trễ:</b> Trừ 5đ</div>
                            </div>
                        </div>
                    </div>

                    </div>

                    {/* B. Việc thống kê — 3 nhóm điểm */}
                    <div className="space-y-3 border-t border-stone-200 pt-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="font-black text-sky-900 text-sm flex items-center gap-1.5">
                                <span>📊</span>
                                <span>B. VIỆC THỐNG KÊ / GHI CHÉP — 3 NHÓM ĐIỂM</span>
                            </h3>
                            <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white font-black text-[10px]">
                                Tổng ngày 90 / 92 / 95 / 100đ
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {/* Nhóm điểm 1: Năng Suất */}
                            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xl">⚡</span>
                                    <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white font-black text-xs">
                                        30 – 40 / 40 Điểm
                                    </span>
                                </div>
                                <h3 className="font-black text-stone-900 text-sm">I. NĂNG SUẤT THỰC HIỆN</h3>
                                <p className="text-[11px] text-stone-600 leading-relaxed">
                                    Trần 40đ, đã gồm 20đ của nhóm An toàn được dồn sang vì thống kê không vận hành xe nâng:
                                </p>
                                <div className="text-[10px] bg-white p-2.5 rounded-xl border border-stone-200 space-y-1 text-stone-600">
                                    <div>• <b>🌱 Nhẹ:</b> <span className="text-emerald-700 font-bold">30 điểm</span> (tổng ca <b>90đ - Hạng A</b>)</div>
                                    <div>• <b>⚡ Vừa:</b> <span className="text-blue-700 font-bold">32 điểm</span> (tổng ca <b>92đ - Hạng A</b>)</div>
                                    <div>• <b>💪 Nặng:</b> <span className="text-amber-700 font-bold">35 điểm</span> (tổng ca <b>95đ - Hạng A</b>)</div>
                                    <div>• <b>🔥 Rất nặng:</b> <span className="text-rose-700 font-bold">40 điểm</span> (tổng ca <b>100đ - Hạng A+</b>)</div>
                                    <div className="text-stone-400">× % hoàn thành khối lượng được giao.</div>
                                </div>
                            </div>

                            {/* Nhóm điểm 2: Chất Lượng */}
                            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xl">⭐</span>
                                    <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-white font-black text-xs">
                                        Tối Đa 40 Điểm
                                    </span>
                                </div>
                                <h3 className="font-black text-stone-900 text-sm">II. CHẤT LƯỢNG SỐ LIỆU</h3>
                                <p className="text-[11px] text-stone-600 leading-relaxed">
                                    <b>Đây là nhóm điểm quan trọng nhất</b> của việc thống kê (nặng gấp đôi việc lao động): sản phẩm chính là <b>con số chính xác</b>, việc phải <b>giải quyết xong trong ngày</b>.
                                </p>
                                <div className="text-[10px] bg-white p-2.5 rounded-xl border border-stone-200 space-y-1 text-stone-600">
                                    <div>• <b>Hoàn thành 100% &amp; số liệu đúng tuyệt đối:</b> 40/40 điểm</div>
                                    <div>• <b>Để việc tồn đọng trong ca:</b> Trừ theo % việc còn lại (còn 30% việc → trừ 12đ)</div>
                                    <div>• <b>Quên quét tem, chậm cập nhật phần mềm, sai lệch bàn giao:</b> Trừ 10đ/lỗi</div>
                                    <div>• <b>Ghi sai số lượng, sai vị trí kệ; ghi sai mã LOT:</b> Trừ 15đ/lỗi</div>
                                    <div>• <b>Cố ý sửa số liệu / che giấu sai lệch (Nghiêm trọng):</b> Trừ 25đ (còn 15đ), khóa Hạng C</div>
                                    <div className="text-sky-700 font-semibold">• <b>Số liệu hôm nay thường hôm sau mới tổng kết:</b> lỗi phát hiện khi đối soát hôm sau vẫn trừ vào Chất lượng của công việc thống kê <b>ngày có số liệu</b> (không dồn sang việc ngày hôm sau), nên điểm ngày hôm trước có thể được cập nhật lại.</div>
                                    <div className="text-stone-400">Việc tồn đọng &amp; lỗi ghi chép chỉ trừ Chất lượng, không trừ trùng vào Kỷ luật.</div>
                                </div>
                            </div>

                            {/* Nhóm điểm 3: Kỷ Luật & 5S */}
                            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xl">📋</span>
                                    <span className="px-2 py-0.5 rounded-lg bg-purple-600 text-white font-black text-xs">
                                        20 Điểm
                                    </span>
                                </div>
                                <h3 className="font-black text-stone-900 text-sm">III. KỶ LUẬT &amp; 5S VỆ SINH</h3>
                                <p className="text-[11px] text-stone-600 leading-relaxed">
                                    Điểm gốc 20đ (cao hơn việc lao động 5đ), đánh giá chuyên cần và vệ sinh khu vực làm việc.
                                </p>
                                <div className="text-[10px] bg-white p-2.5 rounded-xl border border-stone-200 space-y-1 text-stone-600">
                                    <div>• <b>Đúng giờ, vệ sinh 5S sạch sẽ:</b> 20/20 điểm</div>
                                    <div>• <b>Đi muộn, về sớm:</b> Trừ 15đ</div>
                                    <div>• <b>Không dọn khu vực sau ca:</b> Trừ 10đ</div>
                                    <div>• <b>Làm việc riêng / chậm trễ:</b> Trừ 5đ</div>
                                </div>
                            </div>
                        </div>

                        <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-[11px] text-sky-900 leading-relaxed">
                            <b>Vì sao không có nhóm An toàn?</b> Việc thống kê không vận hành xe nâng, nên 20đ của nhóm An toàn được dồn vào Năng suất để <b>tổng ngày bằng đúng người lao động cùng độ nặng</b> (90 / 92 / 95 / 100đ). Sự cố <b>Nghiêm trọng</b> vẫn khóa Hạng C như mọi người.
                        </div>
                    </div>
                </div>
            )}

            {/* PHẦN 3: VIỆC CHÍNH (ĐIỂM NGÀY) VS VIỆC HỖ TRỢ (ĐIỂM HỖ TRỢ TÍCH LŨY) */}
            {(activeSection === 'overview' || activeSection === 'task_types') && (
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-5">
                    <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                                ➕
                            </div>
                            <div>
                                <h2 className="text-base sm:text-lg font-black text-stone-900">
                                    3. Phân Loại Việc Chính &amp; Việc Hỗ Trợ (Điểm Ngày vs Điểm Hỗ Trợ)
                                </h2>
                                <p className="text-xs text-stone-500">
                                    Việc chính chấm điểm ngày theo thang 100đ; việc phụ / tăng cường tích lũy điểm hỗ trợ riêng theo tuần, tháng, năm — áp dụng cho cả việc lao động và việc thống kê
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Thẻ Việc Chính */}
                        <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-50/70 to-stone-50 border border-amber-200 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-black text-xs border border-amber-300 flex items-center gap-1">
                                    ⭐ VIỆC CHÍNH (PRIMARY TASK)
                                </span>
                                <span className="text-xs font-bold text-stone-500">Tối đa: 100đ</span>
                            </div>
                            <p className="text-xs text-stone-700 leading-relaxed">
                                Là <b>nhiệm vụ cốt lõi</b> được Quản lý phân công cho bạn trong ca làm việc.
                            </p>
                            <div className="space-y-1.5 text-xs text-stone-600 bg-white p-3 rounded-xl border border-stone-200">
                                <div className="font-bold text-stone-800">📌 Quy tắc tính điểm:</div>
                                <div>• Điểm số việc chính được chấm theo <b>thang điểm của đúng loại việc đó</b>: lao động 4 nhóm điểm / thống kê 3 nhóm điểm.</div>
                                <div>• <b>Nếu bạn làm 2 hoặc 3 việc chính trong ngày:</b> Điểm việc chính sẽ được <b>lấy trung bình cộng</b> để quy về thang ca chuẩn 100đ (tránh trường hợp tính cộng dồn ảo lên 200–300đ).</div>
                                <div>• Đây là điểm dùng để <b>xếp hạng và xét danh hiệu Bé Khỏe Bé Ngoan trong ngày</b>.</div>
                            </div>
                        </div>

                        {/* Thẻ Việc Hỗ Trợ */}
                        <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-50/70 to-stone-50 border border-purple-200 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="px-2.5 py-1 rounded-lg bg-purple-100 text-purple-900 font-black text-xs border border-purple-300 flex items-center gap-1">
                                    ➕ VIỆC PHỤ / TĂNG CƯỜNG (SECONDARY TASK)
                                </span>
                                <span className="text-xs font-black text-purple-700">Điểm hỗ trợ tích lũy kỳ</span>
                            </div>
                            <p className="text-xs text-stone-700 leading-relaxed">
                                Là công việc bạn <b>hỗ trợ đồng đội, làm thêm ngoài ca chính, hoặc tăng cường giải phóng hàng gấp</b>.
                            </p>
                            <div className="space-y-1.5 text-xs text-stone-600 bg-white p-3 rounded-xl border border-stone-200">
                                <div className="font-bold text-stone-800">📌 Quy tắc điểm hỗ trợ:</div>
                                <div>• <b>Không cộng vào điểm ngày:</b> điểm hỗ trợ được quản lý ở <b>mục riêng</b>, không làm thay đổi điểm KPI ngày, không kéo hạng và không đổi danh hiệu Bé Khỏe Bé Ngoan trong ngày.</div>
                                <div>• <b>Tỷ lệ thuận theo % đóng góp:</b> Điểm hỗ trợ = Điểm năng suất độ nặng × (% đóng góp / 100) (Ví dụ: việc mức Vừa 37đ, bạn phụ 50% khối lượng &rarr; <b>+18.5đ</b> hỗ trợ; việc mức Nặng 40đ bạn phụ 18% &rarr; <b>+7.2đ</b>).</div>
                                <div>• <b>Cộng dồn theo kỳ:</b> Toàn bộ điểm hỗ trợ trong tuần / tháng / năm được cộng lại để đánh giá <b>mức độ tích cực hỗ trợ</b> cuối tuần, cuối tháng, cuối năm.</div>
                                <div>• <b>Chỉ làm việc hỗ trợ:</b> nhân sự không có việc chính trong kỳ được <b>xếp riêng theo điểm hỗ trợ</b>, không bị xếp hạng C oan vì điểm ngày trống.</div>
                            </div>
                        </div>
                    </div>

                    {/* Quy tắc Giờ làm việc & Giờ Tăng Ca (OT) */}
                    <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-xs space-y-2.5">
                        <div className="font-black text-indigo-950 flex items-center gap-1.5">
                            <span>⏱️</span>
                            <span>Quy chế Mốc Thời Gian Ca Chuẩn (8 Tiếng) & Ghi Nhận Giờ Tăng Ca:</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="p-3 bg-white rounded-xl border border-indigo-100 space-y-1">
                                <div className="font-bold text-stone-800">1. Ca chuẩn 8 tiếng:</div>
                                <p className="text-[11px] text-stone-600 leading-relaxed">
                                    Định mức thời gian làm việc ca chuẩn là 8 giờ. Hệ thống dùng mốc này để đánh giá tỷ lệ hoàn thành công việc chính trong ngày và đo lường hiệu suất làm việc.
                                </p>
                            </div>
                            <div className="p-3 bg-white rounded-xl border border-indigo-100 space-y-1">
                                <div className="font-bold text-stone-800">2. Giờ Tăng Ca (Làm thêm ngoài ca):</div>
                                <p className="text-[11px] text-stone-600 leading-relaxed">
                                    Khi dỡ cont ngoài giờ, bốc xếp tăng ca, kiểm kê đêm hoặc làm việc phụ hỗ trợ, Quản lý ghi nhận trực tiếp số giờ làm thêm (+1h, +2h...) vào hệ thống.
                                </p>
                            </div>
                            <div className="p-3 bg-white rounded-xl border border-indigo-100 space-y-1">
                                <div className="font-bold text-stone-800">3. Ghi nhận cống hiến:</div>
                                <p className="text-[11px] text-stone-600 leading-relaxed">
                                    Ghi nhận chính xác số giờ tăng ca thực tế của nhân sự, giúp đánh giá toàn diện tinh thần trách nhiệm và mức độ đóng góp cho kho trong ngày.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Ví dụ minh họa thực tế */}
                    <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 text-xs space-y-2">
                        <div className="font-black text-stone-900 flex items-center gap-1.5">
                            <span>💡</span>
                            <span>Ví dụ minh họa cuối ngày của nhân viên Giang:</span>
                        </div>
                        <div className="space-y-1 text-stone-700 leading-relaxed pl-5 list-disc">
                            <div>1. <b>Việc chính (8h):</b> Giang đảm nhận bốc xếp và dỡ cont lạnh (mức Rất nặng), hoàn thành tốt, không lỗi hàng hóa → <b>100 điểm KPI ngày</b> (Năng suất 45đ • Chất lượng tuyệt đối 20đ • An toàn 20đ • Kỷ luật &amp; 5S 15đ).</div>
                            <div>2. <b>Việc phụ (+2h Tăng ca):</b> Giang tăng cường hỗ trợ đai kiện cho tổ xuất hàng (mức Nặng 40đ) với 18% đóng góp &rarr; ghi nhận thêm <b>+7.2 điểm hỗ trợ</b> vào mục điểm hỗ trợ của kỳ.</div>
                            <div>3. <b>Tổng thời gian làm việc:</b> 8h chuẩn + 2h tăng ca = <b>10 giờ làm việc cống hiến</b>.</div>
                            <div>4. <b>Kết quả:</b> KPI ngày vẫn là <b>100 điểm</b> &rarr; <b>Hạng A+</b> (điểm hỗ trợ không kéo hạng). Đồng thời Giang tích lũy <b>+7.2 điểm hỗ trợ</b> trong kỳ — căn cứ đánh giá mức độ tích cực hỗ trợ cuối tuần / tháng / năm.</div>
                        </div>
                    </div>
                </div>
            )}

            {/* PHẦN 4: DANH MỤC LỖI VI PHẠM & MỨC TRỪ ĐIỂM */}
            {(activeSection === 'overview' || activeSection === 'incidents') && (
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-5">
                    <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
                                ⚠️
                            </div>
                            <div>
                                <h2 className="text-base sm:text-lg font-black text-stone-900">
                                    4. Danh Mục Lỗi Vi Phạm & Nhóm Điểm Bị Trừ
                                </h2>
                                <p className="text-xs text-stone-500">
                                    Mỗi lỗi chỉ trừ đúng <b>một nhóm điểm</b>: xe nâng &rarr; An toàn (chỉ việc lao động), hàng hóa &rarr; Chất lượng (cả hai loại), việc tồn đọng &rarr; Chất lượng (cả hai loại), số liệu &amp; ghi chép &rarr; Chất lượng (chỉ việc thống kê), vận hành &amp; 5S &rarr; Kỷ luật
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {INCIDENT_GROUPS.map((grp: IncidentGroupTemplate) => (
                            <div
                                key={grp.group}
                                className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4 space-y-2.5"
                            >
                                <div className="flex items-center justify-between border-b border-stone-200 pb-2 gap-2">
                                    <div className="font-extrabold text-stone-900 text-xs flex items-center gap-1.5">
                                        <span className="text-base">{grp.icon}</span>
                                        <span>{grp.groupLabel}</span>
                                    </div>
                                    <span className="text-[10px] text-stone-500 font-bold shrink-0">
                                        {grp.items.length} lỗi quy chuẩn
                                    </span>
                                </div>

                                <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[10px] font-black ${INCIDENT_GROUP_PILLAR[grp.group].className}`}
                                >
                                    Trừ vào: {INCIDENT_GROUP_PILLAR[grp.group].label}
                                </span>

                                <div className="space-y-1.5">
                                    {grp.items.map((inc: IncidentTemplateItem) => (
                                        <div
                                            key={inc.type}
                                            className="flex items-center justify-between p-2 rounded-xl bg-white border border-stone-200/80 text-xs shadow-2xs hover:border-rose-200 transition-colors"
                                        >
                                            <div className="space-y-0.5">
                                                <div className="font-bold text-stone-800 text-[11px]">
                                                    {inc.name}
                                                </div>
                                                <div className="text-[10px] text-stone-400">
                                                    Mức độ: {inc.severity === 'severe' ? '🔴 Nghiêm trọng' : inc.severity === 'moderate' ? '🟠 Trung bình' : '🟡 Nhẹ'}
                                                </div>
                                                {inc.type === 'incomplete_task' && (
                                                    <div className="text-[10px] font-bold text-amber-700">
                                                        → Trừ ⭐ Chất lượng (cả 2 loại việc)
                                                    </div>
                                                )}
                                            </div>
                                            <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 font-black text-xs shrink-0 border border-rose-200">
                                                -{inc.penalty}đ
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-2xl text-xs text-rose-900 space-y-1">
                        <div className="font-black flex items-center gap-1.5">
                            <AlertTriangle size={14} className="text-rose-600" />
                            <span>Điều khoản an toàn đặc biệt (Khóa danh hiệu thi đua):</span>
                        </div>
                        <p className="leading-relaxed text-[11px]">
                            Bất kỳ nhân sự nào để xảy ra sự cố thuộc mức <b>Nghiêm trọng (Severe)</b> sẽ <b>tự động bị xếp Hạng C (Cần cải thiện)</b> bất kể năng suất có cao đến đâu — áp dụng cho cả việc lao động lẫn việc thống kê.
                        </p>
                        <p className="leading-relaxed text-[11px]">
                            Điểm trừ chỉ áp lên <b>mức điểm tối đa của đúng nhóm bị trừ</b> và mỗi nhóm điểm <b>không âm</b>: lỗi lớn hơn mức tối đa đó (ví dụ lỗi 35–40đ trên nhóm Chất lượng của việc lao động chỉ có 20đ) chỉ làm <b>điểm của nhóm đó về 0đ</b>, phần dư không trừ sang nhóm khác; lỗi Nghiêm trọng khi đó vẫn khóa <b>Hạng C</b>.
                        </p>
                        <p className="leading-relaxed text-[11px]">
                            <b>Việc tồn đọng trong ngày</b> trừ <b>Chất lượng</b> ở cả lao động và thống kê: nếu Quản lý đã ghi lỗi <b>“Chưa xong việc trong ca”</b> thì trừ đúng mức phạt của lỗi đó; nếu chưa ghi lỗi thì hệ thống <b>tự trừ theo % việc còn lại</b> (chỉ đạt mức tối đa của Chất lượng khi hoàn thành 100%). Hai cách không cộng dồn, và Quản lý chấm tay Chất lượng thì quyền chấm tay quyết định.
                        </p>
                        <p className="leading-relaxed text-[11px]">
                            Riêng <b>việc lao động</b>, nếu điểm An toàn tụt xuống <b>&le; 5đ</b> cũng bị khóa Hạng C. Lỗi không thuộc loại việc thì dồn về <b>Kỷ luật</b> để không mất điểm phạt: lỗi xe nâng ghi nhận trên việc thống kê, và lỗi số liệu / ghi chép ghi nhận trên việc lao động (bộ chọn lỗi đã ẩn hai nhóm này theo loại việc).
                        </p>
                        <p className="leading-relaxed text-[11px]">
                            <b>Việc thống kê thường chốt số liệu vào ngày hôm sau:</b> lỗi phát hiện khi đối soát / tổng kết hôm sau vẫn <b>trừ vào Chất lượng của công việc thống kê ngày có số liệu</b> (ngày hôm trước), đúng mức lỗi như danh mục — <b>không dồn sang việc của ngày hôm sau</b> và không mất lỗi vì ghi nhận muộn. Điểm của ngày hôm trước vì thế có thể được cập nhật lại sau đối soát.
                        </p>
                    </div>
                </div>
            )}

            {/* PHẦN 5: THANG BẬC XẾP LOẠI THI ĐUA */}
            {(activeSection === 'overview' || activeSection === 'ranking') && (
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-5">
                    <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                                🏆
                            </div>
                            <div>
                                <h2 className="text-base sm:text-lg font-black text-stone-900 flex items-center gap-2">
                                    <span>5. Bảng Tiêu Chuẩn Danh Hiệu Bé Khỏe Bé Ngoan</span>
                                </h2>
                                <p className="text-xs text-stone-500">
                                    Bé Khỏe = Năng suất cao ⚡ • Bé Ngoan = Chất lượng & Kỷ luật 5S 🛡️
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-stone-200 shadow-2xs">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-stone-100/90 text-stone-600 border-b border-stone-200 text-[10px] font-black uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-3 text-center w-36">Danh Hiệu</th>
                                    <th className="px-4 py-3 text-center w-36">Tổng Điểm Thi Đua</th>
                                    <th className="px-4 py-3">Tiêu Chuẩn Đạt Được</th>
                                    <th className="px-4 py-3 text-center w-40">Đánh Giá Năng Lực</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 bg-white">
                                <tr className="bg-rose-50/30">
                                    <td className="px-4 py-3 text-center font-black">
                                        <span className="px-2.5 py-1 rounded-xl bg-rose-100 text-rose-800 font-black border border-rose-300 text-xs inline-flex items-center gap-1 shadow-2xs">
                                            🌸 Bé Khỏe Bé Ngoan (A+)
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center font-black text-rose-700 text-sm">
                                        ≥ 100 điểm
                                    </td>
                                    <td className="px-4 py-3 text-stone-700 leading-relaxed">
                                        Hoàn thành xuất sắc khối lượng việc chính trong kỳ; năng suất vượt trội; không vi phạm bất kỳ lỗi an toàn / chất lượng / kỷ luật nào. Nhận ngay <b>Bông Hoa Đỏ</b>!
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold text-rose-800">
                                        Biểu dương Top đầu thi đua, tấm gương làm việc năng suất và an toàn mẫu mực.
                                    </td>
                                </tr>

                                <tr>
                                    <td className="px-4 py-3 text-center font-black">
                                        <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 font-black border border-amber-300 text-xs inline-flex items-center gap-1 shadow-2xs">
                                            ⭐ Bé Ngoan (A)
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center font-black text-amber-700 text-sm">
                                        85 – 99.9 điểm
                                    </td>
                                    <td className="px-4 py-3 text-stone-700 leading-relaxed">
                                        Hoàn thành tốt nhiệm vụ được giao trong ca; cẩn thận, trách nhiệm, tuân thủ nghiêm ngặt 5S và quy tắc an toàn kho.
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold text-amber-800">
                                        Ghi nhận hoàn thành tốt nhiệm vụ, làm việc chăm chỉ và kỷ luật cao.
                                    </td>
                                </tr>

                                <tr>
                                    <td className="px-4 py-3 text-center font-black">
                                        <span className="px-2.5 py-1 rounded-xl bg-blue-50 text-blue-800 font-black border border-blue-200 text-xs inline-flex items-center gap-1 shadow-2xs">
                                            🌱 Cần Cố Gắng (B)
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center font-black text-blue-700 text-sm">
                                        70 – 84.9 điểm
                                    </td>
                                    <td className="px-4 py-3 text-stone-700 leading-relaxed">
                                        Hoàn thành công việc ở mức cơ bản; có thể bị trừ điểm nhẹ do trễ tiến độ hoặc thao tác còn chậm; không có sự cố an toàn.
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold text-stone-600">
                                        Đang tiến bộ, cố gắng thêm một chút là giật được Bông Hoa Đỏ nhé!
                                    </td>
                                </tr>

                                <tr className="bg-stone-50">
                                    <td className="px-4 py-3 text-center font-black">
                                        <span className="px-2.5 py-1 rounded-xl bg-stone-200 text-stone-700 font-black border border-stone-300 text-xs inline-flex items-center gap-1 shadow-2xs">
                                            ⚠️ Chưa Ngoan (C)
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center font-black text-stone-700 text-sm">
                                        Dưới 70 điểm
                                        <div className="text-[10px] font-bold text-rose-700 mt-0.5">
                                            hoặc có sự cố Nghiêm trọng
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-stone-700 leading-relaxed">
                                        Không hoàn thành tiến độ hoặc để xảy ra vi phạm an toàn / rách tem / sai lệch số liệu / móp méo hàng hóa / vi phạm kỷ luật 5S.
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold text-stone-700">
                                        Cần cải thiện. Quản lý trực tiếp kèm cặp và hướng dẫn lại quy trình thao tác.
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* PHẦN 6: HỎI ĐÁP THƯỜNG GẶP (FAQ DÀNH CHO CÔNG NHÂN & NHÂN VIÊN KHO) */}
            {(activeSection === 'overview' || activeSection === 'faq') && (
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-4">
                    <div className="flex items-center gap-2.5 border-b border-stone-200 pb-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                            ❓
                        </div>
                        <h2 className="text-base sm:text-lg font-black text-stone-900">
                            6. Các Câu Hỏi Thường Gặp Của Nhân Viên Kho (FAQ)
                        </h2>
                    </div>

                    <div className="space-y-3 text-xs">
                        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-1.5">
                            <div className="font-extrabold text-stone-900 text-sm flex items-center gap-1.5">
                                <span className="text-indigo-600">Q1:</span>
                                <span>Nếu trong một ngày tôi được giao 2 việc chính, điểm của tôi có cộng thành 200 điểm không?</span>
                            </div>
                            <p className="text-stone-600 leading-relaxed pl-6">
                                <b>Trả lời:</b> Không cộng dồn thành 200 điểm. Các công việc chính trong ngày sẽ được <b>tính trung bình cộng quy về thang ca chuẩn 100 điểm</b>. Việc phụ / tăng cường không cộng vào điểm ngày; điểm hỗ trợ được tích lũy riêng theo kỳ để đánh giá mức độ tích cực hỗ trợ cuối tuần / tháng / năm.
                            </p>
                        </div>

                        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-1.5">
                            <div className="font-extrabold text-stone-900 text-sm flex items-center gap-1.5">
                                <span className="text-indigo-600">Q2:</span>
                                <span>Một công việc có 3 người cùng làm thì điểm số được chia như thế nào?</span>
                            </div>
                            <p className="text-stone-600 leading-relaxed pl-6">
                                <b>Trả lời:</b> Cuối ca, Quản lý sẽ phân chia <b>tỷ lệ % đóng góp thực tế</b> (ví dụ: Người làm chính đạt 70%, người hỗ trợ đạt 30%, hoặc chia đều 50% - 50%). Năng suất và sản lượng vị trí hạ hàng sẽ tự động phân bổ tỷ lệ thuận theo đóng góp của bạn.
                            </p>
                        </div>

                        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-1.5">
                            <div className="font-extrabold text-stone-900 text-sm flex items-center gap-1.5">
                                <span className="text-indigo-600">Q3:</span>
                                <span>Nếu tôi làm việc cẩn thận, sản phẩm rất đẹp nhưng công việc chung chỉ được đánh giá 3 sao thì sao?</span>
                            </div>
                            <p className="text-stone-600 leading-relaxed pl-6">
                                <b>Trả lời:</b> Điểm <b>Chất lượng tính theo lỗi thực tế của riêng bạn</b>, không chia theo sao của cả nhóm. Nếu <b>hoàn thành 100% phần việc</b> và không có lỗi hàng hóa, lỗi số liệu hay lỗi ghi chép nào ghi nhận cho bạn, bạn vẫn được tối đa (20/20đ việc lao động, 40/40đ việc thống kê) dù cả nhóm chỉ 3 sao; ngược lại, lỗi của bạn vẫn bị trừ đúng mức dù nhóm 5 sao. Việc còn tồn trong ngày thì Chất lượng tự trừ theo % việc còn lại.
                            </p>
                        </div>

                        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-1.5">
                            <div className="font-extrabold text-stone-900 text-sm flex items-center gap-1.5">
                                <span className="text-indigo-600">Q4:</span>
                                <span>Làm thế nào để tôi có thể xem điểm và bảng xếp hạng của mình mỗi ngày?</span>
                            </div>
                            <p className="text-stone-600 leading-relaxed pl-6">
                                <b>Trả lời:</b> Cuối mỗi ca hoặc cuối ngày, Quản lý sẽ xuất <b>Phiếu Báo Cáo Thi Đua KPI & Nhật Ký Công Việc dạng ảnh</b> gửi trực tiếp vào nhóm Zalo của kho. Bạn cũng có thể vào website tại mục <b>4. Báo Cáo Xếp Hạng</b> để tra cứu chi tiết số điểm của mình bất cứ lúc nào.
                            </p>
                        </div>

                        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-1.5">
                            <div className="font-extrabold text-stone-900 text-sm flex items-center gap-1.5">
                                <span className="text-indigo-600">Q5:</span>
                                <span>Tôi làm việc thống kê, kiểm đếm thì có nhóm An toàn không? Điểm có bị thấp hơn người bốc vác không?</span>
                            </div>
                            <p className="text-stone-600 leading-relaxed pl-6">
                                <b>Trả lời:</b> Việc thống kê <b>không có nhóm An toàn</b> vì không vận hành xe nâng; 20đ của nhóm này được dồn sang Năng suất, nên thang gồm <b>Năng suất 40đ • Chất lượng 40đ • Kỷ luật &amp; 5S 20đ</b>. Tổng ngày vẫn bằng đúng người lao động cùng độ nặng: <b>Nhẹ 90đ • Vừa 92đ • Nặng 95đ • Rất nặng 100đ</b>. Lỗi số liệu / ghi chép trừ vào Chất lượng (không trừ trùng ở Kỷ luật); sự cố nghiêm trọng vẫn khóa Hạng C như mọi người.
                            </p>
                        </div>

                        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-1.5">
                            <div className="font-extrabold text-stone-900 text-sm flex items-center gap-1.5">
                                <span className="text-indigo-600">Q6:</span>
                                <span>Số liệu hôm nay sang hôm sau mới tổng kết, nếu hôm sau mới phát hiện lỗi thì trừ điểm của ngày nào?</span>
                            </div>
                            <p className="text-stone-600 leading-relaxed pl-6">
                                <b>Trả lời:</b> Trừ vào <b>Chất lượng của công việc thống kê ngày có số liệu</b> — tức ngày hôm trước — đúng mức lỗi như bảng trên, <b>không dồn sang việc của ngày hôm sau</b>. Vì vậy điểm của ngày hôm trước có thể được cập nhật lại sau khi đối soát; việc ghi nhận muộn không làm mất lỗi.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

