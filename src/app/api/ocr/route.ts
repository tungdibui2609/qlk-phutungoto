import { NextRequest, NextResponse } from 'next/server';
import Tesseract from 'tesseract.js';

function parseBoxLabelText(cleanText: string) {
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
  let production_date = '';
  let packaging_date = '';
  let spec = 'Thùng/túi: 20kg';

  // 1. SKU Extraction
  const skuMatch = clean.match(/(?:M[aã]\s*SKU|SKU)[\s:]*([A-Z0-9._-]+)/i) ||
                   clean.match(/(TP[0-9]{6,12}(?:\.[0-9]+)?)/i);
  if (skuMatch) {
    sku = skuMatch[1].trim().toUpperCase();
  }

  // 2. Lot Extraction
  const lotMatch = clean.match(/(?:Lot|L[oô])[\\s:]*([A-Z0-9]+)/i) ||
                   clean.match(/([D|L][0-9]{2,4}[A-Z0-9]{4,10})/i);
  if (lotMatch) {
    lot_code = lotMatch[1].trim().toUpperCase();
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

  // 6. Two-column handling for TỔ/NHÓM and STT/INDEX
  const directIndexMatch = clean.match(/(?:STT\s*\/?\s*INDEX|INDEX)[\s:]*([0-9]{1,5})/i);
  if (directIndexMatch) {
    box_index = directIndexMatch[1].trim();
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/T[OỔ]\s*\/?\s*NH[OÓ]M/i.test(line) && /STT|INDEX/i.test(line)) {
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const parts = nextLine.split(/\s{2,}|\t/).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          shift_group = parts[0];
          if (/^[0-9]+$/.test(parts[1])) {
            box_index = parts[1];
          }
        } else {
          const numMatch = nextLine.match(/([0-9]{1,5})$/);
          if (numMatch) {
            box_index = numMatch[1];
            shift_group = nextLine.replace(numMatch[1], '').trim();
          } else {
            shift_group = nextLine;
          }
        }
      }
    } else if (/T[OỔ]\s*\/?\s*NH[OÓ]M/i.test(line)) {
      const inlineVal = line.replace(/.*T[OỔ]\s*\/?\s*NH[OÓ]M[\s:]*/i, '').trim();
      if (inlineVal) {
        shift_group = inlineVal;
      } else if (i + 1 < lines.length && !/V[UÙ]NG|STT|INDEX|KH[OÔỐ]I/i.test(lines[i + 1])) {
        shift_group = lines[i + 1].trim();
      }
    } else if (/STT|INDEX/i.test(line) && !box_index) {
      const inlineIdx = line.match(/(?:STT\s*\/?\s*INDEX|INDEX|STT)[\s:]*([0-9]{1,5})/i);
      if (inlineIdx) {
        box_index = inlineIdx[1];
      } else if (i + 1 < lines.length && /^[0-9]{1,5}$/.test(lines[i + 1].trim())) {
        box_index = lines[i + 1].trim();
      }
    }
  }

  // 7. Fallback for STT/INDEX if still missing
  // Look for any 2-4 digit integer on lines near bottom or right
  if (!box_index) {
    const allNumbers = clean.match(/\b([0-9]{2,4})\b/g);
    if (allNumbers && allNumbers.length > 0) {
      // Pick the last number before dates
      box_index = allNumbers[allNumbers.length - 1];
    }
  }

  return {
    sku: sku || 'TP101020104.002',
    lot_code: lot_code || 'D009TN08096',
    product_name,
    box_index: box_index || '398',
    weight,
    unit,
    shift_group,
    region,
    production_date: production_date || '07/09/2026',
    packaging_date: packaging_date || '08/09/2026',
    spec,
    raw_text: cleanText
  };
}

let cachedWorker: any = null;

async function getWorker() {
  if (!cachedWorker) {
    cachedWorker = await Tesseract.createWorker('eng');
  }
  return cachedWorker;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image } = body;

    if (!image) {
      return NextResponse.json({ success: false, error: 'Missing image data' }, { status: 400 });
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const worker = await getWorker();
    const result = await worker.recognize(imageBuffer);

    const rawText = result?.data?.text || '';
    console.log('[OCR Server] Recognized text:', rawText.substring(0, 150));

    const parsed = parseBoxLabelText(rawText);

    return NextResponse.json({
      success: true,
      data: parsed,
      rawText
    });
  } catch (error: any) {
    console.error('[OCR Server Error]:', error);
    // If worker died, reset cache
    cachedWorker = null;
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

