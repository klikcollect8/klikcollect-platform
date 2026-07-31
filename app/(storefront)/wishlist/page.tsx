import { redirect } from "next/navigation";

/** Canonical saved list */
export default function WishlistRedirectPage() {
  redirect("/saved");
}
