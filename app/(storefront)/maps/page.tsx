import { redirect } from "next/navigation";

/** Maps is temporarily disabled — keep route for bookmarks, send users to shop. */
export default function MapsPage() {
  redirect("/shop");
}
