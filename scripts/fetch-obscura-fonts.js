const https = require("https");
const fs = require("fs");
const path = require("path");

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          get(res.headers.location).then(resolve, reject);
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

(async () => {
  const css = fs.readFileSync("tmp-obscura.css", "utf8");
  const fontUrls = [
    ...css.matchAll(/https:\/\/cdn\.prod\.website-files\.com\/[^)"']+\.(?:otf|ttf|woff2?)/gi),
  ].map((m) => m[0]);
  console.log("fonts in css", fontUrls);

  const dir = path.join("public", "obscura", "fonts");
  fs.mkdirSync(dir, { recursive: true });

  // Known Neue Montreal from CSS url() parse earlier
  const known = [
    "https://cdn.prod.website-files.com/692f53da90a5f4498d0dc837/6963a3085b7c07db39165448_NeueMontreal-Medium.otf",
  ];
  // also scrape all website-files font-like
  const all = [...new Set([...fontUrls, ...known, ...[...css.matchAll(/url\(([^)]+\.(?:otf|ttf|woff2?))\)/gi)].map(m => m[1].replace(/['"]/g,''))])];

  for (const url of all) {
    try {
      const name = path.basename(decodeURIComponent(url.split("?")[0]));
      const buf = await get(url.startsWith("http") ? url : `https://cdn.prod.website-files.com${url}`);
      fs.writeFileSync(path.join(dir, name), buf);
      console.log("saved font", name, buf.length);
    } catch (e) {
      console.log("fail", url, e.message);
    }
  }

  // Rename avifs to friendly names based on HTML order
  const map = [
    ["asset-02.avif", "l1.avif"],
    ["asset-03.avif", "cg4.avif"],
    ["asset-04.avif", "modular3.avif"],
    ["asset-05.avif", "sig1.avif"],
    ["asset-06.avif", "va4.avif"],
    ["asset-07.avif", "l5.avif"],
    ["asset-08.avif", "l4.avif"],
    ["asset-09.avif", "cg5.avif"],
    ["asset-10.avif", "m1.avif"],
    ["asset-11.avif", "l3.avif"],
    ["asset-12.avif", "modular2.avif"],
    ["asset-13.avif", "aboutimage.avif"],
    ["asset-14.avif", "aboutimage-p-500.avif"],
  ];
  const root = path.join("public", "obscura");
  for (const [from, to] of map) {
    const a = path.join(root, from);
    const b = path.join(root, to);
    if (fs.existsSync(a)) fs.copyFileSync(a, b);
  }
  console.log("renamed");
})();
