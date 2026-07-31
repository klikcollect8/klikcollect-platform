import { promises as fs } from "fs";
import path from "path";
import type { Product } from "@/types";

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = "products.json";

export type CanonicalProduct = Product;

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readAll(): Promise<CanonicalProduct[]> {
  await ensureDir();
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, FILE), "utf8");
    const data = JSON.parse(raw) as CanonicalProduct[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeAll(products: CanonicalProduct[]): Promise<void> {
  await ensureDir();
  await fs.writeFile(path.join(DATA_DIR, FILE), JSON.stringify(products, null, 2), "utf8");
}

export async function listProducts(): Promise<CanonicalProduct[]> {
  return (await readAll()).filter((p) => p.status === "published");
}

export async function listAllProducts(): Promise<CanonicalProduct[]> {
  return readAll();
}

export async function getProductById(id: string): Promise<CanonicalProduct | null> {
  const all = await readAll();
  return all.find((p) => p.id === id) || null;
}

export async function saveProducts(products: CanonicalProduct[]): Promise<void> {
  await writeAll(products);
}
