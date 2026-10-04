const fs = require('fs');

const scannerPath = 'D:/chanh thu/pallet-box-scanner/src/screens/ScannerScreen.tsx';

const scannerContent = `import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Modal, TextInput, ActivityIndicator, Vibration
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Pallet, BoxLabel, ParsedLabelData } from '../types';
import {
  getActivePallet, createNewPallet, completePallet,
  getBoxesByPallet, addBoxToPallet, deleteBox,
  getPalletByCode, resetPalletBoxes, activateExistingPallet
} from '../services/database';
import { parseBoxLabelText } from '../services/labelParser';

export default function ScannerScreen({ onNavigateToPallets }: { onNavigateToPallets: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  const [activePallet, setActivePallet] = useState<Pallet | null>(null);
  const [boxes, setBoxes] = useState<BoxLabel[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [torch, setTorch] = useState(false);

  // Pallet Creation Modal
  const [isNewPalletModal, setIsNewPalletModal] = useState(false);
  const [newPalletCode, setNewPalletCode] = useState('');
  const [newTargetQty, setNewTargetQty] = useState('30');

  // Manual / Quick Input Modal (For manual adjustment or smudged labels)
  const [isManualModal, setIsManualModal] = useState(false);
  const [manualIndex, setManualIndex] = useState('');
  const [manualLot, setManualLot] = useState('D009TN08096');
  const [manualSku, setManualSku] = useState('TP101020104.002');
  const [manualWeight, setManualWeight] = useState('20');
  const [manualShift, setManualShift] = useState('Nguyên');
  const [manualDate, setManualDate] = useState('07/09/2026');

  // Last Scanned Notification Card
  const [lastScannedBox, setLastScannedBox] = useState<BoxLabel | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  useEffect(() => {
    loadActivePallet();
  }, []);

  async function loadActivePallet() {
    try {
      const pallet = await getActivePallet();
      if (pallet) {
        setActivePallet(pallet);
        const boxList = await getBoxesByPallet(pallet.id);
        setBoxes(boxList);
      } else {
        setNewPalletCode('');
        setIsNewPalletModal(true);
      }
    } catch (e: any) {
      console.error('Error loading pallet:', e);
    }
  }

  async function handleCreatePallet() {
    if (!newPalletCode.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập số thứ tự (STT) Pallet (Ví dụ: F5556)');
      return;
    }

    const cleanCode = newPalletCode.trim().toUpperCase();
    const existing = await getPalletByCode(cleanCode);

    if (existing) {
      Alert.alert(
        \`⚠️ STT \${cleanCode} ĐÃ CÓ TRONG HỆ THỐNG!\`,
        \`STT \${cleanCode} hiện đang có \${existing.scanned_qty} thùng (\${existing.total_weight} Kg).\\n\\nPallet này có bị xáo trộn hàng và bạn cần quét lại không?\`,
        [
          {
            text: '🔄 Quét lại từ đầu (Xóa cũ)',
            style: 'destructive',
            onPress: async () => {
              await resetPalletBoxes(existing.id);
              const activated = await activateExistingPallet(existing.id);
              setActivePallet(activated);
              setBoxes([]);
              setIsNewPalletModal(false);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          },
          {
            text: 'Tiếp tục quét thêm',
            onPress: async () => {
              const activated = await activateExistingPallet(existing.id);
              setActivePallet(activated);
              const existingBoxes = await getBoxesByPallet(existing.id);
              setBoxes(existingBoxes);
              setIsNewPalletModal(false);
            }
          },
          { text: 'Hủy', style: 'cancel' }
        ]
      );
      return;
    }

    try {
      const target = parseInt(newTargetQty) || 30;
      const pallet = await createNewPallet(cleanCode, target);
      setActivePallet(pallet);
      setBoxes([]);
      setIsNewPalletModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert('Lỗi', err.message);
    }
  }

  function handleResetCurrentPallet() {
    if (!activePallet) return;
    Alert.alert(
      \`🔄 QUÉT LẠI PALLET \${activePallet.code}?\`,
      \`Bạn có muốn xóa toàn bộ \${boxes.length} thùng hiện tại để quét lại từ đầu không?\\n\\n(Dành cho trường hợp hàng hóa trên pallet bị xáo trộn)\`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa để quét lại',
          style: 'destructive',
          onPress: async () => {
            await resetPalletBoxes(activePallet.id);
            setBoxes([]);
            setActivePallet(prev => prev ? { ...prev, scanned_qty: 0, total_weight: 0 } : null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }
      ]
    );
  }

  // Handle Box Parsing & Adding to Database
  async function processBoxData(parsedData: ParsedLabelData) {
    if (!activePallet) {
      Alert.alert('Chưa có Pallet', 'Vui lòng tạo hoặc chọn Pallet trước khi quét');
      return;
    }

    try {
      setDuplicateWarning(null);
      const { box } = await addBoxToPallet(activePallet.id, parsedData);

      // Success Sound & Haptic
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLastScannedBox(box);

      // Refresh list
      const updatedBoxes = await getBoxesByPallet(activePallet.id);
      setBoxes(updatedBoxes);
      setActivePallet(prev => prev ? {
        ...prev,
        scanned_qty: updatedBoxes.length,
        total_weight: updatedBoxes.reduce((s, b) => s + b.weight, 0)
      } : null);

      // Check if target reached!
      if (updatedBoxes.length >= activePallet.target_qty) {
        Alert.alert(
          '🎉 ĐÃ ĐỦ PALLET!',
          \`Pallet \${activePallet.code} đã đạt chỉ tiêu \${updatedBoxes.length}/\${activePallet.target_qty} thùng.\\nBạn có muốn chốt Pallet này không?\`,
          [
            { text: 'Tiếp tục quét thêm', style: 'cancel' },
            { text: 'Chốt Pallet', onPress: handleCompletePallet }
          ]
        );
      }
    } catch (err: any) {
      // DUPLICATE DETECTED OR ERROR
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Vibration.vibrate([0, 200, 100, 200]);
      setDuplicateWarning(err.message);
    }
  }

  // REAL CAMERA SCAN: 100% OFFLINE ON-DEVICE ML KIT + FALLBACK
  async function handleRealCameraScan() {
    if (!cameraRef.current) return;
    if (!activePallet) {
      Alert.alert('Chưa có Pallet', 'Vui lòng nhập STT Pallet trước khi quét');
      return;
    }

    setIsScanning(true);
    setDuplicateWarning(null);
    try {
      // 1. Chụp ảnh từ camera
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        base64: true,
        skipProcessing: false,
      });

      if (!photo?.uri) {
        throw new Error('Không thể chụp ảnh từ Camera');
      }

      let parsed: ParsedLabelData | null = null;

      // 2. ƯU TIÊN 1: NHẬN DIỆN CHỮ 100% OFFLINE BẰNG GOOGLE ML KIT TRÊN MÁY
      try {
        if (TextRecognition && typeof TextRecognition.recognize === 'function') {
          const mlResult = await TextRecognition.recognize(photo.uri);
          if (mlResult?.text && mlResult.text.trim()) {
            console.log('[ML Kit Offline OCR Success]:', mlResult.text);
            parsed = parseBoxLabelText(mlResult.text);
          }
        }
      } catch (mlErr) {
        console.warn('[ML Kit Native Not Available or Failed]:', mlErr);
      }

      // 3. ƯU TIÊN 2: NẾU ĐANG CHẠY TRÊN EXPO GO CHƯA CÓ NATIVE ML KIT -> GỬI SERVER
      if (!parsed || !parsed.box_index) {
        try {
          const response = await fetch('https://www.chanhthu.click/api/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: photo.base64 })
          });
          const resJson = await response.json();
          if (resJson?.success && resJson?.data) {
            parsed = resJson.data;
          }
        } catch (serverErr) {
          console.warn('[Server OCR Fallback Failed]:', serverErr);
        }
      }

      // 4. KIỂM TRA KẾT QUẢ
      if (!parsed || !parsed.box_index) {
        throw new Error('Chưa nhận diện rõ STT thùng. Hãy giữ yên tay và căn vuông góc con tem.');
      }

      // Cập nhật giá trị gợi ý cho form nhập tay nếu cần
      if (parsed.lot_code) setManualLot(parsed.lot_code);
      if (parsed.sku) setManualSku(parsed.sku);
      if (parsed.shift_group) setManualShift(parsed.shift_group);
      if (parsed.production_date) setManualDate(parsed.production_date);

      // Lưu thùng vào Pallet
      await processBoxData(parsed);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        'Nhắc nhở quét tem',
        err.message + '\\n\\n👉 Bạn có thể bấm "Sửa / Nhập tay" để điền nhanh số STT thùng.',
        [
          { text: 'Đóng', style: 'cancel' },
          { text: 'Nhập tay ngay', onPress: () => setIsManualModal(true) }
        ]
      );
    } finally {
      setIsScanning(false);
    }
  }

  async function handleCompletePallet() {
    if (!activePallet) return;
    try {
      await completePallet(activePallet.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Thành công', \`Pallet \${activePallet.code} đã được chốt hoàn tất!\\nSẵn sàng đồng bộ lên Anywarehouse.\`);
      setActivePallet(null);
      setBoxes([]);
      loadActivePallet();
    } catch (err: any) {
      Alert.alert('Lỗi', err.message);
    }
  }

  async function handleDeleteBox(boxId: string) {
    if (!activePallet) return;
    Alert.alert(
      'Xóa thùng',
      'Bạn có chắc muốn xóa thùng này khỏi Pallet?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            await deleteBox(boxId, activePallet.id);
            const updated = await getBoxesByPallet(activePallet.id);
            setBoxes(updated);
            setActivePallet(prev => prev ? {
              ...prev,
              scanned_qty: updated.length,
              total_weight: updated.reduce((s, b) => s + b.weight, 0)
            } : null);
          }
        }
      ]
    );
  }

  // Quick Manual Add Fallback
  function handleManualAdd() {
    if (!manualIndex.trim()) {
      Alert.alert('Thiếu STT/INDEX', 'Vui lòng nhập STT thùng (Ví dụ: 398)');
      return;
    }
    const data: ParsedLabelData = {
      sku: manualSku.trim().toUpperCase() || 'TP101020104.002',
      lot_code: manualLot.trim().toUpperCase() || 'D009TN08096',
      product_name: 'TP cấp đông sầu riêng múi monthong C - Hàng có hạt',
      box_index: manualIndex.trim(),
      weight: parseFloat(manualWeight) || 20,
      unit: 'Kg',
      shift_group: manualShift.trim() || 'Nguyên',
      region: 'Tây Nguyên',
      production_date: manualDate.trim() || '07/09/2026',
      packaging_date: manualDate.trim() || '08/09/2026',
      spec: 'Thùng/túi: 20kg',
      raw_text: 'Manual Input'
    };
    processBoxData(data);
    setManualIndex('');
    setIsManualModal(false);
  }

  const scannedCount = boxes.length;
  const targetCount = activePallet?.target_qty || 30;
  const progressPercent = Math.min(100, Math.round((scannedCount / targetCount) * 100));

  return (
    <View style={styles.container}>
      {/* ── TOP HEADER ────────────────────────────── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.headerSubtitle}>STT PALLET</Text>
            {boxes.length > 0 && (
              <TouchableOpacity onPress={handleResetCurrentPallet} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="refresh-circle" size={16} color="#f87171" />
                <Text style={{ color: '#f87171', fontSize: 10, fontWeight: '800' }}>Quét lại</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={styles.palletCodeBtn}
            onPress={() => setIsNewPalletModal(true)}
          >
            <Text style={styles.palletCodeText}>
              {activePallet ? activePallet.code : 'Chưa nhập STT'}
            </Text>
            <Ionicons name="create-outline" size={16} color="#fbbf24" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>

        <View style={styles.weightBadge}>
          <Text style={styles.weightLabel}>TỔNG KG</Text>
          <Text style={styles.weightValue}>
            {activePallet?.total_weight || 0} <Text style={{ fontSize: 12 }}>Kg</Text>
          </Text>
        </View>
      </View>

      {/* ── PROGRESS BAR ──────────────────────────── */}
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>
            Tiến độ Pallet: <Text style={{ color: '#22c55e', fontWeight: '900' }}>{scannedCount}</Text> / {targetCount} thùng
          </Text>
          <Text style={styles.progressPercent}>{progressPercent}%</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: \`\${progressPercent}%\` }]} />
        </View>
      </View>

      {/* ── CAMERA VIEWPORT ───────────────────────── */}
      <View style={styles.cameraContainer}>
        {!permission?.granted ? (
          <View style={styles.permissionBox}>
            <Ionicons name="camera-outline" size={48} color="#94a3b8" />
            <Text style={styles.permissionText}>Ứng dụng cần quyền Camera để quét tem thùng</Text>
            <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
              <Text style={styles.permissionBtnText}>Cấp quyền Camera</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={StyleSheet.absoluteFill}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              enableTorch={torch}
            />
            {/* Viewfinder Target Box */}
            <View style={styles.overlay} pointerEvents="box-none">
              <View style={styles.targetFrame}>
                <View style={[styles.corner, styles.tl]} />
                <View style={[styles.corner, styles.tr]} />
                <View style={[styles.corner, styles.bl]} />
                <View style={[styles.corner, styles.br]} />
                <Text style={styles.guideText}>CĂN KHUNG VÀO CON TEM THÙNG</Text>
              </View>

              {/* Torch Button */}
              <TouchableOpacity
                style={styles.torchBtn}
                onPress={() => setTorch(!torch)}
              >
                <Ionicons
                  name={torch ? "flashlight" : "flashlight-outline"}
                  size={24}
                  color={torch ? "#fbbf24" : "#ffffff"}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* ── DUPLICATE / ERROR ALERT BANNER ─────────── */}
      {duplicateWarning && (
        <View style={styles.duplicateAlert}>
          <Ionicons name="warning" size={24} color="#ef4444" />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.duplicateTitle}>CẢNH BÁO TRÙNG THÙNG!</Text>
            <Text style={styles.duplicateDesc}>{duplicateWarning}</Text>
          </View>
          <TouchableOpacity onPress={() => setDuplicateWarning(null)}>
            <Ionicons name="close-circle" size={22} color="#991b1b" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── LAST SCANNED NOTIFICATION CARD ────────── */}
      {lastScannedBox && !duplicateWarning && (
        <View style={styles.lastScannedCard}>
          <View style={styles.successIconBadge}>
            <Ionicons name="checkmark-circle" size={24} color="#16a34a" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.lastScannedIndex}>Thùng #{lastScannedBox.box_index}</Text>
              <Text style={styles.lastScannedWeight}>{lastScannedBox.weight} Kg</Text>
            </View>
            <Text style={styles.lastScannedMeta}>
              Lô: {lastScannedBox.lot_code} · NSX: {lastScannedBox.production_date} · Tổ {lastScannedBox.shift_group}
            </Text>
          </View>
        </View>
      )}

      {/* ── ACTION CONTROLS ───────────────────────── */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.simulateScanBtn, isScanning && { backgroundColor: '#047857' }]}
          disabled={isScanning}
          onPress={handleRealCameraScan}
        >
          {isScanning ? (
            <>
              <ActivityIndicator color="#ffffff" size="small" />
              <Text style={styles.simulateScanText}>Đang đọc tem...</Text>
            </>
          ) : (
            <>
              <Ionicons name="camera" size={20} color="#ffffff" />
              <Text style={styles.simulateScanText}>Chụp Quét Tem</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.manualBtn}
          onPress={() => setIsManualModal(true)}
        >
          <Ionicons name="keypad-outline" size={20} color="#38bdf8" />
          <Text style={styles.manualBtnText}>Sửa / Nhập tay</Text>
        </TouchableOpacity>

        {scannedCount > 0 && (
          <TouchableOpacity
            style={styles.completeBtn}
            onPress={handleCompletePallet}
          >
            <Ionicons name="cube-outline" size={20} color="#ffffff" />
            <Text style={styles.completeBtnText}>Chốt Pallet</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── RECENT SCANNED BOXES LIST ─────────────── */}
      <View style={styles.listHeaderRow}>
        <Text style={styles.listHeaderTitle}>Danh sách thùng đã quét ({boxes.length})</Text>
        <TouchableOpacity onPress={onNavigateToPallets}>
          <Text style={styles.seeAllText}>Xem tất cả Pallet →</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.boxList}>
        {boxes.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="barcode-outline" size={32} color="#64748b" />
            <Text style={styles.emptyText}>Chưa có thùng nào trong Pallet này</Text>
            <Text style={styles.emptySubText}>Hướng camera vào tem thùng rồi bấm [Chụp Quét Tem]</Text>
          </View>
        ) : (
          boxes.map((b) => (
            <View key={b.id} style={styles.boxItem}>
              <View style={styles.boxIndexBadge}>
                <Text style={styles.boxIndexNum}>#{b.box_index}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.boxItemTitle} numberOfLines={1}>
                  {b.product_name}
                </Text>
                <Text style={styles.boxItemMeta}>
                  Lô: {b.lot_code} | {b.weight} {b.unit} | NSX: {b.production_date} | Tổ: {b.shift_group}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.deleteBoxBtn}
                onPress={() => handleDeleteBox(b.id)}
              >
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* ── MODAL: TẠO / NHẬP STT PALLET ─────────── */}
      <Modal visible={isNewPalletModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>📦 NHẬP STT PALLET</Text>
            
            <Text style={styles.inputLabel}>Số thứ tự (STT) Pallet:</Text>
            <TextInput
              style={[styles.textInput, { fontSize: 18, fontWeight: '900', color: '#38bdf8' }]}
              value={newPalletCode}
              onChangeText={setNewPalletCode}
              placeholder="Ví dụ: F5556 hoặc F3500"
              placeholderTextColor="#94a3b8"
              autoCapitalize="characters"
              autoFocus
            />

            <Text style={styles.inputLabel}>Chỉ tiêu số thùng trên Pallet:</Text>
            <TextInput
              style={styles.textInput}
              value={newTargetQty}
              onChangeText={setNewTargetQty}
              keyboardType="number-pad"
              placeholder="Mặc định: 30"
              placeholderTextColor="#94a3b8"
            />

            <View style={styles.modalBtnRow}>
              {activePallet && (
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setIsNewPalletModal(false)}
                >
                  <Text style={styles.modalCancelText}>Hủy</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleCreatePallet}
              >
                <Text style={styles.modalSubmitText}>Bắt đầu quét STT này</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: NHẬP TAY / SỬA NHANH ───────────── */}
      <Modal visible={isManualModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>✏️ NHẬP / SỬA NHANH THÙNG</Text>
            
            <Text style={styles.inputLabel}>STT / INDEX thùng (*):</Text>
            <TextInput
              style={[styles.textInput, { fontSize: 22, fontWeight: '900', color: '#38bdf8' }]}
              value={manualIndex}
              onChangeText={setManualIndex}
              placeholder="VD: 398"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              autoFocus
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Số Lô (Lot):</Text>
                <TextInput
                  style={styles.textInput}
                  value={manualLot}
                  onChangeText={setManualLot}
                  autoCapitalize="characters"
                />
              </View>
              <View style={{ width: 100 }}>
                <Text style={styles.inputLabel}>Kg:</Text>
                <TextInput
                  style={styles.textInput}
                  value={manualWeight}
                  onChangeText={setManualWeight}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Tổ/Nhóm:</Text>
                <TextInput
                  style={styles.textInput}
                  value={manualShift}
                  onChangeText={setManualShift}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Ngày SX:</Text>
                <TextInput
                  style={styles.textInput}
                  value={manualDate}
                  onChangeText={setManualDate}
                />
              </View>
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsManualModal(false)}
              >
                <Text style={styles.modalCancelText}>Đóng</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleManualAdd}
              >
                <Text style={styles.modalSubmitText}>+ Thêm vào Pallet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  palletCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  palletCodeText: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  weightBadge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'flex-end',
    borderWidth: 1,
    borderColor: '#334155',
  },
  weightLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
  },
  weightValue: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: '900',
  },
  progressContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressTitle: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
  },
  progressPercent: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '900',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#1e293b',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: 4,
  },
  cameraContainer: {
    height: 220,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#020617',
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  targetFrame: {
    width: '82%',
    height: '75%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#22c55e',
  },
  tl: { top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3 },
  tr: { top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3 },
  bl: { bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3 },
  br: { bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3 },
  guideText: {
    color: '#f8fafc',
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    letterSpacing: 1,
  },
  torchBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
    borderRadius: 20,
  },
  permissionBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  permissionText: {
    color: '#cbd5e1',
    textAlign: 'center',
    marginTop: 8,
    fontSize: 13,
  },
  permissionBtn: {
    marginTop: 12,
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  permissionBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  duplicateAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderColor: '#f87171',
    borderWidth: 1.5,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
  },
  duplicateTitle: {
    color: '#991b1b',
    fontSize: 12,
    fontWeight: '900',
  },
  duplicateDesc: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '600',
  },
  lastScannedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#064e3b',
    borderColor: '#059669',
    borderWidth: 1.5,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
  },
  successIconBadge: {
    marginRight: 10,
  },
  lastScannedIndex: {
    color: '#34d399',
    fontSize: 15,
    fontWeight: '900',
    marginRight: 8,
  },
  lastScannedWeight: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  lastScannedMeta: {
    color: '#a7f3d0',
    fontSize: 11,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
  },
  simulateScanBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  simulateScanText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  manualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
    borderColor: '#38bdf8',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 4,
  },
  manualBtnText: {
    color: '#38bdf8',
    fontWeight: '700',
    fontSize: 12,
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 4,
  },
  completeBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  listHeaderTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  seeAllText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  boxList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
  },
  emptySubText: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  boxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 10,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  boxIndexBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#475569',
  },
  boxIndexNum: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '900',
  },
  boxItemTitle: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
  },
  boxItemMeta: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  deleteBoxBtn: {
    padding: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#475569',
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 16,
  },
  inputLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 14,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalCancelText: {
    color: '#94a3b8',
    fontWeight: '700',
  },
  modalSubmitBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalSubmitText: {
    color: '#fff',
    fontWeight: '900',
  },
});
`;

fs.writeFileSync(scannerPath, scannerContent.trim());
console.log('✅ ScannerScreen.tsx updated with ML Kit & robust fallback');
