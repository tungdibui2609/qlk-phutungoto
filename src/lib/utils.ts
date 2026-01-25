import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function generateAppTitle(companyName: string): string {
    // Logic rút gọn tên:
    // 1. Loại bỏ các tiền tố công ty phổ biến (không phân biệt hoa thường)
    const prefixes = ["Công Ty", "TNHH", "Cổ Phần", "Tư Vấn", "Dịch Vụ", "Thương Mại", "Sản Xuất"];

    let shortName = companyName;

    // Xử lý đơn giản: Tách chuỗi và loại bỏ các từ nằm trong blacklist prefixes
    // Tuy nhiên, để chính xác hơn với "Công Ty TNHH Toàn Thắng" -> "Toàn Thắng"
    // Ta có thể dùng regex hoặc replace tuần tự.

    // Cách đơn giản nhất cho trường hợp này:
    // Xóa "Công Ty TNHH" ở đầu
    shortName = shortName.replace(/^Công Ty TNHH\s+/i, "");
    shortName = shortName.replace(/^Công Ty CP\s+/i, "");
    shortName = shortName.replace(/^Công Ty\s+/i, "");

    // Thêm hậu tố tiếng Anh
    return `${shortName} - Warehouse Management`;
}

export interface ProductMediaItem {
    url: string;
    type: string;
}

export interface ProductImageSource {
    image_url: string | null;
    product_media?: ProductMediaItem[];
}

export function getProductDisplayImage(product: ProductImageSource): string | null {
    let url = product.image_url;

    // Prioritize product_media
    if (product.product_media && product.product_media.length > 0) {
        // 1. Try to find an explicit image
        const firstImage = product.product_media.find(m => m.type === 'image');
        if (firstImage) {
            url = firstImage.url;
        } else {
            // 2. If no image, but we have a Google Drive link (video?), try it anyway
            const firstDriveMedia = product.product_media.find(m => m.url.includes('drive.google.com'));
            if (firstDriveMedia) {
                url = firstDriveMedia.url;
            }
        }
    }

    if (!url) return null;

    // Google Drive check
    const idMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) {
        const thumbUrl = `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w600`;
        return thumbUrl;
    }

    return url;
}
