/**
 * Quản lý địa chỉ kết nối Supabase thông minh:
 * - Khi mở từ máy chủ (localhost / 127.0.0.1): kết nối trực tiếp http://127.0.0.1:64321
 *   => Tốc độ cực nhanh (<1ms), chạy 100% OFFLINE không cần mạng internet.
 * - Khi mở từ bất kỳ tên miền ngoài nào (chanhthu.click, sarita.click, tenmienmoi.com, v.v.):
 *   => Tự động nhận diện kết nối đến https://api.<tên-miền> qua Cloudflare Tunnel!
 * - Khi chạy ở phía server (Node.js API routes & Middleware): luôn kết nối nội bộ 127.0.0.1:64321
 */

export const AUTH_COOKIE_NAME = 'sb-modularwms-auth-token';

export function getActiveSupabaseUrl(): string {
    // 1. Phía Trình duyệt (Browser / Client-side):
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        // Nếu người dùng đang mở trên máy chủ (chủ kho):
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://127.0.0.1:64321';
        }

        // Nếu mở qua địa chỉ IP mạng LAN nội bộ:
        if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
            return `http://${hostname}:64321`;
        }

        // Tự động gán api.<tên-miền> cho bất kỳ tên miền nào (chanhthu.click, sarita.click, tenmienmoi.com, v.v.)
        const rootDomain = hostname.startsWith('www.') ? hostname.substring(4) : hostname;
        if (rootDomain.includes('.')) {
            return `https://api.${rootDomain}`;
        }

        return process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://api.chanhthu.click';
    }

    // 2. Phía Máy chủ (Server-side / Node.js):
    // Luôn ưu tiên cổng cục bộ 127.0.0.1:64321 để tránh độ trễ internet và chạy offline hoàn toàn
    return process.env.INTERNAL_SUPABASE_URL || 'http://127.0.0.1:64321';
}

export function getServerSupabaseUrl(): string {
    return process.env.INTERNAL_SUPABASE_URL || 'http://127.0.0.1:64321';
}
