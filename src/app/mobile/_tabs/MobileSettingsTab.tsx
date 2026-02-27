'use client'

import { useUser } from '@/contexts/UserContext'
import { useSystem } from '@/contexts/SystemContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { User, LogOut, ExternalLink, Shield, Smartphone } from 'lucide-react'

export default function MobileSettingsTab() {
    const { profile } = useUser()
    const { currentSystem } = useSystem()
    const router = useRouter()

    async function handleLogout() {
        await supabase.auth.signOut()
        router.push('/login')
    }

    return (
        <div className="mobile-animate-fade-in">
            <div className="mobile-header">
                <div className="mobile-header-brand">Sarita Workspace</div>
                <div className="mobile-header-title">Cài Đặt</div>
                <div className="mobile-header-subtitle">{currentSystem?.name || ''}</div>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* User Card */}
                <div className="mobile-card-premium" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                        <div style={{ width: 56, height: 56, borderRadius: 999, background: 'linear-gradient(135deg, #2563eb, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={26} color="white" />
                        </div>
                        <div>
                            <div style={{ fontSize: 18, fontWeight: 900, color: '#18181b' }}>{profile?.full_name || 'User'}</div>
                            <div style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 600 }}>{profile?.email || ''}</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f4f4f5' }}>
                            <span style={{ fontSize: 13, color: '#71717a' }}>Vai trò</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#18181b' }}>{profile?.roles?.code === 'admin' ? 'Quản trị viên' : profile?.roles?.code === 'manager' ? 'Quản lý' : (profile?.roles?.name || 'Nhân viên')}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f4f4f5' }}>
                            <span style={{ fontSize: 13, color: '#71717a' }}>Hệ thống</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#18181b' }}>{currentSystem?.name || '---'}</span>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <div className="mobile-section-label">Điều hướng nhanh</div>

                <a href="/" style={{ textDecoration: 'none' }}>
                    <div className="mobile-card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 42, height: 42, borderRadius: 14, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                            <ExternalLink size={20} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#18181b' }}>Trang quản lý web</div>
                            <div style={{ fontSize: 11, color: '#a1a1aa' }}>Dashboard đầy đủ trên trình duyệt</div>
                        </div>
                    </div>
                </a>

                <a href="/warehouses/scan/assign" style={{ textDecoration: 'none' }}>
                    <div className="mobile-card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 42, height: 42, borderRadius: 14, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
                            <Smartphone size={20} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#18181b' }}>Gán Vị Trí (Desktop)</div>
                            <div style={{ fontSize: 11, color: '#a1a1aa' }}>Phiên bản đầy đủ cho màn hình lớn</div>
                        </div>
                    </div>
                </a>

                {/* About */}
                <div className="mobile-section-label" style={{ marginTop: 8 }}>Thông tin</div>
                <div className="mobile-card" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <Shield size={16} color="#2563eb" />
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#18181b' }}>Sarita Mobile Workspace</span>
                    </div>
                    <p style={{ fontSize: 11, color: '#a1a1aa', lineHeight: 1.6 }}>
                        Phiên bản mobile được tối ưu cho điện thoại, cho phép quét mã QR, gán vị trí, xuất kho ngay tại kho hàng.
                    </p>
                    <div style={{ fontSize: 10, color: '#d4d4d8', marginTop: 12, fontWeight: 600 }}>
                        v1.0.0 • Powered by Sarita
                    </div>
                </div>

                {/* Logout */}
                <button onClick={handleLogout} className="mobile-btn mobile-btn--lg"
                    style={{ background: '#fef2f2', color: '#e11d48', boxShadow: 'none', border: '1px solid #fecaca', marginTop: 8 }}>
                    <LogOut size={18} />
                    Đăng xuất
                </button>

                <div style={{ height: 20 }} />
            </div>
        </div>
    )
}
