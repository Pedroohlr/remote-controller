// Generates the PWA / iOS home-screen icons as PNG with no dependencies (signed-distance drawing + zlib).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web/public/icons');
fs.mkdirSync(out, { recursive: true });

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel((x + 0.5) / size, (y + 0.5) / size, size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const clamp = (v) => Math.max(0, Math.min(1, v));
const sdRoundRect = (px, py, cx, cy, hw, hh, r) => { const qx = Math.abs(px - cx) - hw + r, qy = Math.abs(py - cy) - hh + r; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r; };

// Icon: charcoal tile, soft blue glow, a rounded remote outline with a blue OK button.
function pixel(x, y, size) {
  const aa = 1.5 / size;
  const bgTop = [24, 24, 30], bgBot = [9, 9, 11];
  let c = mix(bgTop, bgBot, y);
  const glow = Math.exp(-(((x - 0.5) ** 2) + ((y - 0.38) ** 2)) / 0.05) * 0.35;
  c = mix(c, [61, 139, 255], glow);
  const d = sdRoundRect(x, y, 0.5, 0.5, 0.17, 0.32, 0.17);
  const ring = clamp(1 - Math.abs(d + 0.012) / 0.012 + 0.5 - aa * 0);
  c = mix(c, [250, 250, 250], clamp((0.014 - Math.abs(d + 0.014)) / aa));
  const ok = Math.hypot(x - 0.5, y - 0.4) - 0.075;
  c = mix(c, [61, 139, 255], clamp(-ok / aa));
  for (const dy of [0.6, 0.69]) {
    const dot = Math.hypot(x - 0.5, y - dy) - 0.022;
    c = mix(c, [161, 161, 170], clamp(-dot / aa));
  }
  void ring;
  return c;
}

for (const s of [180, 192, 512]) fs.writeFileSync(path.join(out, `icon-${s}.png`), png(s, pixel));
console.log('icons ok');
