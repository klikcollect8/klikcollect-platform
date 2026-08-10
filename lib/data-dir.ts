/**
 * Best-effort data dir for local JSON stores.
 * On Vercel the filesystem is read-only under /var/task — never throw on mkdir.
 * Prefer Postgres for anything that must survive across instances.
 */
import { promises as fs } from "fs";
import path from "path";
import os from "os";

export function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.VERCEL_ENV,
  );
}

function preferredDataDir(): string {
  if (isServerlessRuntime()) {
    return path.join(os.tmpdir(), "klikcollect-data");
  }
  return path.join(process.cwd(), ".data");
}

export const DATA_DIR = preferredDataDir();

export async function ensureDataDir(): Promise<boolean> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    return true;
  } catch {
    return false;
  }
}
