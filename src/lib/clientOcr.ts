import { parseStampLines, parseBoxLabelText } from './ocrParser';

let clientWorkerInstance: any = null;
let clientWorkerPromise: Promise<any> | null = null;

export async function getClientOcrWorker() {
  if (clientWorkerInstance) return clientWorkerInstance;
  if (clientWorkerPromise) return clientWorkerPromise;

  clientWorkerPromise = (async () => {
    try {
      const { createWorker } = await import('tesseract.js');
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

export async function recognizeClientSide(
  imageBase64: string,
  mode: 'stamp' | 'label',
  dictMap?: Record<string, Record<string, string>>
) {
  const worker = await getClientOcrWorker();
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
