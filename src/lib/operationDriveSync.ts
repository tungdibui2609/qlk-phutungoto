import { supabase } from './supabaseClient'
import { normalizeBaseSystemCode } from './operationImages'

export interface OperationFolder {
    id: string
    company_id?: string | null
    system_code: string
    parent_id?: string | null
    name: string
    created_by?: string | null
    created_by_name?: string | null
    created_at?: string
}

export interface OperationDriveSettings {
    id?: string
    company_id?: string | null
    system_code: string
    webhook_url: string
    root_folder_name: string
    auto_sync_enabled: boolean
    auto_delete_local_days?: number | null
    updated_at?: string
}

export const GOOGLE_APPS_SCRIPT_TEMPLATE = `// === GOOGLE APPS SCRIPT CHO HỆ THỐNG KHO WMS (HỖ TRỢ THƯ MỤC ĐA CẤP) ===
//
// HƯỚNG DẪN CÀI ĐẶT NHANH:
// 1. Mở https://script.google.com -> Tạo dự án mới
// 2. Xoá code mặc định và dán toàn bộ đoạn code này vào Code.gs -> Nhấn Lưu (Ctrl+S)
// 3. Chọn hàm "khoiTaoQuyenDrive" ở thanh trên -> Bấm Chạy (Run) để cấp quyền Google Drive
// 4. Bấm "Triển khai" (Deploy) -> "Tạo bản triển khai mới" (New deployment) -> Loại: "Ứng dụng web" (Web app)
//    - Thực thi dưới tư cách: Tôi (Me)
//    - Ai có quyền truy cập: Bất kỳ ai (Anyone)
// 5. Sao chép URL Web App dán vào phần Cài đặt Google Drive trong trang Album Hình Ảnh.

function khoiTaoQuyenDrive() {
  var rootName = "WMS_HinhAnh_Kho";
  var folders = DriveApp.getFoldersByName(rootName);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(rootName);
  Logger.log("Đã khởi tạo thư mục gốc: " + folder.getUrl());
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responseJson({ success: false, error: "Không có dữ liệu gửi lên" });
    }

    var data = JSON.parse(e.postData.contents);

    if (data.action === "ping") {
      var testRootName = data.rootFolder || "WMS_HinhAnh_Kho";
      var testFolders = DriveApp.getFoldersByName(testRootName);
      var testRoot = testFolders.hasNext() ? testFolders.next() : DriveApp.createFolder(testRootName);
      return responseJson({ success: true, message: "Kết nối thành công", rootUrl: testRoot.getUrl() });
    }

    var rootName = data.rootFolder || "WMS_HinhAnh_Kho";
    var folderPath = data.folderPath || "";
    var filename = data.filename || ("wms_" + new Date().getTime() + ".jpg");
    var mimeType = data.mimeType || "image/jpeg";
    var base64Data = data.base64;

    if (!base64Data) {
      return responseJson({ success: false, error: "Thiếu dữ liệu ảnh base64" });
    }

    // 1. Tìm hoặc tạo thư mục gốc
    var rootFolders = DriveApp.getFoldersByName(rootName);
    var currentFolder = rootFolders.hasNext() ? rootFolders.next() : DriveApp.createFolder(rootName);

    // 2. Tạo cây thư mục con đa cấp (VD: KHO_DONG_LANH / 2026-11 / Ten_Cong_Viec)
    if (folderPath) {
      var parts = folderPath.toString().replace(/\\\\/g, '/').split('/').map(function(s) {
        return s.trim();
      }).filter(function(s) {
        return s.length > 0;
      });
      for (var i = 0; i < parts.length; i++) {
        var subName = parts[i];
        var subFolders = currentFolder.getFoldersByName(subName);
        currentFolder = subFolders.hasNext() ? subFolders.next() : currentFolder.createFolder(subName);
      }
    }

    // 3. Giải mã base64 & lưu file lên Google Drive + bật quyền xem bằng link để mọi thiết bị xem trực tiếp
    var bytes = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(bytes, mimeType, filename);
    var file = currentFolder.createFile(blob);
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      // Một số domain Workspace chặn Anyone with link, vẫn tiếp tục trả về fileId
    }

    var fileId = file.getId();
    return responseJson({
      success: true,
      fileId: fileId,
      fileUrl: file.getUrl(),
      directUrl: "https://lh3.googleusercontent.com/d/" + fileId + "=w1600",
      folderName: currentFolder.getName()
    });
  } catch (err) {
    return responseJson({ success: false, error: err.toString() });
  }
}

function responseJson(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`

