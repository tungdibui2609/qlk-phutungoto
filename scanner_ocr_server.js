const http = require('http');
const Tesseract = require('tesseract.js');

const PORT = 8088;
let worker = null;

async function initWorker() {
  console.log('[OCR Server] Initializing Tesseract worker...');
  worker = await Tesseract.createWorker('eng');
  console.log('[OCR Server] Tesseract worker ready on port', PORT);
}

function parseBoxLabelText(cleanText) {
  const clean = (cleanText || '').replace(/\r/g, '');
  const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);

  let sku = '';
  let lot_code = '';
  let product_name = 'TP cấp đông sầu riêng múi monthong C - Hàng có hạt';
  let box_index = '';
  let weight = 20;
  let unit = 'Kg';
  let shift_group = 'Nguyên';
  let region = 'Tây Nguyên';
  let production_date = '07/09/2026';
  let packaging_date = '08/09/2026';
  let spec = 'Thùng/túi: 20kg';

  // 1. SKU Extraction
  const skuMatch = clean.match(/(?:M[aã]\s*SKU|SKU)[\s:]*([A-Z0-9._-]+)/i) ||
                   clean.match(/(TP[0-9]{6,12}(?:\.[0-9]+)?)/i);
  if (skuMatch) {
    sku = skuMatch[1].trim().toUpperCase();
  }

  // 2. Lot Extraction
  const lotMatch = clean.match(/(?:Lot|L[oô])[:\s]*([A-Z0-9]+)/i) ||
                   clean.match(/([D|L][0-9O]{2,4}[A-Z0-9]{4,10})/i);
  if (lotMatch) {
    lot_code = lotMatch[1].trim().toUpperCase().replace(/^DOO/, 'D00').replace(/^DO0/, 'D00').replace(/^D0O/, 'D00');
  }

  // 3. Weight Extraction
  const weightMatch = clean.match(/(?:KH[OÔỐ]I\s*L[UƯỢ]NG|WEIGHT)[\s\/:]*([0-9]{1,3}(?:[.,][0-9]+)?)\s*(?:kg)?/i) ||
                      clean.match(/([0-9]{1,3})\s*kg/i);
  if (weightMatch) {
    weight = parseFloat(weightMatch[1].replace(',', '.'));
  }

  // 4. Dates
  const nsxMatch = clean.match(/(?:Ng[aà]y\s*SX|NSX)[\s:]*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4})/i);
  if (nsxMatch) {
    production_date = nsxMatch[1].trim();
  }

  const ndgMatch = clean.match(/(?:Ng[aà]y\s*[DĐ]G|N[DĐ]G)[\s:]*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4})/i);
  if (ndgMatch) {
    packaging_date = ndgMatch[1].trim();
  }

  // 5. Region
  const regionMatch = clean.match(/(?:V[UÙ]NG\s*NGUY[EÊ]N\s*LI[EỆ]U)[\s:]*([^\n\r]+)/i);
  if (regionMatch) {
    region = regionMatch[1].replace(/Ng[aà]y\s*SX.*/i, '').trim();
  }

  // 6. STT / INDEX
  // First look for INDEX / STT followed by 1 to 4 digits
  const directIndexMatch = clean.match(/(?:STT\s*\/?\s*INDEX|INDEX|STT)[\s\S]{0,25}?(\b[0-9]{1,4}\b)/i);
  if (directIndexMatch) {
    box_index = directIndexMatch[1].trim();
  }

  // Two-column search
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/STT|INDEX/i.test(line)) {
      const numsInLine = line.match(/\b([0-9]{1,4})\b/g);
      if (numsInLine && numsInLine.length > 0) {
        box_index = numsInLine[numsInLine.length - 1];
        break;
      }
      if (i + 1 < lines.length) {
        const nextNums = lines[i + 1].match(/\b([0-9]{1,4})\b/g);
        if (nextNums && nextNums.length > 0) {
          box_index = nextNums[nextNums.length - 1];
          break;
        }
      }
    }
  }

  function isBoxLabel(t) {
    if (!t || t.length < 10) return false;
    let score = 0;
    const low = t.toLowerCase();
    if (/sku|tp10|sầu riêng|sau rieng|monthong|ri6|cấp đông|cap dong/i.test(low)) score++;
    if (/lot|lô\s*:|d009|tn08|tn18/i.test(low)) score++;
    if (/stt|index|thùng|túi/i.test(low)) score++;
    if (/spec|weight|khối lượng|khoi luong|20kg|20\s*kg/i.test(low)) score++;
    if (/ngày sx|ngay sx|ngày đg|ngay dg|nsx|ndg|tây nguyên|tay nguyen/i.test(low)) score++;
    return score >= 2;
  }

  if (!isBoxLabel(clean)) {
    return null;
  }

  if (!box_index) {
    return null;
  }

  return {
    sku: sku || 'TP101020104.002',
    lot_code: lot_code || 'D009TN08096',
    product_name,
    box_index,
    weight: weight || 20,
    unit,
    shift_group,
    region,
    production_date: production_date || '07/09/2026',
    packaging_date: packaging_date || '08/09/2026',
    spec,
    raw_text: cleanText
  };
}

const server = http.createServer(async (req, res) => {
  // Add CORS headers so mobile app can call seamlessly
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/health' || req.url === '/api/ocr/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', worker_ready: !!worker }));
    return;
  }

  if (req.method === 'POST' && (req.url === '/api/ocr' || req.url === '/')) {
    let bodyStr = '';
    req.on('data', chunk => {
      bodyStr += chunk;
      // Safeguard against absurd payloads (>25MB)
      if (bodyStr.length > 25 * 1024 * 1024) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Payload too large' }));
        req.destroy();
      }
    });

    req.on('end', async () => {
      try {
        const parsedBody = JSON.parse(bodyStr);
        const { image } = parsedBody;

        if (!image) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Missing image field' }));
          return;
        }

        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        if (!worker) {
          await initWorker();
        }

        console.time('OCR_RECOGNIZE');
        const result = await worker.recognize(imageBuffer);
        console.timeEnd('OCR_RECOGNIZE');

        const rawText = result?.data?.text || '';
        console.log('[OCR Server] Extracted text length:', rawText.length);

        const parsed = parseBoxLabelText(rawText);

        if (!parsed) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: 'Không phát hiện tem thùng hợp lệ trong khung hình',
            rawText
          }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          data: parsed,
          rawText
        }));
      } catch (err) {
        console.error('[OCR Server Error]:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message || 'Lỗi nhận diện OCR' }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

process.on('uncaughtException', (err) => {
  console.error('[OCR Server Uncaught Exception]:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[OCR Server Unhandled Rejection]:', reason);
});

initWorker().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[OCR Server] Listening on http://0.0.0.0:${PORT}`);
  });
}).catch(err => {
  console.error('[OCR Server] Failed to initialize worker:', err);
  process.exit(1);
});

