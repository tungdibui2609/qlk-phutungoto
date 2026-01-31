
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
        const companyName = formData.get("companyName") as string;
        const warehouseName = formData.get("warehouseName") as string;
        const category = formData.get("category") as string; // [NEW] VD: Sản phẩm, Hóa đơn...

        // Cấu hình từ env
        const rootFolderId = process.env.FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_ID;
        const clientId = process.env.CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
        const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        if (!clientId || !clientSecret || !refreshToken || !rootFolderId) {
            return NextResponse.json({ error: "Missing Google Drive configuration" }, { status: 500 });
        }

        // 1. Auth OAuth2
        const auth = new google.auth.OAuth2(clientId, clientSecret);
        auth.setCredentials({ refresh_token: refreshToken });
        const drive = google.drive({ version: 'v3', auth });

        // 2. Xác định thư mục upload theo cây: Root > Company > Warehouse > Category
        let finalFolderId = rootFolderId;

        if (companyName) {
            finalFolderId = await getOrCreateFolder(drive, companyName, finalFolderId);
            if (warehouseName) {
                finalFolderId = await getOrCreateFolder(drive, warehouseName, finalFolderId);
                if (category) {
                    finalFolderId = await getOrCreateFolder(drive, category, finalFolderId);
                }
            }
        }

        // 3. Chuyển File thành Stream
        const buffer = Buffer.from(await file.arrayBuffer());
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);

        // 4. Upload File
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

        // 5. Set Public Permission
        if (fileId) {
            await drive.permissions.create({
                fileId: fileId,
                requestBody: {
                    role: 'reader',
                    type: 'anyone',
                },
            });
        }

        return NextResponse.json({
            success: true,
            fileId: fileId,
            name: response.data.name,
            link: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
            viewLink: response.data.webViewLink
        });

    } catch (error: any) {
        console.error("Organized Upload Error:", error);
        return NextResponse.json({
            error: error.message || "Upload failed",
            details: error.response?.data
        }, { status: 500 });
    }
}