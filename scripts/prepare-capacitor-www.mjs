/**
 * Ensures capacitor/www exists for `cap sync`.
 * Remote-URL shell: this is only a fallback splash, not a full Next export.
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const www = join(root, "capacitor", "www");
const indexPath = join(www, "index.html");

mkdirSync(www, { recursive: true });

if (!existsSync(indexPath)) {
  writeFileSync(
    indexPath,
    `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>KlikCollect</title></head><body><p>KlikCollect</p></body></html>\n`,
    "utf8",
  );
  console.log("Created capacitor/www/index.html");
} else {
  // Touch read to confirm readable
  readFileSync(indexPath, "utf8");
  console.log("capacitor/www ready");
}
