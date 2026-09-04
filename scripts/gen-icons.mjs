import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public");
mkdirSync(outDir, { recursive: true });

const ACCENT = { r: 79, g: 140, b: 255 };
const BG = { r: 14, g: 17, b: 22 };

function icon(size) {
  const cx = size / 2;
  const radius = size * 0.42;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = x - cx;
      const dy = y - cx;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const r = Math.random();
      buf[i] = dist <= radius ? ACCENT.r : BG.r;
      buf[i + 1] = dist <= radius ? ACCENT.g : BG.g;
      buf[i + 2] = dist <= radius ? ACCENT.b : BG.b;
      buf[i + 3] = 255;
    }
  }
  return buf;
}

async function write(size) {
  const raw = icon(size);
  const png = await sharp(raw, { raw: { width: size, height: size, channels: 4 } })
    .png()
    .toBuffer();
  const file = join(outDir, `icon-${size}.png`);
  writeFileSync(file, png);
  console.log(`icon-${size}.png (${png.length} bytes)`);
}

await write(192);
await write(512);
console.log("done");
