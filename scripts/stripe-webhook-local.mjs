/**
 * Print / refresh local Stripe webhook forwarding secret.
 * Usage: node scripts/stripe-webhook-local.mjs
 *
 * Requires Stripe CLI: https://docs.stripe.com/stripe-cli
 *   winget install Stripe.StripeCli
 *   OR download from GitHub releases
 */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const forwardTo =
  process.env.STRIPE_WEBHOOK_FORWARD_URL ||
  "localhost:3000/api/webhooks/stripe";

function upsertEnv(path, key, value) {
  let content = existsSync(path) ? readFileSync(path, "utf8") : "";
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(content)) content = content.replace(re, line);
  else content = content.trimEnd() + (content ? "\n" : "") + line + "\n";
  writeFileSync(path, content, "utf8");
}

const child = spawn(
  "stripe",
  ["listen", "--forward-to", forwardTo, "--print-secret"],
  { shell: true },
);

let secret = "";
child.stdout.on("data", (buf) => {
  const text = buf.toString();
  process.stdout.write(text);
  const m = text.match(/whsec_[A-Za-z0-9]+/);
  if (m) secret = m[0];
});
child.stderr.on("data", (buf) => process.stderr.write(buf.toString()));

child.on("close", (code) => {
  if (secret) {
    const envLocal = resolve(process.cwd(), ".env.local");
    upsertEnv(envLocal, "STRIPE_WEBHOOK_SECRET", secret);
    console.log("\nWrote STRIPE_WEBHOOK_SECRET to .env.local");
    console.log("Restart `npm run dev`, then keep `stripe listen` running:");
    console.log(`  stripe listen --forward-to ${forwardTo}`);
  } else {
    console.error(
      "\nNo whsec_ found. Install Stripe CLI and run: stripe login",
    );
  }
  process.exit(code ?? 0);
});
