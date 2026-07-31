const fs = require("fs");
const https = require("https");
const path = require("path");

const h = fs.readFileSync("tmp-obscura.html", "utf8");
console.log("html length", h.length);
console.log(h.slice(0, 1500));

const urls = [...h.matchAll(/https:\/\/cdn\.prod\.website-files\.com\/[^"'\\\s)>]+/g)].map(
  (m) => m[0],
);
const unique = [...new Set(urls)];
console.log("cdn urls", unique.length);
unique.forEach((u) => console.log(u));

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
  const cssUrl = unique.find((u) => u.includes(".css"));
  if (cssUrl) {
    const css = (await get(cssUrl)).toString("utf8");
    fs.writeFileSync("tmp-obscura.css", css);
    const bgImgs = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) =>
      m[1].replace(/['"]/g, ""),
    );
    console.log("css bg urls", bgImgs.length);
    bgImgs.slice(0, 40).forEach((u) => console.log(u));
  }

  const out = path.join("public", "obscura");
  fs.mkdirSync(out, { recursive: true });
  let i = 0;
  for (const url of unique) {
    if (url.includes(".css") || url.includes(".js")) continue;
    try {
      const clean = url.split("?")[0];
      let ext = path.extname(clean);
      if (!ext || ext.length > 5) ext = ".bin";
      const name = `asset-${String(i).padStart(2, "0")}${ext}`;
      const buf = await get(url);
      fs.writeFileSync(path.join(out, name), buf);
      console.log("saved", name, buf.length);
      i++;
    } catch (e) {
      console.log("fail", url, e.message);
    }
  }
})();
