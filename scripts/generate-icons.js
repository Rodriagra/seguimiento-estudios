import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(__dirname, '..', 'public', 'icons');

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const compressed = deflateSync(raw, { level: 9 });

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function setPixel(buf, width, x, y, [r, g, b, a]) {
  if (x < 0 || y < 0 || x >= width) return;
  const i = (y * width + x) * 4;
  buf[i] = r;
  buf[i + 1] = g;
  buf[i + 2] = b;
  buf[i + 3] = a;
}

function fillRect(buf, width, x0, y0, x1, y1, color) {
  for (let y = Math.max(0, y0); y < y1; y++) {
    for (let x = Math.max(0, x0); x < x1; x++) {
      setPixel(buf, width, x, y, color);
    }
  }
}

function fillRoundedRect(buf, width, x0, y0, x1, y1, radius, color) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const inCornerZone =
        (x < x0 + radius && y < y0 + radius) ||
        (x >= x1 - radius && y < y0 + radius) ||
        (x < x0 + radius && y >= y1 - radius) ||
        (x >= x1 - radius && y >= y1 - radius);
      if (inCornerZone) {
        const cx = x < x0 + radius ? x0 + radius : x1 - radius;
        const cy = y < y0 + radius ? y0 + radius : y1 - radius;
        const dx = x - cx + 0.5;
        const dy = y - cy + 0.5;
        if (dx * dx + dy * dy > radius * radius) continue;
      }
      setPixel(buf, width, x, y, color);
    }
  }
}

function fillCircle(buf, width, cx, cy, radius, color) {
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(buf, width, x, y, color);
      }
    }
  }
}

function drawIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const bg = [...hexToRgb('#4f46e5'), 255];
  const white = [255, 255, 255, 255];
  const header = [...hexToRgb('#3730a3'), 255];
  const accent = [...hexToRgb('#f97316'), 255];

  fillRect(buf, size, 0, 0, size, size, bg);

  const cardX0 = Math.round(size * 0.16);
  const cardY0 = Math.round(size * 0.2);
  const cardX1 = Math.round(size * 0.84);
  const cardY1 = Math.round(size * 0.86);
  const radius = Math.round(size * 0.06);

  fillRoundedRect(buf, size, cardX0, cardY0, cardX1, cardY1, radius, white);

  const headerY1 = cardY0 + Math.round(size * 0.16);
  fillRoundedRect(buf, size, cardX0, cardY0, cardX1, headerY1, radius, header);
  fillRect(buf, size, cardX0, headerY1 - radius, cardX1, headerY1, header);

  const ringRadius = Math.round(size * 0.025);
  fillCircle(buf, size, Math.round(size * 0.32), cardY0, ringRadius, white);
  fillCircle(buf, size, Math.round(size * 0.68), cardY0, ringRadius, white);

  const gridTop = headerY1 + Math.round(size * 0.08);
  const cell = Math.round(size * 0.1);
  const gap = Math.round(size * 0.045);
  const cols = 3;
  const rows = 2;
  const gridWidth = cols * cell + (cols - 1) * gap;
  const startX = Math.round((cardX0 + cardX1) / 2 - gridWidth / 2);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = startX + c * (cell + gap);
      const y0 = gridTop + r * (cell + gap);
      const isMarked = r === 0 && c === 2;
      fillRoundedRect(buf, size, x0, y0, x0 + cell, y0 + cell, Math.round(cell * 0.2), isMarked ? accent : header);
    }
  }

  return buf;
}

for (const size of [192, 512]) {
  const rgba = drawIcon(size);
  const png = encodePNG(size, size, rgba);
  writeFileSync(join(ICONS_DIR, `icon-${size}.png`), png);
  console.log(`icon-${size}.png generado`);
}
