// Generates flat-color PNG app icons (no image deps required) so the PWA
// manifest has real icon files: a pair of fanned aces (black spade + red
// heart) on the brand-purple background, evoking "pocket aces".
import { deflateSync } from "zlib";
import { writeFileSync, mkdirSync } from "fs";

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// Signed distance to a rounded box, centered at origin, in local (unrotated) space.
function sdRoundBox(px, py, halfW, halfH, r) {
  const qx = Math.abs(px) - halfW + r;
  const qy = Math.abs(py) - halfH + r;
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.min(Math.max(qx, qy), 0) + Math.sqrt(ax * ax + ay * ay) - r;
}

// Classic implicit heart curve, y-up, point at bottom, lobes at top.
function insideHeart(x, y) {
  const a = x * x + y * y - 1;
  return a * a * a - x * x * y * y * y <= 0;
}

// Spade = heart flipped vertically (point at top, lobes at bottom) + a stem
// growing out of the natural cleft between the lobes (around y = -1.0).
function insideSpade(x, y) {
  if (insideHeart(x, -y)) return true;
  const stemTop = -0.92;
  const stemBottom = -1.42;
  if (y > stemTop || y < stemBottom) return false;
  const t = (y - stemTop) / (stemBottom - stemTop); // 0 at top, 1 at bottom
  const halfWidth = 0.26 * (1 - t) + 0.015;
  return Math.abs(x) <= halfWidth;
}

// Vertical midpoints of each glyph's bounding box, in the same y-up units as
// the formulas above, used to center each pip within its card.
const HEART_CENTER_Y = 0.12;
const SPADE_CENTER_Y = -0.23;

// Shortest distance from point (px,py) to segment (ax,ay)-(bx,by).
function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const abLen2 = abx * abx + aby * aby;
  let t = abLen2 > 0 ? ((px - ax) * abx + (py - ay) * aby) / abLen2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  const dx = px - cx;
  const dy = py - cy;
  return Math.sqrt(dx * dx + dy * dy);
}

// Bold sans-serif "A" as three thick strokes (two legs + a crossbar), in a
// y-up unit box (apex at top, feet at bottom), so cards clearly read as aces.
function insideLetterA(x, y, strokeHalf) {
  const apex = [0, 1];
  const footL = [-0.95, -1];
  const footR = [0.95, -1];
  const barY = -0.12;
  const t = (1 - barY) / 2;
  const barL = [apex[0] + t * (footL[0] - apex[0]), barY];
  const barR = [apex[0] + t * (footR[0] - apex[0]), barY];
  const dLegL = distToSegment(x, y, apex[0], apex[1], footL[0], footL[1]);
  const dLegR = distToSegment(x, y, apex[0], apex[1], footR[0], footR[1]);
  const dBar = distToSegment(x, y, barL[0], barL[1], barR[0], barR[1]);
  return Math.min(dLegL, dLegR, dBar) <= strokeHalf;
}

function rotate(px, py, angle) {
  const c = Math.cos(-angle);
  const s = Math.sin(-angle);
  return [px * c - py * s, px * s + py * c];
}

function makePng(size) {
  const bg = [91, 91, 224]; // #5B5BE0 accent purple
  const cardFace = [250, 250, 252];
  const cardBorder = [28, 28, 46];
  const black = [24, 24, 32];
  const red = [214, 40, 57];

  const cx = size / 2;
  const cy = size / 2;
  const cardW = size * 0.36;
  const cardH = size * 0.5;
  const r = size * 0.05;
  const border = Math.max(1.5, size * 0.014);

  const cards = [
    // Back card: black spade, fanned to the left.
    {
      center: [cx - size * 0.155, cy + size * 0.03],
      angle: (-11 * Math.PI) / 180,
      pip: "spade",
      color: black,
      centerY: SPADE_CENTER_Y,
    },
    // Front card: red heart, fanned to the right, drawn on top.
    {
      center: [cx + size * 0.155, cy - size * 0.02],
      angle: (9 * Math.PI) / 180,
      pip: "heart",
      color: red,
      centerY: HEART_CENTER_Y,
    },
  ];

  const pixels = new Array(size * size);
  for (let i = 0; i < pixels.length; i++) pixels[i] = bg;

  for (const card of cards) {
    const [ccx, ccy] = card.center;
    const halfW = cardW / 2;
    const halfH = cardH / 2;
    const letterScale = cardH * 0.28;
    const letterCenterY = 0.12; // y-up fine-tune to visually center the "A"
    const letterOffsetY = -cardH * 0.1; // image y-down: shift glyph up a bit
    const pipScale = cardH * 0.14;
    const pipOffsetY = cardH * 0.29; // image y-down: small pip sits below the "A"

    const minX = Math.max(0, Math.floor(ccx - cardH));
    const maxX = Math.min(size - 1, Math.ceil(ccx + cardH));
    const minY = Math.max(0, Math.floor(ccy - cardH));
    const maxY = Math.min(size - 1, Math.ceil(ccy + cardH));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const [lx, ly] = rotate(x - ccx, y - ccy, card.angle);
        const sd = sdRoundBox(lx, ly, halfW, halfH, r);
        if (sd > 0) continue;

        let color = cardFace;
        if (sd > -border) {
          color = cardBorder;
        } else {
          const anx = lx / letterScale;
          const any = letterCenterY - (ly - letterOffsetY) / letterScale;
          let hit = insideLetterA(anx, any, 0.17);
          if (!hit) {
            const pnx = lx / pipScale;
            const pny = card.centerY - (ly - pipOffsetY) / pipScale; // flip image-down to y-up, centered on glyph
            hit = card.pip === "heart" ? insideHeart(pnx, pny) : insideSpade(pnx, pny);
          }
          if (hit) color = card.color;
        }
        pixels[y * size + x] = color;
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 3);
    raw[rowStart] = 0; // filter byte
    for (let x = 0; x < size; x++) {
      const idx = rowStart + 1 + x * 3;
      const [r, g, b] = pixels[y * size + x];
      raw[idx] = r;
      raw[idx + 1] = g;
      raw[idx + 2] = b;
    }
  }

  const idat = deflateSync(raw);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icons", { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(`public/icons/icon-${size}.png`, makePng(size));
}
console.log("Generated pocket-aces PWA icons in public/icons/");