export async function listOperationFolders(systemCode: string, companyId?: string | null): Promise<OperationFolder[]> {
    const baseSys = normalizeBaseSystemCode(systemCode)
    let query = (supabase.from('operation_folders' as any) as any)
        .select('*')
        .eq('system_code', baseSys)
        .order('name', { ascending: true })

    if (companyId) {
        query = query.eq('company_id', companyId)
    }

    const { data, error } = await query
    if (error) throw error
    return (data || []) as OperationFolder[]
}

export async function createOperationFolder(params: {
    systemCode: string
    companyId?: string | null
    parentId?: string | null
    name: string
    userId?: string | null
    userName?: string | null
}): Promise<OperationFolder> {
    const baseSys = normalizeBaseSystemCode(params.systemCode)
    const { data, error } = await (supabase.from('operation_folders' as any) as any)
        .insert([
            {
                system_code: baseSys,
                company_id: params.companyId || null,
                parent_id: params.parentId || null,
                name: params.name.trim(),
                created_by: params.userId || null,
                created_by_name: params.userName || null,
            },
        ])
        .select('*')
        .single()

    if (error) throw error
    return data as OperationFolder
}

export async function renameOperationFolder(folderId: string, name: string): Promise<void> {
    const { error } = await (supabase.from('operation_folders' as any) as any)
        .update({ name: name.trim() })
        .eq('id', folderId)

    if (error) throw error
}

export async function deleteOperationFolder(folderId: string): Promise<void> {
    const { error } = await (supabase.from('operation_folders' as any) as any)
        .delete()
        .eq('id', folderId)

    if (error) throw error
}

export function buildFolderPathMap(folders: OperationFolder[]): Map<string, string> {
    const byId = new Map<string, OperationFolder>()
    folders.forEach((f) => byId.set(f.id, f))

    const pathMap = new Map<string, string>()
    const getPath = (id: string, depth = 0): string => {
        if (depth > 10) return ''
        if (pathMap.has(id)) return pathMap.get(id)!
        const node = byId.get(id)
        if (!node) return ''
        const parentPath = node.parent_id ? getPath(node.parent_id, depth + 1) : ''
        const full = parentPath ? `${parentPath}/${node.name}` : node.name
        pathMap.set(id, full)
        return full
    }

    folders.forEach((f) => getPath(f.id))
    return pathMap
}

export async function getDriveSettings(systemCode: string): Promise<OperationDriveSettings> {
    const baseSys = normalizeBaseSystemCode(systemCode)
    const { data } = await (supabase.from('operation_drive_settings' as any) as any)
        .select('*')
        .eq('system_code', baseSys)
        .maybeSingle()

    return (
        (data as OperationDriveSettings) || {
            system_code: baseSys,
            webhook_url: '',
            root_folder_name: 'WMS_HinhAnh_Kho',
            auto_sync_enabled: false,
            auto_delete_local_days: null,
        }
    )
}

export async function saveDriveSettings(params: OperationDriveSettings & { userId?: string | null }): Promise<void> {
    const baseSys = normalizeBaseSystemCode(params.system_code)
    const { error } = await (supabase.from('operation_drive_settings' as any) as any).upsert(
        {
            system_code: baseSys,
            company_id: params.company_id || null,
            webhook_url: params.webhook_url.trim(),
            root_folder_name: params.root_folder_name.trim() || 'WMS_HinhAnh_Kho',
            auto_sync_enabled: !!params.auto_sync_enabled,
            auto_delete_local_days:
                params.auto_delete_local_days != null && params.auto_delete_local_days > 0
                    ? Number(params.auto_delete_local_days)
                    : null,
            updated_by: params.userId || null,
            updated_at: new Date().toISOString(),
        },
        { onConflict: 'system_code' }
    )
    if (error) throw error
}

export async function syncImagesToGoogleDrive(imageIds: string[], systemCode: string): Promise<{
    syncedCount: number
    failedCount: number
    errors: string[]
}> {
    const res = await fetch('/api/so-lieu/drive-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'sync',
            imageIds,
            systemCode: normalizeBaseSystemCode(systemCode),
        }),
    })
    const json = await res.json()
    if (!res.ok || !json.success) {
        throw new Error(json.error || 'Lỗi đồng bộ Google Drive')
    }
    return {
        syncedCount: json.syncedCount || 0,
        failedCount: json.failedCount || 0,
        errors: json.errors || [],
    }
}

export async function testGoogleDriveWebhook(webhookUrl: string, rootFolderName: string): Promise<{
    success: boolean
    message?: string
    error?: string
}> {
    const res = await fetch('/api/so-lieu/drive-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'ping',
            webhookUrl,
            rootFolderName,
        }),
    })
    return await res.json()
}
