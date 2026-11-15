'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  X,
  Camera,
  Image as ImageIcon,
  FolderOpen,
  Folder,
  ArrowUp,
  Plus,
  CloudUpload,
  CloudCheck,
  Settings,
  Trash2,
  RefreshCw,
  Search,
  Calendar,
  Briefcase,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ArrowLeft,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import {
  DeliveryShift,
  getWarehouseProducts,
  syncOperationsOfflineQueue,
} from './operationsService'
import {
  OperationImageRecord,
  OperationFolder,
  OperationDriveSettings,
  capturePhotoWithCamera,
  pickPhotosFromLibrary,
  uploadOperationImages,
  getShiftOperationImages,
  listSystemOperationImages,
  deleteOperationImage,
  getOperationImageDisplayUrl,
  syncOfflineOperationImages,
  cleanupExpiredLocalOriginals,
  getLocalAutoDeleteDays,
  setLocalAutoDeleteDays,
  getWatermarkEnabled,
  setWatermarkEnabled,
  listOperationFolders,
  createOperationFolder,
  deleteOperationFolder,
  getDriveSettings,
  saveDriveSettings,
  syncImagesToGoogleDrive,
  normalizeSearchText,
} from './operationImagesService'

export interface JournalImageTarget {
  id: string
  itemName: string
  itemSku?: string | null
  quantity: number
  unit: string
  direction: 'in' | 'out'
}

