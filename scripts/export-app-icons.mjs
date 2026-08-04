/**
 * Export PWA / Apple touch icons from assets/brand/app-icon.svg
 */
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");
const brandDir = join(root, "assets", "brand");
const sourceSvg = join(brandDir, "app-icon.svg");

mkdirSync(publicDir, { recursive: true });
mkdirSync(brandDir, { recursive: true });

const masterPng = await sharp(sourceSvg).resize(1024, 1024).png().toBuffer();
await sharp(masterPng).toFile(join(brandDir, "app-icon-1024.png"));

for (const [size, name] of [
  [180, "apple-touch-icon.png"],
  [192, "icon-192x192.png"],
  [512, "icon-512x512.png"],
  [512, "icon-maskable-512.png"],
]) {
  await sharp(masterPng)
    .resize(size, size)
    .png()
    .toFile(join(publicDir, name));
  console.log("wrote", name);
}

writeFileSync(
  join(publicDir, "favicon.svg"),
  `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#0a0a0a"/>
  <text x="16" y="17" text-anchor="middle" dominant-baseline="middle"
    font-family="ui-sans-serif,system-ui,sans-serif" font-size="13" font-weight="700"
    letter-spacing="-0.06em" fill="#f7f7f5">KC</text>
</svg>
`,
  "utf8",
);
console.log("wrote favicon.svg");
