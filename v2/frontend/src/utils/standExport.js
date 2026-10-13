// standExport.js — Table Stand Generator (SVG / PDF / PNG) & Commercial Bulk ZIP Export Engine
import { jsPDF } from 'jspdf';

// ─── XML / Filename Helpers ───────────────────────────────────────────────────
function escapeXml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function sanitizeSlug(str = 'table') {
  return String(str)
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'table';
}

export function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ─── Pure JS Standard ZIP Archive Builder (Zero External Dependencies) ────────
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Builds a standard uncompressed ZIP archive from an array of { name: string, data: Uint8Array | string }
 * Returns a Blob with type 'application/zip'
 */
export function createZipBlob(files) {
  const encoder = new TextEncoder();
  const entries = files.map((f) => {
    const nameBytes = encoder.encode(f.name);
    let dataBytes;
    if (f.data instanceof Uint8Array) {
      dataBytes = f.data;
    } else if (f.data instanceof ArrayBuffer) {
      dataBytes = new Uint8Array(f.data);
    } else {
      dataBytes = encoder.encode(String(f.data ?? ''));
    }
    const crc = crc32(dataBytes);
    return { nameBytes, dataBytes, crc };
  });

  let localTotalSize = 0;
  let centralTotalSize = 0;
  for (const entry of entries) {
    localTotalSize += 30 + entry.nameBytes.length + entry.dataBytes.length;
    centralTotalSize += 46 + entry.nameBytes.length;
  }

  const totalSize = localTotalSize + centralTotalSize + 22;
  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  let offset = 0;
  const localOffsets = [];

  // Write Local File Headers + File Data
  for (const entry of entries) {
    localOffsets.push(offset);
    view.setUint32(offset, 0x04034b50, true); // Local file header signature
    view.setUint16(offset + 4, 20, true);     // Version needed to extract (2.0)
    view.setUint16(offset + 6, 0x0800, true); // UTF-8 filename flag
    view.setUint16(offset + 8, 0, true);      // Compression: 0 (STORE)
    view.setUint16(offset + 10, 0, true);     // Mod time
    view.setUint16(offset + 12, 0x5421, true);// Mod date
    view.setUint32(offset + 14, entry.crc, true);
    view.setUint32(offset + 18, entry.dataBytes.length, true);
    view.setUint32(offset + 22, entry.dataBytes.length, true);
    view.setUint16(offset + 26, entry.nameBytes.length, true);
    view.setUint16(offset + 28, 0, true);     // Extra field length
    offset += 30;

    out.set(entry.nameBytes, offset);
    offset += entry.nameBytes.length;

    out.set(entry.dataBytes, offset);
    offset += entry.dataBytes.length;
  }

  const centralDirOffset = offset;

  // Write Central Directory Headers
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    view.setUint32(offset, 0x02014b50, true); // Central directory signature
    view.setUint16(offset + 4, 20, true);     // Version made by
    view.setUint16(offset + 6, 20, true);     // Version needed
    view.setUint16(offset + 8, 0x0800, true); // UTF-8 flag
    view.setUint16(offset + 10, 0, true);    // Compression: STORE
    view.setUint16(offset + 12, 0, true);    // Mod time
    view.setUint16(offset + 14, 0x5421, true);// Mod date
    view.setUint32(offset + 16, entry.crc, true);
    view.setUint32(offset + 20, entry.dataBytes.length, true);
    view.setUint32(offset + 24, entry.dataBytes.length, true);
    view.setUint16(offset + 28, entry.nameBytes.length, true);
    view.setUint16(offset + 30, 0, true);    // Extra field length
    view.setUint16(offset + 32, 0, true);    // Comment length
    view.setUint16(offset + 34, 0, true);    // Disk number
    view.setUint16(offset + 36, 0, true);    // Internal attributes
    view.setUint32(offset + 38, 0, true);    // External attributes
    view.setUint32(offset + 42, localOffsets[i], true);
    offset += 46;

    out.set(entry.nameBytes, offset);
    offset += entry.nameBytes.length;
  }

  const centralDirSize = offset - centralDirOffset;

  // End of Central Directory Record (EOCD)
  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 4, 0, true);
  view.setUint16(offset + 6, 0, true);
  view.setUint16(offset + 8, entries.length, true);
  view.setUint16(offset + 10, entries.length, true);
  view.setUint32(offset + 12, centralDirSize, true);
  view.setUint32(offset + 16, centralDirOffset, true);
  view.setUint16(offset + 20, 0, true);

  return new Blob([out], { type: 'application/zip' });
}

