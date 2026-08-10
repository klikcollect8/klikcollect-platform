/**
 * Fixed Nairobi delivery zones (KES major units).
 * Shop pickup is free — handled as fulfilment "pickup", not a zone fee.
 */

export type DeliveryZone = {
  id: string;
  label: string;
  /** Delivery fee in KES (major) */
  fee: number;
};

function zone(id: string, label: string, fee: number): DeliveryZone {
  return { id, label, fee };
}

/** Canonical zone list — order matches typical shipping menus. */
export const DELIVERY_ZONES: DeliveryZone[] = [
  zone("westlands", "Westlands", 300),
  zone("githurai", "Githurai", 550),
  zone("ngara", "Ngara", 300),
  zone("ruiru", "Ruiru", 700),
  zone("mountain_view", "Mountain view", 600),
  zone("kasarani", "Kasarani", 500),
  zone("cabanas", "Cabanas", 500),
  zone("rongai", "Rongai", 800),
  zone("langata", "Langata", 400),
  zone("upperhill", "Upperhill", 300),
  zone("pangani", "Pangani", 300),
  zone("south_b", "South B", 300),
  zone("gm", "GM", 400),
  zone("hurlingham", "Hurlingham", 400),
  zone("eastleigh", "Eastleigh", 300),
  zone("muthaiga", "Muthaiga", 300),
  zone("south_c", "South C", 300),
  zone("kilimani", "Kilimani", 350),
  zone("kileleshwa", "Kileleshwa", 350),
  zone("lavington", "Lavington", 400),
  zone("thika_road_mall", "Thika Road Mall", 400),
  zone("nairobi_west", "Nairobi West", 300),
  zone("buruburu", "Buruburu", 400),
  zone("donholm", "Donholm", 450),
  zone("industrial_area", "Industrial area", 350),
  zone("parklands", "Parklands", 300),
  zone("yaya_centre", "Yaya Centre", 300),
  zone("wilson_carnivore", "Wilson / Carnivore", 300),
  zone("city_stadium", "City Stadium", 250),
  zone("uchumi", "Uchumi", 300),
  zone("madaraka", "Madaraka", 300),
  zone("chiromo", "Chiromo", 300),
  zone("riverside", "Riverside", 300),
  zone("spring_valley", "Spring Valley", 400),
  zone("safaricom_hq", "Safaricom HQ", 400),
  zone("kangemi", "Kangemi", 450),
  zone("loresho", "Loresho", 450),
  zone("lower_kabete", "Lower Kabete", 450),
  zone("uthiru", "Uthiru", 500),
  zone("kinoo", "Kinoo", 600),
  zone("kikuyu", "Kikuyu", 800),
  zone("nyayo_stadium", "Nyayo Stadium", 250),
  zone("bellevue_gm", "Bellevue / GM", 350),
  zone("nextgen_mall", "Nextgen Mall", 300),
  zone("panari", "Panari", 350),
  zone("imara_daima", "Imara Daima", 500),
  zone("pipeline_transami", "Pipeline / Transami", 500),
  zone("jkia", "JKIA", 600),
  zone("syokimau_sgr", "Syokimau / SGR", 700),
  zone("mlolongo", "Mlolongo", 1000),
  zone("athi_river", "Athi River", 1000),
  zone("kitengela", "Kitengela", 1200),
  zone("kamukunji", "Kamukunji", 200),
  zone("tasia", "Tasia", 550),
  zone("dagoretti_corner", "Dagoretti Corner", 500),
  zone("kawangware", "Kawangware", 500),
  zone("wanyee", "Wanyee", 550),
  zone("karen", "Karen", 600),
  zone("bulbul", "Bulbul", 850),
  zone("ngong", "Ngong", 1100),
  zone("agha_khan", "Agha Khan", 300),
  zone("highridge", "Highridge", 300),
  zone("unep_gigiri", "UNEP / Gigiri", 450),
  zone("runda", "Runda", 550),
  zone("village_market", "Village Market", 450),
  zone("ruaka", "Ruaka", 600),
  zone("mbagathi_highrise", "Mbagathi / Highrise", 350),
  zone("strathmore", "Strathmore", 350),
  zone("carnivore", "Carnivore", 350),
  zone("bomas_galleria", "Bomas / Galleria", 450),
  zone("ongata_rongai", "Ongata Rongai", 1000),
  zone("pumwani", "Pumwani", 300),
  zone("allsops", "Allsops", 400),
  zone("garden_city", "Garden City", 450),
  zone("roasters", "Roasters", 450),
  zone("roysambu", "Roysambu", 550),
  zone("usiu", "USIU", 450),
  zone("kahawa_west", "Kahawa West", 550),
  zone("kahawa_wendani", "Kahawa Wendani", 550),
  zone("kahawa_sukari", "Kahawa Sukari", 600),
  zone("mwiki", "Mwiki", 550),
  zone("makadara", "Makadara", 300),
  zone("bahati", "Bahati", 350),
  zone("makongeni_jogoo", "Makongeni Jogoo Rd", 300),
  zone("greenspan", "Greenspan", 450),
  zone("mama_lucy", "Mama Lucy Hospital", 500),
  zone("komarock", "Komarock", 550),
  zone("nyayo_estate", "Nyayo Estate", 550),
  zone("utawala", "Utawala", 600),
  zone("fedha_umoja", "Fedha / Umoja", 550),
  zone("embakasi", "Embakasi", 550),
  zone("ruai", "Ruai", 900),
  zone("joska", "Joska", 1000),
  zone("malaa", "Malaa", 1500),
  zone("dci", "DCI", 300),
  zone("ridgeways", "Ridgeways", 400),
  zone("fourways", "Fourways", 450),
  zone("thindigua", "Thindigua", 500),
  zone("delta", "Delta", 450),
  zone("kirigiti", "Kirigiti", 900),
  zone("kiambu", "Kiambu", 900),
  zone("flat_rate", "Flat rate", 300),
  zone("valley_road", "Valley Road", 300),
  zone("knh", "KNH", 300),
  zone("kenyatta_market", "Kenyatta Market", 350),
  zone("adams_arcade", "Adams Arcade", 350),
  zone("junction_mall", "Junction Mall", 450),
  zone("jamhuri_estate", "Jamhuri Estate", 450),
  zone("juja", "Juja", 1200),
  zone("thika", "Thika", 1500),
  zone("clayworks", "Clayworks", 700),
  zone("community", "Community", 350),
  zone("dtb_airtel", "DTB centre (opp. Airtel)", 400),
];

