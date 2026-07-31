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

async function download(url, dest) {
  const buf = await get(url);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return dest;
}

(async () => {
  const htmlBuf = await get("https://obscurastudio.webflow.io/");
  const html = htmlBuf.toString("utf8");
  fs.writeFileSync("tmp-obscura.html", html);

  const imgRe = /https:\/\/[^"'\\s>]+\.(?:jpg|jpeg|png|webp|avif|gif|svg)(?:\?[^"'\\s>]*)?/gi;
  const cssRe = /href="([^"]+\.css[^"]*)"/gi;
  const imgs = [...new Set([...html.matchAll(imgRe)].map((m) => m[0]))];
  const css = [...new Set([...html.matchAll(cssRe)].map((m) => m[1]))];

  console.log("IMG COUNT", imgs.length);
  imgs.forEach((u, i) => console.log(i, u));
  console.log("CSS", css);

  const outDir = path.join("public", "obscura");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "sources.json"), JSON.stringify({ imgs, css }, null, 2));

  let i = 0;
  for (const url of imgs) {
    try {
      const clean = url.split("?")[0];
      const ext = path.extname(clean) || ".jpg";
      const name = `asset-${String(i).padStart(2, "0")}${ext}`;
      await download(url, path.join(outDir, name));
      console.log("saved", name);
      i++;
    } catch (e) {
      console.log("fail", url, e.message);
    }
  }
})();