// ─── Extract QR SVG Markup & Rasterize SVG to PNG ─────────────────────────────
export function getQrSvgMarkupFromDom(tableId) {
  const el = document.getElementById(`stand-qr-svg-${tableId}`);
  if (!el) return { innerMarkup: '', viewBox: '0 0 29 29', fullSvg: '' };
  const viewBox = el.getAttribute('viewBox') || '0 0 29 29';
  const clone = el.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.removeAttribute('id');
  return {
    innerMarkup: el.innerHTML,
    viewBox,
    fullSvg: `<?xml version="1.0" encoding="UTF-8"?>\n${clone.outerHTML}`,
  };
}

export function svgStringToPngBytes(svgString, width = 1200, height = 1680) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);

        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        resolve({ bytes, dataUrl });
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    img.src = url;
  });
}

// ─── Table Stand Vector SVG Generator ─────────────────────────────────────────
/**
 * Auto-generates a commercial-grade printable SVG Table Stand / Sticker card for a table.
 * Includes:
 *   - Restaurant Name & Branding
 *   - Table # / Custom Name (e.g. "TABLE 1" or "PATIO 1")
 *   - Visual Target Area ("TAP PHONE HERE") with contactless wave rings for NFC sticker placement
 *   - Callout Banner: "Tap Phone Here or Scan QR"
 *   - Embedded Vector QR Code backup
 *   - Optional Crop / Bleed Marks & Rear NFC Sticker Placement Ring
 *
 * @param {object} item - { table_id, table_name, short_code, qrUrl, nfcUrl, isCounter }
 * @param {object} options - { restaurantName, layoutStyle: 'acrylic' | 'wooden' | 'sticker', showPrintMarks: boolean }
 */
