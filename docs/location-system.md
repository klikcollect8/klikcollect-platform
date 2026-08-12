# Location System

The upgraded KlikCollect location stack. Mapbox remains the sole provider;
everything below builds on the existing `lib/mapbox-api.ts` / `MapCanvas`
foundation — there is no second location system.

## Architecture

```
UI            LocationPicker · DeliverToButton · DeliveryLocationStep
              BranchLocationEditor · /account/addresses · /admin/locations
                              │
Core          lib/location/types.ts        canonical model + confidence
              lib/location/validate.ts     ranges, Kenya bbox, suspicious
              lib/location/provider.ts     cache, abort, latest-wins, metrics
              lib/location/saved-locations.ts   unified store (DB + local)
              lib/location/corrections.ts  pin-correction signals
                              │
Existing      lib/mapbox-api.ts · LocationProvider (GPS) · MapCanvas
                              │
Server        /api/user/locations          saved-location CRUD (Clerk)
              /api/location/corrections    best-effort correction log
              /api/location/metrics        in-memory provider aggregates
              /api/admin/locations/quality quality queues
              hardened: delivery-quote, orders, os/branches
                              │
DB (038)      user_saved_locations · location_corrections
              orders.delivery_* columns · stores.location_* columns
```

## Core concepts

| Concept | Meaning |
|---|---|
| Address | Descriptive text ("Juja Road, Nairobi") — never assumed accurate |
| Delivery point | Authoritative lat/lng the rider navigates to |
| Confidence | `high · medium · low · user_pinned · gps_verified · provider_resolved · manual` |
| Verification | `unverified · user_pinned · gps_verified · admin_verified` |

The delivery pin is stored separately from the address text everywhere
(`user_saved_locations.delivery_lat/lng` vs `address_lat/lng`,
`orders.delivery_lat/lng` vs `notes`).

Confidence derivation (`lib/location/types.ts`):

- GPS: ≤ 35 m → `gps_verified`, ≤ 120 m → `medium`, else `low`.
- Provider: relevance ≥ 0.9 → `high`, ≥ 0.6 → `medium`, else `low`;
  falls back to feature type (address/POI high, street/neighbourhood medium,
  place/region low).

## Coordinate validation (client + server)

`lib/location/validate.ts` — shared by UI (warn) and APIs (reject/flag):

- `isValidLatLng` — numeric ranges only.
- `isInKenyaBbox` / `isInNairobiMetro`.
- `isSuspiciousCoordinate` — (0,0), zero axes, exact default map centre.
- `checkCoordinate` — invalid range and suspicious are **hard failures
  (422)**; outside-Kenya / outside-metro are soft flags.

Hardened routes: `POST /api/orders` (delivery point persisted + validated),
`POST /api/checkout/delivery-quote` (bad drops rejected, flagged drops fall
back to zone pricing), `POST/PATCH /api/os/branches` (bbox + suspicious
rejection, explicit `clearLocation`).

## GPS state machine

`LocationProvider` statuses: `idle → requesting_permission → locating →
ready | low_accuracy | stale | denied | error | unsupported`. Cached fixes
older than 5 min report `stale`, not `ready`. Permission is probed via
`navigator.permissions` before prompting. `useNavGps` gates fixes by
accuracy and clears the watch on permission errors.

## Provider layer

`lib/location/provider.ts` wraps the Mapbox helpers with:

- TTL caches (reverse geocode 10 min at 5 dp, search/routes/matrix 2 min,
  isochrone 5 min).
- `AbortSignal` passthrough (threaded through `lib/mapbox-api.ts`).
- `latestWins(key)` sequencer — a stale reverse geocode can never overwrite
  a newer pin.
- Op counters (attempts/success/latency/cache hits) flushed best-effort to
  `/api/location/metrics` every 60 s and on tab hide (sendBeacon).
  Aggregates are in-memory only (reset on deploy) and shown on
  `/admin/locations`.

## Saved locations

