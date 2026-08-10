import CommerceMapLazy from "@/components/maps/CommerceMapLazy";

/** Full-bleed commerce + nav map (AdvancedNavMap chrome lives in CommerceMapPage). */
export default function MapsPage() {
  return (
    <div className="min-h-[calc(100vh-5rem)] w-full">
      <CommerceMapLazy />
    </div>
  );
}
