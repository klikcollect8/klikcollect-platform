/** Allowlist sanitize for product long descriptions (no raw HTML scripts). */

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "em",
  "b",
  "i",
  "ul",
  "ol",
  "li",
  "h3",
  "h4",
]);

export function sanitizeProductHtml(input: string): string {
  const raw = String(input || "");
  // Strip tags that are not allowlisted; keep text content.
  return raw
    .replace(/<\s*script[\s\S]*?>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/<\/?([a-z0-9]+)(\s[^>]*)?>/gi, (match, tag: string) => {
      const t = tag.toLowerCase();
      if (!ALLOWED_TAGS.has(t)) return "";
      if (match.startsWith("</")) return `</${t}>`;
      if (t === "br") return "<br />";
      return `<${t}>`;
    })
    .trim();
}

export function plainTextToParagraphs(text: string): string {
  const parts = String(text || "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return "";
  return parts.map((p) => `<p>${escapeText(p).replace(/\n/g, "<br />")}</p>`).join("");
}

function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
