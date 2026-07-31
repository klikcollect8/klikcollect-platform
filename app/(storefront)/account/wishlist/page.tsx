import { redirect } from "next/navigation";

/** Wishlist lives on the storefront Saved page */
export default function AccountWishlistRedirect() {
  redirect("/saved");
}
