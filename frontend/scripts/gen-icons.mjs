// scripts/gen-icons.mjs
// Converts the source image into proper PNG icons at required sizes

import sharp from "sharp";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "../public/icon-512.png");
const out = join(__dirname, "../public");

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

for (const size of sizes) {
  await sharp(src)
    .resize(size, size)
    .png()                         // force real PNG output
    .toFile(join(out, `icon-${size}.png`));
  console.log(`✅ icon-${size}.png`);
}

console.log("Done — all icons generated as proper PNG files.");
