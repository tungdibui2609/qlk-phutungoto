import { NextRequest, NextResponse } from 'next/server';
import Tesseract from 'tesseract.js';
import path from 'path';
import fs from 'fs';
import { parseStampLines, parseBoxLabelText } from '@/lib/ocrParser';

let cachedWorker: any = null;
let workerInitializing: Promise<any> | null = null;

async function getWorker() {
  if (cachedWorker) return cachedWorker;
  if (workerInitializing) return workerInitializing;

  workerInitializing = (async () => {
    try {
      const workerPath = path.join(
        process.cwd(),
        'node_modules',
        'tesseract.js',
        'src',
        'worker-script',
        'node',
        'index.js'
      );
      
      // Đường dẫn thư mục tessdata cục bộ (chứa eng.traineddata)
      const localTessdata = path.join(process.cwd(), 'tessdata');
      const publicTessdata = path.join(process.cwd(), 'public', 'tessdata');
      const langPath = fs.existsSync(localTessdata) ? localTessdata : publicTessdata;

      const worker = await Tesseract.createWorker('eng', 1, {
        workerPath,
        langPath,
        cachePath: langPath,
        gzip: false
      });

      cachedWorker = worker;
      console.log('[OCR Server] Tesseract offline worker ready with langPath:', langPath);
      return worker;
    } catch (err) {
      console.error('[OCR Server] Failed to initialize Tesseract worker:', err);
      cachedWorker = null;
      throw err;
    } finally {
      workerInitializing = null;
    }
  })();

  return workerInitializing;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, mode } = body;

    if (!image) {
      return NextResponse.json({ success: false, error: 'Missing image data' }, { status: 400 });
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const worker = await getWorker();
    
    // Timeout sau 18 giây để tránh treo
    const recognizePromise = worker.recognize(imageBuffer);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Quá thời gian nhận diện OCR (timeout 18s). Vui lòng thử lại hoặc chụp cận cảnh hơn.')), 18000)
    );

    const result: any = await Promise.race([recognizePromise, timeoutPromise]);

    const rawText = result?.data?.text || '';
    console.log('[OCR Server] Mode:', mode, 'Text:', rawText.substring(0, 150));

    if (mode === 'stamp') {
      const stampData = parseStampLines(rawText);
      return NextResponse.json({
        success: true,
        mode: 'stamp',
        data: stampData,
        rawText
      });
    }

    const parsed = parseBoxLabelText(rawText);

    return NextResponse.json({
      success: true,
      mode: 'label',
      data: parsed,
      rawText
    });
  } catch (error: any) {
    console.error('[OCR Server Error]:', error);
    if (cachedWorker) {
      try {
        await cachedWorker.terminate();
      } catch {}
      cachedWorker = null;
    }
    return NextResponse.json({ success: false, error: error.message || 'Lỗi nhận diện OCR' }, { status: 500 });
  }
}
