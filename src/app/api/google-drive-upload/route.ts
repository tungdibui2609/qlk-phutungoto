
import { NextRequest, NextResponse } from "next/server";
import { google, drive_v3 } from "googleapis";
import { Readable } from "stream";

export const runtime = 'nodejs';

// Cache cho folder ID để tránh gọi API nhiều lần
let cachedTargetFolderId: string | null = null;

async function getQuickFolder(drive: drive_v3.Drive, folderName: string, parentId: string): Promise<string> {
    try {
        const q = `name = '${folderName.replace(/'/g, "\\")}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`;
        const res = await drive.files.list({ q, fields: 'files(id)', pageSize: 1 });
        if (res.data.files && res.data.files.length > 0) return res.data.files[0].id!;
        
        const newFolder = await drive.files.create({
            requestBody: { name: folderName, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
            fields: 'id'
        });
        return newFolder.data.id!;
    } catch (e) {
        console.warn("Quick folder error:", e);
        return parentId; // Fallback về cha nếu lỗi
    }
}

export async function POST(req: NextRequest) {
    const startTime = Date.now();
    console.log(">>> [MOBILE-OPTIMIZED] Upload Start");

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const companyName = formData.get("companyName") as string || "CongTy";
        const warehouseName = formData.get("warehouseName") as string || "Chung";

        if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

        const rootFolderId = process.env.FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_ID;
        const clientId = process.env.CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
        const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

        if (!clientId || !clientSecret || !refreshToken || !rootFolderId) {
            return NextResponse.json({ error: "Config missing" }, { status: 500 });
        }

        const auth = new google.auth.OAuth2(clientId, clientSecret);
        auth.setCredentials({ refresh_token: refreshToken });
        const drive = google.drive({ version: 'v3', auth });

        // TỐI ƯU: Chỉ tạo 1 cấp folder nếu chưa có cache để giảm latency
        let targetFolderId = rootFolderId;
        const folderKey = `${companyName}_${warehouseName}`;
        
        // Đơn giản hóa: Upload vào folder theo tên công ty hoặc kho (chỉ 1 cấp)
        targetFolderId = await getQuickFolder(drive, warehouseName || companyName, rootFolderId);

        const buffer = Buffer.from(await file.arrayBuffer());
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);

        console.log(`>>> Sending to Google... Size: ${file.size} bytes`);
        
        const response = await drive.files.create({
            requestBody: {
                name: file.name,
                parents: [targetFolderId],
            },
            media: {
                mimeType: file.type,
                body: stream,
            },
            fields: 'id, name, webViewLink',
        });

        const fileId = response.data.id;
        console.log(`>>> Upload Done in ${Date.now() - startTime}ms. ID: ${fileId}`);

        // Set permission ASYNC - Không đợi bước này để trả kết quả nhanh cho Mobile
        if (fileId) {
            drive.permissions.create({
                fileId: fileId,
                requestBody: { role: 'reader', type: 'anyone' },
            }).catch(e => console.error("Async perm error:", e));
        }

        return NextResponse.json({
            success: true,
            fileId: fileId,
            name: response.data.name,
            link: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
            viewLink: response.data.webViewLink
        });

    } catch (error: any) {
        console.error(">>> [CRITICAL] Upload Fail:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}