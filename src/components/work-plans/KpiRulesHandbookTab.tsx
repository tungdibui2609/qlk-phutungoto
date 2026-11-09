'use client'

import React, { useState } from 'react'
import {
    BookOpen,
    Scale,
    ShieldAlert,
    Award,
    Trophy,
    CheckCircle2,
    AlertTriangle,
    Zap,
    Star,
    Layers,
    Calendar,
    HelpCircle,
    Printer,
    ArrowRight,
    Users,
    Package,
    TrendingUp,
    Sparkles,
    Check,
} from 'lucide-react'
import {
    KPI_PILLARS,
    INCIDENT_GROUPS,
    TASK_TYPE_CONFIG,
    DIFFICULTY_CONFIG,
    RATING_CONFIG,
    type IncidentGroupTemplate,
    type IncidentTemplateItem,
} from './types'

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
                            { id: 'overview', label: '1. Tôn Chỉ & Nguyên Tắc', icon: '🎯' },
                            { id: 'pillars', label: '2. 4 Trụ Cột KPI (100đ)', icon: '⚖️' },
                            { id: 'task_types', label: '3. Việc Chính vs Phụ (+đ)', icon: '➕' },
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
                                Khi làm việc theo đội nhóm (lái xe nâng, bốc vác xếp dỡ, đai kiện hàng, thống kê kiểm đếm hàng khay...), hệ thống phân bổ theo % đóng góp thực tế. Người hoàn thành việc chính đạt 95–100đ, người tăng cường hỗ trợ việc phụ được cộng dồn điểm thi đua mở trần lên 120đ - 150đ+.
                            </p>
                        </div>

                        <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-100 space-y-2">
                            <div className="font-extrabold text-amber-900 flex items-center gap-1.5 text-sm">
                                <span>🛡️</span>
                                <span>An Toàn & Kỷ Luật Tuyệt Đối</span>
                            </div>
                            <p className="text-stone-600 leading-relaxed">
                                Trong môi trường kho bãi và nhà máy (vận hành xe nâng, bốc xếp hàng hóa, kiểm kê số liệu, làm việc phòng lạnh), an toàn lao động và bảo quản hàng hóa là trên hết. Nếu để xảy ra sự cố nghiêm trọng (đổ vỡ hàng hóa, thất thoát, va quẹt tai nạn, hư hỏng thiết bị), danh hiệu thi đua sẽ bị hạ xuống Hạng C.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* PHẦN 2: 4 TRỤ CỘT KPI CHUẨN (CA 100 ĐIỂM) */}
            {(activeSection === 'overview' || activeSection === 'pillars') && (
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-5">
                    <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                                ⚖️
                            </div>
                            <div>
                                <h2 className="text-base sm:text-lg font-black text-stone-900">
                                    2. Thang Điểm 4 Trụ Cột Ca Chuẩn (Thang 100 Điểm)
                                </h2>
                                <p className="text-xs text-stone-500">
                                    Áp dụng cho mọi công việc chính được giao trong ca làm việc
                                </p>
                            </div>
                        </div>
                        <span className="px-3 py-1 rounded-xl bg-indigo-50 text-indigo-700 font-black text-xs border border-indigo-200">
                            Tổng Ca Chuẩn: 100 Điểm
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Trụ Cột 1: Năng Suất */}
                        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2 relative overflow-hidden">
                            <div className="flex items-center justify-between">
                                <span className="text-xl">⚡</span>
                                <span className="px-2 py-0.5 rounded-lg bg-indigo-600 text-white font-black text-xs">
                                    40 – 50 Điểm
                                </span>
                            </div>
                            <h3 className="font-black text-stone-900 text-sm">I. NĂNG SUẤT THỰC HIỆN</h3>
                            <p className="text-[11px] text-stone-600 leading-relaxed">
                                Chuẩn 40đ cho việc cơ bản hoàn thành tốt + Điểm cộng khối lượng theo độ nặng:
                            </p>
                            <div className="text-[10px] bg-white p-2.5 rounded-xl border border-stone-200 space-y-1 text-stone-600">
                                <div>• <b>🌱 Nhẹ:</b> <span className="text-emerald-700 font-bold">40 điểm</span> (Kiểm đếm, dán tem, 5S, việc nhẹ &rarr; Tổng ca <b>95đ - Hạng A</b>)</div>
                                <div>• <b>⚡ Vừa:</b> <span className="text-blue-700 font-bold">42 điểm</span> (1 – 3 Cont / 45 – 179 vị trí / bốc dỡ vừa &rarr; Tổng ca <b>97đ - Hạng A</b>)</div>
                                <div>• <b>💪 Nặng:</b> <span className="text-amber-700 font-bold">45 điểm</span> (4 – 7 Cont / 180 – 359 vị trí / bốc vác nhiều &rarr; Đạt <b>100đ - Hạng A+</b>)</div>
                                <div>• <b>🔥 Rất nặng:</b> <span className="text-rose-700 font-bold">50 điểm</span> (≥ 8 Cont / ≥ 360 vị trí / cont lạnh gấp &rarr; <b>105đ - Xuất sắc</b>)</div>
                            </div>
                        </div>

                        {/* Trụ Cột 2: Chất Lượng */}
                        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2 relative overflow-hidden">
                            <div className="flex items-center justify-between">
                                <span className="text-xl">⭐</span>
                                <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-white font-black text-xs">
                                    Tối Đa 20 Điểm
                                </span>
                            </div>
                            <h3 className="font-black text-stone-900 text-sm">II. CHẤT LƯỢNG THỰC HIỆN</h3>
                            <p className="text-[11px] text-stone-600 leading-relaxed">
                                Đánh giá độ chuẩn xác, cẩn thận, sắp xếp gọn gàng theo số sao nghiệm thu:
                            </p>
                            <div className="text-[10px] bg-white p-2.5 rounded-xl border border-stone-200 space-y-1 text-stone-600">
                                <div>• <b>5⭐ Xuất sắc:</b> 20 điểm</div>
                                <div>• <b>4⭐ Tốt:</b> 16 điểm</div>
                                <div>• <b>3⭐ Đạt yêu cầu:</b> 12 điểm</div>
                                <div>• <b>2⭐ Cần nhắc nhở:</b> 8 điểm</div>
                                <div>• <b>1⭐ Chưa đạt:</b> 4 điểm</div>
                            </div>
                        </div>

                        {/* Trụ Cột 3: An Toàn */}
                        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2 relative overflow-hidden">
                            <div className="flex items-center justify-between">
                                <span className="text-xl">🛡️</span>
                                <span className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white font-black text-xs">
                                    20 Điểm
                                </span>
                            </div>
                            <h3 className="font-black text-stone-900 text-sm">III. AN TOÀN & HÀNG HÓA</h3>
                            <p className="text-[11px] text-stone-600 leading-relaxed">
                                Điểm gốc ban đầu là 20 điểm. Bảo toàn tuyệt đối nếu không xảy ra sự cố.
                            </p>
                            <div className="text-[10px] bg-white p-2.5 rounded-xl border border-stone-200 space-y-1 text-stone-600">
                                <div>• <b>Không có sự cố:</b> 20/20 điểm</div>
                                <div>• <b>Lỗi vận hành, bốc xếp sai, rách tem nhãn:</b> Trừ 5đ đến 15đ</div>
                                <div>• <b>Sự cố rơi đổ hàng / sai số liệu / va quẹt:</b> Trừ 20đ (còn 0đ, khóa danh hiệu Hạng C)</div>
                            </div>
                        </div>

                        {/* Trụ Cột 4: Kỷ Luật & 5S */}
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
            )}

            {/* PHẦN 3: VIỆC CHÍNH VS VIỆC PHỤ / HỖ TRỢ (CƠ CHẾ MỞ TRẦN 150 ĐIỂM) */}
            {(activeSection === 'overview' || activeSection === 'task_types') && (
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-5">
                    <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                                ➕
                            </div>
                            <div>
                                <h2 className="text-base sm:text-lg font-black text-stone-900">
                                    3. Phân Loại Việc Chính vs Việc Phụ (Cơ Chế Mở Trần Điểm)
                                </h2>
                                <p className="text-xs text-stone-500">
                                    Quy định cách tính điểm khi một người đảm nhận nhiều công việc trong ngày
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
                                <span className="text-xs font-bold text-stone-500">Chuẩn ca: 100đ</span>
                            </div>
                            <p className="text-xs text-stone-700 leading-relaxed">
                                Là <b>nhiệm vụ cốt lõi</b> được Quản lý phân công cho bạn trong ca làm việc.
                            </p>
                            <div className="space-y-1.5 text-xs text-stone-600 bg-white p-3 rounded-xl border border-stone-200">
                                <div className="font-bold text-stone-800">📌 Quy tắc tính điểm:</div>
                                <div>• Điểm số việc chính được chấm theo 4 trụ cột chuẩn (thang 100 điểm).</div>
                                <div>• <b>Nếu bạn làm 2 hoặc 3 việc chính trong ngày:</b> Điểm việc chính sẽ được <b>lấy trung bình cộng</b> để quy về thang ca chuẩn 100đ (tránh trường hợp tính cộng dồn ảo lên 200–300đ).</div>
                            </div>
                        </div>

                        {/* Thẻ Việc Phụ */}
                        <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-50/70 to-stone-50 border border-purple-200 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="px-2.5 py-1 rounded-lg bg-purple-100 text-purple-900 font-black text-xs border border-purple-300 flex items-center gap-1">
                                    ➕ VIỆC PHỤ / TĂNG CƯỜNG (SECONDARY TASK)
                                </span>
                                <span className="text-xs font-black text-purple-700">Mở Trần Lên 120đ - 150đ+</span>
                            </div>
                            <p className="text-xs text-stone-700 leading-relaxed">
                                Là công việc bạn <b>hỗ trợ đồng đội, làm thêm ngoài ca chính, hoặc tăng cường giải phóng hàng gấp</b>.
                            </p>
                            <div className="space-y-1.5 text-xs text-stone-600 bg-white p-3 rounded-xl border border-stone-200">
                                <div className="font-bold text-stone-800">📌 Quy tắc cộng dồn mở trần:</div>
                                <div>• <b>Cộng thẳng vào Tổng điểm KPI:</b> Toàn bộ điểm việc phụ được cộng dồn trực tiếp.</div>
                                <div>• <b>Tỷ lệ thuận theo % đóng góp:</b> Điểm hỗ trợ = Điểm năng suất độ nặng × (% đóng góp / 100) (Ví dụ: Việc mức Vừa 35đ, bạn phụ 50% khối lượng &rarr; được cộng ngay <b>+17.5đ</b> thưởng; việc mức Nặng 40đ bạn phụ 18% &rarr; được cộng <b>+7.2đ</b>).</div>
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
                            <span>Ví dụ minh họa cách tính tổng điểm KPI cuối ngày của nhân viên Giang:</span>
                        </div>
                        <div className="space-y-1 text-stone-700 leading-relaxed pl-5 list-disc">
                            <div>1. <b>Việc chính (8h):</b> Giang đảm nhận bốc xếp và dỡ cont lạnh (mức Rất nặng), hoàn thành xuất sắc đạt <b>105 điểm</b> (Năng suất 50đ [40đ chuẩn + 10đ khối lượng lớn] • Chất lượng 5⭐ 20đ • An toàn 20đ • 5S 15đ).</div>
                            <div>2. <b>Việc phụ (+2h Tăng ca):</b> Giang tăng cường hỗ trợ đai kiện cho tổ xuất hàng (mức Nặng 45đ) với 18% đóng góp &rarr; Được cộng thêm <b>+8.1 điểm</b> việc phụ.</div>
                            <div>3. <b>Tổng thời gian làm việc:</b> 8h chuẩn + 2h tăng ca = <b>10 giờ làm việc cống hiến</b>.</div>
                            <div>4. <b>Tổng điểm KPI cuối ngày:</b> 105 + 8.1 = <b>113.1 điểm</b> &rarr; <b>Đạt Hạng Xuất sắc (A+)</b> và đứng vị trí Top 1 Bảng Thi Đua!</div>
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
                                    4. Danh Mục Lỗi Vi Phạm & Mức Trừ Điểm Kỷ Luật
                                </h2>
                                <p className="text-xs text-stone-500">
                                    Quy định rõ ràng từng hành vi để bảo vệ an toàn kho bãi và chất lượng hàng hóa
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
                                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                                    <div className="font-extrabold text-stone-900 text-xs flex items-center gap-1.5">
                                        <span className="text-base">{grp.icon}</span>
                                        <span>{grp.groupLabel}</span>
                                    </div>
                                    <span className="text-[10px] text-stone-500 font-bold">
                                        {grp.items.length} lỗi quy chuẩn
                                    </span>
                                </div>

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
                            Bất kỳ nhân sự nào để xảy ra sự cố thuộc mức <b>Nghiêm trọng (Severe)</b> hoặc điểm An toàn tụt xuống dưới hoặc bằng 5 điểm sẽ <b>tự động bị xếp Hạng C (Cần cải thiện)</b> bất kể năng suất có cao đến đâu.
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
                                    Bé Khỏe = Năng suất cao ⚡ • Bé Ngoan = An toàn & Kỷ luật 5S 🛡️
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
                                        Hoàn thành xuất sắc khối lượng công việc lớn hoặc có tăng cường hỗ trợ việc phụ; năng suất vượt trội; không vi phạm bất kỳ lỗi an toàn nào. Nhận ngay <b>Bông Hoa Đỏ</b>!
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
                                <b>Trả lời:</b> Không cộng dồn thành 200 điểm. Các công việc chính trong ngày sẽ được <b>tính trung bình cộng quy về thang ca chuẩn 100 điểm</b>. Nếu bạn muốn đạt trên 100 điểm (để được Hạng A+), bạn có thể nhận thêm <b>Việc phụ</b> (hỗ trợ ca khác, làm thêm ngoài ca), điểm việc phụ sẽ được cộng thẳng mở trần lên 120đ – 150đ+.
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
                                <b>Trả lời:</b> Hệ thống có tính năng <b>chấm điểm chất lượng độc lập cho từng cá nhân</b>. Quản lý có thể ghi nhận riêng cho bạn 20/20 điểm chất lượng tối đa mà không bị phụ thuộc vào điểm chung của nhóm.
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
                    </div>
                </div>
            )}
        </div>
    )
}