const byId = new Map(DELIVERY_ZONES.map((z) => [z.id, z]));

export function getDeliveryZone(id: string | null | undefined): DeliveryZone | null {
  if (!id) return null;
  return byId.get(id) ?? null;
}

export function deliveryZoneFeeMajor(id: string | null | undefined): number {
  return getDeliveryZone(id)?.fee ?? 0;
}

export function deliveryZoneFeeMinor(id: string | null | undefined): number {
  return Math.round(deliveryZoneFeeMajor(id) * 100);
}

export function searchDeliveryZones(query: string): DeliveryZone[] {
  const q = query.trim().toLowerCase();
  if (!q) return DELIVERY_ZONES;
  return DELIVERY_ZONES.filter(
    (z) =>
      z.label.toLowerCase().includes(q) || z.id.replace(/_/g, " ").includes(q),
  );
}

/** Match reverse-geocode / free text onto a known zone. */
export function matchDeliveryZone(text: string): DeliveryZone | null {
  const lower = text.toLowerCase();
  let best: DeliveryZone | null = null;
  let bestLen = 0;
  for (const z of DELIVERY_ZONES) {
    const label = z.label.toLowerCase();
    if (lower.includes(label) && label.length > bestLen) {
      best = z;
      bestLen = label.length;
    }
  }
  return best;
}

/**
 * Stamped per-line fallback only. Prefer useCartDeliveryQuote for live
 * multi-shop totals (unique vendors = stops). Pickup-only bags → 0.
 */
export function cartDeliveryTotalMajor(
  items: { fulfilment?: string; deliveryFee?: number }[],
): number {
  const fees = items
    .filter((i) => i.fulfilment === "delivery")
    .map((i) => Number(i.deliveryFee) || 0)
    .filter((n) => n > 0);
  if (!fees.length) return 0;
  return Math.max(...fees);
}
