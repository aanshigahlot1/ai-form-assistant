// scripts/generate-icons.js
// Generates extension icons programmatically (no external dependencies)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = path.join(__dirname, '..', 'extension', 'icons');

fs.mkdirSync(ICONS_DIR, { recursive: true });

function createIconPNG(size) {
  const w = size, h = size;
  const img = Array.from({ length: h }, () => Array.from({ length: w }, () => [0, 0, 0, 0]));

  const set = (x, y, r, g, b, a = 255) => {
    if (x >= 0 && x < w && y >= 0 && y < h) img[y][x] = [r, g, b, a];
  };

  const fillRect = (x1, y1, x2, y2, r, g, b, a = 255) => {
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) set(x, y, r, g, b, a);
  };

  const fillCircle = (cx, cy, rad, r, g, b, a = 255) => {
    for (let y = cy - rad; y <= cy + rad; y++)
      for (let x = cx - rad; x <= cx + rad; x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= rad ** 2) set(x, y, r, g, b, a);
  };

  // Background: indigo #6366f1 with rounded corners
  const [ir, ig, ib] = [99, 102, 241];
  const cr = Math.max(2, Math.floor(size / 6));
  fillRect(cr, 0, w - cr - 1, h - 1, ir, ig, ib);
  fillRect(0, cr, w - 1, h - cr - 1, ir, ig, ib);
  fillCircle(cr, cr, cr, ir, ig, ib);
  fillCircle(w - cr - 1, cr, cr, ir, ig, ib);
  fillCircle(cr, h - cr - 1, cr, ir, ig, ib);
  fillCircle(w - cr - 1, h - cr - 1, cr, ir, ig, ib);

  if (size >= 32) {
    const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
    const eyeR = Math.max(1, Math.floor(size / 12));
    const eyeOff = Math.floor(size / 7);
    const mouthY = cy + Math.floor(size / 6);
    const mouthW = Math.floor(size / 5);
    const mouthH = Math.max(1, Math.floor(size / 18));
    const antH = Math.floor(size / 8);
    const antW = Math.max(1, Math.floor(size / 20));
    const antY = Math.floor(h / 7);
    const dotR = Math.max(2, Math.floor(size / 14));

    // Antenna
    fillRect(cx - antW, antY, cx + antW, cy - eyeR * 3, 255, 255, 255);
    fillCircle(cx, antY, dotR, 255, 220, 50); // Yellow dot

    // Eyes
    fillCircle(cx - eyeOff, cy - eyeR, eyeR, 255, 255, 255);
    fillCircle(cx + eyeOff, cy - eyeR, eyeR, 255, 255, 255);
    // Pupils
    if (size >= 48) {
      const pupR = Math.max(1, Math.floor(eyeR / 2));
      fillCircle(cx - eyeOff, cy - eyeR, pupR, ir, ig, ib);
      fillCircle(cx + eyeOff, cy - eyeR, pupR, ir, ig, ib);
    }

    // Mouth
    fillRect(cx - mouthW, mouthY, cx + mouthW, mouthY + mouthH, 255, 255, 255);

    // Ears/side indicators (small squares)
    if (size >= 48) {
      const earSize = Math.max(2, Math.floor(size / 14));
      fillRect(cr + 1, cy - earSize, cr + earSize, cy + earSize, 255, 255, 255, 180);
      fillRect(w - cr - earSize - 1, cy - earSize, w - cr - 2, cy + earSize, 255, 255, 255, 180);
    }
  } else {
    // Simple white dot for tiny icons
    fillCircle(Math.floor(w / 2), Math.floor(h / 2), Math.max(2, Math.floor(size / 4)), 255, 255, 255);
  }

  // Encode PNG
  let rawData = Buffer.alloc(0);
  for (const row of img) {
    const rowBuf = Buffer.alloc(1 + w * 4);
    rowBuf[0] = 0; // filter type: None
    for (let x = 0; x < w; x++) {
      rowBuf[1 + x * 4] = row[x][0];
      rowBuf[2 + x * 4] = row[x][1];
      rowBuf[3 + x * 4] = row[x][2];
      rowBuf[4 + x * 4] = row[x][3];
    }
    rawData = Buffer.concat([rawData, rowBuf]);
  }

  const compressed = zlib.deflateSync(rawData);

  const chunk = (type, data) => {
    const typeBuf = Buffer.from(type, 'ascii');
    const full = Buffer.concat([typeBuf, data]);
    const crc = crc32(full);
    const buf = Buffer.alloc(4 + 4 + data.length + 4);
    buf.writeUInt32BE(data.length, 0);
    typeBuf.copy(buf, 4);
    data.copy(buf, 8);
    buf.writeUInt32BE(crc, 8 + data.length);
    return buf;
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// CRC32 table
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

for (const size of [16, 32, 48, 128]) {
  const png = createIconPNG(size);
  const outPath = path.join(ICONS_DIR, `icon${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`✓ icon${size}.png (${png.length} bytes)`);
}
console.log('✅ Icons generated in extension/icons/');
