import type { Product } from "@/types";
import { readJsonStore, writeJsonStore } from "./json-store";

const FILE = "products.json";

export type CanonicalProduct = Product;

async function readAll(): Promise<CanonicalProduct[]> {
  const data = await readJsonStore<CanonicalProduct[]>(FILE, []);
  return Array.isArray(data) ? data : [];
}

async function writeAll(products: CanonicalProduct[]): Promise<void> {
  await writeJsonStore(FILE, products);
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
