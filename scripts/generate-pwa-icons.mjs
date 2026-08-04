import sharp from "sharp";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

async function mk(size, file) {
  const pad = Math.round(size * 0.12);
  const inner = size - pad * 2;
  const font = Math.round(size * 0.28);
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="100%" height="100%" fill="#f7f7f5"/>
      <rect x="${pad}" y="${pad}" width="${inner}" height="${inner}" fill="#0a0a0a"/>
      <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
        font-family="Arial,sans-serif" font-weight="700" font-size="${font}" fill="#f7f7f5">KC</text>
    </svg>`,
  );
  const out = join(root, "public", file);
  await sharp(svg).png().toFile(out);
  console.log("wrote", out);
}

await mk(192, "icon-192x192.png");
await mk(512, "icon-512x512.png");
