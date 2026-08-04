"use client";

interface ProductBadgesProps {
  badges?: string[];
}

export default function ProductBadges({ badges }: ProductBadgesProps) {
  if (!badges || badges.length === 0) return null;

  // Only show essential badges: Best Seller and New Arrival
  const essentialBadges = badges.filter(
    (badge) => badge.includes("Best Seller") || badge.includes("New Arrival"),
  );

  if (essentialBadges.length === 0) return null;

  return (
    <div className="mb-3">
      {essentialBadges.map((badge, index) => (
        <span
          key={index}
          className="inline-block bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1 rounded-md mr-2 border border-blue-200"
        >
          {badge}
        </span>
      ))}
    </div>
  );
}
