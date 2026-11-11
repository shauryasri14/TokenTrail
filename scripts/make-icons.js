// Generates icons/icon{16,32,48,128}.png without any dependencies: a rounded dark tile with a
// violet→cyan gauge ring (75% filled) and a bright dot at the arc's end.
// Usage: node scripts/make-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const lerp = (a, b, t) => a + (b - a) * t;
const VIOLET = [124, 92, 255];
const CYAN = [34, 211, 238];
const TILE_TOP = [30, 27, 58];
const TILE_BOTTOM = [12, 13, 24];

// Returns [r,g,b,a] for a point in unit space (0..1).
function shade(x, y) {
  const cx = x - 0.5, cy = y - 0.5;
  // Rounded-square tile.
  const R = 0.22, half = 0.5;
  const qx = Math.max(Math.abs(cx) - (half - R), 0), qy = Math.max(Math.abs(cy) - (half - R), 0);
  if (Math.hypot(qx, qy) > R) return [0, 0, 0, 0];
  let col = TILE_TOP.map((c, i) => lerp(c, TILE_BOTTOM[i], y));

  const r = Math.hypot(cx, cy);
  const ringR = 0.3, ringW = 0.085;
  // Angle from 12 o'clock, clockwise, 0..1
  let ang = (Math.atan2(cx, -cy) / (2 * Math.PI) + 1) % 1;
  const FILL = 0.75;
  if (Math.abs(r - ringR) < ringW / 2) {
    if (ang <= FILL) {
      const t = ang / FILL;
      col = VIOLET.map((c, i) => lerp(c, CYAN[i], t));
    } else {
      col = col.map((c) => lerp(c, 255, 0.12)); // faint track
    }
  }
  // Rounded cap + glow dot at the arc's end.
  const ex = Math.sin(FILL * 2 * Math.PI) * ringR, ey = -Math.cos(FILL * 2 * Math.PI) * ringR;
  const sx = 0, sy = -ringR;
  if (Math.hypot(cx - sx, cy - sy) < ringW / 2) col = VIOLET.slice();
  if (Math.hypot(cx - ex, cy - ey) < ringW * 0.75) col = [236, 254, 255];
  // Center dot.
  if (r < 0.075) col = CYAN.map((c, i) => lerp(c, VIOLET[i], 0.35));
  return [...col, 255];
}

function render(size) {
  const SS = 4; // supersampling for anti-aliasing
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const p = shade((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
          const a = p[3] / 255;
          acc[0] += p[0] * a; acc[1] += p[1] * a; acc[2] += p[2] * a; acc[3] += a;
        }
      }
      const n = SS * SS, o = (y * size + x) * 4;
      const a = acc[3] / n;
      buf[o] = a ? Math.round(acc[0] / acc[3]) : 0;
      buf[o + 1] = a ? Math.round(acc[1] / acc[3]) : 0;
      buf[o + 2] = a ? Math.round(acc[2] / acc[3]) : 0;
      buf[o + 3] = Math.round(a * 255);
    }
  }
  return png(size, buf);
}

const out = path.join(__dirname, '..', 'icons');
fs.mkdirSync(out, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  fs.writeFileSync(path.join(out, `icon${size}.png`), render(size));
  console.log(`icons/icon${size}.png`);
}