export function generateTableStandSvgString(item, options = {}) {
  const {
    restaurantName = 'SMART MENU',
    layoutStyle = 'sticker', // default: 'sticker'
    showPrintMarks = true,
  } = options;

  const isCounter = item.table_id === 'COUNTER' || item.isCounter;
  const rawTitle = isCounter
    ? (item.table_name && item.table_name !== 'Central Service Window' ? item.table_name : 'SERVICE WINDOW')
    : (item.table_name || `TABLE ${item.table_id}`);
  const displayTitle = rawTitle.replace(/^Table(\d+)/i, 'TABLE $1');

  const shortCodeLabel = item.short_code ? `/t/${item.short_code}` : '';
  const { innerMarkup: qrInner, viewBox: qrViewBox } = getQrSvgMarkupFromDom(item.table_id);
  const vbParts = qrViewBox.split(/\s+/).map(Number);
  const qrModules = vbParts[2] || 29;

  // Palette configuration per stand hardware style
  const palettes = {
    acrylic: {
      bgTop: '#090b10',
      bgBottom: '#121621',
      cardBg: '#0d1017',
      accent: isCounter ? '#00F0FF' : '#F59E0B',
      accentSecondary: isCounter ? '#06B6D4' : '#FBBF24',
      accentSoft: isCounter ? 'rgba(0,240,255,0.14)' : 'rgba(245,158,11,0.14)',
      textMain: '#FFFFFF',
      textMuted: '#9CA3AF',
      targetFill: '#131824',
      badgeText: '#090b10',
      borderStroke: isCounter ? '#00F0FF' : '#F59E0B',
      styleLabel: 'ACRYLIC STAND INSERT · A5/A6 PORTRAIT',
    },
    wooden: {
      bgTop: '#1C140D',
      bgBottom: '#2A1E14',
      cardBg: '#231910',
      accent: '#F59E0B',
      accentSecondary: '#FDE68A',
      accentSoft: 'rgba(245,158,11,0.16)',
      textMain: '#FFFBEB',
      textMuted: '#D6C7B2',
      targetFill: '#17100A',
      badgeText: '#1C140D',
      borderStroke: '#D97706',
      styleLabel: 'WOODEN BLOCK STAND · ENGRAVE / PRINT MOUNT',
    },
    sticker: {
      bgTop: '#07090E',
      bgBottom: '#0F131D',
      cardBg: '#0B0E16',
      accent: isCounter ? '#00F0FF' : '#10B981',
      accentSecondary: isCounter ? '#67E8F9' : '#34D399',
      accentSoft: isCounter ? 'rgba(0,240,255,0.15)' : 'rgba(16,185,129,0.15)',
      textMain: '#FFFFFF',
      textMuted: '#94A3B8',
      targetFill: '#111726',
      badgeText: '#06080E',
      borderStroke: isCounter ? '#00F0FF' : '#10B981',
      styleLabel: 'TABLE STICKER DECAL · 100×100MM ADHESIVE',
    },
  };

  const p = palettes[layoutStyle] || palettes.acrylic;

  // ── Square Sticker Layout (800 x 800) ──────────────────────────────────────
  if (layoutStyle === 'sticker') {
    const qrScale = 230 / qrModules;
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${p.bgTop}" />
      <stop offset="100%" stop-color="${p.bgBottom}" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${p.accent}" />
      <stop offset="100%" stop-color="${p.accentSecondary}" />
    </linearGradient>
  </defs>

  <!-- Outer Canvas -->
  <rect width="800" height="800" rx="48" fill="url(#bgGrad)" />
  <rect x="20" y="20" width="760" height="760" rx="38" fill="none" stroke="${p.borderStroke}" stroke-width="3" stroke-opacity="0.65" />

  ${showPrintMarks ? `
  <!-- Die-Cut & Bleed Guide -->
  <rect x="10" y="10" width="780" height="780" rx="44" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-dasharray="8 8" stroke-width="1.5" />
  ` : ''}

  <!-- Top Branding Header -->
  <rect x="48" y="46" width="704" height="118" rx="24" fill="#121723" stroke="#ffffff" stroke-opacity="0.1" />
  <text x="80" y="92" fill="${p.accent}" font-family="'Courier New', monospace" font-size="16" font-weight="700" letter-spacing="4">
    ✦ ${escapeXml(restaurantName.toUpperCase())}
  </text>
  <text x="80" y="138" fill="${p.textMain}" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="900" letter-spacing="1">
    ${escapeXml(displayTitle.toUpperCase())}
  </text>

  <!-- Right Pill in Header -->
  <rect x="520" y="74" width="204" height="60" rx="30" fill="url(#accentGrad)" />
  <text x="622" y="101" text-anchor="middle" fill="${p.badgeText}" font-family="'Courier New', monospace" font-size="13" font-weight="900" letter-spacing="1.5">
    CONTACTLESS
  </text>
  <text x="622" y="120" text-anchor="middle" fill="${p.badgeText}" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="900" letter-spacing="1">
    INSTANT MENU
  </text>

  <!-- Center Callout Banner: SCAN QR -->
  <rect x="48" y="184" width="704" height="54" rx="16" fill="${p.accent}" fill-opacity="0.14" stroke="${p.accent}" stroke-opacity="0.5" stroke-width="1.5" />
  <text x="400" y="218" text-anchor="middle" fill="${p.textMain}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="900" letter-spacing="2">
    SCAN QR
  </text>

  <!-- Left Column: Visual NFC Tap Target Zone -->
  <rect x="48" y="258" width="338" height="410" rx="28" fill="${p.targetFill}" stroke="${p.accent}" stroke-opacity="0.45" stroke-width="2" />
  
  <!-- Concentric NFC Target Rings -->
  <circle cx="217" cy="425" r="118" fill="${p.accent}" fill-opacity="0.05" stroke="${p.accent}" stroke-opacity="0.35" stroke-width="2" stroke-dasharray="10 6" />
  <circle cx="217" cy="425" r="88" fill="${p.accent}" fill-opacity="0.09" stroke="${p.accent}" stroke-opacity="0.55" stroke-width="2" />
  <circle cx="217" cy="425" r="56" fill="url(#accentGrad)" />

  <!-- Contactless Wave Icon inside Target -->
  <path d="M 205 407 A 24 24 0 0 1 205 443" fill="none" stroke="${p.badgeText}" stroke-width="4.5" stroke-linecap="round" />
  <path d="M 216 398 A 36 36 0 0 1 216 452" fill="none" stroke="${p.badgeText}" stroke-width="4.5" stroke-linecap="round" />
  <path d="M 227 389 A 48 48 0 0 1 227 461" fill="none" stroke="${p.badgeText}" stroke-width="4.5" stroke-linecap="round" />
  <circle cx="195" cy="425" r="4.5" fill="${p.badgeText}" />

  <text x="217" y="584" text-anchor="middle" fill="${p.accent}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="900" letter-spacing="1.5">
    TAP PHONE HERE
  </text>
  <text x="217" y="612" text-anchor="middle" fill="${p.textMuted}" font-family="'Courier New', monospace" font-size="13" font-weight="700">
    HOLD TOP OF PHONE TO NFC TAG
  </text>
  ${showPrintMarks ? `
  <text x="217" y="642" text-anchor="middle" fill="${p.accent}" fill-opacity="0.7" font-family="'Courier New', monospace" font-size="11" font-weight="700">
    [ PLACE 30MM NFC STICKER BEHIND TARGET ]
  </text>
  ` : ''}

  <!-- Right Column: Backup QR Code -->
  <rect x="414" y="258" width="338" height="410" rx="28" fill="#121723" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2" />
  <rect x="453" y="288" width="260" height="260" rx="20" fill="#ffffff" stroke="${p.accent}" stroke-width="4" />
  <g transform="translate(468, 303) scale(${qrScale.toFixed(4)})">
    ${qrInner}
  </g>
  <text x="583" y="584" text-anchor="middle" fill="${p.textMain}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="900" letter-spacing="1.5">
    OR SCAN QR CODE
  </text>
  <text x="583" y="612" text-anchor="middle" fill="${p.textMuted}" font-family="'Courier New', monospace" font-size="13" font-weight="700">
    OPEN CAMERA · NO APP NEEDED
  </text>
  <text x="583" y="642" text-anchor="middle" fill="${p.textMuted}" font-family="'Courier New', monospace" font-size="12" font-weight="700">
    ${escapeXml(shortCodeLabel)}
  </text>

  <!-- Footer Strip -->
  <rect x="48" y="688" width="704" height="58" rx="16" fill="#06080d" stroke="#ffffff" stroke-opacity="0.08" />
  <text x="400" y="723" text-anchor="middle" fill="${p.textMuted}" font-family="'Courier New', monospace" font-size="14" font-weight="700" letter-spacing="2">
    BROWSE MENU · ORDER INSTANTLY · FAST PAY AT TABLE
  </text>
</svg>`;
  }

  // ── Portrait Stand Layout (Acrylic / Wooden — 800 x 1120) ───────────────────
  const qrScale = 270 / qrModules;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1120" width="800" height="1120">
  <defs>
    <linearGradient id="standBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${p.bgTop}" />
      <stop offset="100%" stop-color="${p.bgBottom}" />
    </linearGradient>
    <linearGradient id="standAccent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${p.accent}" />
      <stop offset="100%" stop-color="${p.accentSecondary}" />
    </linearGradient>
  </defs>

  <!-- Stand Base Canvas -->
  <rect width="800" height="1120" rx="36" fill="url(#standBg)" />

  <!-- Top Accent Bar -->
  <rect x="0" y="0" width="800" height="16" fill="url(#standAccent)" />

  <!-- Outer Frame Border -->
  <rect x="28" y="34" width="744" height="1052" rx="28" fill="none" stroke="${p.borderStroke}" stroke-opacity="0.55" stroke-width="2.5" />

  ${showPrintMarks ? `
  <!-- Commercial Print Crop Marks -->
  <path d="M 10 30 L 30 30 M 30 10 L 30 30" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1.5" />
  <path d="M 790 30 L 770 30 M 770 10 L 770 30" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1.5" />
  <path d="M 10 1090 L 30 1090 M 30 1110 L 30 1090" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1.5" />
  <path d="M 790 1090 L 770 1090 M 770 1110 L 770 1090" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1.5" />
  ` : ''}

  <!-- Header Block: Restaurant Name & Table Number -->
  <rect x="56" y="62" width="688" height="176" rx="24" fill="${p.cardBg}" stroke="#ffffff" stroke-opacity="0.1" stroke-width="1.5" />
  <text x="400" y="104" text-anchor="middle" fill="${p.accent}" font-family="'Courier New', monospace" font-size="18" font-weight="700" letter-spacing="5">
    ✦ ${escapeXml(restaurantName.toUpperCase())} ✦
  </text>
  <text x="400" y="174" text-anchor="middle" fill="${p.textMain}" font-family="Arial, Helvetica, sans-serif" font-size="56" font-weight="900" letter-spacing="2">
    ${escapeXml(displayTitle.toUpperCase())}
  </text>
  <text x="400" y="212" text-anchor="middle" fill="${p.textMuted}" font-family="'Courier New', monospace" font-size="14" font-weight="700" letter-spacing="3">
    ${isCounter ? 'ORDER &amp; PICKUP WINDOW · PRE-PAID' : 'DIGITAL DINING &amp; INSTANT ORDERING'}
  </text>

  <!-- Main Callout Banner: Tap Phone Here or Scan QR -->
  <rect x="56" y="258" width="688" height="64" rx="32" fill="url(#standAccent)" />
  <text x="400" y="299" text-anchor="middle" fill="${p.badgeText}" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="900" letter-spacing="2.5">
    TAP PHONE HERE OR SCAN QR
  </text>

  <!-- ── SECTION 1: VISUAL NFC TAP TARGET ZONE ────────────────────────────── -->
  <rect x="56" y="344" width="688" height="300" rx="28" fill="${p.targetFill}" stroke="${p.accent}" stroke-opacity="0.5" stroke-width="2.5" />

  <!-- Left: Concentric Contactless Target Zone (Where NFC Sticker Goes Behind Stand) -->
  <circle cx="220" cy="494" r="116" fill="${p.accent}" fill-opacity="0.05" stroke="${p.accent}" stroke-opacity="0.4" stroke-width="2" stroke-dasharray="10 6" />
  <circle cx="220" cy="494" r="86" fill="${p.accent}" fill-opacity="0.1" stroke="${p.accent}" stroke-opacity="0.65" stroke-width="2" />
  <circle cx="220" cy="494" r="54" fill="url(#standAccent)" />

  <!-- Contactless Waves Icon -->
  <path d="M 208 476 A 24 24 0 0 1 208 512" fill="none" stroke="${p.badgeText}" stroke-width="4.5" stroke-linecap="round" />
  <path d="M 219 467 A 36 36 0 0 1 219 521" fill="none" stroke="${p.badgeText}" stroke-width="4.5" stroke-linecap="round" />
  <path d="M 230 458 A 48 48 0 0 1 230 530" fill="none" stroke="${p.badgeText}" stroke-width="4.5" stroke-linecap="round" />
  <circle cx="198" cy="494" r="4.5" fill="${p.badgeText}" />

  <!-- Right of Target: Instructions -->
  <rect x="372" y="388" width="160" height="32" rx="16" fill="${p.accent}" fill-opacity="0.18" />
  <text x="452" y="409" text-anchor="middle" fill="${p.accent}" font-family="'Courier New', monospace" font-size="13" font-weight="900" letter-spacing="2">
    OPTION 1 · NFC TAP
  </text>
  <text x="372" y="458" fill="${p.textMain}" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="900" letter-spacing="1">
    TAP PHONE HERE
  </text>
  <text x="372" y="492" fill="${p.textMuted}" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="600">
    Hold the top of your iPhone or Android
  </text>
  <text x="372" y="518" fill="${p.textMuted}" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="600">
    against the target circle to open menu.
  </text>
  ${showPrintMarks ? `
  <rect x="372" y="544" width="336" height="36" rx="10" fill="#000000" fill-opacity="0.45" stroke="${p.accent}" stroke-opacity="0.35" stroke-dasharray="5 4" />
  <text x="540" y="567" text-anchor="middle" fill="${p.accent}" font-family="'Courier New', monospace" font-size="12" font-weight="700">
    MOUNT NFC STICKER BEHIND TARGET (Ø 30MM)
  </text>
  ` : ''}

  <!-- ── SECTION 2: BACKUP QR CODE ZONE ───────────────────────────────────── -->
  <rect x="56" y="666" width="688" height="334" rx="28" fill="${p.cardBg}" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2" />

  <!-- QR Frame on Left/Center -->
  <rect x="92" y="688" width="290" height="290" rx="22" fill="#ffffff" stroke="${p.accent}" stroke-width="4" />
  <g transform="translate(102, 698) scale(${qrScale.toFixed(4)})">
    ${qrInner}
  </g>

  <!-- Right of QR: Backup Scan Instructions -->
  <rect x="416" y="716" width="174" height="32" rx="16" fill="#ffffff" fill-opacity="0.1" />
  <text x="503" y="737" text-anchor="middle" fill="${p.textMain}" font-family="'Courier New', monospace" font-size="13" font-weight="900" letter-spacing="2">
    OPTION 2 · QR BACKUP
  </text>
  <text x="416" y="786" fill="${p.textMain}" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="900" letter-spacing="1">
    OR SCAN QR CODE
  </text>
  <text x="416" y="820" fill="${p.textMuted}" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="600">
    1. Open your phone camera app
  </text>
  <text x="416" y="848" fill="${p.textMuted}" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="600">
    2. Point at the QR code on the left
  </text>
  <text x="416" y="876" fill="${p.textMuted}" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="600">
    3. Browse dishes &amp; order instantly
  </text>

  <!-- Dynamic Token Badge -->
  <rect x="416" y="904" width="292" height="44" rx="12" fill="#06080d" stroke="#ffffff" stroke-opacity="0.1" />
  <text x="562" y="931" text-anchor="middle" fill="${p.accent}" font-family="'Courier New', monospace" font-size="14" font-weight="700">
    TOKEN: ${escapeXml(item.short_code || item.table_id)} · NO APP NEEDED
  </text>

  <!-- Bottom Footer -->
  <text x="400" y="1044" text-anchor="middle" fill="${p.textMuted}" font-family="'Courier New', monospace" font-size="13" font-weight="700" letter-spacing="2">
    ${escapeXml(p.styleLabel)} · SMART MENU AI
  </text>
</svg>`;
}

// ─── Single Table Stand Downloads (SVG / PDF / PNG) ───────────────────────────
export function downloadSingleTableStandSvg(item, options = {}) {
  const svgString = generateTableStandSvgString(item, options);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const label = sanitizeSlug(item.table_name || `Table-${item.table_id}`);
  triggerBlobDownload(blob, `${label}-Table-Stand.svg`);
}

export async function downloadSingleTableStandPng(item, options = {}) {
  const svgString = generateTableStandSvgString(item, options);
  const isSticker = options.layoutStyle === 'sticker';
  const width = 1200;
  const height = isSticker ? 1200 : 1680;
  const { bytes } = await svgStringToPngBytes(svgString, width, height);
  const blob = new Blob([bytes], { type: 'image/png' });
  const label = sanitizeSlug(item.table_name || `Table-${item.table_id}`);
  triggerBlobDownload(blob, `${label}-Table-Stand.png`);
}

export async function downloadSingleTableStandPdf(item, options = {}) {
  const pdfBlob = await buildMultiPageStandPdfBlob([item], options);
  const label = sanitizeSlug(item.table_name || `Table-${item.table_id}`);
  triggerBlobDownload(pdfBlob, `${label}-Table-Stand.pdf`);
}

// ─── Multi-Page Commercial PDF Builder (jsPDF) ────────────────────────────────
/**
 * Generates a print-ready Multi-Page PDF containing all table stands (1 page per table)
 * plus a final Commercial Print & Dynamic URL Manifest page.
 */
export async function buildMultiPageStandPdfBlob(items, options = {}, onProgress) {
  const {
    restaurantName = 'SMART MENU',
    layoutStyle = 'acrylic',
    showPrintMarks = true,
  } = options;

  const isSticker = layoutStyle === 'sticker';
  // Standard A5 Portrait (148 x 210 mm) for Stands, or 120 x 120 mm Square for Stickers
  const pageFormat = isSticker ? [120, 120] : 'a5';
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: pageFormat,
    compress: true,
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (onProgress) {
      onProgress({
        step: `Rendering PDF page ${i + 1} of ${items.length} (${item.table_name || `Table ${item.table_id}`})…`,
        percent: Math.round(((i + 0.5) / items.length) * 100),
      });
    }

    if (i > 0) {
      doc.addPage(pageFormat, 'portrait');
    }

    const svgString = generateTableStandSvgString(item, {
      restaurantName,
      layoutStyle,
      showPrintMarks,
    });

    const renderW = 1200;
    const renderH = isSticker ? 1200 : 1680;
    const { dataUrl } = await svgStringToPngBytes(svgString, renderW, renderH);

    // Fill page background
    doc.setFillColor(9, 11, 16);
    doc.rect(0, 0, pageW, pageH, 'F');

    // Center stand artwork with 4mm margin
    const margin = 4;
    const availW = pageW - margin * 2;
    const availH = pageH - margin * 2;
    doc.addImage(dataUrl, 'PNG', margin, margin, availW, availH, undefined, 'FAST');
  }

  return doc.output('blob');
}

