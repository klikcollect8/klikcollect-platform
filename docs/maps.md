# Maps platform (Mapbox)

KlikCollect maps use **Mapbox GL JS** only. Google Maps appears as outbound deep links and Street View embeds.

Visual language matches Obscura: warm canvas, black ink, zero radius, translucent glass (`mapGlass` in `MapChrome`).

## Default basemap

Primary style (Street preset + `MAPBOX_STYLE`):

`mapbox://styles/mapbox/standard`

Mapbox Standard is the default across checkout, cart, pickup, and vendor maps. Override with `NEXT_PUBLIC_MAPBOX_STYLE`.

Satellite: `mapbox://styles/klikcollect/cmso06cmn01b201qo6unt7nio`

If a Studio style fails to load, MapCanvas falls back to public `mapbox://styles/mapbox/streets-v12`.

## Surfaces

| Route / surface | Audience | Interactions |
|-----------------|----------|--------------|
| Checkout delivery | Buyer | Pin drop, reverse geocode, Search Box, drive route + ETA, delivery isochrone, route animate, Street default |
| Checkout pickup | Buyer | Branded Street, flyTo selected shop, active pin pulse, tap to focus |
| Cart preview | Buyer | Compact AdvancedNavMap route + follow, branded Streets |
| Vendor / product | Buyer | Branded Street, click → flyTo, active pulse, fit-all |
| `/app/couriers` | Vendor dispatch | Shared MapCanvas engine |

Shared engine: `components/map/MapCanvas.tsx` · chrome: `components/map/MapChrome.tsx` · APIs: `lib/mapbox-api.ts` / `lib/mapbox-search.ts`

## Map styles (4)

Available via MapChrome where exposed:
- **Street** — Mapbox Standard (default)
- **Perfect** — classic Mapbox Streets
- **Satellite** — Standard Satellite (`cmso06cmn01b201qo6unt7nio`)
- **3D** — terrain / buildings / depth

## Point of view (5 + Free)

Camera presets (independent of basemap):
- **Top** · **Street** · **Bird** · **Cinema** · **Heading**
- **Free** — interactive drag tilt / rotate

## Routing & search

- Directions / Matrix / Isochrone / Map Matching via `lib/mapbox-api.ts`
- Search Box + reverse geocode via `lib/mapbox-search.ts` / `AdvancedMapSearch`
- Google Maps directions and Street View as secondary “Open in…” / embeds (no Google JS SDK)

## Native SDKs (follow-up)

Capacitor already hosts the web app. Full iOS/Android Navigation and Search SDKs are **not** wired in this phase — stay on Mapbox GL JS web.
