import { redirect } from "next/navigation";

/** Catalogue import is platform-only. Vendors manage offers/stock on assigned products. */
export default function OsProductImportRedirect() {
  redirect("/app/products");
}
