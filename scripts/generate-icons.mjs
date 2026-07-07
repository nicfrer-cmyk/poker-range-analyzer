// Generates minimal flat-color PNG app icons (no image deps required) so the
// PWA manifest has real icon files. Replace these with real branded artwork
// later — see ROADMAP.md.
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

function makePng(size, [r, g, b], accentHex) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(size * (1 + size * 3));
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.32;
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 3);
    raw[rowStart] = 0; // filter byte
    for (let x = 0; x < size; x++) {
      const idx = rowStart + 1 + x * 3;
      const dx = x - cx;
      const dy = y - cy * 0.95;
      const inSpade = dx * dx + dy * dy < radius * radius;
      if (inSpade) {
        raw[idx] = 255;
        raw[idx + 1] = 255;
        raw[idx + 2] = 255;
      } else {
        raw[idx] = r;
        raw[idx + 1] = g;
        raw[idx + 2] = b;
      }
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
const bg = [91, 91, 224]; // #5B5BE0 accent purple — icons keep a colored mark for home-screen visibility even though the in-app theme is white
for (const size of [192, 512]) {
  writeFileSync(`public/icons/icon-${size}.png`, makePng(size, bg));
}
console.log("Generated placeholder PWA icons in public/icons/");
