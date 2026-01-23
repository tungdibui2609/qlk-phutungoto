import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

export const runtime = 'nodejs';

function ensureCloudinaryConfigured() {
    try {
        const url = (process.env.CLOUDINARY_URL || "").trim();
        if (url) {
            try {
                const u = new URL(url);
                const cloud_name = u.hostname;
                const api_key = decodeURIComponent(u.username);
                const api_secret = decodeURIComponent(u.password);
                if (cloud_name && api_key && api_secret) {
                    cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
                    return true;
                }
            } catch (err) {
                console.log("Failed to parse CLOUDINARY_URL, trying env-based config:", err);
                process.env.CLOUDINARY_URL = url;
                cloudinary.config({ secure: true });
                return true;
            }
        }
        const cloud_name = (process.env.CLOUDINARY_CLOUD_NAME || "").trim();
        const api_key = (process.env.CLOUDINARY_API_KEY || "").trim();
        const api_secret = (process.env.CLOUDINARY_API_SECRET || "").trim();
        if (cloud_name && api_key && api_secret) {
            cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
            return true;
        }
        console.error("Cloudinary not configured - missing env vars");
        return false;
    } catch (err) {
        console.error("Error in ensureCloudinaryConfigured:", err);
        return false;
    }
}

function toPublicId(name?: string) {
    const base = ((name || '').toString()).replace(/\.[^.]+$/, '');
    return base.replace(/[^a-zA-Z0-9_\-/]+/g, '_').slice(0, 200) || `upload-${Date.now()}`;
}

export async function POST(req: NextRequest) {
    try {
        if (!ensureCloudinaryConfigured()) {
            return NextResponse.json({
                error: "MISSING_CLOUDINARY_CONFIG",
                message: "Cloudinary configuration missing."
            }, { status: 400 });
        }

        const form = await req.formData();
        const file = form.get("file");
        const preferredName = (form.get("filename") || "").toString();
        const customFolder = (form.get("folder") || "").toString();

        if (!(file instanceof File)) {
            return NextResponse.json({ error: "FILE_REQUIRED" }, { status: 400 });
        }

        const buf = Buffer.from(await file.arrayBuffer());
        const folder = customFolder || (process.env.CLOUDINARY_NOTE_FOLDER || 'uploads').toString();
        const opts: any = { folder, resource_type: 'image' };
        if (preferredName) {
            opts.public_id = toPublicId(preferredName);
            opts.unique_filename = true;
        }

        const result = await new Promise<any>((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(opts, (err: any, res: any) => {
                if (err) return reject(err);
                resolve(res);
            });
            stream.end(buf);
        });

        const secureUrl = (result?.secure_url || result?.url || '').toString();
        if (!secureUrl) {
            return NextResponse.json({ error: 'UPLOAD_FAILED' }, { status: 500 });
        }

        return NextResponse.json({
            viewUrl: secureUrl,
            secureUrl,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
            bytes: result.bytes,
            format: result.format
        });
    } catch (err: any) {
        console.error("Upload error:", err);
        return NextResponse.json({
            error: err?.message || 'UPLOAD_ERROR',
            details: err?.toString?.() || "Unknown error"
        }, { status: 500 });
    }
}
