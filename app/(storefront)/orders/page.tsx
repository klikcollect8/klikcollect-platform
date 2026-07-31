import { redirect } from "next/navigation";

/** Canonical orders live under the account shell. */
export default function OrdersRedirectPage() {
  redirect("/account/orders");
}
