import { redirect } from "next/navigation";

/** Vendors cannot create canonical products — platform owns the catalogue. */
export default function OsProductNewRedirect() {
  redirect("/app/products");
}
