import { createAdminSupabaseClient } from './geminiStampOcr'

export const STAMP_GOOGLE_APPS_SCRIPT_TEMPLATE = `// === GOOGLE APPS SCRIPT CHO HỆ THỐNG CON DẤU WMS ===
// Cấu trúc lưu trữ: CON_DAU / <NĂM_THÁNG> / STT_<Mã_Pallet>_<Thời_Gian>.jpg

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responseJson({ success: false, error: "Không có dữ liệu gửi lên" });
    }

    var data = JSON.parse(e.postData.contents);

    // 1. Kiểm tra kết nối (Ping)
    if (data.action === "ping") {
      var rootFolder = getOrCreateFolder(DriveApp.getRootFolder(), "CON_DAU");
      return responseJson({ 
        success: true, 
        message: "Kết nối Google Drive thành công!", 
        rootUrl: rootFolder.getUrl() 
      });
    }

    // 2. Nhận dữ liệu ảnh base64
    var base64Data = data.base64;
    if (!base64Data) {
      return responseJson({ success: false, error: "Thiếu dữ liệu ảnh base64" });
    }

    var palletStt = (data.palletStt || "UNKNOWN").toString().replace(/[^a-zA-Z0-9_-]/g, "_");
    var yearMonth = data.yearMonth || Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM");
    var timestamp = new Date().getTime();
    var filename = data.filename || ("STT_" + palletStt + "_" + timestamp + ".jpg");
    var mimeType = data.mimeType || "image/jpeg";

    // 3. Tạo thư mục: CON_DAU / <yearMonth>
    var rootFolder = getOrCreateFolder(DriveApp.getRootFolder(), "CON_DAU");
    var subFolder = getOrCreateFolder(rootFolder, yearMonth);

    // 4. Lưu file ảnh lên Google Drive
    var bytes = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(bytes, mimeType, filename);
    var file = subFolder.createFile(blob);

    // Bật quyền xem bằng liên kết (Anyone with link view)
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      // Bỏ qua nếu domain Google Workspace chặn public link
    }

    var fileId = file.getId();
    var viewUrl = file.getUrl();
    var thumbnailUrl = "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w1000";

    return responseJson({
      success: true,
      fileId: fileId,
      filename: filename,
      folderPath: "CON_DAU/" + yearMonth,
      viewUrl: viewUrl,
      thumbnailUrl: thumbnailUrl
    });

  } catch (err) {
    return responseJson({ success: false, error: err.toString() });
  }
}

function getOrCreateFolder(parent, name) {
  var folders = parent.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parent.createFolder(name);
}

function responseJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`

export interface StampDriveUploadResult {
  success: boolean
  fileId?: string
  viewUrl?: string
  thumbnailUrl?: string
  error?: string
}

export async function uploadStampImageToGoogleDrive(params: {
  webhookUrl: string
  base64Data: string
  palletStt: string
  filename?: string
  mimeType?: string
}): Promise<StampDriveUploadResult> {
  const { webhookUrl, base64Data, palletStt, filename, mimeType = 'image/jpeg' } = params

  if (!webhookUrl || !webhookUrl.trim()) {
    return { success: false, error: 'Chưa cấu hình Google Apps Script Webhook URL cho con dấu' }
  }

  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '')
  const now = new Date()
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const cleanStt = (palletStt || 'UNKNOWN').trim().toUpperCase().replace(/[^a-zA-Z0-9_-]/g, '_')
  const finalFilename = filename || `STT_${cleanStt}_${Date.now()}.jpg`

  try {
    const res = await fetch(webhookUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'upload',
        base64: cleanBase64,
        palletStt: cleanStt,
        yearMonth,
        filename: finalFilename,
        mimeType,
      }),
    })

    if (!res.ok) {
      throw new Error(`Google Apps Script trả về lỗi HTTP ${res.status}`)
    }

    const data: any = await res.json()
    if (!data.success) {
      throw new Error(data.error || 'Google Apps Script xử lý không thành công')
    }

    return {
      success: true,
      fileId: data.fileId,
      viewUrl: data.viewUrl,
      thumbnailUrl: data.thumbnailUrl || (data.fileId ? `https://drive.google.com/thumbnail?id=${data.fileId}&sz=w1000` : data.viewUrl),
    }
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Không thể kết nối tới Google Apps Script Webhook',
    }
  }
}

export async function getCompanyStampDriveWebhook(companyId?: string | null): Promise<string | null> {
  try {
    const admin = createAdminSupabaseClient()
    let query = admin
      .from('company_ai_settings')
      .select('drive_webhook_url')
      .limit(1)

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    const { data } = await query.maybeSingle()
    if (data?.drive_webhook_url && String(data.drive_webhook_url).trim()) {
      return String(data.drive_webhook_url).trim()
    }
  } catch (err) {
    console.warn('[StampDrive] Không đọc được drive_webhook_url:', err)
  }
  return null
}
