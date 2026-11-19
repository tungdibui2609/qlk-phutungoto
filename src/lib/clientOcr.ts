import { parseStampLines, parseBoxLabelText } from './ocrParser';
import { createWorker } from 'tesseract.js';

let clientWorkerInstance: any = null;
let clientWorkerPromise: Promise<any> | null = null;

export async function getClientOcrWorker() {
  if (clientWorkerInstance) return clientWorkerInstance;
  if (clientWorkerPromise) return clientWorkerPromise;

  clientWorkerPromise = (async () => {
    try {
      // Tesseract client worker using static files cached locally in /public/tessdata
      const worker = await createWorker('eng', 1, {
        workerPath: '/tessdata/worker.min.js',
        corePath: '/tessdata',
        langPath: '/tessdata',
        gzip: false,
        cacheMethod: 'write'
      });
      clientWorkerInstance = worker;
      return worker;
    } catch (err) {
      console.warn('[Client OCR] Khởi tạo Tesseract Client Worker thất bại:', err);
      clientWorkerInstance = null;
      throw err;
    } finally {
      clientWorkerPromise = null;
    }
  })();

  return clientWorkerPromise;
}

/**
 * Preload Tesseract Offline Worker ngay khi trang tải xong (khi đang có mạng),
 * đảm bảo toàn bộ tesseract.js, worker.min.js, wasm và eng.traineddata đều đã được
 * nạp sẵn vào cache trình duyệt trước khi người dùng tắt mạng.
 */
export async function preloadClientOcr() {
  if (typeof window === 'undefined') return;
  try {
    await getClientOcrWorker();
    console.log('[Client OCR] Preload Tesseract offline worker thành công!');
  } catch (err) {
    console.warn('[Client OCR] Preload worker thất bại (sẽ tự động tải lại khi quét):', err);
  }
}

export async function recognizeClientSide(
  imageBase64: string,
  mode: 'stamp' | 'label',
  dictMap?: Record<string, Record<string, string>>
) {
  const worker = await getClientOcrWorker();
  if (mode === 'stamp') {
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789-',
      tessedit_pageseg_mode: '6', // SINGLE_BLOCK
    });
  } else {
    await worker.setParameters({
      tessedit_char_whitelist: '',
      tessedit_pageseg_mode: '3', // AUTO
    });
  }
  const res = await worker.recognize(imageBase64);
  const rawText = res?.data?.text || '';

  if (mode === 'stamp') {
    const stampData = parseStampLines(rawText, dictMap);
    return {
      success: true,
      mode: 'stamp',
      data: stampData,
      rawText
    };
  }

  const parsed = parseBoxLabelText(rawText);
  return {
    success: true,
    mode: 'label',
    data: parsed,
    rawText
  };
}
