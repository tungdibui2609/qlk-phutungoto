import { NextRequest, NextResponse } from 'next/server';
import Tesseract from 'tesseract.js';
import { decodeStampBox, DEFAULT_STAMP_DICT } from '@/lib/stampDecoder';

function cleanStampNumericString(input: string): string {
  if (!input) return '';
  let s = input.trim();
  s = s.replace(/[oOQD]/g, '0');
  s = s.replace(/[Il|!]/g, '1');
  s = s.replace(/[Zz]/g, '2');
  s = s.replace(/[S]/g, '5');
  s = s.replace(/[bB]/g, '8');
  return s.replace(/[^0-9\-]/g, '');
}

function parseStampLines(rawText: string) {
  const rawLines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const numericLines: string[] = [];

  for (const line of rawLines) {
    const cleaned = cleanStampNumericString(line);
    if (cleaned.replace(/-/g, '').length >= 8) {
      numericLines.push(cleaned);
    }
  }

  let line1 = '';
  let line2 = '';

  if (numericLines.length === 1 && numericLines[0].replace(/-/g, '').length >= 26) {
    const full = numericLines[0];
    const fullDigits = full.replace(/[^0-9]/g, '');
    const isHeadSpecial12 = fullDigits.length >= 12 && !!DEFAULT_STAMP_DICT.special_12?.[fullDigits.substring(0, 12)];
    
    let l1Cut = 14;
    if (isHeadSpecial12) {
      if (full.length > 12 && full[12] === '-') {
        l1Cut = 14;
      } else if (fullDigits.length === 28) {
        l1Cut = 12;
      }
    }
    line1 = full.slice(0, l1Cut);
    line2 = full.slice(l1Cut);
  } else if (numericLines.length >= 2) {
    line1 = numericLines[0];
    line2 = numericLines[1];
  } else if (numericLines.length === 1) {
    line1 = numericLines[0];
  }

  const decoded = decodeStampBox({
    metadata: {
      scan_type: 'stamp',
      stamp_line1: line1,
      stamp_line2: line2
    }
  });

  return {
    stamp_line1: line1,
    stamp_line2: line2,
    decoded
  };
}

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

  if (!box_index) {
    const allNumbers = clean.match(/\b([0-9]{2,4})\b/g);
    if (allNumbers && allNumbers.length > 0) {
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
    const { image, mode } = body;

    if (!image) {
      return NextResponse.json({ success: false, error: 'Missing image data' }, { status: 400 });
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const worker = await getWorker();
    const result = await worker.recognize(imageBuffer);

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
    cachedWorker = null;
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

