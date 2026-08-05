import type { Metadata } from "next";
import CommerceMapPage from "@/components/maps/CommerceMapPage";

export const metadata: Metadata = {
  title: "Maps · KlikCollect",
  description:
    "Discover shops near you on the map — routes, places search, and live ETAs across Nairobi.",
};

export default function MapsPage() {
  return <CommerceMapPage />;
}
