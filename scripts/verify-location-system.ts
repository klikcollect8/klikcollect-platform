/**
 * Location-system invariants (no network, no DB).
 * Run: npx tsx scripts/verify-location-system.ts
 *
 * Covers: coordinate validation bounds, Kenya/Nairobi bboxes, suspicious
 * coordinate heuristics, confidence derivation, latest-wins sequencing,
 * provider short-query behaviour, and the legacy localStorage migration
 * into the unified saved-locations store.
 */

let failed = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("ok:", msg);
  }
}

async function main() {
  /* ----------------------------- validate.ts ----------------------------- */
  const validate = await import("../lib/location/validate");

  assert(validate.isValidLatLng(-1.2635, 36.8047), "Westlands is valid");
  assert(!validate.isValidLatLng(95, 36.8), "lat > 90 rejected");
  assert(!validate.isValidLatLng(-1.26, 200), "lng > 180 rejected");
  assert(!validate.isValidLatLng(NaN, 36.8), "NaN rejected");
  assert(
    !validate.isValidLatLng("−1.26" as unknown, 36.8),
    "string lat rejected",
  );

  assert(validate.isInKenyaBbox(-1.2921, 36.8219), "Nairobi in Kenya bbox");
  assert(validate.isInKenyaBbox(-4.05, 39.66), "Mombasa in Kenya bbox");
  assert(!validate.isInKenyaBbox(51.5, -0.12), "London outside Kenya bbox");
  assert(
    validate.isInNairobiMetro(-1.2635, 36.8047),
    "Westlands in Nairobi metro",
  );
  assert(
    !validate.isInNairobiMetro(-4.05, 39.66),
    "Mombasa outside Nairobi metro",
  );

  assert(validate.isSuspiciousCoordinate(0, 0), "null island suspicious");
  assert(validate.isSuspiciousCoordinate(0, 36.8), "zero lat suspicious");
  assert(validate.isSuspiciousCoordinate(-1.29, 0), "zero lng suspicious");
  assert(
    validate.isSuspiciousCoordinate(-1.2921, 36.8219),
    "exact default centre suspicious",
  );
  assert(
    !validate.isSuspiciousCoordinate(-1.2635, 36.8047),
    "real Westlands pin not suspicious",
  );

  assert(
    validate.checkCoordinate(-1.2635, 36.8047).reason === "valid",
    "checkCoordinate: Westlands valid",
  );
  assert(
    validate.checkCoordinate(95, 36.8).reason === "invalid_range" &&
      !validate.checkCoordinate(95, 36.8).ok,
    "checkCoordinate: out-of-range is hard failure",
  );
  assert(
    validate.checkCoordinate(0, 0).reason === "suspicious" &&
      !validate.checkCoordinate(0, 0).ok,
    "checkCoordinate: (0,0) is hard failure",
  );
  {
    const london = validate.checkCoordinate(51.5, -0.12);
    assert(
      london.ok && london.reason === "outside_kenya" && london.flagged,
      "checkCoordinate: outside Kenya is soft-flagged",
    );
  }
  {
    const mombasa = validate.checkCoordinate(-4.05, 39.66);
    assert(
      mombasa.ok && mombasa.reason === "outside_nairobi_metro",
      "checkCoordinate: Mombasa flagged outside metro but usable",
    );
  }

  {
    // 0.01° of latitude ≈ 1111.9 m
    const d = validate.distanceMeters(-1.26, 36.8, -1.25, 36.8);
    assert(
      Math.abs(d - 1111.9) < 5,
      `distanceMeters ~1112 m for 0.01° lat (got ${d.toFixed(1)})`,
    );
    assert(
      validate.distanceMeters(-1.26, 36.8, -1.26, 36.8) === 0,
      "distanceMeters 0 for identical points",
    );
  }

  /* ------------------------------- types.ts ------------------------------ */
  const types = await import("../lib/location/types");

  assert(
    types.confidenceFromGpsAccuracy(10) === "gps_verified",
    "GPS 10 m → gps_verified",
  );
  assert(
    types.confidenceFromGpsAccuracy(types.GPS_VERIFIED_ACCURACY_M) ===
      "gps_verified",
    "GPS exactly at verified threshold → gps_verified",
  );
  assert(
    types.confidenceFromGpsAccuracy(80) === "medium",
    "GPS 80 m → medium",
  );
  assert(types.confidenceFromGpsAccuracy(500) === "low", "GPS 500 m → low");
  assert(types.confidenceFromGpsAccuracy(null) === "low", "GPS null → low");

  assert(
    types.confidenceFromProvider({ relevance: 0.95 }) === "high",
    "relevance 0.95 → high",
  );
  assert(
    types.confidenceFromProvider({ relevance: 0.7 }) === "medium",
    "relevance 0.7 → medium",
  );
  assert(
    types.confidenceFromProvider({ relevance: 0.3 }) === "low",
    "relevance 0.3 → low",
  );
  assert(
    types.confidenceFromProvider({ featureType: "address" }) === "high",
    "featureType address → high",
  );
  assert(
    types.confidenceFromProvider({ featureType: "street" }) === "medium",
    "featureType street → medium",
  );
  assert(
    types.confidenceFromProvider({ featureType: "place" }) === "low",
    "featureType place → low",
  );

  const allConfidence = [
    "high",
    "medium",
    "low",
    "user_pinned",
    "gps_verified",
    "provider_resolved",
    "manual",
  ] as const;
  assert(
    allConfidence.every(
      (c) => types.confidenceLabel(c) && types.confidenceMessage(c),
    ),
    "every confidence state has a label and message",
  );
  assert(
    types.isReliableConfidence("user_pinned") &&
      !types.isReliableConfidence("low"),
    "reliability: user_pinned yes, low no",
  );

  /* ----------------------------- provider.ts ----------------------------- */
  // Import before stubbing window — the module must be SSR/Node safe.
  const provider = await import("../lib/location/provider");

  {
    const first = provider.latestWins("verify-key");
    const second = provider.latestWins("verify-key");
    assert(!first(), "latest-wins: superseded guard reports stale");
    assert(second(), "latest-wins: newest guard reports fresh");
    const other = provider.latestWins("verify-other");
    assert(other() && second(), "latest-wins: keys are independent");
  }

  {
    // Short queries short-circuit without any network call.
    const results = await provider.searchLocation("a");
    assert(
      Array.isArray(results) && results.length === 0,
      "searchLocation: <2 chars returns [] without network",
    );
  }

  assert(
    typeof provider.getLocationProviderStats() === "object",
    "provider stats snapshot available",
  );

  /* ----------------- saved-locations legacy migration -------------------- */
  // Stub browser storage, then import the store (dynamic — after stubbing).
  const store = new Map<string, string>();
  const localStorageStub = {
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => void store.clear(),
    get length() {
      return store.size;
    },
    key: (i: number) => [...store.keys()][i] ?? null,
  };
  (globalThis as Record<string, unknown>).window = globalThis;
  (globalThis as Record<string, unknown>).localStorage = localStorageStub;

  // Seed legacy stores
  store.set(
    "user_addresses",
    JSON.stringify([
      {
        id: "a1",
        name: "Home",
        street: "Riverside Drive",
        city: "Nairobi",
        state: "",
        zip: "00100",
        country: "KE",
        isDefault: true,
        lat: -1.2701,
        lng: 36.8003,
        label: "home",
      },
      {
        id: "a2",
        name: "No pin",
        street: "Somewhere",
        city: "Nairobi",
        state: "",
        zip: "",
        country: "KE",
        isDefault: false,
        // no lat/lng — must be skipped
      },
    ]),
  );
  store.set(
    "klikcollect:delivery-pins",
    JSON.stringify([
      {
        id: "p1",
        lat: -1.2635,
        lng: 36.8047,
        label: "Office",
        street: "Waiyaki Way",
        building: "Delta Towers",
        area: "Westlands",
        landmark: "Next to Delta",
        gateCode: "",
        deliveryNote: "Call at gate",
        savedAt: 1700000000000,
        source: "map_pin",
      },
      {
        // Near-duplicate of the address above — must be deduped
        id: "p2",
        lat: -1.2701,
        lng: 36.8003,
        label: "Dup of home",
        street: "",
        building: "",
        area: "",
        landmark: "",
        gateCode: "",
        deliveryNote: "",
        savedAt: 1700000000001,
        source: "gps",
      },
    ]),
  );

  const savedLocations = await import("../lib/location/saved-locations");
  const migrated = savedLocations.migrateLegacyLocations();

  assert(
    migrated.length === 2,
    `migration folds 2 usable legacy records (got ${migrated.length})`,
  );
  assert(
    migrated.some((l) => l.name === "Home" && l.label === "home" && l.isDefault),
    "legacy address kept name/label/default",
  );
  assert(
    migrated.some(
      (l) =>
        l.name === "Office" &&
        l.landmark === "Next to Delta" &&
        l.instructions === "Call at gate" &&
        l.confidence === "user_pinned",
    ),
    "legacy delivery pin kept landmark/instructions with user_pinned confidence",
  );
  assert(
    !migrated.some((l) => l.name === "No pin"),
    "address without coordinates skipped",
  );
  assert(
    !migrated.some((l) => l.name === "Dup of home"),
    "near-duplicate pin deduped against migrated address",
  );
  assert(
    store.has("klikcollect:saved-locations-migrated"),
    "migration marker written",
  );
  assert(
    store.has("user_addresses") && store.has("klikcollect:delivery-pins"),
    "legacy keys preserved for back-compat readers",
  );

  const second = savedLocations.migrateLegacyLocations();
  assert(
    second.length === 2,
    "second migration run is a no-op (no duplicates)",
  );

  /* -------------------------------- result ------------------------------- */
  if (failed) {
    console.error(`\n${failed} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll location-system checks passed.");
}

void main();
