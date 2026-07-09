// Generates public/og.png (1200x630) — brand-purple background, the same pocket-aces card
// graphic as the PWA icons (scripts/generate-icons.mjs), plus a wordmark rendered with a small
// embedded 5x7 bitmap font. English wordmark, not Hebrew: hand-rasterizing a full Hebrew
// alphabet with no font/text-rendering dependency isn't practical here, and the page's own
// openGraph.title/description (Hebrew) ride alongside this image in link previews regardless.
import { deflateSync } from "zlib";
import { writeFileSync } from "fs";

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

function sdRoundBox(px, py, halfW, halfH, r) {
  const qx = Math.abs(px) - halfW + r;
  const qy = Math.abs(py) - halfH + r;
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.min(Math.max(qx, qy), 0) + Math.sqrt(ax * ax + ay * ay) - r;
}

function insideHeart(x, y) {
  const a = x * x + y * y - 1;
  return a * a * a - x * x * y * y * y <= 0;
}

function insideSpade(x, y) {
  if (insideHeart(x, -y)) return true;
  const stemTop = -0.92;
  const stemBottom = -1.42;
  if (y > stemTop || y < stemBottom) return false;
  const t = (y - stemTop) / (stemBottom - stemTop);
  const halfWidth = 0.26 * (1 - t) + 0.015;
  return Math.abs(x) <= halfWidth;
}

const HEART_CENTER_Y = 0.12;
const SPADE_CENTER_Y = -0.23;

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

// Minimal 5x7 bitmap font — only the glyphs the wordmark/tagline below actually use.
const FONT_5X7 = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10101", "10011", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
};

function drawText(pixels, size, text, startX, startY, scale, color) {
  // `pixels[y*w+x] = ...` silently no-ops for a non-integer index (JS treats it as a string
  // property on the array, not a real element write) — startX/startY here are frequently
  // fractional (e.g. `h * 0.32`), so every coordinate gets floored before use.
  let x = Math.floor(startX);
  const y0 = Math.floor(startY);
  for (const ch of text.toUpperCase()) {
    const glyph = FONT_5X7[ch] ?? FONT_5X7[" "];
    for (let gy = 0; gy < 7; gy++) {
      for (let gx = 0; gx < 5; gx++) {
        if (glyph[gy][gx] !== "1") continue;
        for (let py = 0; py < scale; py++) {
          for (let px = 0; px < scale; px++) {
            const ix = x + gx * scale + px;
            const iy = y0 + gy * scale + py;
            if (ix < 0 || ix >= size.w || iy < 0 || iy >= size.h) continue;
            pixels[iy * size.w + ix] = color;
          }
        }
      }
    }
    x += 6 * scale; // 5px glyph + 1px spacing
  }
  return x;
}

function makeOgImage() {
  const w = 1200;
  const h = 630;
  const bg = [91, 91, 224]; // #5B5BE0 accent purple
  const cardFace = [250, 250, 252];
  const cardBorder = [28, 28, 46];
  const black = [24, 24, 32];
  const red = [214, 40, 57];
  const white = [255, 255, 255];
  const softWhite = [223, 223, 250];

  const pixels = new Array(w * h);
  for (let i = 0; i < pixels.length; i++) pixels[i] = bg;

  // Pocket-aces card graphic, enlarged, on the right side of the canvas.
  const cardCx = w * 0.82;
  const cardCy = h * 0.5;
  const cardH = h * 0.42;
  const cardW = cardH * 0.72;
  const r = cardH * 0.05;
  const border = cardH * 0.014;

  const cards = [
    { center: [cardCx - cardW * 0.42, cardCy + h * 0.03], angle: (-11 * Math.PI) / 180, pip: "spade", color: black, centerY: SPADE_CENTER_Y },
    { center: [cardCx + cardW * 0.42, cardCy - h * 0.02], angle: (9 * Math.PI) / 180, pip: "heart", color: red, centerY: HEART_CENTER_Y },
  ];

  for (const card of cards) {
    const [ccx, ccy] = card.center;
    const halfW = cardW / 2;
    const halfH = cardH / 2;
    const letterScale = cardH * 0.28;
    const letterCenterY = 0.12;
    const letterOffsetY = -cardH * 0.1;
    const pipScale = cardH * 0.14;
    const pipOffsetY = cardH * 0.29;

    const minX = Math.max(0, Math.floor(ccx - cardH));
    const maxX = Math.min(w - 1, Math.ceil(ccx + cardH));
    const minY = Math.max(0, Math.floor(ccy - cardH));
    const maxY = Math.min(h - 1, Math.ceil(ccy + cardH));

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
            const pny = card.centerY - (ly - pipOffsetY) / pipScale;
            hit = card.pip === "heart" ? insideHeart(pnx, pny) : insideSpade(pnx, pny);
          }
          if (hit) color = card.color;
        }
        pixels[y * w + x] = color;
      }
    }
  }

  // Wordmark + tagline, left-aligned, kept well clear of the card graphic on the right.
  const size = { w, h };
  const titleScale = 7;
  const title1 = "POKER RANGE";
  const title2 = "ANALYZER";
  const titleX = w * 0.07;
  let ty = h * 0.32;
  drawText(pixels, size, title1, titleX, ty, titleScale, white);
  ty += 7 * titleScale + 10;
  drawText(pixels, size, title2, titleX, ty, titleScale, white);
  ty += 7 * titleScale + 30;

  const tagScale = 3;
  const tagline = "POST-GAME HAND & RANGE ANALYSIS";
  drawText(pixels, size, tagline, titleX, ty, tagScale, softWhite);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    const rowStart = y * (1 + w * 3);
    raw[rowStart] = 0;
    for (let x = 0; x < w; x++) {
      const idx = rowStart + 1 + x * 3;
      const [rr, gg, bb] = pixels[y * w + x];
      raw[idx] = rr;
      raw[idx + 1] = gg;
      raw[idx + 2] = bb;
    }
  }

  const idat = deflateSync(raw);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

writeFileSync("public/og.png", makeOgImage());
console.log("Generated public/og.png (1200x630)");