// ── 1. OPERATION IMAGES MODAL (ALBUM TRONG CA / ĐỢT) ──────────
export function OperationImagesModal({
  visible,
  shift,
  user,
  journalTarget,
  onClose,
  onChanged,
}: {
  visible: boolean
  shift: DeliveryShift | null
  user: any
  journalTarget?: JournalImageTarget | null
  onClose: () => void
  onChanged?: (count: number) => void
}) {
  const [images, setImages] = useState<OperationImageRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'in' | 'out' | 'shift'>('all')
  const [selectedImage, setSelectedImage] = useState<OperationImageRecord | null>(null)

  const [folders, setFolders] = useState<OperationFolder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [syncingDrive, setSyncingDrive] = useState(false)
  const [driveSettingsModal, setDriveSettingsModal] = useState(false)
  const [driveSettings, setDriveSettings] = useState<OperationDriveSettings>({
    system_code: '',
    webhook_url: '',
    root_folder_name: 'WMS_HinhAnh_Kho',
    auto_sync_enabled: false,
  })
  const [savingDrive, setSavingDrive] = useState(false)
  const [localAutoDeleteDays, setLocalAutoDeleteDaysState] = useState<number | null>(null)
  const [watermarkEnabled, setWatermarkEnabledState] = useState<boolean>(true)

  const loadData = useCallback(async () => {
    if (!shift) return
    setLoading(true)
    try {
      await syncOperationsOfflineQueue().catch(() => {})
      await syncOfflineOperationImages().catch(() => {})
      const [list, folderList, cfg, localDays, wmEnabled] = await Promise.all([
        getShiftOperationImages(shift.id),
        listOperationFolders(shift.system_code, shift.company_id || user?.company_id || null).catch(
          () => []
        ),
        getDriveSettings(shift.system_code).catch(() => ({
          system_code: shift.system_code,
          webhook_url: '',
          root_folder_name: 'WMS_HinhAnh_Kho',
          auto_sync_enabled: false,
          auto_delete_local_days: null,
        })),
        getLocalAutoDeleteDays().catch(() => null),
        getWatermarkEnabled().catch(() => true),
      ])
      setImages(list)
      setFolders(folderList)
      setDriveSettings(cfg)
      setLocalAutoDeleteDaysState(localDays)
      setWatermarkEnabledState(wmEnabled)
      onChanged?.(list.length)
      cleanupExpiredLocalOriginals(shift.system_code, localDays).catch(() => {})
    } finally {
      setLoading(false)
    }
  }, [shift, user?.company_id, onChanged])

  useEffect(() => {
    if (!visible || !shift) return
    void loadData()
  }, [visible, shift, loadData])

  const childFolders = useMemo(
    () => folders.filter(f => (f.parent_id || null) === selectedFolderId),
    [folders, selectedFolderId]
  )

  const selectedFolderObj = useMemo(
    () => folders.find(f => f.id === selectedFolderId) || null,
    [folders, selectedFolderId]
  )

  const filteredImages = useMemo(() => {
    return images.filter(img => {
      if (journalTarget && img.journal_id !== journalTarget.id) return false
      if (selectedFolderId && img.folder_id !== selectedFolderId) return false
      if (filter === 'all') return true
      if (filter === 'in') return img.direction === 'in'
      if (filter === 'out') return img.direction === 'out'
      return img.scope === 'shift' || img.scope === 'sub_shift'
    })
  }, [images, journalTarget, selectedFolderId, filter])

  const unsyncedImages = useMemo(
    () => filteredImages.filter(img => !img.is_offline && !img.drive_file_id),
    [filteredImages]
  )

  if (!visible || !shift) return null

  const jobName = shift.summary_data?.job_name || shift.notes || 'Công việc'

  const handleAddFromCamera = async () => {
    if (uploading) return
    const photo = await capturePhotoWithCamera()
    if (!photo) return
    setUploading(true)
    try {
      await uploadOperationImages({
        images: [photo],
        systemCode: shift.system_code,
        companyId: shift.company_id || user?.company_id || null,
        shiftId: shift.id,
        journalId: journalTarget?.id || null,
        folderId: selectedFolderId,
        scope: journalTarget ? 'journal' : 'shift',
        direction: journalTarget?.direction || null,
        jobName,
        itemName: journalTarget?.itemName || null,
        itemSku: journalTarget?.itemSku || null,
        quantity: journalTarget?.quantity ?? null,
        unit: journalTarget?.unit || null,
        user,
      })
      await loadData()
    } finally {
      setUploading(false)
    }
  }

  const handleAddFromLibrary = async () => {
    if (uploading) return
    const picked = await pickPhotosFromLibrary(8)
    if (picked.length === 0) return
    setUploading(true)
    try {
      await uploadOperationImages({
        images: picked,
        systemCode: shift.system_code,
        companyId: shift.company_id || user?.company_id || null,
        shiftId: shift.id,
        journalId: journalTarget?.id || null,
        folderId: selectedFolderId,
        scope: journalTarget ? 'journal' : 'shift',
        direction: journalTarget?.direction || null,
        jobName,
        itemName: journalTarget?.itemName || null,
        itemSku: journalTarget?.itemSku || null,
        quantity: journalTarget?.quantity ?? null,
        unit: journalTarget?.unit || null,
        user,
      })
      await loadData()
    } finally {
      setUploading(false)
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    try {
      const created = await createOperationFolder({
        systemCode: shift.system_code,
        companyId: shift.company_id || user?.company_id || null,
        parentId: selectedFolderId,
        name: newFolderName.trim(),
        user,
      })
      setNewFolderName('')
      setShowNewFolderInput(false)
      await loadData()
      setSelectedFolderId(created.id)
    } catch (e: any) {
      alert('Lỗi tạo thư mục: ' + (e?.message || e))
    }
  }

  const handleSyncDrive = async (targetImages: OperationImageRecord[]) => {
    if (syncingDrive || targetImages.length === 0) return
    if (!driveSettings.webhook_url?.trim()) {
      setDriveSettingsModal(true)
      return
    }
    setSyncingDrive(true)
    try {
      const res = await syncImagesToGoogleDrive({
        images: targetImages,
        systemCode: shift.system_code,
        folders,
      })
      await loadData()
      if (res.failedCount > 0) {
        alert(
          `Đồng bộ Google Drive: Thành công ${res.syncedCount}, Lỗi ${res.failedCount}\n${res.errors[0] || ''}`
        )
      } else {
        alert(`Đã đẩy ${res.syncedCount} ảnh lên Google Drive!`)
      }
    } catch (e: any) {
      alert('Lỗi Google Drive: ' + (e?.message || 'Không thể đồng bộ lên Drive'))
    } finally {
      setSyncingDrive(false)
    }
  }

  const handleSaveDrive = async () => {
    setSavingDrive(true)
    try {
      await setLocalAutoDeleteDays(localAutoDeleteDays)
      await setWatermarkEnabled(watermarkEnabled)
      if (driveSettings.webhook_url?.trim()) {
        await saveDriveSettings({
          ...driveSettings,
          system_code: shift.system_code,
          company_id: shift.company_id || user?.company_id || null,
          userId: user?.id || null,
        })
      }
      setDriveSettingsModal(false)
      await syncOfflineOperationImages().catch(() => {})
      await loadData()
    } catch (e: any) {
      alert('Lỗi lưu cấu hình: ' + (e?.message || e))
    } finally {
      setSavingDrive(false)
    }
  }

  const handleDelete = async (img: OperationImageRecord) => {
    if (!window.confirm('Bạn chắc chắn muốn xóa hình ảnh chứng minh này?')) return
    try {
      await deleteOperationImage(img)
      if (selectedImage?.id === img.id) setSelectedImage(null)
      await loadData()
    } catch (e: any) {
      alert('Lỗi xóa ảnh: ' + (e?.message || e))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0f172a]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-[#1e293b] border-b border-slate-700">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-extrabold text-white truncate">
            {journalTarget ? 'Ảnh Đợt Nhập / Xuất' : 'Album & Thư Mục Ảnh'}
          </div>
          <div className="text-xs text-slate-400 truncate">
            {journalTarget
              ? `${journalTarget.itemName} (${journalTarget.direction === 'in' ? '+' : '-'}${journalTarget.quantity} ${journalTarget.unit})`
              : jobName}
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleSyncDrive(unsyncedImages)}
          disabled={syncingDrive || unsyncedImages.length === 0}
          className="px-2.5 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-extrabold flex items-center gap-1 disabled:opacity-45"
        >
          {syncingDrive ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <>
              <CloudUpload className="w-4 h-4" />
              <span>{unsyncedImages.length}</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => setDriveSettingsModal(true)}
          className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300"
        >
          <Settings className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Action Bar */}
      <div className="grid grid-cols-2 gap-2 p-3">
        <button
          type="button"
          onClick={handleAddFromCamera}
          disabled={uploading}
          className="py-2.5 rounded-xl bg-sky-600 text-white text-xs font-extrabold flex items-center justify-center gap-2"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Camera className="w-4 h-4" />
              <span>{journalTarget ? 'Chụp ảnh đợt này' : 'Chụp ảnh'}</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={handleAddFromLibrary}
          disabled={uploading}
          className="py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-extrabold flex items-center justify-center gap-2"
        >
          <ImageIcon className="w-4 h-4" />
          <span>Chọn thư viện</span>
        </button>
      </div>

      {/* Folder Bar */}
      {!journalTarget && (
        <div className="px-3 pb-2 space-y-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedFolderId(null)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap border ${
                !selectedFolderId
                  ? 'bg-sky-600 border-sky-400 text-white'
                  : 'bg-[#1e293b] border-slate-700 text-slate-300'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>Tất cả</span>
            </button>

            {selectedFolderObj && (
              <button
                type="button"
                onClick={() => setSelectedFolderId(selectedFolderObj.parent_id || null)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-600 text-xs font-bold text-slate-200 flex items-center gap-1 whitespace-nowrap"
              >
                <ArrowUp className="w-3.5 h-3.5" />
                <span>{selectedFolderObj.name}</span>
              </button>
            )}

            {childFolders.map(folder => (
              <div key={folder.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => setSelectedFolderId(folder.id)}
                  className="px-2.5 py-1.5 rounded-xl bg-[#1e293b] border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Folder className="w-3.5 h-3.5 text-amber-400" />
                  <span>{folder.name}</span>
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setShowNewFolderInput(!showNewFolderInput)}
              className="px-2.5 py-1.5 rounded-xl border border-dashed border-sky-500/50 text-sky-400 text-xs font-bold flex items-center gap-1 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thư mục</span>
            </button>
          </div>

          {showNewFolderInput && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                placeholder={
                  selectedFolderObj
                    ? `Thư mục con trong "${selectedFolderObj.name}"...`
                    : 'Tên thư mục mới...'
                }
                className="flex-1 px-3 py-1.5 rounded-xl bg-[#1e293b] border border-slate-700 text-xs text-white"
              />
              <button
                type="button"
                onClick={handleCreateFolder}
                className="px-3 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-bold"
              >
                Tạo
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filter Row */}
      <div className="px-3 pb-2 flex items-center gap-1.5">
        {[
          { key: 'all', label: `Tất cả (${filteredImages.length})` },
          { key: 'in', label: 'Nhập' },
          { key: 'out', label: 'Xuất' },
          { key: 'shift', label: 'Chung CV/Đợt' },
        ].map(f => {
          const active = filter === f.key
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key as any)}
              className={`px-3 py-1 rounded-full text-xs font-bold border ${
                active
                  ? 'bg-sky-600 border-sky-400 text-white'
                  : 'bg-[#1e293b] border-slate-700 text-slate-400'
              }`}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-3">
        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-sky-400" />
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-500 gap-2">
            <ImageIcon className="w-10 h-10 stroke-1" />
            <div className="text-xs font-bold">Chưa có hình ảnh chứng minh nào</div>
            <div className="text-[11px]">Bấm Chụp ảnh hoặc Chọn thư viện để thêm</div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {filteredImages.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedImage(item)}
                className="relative aspect-square rounded-xl overflow-hidden bg-[#1e293b] border border-slate-700"
              >
                <img
                  src={getOperationImageDisplayUrl(item)}
                  alt="op"
                  className="w-full h-full object-cover"
                />
                <div className="absolute left-1 bottom-1 flex gap-1">
                  {item.direction === 'in' && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-[9px] font-extrabold text-white">
                      NHẬP
                    </span>
                  )}
                  {item.direction === 'out' && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-600 text-[9px] font-extrabold text-white">
                      XUẤT
                    </span>
                  )}
                  {item.scope !== 'journal' && (
                    <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-[9px] font-extrabold text-white">
                      {item.scope === 'sub_shift' ? 'ĐỢT' : 'CV'}
                    </span>
                  )}
                </div>
                {item.drive_file_id ? (
                  <span className="absolute top-1 right-1 p-1 rounded-full bg-emerald-600/90 text-white">
                    <CloudCheck className="w-3 h-3" />
                  </span>
                ) : item.is_offline ? (
                  <span className="absolute top-1 right-1 p-1 rounded-full bg-slate-900/90 text-amber-400">
                    <CloudUpload className="w-3 h-3" />
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Viewer Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-4">
          <div className="flex justify-end gap-2">
            {!selectedImage.drive_file_id && !selectedImage.is_offline && (
              <button
                type="button"
                onClick={() => handleSyncDrive([selectedImage])}
                disabled={syncingDrive}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1"
              >
                <CloudUpload className="w-4 h-4" />
                <span>Đẩy Drive</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleDelete(selectedImage)}
              className="w-9 h-9 rounded-full bg-rose-500/20 text-rose-300 flex items-center justify-center"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="w-9 h-9 rounded-full bg-white/15 text-white flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center my-2 overflow-hidden">
            <img
              src={getOperationImageDisplayUrl(selectedImage)}
              alt="full"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>

          <div className="space-y-1 text-xs">
            <div className="font-extrabold text-white">
              {selectedImage.item_name
                ? `${selectedImage.item_name} — ${selectedImage.quantity ?? ''} ${selectedImage.unit || ''}`
                : selectedImage.scope === 'sub_shift'
                  ? 'Ảnh Đợt Chốt Tạm'
                  : 'Ảnh Công Việc'}
            </div>
            <div className="text-slate-400">
              {selectedImage.captured_by_name || 'Nhân viên'} •{' '}
              {new Date(selectedImage.captured_at).toLocaleString('vi-VN')}
              {selectedImage.drive_file_id ? ' • Đã lưu Drive' : ''}
            </div>
            {selectedImage.notes && <div className="text-amber-300">{selectedImage.notes}</div>}
          </div>
        </div>
      )}

      {/* Drive Settings Modal */}
      {driveSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0f172a] border border-slate-700 rounded-2xl p-4 space-y-3">
            <div className="text-sm font-extrabold text-white">
              Cài Đặt Google Drive ({shift.system_code})
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                Google Apps Script Webhook URL
              </label>
              <input
                type="text"
                value={driveSettings.webhook_url}
                onChange={e => setDriveSettings(p => ({ ...p, webhook_url: e.target.value }))}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-3 py-2 rounded-xl bg-[#1e293b] border border-slate-700 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                Tên thư mục gốc trên Drive
              </label>
              <input
                type="text"
                value={driveSettings.root_folder_name}
                onChange={e => setDriveSettings(p => ({ ...p, root_folder_name: e.target.value }))}
                placeholder="WMS_HinhAnh_Kho"
                className="w-full px-3 py-2 rounded-xl bg-[#1e293b] border border-slate-700 text-xs text-white"
              />
            </div>

            <button
              type="button"
              onClick={() => setWatermarkEnabledState(v => !v)}
              className={`w-full p-3 rounded-xl border flex items-center justify-between text-left ${
                watermarkEnabled
                  ? 'bg-amber-500/10 border-amber-500/40'
                  : 'bg-[#1e293b] border-slate-700'
              }`}
            >
              <div>
                <div className="text-xs font-extrabold text-white">
                  Đóng dấu thông tin lên ảnh (Timemark)
                </div>
                <div className="text-[11px] text-slate-400">
                  Tự ghi ngày giờ, kho, tên hàng, số lượng &amp; người chụp vào ảnh
                </div>
              </div>
              <CheckCircle2
                className={`w-5 h-5 ${watermarkEnabled ? 'text-amber-400' : 'text-slate-600'}`}
              />
            </button>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDriveSettingsModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={savingDrive}
                onClick={handleSaveDrive}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-extrabold"
              >
                {savingDrive ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 2. WAREHOUSE ALBUM MODAL (THƯ VIỆN ẢNH THEO NGÀY & CÔNG VIỆC + AUTOCOMPLETE) ──
function getDayInfo(capturedAt: string) {
  const dt = new Date(capturedAt)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return {
    monthKey: `${y}-${m}`,
    monthLabel: `Tháng ${m}/${y}`,
    dateKey: `${y}-${m}-${d}`,
    dateLabel: `${d}/${m}/${y}`,
  }
}

export function WarehouseAlbumModal({
  visible,
  systemCode,
  companyId,
  onClose,
}: {
  visible: boolean
  systemCode: string
  companyId?: string | null
  onClose: () => void
}) {
  const [images, setImages] = useState<OperationImageRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [directionFilter, setDirectionFilter] = useState<'all' | 'in' | 'out' | 'shift'>('all')
  const [treeMode, setTreeMode] = useState<'date' | 'job'>('date')
  const [selectedJobKey, setSelectedJobKey] = useState<string | null>(null)
  const [selectedJobGroupKey, setSelectedJobGroupKey] = useState<string | null>(null)
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({})
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({})
  const [expandedJobNames, setExpandedJobNames] = useState<Record<string, boolean>>({})
  const [selectedImage, setSelectedImage] = useState<OperationImageRecord | null>(null)
  const [warehouseProducts, setWarehouseProducts] = useState<any[]>([])

  const loadImages = useCallback(async () => {
    if (!systemCode) return
    setLoading(true)
    try {
      await syncOperationsOfflineQueue().catch(() => {})
      await syncOfflineOperationImages().catch(() => {})
      const [list, products] = await Promise.all([
        listSystemOperationImages({ systemCode, companyId, limit: 300 }),
        getWarehouseProducts(systemCode).catch(() => []),
      ])
      setImages(list)
      setWarehouseProducts(products || [])
    } finally {
      setLoading(false)
    }
  }, [systemCode, companyId])

  useEffect(() => {
    if (!visible) return
    void loadImages()
  }, [visible, loadImages])

  const filteredImages = useMemo(() => {
    const qNorm = normalizeSearchText(searchText)
    const tokens = qNorm ? qNorm.split(' ').filter(Boolean) : []
    return images.filter(img => {
      if (directionFilter === 'in' && img.direction !== 'in') return false
      if (directionFilter === 'out' && img.direction !== 'out') return false
      if (directionFilter === 'shift' && img.scope === 'journal') return false
      if (tokens.length > 0) {
        const { dateLabel } = getDayInfo(img.captured_at)
        const prodMatch = warehouseProducts.find(
          p =>
            (img.item_sku && p.sku && p.sku.toLowerCase() === img.item_sku.toLowerCase()) ||
            (img.item_name && normalizeSearchText(p.name) === normalizeSearchText(img.item_name))
        )
        const hay = normalizeSearchText(
          [
            img.item_sku,
            img.item_name,
            prodMatch?.aliases,
            prodMatch?.internal_code,
            prodMatch?.internal_name,
            img.job_name,
            img.captured_by_name,
            img.notes,
            dateLabel,
          ]
            .filter(Boolean)
            .join(' ')
        )
        if (!tokens.every(t => hay.includes(t))) return false
      }
      return true
    })
  }, [images, searchText, directionFilter, warehouseProducts])

  const searchSuggestions = useMemo(() => {
    const qNorm = normalizeSearchText(searchText)
    if (!qNorm) return []
    const tokens = qNorm.split(' ').filter(Boolean)

    const results: {
      kind: 'product' | 'job'
      key: string
      value: string
      title: string
      sku?: string
      aliases?: string
      score: number
    }[] = []

    for (const p of warehouseProducts) {
      const sku = (p.sku || '').trim()
      const name = (p.name || '').trim()
      if (!name) continue
      const aliasesNorm = normalizeSearchText(p.aliases || '')
      const skuNorm = normalizeSearchText(sku)
      const internalNorm = normalizeSearchText(`${p.internal_code || ''} ${p.internal_name || ''}`)
      const nameNorm = normalizeSearchText(name)
      const fullNorm = `${aliasesNorm} ${skuNorm} ${internalNorm} ${nameNorm}`
      if (!tokens.every(t => fullNorm.includes(t))) continue

      let score = 10
      if (aliasesNorm && tokens.every(t => aliasesNorm.includes(t))) score += 50
      if (skuNorm && tokens.every(t => skuNorm.includes(t))) score += 25
      results.push({
        kind: 'product',
        key: `p-${p.id || sku || name}`,
        value: name,
        title: name,
        sku: sku || undefined,
        aliases: p.aliases ? String(p.aliases).trim() : undefined,
        score,
      })
    }

    const jobNames = Array.from(new Set(images.map(i => i.job_name).filter(Boolean))) as string[]
    for (const jn of jobNames) {
      const jNorm = normalizeSearchText(jn)
      if (tokens.every(t => jNorm.includes(t))) {
        results.push({
          kind: 'job',
          key: `j-${jn}`,
          value: jn,
          title: jn,
          score: 15,
        })
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 8)
  }, [searchText, warehouseProducts, images])

  const folderTree = useMemo(() => {
    const months = new Map<
      string,
      {
        monthKey: string
        monthLabel: string
        count: number
        dates: Map<
          string,
          {
            dateKey: string
            dateLabel: string
            count: number
            jobs: Map<
              string,
              { jobKey: string; jobName: string; dateLabel: string; items: OperationImageRecord[] }
            >
          }
        >
      }
    >()

    for (const img of filteredImages) {
      const { monthKey, monthLabel, dateKey, dateLabel } = getDayInfo(img.captured_at)
      const jobName = img.job_name || 'Công việc không tên'
      const jobKey = `${dateKey}::${img.shift_id}`

      let mNode = months.get(monthKey)
      if (!mNode) {
        mNode = { monthKey, monthLabel, count: 0, dates: new Map() }
        months.set(monthKey, mNode)
      }
      mNode.count++

      let dNode = mNode.dates.get(dateKey)
      if (!dNode) {
        dNode = { dateKey, dateLabel, count: 0, jobs: new Map() }
        mNode.dates.set(dateKey, dNode)
      }
      dNode.count++

      let jNode = dNode.jobs.get(jobKey)
      if (!jNode) {
        jNode = { jobKey, jobName, dateLabel, items: [] }
        dNode.jobs.set(jobKey, jNode)
      }
      jNode.items.push(img)
    }

    return Array.from(months.values())
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
      .map(m => ({
        ...m,
        dates: Array.from(m.dates.values())
          .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
          .map(d => ({
            ...d,
            jobs: Array.from(d.jobs.values()),
          })),
      }))
  }, [filteredImages])

  const jobTree = useMemo(() => {
    const jobs = new Map<
      string,
      {
        jobName: string
        count: number
        items: OperationImageRecord[]
        dates: Map<string, { dateKey: string; dateLabel: string; items: OperationImageRecord[] }>
      }
    >()
    for (const img of filteredImages) {
      const { dateKey, dateLabel } = getDayInfo(img.captured_at)
      const jobName = img.job_name || 'Công việc không tên'
      let jNode = jobs.get(jobName)
      if (!jNode) {
        jNode = { jobName, count: 0, items: [], dates: new Map() }
        jobs.set(jobName, jNode)
      }
      jNode.count++
      jNode.items.push(img)
      let dNode = jNode.dates.get(dateKey)
      if (!dNode) {
        dNode = { dateKey, dateLabel, items: [] }
        jNode.dates.set(dateKey, dNode)
      }
      dNode.items.push(img)
    }
    return Array.from(jobs.values()).map(j => ({
      ...j,
      dates: Array.from(j.dates.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey)),
    }))
  }, [filteredImages])

  if (!visible) return null

  const selectedJobData = (() => {
    if (treeMode === 'job' && selectedJobGroupKey) {
      const [jName, dKey] = selectedJobGroupKey.split('::')
      const jNode = jobTree.find(j => j.jobName === jName)
      if (dKey) {
        const dNode = jNode?.dates.find(d => d.dateKey === dKey)
        if (dNode) return { dateLabel: dNode.dateLabel, jobName: jName, items: dNode.items }
      }
      if (jNode) return { dateLabel: 'Tất cả ngày', jobName: jNode.jobName, items: jNode.items }
    }
    if (selectedJobKey) {
      for (const m of folderTree) {
        for (const d of m.dates) {
          for (const j of d.jobs) {
            if (j.jobKey === selectedJobKey) return j
          }
        }
      }
    }
    return null
  })()

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0f172a]">
      <div className="flex items-center justify-between px-4 py-3 bg-[#1e293b] border-b border-slate-700">
        <div>
          <div className="text-sm font-extrabold text-white">Thư Viện &amp; Thống Kê Ảnh</div>
          <div className="text-[11px] text-slate-400">Tổng: {filteredImages.length} ảnh</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadImages}
            className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-sky-400"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search + Autocomplete */}
      <div className="p-3 pb-2 relative">
        <div className="flex items-center gap-2 px-3 h-10 rounded-xl bg-[#1e293b] border border-slate-700">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchText}
            onChange={e => {
              setSearchText(e.target.value)
              setSearchFocused(true)
            }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
            placeholder="Tìm tên gõ tắt (alias), mã/tên SP, công việc, ngày..."
            className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
          />
          {searchText && (
            <button type="button" onClick={() => setSearchText('')} className="text-slate-400">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {searchFocused && searchText.trim() && searchSuggestions.length > 0 && (
          <div className="mt-1 rounded-xl bg-[#1e293b] border border-sky-500/60 overflow-hidden shadow-xl max-h-52 overflow-y-auto z-30">
            <div className="px-3 py-1.5 bg-[#0f172a] text-[10px] font-bold text-slate-400 border-b border-slate-700">
              Gợi ý sản phẩm / công việc ({searchSuggestions.length})
            </div>
            {searchSuggestions.map(s => (
              <button
                key={s.key}
                type="button"
                onMouseDown={() => {
                  setSearchText(s.value)
                  setSearchFocused(false)
                }}
                onClick={() => {
                  setSearchText(s.value)
                  setSearchFocused(false)
                }}
                className="w-full px-3 py-2 text-left border-b border-slate-700/60 last:border-0 hover:bg-slate-800 flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                        s.kind === 'product'
                          ? 'bg-sky-500/20 text-sky-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {s.kind === 'product' ? 'SP' : 'CV'}
                    </span>
                    {s.aliases && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-extrabold">
                        {s.aliases}
                      </span>
                    )}
                    <span className="text-xs font-bold text-white truncate">{s.title}</span>
                  </div>
                  {s.sku && <div className="text-[10px] text-slate-400 mt-0.5">SKU: {s.sku}</div>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filters & Tree Mode */}
      <div className="px-3 pb-2 flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {[
            { key: 'all', label: 'Tất cả' },
            { key: 'in', label: 'Nhập' },
            { key: 'out', label: 'Xuất' },
            { key: 'shift', label: 'CV/Đợt' },
          ].map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setDirectionFilter(f.key as any)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                directionFilter === f.key
                  ? 'bg-sky-600 border-sky-400 text-white'
                  : 'bg-[#1e293b] border-slate-700 text-slate-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-[#1e293b] p-0.5 rounded-lg border border-slate-700">
          <button
            type="button"
            onClick={() => {
              setTreeMode('date')
              setSelectedJobGroupKey(null)
            }}
            className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 ${
              treeMode === 'date' ? 'bg-sky-600 text-white' : 'text-slate-400'
            }`}
          >
            <Calendar className="w-3 h-3" />
            <span>Ngày</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTreeMode('job')
              setSelectedJobKey(null)
            }}
            className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 ${
              treeMode === 'job' ? 'bg-emerald-600 text-white' : 'text-slate-400'
            }`}
          >
            <Briefcase className="w-3 h-3" />
            <span>Công việc</span>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-2.5">
        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-sky-400" />
          </div>
        ) : selectedJobData ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                setSelectedJobKey(null)
                setSelectedJobGroupKey(null)
              }}
              className="w-full p-2.5 rounded-xl bg-[#1e293b] border border-slate-700 flex items-center gap-2 text-xs font-bold text-white"
            >
              <ArrowLeft className="w-4 h-4 text-sky-400" />
              <span className="truncate">
                {selectedJobData.dateLabel} › {selectedJobData.jobName} (
                {selectedJobData.items.length})
              </span>
            </button>
            <div className="grid grid-cols-3 gap-2">
              {selectedJobData.items.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedImage(item)}
                  className="relative aspect-square rounded-xl overflow-hidden bg-[#1e293b] border border-slate-700"
                >
                  <img
                    src={getOperationImageDisplayUrl(item)}
                    alt="img"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        ) : treeMode === 'job' ? (
          jobTree.map((jNode, idx) => {
            const isOpen = expandedJobNames[jNode.jobName] ?? idx === 0
            return (
              <div
                key={jNode.jobName}
                className="bg-[#1e293b] border border-slate-700 rounded-xl overflow-hidden"
              >
                <div className="p-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedJobNames(p => ({ ...p, [jNode.jobName]: !isOpen }))
                    }
                    className="flex-1 flex items-center gap-2 text-left min-w-0"
                  >
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <FolderOpen className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-xs font-extrabold text-white truncate">
                      {jNode.jobName}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedJobGroupKey(jNode.jobName)}
                    className="px-2 py-1 rounded-lg bg-[#0f172a] text-sky-400 text-[11px] font-bold shrink-0"
                  >
                    {jNode.count} ảnh ›
                  </button>
                </div>
                {isOpen && (
                  <div className="border-t border-slate-700 p-2 space-y-1.5">
                    {jNode.dates.map(dt => (
                      <button
                        key={dt.dateKey}
                        type="button"
                        onClick={() => setSelectedJobGroupKey(`${jNode.jobName}::${dt.dateKey}`)}
                        className="w-full p-2 rounded-lg bg-[#0f172a] flex items-center justify-between text-xs"
                      >
                        <span className="font-bold text-slate-200">{dt.dateLabel}</span>
                        <span className="text-emerald-400 font-bold">{dt.items.length} ảnh ›</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        ) : (
          folderTree.map((month, mIdx) => {
            const isMonthOpen = expandedMonths[month.monthKey] ?? mIdx === 0
            return (
              <div
                key={month.monthKey}
                className="bg-[#1e293b] border border-slate-700 rounded-xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedMonths(p => ({ ...p, [month.monthKey]: !isMonthOpen }))
                  }
                  className="w-full p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    {isMonthOpen ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <Folder className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-extrabold text-white">{month.monthLabel}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-[#0f172a] text-sky-400 text-[11px] font-bold">
                    {month.count} ảnh
                  </span>
                </button>
                {isMonthOpen && (
                  <div className="border-t border-slate-700 p-2 space-y-2">
                    {month.dates.map((dt, dIdx) => {
                      const isDateOpen = expandedDates[dt.dateKey] ?? (mIdx === 0 && dIdx === 0)
                      return (
                        <div key={dt.dateKey} className="bg-[#0f172a] rounded-xl p-2 space-y-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedDates(p => ({ ...p, [dt.dateKey]: !isDateOpen }))
                            }
                            className="w-full flex items-center justify-between text-xs font-bold text-slate-200"
                          >
                            <span>📅 {dt.dateLabel}</span>
                            <span className="text-slate-400">{dt.count} ảnh</span>
                          </button>
                          {isDateOpen && (
                            <div className="pl-3 space-y-1">
                              {dt.jobs.map(j => (
                                <button
                                  key={j.jobKey}
                                  type="button"
                                  onClick={() => setSelectedJobKey(j.jobKey)}
                                  className="w-full p-2 rounded-lg bg-[#1e293b] flex items-center justify-between text-xs"
                                >
                                  <span className="font-semibold text-white truncate pr-2">
                                    {j.jobName}
                                  </span>
                                  <span className="text-emerald-400 font-bold shrink-0">
                                    {j.items.length} ảnh ›
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {selectedImage && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="w-9 h-9 rounded-full bg-white/15 text-white flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center my-2 overflow-hidden">
            <img
              src={getOperationImageDisplayUrl(selectedImage)}
              alt="full"
              className="max-w-full max-h-full object-contain"
            />
          </div>
          <div className="text-xs text-white font-bold">
            {selectedImage.item_name || selectedImage.job_name || 'Ảnh công việc'}
          </div>
        </div>
      )}
    </div>
  )
}
