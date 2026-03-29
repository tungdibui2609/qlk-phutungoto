
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
    console.log("--- Google Drive Upload Started ---");
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const companyName = formData.get("companyName") as string || "Công ty";
        const warehouseName = formData.get("warehouseName") as string || "Chung";
        const category = formData.get("category") as string || "Khác";

        console.log(`Uploading: ${file?.name} (${file?.size} bytes) to ${companyName}/${warehouseName}/${category}`);

        // Cấu hình từ env
        const rootFolderId = process.env.FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_ID;
        const clientId = process.env.CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
        const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

        if (!file) {
            console.error("Error: No file in formData");
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        if (!clientId || !clientSecret || !refreshToken || !rootFolderId) {
            console.error("Error: Missing ENV keys for Google Drive");
            return NextResponse.json({ error: "Missing Google Drive configuration" }, { status: 500 });
        }

        // 1. Auth OAuth2
        const auth = new google.auth.OAuth2(clientId, clientSecret);
        auth.setCredentials({ refresh_token: refreshToken });
        const drive = google.drive({ version: 'v3', auth });

        // 2. Xác định thư mục upload theo cây: Root > Company > Warehouse > Category
        let finalFolderId = rootFolderId;
        console.log(`Root Folder: ${finalFolderId}`);

        try {
            finalFolderId = await getOrCreateFolder(drive, companyName, finalFolderId);
            finalFolderId = await getOrCreateFolder(drive, warehouseName, finalFolderId);
            finalFolderId = await getOrCreateFolder(drive, category, finalFolderId);
            console.log(`Target Folder ID: ${finalFolderId}`);
        } catch (folderErr) {
            console.warn("Folder navigation error, falling back to root:", folderErr);
        }

        // 3. Chuyển File thành Buffer (Ổn định hơn Stream cũ trên Serverless)
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Tạo stream từ buffer theo đúng chuẩn NodeJS Readable
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);

        // 4. Upload File
        console.log("Starting drive.files.create...");
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
        });

        const fileId = response.data.id;
        console.log(`Upload Success! File ID: ${fileId}`);

        // 5. Set Public Permission (Reader cho mọi người có link)
        if (fileId) {
            try {
                await drive.permissions.create({
                    fileId: fileId,
                    requestBody: {
                        role: 'reader',
                        type: 'anyone',
                    },
                });
                console.log("Permissions set to public reader");
            } catch (permErr) {
                console.error("Permission error (non-critical):", permErr);
            }
        }

        return NextResponse.json({
            success: true,
            fileId: fileId,
            name: response.data.name,
            link: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
            viewLink: response.data.webViewLink
        });

    } catch (error: any) {
        console.error("--- Google Drive Upload FAILED ---");
        console.error("Error Message:", error.message);
        console.error("Error Stack:", error.stack);
        
        return NextResponse.json({
            error: error.message || "Upload failed",
            details: error.response?.data || error.toString()
        }, { status: 500 });
    }
}