`lib/location/saved-locations.ts`: DB-backed via `/api/user/locations` when
signed in, unified localStorage key when signed out, one-time migration of
legacy `user_addresses` + `klikcollect:delivery-pins` (legacy keys kept).
Max 30 locations per user; local-only ids are re-created in the DB on next
edit while signed in.

## Surfaces

- **LocationPicker** — the single SEARCH → PIN → DETAILS flow (stationary
  centre pin, debounced reverse geocode, confidence badge, GPS with accuracy
  indicator, saved/recent shortcuts, mobile bottom sheet, desktop side
  panel). Fully operable without the map.
- **DeliverToButton + ActiveLocationContext** — global "Deliver to" chip in
  the header; PDP, cart quote, and checkout read the active location.
- **Checkout** — picker-integrated; stale quotes are blanked while the new
  pin's quote resolves; delivery coords/landmark/instructions/confidence
  persist to `orders`.
- **/account/addresses** — current / saved / recent management with map
  previews and edit-with-pin.
- **BranchLocationEditor** (`/app/branches`) — map picker with reverse
  geocode preview, verification badge, "Open in maps", advanced raw-coords
  mode, and warnings (missing / suspicious / out-of-Kenya / duplicate
  within 30 m of a sibling branch).
- **/admin/locations** — quality centre: missing/suspicious/duplicate/
  unverified branch pins, recent pin corrections, low-confidence orders,
  provider metrics.

## Pin corrections

When a user moves the pin > 25 m from a provider geocode,
`maybeRecordCorrection` posts both coordinates to
`/api/location/corrections` (fire-and-forget; distance recomputed
server-side). Contexts: `checkout`, `saved_location`, `vendor_branch`.
Feeds the admin quality centre.

## Automated checks

```
npx tsx scripts/verify-location-system.ts
```

Covers validation bounds, bbox/suspicious heuristics, `checkCoordinate`
semantics, confidence derivation, latest-wins sequencing, provider
short-query behaviour, and the legacy localStorage migration.

## Kenya manual test matrix

Search / geocoding (Nairobi):

| Query | Expect |
|---|---|
| "Westlands" | Neighbourhood result, medium confidence, pin-confirm prompt |
| "Kilimani" | Same as above |
| "Garden City Mall" | POI, high confidence, precise pin |
| "TRM Drive" | Street match, medium confidence |
| "Juja Road" | Street match; pin adjust expected |
| "Eastleigh 1st Avenue" | Resolves; landmark field encouraged |
| "Grden Cty" (misspelt) | Still suggests Garden City (fuzzy) |
| "Nyayo Estate Embakasi" | Estate-level result, medium/low confidence |
| Landmark only ("next to Naivas Kilimani") | Search may fail → manual pin + landmark field carries the info |

GPS:

| Scenario | Expect |
|---|---|
| Accurate fix (≤ 35 m) | "GPS verified" badge, accuracy circle small |
| Coarse fix (35–120 m) | `low_accuracy`/approximate copy, prompt to adjust pin |
| Permission denied | No re-prompt loop; "Enter address manually" path works |
| Timeout / unavailable | Error state with retry; search still usable |
| Cached fix > 5 min | `stale` state; refreshes on track |

Degraded modes:

| Scenario | Expect |
|---|---|
| Mapbox token missing | Text address entry still works; no crashes; static maps hidden |
| Directions API failure | Zone-based fee copy ("Estimated from zone"), never NaN/0 min |
| Offline mid-checkout | Pin + text retained; quote marked recalculating on reconnect |

Vendor + admin:

| Scenario | Expect |
|---|---|
| Branch with no pin | Amber warning on `/app/branches`; listed in admin "missing" |
| Branch at (0,0) | 422 from API; editor warns "placeholder" |
| Second branch < 30 m from first | Duplicate warning in editor + admin |
| Pin moved > 25 m after search | Row appears in admin corrections |
| Delivery order with `low`/`manual` confidence | Listed in admin low-confidence orders |

Multi-vendor checkout: cart with 2+ vendors shows per-leg routing and one
drop point; changing the active location invalidates the quote display until
the new quote resolves.
