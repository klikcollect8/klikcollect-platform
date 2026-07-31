import { ensureNairobiSeed } from "../lib/seed-nairobi";

async function main() {
  const result = await ensureNairobiSeed();
  console.log("Reseeded:", result);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
