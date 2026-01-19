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
