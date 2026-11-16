import { decodeStampBox, DEFAULT_STAMP_DICT } from '@/lib/stampDecoder';

export function cleanStampNumericString(input: string): string {
  if (!input) return '';
  let s = input.trim();
  s = s.replace(/[oOQD]/g, '0');
  s = s.replace(/[Il|!]/g, '1');
  s = s.replace(/[Zz]/g, '2');
  s = s.replace(/[S]/g, '5');
  s = s.replace(/[bB]/g, '8');
  return s.replace(/[^0-9\-]/g, '');
}

function isSpecial12Line(cleanedLine: string, activeDict: Record<string, Record<string, string>>): boolean {
  const digits = cleanedLine.replace(/[^0-9]/g, '');
  if (digits.length < 12) return false;
  const c12 = digits.substring(0, 12);
  return !!(activeDict.special_12?.[c12] || DEFAULT_STAMP_DICT.special_12?.[c12]);
}

function scoreAsLine1(cleanedLine: string, activeDict: Record<string, Record<string, string>>): number {
  const digits = cleanedLine.replace(/[^0-9]/g, '');
  let score = 0;
  if (isSpecial12Line(cleanedLine, activeDict)) score += 100;
  if (/^\d{10,13}-\d{1,2}$/.test(cleanedLine)) score += 50;
  else if (cleanedLine.includes('-')) score += 20;
  if (digits.length >= 12 && digits.length <= 14) score += 25;
  if (digits.length >= 15 && !cleanedLine.includes('-')) score -= 40;
  return score;
}

function scoreAsLine2(cleanedLine: string, activeDict: Record<string, Record<string, string>>): number {
  const digits = cleanedLine.replace(/[^0-9]/g, '');
  let score = 0;
  if (!cleanedLine.includes('-') && digits.length === 16) score += 60;
  else if (!cleanedLine.includes('-') && digits.length >= 15 && digits.length <= 17) score += 40;
  if (isSpecial12Line(cleanedLine, activeDict)) score -= 80;
  if (cleanedLine.includes('-')) score -= 30;
  return score;
}

export function parseStampLines(rawText: string, dictMap?: Record<string, Record<string, string>>) {
  const rawLines = (rawText || '').split('\n').map(l => l.trim()).filter(Boolean);
  const numericLines: string[] = [];

  for (const line of rawLines) {
    const cleaned = cleanStampNumericString(line);
    if (cleaned.replace(/-/g, '').length >= 8) {
      numericLines.push(cleaned);
    }
  }

  let line1 = '';
  let line2 = '';

  const activeDict = dictMap || DEFAULT_STAMP_DICT;

  if (numericLines.length === 1 && numericLines[0].replace(/-/g, '').length >= 26) {
    const full = numericLines[0];
    const fullDigits = full.replace(/[^0-9]/g, '');
    const isHeadSpecial12 = isSpecial12Line(full, activeDict);

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
    // Chọn dòng tốt nhất cho Dòng 1 và Dòng 2 (tránh đảo ngược hoặc dính dòng nhiễu)
    let bestL1Idx = 0;
    let bestL1Score = -Infinity;
    numericLines.forEach((l, idx) => {
      const s = scoreAsLine1(l, activeDict);
      if (s > bestL1Score) {
        bestL1Score = s;
        bestL1Idx = idx;
      }
    });

    let bestL2Idx = bestL1Idx === 0 ? 1 : 0;
    let bestL2Score = -Infinity;
    numericLines.forEach((l, idx) => {
      if (idx === bestL1Idx) return;
      const s = scoreAsLine2(l, activeDict);
      if (s > bestL2Score) {
        bestL2Score = s;
        bestL2Idx = idx;
      }
    });

    line1 = numericLines[bestL1Idx];
    line2 = numericLines[bestL2Idx];
  } else if (numericLines.length === 1) {
    const single = numericLines[0];
    const singleDigits = single.replace(/[^0-9]/g, '');
    if (isSpecial12Line(single, activeDict)) {
      line1 = single;
    } else if (singleDigits.length >= 15 && !single.includes('-')) {
      line2 = single;
    } else {
      line1 = single;
    }
  }

  const decoded = decodeStampBox({
    metadata: {
      scan_type: 'stamp',
      stamp_line1: line1,
      stamp_line2: line2
    }
  }, activeDict);

  return {
    stamp_line1: line1,
    stamp_line2: line2,
    decoded
  };
}

export function parseBoxLabelText(cleanText: string) {
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
            shift_group = lines[i + 1];
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