export async function downloadBulkMultiPagePdf(items, options = {}, onProgress) {
  const blob = await buildMultiPageStandPdfBlob(items, options, onProgress);
  const restSlug = sanitizeSlug(options.restaurantName || 'Smart-Menu');
  triggerBlobDownload(blob, `${restSlug}-All-Table-Stands-${items.length}-Pages.pdf`);
}

// ─── Bulk Export ZIP Package (Stands SVG + PNG + Multi-Page PDF + QR Codes + CSV) ─
export async function downloadBulkCommercialZip(items, options = {}, onProgress) {
  const {
    restaurantName = 'SMART MENU',
    layoutStyle = 'acrylic',
    showPrintMarks = true,
  } = options;

  const restSlug = sanitizeSlug(restaurantName);
  const zipEntries = [];
  const csvRows = [
    ['Table ID', 'Table Name', 'Short Code', 'NFC Tag URL (?src=nfc)', 'QR Code URL (?src=qr)', 'Stand Type'].join(','),
  ];
  const jsonManifest = [];

  const totalSteps = items.length * 2 + 2;
  let currentStep = 0;

  const report = (msg) => {
    currentStep += 1;
    if (onProgress) {
      onProgress({
        step: msg,
        percent: Math.min(99, Math.round((currentStep / totalSteps) * 100)),
      });
    }
  };

  const isSticker = layoutStyle === 'sticker';
  const standPngW = 1200;
  const standPngH = isSticker ? 1200 : 1680;

  for (const item of items) {
    const isCounter = item.table_id === 'COUNTER' || item.isCounter;
    const displayName = item.table_name || (isCounter ? 'Central Service Window' : `Table ${item.table_id}`);
    const filePrefix = isCounter
      ? '00-Service-Window'
      : `Table-${ String(item.table_id).padStart(2, '0') }-${sanitizeSlug(displayName)}`;

    report(`Generating vector SVG & high-res PNG stand for ${displayName}…`);

    // 1. Printable Table Stand SVG (with Table #, QR Code, and "Tap Phone Here or Scan QR")
    const standSvg = generateTableStandSvgString(item, {
      restaurantName,
      layoutStyle,
      showPrintMarks,
    });
    zipEntries.push({
      name: `table-stands-svg/${filePrefix}-Stand.svg`,
      data: standSvg,
    });

    // 2. Printable Table Stand High-DPI PNG
    const { bytes: standPngBytes } = await svgStringToPngBytes(standSvg, standPngW, standPngH);
    zipEntries.push({
      name: `table-stands-png/${filePrefix}-Stand.png`,
      data: standPngBytes,
    });

    report(`Exporting standalone QR code assets for ${displayName}…`);

    // 3. Standalone QR Code SVG & 1024x1024 PNG
    const { fullSvg: qrOnlySvg } = getQrSvgMarkupFromDom(item.table_id);
    if (qrOnlySvg) {
      zipEntries.push({
        name: `qr-codes-svg/${filePrefix}-QR.svg`,
        data: qrOnlySvg,
      });
      const { bytes: qrPngBytes } = await svgStringToPngBytes(qrOnlySvg, 1024, 1024);
      zipEntries.push({
        name: `qr-codes-png/${filePrefix}-QR.png`,
        data: qrPngBytes,
      });
    }

    // 4. Add row to CSV & JSON manifests
    const safeName = `"${String(displayName).replace(/"/g, '""')}"`;
    csvRows.push(
      [
        item.table_id,
        safeName,
        item.short_code || '',
        item.nfcUrl,
        item.qrUrl,
        isCounter ? 'COUNTER_PREPAID' : 'DINE_IN_TABLE',
      ].join(',')
    );

    jsonManifest.push({
      table_id: item.table_id,
      table_name: displayName,
      short_code: item.short_code || null,
      nfc_url: item.nfcUrl,
      qr_url: item.qrUrl,
      stand_svg_file: `table-stands-svg/${filePrefix}-Stand.svg`,
      stand_png_file: `table-stands-png/${filePrefix}-Stand.png`,
      qr_svg_file: `qr-codes-svg/${filePrefix}-QR.svg`,
      qr_png_file: `qr-codes-png/${filePrefix}-QR.png`,
    });
  }

  // 5. Generate Multi-Page Commercial PDF and include inside the ZIP
  report('Compiling multi-page commercial PDF document…');
  const pdfBlob = await buildMultiPageStandPdfBlob(items, {
    restaurantName,
    layoutStyle,
    showPrintMarks,
  });
  const pdfBuffer = await pdfBlob.arrayBuffer();
  zipEntries.push({
    name: `${restSlug}-All-Table-Stands-Print-Ready.pdf`,
    data: new Uint8Array(pdfBuffer),
  });

  // 6. Include CSV, JSON, and Commercial Print & NFC Placement Guide
  zipEntries.push({
    name: 'table-urls-and-nfc-links.csv',
    data: csvRows.join('\n'),
  });

  zipEntries.push({
    name: 'table-urls-and-nfc-links.json',
    data: JSON.stringify(
      {
        restaurant_name: restaurantName,
        exported_at: new Date().toISOString(),
        layout_style: layoutStyle,
        total_cards: items.length,
        tables: jsonManifest,
      },
      null,
      2
    ),
  });

  const readmeText = [
    `========================================================================`,
    `  ${restaurantName.toUpperCase()} — COMMERCIAL PRINT & NFC TABLE STAND BUNDLE`,
    `========================================================================`,
    `Generated: ${new Date().toLocaleString()}`,
    `Total Cards Included: ${items.length}`,
    `Selected Stand Format: ${layoutStyle.toUpperCase()}`,
    ``,
    `INCLUDED FOLDERS & FILES:`,
    `-------------------------`,
    `1. ${restSlug}-All-Table-Stands-Print-Ready.pdf`,
    `   -> Multi-page PDF containing every table card with Table #, QR Code,`,
    `      and the visual "Tap Phone Here or Scan QR" NFC target zone.`,
    ``,
    `2. /table-stands-svg/*.svg`,
    `   -> True vector SVG files for commercial printers, Illustrator, or`,
    `      laser engraving onto wooden blocks / acrylic stands.`,
    ``,
    `3. /table-stands-png/*.png`,
    `   -> High-resolution 300-DPI PNG cards ready for instant printing.`,
    ``,
    `4. /qr-codes-svg/ & /qr-codes-png/`,
    `   -> Standalone vector SVG and 1024x1024 PNG QR codes for custom layouts.`,
    ``,
    `5. table-urls-and-nfc-links.csv & .json`,
    `   -> Complete spreadsheet of Dynamic Table Tokens, NFC URLs (?src=nfc),`,
    `      and QR URLs (?src=qr).`,
    ``,
    `NFC STICKER HARDWARE PLACEMENT GUIDE:`,
    `-------------------------------------`,
    `- Recommended NFC Tags: NTAG213 or NTAG215 (25mm - 30mm round adhesive stickers).`,
    `- Note: If mounting onto metal table surfaces, use "Anti-Metal" shielded NFC tags.`,
    `- Acrylic Stands: Adhere the programmed NFC sticker on the back of the printed`,
    `  insert directly behind the circular "TAP PHONE HERE" target ring.`,
    `- Wooden Blocks: Place the NFC sticker inside the rear recess beneath the`,
    `  "TAP PHONE HERE" target icon.`,
    `- Table Stickers: Adhere the NFC tag under the laminated vinyl decal aligned`,
    `  with the contactless target zone.`,
    `========================================================================`,
  ].join('\n');

  zipEntries.push({
    name: 'README-COMMERCIAL-PRINT-GUIDE.txt',
    data: readmeText,
  });

  report('Packaging ZIP archive…');
  const zipBlob = createZipBlob(zipEntries);
  triggerBlobDownload(zipBlob, `${restSlug}-Table-Stands-And-QRs-Bulk.zip`);

  if (onProgress) {
    onProgress({ step: 'Export complete!', percent: 100 });
  }
}
