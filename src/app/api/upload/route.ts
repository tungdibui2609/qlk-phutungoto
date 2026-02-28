import { NextRequest, NextResponse } from "next/server";
import { google, drive_v3 } from "googleapis";
import { Readable } from "stream";

export const runtime = 'nodejs';

/**
 * Tìm hoặc tạo thư mục theo tên trong thư mục cha
 */
async function getOrCreateFolder(drive: drive_v3.Drive, folderName: string, parentId: string): Promise<string> {
    const q = `name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`;
    const res = await drive.files.list({ q, fields: 'files(id, name)' });

    if (res.data.files && res.data.files.length > 0) {
        return res.data.files[0].id!;
    }

    // Tạo mới nếu không thấy
    const newFolder = await drive.files.create({
        requestBody: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId]
        },
        fields: 'id'
    });
    return newFolder.data.id!;
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const customFolder = (formData.get("folder") || "uploads").toString();

        // Lấy cấu hình Drive từ biến môi trường (Giống cách api/google-drive-upload đang dùng)
        const rootFolderId = process.env.FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_ID;
        const clientId = process.env.CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
        const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

        if (!file) {
            return NextResponse.json({ error: "FILE_REQUIRED" }, { status: 400 });
        }

        if (!(file instanceof File)) {
            return NextResponse.json({ error: "FILE_REQUIRED" }, { status: 400 });
        }

        if (!clientId || !clientSecret || !refreshToken || !rootFolderId) {
            return NextResponse.json({
                error: "MISSING_DRIVE_CONFIG",
                message: "Cấu hình Google Drive chưa đầy đủ. Yêu cầu CLIENT_ID, CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, FOLDER_ID"
            }, { status: 500 });
        }

        // 1. Authenticate with Google Drive OAuth2
        const auth = new google.auth.OAuth2(clientId, clientSecret);
        auth.setCredentials({ refresh_token: refreshToken });
        const drive = google.drive({ version: 'v3', auth });

        // 2. Xác định thư mục upload
        let finalFolderId = rootFolderId;

        // Nếu client có truyền lên biến folder (VD: "img-lot"), tạo thư mục đó bên trong thư mục gốc
        if (customFolder) {
            finalFolderId = await getOrCreateFolder(drive, customFolder, finalFolderId);
        }

        // 3. Chuyển nội dung File thành Stream để pipe lên Drive
        const buffer = Buffer.from(await file.arrayBuffer());
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);

        // 4. Gọi API Upload File của Google Drive
        const response = await drive.files.create({
            requestBody: {
                name: file.name,
                parents: [finalFolderId],
            },
            media: {
                mimeType: file.type,
                body: stream,
            },
            fields: 'id, name, webViewLink',
            supportsAllDrives: true,
        });

        const fileId = response.data.id;

        // 5. Cấp quyền xem công khai (bắt buộc để hiển thị ảnh trên Web với thẻ <img>)
        if (fileId) {
            await drive.permissions.create({
                fileId: fileId,
                requestBody: {
                    role: 'reader',
                    type: 'anyone',
                },
            });
        }

        // Tạo thumbnail link để hiển thị trực tiếp (hack để dùng được thẻ img)
        const secureUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;

        // 6. Trả kết quả chuẩn (Giữ nguyên định dạng cũ của Cloudinary để UI không bị hỏng)
        return NextResponse.json({
            viewUrl: response.data.webViewLink,
            secureUrl: secureUrl,
            publicId: fileId,
            width: 0,
            height: 0,
            bytes: file.size,
            format: file.type
        });

    } catch (error: any) {
        console.error("Google Drive Upload Error:", error);
        return NextResponse.json({
            error: error.message || 'UPLOAD_ERROR',
            details: error?.response?.data || error?.toString?.() || "Unknown error"
        }, { status: 500 });
    }
}
